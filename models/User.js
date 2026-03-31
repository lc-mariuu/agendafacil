const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const userSchema = new mongoose.Schema({
  nome:  { type: String, required: true },
  email: { type: String, required: true, unique: true },
  senha: { type: String, required: true },

  plano:        { type: String, default: 'trial' },   // 'trial' | 'basico' | 'pro' | 'inativo'
  trialExpira:  { type: Date, default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },

  // ── AbacatePay ──────────────────────────────────────────────
  abacateCustomerId:     { type: String, default: '' },
  abacateSubscriptionId: { type: String, default: '' },

  assinaturaAtiva:     { type: Boolean, default: false },
  assinaturaCancelando: { type: Boolean, default: false },

  criadoEm: { type: Date, default: Date.now },
})

userSchema.methods.compararSenha = async function (senha) {
  return bcrypt.compare(senha, this.senha)
}

userSchema.methods.temAcesso = function () {
  if (this.assinaturaAtiva) return true
  if (this.plano === 'trial' && new Date() < this.trialExpira) return true
  return false
}

userSchema.methods.limiteNegocios = function () {
  if (this.plano === 'pro' && this.assinaturaAtiva) return 3
  return 1
}

module.exports = mongoose.model('User', userSchema)