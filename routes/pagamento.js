// routes/pagamento.js
const express     = require('express')
const router      = express.Router()
const axios       = require('axios')
const crypto      = require('crypto')
const jwt         = require('jsonwebtoken')
const Appointment = require('../models/Appointment')
const Negocio     = require('../models/Negocio')
const Pagamento   = require('../models/Pagamento')

const abacate = axios.create({
  baseURL: 'https://api.abacatepay.com/v1',
  headers: {
    Authorization: `Bearer ${process.env.ABACATEPAY_API_KEY}`,
    'Content-Type': 'application/json',
  },
})

function autenticar(req, res, next) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer '))
    return res.status(401).json({ erro: 'Token ausente' })
  try {
    req.usuario = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET)
    next()
  } catch (e) {
    console.error('[autenticar] token inválido:', e.message)
    return res.status(401).json({ erro: 'Token inválido', detalhe: e.message })
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/pagamento/criar
// ─────────────────────────────────────────────────────────────
router.post('/criar', async (req, res) => {
  try {
    const { negocioId, agendamentoId, pacienteNome, pacienteEmail, pacienteTelefone, servico, data, hora, valor } = req.body
    if (!negocioId || !valor) return res.status(400).json({ erro: 'negocioId e valor são obrigatórios' })

    if (data && hora) {
      const jaExiste = await Appointment.findOne({ clinicaId: negocioId, data, hora, status: { $ne: 'cancelado' } })
      if (jaExiste) return res.status(400).json({ erro: 'Horário já ocupado' })
    }

    const negocio = await Negocio.findById(negocioId)
    if (!negocio) return res.status(404).json({ erro: 'Negócio não encontrado' })

    if (agendamentoId) {
      const existente = await Pagamento.findOne({ agendamentoId, status: 'pendente' })
      if (existente && existente.expiresAt > new Date()) {
        return res.json({ pixId: existente.pixId, qrCode: existente.qrCode, qrCodeImage: existente.qrCodeImage, valor: existente.valor, expiresAt: existente.expiresAt, status: existente.status })
      }
      if (existente) { existente.status = 'expirado'; await existente.save() }
    }

    const { data: result } = await abacate.post('/pixQrCode/create', {
      amount: Math.round(Number(valor) * 100),
      description: `${servico || 'Serviço'} — ${negocio.nome}`,
      expiresIn: 3600,
      customer: { name: pacienteNome || 'Cliente', email: pacienteEmail || undefined, cellphone: pacienteTelefone || undefined },
      metadata: { negocioId, agendamentoId: agendamentoId || '', pacienteNome: pacienteNome || '', pacienteTelefone: pacienteTelefone || '', servico: servico || '', data: data || '', hora: hora || '', negocioNome: negocio.nome },
    })

    const cobranca = result.data
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
    const pagamento = await Pagamento.create({ negocioId, agendamentoId: agendamentoId || undefined, pixId: cobranca.id, status: 'pendente', valor: Number(valor), qrCode: cobranca.brCode, qrCodeImage: cobranca.qrCodeImage, expiresAt })

    if (agendamentoId) await Appointment.findByIdAndUpdate(agendamentoId, { status: 'aguardando_pagamento', pagamentoId: pagamento._id })

    return res.json({ pixId: pagamento.pixId, qrCode: pagamento.qrCode, qrCodeImage: pagamento.qrCodeImage, valor: pagamento.valor, expiresAt, status: 'pendente' })
  } catch (err) {
    console.error('[pagamento/criar]', err.message)
    return res.status(500).json({ erro: 'Erro ao criar cobrança Pix', detalhe: err.message })
  }
})

// ─────────────────────────────────────────────────────────────
// GET /api/pagamento/status/:pixId
// ─────────────────────────────────────────────────────────────
router.get('/status/:pixId', async (req, res) => {
  try {
    const { data: result } = await abacate.get(`/pixQrCode/${req.params.pixId}`)
    const cobranca = result.data
    const pag = await Pagamento.findOne({ pixId: req.params.pixId })

    if (cobranca.status === 'PAID') {
      if (pag && pag.status !== 'aprovado') {
        pag.status = 'aprovado'; pag.paidAt = new Date(); await pag.save()
        if (pag.agendamentoId) await Appointment.findByIdAndUpdate(pag.agendamentoId, { status: 'confirmado', pagamentoPix: true })
      }
      return res.json({ status: 'pago', paidAt: pag?.paidAt })
    }
    if (cobranca.status === 'EXPIRED') {
      if (pag && pag.status === 'pendente') { pag.status = 'expirado'; await pag.save(); if (pag.agendamentoId) await Appointment.findByIdAndUpdate(pag.agendamentoId, { status: 'cancelado' }) }
      return res.json({ status: 'expirado' })
    }
    if (cobranca.status === 'CANCELED') {
      if (pag && pag.status === 'pendente') { pag.status = 'cancelado'; await pag.save() }
      return res.json({ status: 'cancelado' })
    }
    return res.json({ status: 'aguardando', qrCode: cobranca.brCode, qrCodeImage: cobranca.qrCodeImage })
  } catch (err) {
    console.error('[pagamento/status]', err.message)
    return res.status(500).json({ erro: 'Erro ao verificar pagamento' })
  }
})

// ─────────────────────────────────────────────────────────────
// POST /api/pagamento/webhook
// ─────────────────────────────────────────────────────────────
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const sig = req.headers['abacatepay-signature']
    const secret = process.env.ABACATEPAY_WEBHOOK_SECRET
    if (secret && sig) {
      const expected = crypto.createHmac('sha256', secret).update(req.body).digest('hex')
      if (sig !== expected) return res.status(400).send('Assinatura inválida')
    }
    let event
    try { event = JSON.parse(req.body.toString()) } catch { return res.status(400).send('Payload inválido') }
    console.log('[webhook/abacate]', event.event)
    if (event.event === 'pixQrCode.paid') {
      const cobranca = event.data || {}
      const { negocioId, agendamentoId, pacienteNome, pacienteTelefone, servico, data, hora } = cobranca.metadata || {}
      const pag = await Pagamento.findOne({ pixId: cobranca.id })
      if (pag && pag.status !== 'aprovado') { pag.status = 'aprovado'; pag.paidAt = new Date(); await pag.save() }
      if (negocioId && data && hora) {
        const jaExiste = await Appointment.findOne({ clinicaId: negocioId, data, hora, status: { $ne: 'cancelado' } })
        if (!jaExiste) await Appointment.create({ clinicaId: negocioId, pacienteNome, pacienteTelefone: pacienteTelefone || '', servico, data, hora, pagamento: { status: 'pago', valor: cobranca.amount / 100, pixId: cobranca.id } })
      } else if (agendamentoId) {
        await Appointment.findByIdAndUpdate(agendamentoId, { status: 'confirmado', pagamentoPix: true })
      }
    }
    return res.json({ received: true })
  } catch (err) {
    console.error('[webhook/abacate]', err.message)
    return res.sendStatus(500)
  }
})

// ─────────────────────────────────────────────────────────────
// POST /api/pagamento/reembolsar
// ─────────────────────────────────────────────────────────────
router.post('/reembolsar', autenticar, async (req, res) => {
  try {
    const { appointmentId } = req.body
    const appt = await Appointment.findById(appointmentId)
    if (!appt) return res.status(404).json({ erro: 'Agendamento não encontrado' })
    const pixId = appt.pagamento?.pixId
    if (!pixId) return res.status(400).json({ erro: 'Agendamento sem pagamento Pix' })
    try { await abacate.post(`/pixQrCode/${pixId}/refund`) } catch (e) { console.warn('[reembolso]', e.message) }
    await Pagamento.findOneAndUpdate({ pixId }, { status: 'reembolsado' })
    await Appointment.findByIdAndUpdate(appointmentId, { status: 'cancelado', 'pagamento.status': 'reembolsado', atualizadoEm: new Date() })
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

// ─────────────────────────────────────────────────────────────
// GET /api/pagamento/config/:negocioId
// ─────────────────────────────────────────────────────────────
router.get('/config/:negocioId', async (req, res) => {
  try {
    const negocio = await Negocio.findById(req.params.negocioId).select('pixConfig')
    if (!negocio) return res.status(404).json({ erro: 'Negócio não encontrado' })
    return res.json(negocio.pixConfig || {})
  } catch (err) {
    console.error('[config/get]', err.message)
    return res.status(500).json({ erro: err.message })
  }
})

// ─────────────────────────────────────────────────────────────
// PATCH /api/pagamento/config
// ─────────────────────────────────────────────────────────────
router.patch('/config', async (req, res) => {
  try {
    const { negocioId, chavePix, tipoPix, servicos } = req.body
    console.log('[config/patch] recebido:', { negocioId, chavePix, tipoPix })

    if (!negocioId) return res.status(400).json({ erro: 'negocioId obrigatório' })

    const negocio = await Negocio.findById(negocioId)
    if (!negocio) return res.status(404).json({ erro: 'Negócio não encontrado' })

    negocio.pixConfig = {
      chavePix:  chavePix  ?? negocio.pixConfig?.chavePix  ?? '',
      tipoPix:   tipoPix   ?? negocio.pixConfig?.tipoPix   ?? 'cpf',
      servicos:  servicos  ?? negocio.pixConfig?.servicos  ?? {},
      updatedAt: new Date(),
    }

    await negocio.save()
    return res.json({ ok: true, pixConfig: negocio.pixConfig })

  } catch (err) {
    console.error('[config/patch] ERRO:', err.message)
    return res.status(500).json({ erro: err.message, stack: err.stack })
  }
})

module.exports = router