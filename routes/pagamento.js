const express     = require('express')
const router      = express.Router()
const mercadopago = require('mercadopago')
const Negocio     = require('../models/Negocio')
const Appointment = require('../models/Appointment')

// ── Mercado Pago config ──────────────────────────────────────
mercadopago.configure({ access_token: process.env.MERCADO_PAGO_ACCESS_TOKEN })

// ── GET /api/pagamento/config-publica/:negocioId (SEM auth) ──
// Usado pelo agendar.html para saber se deve cobrar Pix
router.get('/config-publica/:negocioId', async (req, res) => {
  try {
    const negocio = await Negocio.findById(req.params.negocioId)
      .select('pagamentosConfig')
      .lean()

    if (!negocio) return res.status(404).json({ success: false })

    const cfg = negocio.pagamentosConfig || {}
    return res.json({
      success:          true,
      adiantado:        !!cfg.adiantado,
      tipoValor:        cfg.tipoValor        || 'total',
      porcentagem:      Number(cfg.porcentagem) || 50,
      valorFixo:        Number(cfg.valorFixo)   || 0,
      reembolso:        cfg.reembolso        !== false,
      reembolsoCliente: cfg.reembolsoCliente !== false,
      reembolsoVoce:    cfg.reembolsoVoce    !== false,
    })
  } catch (err) {
    console.error('[pagamento] GET /config-publica:', err)
    return res.status(500).json({ success: false })
  }
})

// ── POST /api/pagamento/criar-preferencia ────────────────────
// Cria cobrança Pix via Mercado Pago para um agendamento
router.post('/criar-preferencia', async (req, res) => {
  try {
    const { agendamentoId, negocioId } = req.body

    if (!agendamentoId || !negocioId) {
      return res.status(400).json({ erro: 'agendamentoId e negocioId são obrigatórios' })
    }

    // Busca o agendamento
    const agendamento = await Appointment.findById(agendamentoId)
    if (!agendamento) {
      return res.status(404).json({ erro: 'Agendamento não encontrado' })
    }

    // Busca config de pagamento do negócio
    const negocio = await Negocio.findById(negocioId).select('pagamentosConfig nome').lean()
    if (!negocio) {
      return res.status(404).json({ erro: 'Negócio não encontrado' })
    }

    const cfg = negocio.pagamentosConfig || {}

    // Calcula o valor a cobrar
    const precoServico = Number(agendamento.preco) || 0
    let valorCobrado = precoServico

    if (cfg.tipoValor === 'fixo') {
      valorCobrado = Number(cfg.valorFixo) || 0
    } else if (cfg.tipoValor === 'personalizado') {
      valorCobrado = precoServico * ((Number(cfg.porcentagem) || 50) / 100)
    }

    valorCobrado = Math.max(0.01, Math.round(valorCobrado * 100) / 100)

    // Cria pagamento Pix no Mercado Pago
    const pagamentoMP = await mercadopago.payment.create({
      transaction_amount: valorCobrado,
      description:        `${agendamento.servico} — ${agendamento.pacienteNome}`,
      payment_method_id:  'pix',
      payer: {
        email:            `${agendamento.pacienteNome.toLowerCase().replace(/\s+/g, '.')}@agendorapido.com`,
        first_name:       agendamento.pacienteNome.split(' ')[0],
        last_name:        agendamento.pacienteNome.split(' ').slice(1).join(' ') || 'Cliente',
      },
      notification_url: `${process.env.BASE_URL}/api/pagamento/webhook`,
      external_reference: agendamentoId,
      date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
    })

    const pointOfInteraction = pagamentoMP.body.point_of_interaction
    const transactionData    = pointOfInteraction?.transaction_data

    // Salva status pendente no agendamento
    await Appointment.findByIdAndUpdate(agendamentoId, {
      'pagamento.status':          'pendente',
      'pagamento.valor':            valorCobrado,
      'pagamento.paymentIntentId':  String(pagamentoMP.body.id),
      atualizadoEm:                 new Date(),
    })

    return res.json({
      success:      true,
      paymentId:    pagamentoMP.body.id,
      valorCobrado,
      linkPix:      transactionData?.qr_code        || null,
      pixBase64:    transactionData?.qr_code_base64 || null,
      linkPagamento: null,
    })

  } catch (err) {
    console.error('[pagamento] POST /criar-preferencia:', err)
    return res.status(500).json({ erro: 'Erro ao criar pagamento Pix. Tente novamente.' })
  }
})

// ── POST /api/pagamento/webhook ──────────────────────────────
// Recebe notificações do Mercado Pago e confirma o agendamento
router.post('/webhook', async (req, res) => {
  try {
    res.sendStatus(200) // responde rápido pro MP

    const { type, data } = req.query
    const body = req.body

    let paymentId = null

    if (type === 'payment' && data?.id) {
      paymentId = data.id
    } else if (body?.type === 'payment' && body?.data?.id) {
      paymentId = body.data.id
    }

    if (!paymentId) return

    // Busca detalhes do pagamento no MP
    const pagamento = await mercadopago.payment.findById(paymentId)
    const status    = pagamento.body.status // approved | pending | rejected | cancelled
    const agendamentoId = pagamento.body.external_reference

    if (!agendamentoId) return

    const agendamento = await Appointment.findById(agendamentoId)
    if (!agendamento) return

    if (status === 'approved') {
      await Appointment.findByIdAndUpdate(agendamentoId, {
        status:                    'confirmado',
        'pagamento.status':        'pago',
        'pagamento.paymentIntentId': String(paymentId),
        atualizadoEm:              new Date(),
      })
      console.log(`[webhook] Pagamento aprovado — agendamento ${agendamentoId}`)

    } else if (['rejected', 'cancelled', 'refunded', 'charged_back'].includes(status)) {
      // Verifica se deve reembolsar automaticamente
      const negocio = await Negocio.findById(agendamento.clinicaId).select('pagamentosConfig').lean()
      const cfg     = negocio?.pagamentosConfig || {}

      if (cfg.reembolso && agendamento.pagamento?.paymentIntentId) {
        try {
          await mercadopago.refund.create({ payment_id: paymentId })
          console.log(`[webhook] Reembolso criado — pagamento ${paymentId}`)
        } catch (e) {
          console.warn('[webhook] Erro ao reembolsar:', e.message)
        }
      }

      await Appointment.findByIdAndUpdate(agendamentoId, {
        'pagamento.status': 'reembolsado',
        atualizadoEm:       new Date(),
      })
    }

  } catch (err) {
    console.error('[pagamento] webhook erro:', err.message)
  }
})

// ── POST /api/pagamento/reembolsar ───────────────────────────
// Reembolso manual pelo painel
router.post('/reembolsar', async (req, res) => {
  try {
    const { agendamentoId } = req.body
    const agendamento = await Appointment.findById(agendamentoId)
    if (!agendamento) return res.status(404).json({ erro: 'Agendamento não encontrado' })

    const paymentId = agendamento.pagamento?.paymentIntentId
    if (!paymentId) return res.status(400).json({ erro: 'Sem pagamento registrado' })

    await mercadopago.refund.create({ payment_id: Number(paymentId) })

    await Appointment.findByIdAndUpdate(agendamentoId, {
      'pagamento.status': 'reembolsado',
      atualizadoEm:       new Date(),
    })

    return res.json({ success: true })
  } catch (err) {
    console.error('[pagamento] reembolsar:', err.message)
    return res.status(500).json({ erro: 'Erro ao reembolsar' })
  }
})

module.exports = router