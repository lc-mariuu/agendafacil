const express = require('express')
const jwt = require('jsonwebtoken')
const Appointment = require('../models/Appointment')
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

router.get('/', autenticar, async (req, res) => {
  try {
    const agendamentos = await Appointment.find({ clinicaId: req.userId }).sort({ data: 1, hora: 1 })
    res.json(agendamentos)
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar agendamentos' })
  }
})

router.get('/horarios-ocupados', async (req, res) => {
  try {
    const { clinicaId, data } = req.query
    const User = require('../models/User')

    const user = await User.findById(clinicaId).lean()
    if (!user) return res.status(404).json({ erro: 'Negócio não encontrado' })

    const [ano, mes, dia] = data.split('-').map(Number)
    const diaSemana = new Date(ano, mes - 1, dia).getDay()

    // .lean() retorna objeto puro — tenta as duas formas
    const horarios = user.horarios || {}
    const configDia = horarios[diaSemana] || horarios[String(diaSemana)]

    console.log('diaSemana:', diaSemana)
    console.log('horarios keys:', Object.keys(horarios))
    console.log('configDia:', JSON.stringify(configDia))

    if (!configDia || !configDia.ativo) {
      return res.json({ horarios: [], ocupados: [], diaInativo: true })
    }

    const intervalo = user.intervalo || 30
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

    const agendados = await Appointment.find({ clinicaId, data, status: { $ne: 'cancelado' } }).select('hora')
    const ocupados = agendados.map(a => a.hora)

    res.json({ horarios: horariosDisponiveis, ocupados, diaInativo: false })
  } catch (err) {
    console.log('ERRO horarios-ocupados:', err.message)
    res.status(500).json({ erro: 'Erro ao buscar horários' })
  }
})

router.post('/', async (req, res) => {
  try {
    const { clinicaId, pacienteNome, pacienteTelefone, servico, data, hora } = req.body
    const jaExiste = await Appointment.findOne({ clinicaId, data, hora, status: { $ne: 'cancelado' } })
    if (jaExiste) return res.status(400).json({ erro: 'Horário já ocupado' })
    const agendamento = await Appointment.create({ clinicaId, pacienteNome, pacienteTelefone, servico, data, hora })
    res.json(agendamento)
  } catch {
    res.status(500).json({ erro: 'Erro ao criar agendamento' })
  }
})

router.patch('/:id', autenticar, async (req, res) => {
  try {
    const agendamento = await Appointment.findByIdAndUpdate(req.params.id, req.body, { new: true })
    res.json(agendamento)
  } catch {
    res.status(500).json({ erro: 'Erro ao atualizar' })
  }
})

module.exports = router
