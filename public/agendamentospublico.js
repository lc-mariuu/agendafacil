// ── ROTA PÚBLICA: buscar agendamento pelo ID (para página de cancelamento) ──
// CORREÇÃO: rejeita agendamentos já cancelados/concluídos diretamente no backend,
// evitando que o frontend mostre "Link inválido" por divergência de status.
router.get('/:id/publico', async (req, res) => {
  try {
    const ag = await Appointment.findById(req.params.id)
    if (!ag) return res.status(404).json({ erro: 'Agendamento não encontrado' })

    // Rejeita se já foi cancelado ou concluído
    const statusNaoCancelaveis = ['cancelado', 'concluido', 'concluído']
    if (statusNaoCancelaveis.includes(ag.status?.toLowerCase())) {
      return res.status(400).json({ erro: 'Este agendamento já foi cancelado ou concluído' })
    }

    res.json({
      _id: ag._id,
      pacienteNome: ag.pacienteNome,
      servico: ag.servico,
      data: ag.data,
      hora: ag.hora,
      status: ag.status,
    })
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar agendamento' })
  }
})

// ── ROTA PÚBLICA: cancelar agendamento pelo cliente ──────────────────────────
// CORREÇÃO: aceita qualquer status cancelável (confirmado, agendado, pendente)
// em vez de só 'confirmado', prevenindo falso "não pode ser cancelado".
router.patch('/:id/cancelar-publico', async (req, res) => {
  try {
    const ag = await Appointment.findById(req.params.id)
    if (!ag) return res.status(404).json({ erro: 'Agendamento não encontrado' })

    const STATUS_CANCELAVEIS = ['confirmado', 'agendado', 'pendente']
    if (!STATUS_CANCELAVEIS.includes(ag.status?.toLowerCase())) {
      return res.status(400).json({ erro: 'Este agendamento não pode ser cancelado' })
    }

    ag.status = 'cancelado'
    ag.atualizadoEm = new Date()
    await ag.save()

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao cancelar agendamento' })
  }
}) 