/**
 * routes/assinatura.js
 */

const express  = require('express')
const router   = express.Router()
const axios    = require('axios')
// O middleware autenticar está definido dentro do auth.js
const authRouter  = require('./auth')
// Extrai apenas o middleware de autenticação diretamente via JWT
const jwt = require('jsonwebtoken')
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
const User     = require('../models/User')

const MP_TOKEN     = process.env.MP_ACCESS_TOKEN
const PLAN_BASICO  = process.env.MP_PLAN_BASICO
const PLAN_PRO     = process.env.MP_PLAN_PRO
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://agendorapido.com.br'

const MP_API = axios.create({
  baseURL: 'https://api.mercadopago.com',
  headers: { Authorization: `Bearer ${MP_TOKEN}` },
})

function planIdFor(plano) {
  const map = {
    basico:       PLAN_BASICO,
    profissional: PLAN_PRO,
    pro:          PLAN_PRO,
  }
  return map[plano] || null
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

    const planId = planIdFor(plano)
    if (!planId) return res.status(400).json({ erro: `Plano inválido: ${plano}` })

    const { data } = await MP_API.post('/preapproval', {
      preapproval_plan_id: planId,
      payer_email:         user.email,
      back_url:            `${FRONTEND_URL}/planos.html?assinatura=sucesso`,
      external_reference:  user._id.toString(),
    })

    user.mp_preapproval_id = data.id
    user.mp_plano          = plano
    user.mp_status         = data.status
    await user.save()

    return res.json({ link: data.init_point })

  } catch (err) {
    console.error('[criarAssinatura]', err?.response?.data || err.message)
    const msg = err?.response?.data?.message || err.message || 'Erro interno'
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