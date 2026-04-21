const express    = require('express')
const Appointment = require('../models/Appointment')
const Negocio    = require('../models/Negocio')
const router     = express.Router()

// ── Middlewares de autenticação e acesso ──────────────────
const { autenticar, verificarAcesso } = require('../middleware/acesso')

// ── LISTAR agendamentos de um negócio ─────────────────────
// Protegido: precisa de login + acesso ativo
router.get('/', autenticar, verificarAcesso, async (req, res) => {
  try {
    const { negocioId } = req.query
    const neg = await Negocio.findOne({ _id: negocioId, userId: req.userId })
    if (!neg) return res.status(404).json({ erro: 'Negócio não encontrado' })
    const agendamentos = await Appointment.find({ clinicaId: negocioId }).sort({ data: 1, hora: 1 })
    res.json(agendamentos)
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar agendamentos' })
  }
})

// ── HORÁRIOS OCUPADOS (rota pública) ──────────────────────
// Pública: cliente acessa sem login
router.get('/horarios-ocupados', async (req, res) => {
  try {
    const { clinicaId, data } = req.query

    let horarios = {}, intervalo = 30
    const neg = await Negocio.findById(clinicaId).lean()
    if (neg) {
      horarios = neg.horarios || {}
      intervalo = neg.intervalo || 30
    } else {
      const User = require('../models/User')
      const user = await User.findById(clinicaId).lean()
      if (!user) return res.status(404).json({ erro: 'Negócio não encontrado' })
      horarios = user.horarios || {}
      intervalo = user.intervalo || 30
    }

    const [ano, mes, dia] = data.split('-').map(Number)
    const diaSemana = new Date(ano, mes - 1, dia).getDay()
    const configDia = horarios[diaSemana] || horarios[String(diaSemana)]

    if (!configDia || !configDia.ativo) {
      return res.json({ horarios: [], ocupados: [], diaInativo: true })
    }

    const horariosDisponiveis = []
    const [hIni, mIni] = configDia.inicio.split(':').map(Number)
    const [hFim, mFim] = configDia.fim.split(':').map(Number)
    let atual = hIni * 60 + mIni
    const fim = hFim * 60 + mFim
    while (atual < fim) {
      const h = String(Math.floor(atual / 60)).padStart(2, '0')
      const m = String(atual % 60).padStart(2, '0')
      horariosDisponiveis.push(`${h}:${m}`)
      atual += intervalo
    }

    const agora = new Date()
    const agoraBrasilia = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
    const dataHoje = (() => {
      const y  = agoraBrasilia.getFullYear()
      const mo = String(agoraBrasilia.getMonth() + 1).padStart(2, '0')
      const d2 = String(agoraBrasilia.getDate()).padStart(2, '0')
      return `${y}-${mo}-${d2}`
    })()
    const minutosAgora = agoraBrasilia.getHours() * 60 + agoraBrasilia.getMinutes()

    const horariosValidos = data === dataHoje
      ? horariosDisponiveis.filter(h => {
          const [hh, mm] = h.split(':').map(Number)
          return (hh * 60 + mm) > minutosAgora
        })
      : horariosDisponiveis

    const pausas = (neg ? neg.pausas : []) || []
    const horariosComPausa = horariosValidos.filter(h => {
      const [hh, mm] = h.split(':').map(Number)
      const minH = hh * 60 + mm
      for (const pausa of pausas) {
        if (!pausa.inicio || !pausa.fim) continue
        const [pi, pm] = pausa.inicio.split(':').map(Number)
        const [fi, fm] = pausa.fim.split(':').map(Number)
        const minI = pi * 60 + pm
        const minF = fi * 60 + fm
        if (minH >= minI && minH < minF) return false
      }
      return true
    })

    const agendados = await Appointment.find({ clinicaId, data, status: { $ne: 'cancelado' } }).select('hora')
    const ocupados  = agendados.map(a => a.hora)

    res.json({ horarios: horariosComPausa, ocupados, diaInativo: false })
  } catch (err) {
    console.error('ERRO horarios-ocupados:', err.message)
    res.status(500).json({ erro: 'Erro ao buscar horários' })
  }
})

// ── INSIGHTS (protegido) ──────────────────────────────────
router.get('/insights', autenticar, verificarAcesso, async (req, res) => {
  try {
    const { negocioId } = req.query
    const neg = await Negocio.findOne({ _id: negocioId, userId: req.userId })
    if (!neg) return res.status(404).json({ erro: 'Negócio não encontrado' })

    const todos = await Appointment.find({ clinicaId: negocioId }).lean()

    // Melhor horário
    const freqHora = {}
    todos.filter(a => a.status !== 'cancelado' && a.hora).forEach(a => {
      freqHora[a.hora] = (freqHora[a.hora] || 0) + 1
    })
    const melhorHora = Object.entries(freqHora).sort((a, b) => b[1] - a[1])[0]?.[0] || null

    // Melhor dia da semana
    const freqDia  = {}
    const diasNomes = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']
    todos.filter(a => a.status !== 'cancelado' && a.data).forEach(a => {
      const [ano, mes, dia] = a.data.split('-').map(Number)
      const d = new Date(ano, mes - 1, dia).getDay()
      freqDia[d] = (freqDia[d] || 0) + 1
    })
    const melhorDiaIdx = Object.entries(freqDia).sort((a, b) => b[1] - a[1])[0]?.[0]
    const melhorDia    = melhorDiaIdx !== undefined ? diasNomes[melhorDiaIdx] : null
    const melhorAgendamento = melhorDia && melhorHora ? `${melhorDia}s ${melhorHora}` : melhorHora || '—'

    // Serviço mais lucrativo (mês atual)
    const mesAtual = new Date().toISOString().slice(0, 7)
    const lucroServico = {}
    todos.filter(a => a.status === 'concluido' && a.data?.startsWith(mesAtual) && a.servico).forEach(a => {
      lucroServico[a.servico] = (lucroServico[a.servico] || 0) + (Number(a.preco) || 0)
    })
    const topServicoEntry = Object.entries(lucroServico).sort((a, b) => b[1] - a[1])[0]
    const topServico = topServicoEntry ? { nome: topServicoEntry[0], receita: topServicoEntry[1] } : null

    // Clientes inativos (30 dias)
    const hoje    = new Date()
    const cutoff  = new Date(hoje)
    cutoff.setDate(cutoff.getDate() - 30)
    const cutoffStr       = cutoff.toISOString().split('T')[0]
    const clientesAntigos = new Set(todos.filter(a => a.data < cutoffStr).map(a => a.pacienteNome?.toLowerCase().trim()).filter(Boolean))
    const clientesRecentes = new Set(todos.filter(a => a.data >= cutoffStr).map(a => a.pacienteNome?.toLowerCase().trim()).filter(Boolean))
    const inativos = [...clientesAntigos].filter(c => !clientesRecentes.has(c))

    // Finance
    const lucroMes = todos.filter(a => a.status === 'concluido' && a.data?.startsWith(mesAtual)).reduce((acc, a) => acc + (Number(a.preco) || 0), 0)
    const atendMes = todos.filter(a => a.status === 'concluido' && a.data?.startsWith(mesAtual)).length
    const ticketMedio = atendMes > 0 ? lucroMes / atendMes : 0

    // Histórico 6 meses
    const historicoMeses = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setDate(1)
      d.setMonth(d.getMonth() - i)
      const chave = d.toISOString().slice(0, 7)
      const lucro = todos.filter(a => a.status === 'concluido' && a.data?.startsWith(chave)).reduce((acc, a) => acc + (Number(a.preco) || 0), 0)
      const atend = todos.filter(a => a.status === 'concluido' && a.data?.startsWith(chave)).length
      historicoMeses.push({ mes: chave, lucro, atendimentos: atend })
    }

    // Lucro da semana
    const semStart  = new Date()
    semStart.setDate(semStart.getDate() - 7)
    const semStr    = semStart.toISOString().split('T')[0]
    const hojeStr   = hoje.toISOString().split('T')[0]
    const lucroSemana = todos.filter(a => a.status === 'concluido' && a.data >= semStr && a.data <= hojeStr).reduce((acc, a) => acc + (Number(a.preco) || 0), 0)

    res.json({
      melhorAgendamento,
      topServico,
      inativos: { total: inativos.length, nomes: inativos.slice(0, 10) },
      finance:  { lucroMes, atendMes, ticketMedio, lucroSemana, historicoMeses },
    })
  } catch (err) {
    console.error('ERRO insights:', err.message)
    res.status(500).json({ erro: 'Erro ao buscar insights' })
  }
})

// ── CRIAR agendamento (público) ───────────────────────────
// Pública: cliente agenda sem login
router.post('/', async (req, res) => {
  try {
    const { clinicaId, pacienteNome, pacienteTelefone, servico, data, hora } = req.body

    const jaExiste = await Appointment.findOne({ clinicaId, data, hora, status: { $ne: 'cancelado' } })
    if (jaExiste) return res.status(400).json({ erro: 'Horário já ocupado' })

    let preco = 0
    const neg = await Negocio.findById(clinicaId).lean()
    if (neg && neg.servicos) {
      const servicoObj = neg.servicos.find(s => {
        const nome = typeof s === 'object' ? s.nome : s
        return nome === servico
      })
      if (servicoObj && typeof servicoObj === 'object') {
        preco = Number(servicoObj.preco) || 0
      }
    }

    const agendamento = await Appointment.create({ clinicaId, pacienteNome, pacienteTelefone, servico, preco, data, hora })
    res.json(agendamento)
  } catch (err) {
    console.error('ERRO criar agendamento:', err.message)
    res.status(500).json({ erro: 'Erro ao criar agendamento' })
  }
})

// ── BUSCAR agendamento público ────────────────────────────
router.get('/:id/publico', async (req, res) => {
  try {
    const ag = await Appointment.findById(req.params.id)
    if (!ag) return res.status(404).json({ erro: 'Agendamento não encontrado' })
    res.json({ _id: ag._id, pacienteNome: ag.pacienteNome, servico: ag.servico, data: ag.data, hora: ag.hora, status: ag.status })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar agendamento' })
  }
})

// ── CANCELAR agendamento pelo cliente (público) ───────────
router.patch('/:id/cancelar-publico', async (req, res) => {
  try {
    const ag = await Appointment.findById(req.params.id)
    if (!ag) return res.status(404).json({ erro: 'Agendamento não encontrado' })
    if (ag.status !== 'confirmado') return res.status(400).json({ erro: 'Este agendamento não pode ser cancelado' })
    ag.status = 'cancelado'
    ag.atualizadoEm = new Date()
    await ag.save()
    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao cancelar agendamento' })
  }
})

// ── ATUALIZAR status (protegido) ──────────────────────────
router.patch('/:id', autenticar, verificarAcesso, async (req, res) => {
  try {
    const agendamento = await Appointment.findByIdAndUpdate(
      req.params.id,
      { ...req.body, atualizadoEm: new Date() },
      { new: true }
    )
    res.json(agendamento)
  } catch {
    res.status(500).json({ erro: 'Erro ao atualizar' })
  }
})

module.exports = router