const express = require('express')
const router  = express.Router()
const { MercadoPagoConfig, Payment } = require('mercadopago')
const Negocio     = require('../models/Negocio')
const Appointment = require('../models/Appointment')

// ── Mercado Pago config ──────────────────────────────────────────────────────
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
})
const payment = new Payment(client)

// ── GET /api/pagamento/config-publica/:negocioId (SEM auth) ─────────────────
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

// ── POST /api/pagamento/criar-preferencia ────────────────────────────────────
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

    // ✅ Lê a config do serviço específico dentro de pagamentosConfig
    const cfgPag     = negocio.pagamentosConfig || {}
    const cfgServico = cfgPag[agendamento.servico] || {}

    const precoServico = Number(agendamento.preco) || 0
    let valorCobrado = precoServico

    // Se existe valor específico configurado para este serviço, usa ele
    if (cfgServico.valor && Number(cfgServico.valor) > 0) {
      valorCobrado = Number(cfgServico.valor)
    }

    valorCobrado = Math.max(0.01, Math.round(valorCobrado * 100) / 100)

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

    // ✅ Salva o paymentIntentId e mantém status aguardando_pagamento
    // O status só muda para 'confirmado' quando o webhook confirmar o pagamento
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

// ── POST /api/pagamento/webhook ──────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  try {
    // ✅ Responde 200 imediatamente para o Mercado Pago não retentar
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

    const pagamentoMP   = await payment.get({ id: paymentId })
    const status        = pagamentoMP.status
    const agendamentoId = pagamentoMP.external_reference

    if (!agendamentoId) return

    const agendamento = await Appointment.findById(agendamentoId)
    if (!agendamento) return

    if (status === 'approved') {
      // ✅ Pagamento confirmado: muda aguardando_pagamento → confirmado
      // e marca pagamento.status como 'pago'
      await Appointment.findByIdAndUpdate(agendamentoId, {
        status:                      'confirmado',
        'pagamento.status':          'pago',
        'pagamento.paymentIntentId': String(paymentId),
        atualizadoEm:                new Date(),
      })
      console.log(`[webhook] ✅ Aprovado — agendamento ${agendamentoId} confirmado, pagamento registrado como PAGO`)

    } else if (['rejected', 'cancelled', 'refunded', 'charged_back'].includes(status)) {
      const negocio = await Negocio.findById(agendamento.clinicaId).select('pagamentosConfig').lean()
      const cfgPag  = negocio?.pagamentosConfig || {}
      const cfgServico = cfgPag[agendamento.servico] || {}

      // Tenta reembolsar se já tinha sido pago antes
      if (agendamento.pagamento?.status === 'pago' && agendamento.pagamento?.paymentIntentId) {
        try {
          await payment.refund({ id: paymentId, body: {} })
          console.log(`[webhook] Reembolso criado — pagamento ${paymentId}`)
        } catch (e) {
          console.warn('[webhook] Erro ao reembolsar:', e.message)
        }
      }

      // ✅ Cancela o agendamento para liberar o horário
      await Appointment.findByIdAndUpdate(agendamentoId, {
        status:             'cancelado',
        'pagamento.status': ['refunded', 'charged_back'].includes(status) ? 'reembolsado' : 'rejeitado',
        atualizadoEm:       new Date(),
      })
      console.log(`[webhook] Pagamento ${status} — agendamento ${agendamentoId} cancelado`)
    }

  } catch (err) {
    console.error('[pagamento] webhook erro:', err.message)
  }
})

// ── POST /api/pagamento/reembolsar ───────────────────────────────────────────
router.post('/reembolsar', async (req, res) => {
  try {
    const { agendamentoId } = req.body
    const agendamento = await Appointment.findById(agendamentoId)
    if (!agendamento) return res.status(404).json({ erro: 'Agendamento não encontrado' })

    const paymentId = agendamento.pagamento?.paymentIntentId
    if (!paymentId) return res.status(400).json({ erro: 'Sem pagamento registrado' })

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

// ── GET /api/pagamento/status/:agendamentoId ─────────────────────────────────
// ✅ CORREÇÃO PRINCIPAL: nunca usa agendamento.status === 'confirmado' como
// indicador de pagamento, pois agendamentos sem Pix também ficam 'confirmado'
// O único indicador confiável é pagamento.status === 'pago'
router.get('/status/:agendamentoId', async (req, res) => {
  try {
    const agendamento = await Appointment.findById(req.params.agendamentoId)
      .select('pagamento status')
      .lean()

    if (!agendamento) {
      return res.status(404).json({ erro: 'Agendamento não encontrado' })
    }

    const pag = agendamento.pagamento || {}

    // ✅ Se pagamento.status já é 'pago' no banco → retorna imediatamente
    if (pag.status === 'pago') {
      return res.json({ status: 'pago', agStatus: agendamento.status })
    }

    // ✅ Se tem paymentIntentId, consulta o Mercado Pago em tempo real
    // Isso garante que mesmo se o webhook chegar atrasado (Render dormindo),
    // o polling do cliente vai detectar o pagamento corretamente
    if (pag.paymentIntentId) {
      try {
        const pagamentoMP = await payment.get({ id: pag.paymentIntentId })
        const mpStatus    = pagamentoMP.status

        if (mpStatus === 'approved') {
          // Atualiza o banco para consistência (mesmo que o webhook ainda não tenha chegado)
          await Appointment.findByIdAndUpdate(req.params.agendamentoId, {
            status:                      'confirmado',
            'pagamento.status':          'pago',
            'pagamento.paymentIntentId': String(pag.paymentIntentId),
            atualizadoEm:                new Date(),
          })
          console.log(`[status] ✅ Pagamento aprovado via polling — agendamento ${req.params.agendamentoId}`)
          return res.json({ status: 'pago', agStatus: 'confirmado' })
        }

        if (['rejected', 'cancelled'].includes(mpStatus)) {
          await Appointment.findByIdAndUpdate(req.params.agendamentoId, {
            status:             'cancelado',
            'pagamento.status': 'rejeitado',
            atualizadoEm:       new Date(),
          })
          return res.json({ status: 'rejeitado', agStatus: 'cancelado' })
        }
      } catch (mpErr) {
        console.warn('[status] Erro ao consultar MP:', mpErr.message)
      }
    }

    // ✅ Se agendamento está aguardando_pagamento → retorna 'pendente'
    // NUNCA retorna 'confirmado' aqui, para evitar falso positivo no polling
    const statusRetorno = pag.status || 'pendente'
    return res.json({ status: statusRetorno, agStatus: agendamento.status })

  } catch (err) {
    console.error('[pagamento] GET /status:', err)
    return res.status(500).json({ erro: 'Erro ao verificar status' })
  }
})

// ── PATCH /api/pagamento/config ──────────────────────────────────────────────
router.patch('/config', async (req, res) => {
  try {
    const { negocioId, chavePix, tipoPix, servicos } = req.body
    if (!negocioId) return res.status(400).json({ erro: 'negocioId obrigatório' })

    const update = {}
    if (chavePix  !== undefined) update.chavePix         = chavePix
    if (tipoPix   !== undefined) update.tipoPix          = tipoPix
    if (servicos  !== undefined) update.pagamentosConfig = servicos

    await Negocio.findByIdAndUpdate(negocioId, { $set: update })
    return res.json({ success: true })
  } catch (err) {
    console.error('[pagamento] PATCH /config:', err)
    return res.status(500).json({ erro: 'Erro ao salvar configuração' })
  }
})

// ── GET /api/pagamento/config/:negocioId ─────────────────────────────────────
router.get('/config/:negocioId', async (req, res) => {
  try {
    const negocio = await Negocio.findById(req.params.negocioId)
      .select('pagamentosConfig chavePix tipoPix')
      .lean()
    if (!negocio) return res.status(404).json({ erro: 'Negócio não encontrado' })
    return res.json({
      servicos:  negocio.pagamentosConfig || {},
      chavePix:  negocio.chavePix  || '',
      tipoPix:   negocio.tipoPix   || 'cpf',
    })
  } catch (err) {
    console.error('[pagamento] GET /config:', err)
    return res.status(500).json({ erro: 'Erro ao buscar configuração' })
  }
})

module.exports = router