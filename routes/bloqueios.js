const express = require('express')
const Negocio = require('../models/Negocio')
const router  = express.Router()

const { autenticar, verificarAcesso } = require('../middleware/acesso')

// ── LISTAR bloqueios ─────────────────────────────────────────
router.get('/', autenticar, verificarAcesso, async (req, res) => {
  try {
    const { negocioId } = req.query
    const neg = await Negocio.findOne({ _id: negocioId, userId: req.userId }).lean()
    if (!neg) return res.status(404).json({ erro: 'Negócio não encontrado' })
    res.json(neg.bloqueios || [])
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

// ── ADICIONAR bloqueio ──────────────────────────────────────
router.post('/', autenticar, verificarAcesso, async (req, res) => {
  try {
    const { negocioId, data, label, allDay, startH, endH, cor } = req.body
    if (!data) return res.status(400).json({ erro: 'Data obrigatória' })
    const neg = await Negocio.findOne({ _id: negocioId, userId: req.userId })
    if (!neg) return res.status(404).json({ erro: 'Negócio não encontrado' })
    const bloqueio = { data, label: label || 'Indisponível', allDay: !!allDay, startH: startH || '', endH: endH || '', cor: cor || '#dc2626' }
    neg.bloqueios.push(bloqueio)
    await neg.save()
    res.json(neg.bloqueios[neg.bloqueios.length - 1])
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

// ── ATUALIZAR bloqueio ──────────────────────────────────────
router.patch('/:id', autenticar, verificarAcesso, async (req, res) => {
  try {
    const { negocioId } = req.body
    const neg = await Negocio.findOne({ _id: negocioId, userId: req.userId })
    if (!neg) return res.status(404).json({ erro: 'Negócio não encontrado' })
    const b = neg.bloqueios.id(req.params.id)
    if (!b) return res.status(404).json({ erro: 'Bloqueio não encontrado' })
    const fields = ['data', 'label', 'allDay', 'startH', 'endH', 'cor']
    fields.forEach(f => { if (req.body[f] !== undefined) b[f] = req.body[f] })
    await neg.save()
    res.json(b)
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

// ── EXCLUIR bloqueio ────────────────────────────────────────
router.delete('/:id', autenticar, verificarAcesso, async (req, res) => {
  try {
    const { negocioId } = req.query
    const neg = await Negocio.findOne({ _id: negocioId, userId: req.userId })
    if (!neg) return res.status(404).json({ erro: 'Negócio não encontrado' })
    neg.bloqueios.id(req.params.id)?.deleteOne()
    await neg.save()
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

module.exports = router
