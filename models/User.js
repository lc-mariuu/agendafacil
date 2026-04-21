/**
 * models/User.js
 */

const mongoose = require('mongoose')
const bcrypt   = require('bcryptjs')

const userSchema = new mongoose.Schema({
  // ── Identidade ───────────────────────────────────────────
  nome:  { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  senha: { type: String, required: true },

  // ── Verificação ──────────────────────────────────────────
  verificado: { type: Boolean, default: false },

  // ── Trial ────────────────────────────────────────────────
  trialExpira: {
    type:    Date,
    default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 dias
  },

  // ── Plano e assinatura ───────────────────────────────────
  plano:                { type: String, default: 'trial' }, // 'trial' | 'basico' | 'profissional' | 'inativo'
  assinaturaAtiva:      { type: Boolean, default: false },
  assinaturaVencimento: { type: Date,    default: null },

  // ── Mercado Pago ─────────────────────────────────────────
  mp_preapproval_id: { type: String, default: null },
  mp_plano:          { type: String, default: null },
  mp_status:         { type: String, default: null },

}, { timestamps: true })

/* ─────────────────────────────────────────────────────
   HASH DA SENHA antes de salvar
   CORRIGIDO: removido parâmetro "next" — em hooks async
   o Mongoose moderno aguarda a Promise, não usa callback
───────────────────────────────────────────────────── */
userSchema.pre('save', async function () {
  if (!this.isModified('senha')) return
  this.senha = await bcrypt.hash(this.senha, 10)
})

/* ─────────────────────────────────────────────────────
   MÉTODOS
───────────────────────────────────────────────────── */
userSchema.methods.compararSenha = function (senha) {
  return bcrypt.compare(senha, this.senha)
}

// Retorna true se o usuário pode usar o sistema
userSchema.methods.temAcesso = function () {
  if (this.assinaturaAtiva) return true
  if (this.plano === 'trial' && new Date() < this.trialExpira) return true
  return false
}

// Número máximo de negócios/painéis
userSchema.methods.limiteNegocios = function () {
  if (this.plano === 'profissional' && this.assinaturaAtiva) return 3
  if (this.plano === 'pro'          && this.assinaturaAtiva) return 3
  return 1
}

// Dias restantes no trial (retorna 0 se não estiver em trial)
userSchema.methods.diasRestantesTrial = function () {
  if (this.plano !== 'trial' || !this.trialExpira) return 0
  return Math.max(0, Math.ceil((new Date(this.trialExpira) - new Date()) / 86400000))
}

module.exports = mongoose.model('User', userSchema)