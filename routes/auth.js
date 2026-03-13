const express = require('express')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const User = require('../models/User')
const router = express.Router()

router.post('/cadastro', async (req, res) => {
  try {
    const { nome, email, senha, negocio, segmento, servicos } = req.body
    const existe = await User.findOne({ email })
    if (existe) return res.status(400).json({ erro: 'Email já cadastrado' })
    const senhaCriptografada = await bcrypt.hash(senha, 10)
    const user = await User.create({ nome, email, senha: senhaCriptografada, negocio, segmento, servicos })
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, nome: user.nome, negocio: user.negocio, segmento: user.segmento })
  } catch (err) {
    console.log('Erro no cadastro:', err.message)
    res.status(500).json({ erro: 'Erro ao cadastrar' })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body
    const user = await User.findOne({ email })
    if (!user) return res.status(400).json({ erro: 'Email ou senha incorretos' })
    const ok = await user.compararSenha(senha)
    if (!ok) return res.status(400).json({ erro: 'Email ou senha incorretos' })
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, nome: user.nome, negocio: user.negocio, segmento: user.segmento })
  } catch (err) {
    console.log('Erro no login:', err.message)
    res.status(500).json({ erro: 'Erro ao fazer login' })
  }
})

router.get('/negocio/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('nome negocio segmento servicos horarios intervalo bio')
    if (!user) return res.status(404).json({ erro: 'Negócio não encontrado' })
    res.json({ nome: user.nome, negocio: user.negocio, segmento: user.segmento, servicos: user.servicos, horarios: user.horarios, intervalo: user.intervalo, bio: user.bio })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar negócio' })
  }
})

router.patch('/servicos', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findByIdAndUpdate(decoded.id, { servicos: req.body.servicos }, { new: true })
    res.json({ servicos: user.servicos })
  } catch {
    res.status(500).json({ erro: 'Erro ao atualizar serviços' })
  }
})

router.patch('/horarios', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    await User.findByIdAndUpdate(decoded.id, { $set: { horarios: req.body.horarios, intervalo: req.body.intervalo } })
    res.json({ ok: true })
  } catch (err) {
    console.log('Erro salvar horarios:', err.message)
    res.status(500).json({ erro: 'Erro ao salvar horários' })
  }
})

router.patch('/bio', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    await User.findByIdAndUpdate(decoded.id, { $set: { bio: req.body } })
    res.json({ ok: true })
  } catch (err) {
    console.log('Erro salvar bio:', err.message)
    res.status(500).json({ erro: 'Erro ao salvar bio' })
  }
})

module.exports = router