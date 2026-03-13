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
  criadoEm: { type: Date, default: Date.now }
})

userSchema.methods.compararSenha = async function(senha) {
  return bcrypt.compare(senha, this.senha)
}

module.exports = mongoose.model('User', userSchema)