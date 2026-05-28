const express  = require('express')
const mongoose = require('mongoose')
const cors     = require('cors')
require('dotenv').config()

const Appointment = require('./models/Appointment')
const Negocio     = require('./models/Negocio')

const app = express()

// ── CORS ──────────────────────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}))

// ── Webhook raw body — ANTES do express.json ──────────────────
app.use((req, res, next) => {
  const rawPaths = ['/api/pagamento/webhook', '/api/assinatura/webhook']
  if (rawPaths.includes(req.path)) {
    express.raw({ type: '*/*' })(req, res, next)
  } else {
    next()
  }
})

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))
app.use(express.static('public', { extensions: ['html'] }))

// ── Health check (frontend faz ping a cada 10min) ─────────────
app.get('/api/health', (req, res) => res.json({ ok: true }))

// ── Rotas da API ──────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'))
app.use('/api/agendamentos',  require('./routes/appointments'))
app.use('/api/upload',        require('./routes/upload'))
app.use('/api/assinatura',    require('./routes/assinatura'))
app.use('/api/pagamento',     require('./routes/pagamento'))
app.use('/api/pagamentos',    require('./routes/pagamentosConfig'))
app.use('/api/clientes',      require('./routes/clientes'))
app.use('/api/profissionais', require('./routes/profissionais'))
app.use('/api/bloqueios',     require('./routes/bloqueios'))
app.use('/api/admin',         require('./routes/admin'))

// ── Páginas estáticas ─────────────────────────────────────────
app.get('/', (req, res) => res.sendFile('index.html', { root: 'public' }))
app.get('/bio/:slug', (req, res) => res.sendFile('bio.html', { root: 'public' }))

const PAGINAS_ESTATICAS = [
  'barbearia','salao-de-beleza','clinica','pet-shop',
  'academia','tatuagem','painel','auth','planos','admin',
]

app.get('/:slug', async (req, res) => {
  const slug = req.params.slug
  if (slug.includes('.'))               return res.status(404).sendFile('404.html', { root: 'public' })
  if (PAGINAS_ESTATICAS.includes(slug)) return res.sendFile(`${slug}.html`, { root: 'public' })
  try {
    const negocio = await Negocio.findById(slug)
    if (!negocio) return res.status(404).sendFile('404.html', { root: 'public' })
    res.sendFile('agendar.html', { root: 'public' })
  } catch {
    return res.status(404).sendFile('404.html', { root: 'public' })
  }
})

// ── Limpeza: ARQUIVA (nunca deleta) agendamentos antigos ──────
// Isso evitava o bug onde stats/faturamento sumiam após 7 dias
async function arquivarAgendamentosAntigos() {
  try {
    const noventaDiasAtras = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    const result = await Appointment.updateMany(
      {
        status:       { $in: ['concluido', 'cancelado'] },
        atualizadoEm: { $lt: noventaDiasAtras },
        arquivado:    { $ne: true },
      },
      { $set: { arquivado: true } }
    )
    if (result.modifiedCount > 0)
      console.log(`[limpeza] ${result.modifiedCount} agendamentos arquivados`)
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
    arquivarAgendamentosAntigos()
    setInterval(arquivarAgendamentosAntigos, 60 * 60 * 1000)
    const { iniciarCronLembretes } = require('./jobs/lembretes')
    iniciarCronLembretes()
  })
  .catch(err => console.error('Erro ao conectar MongoDB:', err))
