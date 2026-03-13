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
    const agendamentos = await Appointment.find({
      clinicaId,
      data,
      status: { $ne: 'cancelado' }
    }).select('hora')
    const horasOcupadas = agendamentos.map(a => a.hora)
    res.json(horasOcupadas)
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar horários' })
  }
})

router.post('/', async (req, res) => {
  try {
    const { clinicaId, pacienteNome, pacienteTelefone, servico, data, hora } = req.body
    const jaExiste = await Appointment.findOne({
      clinicaId,
      data,
      hora,
      status: { $ne: 'cancelado' }
    })
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