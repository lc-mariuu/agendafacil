// models/Pagamento.js
const mongoose = require('mongoose')

const PagamentoSchema = new mongoose.Schema({
  negocioId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Negocio', required: true },
  agendamentoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
  pixId:         { type: String },   // ID da cobrança no AbacatePay
  status:        { type: String, enum: ['pendente', 'aprovado', 'expirado', 'cancelado', 'reembolsado'], default: 'pendente' },
  valor:         { type: Number, required: true },
  qrCode:        { type: String },   // texto copia-e-cola (brCode)
  qrCodeImage:   { type: String },   // base64 da imagem QR
  expiresAt:     { type: Date },
  paidAt:        { type: Date },
  criadoEm:      { type: Date, default: Date.now },
})

module.exports = mongoose.model('Pagamento', PagamentoSchema)