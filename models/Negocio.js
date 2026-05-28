const mongoose = require('mongoose')

const ServicoSchema = new mongoose.Schema({
  nome:    { type: String, required: true },
  preco:   { type: Number, default: 0 },
  desc:    { type: String, default: '' },
  duracao: { type: Number, default: 0 },
}, { _id: false })

// ✅ NOVO: bloqueios pontuais (feriados, folgas, treinamentos)
const BloqueioSchema = new mongoose.Schema({
  data:    { type: String, required: true },          // 'YYYY-MM-DD'
  label:   { type: String, default: 'Indisponível' }, // 'Feriado', 'Treinamento'
  allDay:  { type: Boolean, default: true },
  startH:  { type: String, default: '' },              // 'HH:MM' (se !allDay)
  endH:    { type: String, default: '' },              // 'HH:MM' (se !allDay)
  cor:     { type: String, default: '#dc2626' },
})

const NegocioSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  nome:     { type: String, required: true },
  segmento: { type: String, default: 'Outro' },

  servicos:           { type: [ServicoSchema], default: [] },
  horarios:           { type: mongoose.Schema.Types.Mixed, default: {} },
  intervalo:          { type: Number, default: 30 },
  pausas:             { type: [mongoose.Schema.Types.Mixed], default: [] },
  intervalosServicos: { type: mongoose.Schema.Types.Mixed, default: {} },

  // ✅ NOVO: bloqueios pontuais
  bloqueios: { type: [BloqueioSchema], default: [] },

  bio: {
    foto:      { type: String, default: '' },
    descricao: { type: String, default: '' },
    endereco:  { type: String, default: '' },
    instagram: { type: String, default: '' },
    whatsapp:  { type: String, default: '' },
  },

  lembrete: {
    ativo:    { type: Boolean, default: true },
    mensagem: { type: String,  default: '' },
  },
  lembrete1h: {
    ativo:    { type: Boolean, default: true },
    mensagem: { type: String,  default: '' },
  },
  posAtendimento: {
    ativo:    { type: Boolean, default: false },
    mensagem: { type: String,  default: '' },
  },

  pixConfig: {
    chavePix:  { type: String, default: '' },
    tipoPix:   { type: String, default: 'cpf' },
    servicos:  { type: mongoose.Schema.Types.Mixed, default: {} },
    updatedAt: { type: Date },
  },

  pagamentos: { type: mongoose.Schema.Types.Mixed, default: {} },

  pagamentosConfig: {
    adiantado:        { type: Boolean, default: false },
    tipoValor:        { type: String,  default: 'total', enum: ['total', 'personalizado', 'fixo'] },
    porcentagem:      { type: Number,  default: 50, min: 0, max: 100 },
    valorFixo:        { type: Number,  default: 0, min: 0 },
    reembolso:        { type: Boolean, default: true },
    reembolsoCliente: { type: Boolean, default: true },
    reembolsoVoce:    { type: Boolean, default: true },
    updatedAt:        { type: Date },
  },

  criadoEm:     { type: Date, default: Date.now },
  atualizadoEm: { type: Date, default: Date.now },
})

NegocioSchema.pre('save', function (next) {
  this.atualizadoEm = new Date()
  next()
})

module.exports = mongoose.models.Negocio || mongoose.model('Negocio', NegocioSchema)
