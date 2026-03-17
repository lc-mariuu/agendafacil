const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const userSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  senha: { type: String, required: true },
  negocio: { type: String, required: true },
  segmento: { type: String, default: 'Clínica' },
  servicos: { type: [String], default: ['Consulta', 'Retorno', 'Exame'] },
  intervalo: { type: Number, default: 30 },
  horarios: { type: mongoose.Schema.Types.Mixed, default: {} },
  bio: { type: mongoose.Schema.Types.Mixed, default: {} },
  plano: { type: String, default: 'trial' },
  trialExpira: { type: Date, default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
  stripeCustomerId: { type: String, default: '' },
  stripeSubscriptionId: { type: String, default: '' },
  assinaturaAtiva: { type: Boolean, default: false },
  criadoEm: { type: Date, default: Date.now }
})

userSchema.methods.compararSenha = async function(senha) {
  return bcrypt.compare(senha, this.senha)
}

userSchema.methods.temAcesso = function() {
  if (this.assinaturaAtiva) return true
  if (this.plano === 'trial' && new Date() < this.trialExpira) return true
  return false
}

User = require('./models/User') // ← ajuste para onde está o seu model

module.exports = mongoose.model('User', userSchema)