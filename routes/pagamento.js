// routes/pagamento.js
// Integração completa Mercado Pago PIX + configurações de pagamento

const express    = require('express')
const router     = express.Router()
const jwt        = require('jsonwebtoken')
const { MercadoPagoConfig, Payment, Preference } = require('mercadopago')
const Negocio    = require('../models/Negocio')
const Appointment = require('../models/Appointment')
const Pagamento  = require('../models/Pagamento')

// ── Cliente MP (inicializado por negócio com o access token deles) ────────────
function getMPClient(accessToken) {
  return new MercadoPagoConfig({ accessToken })
}

// ── Middleware de autenticação ────────────────────────────────────────────────
function auth(req, res, next) {
  const header = req.headers['authorization'] || ''
  const token  = header.replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ erro: 'Token não fornecido' })
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ erro: 'Token inválido' })
  }
}

// ── Taxa SaaS ─────────────────────────────────────────────────────────────────
const TAXA_SAAS_CENTAVOS = 50    // R$ 0,50 fixo por transação → sua receita
const TAXA_MP_PCT        = 0.0099 // 0,99% cobrado pelo Mercado Pago

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/pagamento/config/:negocioId
// Retorna configurações salvas de pagamento
// ─────────────────────────────────────────────────────────────────────────────
router.get('/config/:negocioId', auth, async (req, res) => {
  try {
    const negocio = await Negocio.findById(req.params.negocioId).lean()
    if (!negocio) return res.status(404).json({ erro: 'Negócio não encontrado' })

    const cfg = negocio.pagamentosConfig || {}
    res.json({
      adiantado:        cfg.adiantado        ?? false,
      tipoValor:        cfg.tipoValor        ?? 'total',
      porcentagem:      cfg.porcentagem      ?? 50,
      valorFixo:        cfg.valorFixo        ?? 0,
      reembolso:        cfg.reembolso        ?? true,
      reembolsoCliente: cfg.reembolsoCliente ?? true,
      reembolsoNegocio: cfg.reembolsoNegocio ?? true,
      taxaSaasCentavos: TAXA_SAAS_CENTAVOS,
      mpConectado:      !!cfg.mpAccessToken,
      servicos:         cfg.servicos         ?? {},
    })
  } catch (err) {
    console.error('[GET /pagamento/config]', err)
    res.status(500).json({ erro: 'Erro interno' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/pagamento/config
// Salva configurações de pagamento
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/config', auth, async (req, res) => {
  const {
    negocioId,
    adiantado,
    tipoValor,
    porcentagem,
    valorFixo,
    reembolso,
    reembolsoCliente,
    reembolsoNegocio,
    servicos,
    mpAccessToken,  // token OAuth do MP do negócio (opcional)
  } = req.body

  if (!negocioId) return res.status(400).json({ erro: 'negocioId obrigatório' })

  try {
    const update = {
      $set: {
        'pagamentosConfig.adiantado':        !!adiantado,
        'pagamentosConfig.tipoValor':        tipoValor        || 'total',
        'pagamentosConfig.porcentagem':      Number(porcentagem) || 50,
        'pagamentosConfig.valorFixo':        Number(valorFixo)   || 0,
        'pagamentosConfig.reembolso':        reembolso        !== false,
        'pagamentosConfig.reembolsoCliente': reembolsoCliente !== false,
        'pagamentosConfig.reembolsoNegocio': reembolsoNegocio !== false,
        'pagamentosConfig.taxaSaasCentavos': TAXA_SAAS_CENTAVOS,
        'pagamentosConfig.updatedAt':        new Date(),
      }
    }

    if (servicos      !== undefined) update.$set['pagamentosConfig.servicos']      = servicos
    if (mpAccessToken !== undefined) update.$set['pagamentosConfig.mpAccessToken'] = mpAccessToken

    await Negocio.findByIdAndUpdate(negocioId, update)
    res.json({ ok: true })
  } catch (err) {
    console.error('[PATCH /pagamento/config]', err)
    res.status(500).json({ erro: 'Erro ao salvar configurações' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/pagamento/criar-preferencia
// Chamado quando cliente confirma agendamento com pagamento antecipado.
// Cria uma preferência PIX no Mercado Pago e retorna o link de pagamento.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/criar-preferencia', async (req, res) => {
  const { agendamentoId, negocioId } = req.body

  if (!agendamentoId || !negocioId) {
    return res.status(400).json({ erro: 'agendamentoId e negocioId são obrigatórios' })
  }

  try {
    // Buscar negócio e agendamento
    const [negocio, agendamento] = await Promise.all([
      Negocio.findById(negocioId).lean(),
      Appointment.findById(agendamentoId).lean(),
    ])

    if (!negocio)    return res.status(404).json({ erro: 'Negócio não encontrado' })
    if (!agendamento) return res.status(404).json({ erro: 'Agendamento não encontrado' })

    const cfg = negocio.pagamentosConfig || {}

    // Verificar se pagamento antecipado está ativo
    if (!cfg.adiantado) {
      return res.status(400).json({ erro: 'Pagamento antecipado não está ativado para este negócio' })
    }

    // Access token do MP desse negócio
    const accessToken = cfg.mpAccessToken || process.env.MP_ACCESS_TOKEN
    if (!accessToken) {
      return res.status(400).json({ erro: 'Mercado Pago não configurado para este negócio' })
    }

    // Calcular valor a cobrar
    const precoServico = Number(agendamento.preco) || 0
    let valorCobrar = precoServico

    if (cfg.tipoValor === 'personalizado') {
      valorCobrar = precoServico * ((Number(cfg.porcentagem) || 50) / 100)
    } else if (cfg.tipoValor === 'fixo') {
      valorCobrar = Number(cfg.valorFixo) || precoServico
    }
    // 'total' → cobra 100%

    if (valorCobrar <= 0) {
      return res.status(400).json({ erro: 'Valor do serviço inválido para cobrança' })
    }

    // Montar preferência no Mercado Pago
    const client     = getMPClient(accessToken)
    const preference = new Preference(client)

    const baseUrl = process.env.BASE_URL || 'https://agendorapido.com.br'

    const prefData = {
      items: [
        {
          id:          agendamento._id.toString(),
          title:       `${agendamento.servico} — ${negocio.nome}`,
          description: `Agendamento para ${agendamento.pacienteNome} em ${agendamento.data} às ${agendamento.hora}`,
          quantity:    1,
          unit_price:  Math.round(valorCobrar * 100) / 100, // garantir 2 casas decimais
          currency_id: 'BRL',
        }
      ],
      payer: {
        name:  agendamento.pacienteNome,
        phone: agendamento.pacienteTelefone
          ? { area_code: '55', number: agendamento.pacienteTelefone.replace(/\D/g, '') }
          : undefined,
      },
      payment_methods: {
        // Apenas PIX
        excluded_payment_types: [
          { id: 'credit_card' },
          { id: 'debit_card' },
          { id: 'ticket' },
        ],
        installments: 1,
      },
      // O external_reference liga o pagamento MP ao agendamento
      external_reference: agendamentoId,
      // URLs de retorno após pagamento
      back_urls: {
        success: `${baseUrl}/agendar.html?pagamento=ok&id=${agendamentoId}`,
        failure: `${baseUrl}/agendar.html?pagamento=falhou&id=${agendamentoId}`,
        pending: `${baseUrl}/agendar.html?pagamento=pendente&id=${agendamentoId}`,
      },
      auto_return:         'approved',
      // Webhook que o MP vai chamar ao confirmar pagamento
      notification_url:   `${process.env.API_URL || baseUrl}/api/pagamento/webhook-mp`,
      // Expiração: 30 minutos para pagar
      expires:            true,
      expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      statement_descriptor: negocio.nome.slice(0, 22),
    }

    const resultado = await preference.create({ body: prefData })

    // Marcar agendamento como aguardando pagamento
    await Appointment.findByIdAndUpdate(agendamentoId, {
      status:          'aguardando_pagamento',
      mpPreferenceId:  resultado.id,
      valorCobrado:    valorCobrar,
      atualizadoEm:    new Date(),
    })

    res.json({
      ok:           true,
      preferenceId: resultado.id,
      linkPagamento: resultado.init_point,       // link para abrir no browser
      linkPix:       resultado.point_of_interaction?.transaction_data?.qr_code || null,
      valorCobrado:  valorCobrar.toFixed(2),
    })

  } catch (err) {
    console.error('[POST /pagamento/criar-preferencia]', err)
    res.status(500).json({ erro: 'Erro ao criar preferência de pagamento', detalhe: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/pagamento/webhook-mp
// Recebe notificações do Mercado Pago e confirma agendamentos pagos
// ─────────────────────────────────────────────────────────────────────────────
router.post('/webhook-mp', async (req, res) => {
  // Responder 200 imediatamente para o MP não retentar
  res.sendStatus(200)

  const { type, data } = req.body
  if (type !== 'payment' || !data?.id) return

  try {
    // Buscar o pagamento no MP usando o access token padrão
    // (o MP não informa qual negócio, então usamos o token do sistema)
    const client  = getMPClient(process.env.MP_ACCESS_TOKEN)
    const payment = new Payment(client)
    const mpPay   = await payment.get({ id: data.id })

    if (!mpPay) return

    const status            = mpPay.status             // approved | rejected | pending
    const agendamentoId     = mpPay.external_reference  // nosso ID do agendamento
    const valorBruto        = mpPay.transaction_amount  // em reais (float)
    const mpPaymentId       = mpPay.id

    if (!agendamentoId) return

    const agendamento = await Appointment.findById(agendamentoId)
    if (!agendamento) return

    if (status === 'approved') {
      // ── Pagamento aprovado: confirmar agendamento ──
      const negocio = await Negocio.findById(agendamento.clinicaId).lean()
      const cfg     = (negocio && negocio.pagamentosConfig) || {}

      // Calcular taxas
      const valorBrutoCentavos     = Math.round(valorBruto * 100)
      const taxaSaas               = TAXA_SAAS_CENTAVOS
      const taxaMP                 = Math.round(valorBrutoCentavos * TAXA_MP_PCT)
      const totalTaxas             = taxaSaas + taxaMP
      const valorLiquidoCentavos   = Math.max(0, valorBrutoCentavos - totalTaxas)

      // Registrar transação
      await Pagamento.create({
        negocioId:             agendamento.clinicaId,
        agendamentoId:         agendamentoId,
        valorBrutoCentavos,
        taxaSaasCentavos:      taxaSaas,
        taxaMPCentavos:        taxaMP,
        totalTaxasCentavos:    totalTaxas,
        valorLiquidoCentavos,
        mpPaymentId:           String(mpPaymentId),
        mpStatus:              status,
        status:                'processado',
      })

      // Confirmar agendamento
      await Appointment.findByIdAndUpdate(agendamentoId, {
        status:       'confirmado',
        pagamento:    {
          status:        'pago',
          mpPaymentId:   String(mpPaymentId),
          valorPago:     valorBruto,
          pagoEm:        new Date(),
        },
        atualizadoEm: new Date(),
      })

      console.log(`[WEBHOOK MP] ✅ Agendamento ${agendamentoId} confirmado. Pago: R$${valorBruto}`)

    } else if (status === 'rejected') {
      // Pagamento rejeitado: voltar para pendente
      await Appointment.findByIdAndUpdate(agendamentoId, {
        status:       'pendente',
        pagamento:    { status: 'rejeitado', mpPaymentId: String(mpPaymentId) },
        atualizadoEm: new Date(),
      })

      console.log(`[WEBHOOK MP] ❌ Pagamento rejeitado para agendamento ${agendamentoId}`)
    }
    // 'pending' → não faz nada, aguarda próxima notificação

  } catch (err) {
    console.error('[WEBHOOK MP] Erro ao processar:', err.message)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/pagamento/reembolsar/:agendamentoId
// Reembolsa um pagamento via Mercado Pago
// ─────────────────────────────────────────────────────────────────────────────
router.post('/reembolsar/:agendamentoId', auth, async (req, res) => {
  try {
    const agendamento = await Appointment.findById(req.params.agendamentoId)
    if (!agendamento) return res.status(404).json({ erro: 'Agendamento não encontrado' })

    const mpPaymentId = agendamento.pagamento?.mpPaymentId
    if (!mpPaymentId) return res.status(400).json({ erro: 'Nenhum pagamento encontrado para reembolsar' })

    const negocio = await Negocio.findById(agendamento.clinicaId).lean()
    const accessToken = (negocio?.pagamentosConfig?.mpAccessToken) || process.env.MP_ACCESS_TOKEN

    const client  = getMPClient(accessToken)
    const payment = new Payment(client)

    // Reembolso total
    await payment.refund({ id: mpPaymentId, body: {} })

    // Atualizar agendamento
    await Appointment.findByIdAndUpdate(req.params.agendamentoId, {
      status:       'cancelado',
      pagamento:    { ...agendamento.pagamento.toObject(), status: 'reembolsado', reembolsadoEm: new Date() },
      atualizadoEm: new Date(),
    })

    // Registrar no histórico
    const transacao = await Pagamento.findOne({ agendamentoId: req.params.agendamentoId })
    if (transacao) {
      transacao.status      = 'reembolsado'
      transacao.atualizadoEm = new Date()
      await transacao.save()
    }

    res.json({ ok: true, mensagem: 'Reembolso processado com sucesso' })

  } catch (err) {
    console.error('[POST /pagamento/reembolsar]', err)
    res.status(500).json({ erro: 'Erro ao processar reembolso', detalhe: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/pagamento/historico/:negocioId
// Histórico de transações com taxas detalhadas
// ─────────────────────────────────────────────────────────────────────────────
router.get('/historico/:negocioId', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query
    const skip = (Number(page) - 1) * Number(limit)

    const [transacoes, total] = await Promise.all([
      Pagamento.find({ negocioId: req.params.negocioId })
               .sort({ criadoEm: -1 })
               .skip(skip)
               .limit(Number(limit))
               .lean(),
      Pagamento.countDocuments({ negocioId: req.params.negocioId }),
    ])

    const fmt = v => ((v || 0) / 100).toFixed(2)

    const totalBruto     = transacoes.reduce((s, t) => s + (t.valorBrutoCentavos    || 0), 0)
    const totalTaxasSaas = transacoes.reduce((s, t) => s + (t.taxaSaasCentavos      || 0), 0)
    const totalLiquido   = transacoes.reduce((s, t) => s + (t.valorLiquidoCentavos  || 0), 0)

    res.json({
      transacoes: transacoes.map(t => ({
        ...t,
        valorBruto:   fmt(t.valorBrutoCentavos),
        taxaSaas:     fmt(t.taxaSaasCentavos),
        taxaMP:       fmt(t.taxaMPCentavos),
        valorLiquido: fmt(t.valorLiquidoCentavos),
      })),
      resumo: {
        totalTransacoes: total,
        totalBruto:      fmt(totalBruto),
        totalTaxasSaas:  fmt(totalTaxasSaas),
        totalLiquido:    fmt(totalLiquido),
      },
      pagina:       Number(page),
      totalPaginas: Math.ceil(total / Number(limit)),
    })
  } catch (err) {
    console.error('[GET /pagamento/historico]', err)
    res.status(500).json({ erro: 'Erro ao buscar histórico' })
  }
})

module.exports = router