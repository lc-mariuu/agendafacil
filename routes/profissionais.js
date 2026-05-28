const express      = require('express')
const Profissional = require('../models/Profissional')
const Negocio      = require('../models/Negocio')
const Appointment  = require('../models/Appointment')
const router       = express.Router()

const { autenticar, verificarAcesso } = require('../middleware/acesso')

async function checkNegocio(negocioId, userId) {
  const neg = await Negocio.findOne({ _id: negocioId, userId })
  return !!neg
}

// ── LISTAR profissionais (PROTEGIDO) ─────────────────────────
router.get('/', autenticar, verificarAcesso, async (req, res) => {
  try {
    const { negocioId } = req.query
    if (!await checkNegocio(negocioId, req.userId)) {
      return res.status(404).json({ erro: 'Negócio não encontrado' })
    }
    const list = await Profissional.find({ negocioId, ativo: true }).sort({ criadoEm: 1 })
    res.json(list)
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

// ── LISTAR profissionais (PÚBLICO — pra página de agendamento) ──
router.get('/publico', async (req, res) => {
  try {
    const { negocioId } = req.query
    const list = await Profissional.find({ negocioId, ativo: true })
      .select('nome role foto cor servicos')
      .sort({ criadoEm: 1 })
    res.json(list)
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

// ── CRIAR profissional ──────────────────────────────────────
router.post('/', autenticar, verificarAcesso, async (req, res) => {
  try {
    const { negocioId, ...data } = req.body
    if (!await checkNegocio(negocioId, req.userId)) {
      return res.status(404).json({ erro: 'Negócio não encontrado' })
    }
    if (!data.nome) return res.status(400).json({ erro: 'Nome obrigatório' })
    const p = await Profissional.create({ negocioId, ...data })
    res.json(p)
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

// ── ATUALIZAR ────────────────────────────────────────────────
router.patch('/:id', autenticar, verificarAcesso, async (req, res) => {
  try {
    const p = await Profissional.findById(req.params.id)
    if (!p) return res.status(404).json({ erro: 'Profissional não encontrado' })
    if (!await checkNegocio(p.negocioId, req.userId)) {
      return res.status(403).json({ erro: 'Sem permissão' })
    }
    const allowed = ['nome', 'role', 'email', 'telefone', 'foto', 'cor', 'comissao', 'servicos', 'horariosCustom', 'horarios', 'ativo']
    for (const k of allowed) if (req.body[k] !== undefined) p[k] = req.body[k]
    await p.save()
    res.json(p)
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

// ── EXCLUIR (soft delete) ────────────────────────────────────
router.delete('/:id', autenticar, verificarAcesso, async (req, res) => {
  try {
    const p = await Profissional.findById(req.params.id)
    if (!p) return res.status(404).json({ erro: 'Profissional não encontrado' })
    if (!await checkNegocio(p.negocioId, req.userId)) {
      return res.status(403).json({ erro: 'Sem permissão' })
    }
    p.ativo = false
    await p.save()
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

// ── COMISSÕES — relatório por período ────────────────────────
// GET /api/profissionais/comissoes?negocioId=X&inicio=YYYY-MM-DD&fim=YYYY-MM-DD
router.get('/comissoes/relatorio', autenticar, verificarAcesso, async (req, res) => {
  try {
    const { negocioId, inicio, fim } = req.query
    if (!await checkNegocio(negocioId, req.userId)) {
      return res.status(404).json({ erro: 'Negócio não encontrado' })
    }

    const pros = await Profissional.find({ negocioId, ativo: true }).lean()

    const filter = {
      clinicaId: negocioId,
      status:    'concluido',
    }
    if (inicio) filter.data = { ...(filter.data || {}), $gte: inicio }
    if (fim)    filter.data = { ...(filter.data || {}), $lte: fim }

    const apts = await Appointment.find(filter).lean()

    // Agrupa por profissional
    const byPro = {}
    pros.forEach(p => {
      byPro[p._id.toString()] = {
        _id: p._id,
        nome: p.nome,
        role: p.role,
        cor: p.cor,
        comissao: p.comissao,
        atendimentos: 0,
        clientesUnicos: new Set(),
        faturamento: 0,
        comissaoTotal: 0,
      }
    })
    // Bucket pra sem profissional
    byPro['_sem'] = {
      _id: null, nome: '(Sem profissional)', role: '', cor: '#9ea0ad',
      comissao: { tipo: 'percentual', valor: 0 },
      atendimentos: 0, clientesUnicos: new Set(), faturamento: 0, comissaoTotal: 0,
    }

    apts.forEach(a => {
      const key = a.profissionalId ? a.profissionalId.toString() : '_sem'
      const bucket = byPro[key] || byPro['_sem']
      bucket.atendimentos++
      bucket.clientesUnicos.add(a.pacienteTelefone || a.pacienteNome)
      const valor = Number(a.preco) || 0
      bucket.faturamento += valor
      const c = bucket.comissao || { tipo: 'percentual', valor: 0 }
      if (c.tipo === 'percentual') bucket.comissaoTotal += valor * (c.valor / 100)
      else if (c.tipo === 'fixo')  bucket.comissaoTotal += c.valor
    })

    const result = Object.values(byPro)
      .filter(b => b.atendimentos > 0 || b._id) // remove bucket '_sem' se vazio
      .map(b => ({
        _id: b._id,
        nome: b.nome,
        role: b.role,
        cor: b.cor,
        comissao: b.comissao,
        atendimentos: b.atendimentos,
        clientes: b.clientesUnicos.size,
        faturamento: b.faturamento,
        comissao_repasse: b.comissaoTotal,
        ticketMedio: b.atendimentos > 0 ? b.faturamento / b.atendimentos : 0,
      }))
      .sort((a, b) => b.faturamento - a.faturamento)

    const totais = result.reduce((acc, p) => ({
      faturamento: acc.faturamento + p.faturamento,
      comissao_repasse: acc.comissao_repasse + p.comissao_repasse,
      atendimentos: acc.atendimentos + p.atendimentos,
    }), { faturamento: 0, comissao_repasse: 0, atendimentos: 0 })

    res.json({ profissionais: result, totais })
  } catch (err) {
    console.error('ERRO comissoes:', err.message)
    res.status(500).json({ erro: err.message })
  }
})

module.exports = router
