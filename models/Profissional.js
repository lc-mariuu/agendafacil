const mongoose = require('mongoose')

const ProfissionalSchema = new mongoose.Schema({
  negocioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Negocio',
    required: true,
    index: true,
  },

  // Identificação
  nome:  { type: String, required: true, trim: true },
  role:  { type: String, default: '' },                 // 'Barbeiro', 'Cabeleireira', etc
  email: { type: String, default: '', lowercase: true },
  telefone: { type: String, default: '' },
  foto:  { type: String, default: '' },                 // URL

  // Visual
  cor:   { type: String, default: '#2563eb' },          // Cor no calendário

  // Comissão
  comissao: {
    type:   { type: String, enum: ['percentual', 'fixo'], default: 'percentual' },
    valor:  { type: Number, default: 50 },              // 50% se percentual, R$X se fixo
  },

  // Serviços que ele atende (referência aos nomes dos serviços do Negocio)
  servicos: { type: [String], default: [] },             // ['Corte', 'Barba']

  // Horários específicos (override do horário geral do negócio)
  horariosCustom: { type: Boolean, default: false },
  horarios: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Estado
  ativo: { type: Boolean, default: true },

  criadoEm:     { type: Date, default: Date.now },
  atualizadoEm: { type: Date, default: Date.now },
})

ProfissionalSchema.pre('save', function (next) {
  this.atualizadoEm = new Date()
  next()
})

module.exports = mongoose.models.Profissional || mongoose.model('Profissional', ProfissionalSchema)
