const express = require('express')
const axios = require('axios')
const Appointment = require('../models/Appointment')
const Negocio = require('../models/Negocio')
const router = express.Router()

// ── ABACATEPAY BASE ─────────────────────────────────────────────
const abacate = axios.create({
  baseURL: 'https://api.abacatepay.com/v1',
  headers: {
    Authorization: `Bearer ${process.env.ABACATEPAY_API_KEY}`,
    'Content-Type': 'application/json',
  },
})

// ── CRIAR COBRANÇA PIX ──────────────────────────────────────────
// POST /api/pagamento/criar
// Body: { clinicaId, pacienteNome, pacienteEmail, pacienteTelefone, servico, data, hora, valor }
router.post('/criar', async (req, res) => {
  try {
    const { clinicaId, pacienteNome, pacienteEmail, pacienteTelefone, servico, data, hora, valor } = req.body

    // Verifica se horário ainda está disponível
    const jaExiste = await Appointment.findOne({
      clinicaId, data, hora, status: { $ne: 'cancelado' },
    })
    if (jaExiste) return res.status(400).json({ erro: 'Horário já ocupado' })

    const neg = await Negocio.findById(clinicaId)
    if (!neg) return res.status(404).json({ erro: 'Negócio não encontrado' })

    // Cria cobrança Pix no AbacatePay
    const { data: result } = await abacate.post('/pixQrCode/create', {
      amount:      Math.round(valor * 100), // centavos
      description: `${servico} — ${neg.nome}`,
      expiresIn:   3600, // 1 hora
      customer: {
        name:      pacienteNome,
        email:     pacienteEmail  || undefined,
        cellphone: pacienteTelefone || undefined,
      },
      metadata: {
        clinicaId,
        pacienteNome,
        pacienteTelefone: pacienteTelefone || '',
        servico,
        data,
        hora,
        negocioNome: neg.nome,
      },
    })

    const cobranca = result.data
    res.json({
      pixId:       cobranca.id,
      qrCode:      cobranca.brCode,        // copia-e-cola
      qrCodeImage: cobranca.qrCodeImage,   // base64 da imagem
      expiresAt:   cobranca.expiresAt,
    })
  } catch (err) {
    console.error('[pagamento] erro:', err.response?.data || err.message)
    res.status(500).json({ erro: 'Erro ao criar cobrança Pix' })
  }
})

// ── VERIFICAR STATUS ────────────────────────────────────────────
// GET /api/pagamento/status/:pixId
router.get('/status/:pixId', async (req, res) => {
  try {
    const { data: result } = await abacate.get(`/pixQrCode/${req.params.pixId}`)
    const cobranca = result.data

    // PAID = pago | EXPIRED = expirado | PENDING = aguardando
    if (cobranca.status === 'PAID') {
      // Cria agendamento se ainda não existir
      const { clinicaId, pacienteNome, pacienteTelefone, servico, data, hora } = cobranca.metadata
      const jaExiste = await Appointment.findOne({ clinicaId, data, hora, status: { $ne: 'cancelado' } })
      if (!jaExiste) {
        await Appointment.create({
          clinicaId,
          pacienteNome,
          pacienteTelefone: pacienteTelefone || '',
          servico,
          data,
          hora,
          pagamento: { status: 'pago', valor: cobranca.amount / 100, pixId: cobranca.id },
        })
      }
      return res.json({ status: 'pago' })
    }

    if (cobranca.status === 'EXPIRED')  return res.json({ status: 'expirado' })
    if (cobranca.status === 'CANCELED') return res.json({ status: 'cancelado' })

    // Ainda aguardando — devolve dados do Pix para reexibir QR se necessário
    res.json({
      status:      'aguardando',
      qrCode:      cobranca.brCode,
      qrCodeImage: cobranca.qrCodeImage,
    })
  } catch (err) {
    console.error('[pagamento status] erro:', err.response?.data || err.message)
    res.status(500).json({ erro: 'Erro ao verificar pagamento' })
  }
})

// ── WEBHOOK AbacatePay (Pix confirmado) ─────────────────────────
// Registre no painel AbacatePay:
//   POST  https://seudominio.com.br/api/pagamento/webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  // Valida assinatura HMAC
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

  console.log('[webhook pix] Evento:', event.event)

  if (event.event === 'pixQrCode.paid') {
    try {
      const cobranca = event.data || {}
      const { clinicaId, pacienteNome, pacienteTelefone, servico, data, hora } = cobranca.metadata || {}

      if (clinicaId && data && hora) {
        const jaExiste = await Appointment.findOne({ clinicaId, data, hora, status: { $ne: 'cancelado' } })
        if (!jaExiste) {
          await Appointment.create({
            clinicaId,
            pacienteNome,
            pacienteTelefone: pacienteTelefone || '',
            servico,
            data,
            hora,
            pagamento: { status: 'pago', valor: cobranca.amount / 100, pixId: cobranca.id },
          })
          console.log(`[webhook pix] Agendamento criado — ${pacienteNome} ${data} ${hora}`)
        }
      }
    } catch (err) {
      console.error('[webhook pix] Erro:', err.message)
    }
  }

  res.json({ received: true })
})

// ── REEMBOLSO ───────────────────────────────────────────────────
// POST /api/pagamento/reembolsar
// Body: { appointmentId }
// Obs: reembolso de Pix via API depende de liberação na conta AbacatePay.
// Por ora, cancela o agendamento e sinaliza para reembolso manual.
router.post('/reembolsar', async (req, res) => {
  try {
    const { appointmentId } = req.body
    const appt = await Appointment.findById(appointmentId)
    if (!appt)                    return res.status(404).json({ erro: 'Agendamento não encontrado' })
    if (!appt.pagamento?.pixId)   return res.status(400).json({ erro: 'Agendamento sem pagamento Pix' })

    // Tenta estornar via API (disponível conforme plano AbacatePay)
    try {
      await abacate.post(`/pixQrCode/${appt.pagamento.pixId}/refund`)
    } catch (refundErr) {
      // Se API não suportar ainda, apenas registra para reembolso manual
      console.warn('[reembolso] API indisponível — marcar para reembolso manual:', refundErr.response?.data || refundErr.message)
    }

    await Appointment.findByIdAndUpdate(appointmentId, {
      status: 'cancelado',
      'pagamento.status': 'reembolsado',
      atualizadoEm: new Date(),
    })

    res.json({ ok: true, mensagem: 'Agendamento cancelado. Reembolso processado ou pendente de análise.' })
  } catch (err) {
    console.error('[reembolso] erro:', err.message)
    res.status(500).json({ erro: 'Erro ao reembolsar: ' + err.message })
  }
})

const mongoose = require('mongoose')

const PagamentoSchema = new mongoose.Schema({
  negocioId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Negocio', required: true },
  agendamentoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
  mpPaymentId:   { type: String },          // ID do pagamento no Mercado Pago
  status:        { type: String, enum: ['pendente', 'aprovado', 'expirado', 'cancelado'], default: 'pendente' },
  valor:         { type: Number, required: true },
  qrCode:        { type: String },          // base64 do QR Code
  qrCodeText:    { type: String },          // texto copia-e-cola
  expiresAt:     { type: Date },            // expiração do Pix (30 min)
  paidAt:        { type: Date },
  criadoEm:      { type: Date, default: Date.now },
})

module.exports = mongoose.model('Pagamento', PagamentoSchema)

module.exports = router