const express = require('express')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const Appointment = require('../models/Appointment')
const Negocio = require('../models/Negocio')
const router = express.Router()

// ── CRIAR PAGAMENTO PIX ───────────────────────────────
router.post('/criar', async (req, res) => {
  try {
    const { clinicaId, pacienteNome, pacienteEmail, servico, data, hora, valor } = req.body

    // Verifica se horário ainda está disponível
    const jaExiste = await Appointment.findOne({
      clinicaId, data, hora, status: { $ne: 'cancelado' }
    })
    if (jaExiste) return res.status(400).json({ erro: 'Horário já ocupado' })

    const neg = await Negocio.findById(clinicaId)
    if (!neg) return res.status(404).json({ erro: 'Negócio não encontrado' })

    // Cria PaymentIntent com Pix
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(valor * 100), // centavos
      currency: 'brl',
      payment_method_types: ['pix'],
      metadata: {
        clinicaId,
        pacienteNome,
        servico,
        data,
        hora,
        negocioNome: neg.nome
      },
      pix: {
        expires_after_seconds: 3600 // 1 hora para pagar
      }
    })

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      pixData: paymentIntent.next_action?.pix_display_qr_code
    })
  } catch (err) {
    console.error('[pagamento] erro:', err.message)
    res.status(500).json({ erro: 'Erro ao criar pagamento: ' + err.message })
  }
})

// ── VERIFICAR STATUS DO PAGAMENTO ─────────────────────
router.get('/status/:paymentIntentId', async (req, res) => {
  try {
    const pi = await stripe.paymentIntents.retrieve(req.params.paymentIntentId)

    if (pi.status === 'succeeded') {
      // Cria agendamento se ainda não existir
      const { clinicaId, pacienteNome, servico, data, hora } = pi.metadata
      const jaExiste = await Appointment.findOne({ clinicaId, data, hora, status: { $ne: 'cancelado' } })
      if (!jaExiste) {
        await Appointment.create({
          clinicaId,
          pacienteNome,
          pacienteTelefone: pi.metadata.pacienteTelefone || '',
          servico,
          data,
          hora,
          pagamento: { status: 'pago', valor: pi.amount / 100, paymentIntentId: pi.id }
        })
      }
      return res.json({ status: 'pago' })
    }

    if (pi.status === 'canceled') return res.json({ status: 'cancelado' })
    if (pi.status === 'requires_payment_method') return res.json({ status: 'expirado' })

    // Ainda aguardando
    const pixData = pi.next_action?.pix_display_qr_code
    res.json({ status: 'aguardando', pixData })
  } catch (err) {
    console.error('[pagamento status] erro:', err.message)
    res.status(500).json({ erro: 'Erro ao verificar pagamento' })
  }
})

// ── WEBHOOK STRIPE (pagamento confirmado) ─────────────
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature']
  let event
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return res.status(400).send(`Webhook error: ${err.message}`)
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object
    const { clinicaId, pacienteNome, servico, data, hora } = pi.metadata
    if (clinicaId && data && hora) {
      const jaExiste = await Appointment.findOne({ clinicaId, data, hora, status: { $ne: 'cancelado' } })
      if (!jaExiste) {
        await Appointment.create({
          clinicaId, pacienteNome,
          pacienteTelefone: pi.metadata.pacienteTelefone || '',
          servico, data, hora,
          pagamento: { status: 'pago', valor: pi.amount / 100, paymentIntentId: pi.id }
        })
      }
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    console.log('[pagamento] falhou:', event.data.object.id)
  }

  res.json({ received: true })
})

// ── REEMBOLSO ─────────────────────────────────────────
router.post('/reembolsar', async (req, res) => {
  try {
    const { appointmentId } = req.body
    const appt = await Appointment.findById(appointmentId)
    if (!appt) return res.status(404).json({ erro: 'Agendamento não encontrado' })
    if (!appt.pagamento?.paymentIntentId) return res.status(400).json({ erro: 'Agendamento sem pagamento' })

    const refund = await stripe.refunds.create({
      payment_intent: appt.pagamento.paymentIntentId
    })

    await Appointment.findByIdAndUpdate(appointmentId, {
      status: 'cancelado',
      'pagamento.status': 'reembolsado',
      atualizadoEm: new Date()
    })

    res.json({ ok: true, refundId: refund.id })
  } catch (err) {
    console.error('[reembolso] erro:', err.message)
    res.status(500).json({ erro: 'Erro ao reembolsar: ' + err.message })
  }
})

module.exports = router