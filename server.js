const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
require('dotenv').config()

const app = express()
app.use(cors())

// ── WEBHOOK STRIPE ────────────────────────────────────────────
// DEVE vir antes do express.json() — o Stripe precisa do body raw
// para validar a assinatura criptográfica do evento.
app.use('/api/assinatura/webhook', express.raw({ type: 'application/json' }))

// ── Middlewares gerais ────────────────────────────────────────
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))
app.use(express.static('public'))

// ── Rotas ─────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'))
app.use('/api/auth',          require('./routes/verificacao'))
app.use('/api/agendamentos',  require('./routes/appointments'))
app.use('/api/upload',        require('./routes/upload'))
app.use('/api/assinatura',    require('./routes/assinatura'))

app.get('/', (req, res) => {
  res.json({ mensagem: 'AgendoRapido API funcionando!' })
})

// ── Banco + servidor ──────────────────────────────────────────
const PORT = process.env.PORT || 3000

// ── LIMPEZA AUTOMÁTICA ────────────────────────────────
// Apaga agendamentos concluídos ou cancelados com mais de 1 hora
async function limparAgendamentos() {
  const Appointment = require('./models/Appointment')
  const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000)
  const result = await Appointment.deleteMany({
    status: { $in: ['concluido', 'cancelado'] },
    updatedAt: { $lt: umaHoraAtras }
  })
  if (result.deletedCount > 0) {
    console.log(`[limpeza] ${result.deletedCount} agendamentos removidos`)
  }
}

// Roda ao iniciar e depois a cada 1 hora
limparAgendamentos()
setInterval(limparAgendamentos, 60 * 60 * 1000)

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB conectado!')
    app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`))
  })
  .catch(err => console.error('Erro ao conectar MongoDB:', err))