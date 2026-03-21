// ── ROTA PÚBLICA: buscar agendamento pelo ID (para página de cancelamento) ──
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

// ── ROTA PÚBLICA: cancelar agendamento pelo cliente ──────────────────────────
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