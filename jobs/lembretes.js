const cron = require('node-cron')
const Negocio = require('../models/Negocio')
const Appointment = require('../models/Appointment')

const ZAPI_INSTANCE_ID = process.env.ZAPI_INSTANCE_ID
const ZAPI_TOKEN = process.env.ZAPI_TOKEN

async function enviarLembrete(telefone, mensagem) {
  const numero = telefone.replace(/\D/g, '')
  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: `55${numero}`,
        message: mensagem
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

function montarMensagem(template, agendamento) {
  return template
    .replace('{nome}', agendamento.pacienteNome)
    .replace('{data}', formatarData(agendamento.data))
    .replace('{hora}', agendamento.hora)
    .replace('{servico}', agendamento.servico)
}

async function dispararLembretes() {
  try {
    console.log('[Lembretes] Verificando agendamentos para amanhã...')

    // Calcula a data de amanhã no formato YYYY-MM-DD
    const amanha = new Date()
    amanha.setDate(amanha.getDate() + 1)
    const dataAmanha = amanha.toISOString().split('T')[0]

    // Busca todos os negócios com lembrete ativo
    const negocios = await Negocio.find({ 'lembrete.ativo': true })
    console.log(`[Lembretes] ${negocios.length} negócio(s) com lembrete ativo`)

    for (const negocio of negocios) {
      const { lembrete } = negocio
      if (!lembrete?.ativo) continue

      const mensagemTemplate = lembrete.mensagem ||
        'Olá {nome}! Lembrando que você tem um agendamento amanhã, {data} às {hora} — {servico}. Te esperamos! 😊'

      // Busca agendamentos confirmados de amanhã para esse negócio
      const agendamentos = await Appointment.find({
        clinicaId: negocio._id,
        data: dataAmanha,
        status: 'confirmado'
      })

      console.log(`[Lembretes] ${negocio.nome}: ${agendamentos.length} agendamento(s) amanhã`)

      for (const ag of agendamentos) {
        if (!ag.pacienteTelefone) continue
        const mensagem = montarMensagem(mensagemTemplate, ag)
        await enviarLembrete(ag.pacienteTelefone, mensagem)
        // Pequena pausa entre envios pra não sobrecarregar a API
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