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

// ── STATUS ──────────────────────────────────────────────────
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

// ── CHECKOUT ─────────────────────────────────────────────────
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
    console.error('[checkout]', err.message)
    res.status(500).json({ erro: 'Erro ao criar checkout' })
  }
})

// ── CANCELAMENTO ─────────────────────────────────────────────
router.post('/cancelar', autenticar, async (req, res) => {
  try {
    const user = await User.findById(req.userId)

    if (!user.stripeSubscriptionId) {
      return res.status(400).json({ erro: 'Nenhuma assinatura ativa encontrada' })
    }

    // Cancela no fim do período pago (não cancela imediatamente)
    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true
    })

    res.json({ ok: true, mensagem: 'Assinatura será cancelada no fim do período atual' })
  } catch (err) {
    console.error('[cancelar]', err.message)
    res.status(500).json({ erro: 'Erro ao cancelar assinatura' })
  }
})

// ── REATIVAR (desfazer cancelamento) ─────────────────────────
router.post('/reativar', autenticar, async (req, res) => {
  try {
    const user = await User.findById(req.userId)

    if (!user.stripeSubscriptionId) {
      return res.status(400).json({ erro: 'Nenhuma assinatura encontrada' })
    }

    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: false
    })

    res.json({ ok: true, mensagem: 'Assinatura reativada com sucesso' })
  } catch (err) {
    console.error('[reativar]', err.message)
    res.status(500).json({ erro: 'Erro ao reativar assinatura' })
  }
})

// ── PORTAL DO CLIENTE (gerenciar cartão, faturas) ─────────────
router.post('/portal', autenticar, async (req, res) => {
  try {
    const user = await User.findById(req.userId)

    if (!user.stripeCustomerId) {
      return res.status(400).json({ erro: 'Cliente não encontrado no Stripe' })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.URL_BASE}/painel.html`,
    })

    res.json({ url: session.url })
  } catch (err) {
    console.error('[portal]', err.message)
    res.status(500).json({ erro: 'Erro ao abrir portal' })
  }
})

// ── WEBHOOK ──────────────────────────────────────────────────
// IMPORTANTE: esta rota precisa ficar ANTES do express.json() no server.js
// Use: app.use('/api/assinatura/webhook', express.raw({ type: 'application/json' }), webhookHandler)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature']
  let event

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error('[webhook] Assinatura inválida:', err.message)
    return res.status(400).send(`Webhook error: ${err.message}`)
  }

  console.log('[webhook] Evento recebido:', event.type)

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object
        const plano = sub.items.data[0].price.id === process.env.STRIPE_PRICE_PRO ? 'pro' : 'basico'
        const cancelando = sub.cancel_at_period_end

        await User.findOneAndUpdate(
          { stripeCustomerId: sub.customer },
          {
            assinaturaAtiva: sub.status === 'active',
            stripeSubscriptionId: sub.id,
            plano,
            // Salva se está agendado para cancelar
            ...(cancelando ? { assinaturaCancelando: true } : { assinaturaCancelando: false })
          }
        )
        console.log(`[webhook] Assinatura ${event.type} — plano: ${plano}, status: ${sub.status}`)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object
        await User.findOneAndUpdate(
          { stripeCustomerId: sub.customer },
          { assinaturaAtiva: false, plano: 'inativo', stripeSubscriptionId: '', assinaturaCancelando: false }
        )
        console.log('[webhook] Assinatura cancelada definitivamente')
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        await User.findOneAndUpdate(
          { stripeCustomerId: invoice.customer },
          { assinaturaAtiva: false }
        )
        console.log('[webhook] Pagamento falhou — acesso suspenso')
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object
        await User.findOneAndUpdate(
          { stripeCustomerId: invoice.customer },
          { assinaturaAtiva: true }
        )
        console.log('[webhook] Pagamento confirmado — acesso ativo')
        break
      }
    }
  } catch (err) {
    console.error('[webhook] Erro ao processar evento:', err.message)
  }

  res.json({ received: true })
})

module.exports = router