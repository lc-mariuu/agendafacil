const express   = require('express')
const jwt       = require('jsonwebtoken')
const bcrypt    = require('bcryptjs')
const crypto    = require('crypto')
const { Resend } = require('resend')
const User      = require('../models/User')
const Negocio   = require('../models/Negocio')
const mongoose  = require('mongoose')
const router    = express.Router()

// ── Resend ────────────────────────────────────────────────
const resend = new Resend(process.env.RESEND_API_KEY)

// ── Middlewares de autenticação e acesso ──────────────────
const { autenticar, verificarAcesso } = require('../middleware/acesso')

// ── Validação de email ────────────────────────────────────
function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// ── Gerador de código ─────────────────────────────────────
function gerarCodigo() {
  return String(crypto.randomInt(100000, 999999))
}

// ── Schema de verificação ─────────────────────────────────
const codigoSchema = new mongoose.Schema({
  email:      { type: String, required: true },
  codigo:     { type: String, required: true },
  tipo:       { type: String, enum: ['cadastro', 'recuperacao'], default: 'cadastro' },
  verificado: { type: Boolean, default: false },
  criadoEm:  { type: Date, default: Date.now, expires: 900 }
})
codigoSchema.index({ email: 1, tipo: 1 })

const CodigoVerificacao = mongoose.models.CodigoVerificacao
  || mongoose.model('CodigoVerificacao', codigoSchema)

// ── Template de email ─────────────────────────────────────
function templateEmail(nome, codigo, tipo) {
  const descricao = tipo === 'recuperacao'
    ? 'Use o código abaixo para criar uma nova senha:'
    : 'Use o código abaixo para confirmar seu email:'
  return {
    assunto: tipo === 'recuperacao'
      ? `${codigo} — código para redefinir sua senha`
      : `${codigo} — confirme seu email no AgendoRapido`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0d0f12">
        <div style="font-size:20px;font-weight:800;margin-bottom:24px">
          Agendo<span style="color:#2563eb">Rapido</span>
        </div>
        <p style="color:#5a6072;font-size:15px;margin:0 0 8px">Olá${nome ? ', ' + nome : ''}!</p>
        <p style="color:#5a6072;font-size:15px;margin:0 0 24px">${descricao}</p>
        <div style="background:#f6f7f9;border:1px solid #e2e8f0;border-radius:12px;padding:28px;text-align:center;margin-bottom:24px">
          <div style="font-size:42px;font-weight:800;letter-spacing:10px;color:#0d0f12">${codigo}</div>
          <div style="color:#9ba4b4;font-size:13px;margin-top:10px">Expira em 15 minutos</div>
        </div>
        <p style="color:#9ba4b4;font-size:12px;margin:0">
          Se você não solicitou isso, pode ignorar este email.
        </p>
      </div>
    `
  }
}

// ── Envio de email ────────────────────────────────────────
async function enviarEmail(email, nome, codigo, tipo) {
  const { assunto, html } = templateEmail(nome, codigo, tipo)
  const { error } = await resend.emails.send({
    from:    'AgendoRapido <noreply@agendorapido.com.br>',
    to:      email,
    subject: assunto,
    html,
  })
  if (error) throw new Error(`Resend erro: ${JSON.stringify(error)}`)
}

// ── Salvar código ─────────────────────────────────────────
async function salvarCodigo(email, tipo, codigo) {
  await CodigoVerificacao.deleteMany({ email: email.toLowerCase(), tipo })
  await CodigoVerificacao.create({ email: email.toLowerCase(), tipo, codigo, verificado: false, criadoEm: new Date() })
}

// ══════════════════════════════════════════════════════════
// ROTAS PÚBLICAS (sem autenticação)
// ══════════════════════════════════════════════════════════

// ── HEALTH CHECK ──────────────────────────────────────────
router.get('/health', (req, res) => {
  res.json({ ok: true, ts: Date.now() })
})

// ── ENVIAR CÓDIGO ─────────────────────────────────────────
router.post('/enviar-codigo', async (req, res) => {
  try {
    const { email } = req.body
    if (!email || !emailValido(email)) return res.status(400).json({ erro: 'Email inválido' })

    const userVerificado = await User.findOne({ email: email.toLowerCase(), verificado: true })
    if (userVerificado) return res.status(400).json({ erro: 'Email já cadastrado' })

    await User.deleteOne({ email: email.toLowerCase(), verificado: false })

    const codigo = gerarCodigo()
    await salvarCodigo(email, 'cadastro', codigo)
    await enviarEmail(email, '', codigo, 'cadastro')

    res.json({ ok: true })
  } catch (err) {
    console.error('Erro enviar-codigo:', err.message)
    res.status(500).json({ erro: 'Erro ao enviar código. Tente novamente.' })
  }
})

// ── VERIFICAR CÓDIGO ──────────────────────────────────────
router.post('/verificar-codigo', async (req, res) => {
  try {
    const { email, codigo, tipo = 'cadastro' } = req.body
    if (!email || !emailValido(email)) return res.status(400).json({ erro: 'Email inválido' })

    const registro = await CodigoVerificacao.findOne({ email: email.toLowerCase(), tipo }, {}, { sort: { criadoEm: -1 } })
    if (!registro) return res.status(400).json({ erro: 'Código expirado. Solicite um novo.' })

    const esperado = Buffer.from(registro.codigo)
    const recebido = Buffer.from(String(codigo).trim())
    const valido   = esperado.length === recebido.length && crypto.timingSafeEqual(esperado, recebido)

    if (!valido) return res.status(400).json({ erro: 'Código incorreto. Verifique e tente novamente.' })

    if (tipo === 'cadastro') {
      await CodigoVerificacao.deleteMany({ email: email.toLowerCase(), tipo: 'cadastro' })
    } else {
      await CodigoVerificacao.updateOne({ _id: registro._id }, { $set: { verificado: true } })
    }

    res.json({ ok: true })
  } catch (err) {
    console.error('Erro verificar-codigo:', err.message)
    res.status(500).json({ erro: 'Erro ao verificar código.' })
  }
})

// ── CADASTRO ──────────────────────────────────────────────
router.post('/cadastro', async (req, res) => {
  try {
    const { nome, email, senha, negocio, segmento, servicos } = req.body
    if (!nome || !email || !senha) return res.status(400).json({ erro: 'Dados incompletos' })

    const userVerificado = await User.findOne({ email: email.toLowerCase(), verificado: true })
    if (userVerificado) return res.status(400).json({ erro: 'Email já cadastrado' })

    let user = await User.findOne({ email: email.toLowerCase(), verificado: false })
    if (user) {
      user.nome = nome; user.senha = senha; user.verificado = true
      await user.save()
    } else {
      user = await User.create({ nome, email: email.toLowerCase(), senha, verificado: true })
    }

    const neg = await Negocio.create({ userId: user._id, nome: negocio, segmento: segmento || 'Outro', servicos: servicos || [] })
    const token = jwt.sign({ id: user._id, role: user.role || 'user' }, process.env.JWT_SECRET, { expiresIn: '7d' })

    res.json({ token, nome: user.nome, negocio: neg.nome, negocioId: neg._id, userId: user._id })
  } catch (err) {
    console.error('Erro no cadastro:', err.message)
    res.status(500).json({ erro: 'Erro ao cadastrar' })
  }
})

// ── LOGIN ─────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body
    if (!email || !senha) return res.status(400).json({ erro: 'Preencha email e senha' })

    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user || user.senha === 'pendente') return res.status(400).json({ erro: 'Email ou senha incorretos' })

    const senhaCorreta = await user.compararSenha(senha)
    if (!senhaCorreta) return res.status(400).json({ erro: 'Email ou senha incorretos' })

    if (!user.verificado) { user.verificado = true; await user.save() }

    const negocios     = await Negocio.find({ userId: user._id }).sort({ criadoEm: 1 })
    const negPrincipal = negocios[0]
    const token        = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' })

    res.json({
      token,
      nome:      user.nome,
      negocio:   negPrincipal?.nome   || '',
      negocioId: negPrincipal?._id    || null,
      userId:    user._id,
      negocios:  negocios.map(n => ({ _id: n._id, nome: n.nome, segmento: n.segmento })),
    })
  } catch (err) {
    console.error('Erro no login:', err.message)
    res.status(500).json({ erro: 'Erro ao fazer login' })
  }
})

// ── RECUPERAR SENHA ───────────────────────────────────────
router.post('/recuperar-senha', async (req, res) => {
  try {
    const { email } = req.body
    if (!email || !emailValido(email)) return res.status(400).json({ erro: 'Email inválido' })

    const user = await User.findOne({ email: email.toLowerCase() })
    if (user && user.senha !== 'pendente') {
      const codigo = gerarCodigo()
      await salvarCodigo(email, 'recuperacao', codigo)
      await enviarEmail(user.email, user.nome, codigo, 'recuperacao')
    }
    res.json({ ok: true })
  } catch (err) {
    console.error('Erro recuperar-senha:', err.message)
    res.status(500).json({ erro: 'Erro ao enviar código' })
  }
})

// ── NOVA SENHA ────────────────────────────────────────────
router.post('/nova-senha', async (req, res) => {
  try {
    const { email, senha } = req.body
    if (!email || !emailValido(email)) return res.status(400).json({ erro: 'Email inválido' })
    if (!senha || senha.length < 6) return res.status(400).json({ erro: 'Senha deve ter ao menos 6 caracteres' })

    const registro = await CodigoVerificacao.findOne({ email: email.toLowerCase(), tipo: 'recuperacao', verificado: true })
    if (!registro) return res.status(403).json({ erro: 'Verificação não concluída. Solicite um novo código.' })

    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user) return res.status(404).json({ erro: 'Usuário não encontrado' })

    user.senha = senha; user.verificado = true
    await user.save()
    await CodigoVerificacao.deleteMany({ email: email.toLowerCase(), tipo: 'recuperacao' })
    res.json({ ok: true })
  } catch (err) {
    console.error('Erro nova-senha:', err.message)
    res.status(500).json({ erro: 'Erro ao salvar senha' })
  }
})

// ── GET negócio por ID (público — página de agendamento) ──
router.get('/negocio/:id', async (req, res) => {
  try {
    let neg = await Negocio.findById(req.params.id)
    if (neg) {
      return res.json({
        negocio:            neg.nome,
        segmento:           neg.segmento,
        servicos:           neg.servicos,
        horarios:           neg.horarios,
        intervalo:          neg.intervalo,
        pausas:             neg.pausas || [],
        pagamentos:         neg.pagamentos || {},
        bio:                neg.bio,
        lembrete:           neg.lembrete,
        lembrete1h:         neg.lembrete1h,
        posAtendimento:     neg.posAtendimento,
        intervalosServicos: neg.intervalosServicos || {},
      })
    }
    const User2 = require('../models/User')
    const user  = await User2.findById(req.params.id)
    if (!user) return res.status(404).json({ erro: 'Negócio não encontrado' })
    const negUser = await Negocio.findOne({ userId: user._id })
    if (negUser) {
      return res.json({
        negocio:        negUser.nome,
        segmento:       negUser.segmento,
        servicos:       negUser.servicos,
        horarios:       negUser.horarios,
        intervalo:      negUser.intervalo,
        bio:            negUser.bio,
        lembrete:       negUser.lembrete,
        lembrete1h:     negUser.lembrete1h,
        posAtendimento: negUser.posAtendimento,
      })
    }
    res.status(404).json({ erro: 'Negócio não encontrado' })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar negócio' })
  }
})

// ── GET negócio por slug (público) ───────────────────────
router.get('/negocio/por-slug/:slug', async (req, res) => {
  try {
    const negocio = await Negocio.findOne({ slug: req.params.slug })
    if (!negocio) return res.status(404).json({ erro: 'Negócio não encontrado' })
    res.json(negocio)
  } catch (e) {
    res.status(500).json({ erro: e.message })
  }
})

// ══════════════════════════════════════════════════════════
// ROTAS PROTEGIDAS (precisam de login + acesso ativo)
// ══════════════════════════════════════════════════════════

// ── LISTAR negócios do usuário ────────────────────────────
router.get('/negocios', autenticar, async (req, res) => {
  try {
    const negocios = await Negocio.find({ userId: req.userId }).sort({ criadoEm: 1 })
    res.json(negocios)
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar negócios' })
  }
})

// ── CRIAR novo negócio (exige assinatura ativa) ───────────
router.post('/negocios', autenticar, verificarAcesso, async (req, res) => {
  try {
    const user   = await User.findById(req.userId)
    const limite = user.limiteNegocios()
    const total  = await Negocio.countDocuments({ userId: req.userId })

    if (total >= limite) {
      return res.status(403).json({
        erro: limite === 1
          ? 'Faça upgrade para o plano Profissional para criar mais painéis'
          : 'Limite de 3 painéis atingido no plano Profissional'
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

// ── EXCLUIR negócio ───────────────────────────────────────
router.delete('/negocios/:negocioId', autenticar, verificarAcesso, async (req, res) => {
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

// ── ATUALIZAR nome/segmento do negócio ────────────────────
router.patch('/negocios/:negocioId', autenticar, verificarAcesso, async (req, res) => {
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

// ── ATUALIZAR serviços ────────────────────────────────────
router.patch('/servicos', autenticar, verificarAcesso, async (req, res) => {
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

// ── ATUALIZAR horários ────────────────────────────────────
router.patch('/horarios', autenticar, verificarAcesso, async (req, res) => {
  try {
    const { negocioId, horarios, intervalo, pausas, intervalosServicos } = req.body
    const update = { horarios, intervalo }
    if (pausas             !== undefined) update.pausas             = pausas
    if (intervalosServicos !== undefined) update.intervalosServicos = intervalosServicos
    await Negocio.findOneAndUpdate({ _id: negocioId, userId: req.userId }, { $set: update })
    res.json({ ok: true })
  } catch (err) {
    console.error('Erro salvar horarios:', err.message)
    res.status(500).json({ erro: 'Erro ao salvar horários' })
  }
})

// ── ATUALIZAR pagamentos ──────────────────────────────────
router.patch('/pagamentos', autenticar, verificarAcesso, async (req, res) => {
  try {
    const { negocioId, pagamentos } = req.body
    await Negocio.findOneAndUpdate({ _id: negocioId, userId: req.userId }, { $set: { pagamentos } })
    res.json({ ok: true })
  } catch (err) {
    console.error('Erro salvar pagamentos:', err.message)
    res.status(500).json({ erro: 'Erro ao salvar configuração de pagamentos' })
  }
})

// ── ATUALIZAR bio ─────────────────────────────────────────
router.patch('/bio', autenticar, verificarAcesso, async (req, res) => {
  try {
    const { negocioId, ...bioData } = req.body
    await Negocio.findOneAndUpdate({ _id: negocioId, userId: req.userId }, { $set: { bio: bioData } })
    res.json({ ok: true })
  } catch (err) {
    console.error('Erro salvar bio:', err.message)
    res.status(500).json({ erro: 'Erro ao salvar bio' })
  }
})

// ── ATUALIZAR lembretes ───────────────────────────────────
router.patch('/lembretes', autenticar, verificarAcesso, async (req, res) => {
  try {
    const { negocioId, campo, ativo, mensagem } = req.body

    const camposPermitidos = {
      'lembrete':       'lembrete',
      'lembrete1h':     'lembrete1h',
      'posAtendimento': 'posAtendimento',
    }

    if (campo && camposPermitidos[campo]) {
      const chave  = camposPermitidos[campo]
      const update = {}
      update[`${chave}.ativo`] = !!ativo
      if (mensagem !== undefined) update[`${chave}.mensagem`] = mensagem

      const neg = await Negocio.findOneAndUpdate(
        { _id: negocioId, userId: req.userId },
        { $set: update },
        { new: true }
      )
      if (!neg) return res.status(404).json({ erro: 'Negócio não encontrado' })
      return res.json({ ok: true, campo, ativo: !!ativo })
    }

    // Fallback formato legado
    const neg = await Negocio.findOneAndUpdate(
      { _id: negocioId, userId: req.userId },
      { $set: { 'lembrete.ativo': !!ativo, ...(mensagem !== undefined ? { 'lembrete.mensagem': mensagem } : {}) } },
      { new: true }
    )
    if (!neg) return res.status(404).json({ erro: 'Negócio não encontrado' })
    return res.json({ ok: true })
  } catch (err) {
    console.error('ERRO lembretes PATCH:', err.message)
    res.status(500).json({ erro: 'Erro ao salvar lembrete' })
  }
})

module.exports = router