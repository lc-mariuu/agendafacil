const express     = require('express')
const User        = require('../models/User')
const Negocio     = require('../models/Negocio')
const Appointment = require('../models/Appointment')
const router      = express.Router()

const { autenticar } = require('../middleware/acesso')

// Middleware para checar role admin
async function checkAdmin(req, res, next) {
  try {
    const user = await User.findById(req.userId)
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ erro: 'Acesso negado: requer privilégios de admin' })
    }
    req.adminUser = user
    next()
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
}

// ── MÉTRICAS GLOBAIS ────────────────────────────────────────
router.get('/metrics', autenticar, checkAdmin, async (req, res) => {
  try {
    const [totalUsers, totalNegocios, totalAppointments] = await Promise.all([
      User.countDocuments(),
      Negocio.countDocuments(),
      Appointment.countDocuments(),
    ])

    const ativos    = await User.countDocuments({ assinaturaAtiva: true })
    const trial     = await User.countDocuments({ plano: 'trial' })
    const churned   = await User.countDocuments({ assinaturaAtiva: false, plano: { $ne: 'trial' } })

    // Plano → MRR (R$ 29 / 49 / 99)
    const precosPlano = { basico: 29, pro: 49, profissional: 49, business: 99 }
    const usersComPlano = await User.find({ assinaturaAtiva: true }).select('plano').lean()
    const mrr = usersComPlano.reduce((s, u) => s + (precosPlano[u.plano] || 0), 0)

    // MRR por mês (últimos 12)
    const historicoMrr = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      // Conta usuários com assinatura ativa no fim daquele mês
      const fimMes = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
      const count = await User.countDocuments({
        assinaturaAtiva: true,
        createdAt: { $lte: fimMes },
      })
      historicoMrr.push({ mes: chave, valor: count * 49 }) // estimativa simplificada
    }

    const trentaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const novos30d = await User.countDocuments({ createdAt: { $gte: trentaDiasAtras } })

    // Distribuição por plano
    const distPlano = await User.aggregate([
      { $group: { _id: '$plano', count: { $sum: 1 } } },
    ])

    res.json({
      totalUsers,
      totalNegocios,
      totalAppointments,
      ativos,
      trial,
      churned,
      novos30d,
      mrr,
      arr: mrr * 12,
      churnRate: churned / Math.max(1, totalUsers),
      historicoMrr,
      distPlano,
    })
  } catch (err) {
    console.error('ERRO admin/metrics:', err.message)
    res.status(500).json({ erro: err.message })
  }
})

// ── LISTAR todos os tenants (negócios + usuários) ────────────
router.get('/tenants', autenticar, checkAdmin, async (req, res) => {
  try {
    const negocios = await Negocio.find().lean()
    const userIds = [...new Set(negocios.map(n => String(n.userId)))]
    const users = await User.find({ _id: { $in: userIds } }).select('nome email plano assinaturaAtiva trialExpira createdAt').lean()
    const userMap = new Map(users.map(u => [String(u._id), u]))

    // Contagens em paralelo
    const aptCounts = await Appointment.aggregate([
      { $group: { _id: '$clinicaId', total: { $sum: 1 } } },
    ])
    const aptMap = new Map(aptCounts.map(a => [String(a._id), a.total]))

    const tenants = negocios.map(n => {
      const u = userMap.get(String(n.userId)) || {}
      return {
        _id:        n._id,
        nome:       n.nome,
        segmento:   n.segmento,
        criadoEm:   n.criadoEm,
        owner:      { _id: u._id, nome: u.nome, email: u.email },
        plano:      u.plano || 'trial',
        ativo:      u.assinaturaAtiva,
        trialExpira: u.trialExpira,
        appointments: aptMap.get(String(n._id)) || 0,
        servicos:   (n.servicos || []).length,
      }
    }).sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm))

    res.json(tenants)
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

// ── LISTAR todos os usuários ────────────────────────────────
router.get('/users', autenticar, checkAdmin, async (req, res) => {
  try {
    const { q } = req.query
    const filter = {}
    if (q) {
      filter.$or = [
        { nome:  { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ]
    }
    const users = await User.find(filter).select('-senha').sort({ createdAt: -1 }).limit(200)
    res.json(users)
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

// ── ATUALIZAR usuário (admin override) ──────────────────────
router.patch('/users/:id', autenticar, checkAdmin, async (req, res) => {
  try {
    const allowed = ['plano', 'assinaturaAtiva', 'assinaturaVencimento', 'role', 'verificado']
    const update = {}
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k] })
    const u = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-senha')
    res.json(u)
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

module.exports = router
