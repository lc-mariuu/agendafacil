/**
 * routes/assinatura.js
 * 
 * Integração com Mercado Pago Subscriptions (preapproval)
 * 
 * Endpoints:
 *   POST /api/assinatura/criar       → gera link de assinatura
 *   POST /api/assinatura/webhook     → recebe notificações do MP
 *   GET  /api/assinatura/status      → retorna status atual do usuário
 *   POST /api/assinatura/cancelar    → cancela assinatura ativa
 */

const express  = require('express')
const router   = express.Router()
const User     = require('../models/User')
const Negocio  = require('../models/Negocio')
const jwt      = require('jsonwebtoken')

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET || ''

// IDs dos planos criados com criar-planos-mp.js
const PLANOS = {
  basico:        { id: process.env.MP_PLAN_BASICO_ID,        valor: 29, nome: 'Básico'        },
  profissional:  { id: process.env.MP_PLAN_PROFISSIONAL_ID,  valor: 49, nome: 'Profissional'  },
}

// ─── Middleware de autenticação ───────────────────────────────────────
function auth(req, res, next) {
  const header = req.headers.authorization
  if (!header) return res.status(401).json({ erro: 'Token ausente' })
  try {
    req.user = jwt.verify(header.replace('Bearer ', ''), process.env.JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ erro: 'Token inválido' })
  }
}

// ─── POST /api/assinatura/criar ───────────────────────────────────────
// Cria link de assinatura recorrente no Mercado Pago
router.post('/criar', auth, async (req, res) => {
  try {
    const { plano } = req.body // 'basico' ou 'profissional'

    if (!PLANOS[plano]) {
      return res.status(400).json({ erro: 'Plano inválido. Use: basico ou profissional' })
    }

    const user = await User.findById(req.user.id)
    if (!user) return res.status(404).json({ erro: 'Usuário não encontrado' })

    const planConfig = PLANOS[plano]

    // Cria a pré-aprovação (assinatura) no MP
    const mpRes = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        preapproval_plan_id: planConfig.id,
        reason: `AgendoRapido — Plano ${planConfig.nome}`,
        payer_email: user.email,
        // Dados extras para identificar o usuário no webhook
        external_reference: user._id.toString(),
        back_url: 'https://agendorapido.com.br/painel.html?assinatura=ok',
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: planConfig.valor,
          currency_id: 'BRL',
        },
      }),
    })

    const mpData = await mpRes.json()

    if (!mpRes.ok) {
      console.error('[MP] Erro ao criar assinatura:', mpData)
      return res.status(500).json({ erro: 'Erro ao criar assinatura no Mercado Pago', detalhes: mpData })
    }

    // Salva o ID da assinatura no usuário (para gerenciar depois)
    user.mp_preapproval_id  = mpData.id
    user.mp_plano           = plano
    user.mp_status          = 'pending'
    await user.save()

    // Retorna o link de pagamento para o frontend redirecionar
    res.json({
      link: mpData.init_point,       // URL para o cliente assinar
      assinaturaId: mpData.id,
    })

  } catch (err) {
    console.error('[MP] Erro interno:', err)
    res.status(500).json({ erro: 'Erro interno ao criar assinatura' })
  }
})

// ─── POST /api/assinatura/webhook ─────────────────────────────────────
// Mercado Pago chama este endpoint automaticamente quando o status muda
// Configure no painel do MP: https://www.mercadopago.com.br/developers/panel/webhooks
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const body = JSON.parse(req.body)

    // Filtra apenas notificações de assinatura (preapproval)
    if (body.type !== 'preapproval') {
      return res.sendStatus(200)
    }

    const preapprovalId = body.data?.id
    if (!preapprovalId) return res.sendStatus(200)

    // Busca os detalhes da assinatura no MP
    const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` },
    })
    const assinatura = await mpRes.json()

    const userId       = assinatura.external_reference
    const statusMP     = assinatura.status  // authorized | paused | cancelled | pending

    if (!userId) return res.sendStatus(200)

    const user = await User.findById(userId)
    if (!user) return res.sendStatus(200)

    // Mapeia status do MP para o seu sistema
    const statusMap = {
      authorized: { ativo: true,  plano: user.mp_plano || 'basico' },
      paused:     { ativo: false, plano: user.mp_plano || 'basico' },
      cancelled:  { ativo: false, plano: 'trial' },
      pending:    { ativo: false, plano: user.mp_plano || 'basico' },
    }

    const novoStatus = statusMap[statusMP] || { ativo: false, plano: 'trial' }

    user.mp_status         = statusMP
    user.mp_preapproval_id = preapprovalId
    user.assinaturaAtiva   = novoStatus.ativo
    user.plano             = novoStatus.plano

    if (novoStatus.ativo) {
      // Define vencimento para +1 mês (backup caso webhook atrase)
      const vencimento = new Date()
      vencimento.setMonth(vencimento.getMonth() + 1)
      user.assinaturaVencimento = vencimento
    }

    await user.save()

    console.log(`[MP Webhook] User ${userId} → ${statusMP} (plano: ${user.plano})`)
    res.sendStatus(200)

  } catch (err) {
    console.error('[MP Webhook] Erro:', err)
    res.sendStatus(500)
  }
})

// ─── GET /api/assinatura/status ───────────────────────────────────────
// Retorna situação atual do usuário (já existe na sua rota, mas aqui está mais completo)
router.get('/status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
    if (!user) return res.status(404).json({ erro: 'Usuário não encontrado' })

    const agora = new Date()

    // Verifica se trial ainda é válido
    const criadoEm     = new Date(user.createdAt || agora)
    const diasDeTrial  = 14
    const fimTrial     = new Date(criadoEm)
    fimTrial.setDate(fimTrial.getDate() + diasDeTrial)
    const trialValido  = agora < fimTrial
    const diasRestantes = Math.max(0, Math.ceil((fimTrial - agora) / 86400000))

    // Verifica assinatura paga
    const assinaturaValida =
      user.assinaturaAtiva &&
      user.mp_status === 'authorized' &&
      (!user.assinaturaVencimento || new Date(user.assinaturaVencimento) > agora)

    const temAcesso = assinaturaValida || trialValido

    res.json({
      temAcesso,
      plano:           assinaturaValida ? (user.plano || 'basico') : 'trial',
      assinaturaAtiva: assinaturaValida,
      mp_status:       user.mp_status || null,
      diasRestantes:   trialValido ? diasRestantes : 0,
      vencimento:      user.assinaturaVencimento || null,
    })

  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar status' })
  }
})

// ─── POST /api/assinatura/cancelar ────────────────────────────────────
router.post('/cancelar', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
    if (!user || !user.mp_preapproval_id) {
      return res.status(400).json({ erro: 'Nenhuma assinatura ativa encontrada' })
    }

    // Cancela no Mercado Pago
    const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${user.mp_preapproval_id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ status: 'cancelled' }),
    })

    if (!mpRes.ok) {
      const err = await mpRes.json()
      return res.status(500).json({ erro: 'Erro ao cancelar no Mercado Pago', detalhes: err })
    }

    user.assinaturaAtiva = false
    user.mp_status       = 'cancelled'
    user.plano           = 'trial'
    await user.save()

    res.json({ ok: true, mensagem: 'Assinatura cancelada com sucesso' })

  } catch (err) {
    console.error('[MP] Erro ao cancelar:', err)
    res.status(500).json({ erro: 'Erro interno ao cancelar assinatura' })
  }
})

module.exports = router