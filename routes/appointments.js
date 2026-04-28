const express    = require('express')
const Appointment = require('../models/Appointment')
const Negocio    = require('../models/Negocio')
const router     = express.Router()

const { autenticar, verificarAcesso } = require('../middleware/acesso')

// ── Job: limpa aguardando_pagamento com mais de 35 min ──────────────────────
// Roda a cada 10 minutos para liberar horários de clientes que não pagaram
setInterval(async () => {
  try {
    const limite = new Date(Date.now() - 35 * 60 * 1000)
    const result = await Appointment.updateMany(
      { status: 'aguardando_pagamento', criadoEm: { $lt: limite } },
      { $set: { status: 'cancelado', atualizadoEm: new Date() } }
    )
    if (result.modifiedCount > 0) {
      console.log(`[limpeza] ${result.modifiedCount} agendamentos expirados cancelados`)
    }
  } catch (e) {
    console.error('[limpeza] erro:', e.message)
  }
}, 10 * 60 * 1000)

// ── LISTAR agendamentos de um negócio ─────────────────────────────────────────
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

// ── HORÁRIOS OCUPADOS (rota pública) ──────────────────────────────────────────
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

    // ✅ CORREÇÃO: horário só é ocupado se confirmado ou aguardando_pagamento
    // aguardando_pagamento reserva o horário enquanto o cliente está pagando
    // mas é liberado automaticamente se o pagamento expirar (job acima)
    const agendados = await Appointment.find({
      clinicaId,
      data,
      status: { $in: ['confirmado', 'aguardando_pagamento'] }
    }).select('hora')
    const ocupados = agendados.map(a => a.hora)

    res.json({ horarios: horariosComPausa, ocupados, diaInativo: false })
  } catch (err) {
    console.error('ERRO horarios-ocupados:', err.message)
    res.status(500).json({ erro: 'Erro ao buscar horários' })
  }
})

// ── INSIGHTS (protegido) ───────────────────────────────────────────────────────
router.get('/insights', autenticar, verificarAcesso, async (req, res) => {
  try {
    const { negocioId } = req.query
    const neg = await Negocio.findOne({ _id: negocioId, userId: req.userId })
    if (!neg) return res.status(404).json({ erro: 'Negócio não encontrado' })

    const todos = await Appointment.find({ clinicaId: negocioId }).lean()

    const freqHora = {}
    todos.filter(a => a.status !== 'cancelado' && a.hora).forEach(a => {
      freqHora[a.hora] = (freqHora[a.hora] || 0) + 1
    })
    const melhorHora = Object.entries(freqHora).sort((a, b) => b[1] - a[1])[0]?.[0] || null

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

    const mesAtual = new Date().toISOString().slice(0, 7)
    const lucroServico = {}
    todos.filter(a => a.status === 'concluido' && a.data?.startsWith(mesAtual) && a.servico).forEach(a => {
      lucroServico[a.servico] = (lucroServico[a.servico] || 0) + (Number(a.preco) || 0)
    })
    const topServicoEntry = Object.entries(lucroServico).sort((a, b) => b[1] - a[1])[0]
    const topServico = topServicoEntry ? { nome: topServicoEntry[0], receita: topServicoEntry[1] } : null

    const hoje    = new Date()
    const cutoff  = new Date(hoje)
    cutoff.setDate(cutoff.getDate() - 30)
    const cutoffStr        = cutoff.toISOString().split('T')[0]
    const clientesAntigos  = new Set(todos.filter(a => a.data < cutoffStr).map(a => a.pacienteNome?.toLowerCase().trim()).filter(Boolean))
    const clientesRecentes = new Set(todos.filter(a => a.data >= cutoffStr).map(a => a.pacienteNome?.toLowerCase().trim()).filter(Boolean))
    const inativos = [...clientesAntigos].filter(c => !clientesRecentes.has(c))

    const lucroMes   = todos.filter(a => a.status === 'concluido' && a.data?.startsWith(mesAtual)).reduce((acc, a) => acc + (Number(a.preco) || 0), 0)
    const atendMes   = todos.filter(a => a.status === 'concluido' && a.data?.startsWith(mesAtual)).length
    const ticketMedio = atendMes > 0 ? lucroMes / atendMes : 0

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

    const semStart    = new Date()
    semStart.setDate(semStart.getDate() - 7)
    const semStr      = semStart.toISOString().split('T')[0]
    const hojeStr     = hoje.toISOString().split('T')[0]
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

// ── CRIAR agendamento (público) ────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { clinicaId, pacienteNome, pacienteTelefone, servico, data, hora } = req.body

    // ✅ Bloqueia se já existe confirmado OU aguardando_pagamento neste horário
    const jaExiste = await Appointment.findOne({
      clinicaId,
      data,
      hora,
      status: { $in: ['confirmado', 'aguardando_pagamento'] }
    })
    if (jaExiste) return res.status(400).json({ erro: 'Horário já ocupado' })

    let preco = 0
    let statusInicial = 'confirmado' // padrão sem pagamento

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

    // ✅ CORREÇÃO PRINCIPAL: lê pagamentosConfig corretamente
    // O campo é salvo como neg.pagamentosConfig = { "NomeServico": { ativo: true, valor: 50 } }
    // pelo endpoint PATCH /api/pagamento/config com body.servicos
    if (neg && preco > 0) {
      const cfgPag = neg.pagamentosConfig || {}
      const cfgServico = cfgPag[servico] || {}

      if (cfgServico.ativo === true) {
        // Serviço exige pagamento antecipado
        // Cria como aguardando_pagamento → só vira 'confirmado' após webhook do MP
        statusInicial = 'aguardando_pagamento'
      }
    }

    const agendamento = await Appointment.create({
      clinicaId,
      pacienteNome,
      pacienteTelefone,
      servico,
      preco,
      data,
      hora,
      status: statusInicial,
    })

    res.json(agendamento)
  } catch (err) {
    console.error('ERRO criar agendamento:', err.message)
    res.status(500).json({ erro: 'Erro ao criar agendamento' })
  }
})

// ── BUSCAR agendamento público ─────────────────────────────────────────────────
router.get('/:id/publico', async (req, res) => {
  try {
    const ag = await Appointment.findById(req.params.id)
    if (!ag) return res.status(404).json({ erro: 'Agendamento não encontrado' })
    res.json({
      _id: ag._id,
      pacienteNome: ag.pacienteNome,
      servico: ag.servico,
      data: ag.data,
      hora: ag.hora,
      status: ag.status,
      pagamento: ag.pagamento,
    })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar agendamento' })
  }
})

// ── BUSCAR agendamento por ID ──────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const ag = await Appointment.findById(req.params.id)
    if (!ag) return res.status(404).json({ erro: 'Agendamento não encontrado' })
    res.json(ag)
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar agendamento' })
  }
})

// ── CANCELAR agendamento pelo cliente (público) ────────────────────────────────
router.patch('/:id/cancelar-publico', async (req, res) => {
  try {
    const ag = await Appointment.findById(req.params.id)
    if (!ag) return res.status(404).json({ erro: 'Agendamento não encontrado' })
    if (!['confirmado', 'aguardando_pagamento'].includes(ag.status)) {
      return res.status(400).json({ erro: 'Este agendamento não pode ser cancelado' })
    }
    ag.status = 'cancelado'
    ag.atualizadoEm = new Date()
    await ag.save()
    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao cancelar agendamento' })
  }
})

// ── ATUALIZAR status (protegido) ───────────────────────────────────────────────
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