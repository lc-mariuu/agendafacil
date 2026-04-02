const express = require('express')
const jwt = require('jsonwebtoken')
const axios = require('axios')
const User = require('../models/User')
const router = express.Router()

// ── ABACATEPAY v1 (customer) ─────────────────────────────────────
const ABACATE_API = 'https://api.abacatepay.com/v1'
const abacate = axios.create({
  baseURL: ABACATE_API,
  headers: {
    Authorization: `Bearer ${process.env.ABACATEPAY_API_KEY}`,
    'Content-Type': 'application/json',
  },
})

// ── ABACATEPAY v2 (subscriptions) ────────────────────────────────
const abacateV2 = axios.create({
  baseURL: 'https://api.abacatepay.com/v2',
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

// ── CHECKOUT ─────────────────────────────────────────────────────
// Usa /v2/subscriptions/create para cobrança recorrente no cartão.
// O produto precisa ter o ciclo (frequency) definido no dashboard da AbacatePay.
router.post('/checkout', autenticar, async (req, res) => {
  try {
    const { plano } = req.body
    const user = await User.findById(req.userId)

    const productId = PRODUTOS[plano]
    if (!productId) return res.status(400).json({ erro: 'Plano inválido' })

    // Cria o customer na AbacatePay se ainda não existir
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

    // Cria o checkout de assinatura recorrente (v2)
    const { data: subscription } = await abacateV2.post('/subscriptions/create', {
      items: [{ id: productId, quantity: 1 }],
      customerId,
      methods:       ['CARD'],
      returnUrl:     `${process.env.URL_BASE}/planos.html`,
      completionUrl: `${process.env.URL_BASE}/painel.html?assinatura=sucesso`,
      externalId:    String(user._id),
    })

    const subscriptionId = subscription.data.id

    await User.findByIdAndUpdate(req.userId, {
      abacateSubscriptionId: subscriptionId,
      pendingPlano: plano,
    })

    console.log(`[checkout] userId: ${user._id} | subscriptionId: ${subscriptionId} | plano: ${plano}`)
    res.json({ url: subscription.data.url })
  } catch (err) {
    console.error('[checkout]', err.response?.data || err.message)
    res.status(500).json({ erro: 'Erro ao criar checkout' })
  }
})

// ── CANCELAR ─────────────────────────────────────────────────────
// A AbacatePay não tem endpoint de cancelamento de assinatura via API.
// Marcamos localmente como "cancelando" — o acesso segue até o fim do ciclo
// e, como o webhook de renovação não virá, o usuário cai para inativo automaticamente.
router.post('/cancelar', autenticar, async (req, res) => {
  try {
    const user = await User.findById(req.userId)

    if (!user.assinaturaAtiva)
      return res.status(400).json({ erro: 'Nenhuma assinatura ativa encontrada' })

    if (user.assinaturaCancelando)
      return res.status(400).json({ erro: 'Cancelamento já solicitado anteriormente' })

    await User.findByIdAndUpdate(req.userId, { assinaturaCancelando: true })

    res.json({ ok: true, mensagem: 'Assinatura será cancelada no fim do período atual' })
  } catch (err) {
    console.error('[cancelar]', err.message)
    res.status(500).json({ erro: 'Erro ao cancelar assinatura' })
  }
})

// ── PORTAL ───────────────────────────────────────────────────────
// Redireciona para a página interna de gerenciamento/cancelamento.
// O botão só aparece no frontend quando assinaturaAtiva=true.
router.post('/portal', autenticar, async (req, res) => {
  try {
    const user = await User.findById(req.userId)

    if (!user || !user.assinaturaAtiva) {
      return res.status(400).json({ erro: 'Nenhuma assinatura ativa para gerenciar' })
    }

    res.json({ url: `${process.env.URL_BASE}/cancelar-assinatura.html` })
  } catch (err) {
    console.error('[portal]', err.message)
    res.status(500).json({ erro: 'Erro ao abrir portal' })
  }
})

// ── WEBHOOK AbacatePay ───────────────────────────────────────────
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
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

  console.log('[webhook] Evento:', event.event)

  try {
    const data    = event.data || {}
    const billing = data.billing || data.subscription || {}
    const billingId  = billing.id
    const customerId = billing.customer?.id || billing.customerId
    const email      = billing.customer?.metadata?.email

    console.log(`[webhook] billingId: ${billingId} | customerId: ${customerId} | email: ${email}`)

    async function acharUsuario() {
      let user = billingId
        ? await User.findOne({ abacateSubscriptionId: billingId })
        : null
      if (user) { console.log(`[webhook] Encontrado por billingId: ${user._id}`); return user }

      // Tenta pelo externalId (userId que enviamos no checkout)
      const externalId = billing.externalId
      user = externalId
        ? await User.findById(externalId).catch(() => null)
        : null
      if (user) { console.log(`[webhook] Encontrado por externalId: ${user._id}`); return user }

      user = customerId
        ? await User.findOne({ abacateCustomerId: customerId })
        : null
      if (user) { console.log(`[webhook] Encontrado por customerId: ${user._id}`); return user }

      user = email
        ? await User.findOne({ email: email.toLowerCase() })
        : null
      if (user) {
        console.log(`[webhook] Encontrado por email: ${user._id}`)
        if (customerId) await User.findByIdAndUpdate(user._id, { abacateCustomerId: customerId })
        return user
      }

      console.log(`[webhook] AVISO: usuário não encontrado`)
      return null
    }

    switch (event.event) {

      case 'subscription.paid':
      case 'billing.paid': {
        const prodId = billing.products?.[0]?.externalId || billing.items?.[0]?.id
        const plano  = prodId === process.env.ABACATEPAY_PRODUCT_PRO ? 'pro' : 'basico'
        const user   = await acharUsuario()
        if (!user) break

        await User.findByIdAndUpdate(user._id, {
          assinaturaAtiva:       true,
          assinaturaCancelando:  false,
          plano,
          abacateSubscriptionId: billingId || '',
          pendingPlano:          null,
        })
        console.log(`[webhook] ✓ Ativado — userId: ${user._id} | plano: ${plano}`)
        break
      }

      case 'billing.failed':
      case 'subscription.payment_failed': {
        const user = await acharUsuario()
        if (!user) break
        await User.findByIdAndUpdate(user._id, { assinaturaAtiva: false })
        console.log(`[webhook] Pagamento falhou — userId: ${user._id}`)
        break
      }

      case 'subscription.canceled':
      case 'subscription.expired': {
        const user = await acharUsuario()
        if (!user) break
        await User.findByIdAndUpdate(user._id, {
          assinaturaAtiva:       false,
          assinaturaCancelando:  false,
          plano:                 'inativo',
          abacateSubscriptionId: '',
        })
        console.log(`[webhook] Encerrado — userId: ${user._id}`)
        break
      }
    }
  } catch (err) {
    console.error('[webhook] Erro:', err.message)
  }

  res.json({ received: true })
})

module.exports = router