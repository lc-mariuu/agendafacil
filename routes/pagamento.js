// routes/pagamento.js
// ─────────────────────────────────────────────────────────────
//  Integração AbacatePay — Pix
//  Rotas:
//    POST  /api/pagamento/criar             → cria cobrança Pix
//    GET   /api/pagamento/status/:pixId     → consulta status
//    POST  /api/pagamento/webhook           → webhook AbacatePay
//    POST  /api/pagamento/reembolsar        → cancela + reembolso
//    GET   /api/pagamento/config/:negocioId → retorna config Pix do negócio
//    PATCH /api/pagamento/config            → salva config Pix do negócio
// ─────────────────────────────────────────────────────────────

const express     = require('express')
const router      = express.Router()
const axios       = require('axios')
const crypto      = require('crypto')
const jwt         = require('jsonwebtoken')
const Appointment = require('../models/Appointment')
const Negocio     = require('../models/Negocio')
const Pagamento   = require('../models/Pagamento')

// ── AbacatePay client ────────────────────────────────────────
const abacate = axios.create({
  baseURL: 'https://api.abacatepay.com/v1',
  headers: {
    Authorization: `Bearer ${process.env.ABACATEPAY_API_KEY}`,
    'Content-Type': 'application/json',
  },
})

// ── Middleware de autenticação JWT ───────────────────────────
function autenticar(req, res, next) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer '))
    return res.status(401).json({ erro: 'Token ausente' })
  try {
    req.usuario = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ erro: 'Token inválido' })
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/pagamento/criar
// Body: { negocioId, agendamentoId, pacienteNome, pacienteEmail,
//         pacienteTelefone, servico, data, hora, valor }
// Cria cobrança Pix no AbacatePay e salva no banco
// ─────────────────────────────────────────────────────────────
router.post('/criar', async (req, res) => {
  try {
    const {
      negocioId, agendamentoId,
      pacienteNome, pacienteEmail, pacienteTelefone,
      servico, data, hora, valor,
    } = req.body

    if (!negocioId || !valor)
      return res.status(400).json({ erro: 'negocioId e valor são obrigatórios' })

    // Verificar se horário ainda está disponível (quando data/hora fornecidos)
    if (data && hora) {
      const jaExiste = await Appointment.findOne({
        clinicaId: negocioId, data, hora, status: { $ne: 'cancelado' },
      })
      if (jaExiste) return res.status(400).json({ erro: 'Horário já ocupado' })
    }

    const negocio = await Negocio.findById(negocioId)
    if (!negocio) return res.status(404).json({ erro: 'Negócio não encontrado' })

    // Verificar se já existe pagamento pendente para este agendamento
    if (agendamentoId) {
      const existente = await Pagamento.findOne({ agendamentoId, status: 'pendente' })
      if (existente && existente.expiresAt > new Date()) {
        return res.json({
          pixId:       existente.pixId,
          qrCode:      existente.qrCode,
          qrCodeImage: existente.qrCodeImage,
          valor:       existente.valor,
          expiresAt:   existente.expiresAt,
          status:      existente.status,
        })
      }
      if (existente) {
        existente.status = 'expirado'
        await existente.save()
      }
    }

    // Criar cobrança no AbacatePay
    const { data: result } = await abacate.post('/pixQrCode/create', {
      amount:      Math.round(Number(valor) * 100), // em centavos
      description: `${servico || 'Serviço'} — ${negocio.nome}`,
      expiresIn:   3600, // 1 hora
      customer: {
        name:      pacienteNome  || 'Cliente',
        email:     pacienteEmail || undefined,
        cellphone: pacienteTelefone || undefined,
      },
      metadata: {
        negocioId,
        agendamentoId: agendamentoId || '',
        pacienteNome:  pacienteNome  || '',
        pacienteTelefone: pacienteTelefone || '',
        servico: servico || '',
        data:    data    || '',
        hora:    hora    || '',
        negocioNome: negocio.nome,
      },
    })

    const cobranca = result.data
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hora

    // Salvar no banco
    const pagamento = await Pagamento.create({
      negocioId,
      agendamentoId: agendamentoId || undefined,
      pixId:       cobranca.id,
      status:      'pendente',
      valor:       Number(valor),
      qrCode:      cobranca.brCode,
      qrCodeImage: cobranca.qrCodeImage,
      expiresAt,
    })

    // Marcar agendamento como aguardando pagamento
    if (agendamentoId) {
      await Appointment.findByIdAndUpdate(agendamentoId, {
        status:      'aguardando_pagamento',
        pagamentoId: pagamento._id,
      })
    }

    return res.json({
      pixId:       pagamento.pixId,
      qrCode:      pagamento.qrCode,
      qrCodeImage: pagamento.qrCodeImage,
      valor:       pagamento.valor,
      expiresAt,
      status:      'pendente',
    })

  } catch (err) {
    console.error('[pagamento/criar]', err.response?.data || err.message)
    return res.status(500).json({ erro: 'Erro ao criar cobrança Pix', detalhe: err.response?.data?.message || err.message })
  }
})

// ─────────────────────────────────────────────────────────────
// GET /api/pagamento/status/:pixId
// Consulta status do pagamento (polling do frontend)
// ─────────────────────────────────────────────────────────────
router.get('/status/:pixId', async (req, res) => {
  try {
    const { data: result } = await abacate.get(`/pixQrCode/${req.params.pixId}`)
    const cobranca = result.data

    // Buscar registro no banco para atualizar
    const pag = await Pagamento.findOne({ pixId: req.params.pixId })

    if (cobranca.status === 'PAID') {
      if (pag && pag.status !== 'aprovado') {
        pag.status = 'aprovado'
        pag.paidAt = new Date()
        await pag.save()

        // Confirmar agendamento se existir
        if (pag.agendamentoId) {
          const { negocioId, pacienteNome, pacienteTelefone, servico, data, hora } = cobranca.metadata || {}
          const jaExiste = await Appointment.findOne({
            clinicaId: negocioId, data, hora, status: { $ne: 'cancelado' },
          })
          if (!jaExiste && data && hora) {
            await Appointment.create({
              clinicaId: negocioId,
              pacienteNome,
              pacienteTelefone: pacienteTelefone || '',
              servico,
              data,
              hora,
              pagamento: { status: 'pago', valor: cobranca.amount / 100, pixId: cobranca.id },
            })
          } else if (pag.agendamentoId) {
            await Appointment.findByIdAndUpdate(pag.agendamentoId, {
              status: 'confirmado',
              pagamentoPix: true,
            })
          }
        }
      }
      return res.json({ status: 'pago', paidAt: pag?.paidAt })
    }

    if (cobranca.status === 'EXPIRED') {
      if (pag && pag.status === 'pendente') {
        pag.status = 'expirado'
        await pag.save()
        if (pag.agendamentoId)
          await Appointment.findByIdAndUpdate(pag.agendamentoId, { status: 'cancelado' })
      }
      return res.json({ status: 'expirado' })
    }

    if (cobranca.status === 'CANCELED') {
      if (pag && pag.status === 'pendente') {
        pag.status = 'cancelado'
        await pag.save()
      }
      return res.json({ status: 'cancelado' })
    }

    // Ainda aguardando
    return res.json({
      status:      'aguardando',
      qrCode:      cobranca.brCode,
      qrCodeImage: cobranca.qrCodeImage,
    })

  } catch (err) {
    console.error('[pagamento/status]', err.response?.data || err.message)
    return res.status(500).json({ erro: 'Erro ao verificar pagamento' })
  }
})

// ─────────────────────────────────────────────────────────────
// POST /api/pagamento/webhook
// Webhook do AbacatePay — raw body
// Configure no painel AbacatePay:
//   POST https://seudominio.com.br/api/pagamento/webhook
// ─────────────────────────────────────────────────────────────
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // Validar assinatura HMAC
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

    console.log('[webhook/abacate]', event.event)

    if (event.event === 'pixQrCode.paid') {
      const cobranca = event.data || {}
      const {
        negocioId, agendamentoId,
        pacienteNome, pacienteTelefone,
        servico, data, hora,
      } = cobranca.metadata || {}

      // Atualizar pagamento no banco
      const pag = await Pagamento.findOne({ pixId: cobranca.id })
      if (pag && pag.status !== 'aprovado') {
        pag.status = 'aprovado'
        pag.paidAt = new Date()
        await pag.save()
      }

      // Criar ou confirmar agendamento
      if (negocioId && data && hora) {
        const jaExiste = await Appointment.findOne({
          clinicaId: negocioId, data, hora, status: { $ne: 'cancelado' },
        })
        if (!jaExiste) {
          await Appointment.create({
            clinicaId: negocioId,
            pacienteNome,
            pacienteTelefone: pacienteTelefone || '',
            servico,
            data,
            hora,
            pagamento: { status: 'pago', valor: cobranca.amount / 100, pixId: cobranca.id },
          })
          console.log(`[webhook] Agendamento criado — ${pacienteNome} ${data} ${hora}`)
        }
      } else if (agendamentoId) {
        await Appointment.findByIdAndUpdate(agendamentoId, {
          status:       'confirmado',
          pagamentoPix: true,
        })
        console.log(`[webhook] Agendamento ${agendamentoId} confirmado via Pix ✓`)
      }
    }

    return res.json({ received: true })

  } catch (err) {
    console.error('[webhook/abacate] erro:', err.message)
    return res.sendStatus(500)
  }
})

// ─────────────────────────────────────────────────────────────
// POST /api/pagamento/reembolsar
// Body: { appointmentId }
// ─────────────────────────────────────────────────────────────
router.post('/reembolsar', autenticar, async (req, res) => {
  try {
    const { appointmentId } = req.body
    const appt = await Appointment.findById(appointmentId)
    if (!appt) return res.status(404).json({ erro: 'Agendamento não encontrado' })

    const pixId = appt.pagamento?.pixId
    if (!pixId) return res.status(400).json({ erro: 'Agendamento sem pagamento Pix' })

    // Tenta estornar via API AbacatePay
    try {
      await abacate.post(`/pixQrCode/${pixId}/refund`)
    } catch (refundErr) {
      console.warn('[reembolso] API indisponível — reembolso manual necessário:', refundErr.response?.data || refundErr.message)
    }

    // Atualizar banco
    await Pagamento.findOneAndUpdate({ pixId }, { status: 'reembolsado' })
    await Appointment.findByIdAndUpdate(appointmentId, {
      status: 'cancelado',
      'pagamento.status': 'reembolsado',
      atualizadoEm: new Date(),
    })

    return res.json({ ok: true, mensagem: 'Agendamento cancelado. Reembolso processado ou pendente de análise.' })

  } catch (err) {
    console.error('[reembolso]', err.message)
    return res.status(500).json({ erro: 'Erro ao reembolsar: ' + err.message })
  }
})

// ─────────────────────────────────────────────────────────────
// GET /api/pagamento/config/:negocioId
// Retorna configuração Pix do negócio (requer autenticação)
// ─────────────────────────────────────────────────────────────
router.get('/config/:negocioId', autenticar, async (req, res) => {
  try {
    const negocio = await Negocio.findById(req.params.negocioId).select('pixConfig')
    if (!negocio) return res.status(404).json({ erro: 'Negócio não encontrado' })
    return res.json(negocio.pixConfig || {})
  } catch (err) {
    return res.status(500).json({ erro: err.message })
  }
})

// ─────────────────────────────────────────────────────────────
// PATCH /api/pagamento/config
// Salva configuração Pix do negócio (requer autenticação)
// Body: { negocioId, chavePix, tipoPix,
//         servicos: { 'Corte': { ativo: true, valor: 30 } } }
// ─────────────────────────────────────────────────────────────
router.patch('/config', autenticar, async (req, res) => {
  try {
    const { negocioId, chavePix, tipoPix, servicos } = req.body
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
    return res.status(500).json({ erro: err.message })
  }
})

// ── Exportar apenas o router ─────────────────────────────────
module.exports = router