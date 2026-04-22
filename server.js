const express  = require('express')
const mongoose = require('mongoose')
const cors     = require('cors')
require('dotenv').config()

const app = express()
app.use(cors())

// ── Webhook raw body — ANTES do express.json ──────────────────
app.use((req, res, next) => {
  const rawPaths = [
    '/api/pagamento/webhook',
    '/api/assinatura/webhook',
  ]
  if (rawPaths.includes(req.path)) {
    express.raw({ type: '*/*' })(req, res, next)
  } else {
    next()
  }
})

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))
app.use(express.static('public', { extensions: ['html'] }))

// ── Rotas da API ──────────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth'))
app.use('/api/agendamentos', require('./routes/appointments'))
app.use('/api/upload',       require('./routes/upload'))
app.use('/api/assinatura',   require('./routes/assinatura'))
app.use('/api/pagamento',    require('./routes/pagamento'))
app.use('/api/pagamentos',   require('./routes/pagamentosConfig')) // ← config da página de pagamentos

// ── Páginas estáticas ─────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile('index.html', { root: 'public' })
})

app.get('/bio/:slug', (req, res) => {
  res.sendFile('bio.html', { root: 'public' })
})

const PAGINAS_ESTATICAS = [
  'barbearia', 'salao-de-beleza', 'clinica', 'pet-shop',
  'academia', 'tatuagem', 'painel', 'auth', 'planos',
]

app.get('/:slug', async (req, res) => {
  const slug = req.params.slug
  if (slug.includes('.'))               return res.status(404).sendFile('404.html', { root: 'public' })
  if (PAGINAS_ESTATICAS.includes(slug)) return res.sendFile(`${slug}.html`, { root: 'public' })
  try {
    const Negocio = require('./models/Negocio')
    const negocio = await Negocio.findById(slug)
    if (!negocio) return res.status(404).sendFile('404.html', { root: 'public' })
    res.sendFile('agendar.html', { root: 'public' })
  } catch {
    return res.status(404).sendFile('404.html', { root: 'public' })
  }
})

// ── Limpeza automática de agendamentos antigos ────────────────
async function limparAgendamentos() {
  try {
    const Appointment = require('./models/Appointment')
    const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000)
    const result = await Appointment.deleteMany({
      status:       { $in: ['concluido', 'cancelado'] },
      atualizadoEm: { $lt: umaHoraAtras },
    })
    if (result.deletedCount > 0)
      console.log(`[limpeza] ${result.deletedCount} agendamentos removidos`)
  } catch (e) {
    console.error('[limpeza] erro:', e.message)
  }
}

// ── Inicialização ─────────────────────────────────────────────
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