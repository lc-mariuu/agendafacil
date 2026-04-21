/**
 * routes/assinatura.js — PRODUÇÃO
 * Mercado Pago Assinaturas (preapproval)
 */

const express  = require('express')
const router   = express.Router()
const axios    = require('axios')
const jwt      = require('jsonwebtoken')
const User     = require('../models/User')

/* ── Auth middleware ── */
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ erro: 'Sem autorização' })
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.userId = decoded.id
    next()
  } catch {
    res.status(401).json({ erro: 'Token inválido' })
  }
}

const MP_TOKEN     = process.env.MP_ACCESS_TOKEN
const PLAN_BASICO  = process.env.MP_PLAN_BASICO
const PLAN_PRO     = process.env.MP_PLAN_PRO
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://agendorapido.com.br'

const MP_API = axios.create({
  baseURL: 'https://api.mercadopago.com',
  headers: { Authorization: `Bearer ${MP_TOKEN}` },
})

/* Configuração dos planos */
const PLANOS_CONFIG = {
  basico: {
    nome:            'AgendoRapido Básico',
    valor:           29.90,
    frequencia:      1,
    tipo_frequencia: 'months',
    planId:          PLAN_BASICO,
  },
  profissional: {
    nome:            'AgendoRapido Profissional',
    valor:           49.90,
    frequencia:      1,
    tipo_frequencia: 'months',
    planId:          PLAN_PRO,
  },
  pro: {
    nome:            'AgendoRapido Profissional',
    valor:           49.90,
    frequencia:      1,
    tipo_frequencia: 'months',
    planId:          PLAN_PRO,
  },
}

/* ─────────────────────────────────────────────────────────────────────────────
   POST /api/assinatura/criar
   POST /api/assinatura/checkout  (alias retrocompatível)
───────────────────────────────────────────────────────────────────────────── */
async function criarAssinatura(req, res) {
  try {
    const { plano } = req.body
    const user      = await User.findById(req.userId)

    if (!user) return res.status(404).json({ erro: 'Usuário não encontrado' })

    const config = PLANOS_CONFIG[plano]
    if (!config) return res.status(400).json({ erro: `Plano inválido: ${plano}` })

    let mpData = null

    /* Tentativa 1: via preapproval_plan_id (plano criado no painel MP) */
    if (config.planId) {
      try {
        const resp = await MP_API.post('/preapproval', {
          preapproval_plan_id: config.planId,
          payer_email:         user.email,
          back_url:            `${FRONTEND_URL}/planos.html?assinatura=sucesso`,
          external_reference:  user._id.toString(),
        })
        mpData = resp.data
        console.log('[criarAssinatura] Criado via preapproval_plan_id:', mpData.id)
      } catch (errPlan) {
        const mpErr = errPlan?.response?.data
        console.warn('[criarAssinatura] Falha via plan_id, tentando manual:', mpErr?.message || mpErr)
      }
    }

    /* Tentativa 2: criação manual com auto_recurring — sempre gera init_point */
    if (!mpData || !mpData.init_point) {
      const resp = await MP_API.post('/preapproval', {
        reason:             config.nome,
        payer_email:        user.email,
        back_url:           `${FRONTEND_URL}/planos.html?assinatura=sucesso`,
        external_reference: user._id.toString(),
        auto_recurring: {
          frequency:          config.frequencia,
          frequency_type:     config.tipo_frequencia,
          transaction_amount: config.valor,
          currency_id:        'BRL',
        },
      })
      mpData = resp.data
      console.log('[criarAssinatura] Criado via auto_recurring manual:', mpData.id)
    }

    /* Salva no usuário */
    user.mp_preapproval_id = mpData.id
    user.mp_plano          = plano
    user.mp_status         = mpData.status
    await user.save()

    const link = mpData.init_point
    if (!link) {
      console.error('[criarAssinatura] Sem init_point na resposta:', mpData)
      return res.status(500).json({ erro: 'Link de pagamento não gerado. Tente novamente.' })
    }

    return res.json({ link })

  } catch (err) {
    const mpErr = err?.response?.data
    console.error('[criarAssinatura] Erro final:', mpErr || err.message)

    let msg = 'Erro ao criar assinatura'
    if (mpErr?.message)   msg = mpErr.message
    else if (mpErr?.error) msg = mpErr.error
    else if (err.message)  msg = err.message

    return res.status(500).json({ erro: msg })
  }
}

router.post('/criar',    auth, criarAssinatura)
router.post('/checkout', auth, criarAssinatura)

/* ─────────────────────────────────────────────────────────────────────────────
   GET /api/assinatura/status
───────────────────────────────────────────────────────────────────────────── */
router.get('/status', auth, async (req, res) => {
  try {
    const user  = await User.findById(req.userId)
    if (!user) return res.status(404).json({ erro: 'Usuário não encontrado' })

    const agora   = new Date()
    const emTrial = user.plano === 'trial' && user.trialExpira && agora < new Date(user.trialExpira)

    /* Sincroniza status com o MP se houver preapproval pendente */
    if (user.mp_preapproval_id && !user.assinaturaAtiva) {
      try {
        const { data } = await MP_API.get(`/preapproval/${user.mp_preapproval_id}`)
        if (data.status === 'authorized') {
          user.assinaturaAtiva      = true
          user.plano                = user.mp_plano || 'basico'
          user.mp_status            = 'authorized'
          user.assinaturaVencimento = data.next_payment_date
            ? new Date(data.next_payment_date) : null
          await user.save()
        }
      } catch (_) {}
    }

    const diasRestantes = emTrial
      ? Math.max(0, Math.ceil((new Date(user.trialExpira) - agora) / 86400000))
      : null

    return res.json({
      plano:           user.plano,
      assinaturaAtiva: user.assinaturaAtiva,
      temAcesso:       user.assinaturaAtiva || emTrial,
      diasRestantes,
      vencimento:      user.assinaturaVencimento,
    })

  } catch (err) {
    console.error('[status]', err.message)
    return res.status(500).json({ erro: 'Erro interno' })
  }
})

/* ─────────────────────────────────────────────────────────────────────────────
   POST /api/assinatura/portal
───────────────────────────────────────────────────────────────────────────── */
router.post('/portal', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user || !user.mp_preapproval_id) {
      return res.status(400).json({ erro: 'Nenhuma assinatura ativa encontrada' })
    }

    const { data } = await MP_API.get(`/preapproval/${user.mp_preapproval_id}`)
    const url = data.init_point || 'https://www.mercadopago.com.br/subscriptions'
    return res.json({ url })

  } catch (err) {
    console.error('[portal]', err?.response?.data || err.message)
    return res.status(500).json({ erro: 'Erro ao abrir gerenciamento' })
  }
})

/* ─────────────────────────────────────────────────────────────────────────────
   POST /api/assinatura/webhook
   SEM auth — o MP não manda token JWT
   Responde 200 ANTES de processar (MP cancela se demorar)
───────────────────────────────────────────────────────────────────────────── */
router.post('/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  res.status(200).json({ ok: true })

  try {
    let body = req.body
    if (Buffer.isBuffer(body)) {
      body = JSON.parse(body.toString('utf8'))
    }

    const id = body?.data?.id
    if (!id) return

    const { data: mpData } = await MP_API.get(`/preapproval/${id}`)
    const userId = mpData.external_reference

    if (!userId) return

    const user = await User.findById(userId)
    if (!user) return

    user.mp_preapproval_id = id
    user.mp_status         = mpData.status
    user.mp_plano          = user.mp_plano || 'basico'

    if (mpData.status === 'authorized') {
      user.assinaturaAtiva      = true
      user.plano                = user.mp_plano
      user.assinaturaVencimento = mpData.next_payment_date
        ? new Date(mpData.next_payment_date) : null

    } else if (['cancelled', 'paused'].includes(mpData.status)) {
      user.assinaturaAtiva = false
      if (!user.assinaturaVencimento || new Date() > new Date(user.assinaturaVencimento)) {
        user.plano = 'inativo'
      }
    }

    await user.save()
    console.log(`[Webhook MP] user=${userId} status=${mpData.status} plano=${user.plano}`)

  } catch (err) {
    console.error('[webhook erro]', err?.response?.data || err.message)
  }
})

/* ─────────────────────────────────────────────────────────────────────────────
   POST /api/assinatura/cancelar
───────────────────────────────────────────────────────────────────────────── */
router.post('/cancelar', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user || !user.mp_preapproval_id) {
      return res.status(400).json({ erro: 'Nenhuma assinatura encontrada' })
    }

    await MP_API.put(`/preapproval/${user.mp_preapproval_id}`, { status: 'cancelled' })

    user.assinaturaAtiva = false
    user.mp_status       = 'cancelled'
    user.plano           = 'inativo'
    await user.save()

    return res.json({ ok: true, mensagem: 'Assinatura cancelada' })

  } catch (err) {
    console.error('[cancelar]', err?.response?.data || err.message)
    return res.status(500).json({ erro: 'Erro ao cancelar assinatura' })
  }
})

module.exports = router