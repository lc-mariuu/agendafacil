const mongoose = require('mongoose')

const clientSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  telefone: { type: String, required: true },
  email: { type: String },
  clinicaId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  criadoEm: { type: Date, default: Date.now }
})

module.exports = mongoose.model('Client', clientSchema)