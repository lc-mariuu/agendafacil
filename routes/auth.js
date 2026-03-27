const express = require('express')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const User = require('../models/User')
const Negocio = require('../models/Negocio')
const router = express.Router()

const autenticar = (req, res, next) => {
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

// ── CADASTRO ──────────────────────────────────────────
router.post('/cadastro', async (req, res) => {
  try {
    const { nome, email, senha, negocio, segmento, servicos } = req.body

    const existe = await User.findOne({ email })
    if (existe) return res.status(400).json({ erro: 'Email já cadastrado' })

    const senhaCriptografada = await bcrypt.hash(senha, 10)
    const user = await User.create({ nome, email, senha: senhaCriptografada })

    const neg = await Negocio.create({
      userId: user._id,
      nome: negocio,
      segmento: segmento || 'Outro',
      servicos: servicos || []
    })

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' })

    res.json({
      token,
      nome: user.nome,
      negocio: neg.nome,
      negocioId: neg._id,
      userId: user._id
    })
  } catch (err) {
    console.error('Erro no cadastro:', err.message)
    res.status(500).json({ erro: 'Erro ao cadastrar' })
  }
})

// ── LOGIN ─────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body

    const user = await User.findOne({ email })
    if (!user) return res.status(400).json({ erro: 'Email ou senha incorretos' })

    const ok = await user.compararSenha(senha)
    if (!ok) return res.status(400).json({ erro: 'Email ou senha incorretos' })

    const negocios = await Negocio.find({ userId: user._id }).sort({ criadoEm: 1 })
    const negPrincipal = negocios[0]

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' })

    res.json({
      token,
      nome: user.nome,
      negocio: negPrincipal?.nome || '',
      negocioId: negPrincipal?._id || null,
      userId: user._id,
      negocios: negocios.map(n => ({
        _id: n._id,
        nome: n.nome,
        segmento: n.segmento
      }))
    })
  } catch (err) {
    console.error('Erro no login:', err.message)
    res.status(500).json({ erro: 'Erro ao fazer login' })
  }
})

// ── LISTAR NEGÓCIOS ────────────────────────
router.get('/negocios', autenticar, async (req, res) => {
  try {
    const negocios = await Negocio.find({ userId: req.userId }).sort({ criadoEm: 1 })
    res.json(negocios)
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar negócios' })
  }
})

// ── CRIAR NEGÓCIO ─────────────────────────
router.post('/negocios', autenticar, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    const limite = user.limiteNegocios()
    const total = await Negocio.countDocuments({ userId: req.userId })

    if (total >= limite) {
      return res.status(403).json({
        erro: limite === 1
          ? 'Faça upgrade para o plano Pro para criar mais painéis'
          : 'Limite de 3 painéis atingido no plano Pro'
      })
    }

    const { nome, segmento, servicos } = req.body

    const neg = await Negocio.create({
      userId: req.userId,
      nome,
      segmento,
      servicos: servicos || []
    })

    res.json(neg)
  } catch (err) {
    console.error('Erro ao criar negócio:', err.message)
    res.status(500).json({ erro: 'Erro ao criar negócio' })
  }
})

// ── ATUALIZAR SERVIÇOS ─────────────────────
router.patch('/servicos', autenticar, async (req, res) => {
  try {
    const { negocioId, servicos } = req.body

    const neg = await Negocio.findOneAndUpdate(
      { _id: negocioId, userId: req.userId },
      { servicos },
      { returnDocument: 'after' }
    )

    if (!neg) return res.status(404).json({ erro: 'Negócio não encontrado' })

    res.json({ servicos: neg.servicos })
  } catch {
    res.status(500).json({ erro: 'Erro ao atualizar serviços' })
  }
})

// ── ATUALIZAR HORÁRIOS ─────────────────────
router.patch('/horarios', autenticar, async (req, res) => {
  try {
    const { negocioId, horarios, intervalo, pausas } = req.body

    const update = { horarios, intervalo }
    if (pausas !== undefined) update.pausas = pausas

    await Negocio.findOneAndUpdate(
      { _id: negocioId, userId: req.userId },
      { $set: update },
      { returnDocument: 'after' }
    )

    res.json({ ok: true })
  } catch (err) {
    console.error('Erro salvar horarios:', err.message)
    res.status(500).json({ erro: 'Erro ao salvar horários' })
  }
})

// ── ATUALIZAR PAGAMENTOS ─────────────────────
router.patch('/pagamentos', autenticar, async (req, res) => {
  try {
    const { negocioId, pagamentos } = req.body

    await Negocio.findOneAndUpdate(
      { _id: negocioId, userId: req.userId },
      { $set: { pagamentos } },
      { returnDocument: 'after' }
    )

    res.json({ ok: true })
  } catch (err) {
    console.error('Erro salvar pagamentos:', err.message)
    res.status(500).json({ erro: 'Erro ao salvar configuração de pagamentos' })
  }
})

// ── ATUALIZAR BIO ─────────────────────
router.patch('/bio', autenticar, async (req, res) => {
  try {
    const { negocioId, ...bioData } = req.body

    await Negocio.findOneAndUpdate(
      { _id: negocioId, userId: req.userId },
      { $set: { bio: bioData } },
      { returnDocument: 'after' }
    )

    res.json({ ok: true })
  } catch (err) {
    console.error('Erro salvar bio:', err.message)
    res.status(500).json({ erro: 'Erro ao salvar bio' })
  }
})

// ── ATUALIZAR NEGÓCIO ─────────────────────
router.patch('/negocios/:negocioId', autenticar, async (req, res) => {
  try {
    const { nome, segmento } = req.body

    const neg = await Negocio.findOneAndUpdate(
      { _id: req.params.negocioId, userId: req.userId },
      { nome, segmento },
      { returnDocument: 'after' }
    )

    if (!neg) return res.status(404).json({ erro: 'Negócio não encontrado' })

    res.json(neg)
  } catch {
    res.status(500).json({ erro: 'Erro ao atualizar negócio' })
  }
})

// ── ATUALIZAR LEMBRETES ─────────────────────
router.patch('/lembretes', autenticar, async (req, res) => {
  try {
    const { negocioId, ativo, numero, mensagem } = req.body

    await Negocio.findOneAndUpdate(
      { _id: negocioId, userId: req.userId },
      { $set: { lembrete: { ativo, numero, mensagem } } },
      { returnDocument: 'after' }
    )

    res.json({ ok: true })
  } catch (err) {
    console.error('Erro salvar lembrete:', err.message)
    res.status(500).json({ erro: 'Erro ao salvar configuração de lembretes' })
  }
})

module.exports = router