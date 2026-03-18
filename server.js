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

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB conectado!')
    app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`))
  })
  .catch(err => console.error('Erro ao conectar MongoDB:', err))