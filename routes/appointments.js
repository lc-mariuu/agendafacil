const express = require('express')
const jwt = require('jsonwebtoken')
const Appointment = require('../models/Appointment')
const Negocio = require('../models/Negocio')
const router = express.Router()

const autenticar = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ erro: 'Sem autorização' })
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.userId = decoded.id
    next()
  } catch {
    res.status(401).json({ erro: 'Token inválido' })
  }
}

// ── LISTAR agendamentos de um negócio ─────────────────
router.get('/', autenticar, async (req, res) => {
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

// ── HORÁRIOS OCUPADOS (rota pública) ──────────────────
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

    // Gera todos os horários do dia
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

    // ✅ Filtra horários que já passaram se for hoje (fuso de Brasília)
    const agora = new Date()
    const agoraBrasilia = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
    const dataHoje = (() => {
      const y = agoraBrasilia.getFullYear()
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

    // Filtra pausas
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
    const ocupados = agendados.map(a => a.hora)

    res.json({ horarios: horariosComPausa, ocupados, diaInativo: false })
  } catch (err) {
    console.error('ERRO horarios-ocupados:', err.message)
    res.status(500).json({ erro: 'Erro ao buscar horários' })
  }
})

// ── CRIAR agendamento (público) ───────────────────────
router.post('/', async (req, res) => {
  try {
    const { clinicaId, pacienteNome, pacienteTelefone, servico, data, hora } = req.body

    const jaExiste = await Appointment.findOne({ clinicaId, data, hora, status: { $ne: 'cancelado' } })
    if (jaExiste) return res.status(400).json({ erro: 'Horário já ocupado' })

    // ✅ Busca e salva o preço do serviço no momento da criação
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

    const agendamento = await Appointment.create({
      clinicaId, pacienteNome, pacienteTelefone, servico, preco, data, hora
    })
    res.json(agendamento)
  } catch (err) {
    console.error('ERRO criar agendamento:', err.message)
    res.status(500).json({ erro: 'Erro ao criar agendamento' })
  }
})

// ── BUSCAR agendamento público (para página de cancelamento) ──
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
      status: ag.status
    })
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar agendamento' })
  }
})

// ── CANCELAR agendamento pelo cliente (público) ───────
router.patch('/:id/cancelar-publico', async (req, res) => {
  try {
    const ag = await Appointment.findById(req.params.id)
    if (!ag) return res.status(404).json({ erro: 'Agendamento não encontrado' })
    if (ag.status !== 'confirmado') return res.status(400).json({ erro: 'Este agendamento não pode ser cancelado' })
    ag.status = 'cancelado'
    ag.atualizadoEm = new Date()
    await ag.save()
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao cancelar agendamento' })
  }
})

// ── ATUALIZAR status ──────────────────────────────────
router.patch('/:id', autenticar, async (req, res) => {
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