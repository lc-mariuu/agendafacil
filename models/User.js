const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const userSchema = new mongoose.Schema({
  plano:                 { type: String, default: 'trial' },       // 'trial' | 'basico' | 'profissional'
assinaturaAtiva:       { type: Boolean, default: false },         // true quando MP confirma pagamento
assinaturaVencimento:  { type: Date, default: null },             // data do próximo vencimento
mp_preapproval_id:     { type: String, default: null },           // ID da assinatura no Mercado Pago
mp_plano:              { type: String, default: null },           // qual plano escolheu ('basico'|'profissional')
mp_status:             { type: String, default: null },           // status do MP: authorized|paused|cancelled
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