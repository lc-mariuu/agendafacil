const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const diaSchema = new mongoose.Schema({
  ativo: { type: Boolean, default: false },
  inicio: { type: String, default: '08:00' },
  fim: { type: String, default: '18:00' }
}, { _id: false })

const userSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  senha: { type: String, required: true },
  negocio: { type: String, required: true },
  segmento: { type: String, default: 'Clínica' },
  servicos: { type: [String], default: ['Consulta', 'Retorno', 'Exame'] },
  intervalo: { type: Number, default: 30 },
  horarios: {
    0: { type: diaSchema, default: () => ({}) }, // domingo
    1: { type: diaSchema, default: () => ({}) }, // segunda
    2: { type: diaSchema, default: () => ({}) }, // terça
    3: { type: diaSchema, default: () => ({}) }, // quarta
    4: { type: diaSchema, default: () => ({}) }, // quinta
    5: { type: diaSchema, default: () => ({}) }, // sexta
    6: { type: diaSchema, default: () => ({}) }  // sábado
  },
  criadoEm: { type: Date, default: Date.now }
})

userSchema.methods.compararSenha = async function(senha) {
  return bcrypt.compare(senha, this.senha)
}

router.patch('/horarios', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findByIdAndUpdate(
      decoded.id,
      { horarios: req.body.horarios, intervalo: req.body.intervalo },
      { new: true }
    )
    res.json({ horarios: user.horarios, intervalo: user.intervalo })
  } catch {
    res.status(500).json({ erro: 'Erro ao salvar horários' })
  }
})

module.exports = mongoose.model('User', userSchema)