const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
require('dotenv').config()

const app = express()
app.use(cors())

app.use('/api/assinatura/webhook', express.raw({ type: 'application/json' }))
app.use('/api/pagamento/webhook', express.raw({ type: 'application/json' }))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))
app.use(express.static('public'))

app.use('/api/auth',         require('./routes/auth'))
app.use('/api/agendamentos', require('./routes/appointments'))
app.use('/api/upload',       require('./routes/upload'))
app.use('/api/assinatura',   require('./routes/assinatura'))
app.use('/api/pagamento',    require('./routes/pagamento'))

app.get('/', (req, res) => {
  res.json({ mensagem: 'AgendoRapido API funcionando!' })
})

// ── Rotas públicas por slug ────────────────────────────────────
app.get('/bio/:slug', (req, res) => {
  res.sendFile('bio.html', { root: 'public' })
})

app.get('/:slug', (req, res) => {
  const slug = req.params.slug
  if (slug.includes('.')) return res.status(404).send('Not found')
  res.sendFile('agendar.html', { root: 'public' })
})

// ── LIMPEZA AUTOMÁTICA ─────────────────────────────────────────
async function limparAgendamentos() {
  try {
    const Appointment = require('./models/Appointment')
    const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000)
    const result = await Appointment.deleteMany({
      status: { $in: ['concluido', 'cancelado'] },
      atualizadoEm: { $lt: umaHoraAtras }
    })
    if (result.deletedCount > 0) {
      console.log(`[limpeza] ${result.deletedCount} agendamentos removidos`)
    }
  } catch(e) {
    console.error('[limpeza] erro:', e.message)
  }
}

const PORT = process.env.PORT || 3000

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB conectado!')
    app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`))
    limparAgendamentos()
    setInterval(limparAgendamentos, 60 * 60 * 1000)
    const { iniciarCronLembretes } = require('./jobs/lembretes')
    iniciarCronLembretes()
  })
  .catch(err => console.error('Erro ao conectar MongoDB:', err))