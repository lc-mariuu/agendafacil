const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const diaSchema = new mongoose.Schema({
  ativo: { type: Boolean, default: false },
  inicio: { type: String, default: '08:00' },
  fim: { type: String, default: '18:00' }
}, { _id: false })

const userSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  senha: { type: String, required: true },
  negocio: { type: String, required: true },
  segmento: { type: String, default: 'Clínica' },
  servicos: { type: [String], default: ['Consulta', 'Retorno', 'Exame'] },
  intervalo: { type: Number, default: 30 },
  horarios: {
    0: { type: diaSchema, default: () => ({}) },
    1: { type: diaSchema, default: () => ({}) },
    2: { type: diaSchema, default: () => ({}) },
    3: { type: diaSchema, default: () => ({}) },
    4: { type: diaSchema, default: () => ({}) },
    5: { type: diaSchema, default: () => ({}) },
    6: { type: diaSchema, default: () => ({}) }
  },
  criadoEm: { type: Date, default: Date.now }
})

userSchema.methods.compararSenha = async function(senha) {
  return bcrypt.compare(senha, this.senha)
}

module.exports = mongoose.model('User', userSchema)