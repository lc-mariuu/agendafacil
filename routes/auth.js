const express = require('express')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const { Resend } = require('resend')
const User = require('../models/User')
const Negocio = require('../models/Negocio')
const router = express.Router()

const resend = new Resend(process.env.RESEND_API_KEY)

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

function gerarCodigo() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

async function enviarEmail(email, nome, codigo, tipo) {
  const assunto = tipo === 'recuperacao'
    ? `${codigo} — código para redefinir sua senha`
    : `${codigo} — confirme seu email no AgendoRapido`

  await resend.emails.send({
    from: 'AgendoRapido <noreply@agendorapido.com.br>',
    to: email,
    subject: assunto,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0d0f12">
        <div style="font-size:20px;font-weight:800;margin-bottom:24px">
          Agendo<span style="color:#0057FF">Rapido</span>
        </div>
        <p style="color:#5a6072;font-size:15px;margin:0 0 8px">Olá${nome ? ', ' + nome : ''}!</p>
        <p style="color:#5a6072;font-size:15px;margin:0 0 24px">
          ${tipo === 'recuperacao'
            ? 'Use o código abaixo para redefinir sua senha:'
            : 'Use o código abaixo para confirmar seu email:'}
        </p>
        <div style="background:#f6f7f9;border:1px solid #e2e8f0;border-radius:12px;padding:28px;text-align:center;margin-bottom:24px">
          <div style="font-size:42px;font-weight:800;letter-spacing:10px;color:#0d0f12">${codigo}</div>
          <div style="color:#9ba4b4;font-size:13px;margin-top:10px">Expira em 15 minutos</div>
        </div>
        <p style="color:#9ba4b4;font-size:12px;margin:0">
          Se você não solicitou isso, pode ignorar este email.
        </p>
      </div>
    `
  })
}

// ── ENVIAR CÓDIGO (pré-cadastro) ──────────────────────
router.post('/enviar-codigo', async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ erro: 'Email obrigatório' })

    const userExistente = await User.findOne({ email, verificado: true })
    if (userExistente) return res.status(400).json({ erro: 'Email já cadastrado' })

    const codigo = gerarCodigo()
    const expira = new Date(Date.now() + 15 * 60 * 1000)

    // Rascunho pendente: atualiza ou cria
    let rascunho = await User.findOne({ email, verificado: false })
    if (rascunho) {
      rascunho.codigoVerificacao = codigo
      rascunho.codigoExpira = expira
      await rascunho.save()
    } else {
      await User.create({
        nome: '', email, senha: 'pendente',
        verificado: false,
        codigoVerificacao: codigo,
        codigoExpira: expira,
      })
    }

    await enviarEmail(email, '', codigo, 'cadastro')
    res.json({ ok: true })
  } catch (err) {
    console.error('Erro enviar-codigo:', err.message)
    res.status(500).json({ erro: 'Erro ao enviar código' })
  }
})

// ── VERIFICAR CÓDIGO (cadastro e recuperação) ─────────
router.post('/verificar-codigo', async (req, res) => {
  try {
    const { email, codigo, tipo } = req.body
    const user = await User.findOne({ email })

    if (!user) return res.status(404).json({ erro: 'Email não encontrado' })
    if (!user.codigoVerificacao) return res.status(400).json({ erro: 'Nenhum código pendente. Solicite um novo.' })
    if (new Date() > user.codigoExpira) return res.status(400).json({ erro: 'Código expirado. Solicite um novo.' })
    if (user.codigoVerificacao !== String(codigo)) return res.status(400).json({ erro: 'Código incorreto' })

    // Limpa o código após validar
    user.codigoVerificacao = undefined
    user.codigoExpira = undefined
    await user.save()

    res.json({ ok: true })
  } catch (err) {
    console.error('Erro verificar-codigo:', err.message)
    res.status(500).json({ erro: 'Erro ao verificar código' })
  }
})

// ── CADASTRO (chamado após verificar código) ──────────
router.post('/cadastro', async (req, res) => {
  try {
    const { nome, email, senha, negocio, segmento, servicos } = req.body

    const userExistente = await User.findOne({ email, verificado: true })
    if (userExistente) return res.status(400).json({ erro: 'Email já cadastrado' })

    const senhaCriptografada = await bcrypt.hash(senha, 10)

    let user = await User.findOne({ email, verificado: false })
    if (user) {
      user.nome = nome
      user.senha = senhaCriptografada
      user.verificado = true
      await user.save()
    } else {
      user = await User.create({
        nome, email,
        senha: senhaCriptografada,
        verificado: true,
      })
    }

    const neg = await Negocio.create({
      userId: user._id,
      nome: negocio,
      segmento: segmento || 'Outro',
      servicos: servicos || [],
    })

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, nome: user.nome, negocio: neg.nome, negocioId: neg._id, userId: user._id })
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

    if (!user || user.senha === 'pendente') {
      return res.status(400).json({ erro: 'Email ou senha incorretos' })
    }

    const ok = await user.compararSenha(senha)
    if (!ok) return res.status(400).json({ erro: 'Email ou senha incorretos' })

    if (!user.verificado) {
      const codigo = gerarCodigo()
      user.codigoVerificacao = codigo
      user.codigoExpira = new Date(Date.now() + 15 * 60 * 1000)
      await user.save()
      await enviarEmail(email, user.nome, codigo, 'cadastro')
      return res.status(403).json({ erro: 'Confirme seu email antes de entrar. Reenviamos o código.' })
    }

    const negocios = await Negocio.find({ userId: user._id }).sort({ criadoEm: 1 })
    const negPrincipal = negocios[0]
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' })

    res.json({
      token,
      nome: user.nome,
      negocio: negPrincipal?.nome || '',
      negocioId: negPrincipal?._id || null,
      userId: user._id,
      negocios: negocios.map(n => ({ _id: n._id, nome: n.nome, segmento: n.segmento })),
    })
  } catch (err) {
    console.error('Erro no login:', err.message)
    res.status(500).json({ erro: 'Erro ao fazer login' })
  }
})

// ── RECUPERAR SENHA — envia código ───────────────────
router.post('/recuperar-senha', async (req, res) => {
  try {
    const { email } = req.body
    const user = await User.findOne({ email, verificado: true })
    if (user) {
      const codigo = gerarCodigo()
      user.codigoVerificacao = codigo
      user.codigoExpira = new Date(Date.now() + 15 * 60 * 1000)
      await user.save()
      await enviarEmail(email, user.nome, codigo, 'recuperacao')
    }
    // Responde ok mesmo se email não existe (não revela cadastros)
    res.json({ ok: true })
  } catch (err) {
    console.error('Erro recuperar-senha:', err.message)
    res.status(500).json({ erro: 'Erro ao enviar código' })
  }
})

// ── NOVA SENHA ────────────────────────────────────────
router.post('/nova-senha', async (req, res) => {
  try {
    const { email, senha } = req.body
    const user = await User.findOne({ email })
    if (!user) return res.status(404).json({ erro: 'Usuário não encontrado' })

    user.senha = await bcrypt.hash(senha, 10)
    user.codigoVerificacao = undefined
    user.codigoExpira = undefined
    await user.save()

    res.json({ ok: true })
  } catch (err) {
    console.error('Erro nova-senha:', err.message)
    res.status(500).json({ erro: 'Erro ao salvar senha' })
  }
})

// ── LISTAR NEGÓCIOS DO USUÁRIO ────────────────────────
router.get('/negocios', autenticar, async (req, res) => {
  try {
    const negocios = await Negocio.find({ userId: req.userId }).sort({ criadoEm: 1 })
    res.json(negocios)
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar negócios' })
  }
})

// ── CRIAR NOVO NEGÓCIO ────────────────────────────────
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
    const neg = await Negocio.create({ userId: req.userId, nome, segmento, servicos: servicos || [] })
    res.json(neg)
  } catch (err) {
    console.error('Erro ao criar negócio:', err.message)
    res.status(500).json({ erro: 'Erro ao criar negócio' })
  }
})

// ── EXCLUIR NEGÓCIO ───────────────────────────────────
router.delete('/negocios/:negocioId', autenticar, async (req, res) => {
  try {
    const neg = await Negocio.findOne({ _id: req.params.negocioId, userId: req.userId })
    if (!neg) return res.status(404).json({ erro: 'Negócio não encontrado' })
    const total = await Negocio.countDocuments({ userId: req.userId })
    if (total <= 1) return res.status(400).json({ erro: 'Você precisa ter ao menos 1 negócio' })
    await Negocio.deleteOne({ _id: neg._id })
    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao excluir negócio' })
  }
})

// ── BUSCAR NEGÓCIO PÚBLICO ────────────────────────────
router.get('/negocio/:id', async (req, res) => {
  try {
    let neg = await Negocio.findById(req.params.id)
    if (neg) {
      return res.json({
        negocio: neg.nome,
        segmento: neg.segmento,
        servicos: neg.servicos,
        horarios: neg.horarios,
        intervalo: neg.intervalo,
        pausas: neg.pausas || [],
        pagamentos: neg.pagamentos || {},
        bio: neg.bio,
        lembrete: neg.lembrete,
        intervalosServicos: neg.intervalosServicos || {},
      })
    }
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ erro: 'Negócio não encontrado' })
    const negUser = await Negocio.findOne({ userId: user._id })
    if (negUser) {
      return res.json({
        negocio: negUser.nome,
        segmento: negUser.segmento,
        servicos: negUser.servicos,
        horarios: negUser.horarios,
        intervalo: negUser.intervalo,
        bio: negUser.bio,
      })
    }
    res.status(404).json({ erro: 'Negócio não encontrado' })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar negócio' })
  }
})

// ── ATUALIZAR SERVIÇOS ────────────────────────────────
router.patch('/servicos', autenticar, async (req, res) => {
  try {
    const { negocioId, servicos } = req.body
    const neg = await Negocio.findOneAndUpdate(
      { _id: negocioId, userId: req.userId },
      { servicos },
      { new: true }
    )
    if (!neg) return res.status(404).json({ erro: 'Negócio não encontrado' })
    res.json({ servicos: neg.servicos })
  } catch {
    res.status(500).json({ erro: 'Erro ao atualizar serviços' })
  }
})

// ── ATUALIZAR HORÁRIOS ────────────────────────────────
router.patch('/horarios', autenticar, async (req, res) => {
  try {
    const { negocioId, horarios, intervalo, pausas, intervalosServicos } = req.body
    const update = { horarios, intervalo }
    if (pausas !== undefined) update.pausas = pausas
    if (intervalosServicos !== undefined) update.intervalosServicos = intervalosServicos
    await Negocio.findOneAndUpdate(
      { _id: negocioId, userId: req.userId },
      { $set: update }
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('Erro salvar horarios:', err.message)
    res.status(500).json({ erro: 'Erro ao salvar horários' })
  }
})

// ── ATUALIZAR PAGAMENTOS ──────────────────────────────
router.patch('/pagamentos', autenticar, async (req, res) => {
  try {
    const { negocioId, pagamentos } = req.body
    await Negocio.findOneAndUpdate(
      { _id: negocioId, userId: req.userId },
      { $set: { pagamentos } }
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('Erro salvar pagamentos:', err.message)
    res.status(500).json({ erro: 'Erro ao salvar configuração de pagamentos' })
  }
})

// ── ATUALIZAR BIO ─────────────────────────────────────
router.patch('/bio', autenticar, async (req, res) => {
  try {
    const { negocioId, ...bioData } = req.body
    await Negocio.findOneAndUpdate(
      { _id: negocioId, userId: req.userId },
      { $set: { bio: bioData } }
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('Erro salvar bio:', err.message)
    res.status(500).json({ erro: 'Erro ao salvar bio' })
  }
})

// ── ATUALIZAR NOME DO NEGÓCIO ─────────────────────────
router.patch('/negocios/:negocioId', autenticar, async (req, res) => {
  try {
    const { nome, segmento } = req.body
    const neg = await Negocio.findOneAndUpdate(
      { _id: req.params.negocioId, userId: req.userId },
      { nome, segmento },
      { new: true }
    )
    if (!neg) return res.status(404).json({ erro: 'Negócio não encontrado' })
    res.json(neg)
  } catch {
    res.status(500).json({ erro: 'Erro ao atualizar negócio' })
  }
})

// ── ATUALIZAR LEMBRETES ───────────────────────────────
router.patch('/lembretes', autenticar, async (req, res) => {
  try {
    const { negocioId, ativo, numero, mensagem } = req.body
    await Negocio.findOneAndUpdate(
      { _id: negocioId, userId: req.userId },
      { $set: { lembrete: { ativo, numero, mensagem } } }
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('Erro salvar lembrete:', err.message)
    res.status(500).json({ erro: 'Erro ao salvar configuração de lembretes' })
  }
})

module.exports = router