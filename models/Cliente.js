const mongoose = require('mongoose')

const ClienteSchema = new mongoose.Schema({
  negocioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Negocio',
    required: true,
    index: true,
  },

  // Identificação
  nome:     { type: String, required: true, trim: true },
  telefone: { type: String, required: true, trim: true },
  email:    { type: String, default: '', trim: true, lowercase: true },

  // CRM
  notas:           { type: String, default: '' },
  tags:            { type: [String], default: [] },        // ['VIP','Recorrente','Novo']
  aniversario:     { type: String, default: '' },          // 'MM-DD' (sem ano pra evitar idade)
  profissionalPreferidoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Profissional',
    default: null,
  },

  // Estatísticas (atualizadas via job ou trigger)
  visitas:       { type: Number, default: 0 },
  noShows:       { type: Number, default: 0 },
  ltv:           { type: Number, default: 0 },             // Lifetime value em R$
  ultimaVisita:  { type: String, default: null },          // ISO date

  // Auditoria
  criadoEm:     { type: Date, default: Date.now },
  atualizadoEm: { type: Date, default: Date.now },
})

ClienteSchema.index({ negocioId: 1, telefone: 1 }, { unique: true })
ClienteSchema.index({ negocioId: 1, nome: 'text' })

ClienteSchema.pre('save', function (next) {
  this.atualizadoEm = new Date()
  next()
})

// Método helper: recalcula estatísticas baseado nos appointments
ClienteSchema.methods.recalcularStats = async function () {
  const Appointment = mongoose.model('Appointment')
  const apts = await Appointment.find({
    clinicaId: this.negocioId,
    $or: [
      { clienteId: this._id },
      { pacienteNome: { $regex: new RegExp('^' + this.nome + '$', 'i') }, pacienteTelefone: this.telefone },
    ],
  }).lean()

  const concluidos = apts.filter(a => a.status === 'concluido')
  const noShow    = apts.filter(a => a.status === 'cancelado').length  // proxy

  this.visitas = concluidos.length
  this.noShows = noShow
  this.ltv     = concluidos.reduce((s, a) => s + (Number(a.preco) || 0), 0)
  if (concluidos.length) {
    const last = concluidos.sort((a, b) => b.data.localeCompare(a.data))[0]
    this.ultimaVisita = last.data
  }
  await this.save()
  return this
}

module.exports = mongoose.models.Cliente || mongoose.model('Cliente', ClienteSchema)

