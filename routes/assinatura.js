const express = require('express')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const router = express.Router()

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

router.get('/status', autenticar, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    const temAcesso = user.temAcesso()
    const diasRestantes = user.plano === 'trial'
      ? Math.max(0, Math.ceil((new Date(user.trialExpira) - new Date()) / (1000 * 60 * 60 * 24)))
      : null
    res.json({ plano: user.plano, temAcesso, diasRestantes, assinaturaAtiva: user.assinaturaAtiva })
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar status' })
  }
})

router.post('/checkout', autenticar, async (req, res) => {
  try {
    const { plano } = req.body
    const user = await User.findById(req.userId)
    const priceId = plano === 'pro' ? process.env.STRIPE_PRICE_PRO : process.env.STRIPE_PRICE_BASICO

    let customerId = user.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, name: user.nome })
      customerId = customer.id
      await User.findByIdAndUpdate(req.userId, { stripeCustomerId: customerId })
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.URL_BASE}/painel.html?assinatura=sucesso`,
      cancel_url: `${process.env.URL_BASE}/planos.html`,
    })

    res.json({ url: session.url })
  } catch (err) {
    console.log('Erro checkout:', err.message)
    res.status(500).json({ erro: 'Erro ao criar checkout' })
  }
})

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature']
  let event
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test')
  } catch {
    return res.status(400).send('Webhook error')
  }

  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    const sub = event.data.object
    const plano = sub.items.data[0].price.id === process.env.STRIPE_PRICE_PRO ? 'pro' : 'basico'
    await User.findOneAndUpdate(
      { stripeCustomerId: sub.customer },
      { assinaturaAtiva: sub.status === 'active', stripeSubscriptionId: sub.id, plano }
    )
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object
    await User.findOneAndUpdate(
      { stripeCustomerId: sub.customer },
      { assinaturaAtiva: false, plano: 'inativo' }
    )
  }

  res.json({ received: true })
})

module.exports = router