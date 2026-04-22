// models/Pagamento.js
// Registra cada transação de pagamento antecipado
// incluindo as taxas descontadas (SaaS + Mercado Pago)

const mongoose = require('mongoose')

const PagamentoSchema = new mongoose.Schema({
  negocioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Negocio',
    required: true,
    index: true,
  },
  agendamentoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true,
    index: true,
  },

  // Valores em CENTAVOS para evitar erros de float
  valorBrutoCentavos:      { type: Number, required: true },   // valor cobrado do cliente
  taxaSaasCentavos:        { type: Number, default: 50 },       // R$ 0,50 fixo → sua receita
  taxaMPCentavos:          { type: Number, default: 0 },        // 0,99% do Mercado Pago
  totalTaxasCentavos:      { type: Number, default: 0 },        // taxaSaas + taxaMP
  valorLiquidoCentavos:    { type: Number, default: 0 },        // valor que o usuário recebe

  // Identificadores externos
  mpPaymentId:   { type: String, default: '' },   // ID do pagamento no Mercado Pago
  mpStatus:      { type: String, default: '' },   // approved | rejected | pending

  // Status interno
  status: {
    type: String,
    enum: ['pendente', 'processado', 'reembolsado', 'falhou'],
    default: 'pendente',
  },

  criadoEm:      { type: Date, default: Date.now },
  atualizadoEm:  { type: Date, default: Date.now },
}, {
  timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' }
})

// Índices para relatórios rápidos
PagamentoSchema.index({ negocioId: 1, criadoEm: -1 })
PagamentoSchema.index({ mpPaymentId: 1 })

module.exports = mongoose.model('Pagamento', PagamentoSchema)