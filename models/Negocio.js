const mongoose = require('mongoose')
 
const ServicoSchema = new mongoose.Schema({
  nome:     { type: String, required: true },
  preco:    { type: Number, default: 0 },
  desc:     { type: String, default: '' },
  duracao:  { type: Number, default: 0 },
}, { _id: false })
 
const NegocioSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  nome:      { type: String, required: true },
  segmento:  { type: String, default: 'Outro' },
 
  servicos:  { type: [ServicoSchema], default: [] },
 
  horarios:  { type: mongoose.Schema.Types.Mixed, default: {} },
  intervalo: { type: Number, default: 30 },
  pausas:    { type: [mongoose.Schema.Types.Mixed], default: [] },
  intervalosServicos: { type: mongoose.Schema.Types.Mixed, default: {} },
 
  bio: {
    foto:       { type: String, default: '' },
    descricao:  { type: String, default: '' },
    endereco:   { type: String, default: '' },
    instagram:  { type: String, default: '' },
    whatsapp:   { type: String, default: '' },
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
 
  // ← NOVO: configuração Pix
  pixConfig: {
    chavePix:  { type: String, default: '' },
    tipoPix:   { type: String, default: 'cpf' },
    servicos:  { type: mongoose.Schema.Types.Mixed, default: {} },
    updatedAt: { type: Date },
  },
 
  pagamentos: { type: mongoose.Schema.Types.Mixed, default: {} }, // legado
 
  criadoEm:     { type: Date, default: Date.now },
  atualizadoEm: { type: Date, default: Date.now },
})
 
NegocioSchema.pre('save', function (next) {
  this.atualizadoEm = new Date()
  next()
})
 
module.exports = mongoose.models.Negocio || mongoose.model('Negocio', NegocioSchema)