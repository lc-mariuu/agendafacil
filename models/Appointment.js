const mongoose = require('mongoose')

const appointmentSchema = new mongoose.Schema({
  clinicaId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pacienteNome: { type: String, required: true },
  pacienteTelefone: { type: String, default: '' },
  servico: { type: String, required: true },
  preco: { type: Number, default: 0 },
  data: { type: String, required: true },
  hora: { type: String, required: true },
  status: {
    type: String,
    default: 'confirmado',
    // ✅ aguardando_pagamento adicionado
    enum: ['confirmado', 'cancelado', 'concluido', 'aguardando_pagamento']
  },
  pagamento: {
    status: { type: String, enum: ['pendente', 'pago', 'reembolsado', 'rejeitado'], default: 'pendente' },
    valor: { type: Number, default: 0 },
    paymentIntentId: { type: String, default: '' }
  },
  criadoEm: { type: Date, default: Date.now },
  atualizadoEm: { type: Date, default: Date.now }
})

module.exports = mongoose.model('Appointment', appointmentSchema)