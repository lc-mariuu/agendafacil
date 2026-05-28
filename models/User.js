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
    default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  },

  // ── Plano e assinatura ───────────────────────────────────
  plano:                { type: String, default: 'trial' },
  assinaturaAtiva:      { type: Boolean, default: false },
  assinaturaVencimento: { type: Date,    default: null },

  // ── Mercado Pago ─────────────────────────────────────────
  mp_preapproval_id: { type: String, default: null },
  mp_plano:          { type: String, default: null },
  mp_status:         { type: String, default: null },

  // ✅ NOVO: role para super-admin
  role: { type: String, enum: ['user', 'admin'], default: 'user' },

}, { timestamps: true })

userSchema.pre('save', async function () {
  if (!this.isModified('senha')) return
  this.senha = await bcrypt.hash(this.senha, 10)
})

userSchema.methods.compararSenha = function (senha) {
  return bcrypt.compare(senha, this.senha)
}

userSchema.methods.temAcesso = function () {
  if (this.role === 'admin') return true
  if (this.assinaturaAtiva) return true
  if (this.plano === 'trial' && new Date() < this.trialExpira) return true
  return false
}

userSchema.methods.limiteNegocios = function () {
  if (this.role === 'admin') return 999
  if (this.plano === 'profissional' && this.assinaturaAtiva) return 3
  if (this.plano === 'pro'          && this.assinaturaAtiva) return 3
  return 1
}

userSchema.methods.diasRestantesTrial = function () {
  if (this.plano !== 'trial' || !this.trialExpira) return 0
  return Math.max(0, Math.ceil((new Date(this.trialExpira) - new Date()) / 86400000))
}

module.exports = mongoose.model('User', userSchema)
