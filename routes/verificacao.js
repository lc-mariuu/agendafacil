// ============================================================
//  VERIFICAÇÃO DE EMAIL + RECUPERAÇÃO DE SENHA
//  Stack: Node.js + Express + MongoDB (Mongoose) + Resend
// ============================================================
//
//  INSTALAÇÃO:
//    npm install resend
//
//  VARIÁVEIS DE AMBIENTE (.env):
//    RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx
//    EMAIL_FROM=noreply@seudominio.com   ← domínio verificado no Resend
//                                           ou use onboarding@resend.dev para testes
//
//  PLANO GRATUITO RESEND:
//    ✅ 3.000 emails/mês
//    ✅ 100 emails/dia
//    ✅ Sem cartão de crédito
//    📖 resend.com → criar conta → API Keys → criar chave
//
// ============================================================

const express      = require('express')
const crypto       = require('crypto')
const { Resend }   = require('resend')
const router       = express.Router()
const mongoose     = require('mongoose')

// ------------------------------------------------------------
// 1. RESEND — envia para qualquer email se tiver domínio verificado
//             ou para GMAIL_USER (dono) se ainda em modo teste
// ------------------------------------------------------------
function getResend() {
  if (!process.env.RESEND_API_KEY) return null
  return new Resend(process.env.RESEND_API_KEY)
}

async function enviarEmail(destinatario, assunto, html) {
  const resend = getResend()
  if (!resend) {
    console.log(`\n📧 [EMAIL SIMULADO] Para: ${destinatario} | Assunto: ${assunto}\n`)
    return
  }

  // Se não tiver domínio verificado, manda pro email do dono e loga o destinatário real
  const temDominio = process.env.EMAIL_FROM && !process.env.EMAIL_FROM.includes('onboarding@resend.dev')
  const emailDestino = temDominio ? destinatario : (process.env.GMAIL_USER || destinatario)

  if (!temDominio) {
    console.log(`📧 [MODO TESTE] Código destinado a ${destinatario} enviado para ${emailDestino}`)
    assunto = `[PARA: ${destinatario}] ${assunto}`
  }

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
    to: emailDestino,
    subject: assunto,
    html
  })
  if (error) throw new Error(`Resend erro: ${JSON.stringify(error)}`)
}

// ------------------------------------------------------------
// 2. MODEL — CodigoVerificacao
// ------------------------------------------------------------
const codigoSchema = new mongoose.Schema({
  email:    { type: String, required: true },
  codigo:   { type: String, required: true },
  tipo:     { type: String, enum: ['cadastro', 'recuperacao'], default: 'cadastro' },
  criadoEm: { type: Date, default: Date.now, expires: 600 } // TTL: expira em 10 min
})

codigoSchema.index({ email: 1, tipo: 1 }, { unique: true })

const CodigoVerificacao = mongoose.models.CodigoVerificacao
  || mongoose.model('CodigoVerificacao', codigoSchema)

const User = require('../models/User')

// ------------------------------------------------------------
// 3. HELPER — gerar código numérico de 6 dígitos
// ------------------------------------------------------------
function gerarCodigo() {
  return String(crypto.randomInt(100000, 999999))
}

// ------------------------------------------------------------
// 4. HELPER — enviar email via Resend
// ------------------------------------------------------------
async function enviarEmail(destinatario, assunto, html) {
  const transporter = getTransporter()
  if (!transporter) {
    console.log(`\n📧 [EMAIL SIMULADO] Para: ${destinatario} | Assunto: ${assunto}\n`)
    return
  }
  await transporter.sendMail({
    from: `"AgendoRapido" <${process.env.GMAIL_USER}>`,
    to: destinatario,
    subject: assunto,
    html
  })
}

// ------------------------------------------------------------
// 5. TEMPLATES de email
// ------------------------------------------------------------
function templateCadastro(codigo) {
  return `
  <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f8fafc;border-radius:16px">
    <h1 style="color:#1e40af;font-size:22px;margin-bottom:4px">AgendoRapido!</h1>
    <p style="color:#64748b;font-size:13px;margin-bottom:24px">Confirme seu email para criar sua conta</p>
    <div style="background:white;border-radius:12px;padding:28px;text-align:center;border:1px solid #e2e8f0">
      <p style="color:#475569;font-size:14px;margin-bottom:12px">Seu código de verificação:</p>
      <div style="font-size:42px;font-weight:700;letter-spacing:12px;color:#1e40af;padding:8px 0">${codigo}</div>
      <p style="color:#94a3b8;font-size:12px;margin-top:16px">Válido por <strong>10 minutos</strong>. Não compartilhe com ninguém.</p>
    </div>
    <p style="color:#cbd5e1;font-size:11px;text-align:center;margin-top:20px">Se não foi você, ignore este email.</p>
  </div>`
}

function templateRecuperacao(codigo) {
  return `
  <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f8fafc;border-radius:16px">
    <h1 style="color:#1e40af;font-size:22px;margin-bottom:4px">AgendoRapido!</h1>
    <p style="color:#64748b;font-size:13px;margin-bottom:24px">Redefinição de senha solicitada</p>
    <div style="background:white;border-radius:12px;padding:28px;text-align:center;border:1px solid #e2e8f0">
      <p style="color:#475569;font-size:14px;margin-bottom:12px">Use este código para criar uma nova senha:</p>
      <div style="font-size:42px;font-weight:700;letter-spacing:12px;color:#1e40af;padding:8px 0">${codigo}</div>
      <p style="color:#94a3b8;font-size:12px;margin-top:16px">Válido por <strong>10 minutos</strong>.</p>
    </div>
    <p style="color:#cbd5e1;font-size:11px;text-align:center;margin-top:20px">Se não foi você, sua senha permanece a mesma.</p>
  </div>`
}

// ------------------------------------------------------------
// 6. POST /api/auth/enviar-codigo  (cadastro)
// ------------------------------------------------------------
router.post('/enviar-codigo', async (req, res) => {
  try {
    const { email } = req.body
    if (!email || !email.includes('@')) return res.status(400).json({ erro: 'Email inválido' })

    const codigo = gerarCodigo()
    await CodigoVerificacao.findOneAndUpdate(
      { email: email.toLowerCase(), tipo: 'cadastro' },
      { codigo, criadoEm: new Date() },
      { upsert: true, new: true }
    )
    await enviarEmail(email, '🔐 Seu código de verificação — AgendoRapido', templateCadastro(codigo))
    res.json({ ok: true })
  } catch (err) {
    console.error('[enviar-codigo]', err)
    res.status(500).json({ erro: 'Erro ao enviar email. Tente novamente.' })
  }
})

// ------------------------------------------------------------
// 7. POST /api/auth/verificar-codigo  (cadastro e recuperação)
// ------------------------------------------------------------
router.post('/verificar-codigo', async (req, res) => {
  try {
    const { email, codigo, tipo = 'cadastro' } = req.body
    const registro = await CodigoVerificacao.findOne({ email: email.toLowerCase(), tipo })

    if (!registro) return res.status(400).json({ erro: 'Código expirado. Solicite um novo.' })

    // Comparação segura contra timing attacks
    const esperado = Buffer.from(registro.codigo)
    const recebido = Buffer.from(String(codigo))
    const valido = esperado.length === recebido.length && crypto.timingSafeEqual(esperado, recebido)

    if (!valido) return res.status(400).json({ erro: 'Código incorreto. Verifique e tente novamente.' })

    await CodigoVerificacao.deleteOne({ _id: registro._id }) // uso único
    res.json({ ok: true })
  } catch (err) {
    console.error('[verificar-codigo]', err)
    res.status(500).json({ erro: 'Erro ao verificar código.' })
  }
})

// ------------------------------------------------------------
// 8. POST /api/auth/recuperar-senha
// ------------------------------------------------------------
router.post('/recuperar-senha', async (req, res) => {
  try {
    const { email } = req.body
    if (!email || !email.includes('@')) return res.status(400).json({ erro: 'Email inválido' })

    const usuario = await User.findOne({ email: email.toLowerCase() })
    if (!usuario) return res.status(400).json({ erro: 'Email não encontrado. Verifique se digitou corretamente.' })

    const codigo = gerarCodigo()
    await CodigoVerificacao.findOneAndUpdate(
      { email: email.toLowerCase(), tipo: 'recuperacao' },
      { codigo, criadoEm: new Date() },
      { upsert: true, new: true }
    )
    await enviarEmail(email, '🔑 Redefinição de senha — AgendoRapido', templateRecuperacao(codigo))
    res.json({ ok: true })
  } catch (err) {
    console.error('[recuperar-senha]', err)
    res.status(500).json({ erro: 'Erro ao enviar email de recuperação.' })
  }
})

// ------------------------------------------------------------
// 9. POST /api/auth/nova-senha
// ------------------------------------------------------------
router.post('/nova-senha', async (req, res) => {
  try {
    const { email, senha } = req.body
    if (!senha || senha.length < 6) return res.status(400).json({ erro: 'Senha deve ter ao menos 6 caracteres' })

    const bcrypt = require('bcryptjs')
    const hash = await bcrypt.hash(senha, 10)

    const resultado = await User.updateOne(
      { email: email.toLowerCase() },
      { $set: { senha: hash } }
    )

    if (resultado.matchedCount === 0) return res.status(400).json({ erro: 'Usuário não encontrado' })

    res.json({ ok: true })
  } catch (err) {
    console.error('[nova-senha]', err)
    res.status(500).json({ erro: 'Erro ao atualizar senha.' })
  }
})

module.exports = router