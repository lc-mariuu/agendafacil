const cron = require('node-cron')
const Negocio = require('../models/Negocio')
const Appointment = require('../models/Appointment')

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://evolution-api-gpdc.onrender.com'
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || 'agendorapido123'
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'agendorapido'
const BASE_URL = process.env.BASE_URL || 'https://agendafacil-wf3q.onrender.com'

// ─────────────────────────────────────────────
// UTILITÁRIOS
// ─────────────────────────────────────────────

async function enviarLembrete(telefone, mensagem) {
  const numero = telefone.replace(/\D/g, '')
  const url = `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY
      },
      body: JSON.stringify({
        number: `55${numero}`,
        textMessage: { text: mensagem }
      })
    })
    const data = await res.json()
    console.log(`[WhatsApp] Enviado para ${numero}:`, JSON.stringify(data))
    return true
  } catch (err) {
    console.error(`[WhatsApp] Erro ao enviar para ${numero}:`, err.message)
    return false
  }
}

function formatarData(dataStr) {
  const [ano, mes, dia] = dataStr.split('-')
  return `${dia}/${mes}/${ano}`
}

// Monta mensagem substituindo todas as variáveis
function montarMensagem(template, agendamento, nomeNegocio, incluirCancelamento = true) {
  const linkCancelamento = `${BASE_URL}/cancelar.html?id=${agendamento._id}`
  let mensagem = template
    .replace(/\{nome\}/g, agendamento.pacienteNome || '')
    .replace(/\{data\}/g, formatarData(agendamento.data))
    .replace(/\{hora\}/g, agendamento.hora || '')
    .replace(/\{servico\}/g, agendamento.servico || '')
    .replace(/\{negocio\}/g, nomeNegocio || '')

  if (incluirCancelamento) {
    mensagem += `\n\nPrecisa cancelar? Acesse: ${linkCancelamento}`
  }

  return mensagem
}

// Retorna { data: 'YYYY-MM-DD', hora: 'HH:MM' } com delta de horas no fuso de Brasília
function calcularDataHora(deltaHoras) {
  const d = new Date(Date.now() + deltaHoras * 60 * 60 * 1000)
  const opts = { timeZone: 'America/Sao_Paulo' }

  const data = d.toLocaleDateString('pt-BR', { ...opts, year: 'numeric', month: '2-digit', day: '2-digit' })
    .split('/').reverse().join('-') // DD/MM/YYYY → YYYY-MM-DD

  const hora = d.toLocaleTimeString('pt-BR', { ...opts, hour: '2-digit', minute: '2-digit', hour12: false })

  return { data, hora }
}

// ─────────────────────────────────────────────
// 1. LEMBRETE 24H ANTES
//    Roda todo dia às 09:00 (Brasília)
//    Busca agendamentos confirmados de amanhã
// ─────────────────────────────────────────────

async function dispararLembretes24h() {
  try {
    console.log('[24H] Verificando agendamentos para amanha...')

    const amanha = new Date()
    amanha.setDate(amanha.getDate() + 1)
    const dataAmanha = amanha.toISOString().split('T')[0]

    const negocios = await Negocio.find({ 'lembrete.ativo': true })
    console.log(`[24H] ${negocios.length} negocio(s) com lembrete 24h ativo`)

    for (const negocio of negocios) {
      const template = negocio.lembrete?.mensagem ||
        'Ola {nome}! 👋\nLembramos que voce tem um agendamento amanha, {data}, as {hora} — {servico}.\nEstamos te esperando! 🙏'

      // clinicaId no Appointment = _id do Negocio (confirmado em routes/agendamentos.js)
      const agendamentos = await Appointment.find({
        clinicaId: negocio._id,
        data: dataAmanha,
        status: 'confirmado'
      })

      console.log(`[24H] ${negocio.nome}: ${agendamentos.length} agendamento(s) amanha`)

      for (const ag of agendamentos) {
        if (!ag.pacienteTelefone) {
          console.log(`[24H] Pulando ${ag.pacienteNome} — sem telefone`)
          continue
        }
        const mensagem = montarMensagem(template, ag, negocio.nome, true)
        await enviarLembrete(ag.pacienteTelefone, mensagem)
        await new Promise(r => setTimeout(r, 1500))
      }
    }

    console.log('[24H] Verificacao concluida!')
  } catch (err) {
    console.error('[24H] Erro geral:', err.message)
  }
}

// ─────────────────────────────────────────────
// 2. LEMBRETE 1H ANTES
//    Roda todo hora no minuto :00
//    Busca agendamentos confirmados daqui 1h
// ─────────────────────────────────────────────

async function dispararLembretes1h() {
  try {
    console.log('[1H] Verificando agendamentos na proxima hora...')

    const { data, hora } = calcularDataHora(1)
    console.log(`[1H] Buscando agendamentos para ${data} as ${hora}`)

    const negocios = await Negocio.find({ 'lembrete1h.ativo': true })
    console.log(`[1H] ${negocios.length} negocio(s) com lembrete 1h ativo`)

    for (const negocio of negocios) {
      const template = negocio.lembrete1h?.mensagem ||
        'Ola {nome}! ⏰\nSeu agendamento e *hoje as {hora}* — {servico}.\n*{negocio}* te espera em breve!'

      const agendamentos = await Appointment.find({
        clinicaId: negocio._id,
        data,
        hora,
        status: 'confirmado'
      })

      console.log(`[1H] ${negocio.nome}: ${agendamentos.length} agendamento(s) na proxima hora`)

      for (const ag of agendamentos) {
        if (!ag.pacienteTelefone) {
          console.log(`[1H] Pulando ${ag.pacienteNome} — sem telefone`)
          continue
        }
        const mensagem = montarMensagem(template, ag, negocio.nome, true)
        await enviarLembrete(ag.pacienteTelefone, mensagem)
        await new Promise(r => setTimeout(r, 1500))
      }
    }

    console.log('[1H] Verificacao concluida!')
  } catch (err) {
    console.error('[1H] Erro geral:', err.message)
  }
}

// ─────────────────────────────────────────────
// 3. PÓS-ATENDIMENTO
//    Roda todo hora no minuto :00
//    Busca agendamentos confirmados de 1h atrás
// ─────────────────────────────────────────────

async function dispararPosAtendimento() {
  try {
    console.log('[POS] Verificando agendamentos concluidos ha 1h...')

    const { data, hora } = calcularDataHora(-1)
    console.log(`[POS] Buscando agendamentos de ${data} as ${hora}`)

    const negocios = await Negocio.find({ 'posAtendimento.ativo': true })
    console.log(`[POS] ${negocios.length} negocio(s) com pos-atendimento ativo`)

    for (const negocio of negocios) {
      const template = negocio.posAtendimento?.mensagem ||
        'Ola {nome}! 💙\nObrigado por nos visitar hoje!\nEsperamos que tenha gostado do atendimento em *{negocio}*.\nAte a proxima! 😊'

      const agendamentos = await Appointment.find({
        clinicaId: negocio._id,
        data,
        hora,
        status: 'confirmado'
      })

      console.log(`[POS] ${negocio.nome}: ${agendamentos.length} agendamento(s) para pos-atendimento`)

      for (const ag of agendamentos) {
        if (!ag.pacienteTelefone) {
          console.log(`[POS] Pulando ${ag.pacienteNome} — sem telefone`)
          continue
        }

        // Pós-atendimento não inclui link de cancelamento
        const mensagem = template
          .replace(/\{nome\}/g, ag.pacienteNome || '')
          .replace(/\{servico\}/g, ag.servico || '')
          .replace(/\{negocio\}/g, negocio.nome || '')
          .replace(/\{data\}/g, formatarData(ag.data))
          .replace(/\{hora\}/g, ag.hora || '')

        await enviarLembrete(ag.pacienteTelefone, mensagem)
        await new Promise(r => setTimeout(r, 1500))
      }
    }

    console.log('[POS] Verificacao concluida!')
  } catch (err) {
    console.error('[POS] Erro geral:', err.message)
  }
}

// ─────────────────────────────────────────────
// INICIALIZAÇÃO DOS CRONS
// ─────────────────────────────────────────────

function iniciarCronLembretes() {
  // 24h antes — todo dia às 09:00 Brasília (= 12:00 UTC)
  cron.schedule('0 12 * * *', () => {
    console.log('[CRON] Lembrete 24h disparado!')
    dispararLembretes24h()
  })

  // 1h antes — roda todo hora no minuto :00
  cron.schedule('0 * * * *', () => {
    console.log('[CRON] Lembrete 1h disparado!')
    dispararLembretes1h()
  })

  // Pós-atendimento — roda todo hora no minuto :00
  cron.schedule('0 * * * *', () => {
    console.log('[CRON] Pos-atendimento disparado!')
    dispararPosAtendimento()
  })

  console.log('[CRON] Todos os jobs agendados:')
  console.log('[CRON]   Lembrete 24h → todo dia as 09:00 (Brasilia)')
  console.log('[CRON]   Lembrete 1h  → todo hora no minuto :00')
  console.log('[CRON]   Pos-atend    → todo hora no minuto :00')
}

module.exports = {
  iniciarCronLembretes,
  dispararLembretes24h,
  dispararLembretes1h,
  dispararPosAtendimento
}