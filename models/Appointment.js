const mongoose = require('mongoose')

const appointmentSchema = new mongoose.Schema({
  clinicaId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pacienteNome: { type: String, required: true },
  pacienteTelefone: { type: String, default: '' },
  servico: { type: String, required: true },
  data: { type: String, required: true },
  hora: { type: String, required: true },
  status: { type: String, default: 'confirmado', enum: ['confirmado', 'cancelado', 'concluido'] },
  criadoEm: { type: Date, default: Date.now }
})

module.exports = mongoose.model('Appointment', appointmentSchema)