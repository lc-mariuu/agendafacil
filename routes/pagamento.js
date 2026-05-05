/**
 * ═══════════════════════════════════════════════════════════════
 *  AgendoRapido — Sistema de Pagamentos (Estilo Stripe)
 *  Arquivo: pagamento.routes.js
 *
 *  Cole este arquivo no seu backend Express e registre com:
 *    app.use('/api/pagamento', require('./pagamento.routes'))
 *
 *  Dependências:
 *    npm install mercadopago mongoose crypto axios
 * ═══════════════════════════════════════════════════════════════
 */

const express  = require('express')
const router   = express.Router()
const crypto   = require('crypto')
const axios    = require('axios')
const mongoose = require('mongoose')

// ──────────────────────────────────────────────────────────────
//  CONFIGURAÇÃO
// ──────────────────────────────────────────────────────────────
const MP_ACCESS_TOKEN   = process.env.MP_ACCESS_TOKEN   // Token do Mercado Pago
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET // Secret para validar webhooks
const PLATAFORMA_TAXA   = 0.015                         // 1.5% de taxa da plataforma
const BASE_URL          = process.env.BASE_URL || 'https://agendorapido.com.br'

// ──────────────────────────────────────────────────────────────
//  MODELOS MONGOOSE (ajuste conforme seus models existentes)
// ──────────────────────────────────────────────────────────────

// Schema de Transação
const TransacaoSchema = new mongoose.Schema({
  negocioId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Negocio', required: true },
  agendamentoId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Agendamento' },
  mpPaymentId:    { type: String, index: true },
  mpOrderId:      { type: String },
  tipo:           { type: String, enum: ['pagamento', 'reembolso', 'saque', 'taxa'], required: true },
  status:         { type: String, enum: ['pendente', 'pago', 'falhou', 'reembolsado', 'cancelado'], default: 'pendente' },
  valorBruto:     { type: Number, required: true },   // Valor que o cliente pagou
  taxaPlataforma: { type: Number, default: 0 },       // Taxa do AgendoRapido
  taxaMP:         { type: Number, default: 0 },       // Taxa do Mercado Pago
  valorLiquido:   { type: Number, required: true },   // Valor que cai no saldo do negócio
  metodoPagamento:{ type: String, default: 'pix' },
  pixQrCode:      { type: String },
  pixQrCodeBase64:{ type: String },
  pixCopiaCola:   { type: String },
  pixExpiresAt:   { type: Date },
  clienteNome:    { type: String },
  clienteEmail:   { type: String },
  clienteCPF:     { type: String },
  descricao:      { type: String },
  metadata:       { type: mongoose.Schema.Types.Mixed },
  createdAt:      { type: Date, default: Date.now },
  updatedAt:      { type: Date, default: Date.now },
})

// Schema de Saldo por Negócio
const SaldoSchema = new mongoose.Schema({
  negocioId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Negocio', unique: true },
  disponivel:     { type: Number, default: 0 },   // Pronto para saque
  pendente:       { type: Number, default: 0 },   // Aguardando confirmação
  totalRecebido:  { type: Number, default: 0 },   // Histórico total
  totalSacado:    { type: Number, default: 0 },   // Total já sacado
  updatedAt:      { type: Date, default: Date.now },
})

// Schema de Saque
const SaqueSchema = new mongoose.Schema({
  negocioId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Negocio', required: true },
  valor:          { type: Number, required: true },
  status:         { type: String, enum: ['solicitado', 'processando', 'concluido', 'falhou'], default: 'solicitado' },
  mpTransferId:   { type: String },
  chavePix:       { type: String },
  tipoPix:        { type: String },
  observacao:     { type: String },
  createdAt:      { type: Date, default: Date.now },
})

const Transacao = mongoose.models.Transacao || mongoose.model('Transacao', TransacaoSchema)
const Saldo     = mongoose.models.Saldo     || mongoose.model('Saldo', SaldoSchema)
const Saque     = mongoose.models.Saque     || mongoose.model('Saque', SaqueSchema)

// ──────────────────────────────────────────────────────────────
//  MIDDLEWARE — Autenticação JWT (reuse do seu auth)
// ──────────────────────────────────────────────────────────────
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ erro: 'Token não fornecido' })
  try {
    const jwt = require('jsonwebtoken')
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ erro: 'Token inválido' })
  }
}

// ──────────────────────────────────────────────────────────────
//  HELPER — Chamar API do Mercado Pago
// ──────────────────────────────────────────────────────────────
async function mpRequest(method, endpoint, body = null) {
  const config = {
    method,
    url: `https://api.mercadopago.com${endpoint}`,
    headers: {
      'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
      'Content-Type':  'application/json',
      'X-Idempotency-Key': crypto.randomUUID(),
    },
  }
  if (body) config.data = body
  const res = await axios(config)
  return res.data
}

// ──────────────────────────────────────────────────────────────
//  HELPER — Atualizar saldo do negócio
// ──────────────────────────────────────────────────────────────
async function atualizarSaldo(negocioId, valorLiquido, tipo = 'credito') {
  const filter = { negocioId }
  const update = tipo === 'credito'
    ? { $inc: { disponivel: valorLiquido, totalRecebido: valorLiquido }, $set: { updatedAt: new Date() } }
    : { $inc: { disponivel: -valorLiquido, totalSacado:   valorLiquido }, $set: { updatedAt: new Date() } }

  await Saldo.findOneAndUpdate(filter, update, { upsert: true, new: true })
}

// ──────────────────────────────────────────────────────────────
//  ROTA 1 — Criar cobrança PIX
//  POST /api/pagamento/criar
// ──────────────────────────────────────────────────────────────
router.post('/criar', async (req, res) => {
  try {
    const {
      agendamentoId,
      negocioId,
      valor,           // Valor total do serviço
      porcentagem,     // % cobrado antecipado (ex: 50)
      clienteNome,
      clienteEmail,
      clienteCPF,
      servico,
      negocioNome,
      expiracaoMinutos = 30,
    } = req.body

    // Calcula valor a cobrar
    const valorCobrar = porcentagem
      ? parseFloat((valor * (porcentagem / 100)).toFixed(2))
      : parseFloat(valor)

    if (valorCobrar < 0.01) {
      return res.status(400).json({ erro: 'Valor mínimo é R$ 0,01' })
    }

    // Calcula taxas
    const taxaPlataforma = parseFloat((valorCobrar * PLATAFORMA_TAXA).toFixed(2))
    const taxaMP         = parseFloat((valorCobrar * 0.0099).toFixed(2)) // ~0.99% PIX MP
    const valorLiquido   = parseFloat((valorCobrar - taxaPlataforma - taxaMP).toFixed(2))

    // Data de expiração do PIX
    const expiresAt = new Date(Date.now() + expiracaoMinutos * 60 * 1000)

    // Cria cobrança PIX no Mercado Pago
    const mpPayment = await mpRequest('POST', '/v1/payments', {
      transaction_amount: valorCobrar,
      description:        `${negocioNome || 'AgendoRapido'} — ${servico || 'Agendamento'}`,
      payment_method_id:  'pix',
      payer: {
        email:        clienteEmail || 'cliente@agendorapido.com.br',
        first_name:   clienteNome?.split(' ')[0] || 'Cliente',
        last_name:    clienteNome?.split(' ').slice(1).join(' ') || '',
        identification: clienteCPF
          ? { type: 'CPF', number: clienteCPF.replace(/\D/g, '') }
          : undefined,
      },
      date_of_expiration: expiresAt.toISOString(),
      notification_url:   `${BASE_URL}/api/pagamento/webhook`,
      metadata: {
        agendamento_id: agendamentoId,
        negocio_id:     negocioId,
        plataforma:     'agendorapido',
      },
    })

    // Salva transação no banco
    const transacao = await Transacao.create({
      negocioId,
      agendamentoId,
      mpPaymentId:      String(mpPayment.id),
      tipo:             'pagamento',
      status:           'pendente',
      valorBruto:       valorCobrar,
      taxaPlataforma,
      taxaMP,
      valorLiquido,
      metodoPagamento:  'pix',
      pixQrCode:        mpPayment.point_of_interaction?.transaction_data?.qr_code,
      pixQrCodeBase64:  mpPayment.point_of_interaction?.transaction_data?.qr_code_base64,
      pixCopiaCola:     mpPayment.point_of_interaction?.transaction_data?.qr_code,
      pixExpiresAt:     expiresAt,
      clienteNome,
      clienteEmail,
      clienteCPF,
      descricao:        `${servico || 'Serviço'} — ${negocioNome}`,
      metadata:         { porcentagem, valorTotal: valor },
    })

    // Marca como pendente no saldo
    await Saldo.findOneAndUpdate(
      { negocioId },
      { $inc: { pendente: valorLiquido }, $set: { updatedAt: new Date() } },
      { upsert: true }
    )

    return res.json({
      transacaoId:    transacao._id,
      mpPaymentId:    mpPayment.id,
      qrCode:         transacao.pixQrCode,
      qrCodeBase64:   transacao.pixQrCodeBase64,
      copiaCola:      transacao.pixCopiaCola,
      valor:          valorCobrar,
      valorTotal:     valor,
      porcentagem:    porcentagem || 100,
      expiresAt:      expiresAt.toISOString(),
      status:         'pendente',
      resumo: {
        valorBruto:       valorCobrar,
        taxaPlataforma,
        taxaMP,
        valorLiquido,
      }
    })

  } catch (err) {
    console.error('[/criar] Erro:', err.response?.data || err.message)
    return res.status(500).json({ erro: 'Erro ao criar cobrança PIX', detalhe: err.message })
  }
})

// ──────────────────────────────────────────────────────────────
//  ROTA 2 — Verificar status do pagamento
//  GET /api/pagamento/status/:transacaoId
// ──────────────────────────────────────────────────────────────
router.get('/status/:transacaoId', async (req, res) => {
  try {
    const transacao = await Transacao.findById(req.params.transacaoId)
    if (!transacao) return res.status(404).json({ erro: 'Transação não encontrada' })

    // Se ainda pendente, consulta MP em tempo real
    if (transacao.status === 'pendente' && transacao.mpPaymentId) {
      try {
        const mpStatus = await mpRequest('GET', `/v1/payments/${transacao.mpPaymentId}`)
        if (mpStatus.status === 'approved' && transacao.status !== 'pago') {
          transacao.status    = 'pago'
          transacao.updatedAt = new Date()
          await transacao.save()

          // Confirma saldo
          await Saldo.findOneAndUpdate(
            { negocioId: transacao.negocioId },
            {
              $inc: { disponivel: transacao.valorLiquido, pendente: -transacao.valorLiquido, totalRecebido: transacao.valorLiquido },
              $set: { updatedAt: new Date() }
            },
            { upsert: true }
          )
        }
      } catch (mpErr) {
        console.warn('[/status] Erro ao consultar MP:', mpErr.message)
      }
    }

    return res.json({
      status:      transacao.status,
      pago:        transacao.status === 'pago',
      valor:       transacao.valorBruto,
      valorLiquido: transacao.valorLiquido,
      expiresAt:   transacao.pixExpiresAt,
    })

  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

// ──────────────────────────────────────────────────────────────
//  ROTA 3 — WEBHOOK do Mercado Pago
//  POST /api/pagamento/webhook
//  (Registre esta URL no painel do Mercado Pago)
// ──────────────────────────────────────────────────────────────
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // Valida assinatura (se configurado)
    if (MP_WEBHOOK_SECRET) {
      const xSignature  = req.headers['x-signature']
      const xRequestId  = req.headers['x-request-id']
      const dataId      = req.query['data.id'] || req.body?.data?.id

      if (xSignature) {
        const manifest  = `id:${dataId};request-id:${xRequestId};ts:${xSignature.split(',').find(p => p.startsWith('ts='))?.split('=')[1]};`
        const hmac      = crypto.createHmac('sha256', MP_WEBHOOK_SECRET).update(manifest).digest('hex')
        const expected  = xSignature.split(',').find(p => p.startsWith('v1='))?.split('=')[1]
        if (hmac !== expected) {
          console.warn('[webhook] Assinatura inválida')
          return res.status(401).json({ erro: 'Assinatura inválida' })
        }
      }
    }

    const body   = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const evento = body?.type
    const dataId = body?.data?.id

    // Só processa eventos de pagamento
    if (evento !== 'payment' || !dataId) {
      return res.status(200).json({ ok: true })
    }

    // Consulta detalhes do pagamento no MP
    const mpPayment = await mpRequest('GET', `/v1/payments/${dataId}`)
    const { status: mpStatus, metadata, id: mpId } = mpPayment

    const agendamentoId = metadata?.agendamento_id
    const negocioId     = metadata?.negocio_id

    // Encontra transação no banco
    const transacao = await Transacao.findOne({ mpPaymentId: String(mpId) })

    if (!transacao && agendamentoId && negocioId) {
      console.warn(`[webhook] Transação não encontrada para payment ${mpId}`)
      return res.status(200).json({ ok: true })
    }

    // ── Pagamento aprovado ──
    if (mpStatus === 'approved' && transacao?.status !== 'pago') {
      transacao.status    = 'pago'
      transacao.updatedAt = new Date()
      await transacao.save()

      // Credita saldo do negócio
      await Saldo.findOneAndUpdate(
        { negocioId: transacao.negocioId },
        {
          $inc: {
            disponivel:    transacao.valorLiquido,
            pendente:      -transacao.valorLiquido,
            totalRecebido: transacao.valorLiquido,
          },
          $set: { updatedAt: new Date() }
        },
        { upsert: true }
      )

      // Atualiza agendamento como confirmado
      if (transacao.agendamentoId) {
        const Agendamento = mongoose.model('Agendamento')
        await Agendamento.findByIdAndUpdate(transacao.agendamentoId, {
          'pagamento.status': 'pago',
          'pagamento.valor':  transacao.valorBruto,
          'pagamento.pagoEm': new Date(),
          status: 'confirmado',
        })
      }

      console.log(`[webhook] ✅ Pagamento ${mpId} confirmado — R$ ${transacao.valorBruto}`)
    }

    // ── Pagamento cancelado / expirado ──
    if (['cancelled', 'expired', 'rejected'].includes(mpStatus) && transacao) {
      transacao.status    = mpStatus === 'rejected' ? 'falhou' : 'cancelado'
      transacao.updatedAt = new Date()
      await transacao.save()

      // Remove do saldo pendente
      await Saldo.findOneAndUpdate(
        { negocioId: transacao.negocioId },
        { $inc: { pendente: -transacao.valorLiquido }, $set: { updatedAt: new Date() } }
      )

      console.log(`[webhook] ❌ Pagamento ${mpId} ${mpStatus}`)
    }

    // ── Reembolso ──
    if (mpStatus === 'refunded' && transacao) {
      transacao.status    = 'reembolsado'
      transacao.updatedAt = new Date()
      await transacao.save()

      await Saldo.findOneAndUpdate(
        { negocioId: transacao.negocioId },
        { $inc: { disponivel: -transacao.valorLiquido }, $set: { updatedAt: new Date() } }
      )

      console.log(`[webhook] 🔄 Pagamento ${mpId} reembolsado`)
    }

    return res.status(200).json({ ok: true })

  } catch (err) {
    console.error('[webhook] Erro:', err.message)
    return res.status(200).json({ ok: true }) // Sempre 200 pro MP não retentar
  }
})

// ──────────────────────────────────────────────────────────────
//  ROTA 4 — Solicitar reembolso
//  POST /api/pagamento/reembolsar
// ──────────────────────────────────────────────────────────────
router.post('/reembolsar', authMiddleware, async (req, res) => {
  try {
    const { transacaoId, motivo } = req.body

    const transacao = await Transacao.findById(transacaoId)
    if (!transacao)          return res.status(404).json({ erro: 'Transação não encontrada' })
    if (transacao.status !== 'pago') return res.status(400).json({ erro: 'Apenas pagamentos confirmados podem ser reembolsados' })

    // Solicita reembolso no MP
    await mpRequest('POST', `/v1/payments/${transacao.mpPaymentId}/refunds`, {
      amount: transacao.valorBruto
    })

    transacao.status    = 'reembolsado'
    transacao.updatedAt = new Date()
    await transacao.save()

    // Desconta do saldo
    await Saldo.findOneAndUpdate(
      { negocioId: transacao.negocioId },
      { $inc: { disponivel: -transacao.valorLiquido }, $set: { updatedAt: new Date() } }
    )

    return res.json({ ok: true, mensagem: 'Reembolso solicitado com sucesso' })

  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

// ──────────────────────────────────────────────────────────────
//  ROTA 5 — Solicitar saque
//  POST /api/pagamento/sacar
// ──────────────────────────────────────────────────────────────
router.post('/sacar', authMiddleware, async (req, res) => {
  try {
    const { negocioId, valor, chavePix, tipoPix } = req.body

    const saldo = await Saldo.findOne({ negocioId })
    if (!saldo || saldo.disponivel < valor) {
      return res.status(400).json({ erro: 'Saldo insuficiente' })
    }
    if (valor < 1) {
      return res.status(400).json({ erro: 'Valor mínimo de saque é R$ 1,00' })
    }

    // Cria registro de saque
    const saque = await Saque.create({
      negocioId,
      valor,
      status:   'solicitado',
      chavePix: chavePix || '',
      tipoPix:  tipoPix  || 'pix',
    })

    // Desconta saldo imediatamente
    await Saldo.findOneAndUpdate(
      { negocioId },
      { $inc: { disponivel: -valor, totalSacado: valor }, $set: { updatedAt: new Date() } }
    )

    // ─── Aqui você pode integrar com MP Transfers / Pix automático ───
    // Exemplo com MP Transfers (requer conta MP com permissão):
    /*
    try {
      const transfer = await mpRequest('POST', '/v1/advanced_payments', {
        payer: { type: 'customer', id: 'seu_mp_id' },
        receiver: { id: 'mp_id_do_negocio' },
        // ...
      })
      saque.mpTransferId = transfer.id
      saque.status = 'processando'
      await saque.save()
    } catch (mpErr) {
      console.error('[sacar] Erro MP Transfer:', mpErr.message)
      // Coloca em fila para processamento manual
    }
    */

    // Notifica via email/WhatsApp (implemente conforme seu sistema)
    console.log(`[saque] 💸 Saque R$ ${valor} solicitado — negócio ${negocioId}`)

    return res.json({
      ok:      true,
      saqueId: saque._id,
      valor,
      status:  'solicitado',
      mensagem: `Saque de R$ ${valor.toFixed(2)} solicitado com sucesso! Processamos em até 1 dia útil.`,
    })

  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

// ──────────────────────────────────────────────────────────────
//  ROTA 6 — Saldo do negócio
//  GET /api/pagamento/saldo/:negocioId
// ──────────────────────────────────────────────────────────────
router.get('/saldo/:negocioId', authMiddleware, async (req, res) => {
  try {
    const saldo = await Saldo.findOne({ negocioId: req.params.negocioId })
    return res.json({
      disponivel:    saldo?.disponivel    || 0,
      pendente:      saldo?.pendente      || 0,
      totalRecebido: saldo?.totalRecebido || 0,
      totalSacado:   saldo?.totalSacado   || 0,
    })
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

// ──────────────────────────────────────────────────────────────
//  ROTA 7 — Listar transações do negócio
//  GET /api/pagamento/transacoes/:negocioId
// ──────────────────────────────────────────────────────────────
router.get('/transacoes/:negocioId', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, tipo, mes } = req.query

    const filtro = { negocioId: req.params.negocioId }
    if (status) filtro.status = status
    if (tipo)   filtro.tipo   = tipo
    if (mes) {
      const inicio = new Date(`${mes}-01`)
      const fim    = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0, 23, 59, 59)
      filtro.createdAt = { $gte: inicio, $lte: fim }
    }

    const total      = await Transacao.countDocuments(filtro)
    const transacoes = await Transacao.find(filtro)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean()

    // Métricas agregadas
    const [metricas] = await Transacao.aggregate([
      { $match: { ...filtro, status: 'pago' } },
      {
        $group: {
          _id:            null,
          totalBruto:     { $sum: '$valorBruto' },
          totalLiquido:   { $sum: '$valorLiquido' },
          totalTaxas:     { $sum: { $add: ['$taxaPlataforma', '$taxaMP'] } },
          count:          { $sum: 1 },
          ticketMedio:    { $avg: '$valorBruto' },
        }
      }
    ]) || [{}]

    return res.json({
      transacoes,
      paginacao: {
        total,
        pagina:     parseInt(page),
        totalPages: Math.ceil(total / limit),
        limit:      parseInt(limit),
      },
      metricas: {
        totalBruto:   metricas.totalBruto   || 0,
        totalLiquido: metricas.totalLiquido || 0,
        totalTaxas:   metricas.totalTaxas   || 0,
        count:        metricas.count        || 0,
        ticketMedio:  metricas.ticketMedio  || 0,
      }
    })

  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

// ──────────────────────────────────────────────────────────────
//  ROTA 8 — Histórico de saques
//  GET /api/pagamento/saques/:negocioId
// ──────────────────────────────────────────────────────────────
router.get('/saques/:negocioId', authMiddleware, async (req, res) => {
  try {
    const saques = await Saque
      .find({ negocioId: req.params.negocioId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
    return res.json(saques)
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

// ──────────────────────────────────────────────────────────────
//  ROTA 9 — Salvar config de pagamento (já existia, melhorado)
//  PATCH /api/pagamento/config
// ──────────────────────────────────────────────────────────────
router.patch('/config', authMiddleware, async (req, res) => {
  try {
    const { negocioId, chavePix, tipoPix, servicos, ativo, porcentagem } = req.body
    const Negocio = mongoose.model('Negocio')

    await Negocio.findByIdAndUpdate(negocioId, {
      'pagamentos.ativo':       ativo      !== undefined ? ativo : undefined,
      'pagamentos.chavePix':    chavePix,
      'pagamentos.tipoPix':     tipoPix,
      'pagamentos.servicos':    servicos,
      'pagamentos.porcentagem': porcentagem,
    })

    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

// ──────────────────────────────────────────────────────────────
//  ROTA 10 — Buscar config
//  GET /api/pagamento/config/:negocioId
// ──────────────────────────────────────────────────────────────
router.get('/config/:negocioId', async (req, res) => {
  try {
    const Negocio = mongoose.model('Negocio')
    const negocio = await Negocio.findById(req.params.negocioId).select('pagamentos').lean()
    return res.json(negocio?.pagamentos || {})
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

module.exports = router