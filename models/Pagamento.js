// models/Pagamento.js
const mongoose = require('mongoose')

const PagamentoSchema = new mongoose.Schema({
  negocioId:             { type: mongoose.Schema.Types.ObjectId, ref: 'Negocio',      required: true, index: true },
  agendamentoId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment',  required: true, index: true },

  // Valores em CENTAVOS para evitar erros de float
  valorBrutoCentavos:    { type: Number, required: true },
  taxaSaasCentavos:      { type: Number, default: 50 },
  taxaMPCentavos:        { type: Number, default: 0  },
  totalTaxasCentavos:    { type: Number, default: 0  },
  valorLiquidoCentavos:  { type: Number, default: 0  },

  // IDs externos
  mpPaymentId:           { type: String, default: '' },
  mpStatus:              { type: String, default: '' },

  status: {
    type:    String,
    enum:    ['pendente', 'processado', 'reembolsado', 'falhou'],
    default: 'pendente',
  },
}, {
  timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' }
})

PagamentoSchema.index({ negocioId: 1, criadoEm: -1 })
PagamentoSchema.index({ mpPaymentId: 1 })

module.exports = mongoose.model('Pagamento', PagamentoSchema)