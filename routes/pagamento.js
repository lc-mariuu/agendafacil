// routes/pagamento.js
// ─────────────────────────────────────────────────────────────────────────────
// Rotas de configuração de pagamento + lógica de taxa SaaS (R$ 0,50/transação)
// ─────────────────────────────────────────────────────────────────────────────

const express  = require('express')
const router   = express.Router()
const jwt      = require('jsonwebtoken')
const Negocio  = require('../models/Negocio')
const Pagamento = require('../models/Pagamento') // modelo de transações (crie se não existir)

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

// ── Constante da taxa SaaS ────────────────────────────────────────────────────
const TAXA_SAAS_CENTAVOS = 50          // R$ 0,50 em centavos
const TAXA_MP_PCT        = 0.0099      // 0,99% Mercado Pago

// ── GET /api/pagamento/config/:negocioId ─────────────────────────────────────
// Retorna as configurações de pagamento do negócio
router.get('/config/:negocioId', auth, async (req, res) => {
  try {
    const negocio = await Negocio.findById(req.params.negocioId).lean()
    if (!negocio) return res.status(404).json({ erro: 'Negócio não encontrado' })

    const cfg = negocio.pagamentosConfig || {}
    res.json({
      adiantado:        cfg.adiantado        ?? false,
      tipoValor:        cfg.tipoValor        ?? 'total',
      porcentagem:      cfg.porcentagem      ?? 50,
      valorFixo:        cfg.valorFixo        ?? 50,
      reembolso:        cfg.reembolso        ?? true,
      reembolsoCliente: cfg.reembolsoCliente ?? true,
      reembolsoNegocio: cfg.reembolsoNegocio ?? true,
      taxaSaasCentavos: TAXA_SAAS_CENTAVOS,
      servicos:         cfg.servicos         ?? {},
    })
  } catch (err) {
    console.error('[GET /pagamento/config]', err)
    res.status(500).json({ erro: 'Erro interno' })
  }
})

// ── PATCH /api/pagamento/config ───────────────────────────────────────────────
// Salva as configurações de pagamento do negócio
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
    // chavePix / tipoPix (retrocompatibilidade)
    chavePix,
    tipoPix,
  } = req.body

  if (!negocioId) return res.status(400).json({ erro: 'negocioId é obrigatório' })

  try {
    const update = {
      $set: {
        'pagamentosConfig.adiantado':        !!adiantado,
        'pagamentosConfig.tipoValor':        tipoValor        || 'total',
        'pagamentosConfig.porcentagem':      Number(porcentagem) || 50,
        'pagamentosConfig.valorFixo':        Number(valorFixo)   || 50,
        'pagamentosConfig.reembolso':        reembolso !== undefined ? !!reembolso : true,
        'pagamentosConfig.reembolsoCliente': reembolsoCliente !== undefined ? !!reembolsoCliente : true,
        'pagamentosConfig.reembolsoNegocio': reembolsoNegocio !== undefined ? !!reembolsoNegocio : true,
        'pagamentosConfig.taxaSaasCentavos': TAXA_SAAS_CENTAVOS,
        'pagamentosConfig.updatedAt':        new Date(),
      }
    }

    if (servicos)  update.$set['pagamentosConfig.servicos'] = servicos
    if (chavePix)  update.$set['pagamentosConfig.chavePix'] = chavePix
    if (tipoPix)   update.$set['pagamentosConfig.tipoPix']  = tipoPix

    await Negocio.findByIdAndUpdate(negocioId, update)
    res.json({ ok: true })
  } catch (err) {
    console.error('[PATCH /pagamento/config]', err)
    res.status(500).json({ erro: 'Erro ao salvar configurações' })
  }
})

// ── POST /api/pagamento/processar ─────────────────────────────────────────────
// Processa um pagamento e desconta a taxa SaaS de R$ 0,50
// Chamado pelo webhook do Mercado Pago OU pelo seu backend ao confirmar pagamento
router.post('/processar', auth, async (req, res) => {
  const { negocioId, agendamentoId, valorBruto } = req.body

  if (!negocioId || !agendamentoId || !valorBruto) {
    return res.status(400).json({ erro: 'Campos obrigatórios: negocioId, agendamentoId, valorBruto' })
  }

  const valorBrutoCentavos = Math.round(Number(valorBruto) * 100)

  // Calcular taxas
  const taxaSaas   = TAXA_SAAS_CENTAVOS                              // R$ 0,50 fixo
  const taxaMP     = Math.round(valorBrutoCentavos * TAXA_MP_PCT)    // 0,99%
  const totalTaxas = taxaSaas + taxaMP
  const valorLiquido = Math.max(0, valorBrutoCentavos - totalTaxas)  // valor que o usuário recebe

  try {
    // Registra a transação no banco
    const transacao = await Pagamento.create({
      negocioId,
      agendamentoId,
      valorBrutoCentavos,
      taxaSaasCentavos:   taxaSaas,
      taxaMPCentavos:     taxaMP,
      totalTaxasCentavos: totalTaxas,
      valorLiquidoCentavos: valorLiquido,
      status: 'processado',
      criadoEm: new Date(),
    })

    res.json({
      ok: true,
      transacaoId:   transacao._id,
      valorBruto:    (valorBrutoCentavos / 100).toFixed(2),
      taxaSaas:      (taxaSaas           / 100).toFixed(2),
      taxaMP:        (taxaMP             / 100).toFixed(2),
      totalTaxas:    (totalTaxas         / 100).toFixed(2),
      valorLiquido:  (valorLiquido       / 100).toFixed(2),
    })
  } catch (err) {
    console.error('[POST /pagamento/processar]', err)
    res.status(500).json({ erro: 'Erro ao processar pagamento' })
  }
})

// ── GET /api/pagamento/historico/:negocioId ───────────────────────────────────
// Retorna o histórico de transações do negócio com detalhamento de taxas
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

    // Totais agregados
    const totalBruto   = transacoes.reduce((s, t) => s + (t.valorBrutoCentavos    || 0), 0)
    const totalTaxasSaas = transacoes.reduce((s, t) => s + (t.taxaSaasCentavos    || 0), 0)
    const totalLiquido = transacoes.reduce((s, t) => s + (t.valorLiquidoCentavos  || 0), 0)

    res.json({
      transacoes: transacoes.map(t => ({
        ...t,
        valorBruto:   ((t.valorBrutoCentavos    || 0) / 100).toFixed(2),
        taxaSaas:     ((t.taxaSaasCentavos       || 0) / 100).toFixed(2),
        taxaMP:       ((t.taxaMPCentavos         || 0) / 100).toFixed(2),
        valorLiquido: ((t.valorLiquidoCentavos   || 0) / 100).toFixed(2),
      })),
      resumo: {
        totalTransacoes:   total,
        totalBruto:        (totalBruto          / 100).toFixed(2),
        totalTaxasSaas:    (totalTaxasSaas      / 100).toFixed(2),
        totalLiquido:      (totalLiquido        / 100).toFixed(2),
      },
      pagina:       Number(page),
      totalPaginas: Math.ceil(total / Number(limit)),
    })
  } catch (err) {
    console.error('[GET /pagamento/historico]', err)
    res.status(500).json({ erro: 'Erro ao buscar histórico' })
  }
})

// ── POST /api/pagamento/webhook-mp ────────────────────────────────────────────
// Webhook do Mercado Pago — confirma pagamento e registra taxa
router.post('/webhook-mp', async (req, res) => {
  // O MP envia um notification_url com o tipo e o id do pagamento
  const { type, data } = req.body

  if (type !== 'payment') return res.sendStatus(200)

  try {
    const mpPaymentId = data?.id
    if (!mpPaymentId) return res.sendStatus(200)

    // Aqui você buscaria o pagamento no MP via SDK/API deles:
    // const mp = new MercadoPago({ accessToken: process.env.MP_ACCESS_TOKEN })
    // const payment = await mp.payment.get(mpPaymentId)

    // Por ora, apenas logamos e confirmamos recebimento
    console.log('[WEBHOOK MP] Pagamento recebido:', mpPaymentId)

    // TODO: buscar o agendamentoId associado ao external_reference do MP
    // e chamar a lógica de /processar internamente

    res.sendStatus(200)
  } catch (err) {
    console.error('[WEBHOOK MP]', err)
    res.sendStatus(500)
  }
})

module.exports = router