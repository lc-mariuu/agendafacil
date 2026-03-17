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

const express    = require('express')
const crypto     = require('crypto')
const { Resend } = require('resend')
const router     = express.Router()
const mongoose   = require('mongoose')

// ------------------------------------------------------------
// 1. RESEND — cliente de email
// ------------------------------------------------------------
const resend = new Resend(process.env.RESEND_API_KEY)

const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev'
// Em testes: onboarding@resend.dev só envia para o email da sua conta Resend
// Em produção: use um domínio verificado, ex: noreply@seudominio.com

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

// Importe seu model de User — ajuste o caminho
let User
try { User = require('./models/User') } catch (e) {
  console.warn('[verificacao.js] ⚠️  Ajuste o caminho do seu model User')
}

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
  if (!process.env.RESEND_API_KEY) {
    // Sem chave: imprime no console para testes locais
    console.log(`\n📧 [RESEND SIMULADO] Para: ${destinatario} | Assunto: ${assunto}\n${html.replace(/<[^>]+>/g, '')}\n`)
    return
  }
  const { error } = await resend.emails.send({ from: EMAIL_FROM, to: destinatario, subject: assunto, html })
  if (error) throw new Error(`Resend erro: ${JSON.stringify(error)}`)
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

    const usuario = await User.findOne({ email: email.toLowerCase() })
    if (!usuario) return res.status(400).json({ erro: 'Usuário não encontrado' })

    // Com bcrypt (recomendado): usuario.senha = await require('bcrypt').hash(senha, 10)
    usuario.senha = senha
    await usuario.save()
    res.json({ ok: true })
  } catch (err) {
    console.error('[nova-senha]', err)
    res.status(500).json({ erro: 'Erro ao atualizar senha.' })
  }
})

module.exports = router