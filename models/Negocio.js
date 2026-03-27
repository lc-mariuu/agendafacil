const mongoose = require('mongoose')

const negocioSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  nome: { type: String, required: true },
  segmento: { type: String, default: 'Outro' },
  servicos: {
    type: mongoose.Schema.Types.Mixed,
    default: []
  },
  pagamentos: { type: mongoose.Schema.Types.Mixed, default: {} },
  intervalo: { type: Number, default: 30 },
  horarios: { type: mongoose.Schema.Types.Mixed, default: {} },
  pausas: { type: [{ inicio: String, fim: String, label: String }], default: [] },
  bio: { type: mongoose.Schema.Types.Mixed, default: {} },
  lembrete: {
    ativo: { type: Boolean, default: false },
    numero: { type: String, default: '' },
    mensagem: { type: String, default: '' }
  },
  criadoEm: { type: Date, default: Date.now }
})

module.exports = mongoose.model('Negocio', negocioSchema)