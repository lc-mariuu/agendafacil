const cron = require('node-cron')
const Negocio = require('../models/Negocio')
const Appointment = require('../models/Appointment')

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://evolution-api-gpdc.onrender.com'
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || 'agendorapido123'
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'agendorapido'

async function enviarLembrete(telefone, mensagem) {
  const numero = telefone.replace(/\D/g, '')
  const url = `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
      body: JSON.stringify({
        number: `55${numero}`,
        textMessage: { text: mensagem }
      })
    })
    const data = await res.json()
    console.log(`[Lembrete] Enviado para ${numero}:`, data)
    return true
  } catch (err) {
    console.error(`[Lembrete] Erro ao enviar para ${numero}:`, err.message)
    return false
  }
}

function formatarData(dataStr) {
  const [ano, mes, dia] = dataStr.split('-')
  return `${dia}/${mes}/${ano}`
}

function montarMensagem(template, agendamento, nomeNegocio) {
  return template
    .replace('{nome}', agendamento.pacienteNome)
    .replace('{data}', formatarData(agendamento.data))
    .replace('{hora}', agendamento.hora)
    .replace('{servico}', agendamento.servico)
    .replace('{negocio}', nomeNegocio)
}

async function dispararLembretes() {
  try {
    console.log('[Lembretes] Verificando agendamentos para amanhã...')

    const amanha = new Date()
    amanha.setDate(amanha.getDate() + 1)
    const dataAmanha = amanha.toISOString().split('T')[0]

    const negocios = await Negocio.find({ 'lembrete.ativo': true })
    console.log(`[Lembretes] ${negocios.length} negócio(s) com lembrete ativo`)

    for (const negocio of negocios) {
      const { lembrete } = negocio
      if (!lembrete?.ativo) continue

      const mensagemTemplate = lembrete.mensagem ||
        'Olá {nome}! A *{negocio}* lembra que você tem um agendamento amanhã, {data} às {hora} — {servico}. Te esperamos! 😊'

      const agendamentos = await Appointment.find({
        clinicaId: negocio._id,
        data: dataAmanha,
        status: 'confirmado'
      })

      console.log(`[Lembretes] ${negocio.nome}: ${agendamentos.length} agendamento(s) amanhã`)

      for (const ag of agendamentos) {
        if (!ag.pacienteTelefone) continue
        const mensagem = montarMensagem(mensagemTemplate, ag, negocio.nome)
        await enviarLembrete(ag.pacienteTelefone, mensagem)
        await new Promise(r => setTimeout(r, 1000))
      }
    }

    console.log('[Lembretes] Verificação concluída!')
  } catch (err) {
    console.error('[Lembretes] Erro geral:', err.message)
  }
}

// Roda todo dia às 09:00 da manhã (horário de Brasília = UTC-3, então 12:00 UTC)
function iniciarCronLembretes() {
  cron.schedule('0 12 * * *', () => {
    console.log('[Lembretes] Cron disparado!')
    dispararLembretes()
  })
  console.log('[Lembretes] Cron job agendado para 09:00 diariamente')
}

module.exports = { iniciarCronLembretes, dispararLembretes }