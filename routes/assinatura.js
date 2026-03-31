const express = require('express')
const jwt = require('jsonwebtoken')
const axios = require('axios')
const User = require('../models/User')
const router = express.Router()

// ── ABACATEPAY BASE ─────────────────────────────────────────────
const ABACATE_API = 'https://api.abacatepay.com/v1'
const abacate = axios.create({
  baseURL: ABACATE_API,
  headers: {
    Authorization: `Bearer ${process.env.ABACATEPAY_API_KEY}`,
    'Content-Type': 'application/json',
  },
})

// ── MIDDLEWARE DE AUTH ───────────────────────────────────────────
const autenticar = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.userId = decoded.id
    next()
  } catch {
    res.status(401).json({ erro: 'Não autorizado' })
  }
}

// ── PLANOS ───────────────────────────────────────────────────────
// Configure no .env:
//   ABACATEPAY_PRODUCT_BASICO=prod_xxx
//   ABACATEPAY_PRODUCT_PRO=prod_xxx
const PRODUTOS = {
  basico: process.env.ABACATEPAY_PRODUCT_BASICO,
  pro:    process.env.ABACATEPAY_PRODUCT_PRO,
}

// ── STATUS ───────────────────────────────────────────────────────
router.get('/status', autenticar, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    const temAcesso = user.temAcesso()
    const diasRestantes = user.plano === 'trial'
      ? Math.max(0, Math.ceil((new Date(user.trialExpira) - new Date()) / (1000 * 60 * 60 * 24)))
      : null
    res.json({
      plano: user.plano,
      temAcesso,
      diasRestantes,
      assinaturaAtiva: user.assinaturaAtiva,
      assinaturaCancelando: user.assinaturaCancelando || false,
    })
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar status' })
  }
})

// ── CHECKOUT (gera link de pagamento AbacatePay) ─────────────────
router.post('/checkout', autenticar, async (req, res) => {
  try {
    const { plano } = req.body
    const user = await User.findById(req.userId)

    const productId = PRODUTOS[plano]
    if (!productId) return res.status(400).json({ erro: 'Plano inválido' })

    // Cria ou recupera cliente no AbacatePay
    let customerId = user.abacateCustomerId
    if (!customerId) {
      const { data: cliente } = await abacate.post('/customer/create', {
      name:      user.nome,
      email:     user.email,
      cellphone: '11999999999',
      taxId:     '111.444.777-35',
    })
      customerId = cliente.data.id
      await User.findByIdAndUpdate(req.userId, { abacateCustomerId: customerId })
    }

    // Cria cobrança de assinatura
    const { data: billing } = await abacate.post('/billing/create', {
    frequency:     'ONE_TIME',
    methods:       ['PIX', 'CARD'],
    products: [{
    externalId:  productId,
    name:        plano === 'pro' ? 'Plano Profissional' : 'Plano Básico',
    description: plano === 'pro' ? 'Assinatura mensal Profissional' : 'Assinatura mensal Básico',
    quantity:    1,
    price:       plano === 'pro' ? 4900 : 2900, // centavos
   }],
    customerId:    customerId,
    returnUrl:     `${process.env.URL_BASE}/planos.html`,
    completionUrl: `${process.env.URL_BASE}/painel.html?assinatura=sucesso`,
    metadata:      { userId: String(user._id), plano },
})

    res.json({ url: billing.data.url })
  } catch (err) {
    console.error('[checkout]', err.response?.data || err.message)
    res.status(500).json({ erro: 'Erro ao criar checkout' })
  }
})

// ── CANCELAR (no fim do período) ────────────────────────────────
router.post('/cancelar', autenticar, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user.abacateSubscriptionId)
      return res.status(400).json({ erro: 'Nenhuma assinatura ativa encontrada' })

    await abacate.post(`/subscription/${user.abacateSubscriptionId}/cancel`)

    await User.findByIdAndUpdate(req.userId, { assinaturaCancelando: true })
    res.json({ ok: true, mensagem: 'Assinatura será cancelada no fim do período atual' })
  } catch (err) {
    console.error('[cancelar]', err.response?.data || err.message)
    res.status(500).json({ erro: 'Erro ao cancelar assinatura' })
  }
})

// ── PORTAL (link para gerenciar cartão/faturas) ──────────────────
router.post('/portal', autenticar, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user.abacateCustomerId)
      return res.status(400).json({ erro: 'Cliente não encontrado' })

    const { data } = await abacate.post('/customer/portal', {
      customerId:  user.abacateCustomerId,
      redirectUrl: `${process.env.URL_BASE}/painel.html`,
    })

    res.json({ url: data.data.url })
  } catch (err) {
    console.error('[portal]', err.response?.data || err.message)
    res.status(500).json({ erro: 'Erro ao abrir portal' })
  }
})

// ── WEBHOOK AbacatePay ───────────────────────────────────────────
// Registre no painel AbacatePay:
//   POST  https://seudominio.com/api/assinatura/webhook
//
// Valide a assinatura com o header "abacatepay-signature"
// e a variável ABACATEPAY_WEBHOOK_SECRET no .env
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  // ── Validação de assinatura ──────────────────────────────────
  const crypto = require('crypto')
  const sig    = req.headers['abacatepay-signature']
  const secret = process.env.ABACATEPAY_WEBHOOK_SECRET

  if (secret && sig) {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(req.body)
      .digest('hex')
    if (sig !== expected)
      return res.status(400).send('Assinatura inválida')
  }

  let event
  try {
    event = JSON.parse(req.body.toString())
  } catch {
    return res.status(400).send('Payload inválido')
  }

  console.log('[webhook] Evento AbacatePay:', event.event)

  try {
    const data = event.data || {}

    switch (event.event) {

      // Assinatura criada ou renovada com sucesso
      case 'subscription.paid':
      case 'billing.paid': {
        const meta  = data.metadata || {}
        const userId = meta.userId
        const plano  = meta.plano || 'basico'
        if (!userId) break

        await User.findByIdAndUpdate(userId, {
          assinaturaAtiva:      true,
          assinaturaCancelando: false,
          plano,
          abacateSubscriptionId: data.subscriptionId || data.id || '',
        })
        console.log(`[webhook] Pagamento confirmado — userId: ${userId}, plano: ${plano}`)
        break
      }

      // Pagamento falhou (cartão recusado, expirado, etc.)
      case 'billing.failed':
      case 'subscription.payment_failed': {
        const meta   = data.metadata || {}
        const userId = meta.userId
        if (!userId) break
        await User.findByIdAndUpdate(userId, { assinaturaAtiva: false })
        console.log(`[webhook] Pagamento falhou — acesso suspenso userId: ${userId}`)
        break
      }

      // Assinatura cancelada definitivamente
      case 'subscription.canceled':
      case 'subscription.expired': {
        const meta   = data.metadata || {}
        const userId = meta.userId
        if (!userId) break
        await User.findByIdAndUpdate(userId, {
          assinaturaAtiva:      false,
          assinaturaCancelando: false,
          plano:                'inativo',
          abacateSubscriptionId: '',
        })
        console.log(`[webhook] Assinatura encerrada — userId: ${userId}`)
        break
      }
    }
  } catch (err) {
    console.error('[webhook] Erro ao processar evento:', err.message)
  }

  res.json({ received: true })
})

module.exports = router