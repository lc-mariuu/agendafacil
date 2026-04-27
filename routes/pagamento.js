const express = require('express')
const router  = express.Router()
const { MercadoPagoConfig, Payment } = require('mercadopago')
const Negocio     = require('../models/Negocio')
const Appointment = require('../models/Appointment')

// ── Mercado Pago config ──────────────────────────────────────
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
})
const payment = new Payment(client)

// ── GET /api/pagamento/config-publica/:negocioId (SEM auth) ──
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
router.post('/criar-preferencia', async (req, res) => {
  try {
    const { agendamentoId, negocioId } = req.body

    if (!agendamentoId || !negocioId) {
      return res.status(400).json({ erro: 'agendamentoId e negocioId são obrigatórios' })
    }

    const agendamento = await Appointment.findById(agendamentoId)
    if (!agendamento) {
      return res.status(404).json({ erro: 'Agendamento não encontrado' })
    }

    const negocio = await Negocio.findById(negocioId).select('pagamentosConfig nome').lean()
    if (!negocio) {
      return res.status(404).json({ erro: 'Negócio não encontrado' })
    }

    const cfg = negocio.pagamentosConfig || {}

    const precoServico = Number(agendamento.preco) || 0
    let valorCobrado = precoServico

    if (cfg.tipoValor === 'fixo') {
      valorCobrado = Number(cfg.valorFixo) || 0
    } else if (cfg.tipoValor === 'personalizado') {
      valorCobrado = precoServico * ((Number(cfg.porcentagem) || 50) / 100)
    }

    valorCobrado = Math.max(0.01, Math.round(valorCobrado * 100) / 100)

    // ✅ SDK v2: payment.create({ body: { ... } })
    const pagamentoMP = await payment.create({
      body: {
        transaction_amount: valorCobrado,
        description:        `${agendamento.servico} — ${agendamento.pacienteNome}`,
        payment_method_id:  'pix',
        payer: {
          email:      `${agendamento.pacienteNome.toLowerCase().replace(/\s+/g, '.')}@agendorapido.com`,
          first_name: agendamento.pacienteNome.split(' ')[0],
          last_name:  agendamento.pacienteNome.split(' ').slice(1).join(' ') || 'Cliente',
        },
        notification_url:   `${process.env.BASE_URL}/api/pagamento/webhook`,
        external_reference: agendamentoId,
        date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      }
    })

    const transactionData = pagamentoMP.point_of_interaction?.transaction_data

    await Appointment.findByIdAndUpdate(agendamentoId, {
      'pagamento.status':         'pendente',
      'pagamento.valor':           valorCobrado,
      'pagamento.paymentIntentId': String(pagamentoMP.id),
      atualizadoEm:                new Date(),
    })

    return res.json({
      success:       true,
      paymentId:     pagamentoMP.id,
      valorCobrado,
      linkPix:       transactionData?.qr_code        || null,
      pixBase64:     transactionData?.qr_code_base64 || null,
      linkPagamento: null,
    })

  } catch (err) {
    console.error('[pagamento] POST /criar-preferencia:', err)
    return res.status(500).json({ erro: 'Erro ao criar pagamento Pix. Tente novamente.' })
  }
})

// ── POST /api/pagamento/webhook ──────────────────────────────
router.post('/webhook', async (req, res) => {
  try {
    res.sendStatus(200)

    const { type, data } = req.query
    const body = req.body

    let paymentId = null

    if (type === 'payment' && data?.id) {
      paymentId = data.id
    } else if (body?.type === 'payment' && body?.data?.id) {
      paymentId = body.data.id
    }

    if (!paymentId) return

    // ✅ SDK v2: payment.get({ id })
    const pagamento = await payment.get({ id: paymentId })
    const status        = pagamento.status
    const agendamentoId = pagamento.external_reference

    if (!agendamentoId) return

    const agendamento = await Appointment.findById(agendamentoId)
    if (!agendamento) return

    if (status === 'approved') {
      await Appointment.findByIdAndUpdate(agendamentoId, {
        status:                      'confirmado',
        'pagamento.status':          'pago',
        'pagamento.paymentIntentId': String(paymentId),
        atualizadoEm:                new Date(),
      })
      console.log(`[webhook] Pagamento aprovado — agendamento ${agendamentoId}`)

    } else if (['rejected', 'cancelled', 'refunded', 'charged_back'].includes(status)) {
      const negocio = await Negocio.findById(agendamento.clinicaId).select('pagamentosConfig').lean()
      const cfg     = negocio?.pagamentosConfig || {}

      if (cfg.reembolso && agendamento.pagamento?.paymentIntentId) {
        try {
          // ✅ SDK v2: refund.create({ payment_id, body: {} })
          await payment.refund({ id: paymentId, body: {} })
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
router.post('/reembolsar', async (req, res) => {
  try {
    const { agendamentoId } = req.body
    const agendamento = await Appointment.findById(agendamentoId)
    if (!agendamento) return res.status(404).json({ erro: 'Agendamento não encontrado' })

    const paymentId = agendamento.pagamento?.paymentIntentId
    if (!paymentId) return res.status(400).json({ erro: 'Sem pagamento registrado' })

    // ✅ SDK v2: refund.create({ payment_id, body: {} })
    await payment.refund({ id: Number(paymentId), body: {} })

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

router.get('/status/:agendamentoId', async (req, res) => {
  try {
    const agendamento = await Appointment.findById(req.params.agendamentoId)
      .select('pagamento status')
      .lean()
 
    if (!agendamento) {
      return res.status(404).json({ erro: 'Agendamento não encontrado' })
    }
 
    const pag = agendamento.pagamento || {}
 
    // Se já está marcado como pago no banco, retorna direto
    if (pag.status === 'pago' || agendamento.status === 'confirmado') {
      return res.json({ status: 'pago', agStatus: agendamento.status })
    }
 
    // Se tem um paymentIntentId, consulta o Mercado Pago agora
    if (pag.paymentIntentId) {
      try {
        const pagamentoMP = await payment.get({ id: pag.paymentIntentId })
        const mpStatus = pagamentoMP.status // 'approved', 'pending', 'rejected' etc.
 
        if (mpStatus === 'approved') {
          // Atualiza o banco
          await Appointment.findByIdAndUpdate(req.params.agendamentoId, {
            status:                      'confirmado',
            'pagamento.status':          'pago',
            atualizadoEm:                new Date(),
          })
          return res.json({ status: 'pago', agStatus: 'confirmado' })
        }
 
        if (['rejected', 'cancelled'].includes(mpStatus)) {
          await Appointment.findByIdAndUpdate(req.params.agendamentoId, {
            'pagamento.status': 'rejeitado',
            atualizadoEm:       new Date(),
          })
          return res.json({ status: 'rejeitado', agStatus: agendamento.status })
        }
      } catch (mpErr) {
        console.warn('[status] Erro ao consultar MP:', mpErr.message)
        // Se não conseguiu consultar o MP, retorna o que tem no banco
      }
    }
 
    return res.json({ status: pag.status || 'pendente', agStatus: agendamento.status })
 
  } catch (err) {
    console.error('[pagamento] GET /status:', err)
    return res.status(500).json({ erro: 'Erro ao verificar status' })
  }
})

module.exports = router