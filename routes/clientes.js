const express     = require('express')
const Cliente     = require('../models/Cliente')
const Negocio     = require('../models/Negocio')
const Appointment = require('../models/Appointment')
const router      = express.Router()

const { autenticar, verificarAcesso } = require('../middleware/acesso')

// ── Helper: garante que o negocio é do user ──────────────────
async function checkNegocio(negocioId, userId) {
  const neg = await Negocio.findOne({ _id: negocioId, userId })
  return !!neg
}

// ── LISTAR clientes do negócio (com stats agregados) ─────────
// GET /api/clientes?negocioId=X&q=busca&tag=VIP&sort=ltv|visitas|recent|name
router.get('/', autenticar, verificarAcesso, async (req, res) => {
  try {
    const { negocioId, q, tag, sort } = req.query
    if (!await checkNegocio(negocioId, req.userId)) {
      return res.status(404).json({ erro: 'Negócio não encontrado' })
    }

    // Pega clientes registrados
    const filter = { negocioId }
    if (tag && tag !== 'all') filter.tags = tag
    if (q) {
      filter.$or = [
        { nome: { $regex: q, $options: 'i' } },
        { telefone: { $regex: q.replace(/\D/g, ''), $options: 'i' } },
      ]
    }

    let clientes = await Cliente.find(filter).lean()

    // Enriquece com appointments para o caso de clientes "fantasma"
    // (que aparecem em appointments mas nunca foram registrados)
    const apts = await Appointment.find({ clinicaId: negocioId }).lean()
    const aptsByKey = new Map()
    apts.forEach(a => {
      const key = (a.pacienteTelefone || a.pacienteNome || '').toLowerCase().trim()
      if (!key) return
      if (!aptsByKey.has(key)) aptsByKey.set(key, [])
      aptsByKey.get(key).push(a)
    })

    // Para cada cliente registrado, recalcula stats baseado em appointments
    clientes.forEach(c => {
      const apts1 = aptsByKey.get((c.telefone || '').toLowerCase().trim()) || []
      const apts2 = aptsByKey.get((c.nome || '').toLowerCase().trim()) || []
      const all = [...apts1, ...apts2]
      const concluidos = all.filter(a => a.status === 'concluido')
      c.visitas     = concluidos.length
      c.ltv         = concluidos.reduce((s, a) => s + (Number(a.preco) || 0), 0)
      c.noShows     = all.filter(a => a.status === 'cancelado').length
      const lastDone = concluidos.sort((a, b) => b.data.localeCompare(a.data))[0]
      c.ultimaVisita = lastDone ? lastDone.data : c.ultimaVisita
    })

    // Adiciona "ghost clients" (no appointment mas não no Cliente)
    const registeredKeys = new Set(clientes.map(c => (c.telefone || '').toLowerCase()))
    const ghostMap = new Map()
    for (const [key, list] of aptsByKey) {
      if (registeredKeys.has(key)) continue
      const a = list[0]
      if (!a.pacienteNome || !a.pacienteTelefone) continue
      const gkey = (a.pacienteTelefone || '').toLowerCase()
      if (ghostMap.has(gkey)) continue
      const concluidos = list.filter(x => x.status === 'concluido')
      ghostMap.set(gkey, {
        _id:        'ghost_' + gkey,
        negocioId,
        nome:       a.pacienteNome,
        telefone:   a.pacienteTelefone,
        email:      '',
        tags:       [],
        notas:      '',
        visitas:    concluidos.length,
        ltv:        concluidos.reduce((s, x) => s + (Number(x.preco) || 0), 0),
        noShows:    list.filter(x => x.status === 'cancelado').length,
        ultimaVisita: concluidos.sort((a, b) => b.data.localeCompare(a.data))[0]?.data || null,
        ghost:      true,
      })
    }
    clientes = [...clientes, ...ghostMap.values()]

    // Aplica filtros de busca em ghosts também
    if (q) {
      const qLow = q.toLowerCase()
      clientes = clientes.filter(c =>
        (c.nome || '').toLowerCase().includes(qLow) ||
        (c.telefone || '').includes(q.replace(/\D/g, ''))
      )
    }

    // Sort
    if (sort === 'ltv')      clientes.sort((a, b) => b.ltv - a.ltv)
    else if (sort === 'visitas') clientes.sort((a, b) => b.visitas - a.visitas)
    else if (sort === 'name')    clientes.sort((a, b) => a.nome.localeCompare(b.nome))
    else                         clientes.sort((a, b) => (b.ultimaVisita || '').localeCompare(a.ultimaVisita || ''))

    res.json(clientes)
  } catch (err) {
    console.error('ERRO clientes:', err.message)
    res.status(500).json({ erro: 'Erro ao listar clientes' })
  }
})

// ── GET cliente por ID ──────────────────────────────────────
router.get('/:id', autenticar, verificarAcesso, async (req, res) => {
  try {
    // Suporta ghosts: ghost_<telefone>
    if (req.params.id.startsWith('ghost_')) {
      const tel = req.params.id.replace('ghost_', '')
      const apts = await Appointment.find({ pacienteTelefone: tel }).lean()
      if (!apts.length) return res.status(404).json({ erro: 'Cliente não encontrado' })
      const concluidos = apts.filter(a => a.status === 'concluido')
      return res.json({
        _id: req.params.id,
        nome:      apts[0].pacienteNome,
        telefone:  tel,
        tags:      [],
        notas:     '',
        visitas:   concluidos.length,
        ltv:       concluidos.reduce((s, x) => s + (Number(x.preco) || 0), 0),
        noShows:   apts.filter(x => x.status === 'cancelado').length,
        appointments: apts,
        ghost:     true,
      })
    }

    const c = await Cliente.findById(req.params.id)
    if (!c) return res.status(404).json({ erro: 'Cliente não encontrado' })
    if (!await checkNegocio(c.negocioId, req.userId)) {
      return res.status(403).json({ erro: 'Sem permissão' })
    }
    const apts = await Appointment.find({
      $or: [
        { clienteId: c._id },
        { pacienteTelefone: c.telefone, clinicaId: c.negocioId },
      ],
    }).sort({ data: -1 })
    const obj = c.toObject()
    obj.appointments = apts
    res.json(obj)
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

// ── CRIAR cliente ───────────────────────────────────────────
router.post('/', autenticar, verificarAcesso, async (req, res) => {
  try {
    const { negocioId, nome, telefone, email, notas, tags, aniversario, profissionalPreferidoId } = req.body
    if (!await checkNegocio(negocioId, req.userId)) {
      return res.status(404).json({ erro: 'Negócio não encontrado' })
    }
    if (!nome || !telefone) return res.status(400).json({ erro: 'Nome e telefone obrigatórios' })

    // Se já existe pelo telefone, atualiza
    const cleanTel = telefone.replace(/\D/g, '')
    const existing = await Cliente.findOne({ negocioId, telefone: cleanTel })
    if (existing) {
      existing.nome = nome
      if (email !== undefined) existing.email = email
      if (notas !== undefined) existing.notas = notas
      if (tags  !== undefined) existing.tags  = tags
      if (aniversario !== undefined) existing.aniversario = aniversario
      if (profissionalPreferidoId !== undefined) existing.profissionalPreferidoId = profissionalPreferidoId
      await existing.save()
      return res.json(existing)
    }
    const c = await Cliente.create({
      negocioId, nome, telefone: cleanTel,
      email, notas, tags, aniversario, profissionalPreferidoId,
    })
    res.json(c)
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ erro: 'Cliente com este telefone já existe' })
    console.error('ERRO criar cliente:', err.message)
    res.status(500).json({ erro: err.message })
  }
})

// ── ATUALIZAR cliente ───────────────────────────────────────
router.patch('/:id', autenticar, verificarAcesso, async (req, res) => {
  try {
    const c = await Cliente.findById(req.params.id)
    if (!c) return res.status(404).json({ erro: 'Cliente não encontrado' })
    if (!await checkNegocio(c.negocioId, req.userId)) {
      return res.status(403).json({ erro: 'Sem permissão' })
    }
    const allowed = ['nome', 'telefone', 'email', 'notas', 'tags', 'aniversario', 'profissionalPreferidoId']
    for (const k of allowed) {
      if (req.body[k] !== undefined) c[k] = req.body[k]
    }
    await c.save()
    res.json(c)
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

// ── EXCLUIR cliente ─────────────────────────────────────────
router.delete('/:id', autenticar, verificarAcesso, async (req, res) => {
  try {
    const c = await Cliente.findById(req.params.id)
    if (!c) return res.status(404).json({ erro: 'Cliente não encontrado' })
    if (!await checkNegocio(c.negocioId, req.userId)) {
      return res.status(403).json({ erro: 'Sem permissão' })
    }
    await Cliente.deleteOne({ _id: c._id })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

// ── PROMOVER ghost a cliente real ───────────────────────────
// POST /api/clientes/promover { ghostId: 'ghost_TELEFONE', negocioId }
router.post('/promover', autenticar, verificarAcesso, async (req, res) => {
  try {
    const { ghostId, negocioId, tags = [], notas = '', email = '' } = req.body
    if (!await checkNegocio(negocioId, req.userId)) {
      return res.status(404).json({ erro: 'Negócio não encontrado' })
    }
    const tel = (ghostId || '').replace('ghost_', '')
    if (!tel) return res.status(400).json({ erro: 'Ghost ID inválido' })

    const apt = await Appointment.findOne({ clinicaId: negocioId, pacienteTelefone: tel })
    if (!apt) return res.status(404).json({ erro: 'Sem appointments com este telefone' })

    const c = await Cliente.findOneAndUpdate(
      { negocioId, telefone: tel },
      {
        $setOnInsert: { negocioId, telefone: tel, nome: apt.pacienteNome },
        $set: { tags, notas, email },
      },
      { upsert: true, new: true }
    )
    res.json(c)
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

module.exports = router
