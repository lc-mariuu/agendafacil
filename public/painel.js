/* ═══════════════════════════════════════════════════
   CONSTANTES E ESTADO GLOBAL
═══════════════════════════════════════════════════ */
const API = 'https://agendafacil-wf3q.onrender.com/api'

let todosAgendamentos  = []
let servicosAtuais     = []
let intervaloAtual     = 30
let intervaloCustomAtivo = false
let intervalosServicos = {}
let horariosConfig     = {}
let negocioAtual       = null
let todosNegocios      = []
let pausasAtuais       = []
let pagamentosConfig   = {}

const diasNomes = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']

const OPCOES_INTERVALO = [
  { label: '15 min',  valor: 15  },
  { label: '20 min',  valor: 20  },
  { label: '30 min',  valor: 30  },
  { label: '45 min',  valor: 45  },
  { label: '1 hora',  valor: 60  },
  { label: '1h30',    valor: 90  },
  { label: '2 horas', valor: 120 },
  { label: '2h30',    valor: 150 },
]

const servicosPorSegmento = {
  'Clinica':   ['Consulta','Retorno','Exame','Avaliação','Procedimento'],
  'Barbearia': ['Corte','Barba','Corte + Barba','Pigmentação','Hidratação'],
  'Salao':     ['Corte','Coloração','Escova','Manicure','Pedicure'],
  'Pet Shop':  ['Banho','Tosa','Banho + Tosa','Consulta Vet','Vacina'],
  'Academia':  ['Avaliação Física','Treino Personal','Pilates','Musculação'],
  'Estudio':   ['Tatuagem','Orçamento','Retoque','Piercing'],
  'Outro':     ['Serviço 1','Serviço 2','Serviço 3'],
}

/* ═══════════════════════════════════════════════════
   LUCRO — localStorage helpers
═══════════════════════════════════════════════════ */
function mesAtualChave() { return new Date().toISOString().slice(0, 7) }
function lucroKey(id)    { return `lucro_val_${id}_${mesAtualChave()}` }
function lucroIdsKey(id) { return `lucro_ids_${id}_${mesAtualChave()}` }

function getLucroMes(id) {
  const v = localStorage.getItem(lucroKey(id))
  return v !== null ? parseFloat(v) : null
}
function getLucroIds(id) {
  try { return JSON.parse(localStorage.getItem(lucroIdsKey(id)) || '[]') } catch { return [] }
}
function setLucroMes(id, v)   { localStorage.setItem(lucroKey(id), String(v)) }
function setLucroIds(id, ids) { localStorage.setItem(lucroIdsKey(id), JSON.stringify(ids)) }

function registrarLucro(ag) {
  if (!negocioAtual || !ag || !ag._id) return
  const nid  = negocioAtual._id
  const ids  = getLucroIds(nid)
  if (ids.includes(ag._id)) return
  const preco = Number(ag.preco) || 0
  if (preco <= 0) return
  setLucroMes(nid, (getLucroMes(nid) || 0) + preco)
  setLucroIds(nid, [...ids, ag._id])
}

function seedLucroDoMes(ags) {
  if (!negocioAtual) return
  const nid = negocioAtual._id
  const mes = mesAtualChave()
  if (getLucroMes(nid) !== null) return
  setLucroMes(nid, 0)
  ags
    .filter(a => a.status === 'concluido' && a.data?.startsWith(mes))
    .forEach(registrarLucro)
}

function exibirLucro() {
  if (!negocioAtual) return
  const v  = getLucroMes(negocioAtual._id) || 0
  const el = document.getElementById('stat-lucro')
  if (el) el.textContent = fmtBRL(v)
}

/* ═══════════════════════════════════════════════════
   UTILITÁRIOS
═══════════════════════════════════════════════════ */
function fmtBRL(v) {
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function formatarData(data) {
  const [a, m, d] = data.split('-')
  return `${d}/${m}/${a}`
}
function formatarMinutos(min) {
  if (!min || min <= 0) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, '0')}`
}
function formatarCompacto(val) {
  if (val >= 1000) return `${(val / 1000).toFixed(1).replace('.0', '')}k`
  return `${val.toFixed(0)}`
}
function sair() { localStorage.clear(); window.location.href = '/auth.html' }

/* ═══════════════════════════════════════════════════
   TEMA
═══════════════════════════════════════════════════ */
function definirTema(tema) {
  document.body.classList.toggle('dark-mode', tema === 'escuro')
  localStorage.setItem('tema', tema)
  document.getElementById('theme-opt-claro').classList.toggle('ativo', tema === 'claro')
  document.getElementById('theme-opt-escuro').classList.toggle('ativo', tema === 'escuro')
}
function carregarTema() {
  definirTema(localStorage.getItem('tema') || 'claro')
}

/* ═══════════════════════════════════════════════════
   SIDEBAR / NAVEGAÇÃO
═══════════════════════════════════════════════════ */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('aberta')
  document.getElementById('sidebar-overlay').classList.toggle('visivel')
}
function fecharSidebar() {
  document.getElementById('sidebar').classList.remove('aberta')
  document.getElementById('sidebar-overlay').classList.remove('visivel')
}
function irPara(pagina, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('ativo'))
  document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('ativo'))
  document.getElementById(`page-${pagina}`).classList.add('ativo')
  if (btn) btn.classList.add('ativo')
  fecharSidebar()
}

/* ═══════════════════════════════════════════════════
   DROPDOWN DE NEGÓCIOS
═══════════════════════════════════════════════════ */
function toggleDropdown() {
  document.getElementById('neg-dropdown').classList.toggle('show')
  document.getElementById('neg-chevron').classList.toggle('open')
}

// Fecha ao clicar fora
document.addEventListener('click', e => {
  if (!e.target.closest('.negocio-selector')) {
    document.getElementById('neg-dropdown').classList.remove('show')
    document.getElementById('neg-chevron').classList.remove('open')
  }
})

function renderDropdown() {
  document.getElementById('neg-lista').innerHTML = todosNegocios
    .map(n => `
      <div class="negocio-opt ${n._id === negocioAtual?._id ? 'ativo' : ''}"
           onclick="trocarNegocio('${n._id}')">
        <div class="negocio-opt-avatar">${n.nome[0].toUpperCase()}</div>
        ${n.nome}
      </div>`)
    .join('')
}

function trocarNegocio(id) {
  negocioAtual = todosNegocios.find(n => n._id === id)
  localStorage.setItem('negocioId', negocioAtual._id)
  localStorage.setItem('negocio', negocioAtual.nome)
  atualizarSidebarNegocio()
  renderDropdown()
  document.getElementById('neg-dropdown').classList.remove('show')
  document.getElementById('neg-chevron').classList.remove('open')
  carregarDadosNegocio()
}

function atualizarSidebarNegocio() {
  document.getElementById('neg-nome-sidebar').textContent = negocioAtual?.nome || ''
  document.getElementById('neg-avatar').textContent       = (negocioAtual?.nome || 'A')[0].toUpperCase()

  const link    = `https://agendorapido.com.br/agendar.html?id=${negocioAtual?._id}`
  const linkBio = `https://agendorapido.com.br/bio.html?id=${negocioAtual?._id}`
  const elLink  = document.getElementById('link-agendamento')
  const elBio   = document.getElementById('link-bio')
  if (elLink) elLink.textContent = link
  if (elBio)  elBio.textContent  = linkBio

  atualizarLinkWpp()
}

/* ── Modal novo negócio ── */
function abrirModalNegocio() {
  document.getElementById('neg-dropdown').classList.remove('show')
  document.getElementById('neg-nome').value  = ''
  document.getElementById('neg-erro').textContent = ''
  document.getElementById('modal-negocio').style.display = 'flex'
}
function fecharModalNegocio() {
  document.getElementById('modal-negocio').style.display = 'none'
}
async function criarNegocio() {
  const nome     = document.getElementById('neg-nome').value.trim()
  const segmento = document.getElementById('neg-segmento').value
  const erro     = document.getElementById('neg-erro')
  if (!nome) { erro.textContent = 'Digite o nome do negócio'; return }

  const token    = localStorage.getItem('token')
  const servicos = (servicosPorSegmento[segmento] || servicosPorSegmento['Outro'])
    .map(s => ({ nome: s, preco: 0 }))

  const res  = await fetch(`${API}/auth/negocios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ nome, segmento, servicos }),
  })
  const data = await res.json()
  if (!res.ok) { erro.textContent = data.erro || 'Erro ao criar painel'; return }

  todosNegocios.push({ _id: data._id, nome: data.nome, segmento: data.segmento })
  fecharModalNegocio()
  trocarNegocio(data._id)
}

/* ═══════════════════════════════════════════════════
   PAINEL — carregamento inicial
═══════════════════════════════════════════════════ */
async function mostrarPainel() {
  const token = localStorage.getItem('token')
  const res   = await fetch(`${API}/auth/negocios`, { headers: { 'Authorization': `Bearer ${token}` } })
  todosNegocios = await res.json()

  const savedId = localStorage.getItem('negocioId')
  negocioAtual  = todosNegocios.find(n => n._id === savedId) || todosNegocios[0]

  if (negocioAtual) {
    localStorage.setItem('negocioId', negocioAtual._id)
    localStorage.setItem('negocio',   negocioAtual.nome)
  }

  renderDropdown()
  atualizarSidebarNegocio()
  document.getElementById('filtro-data').value = new Date().toISOString().split('T')[0]
  carregarDadosNegocio()
  verificarAcesso()
}

function carregarDadosNegocio() {
  carregarAgendamentos()
  carregarServicos()
  carregarHorariosConfig()
  carregarBioConfig()
  carregarLembretes()
}

/* ═══════════════════════════════════════════════════
   WHATSAPP
═══════════════════════════════════════════════════ */
function atualizarLinkWpp() {
  if (!negocioAtual) return
  const link = `https://agendorapido.com.br/agendar.html?id=${negocioAtual._id}`
  const el   = document.getElementById('wpp-link-agendamento')
  const msg  = document.getElementById('wpp-mensagem-preview')
  if (el)  el.textContent  = link
  if (msg) msg.textContent = `Olá! 👋 Obrigado por entrar em contato com a *${negocioAtual.nome}*.\n\nPara agendar seu horário de forma rápida e fácil, acesse o link abaixo:\n\n🔗 ${link}\n\nEscolha o serviço, a data e o horário que preferir. É rápido e simples! 😊`
}

function copiarLink() {
  navigator.clipboard.writeText(document.getElementById('link-agendamento').textContent)
  flashBtn('btn-copiar-agendamento', '✓ Copiado!')
}
function copiarLinkBio() {
  navigator.clipboard.writeText(document.getElementById('link-bio').textContent)
  flashBtn('btn-copiar-bio', '✓ Copiado!')
}
function copiarLinkWpp() {
  if (!negocioAtual) return
  navigator.clipboard.writeText(`https://agendorapido.com.br/agendar.html?id=${negocioAtual._id}`)
  const btn = document.querySelector('[onclick="copiarLinkWpp()"]')
  if (btn) flash(btn, '✓ Copiado!')
}
function copiarMensagemWpp() {
  const el = document.getElementById('wpp-mensagem-preview')
  if (!el) return
  navigator.clipboard.writeText(el.textContent)
  flashBtn('btn-copiar-msg', '✓ Mensagem copiada!')
}

// Helpers para flash de botão
function flashBtn(id, txt) {
  const btn = document.getElementById(id)
  if (btn) flash(btn, txt)
}
function flash(btn, txt) {
  const orig = btn.innerHTML
  btn.innerHTML = txt
  setTimeout(() => btn.innerHTML = orig, 2000)
}

/* ═══════════════════════════════════════════════════
   AGENDAMENTOS
═══════════════════════════════════════════════════ */
async function carregarAgendamentos() {
  if (!negocioAtual) return
  const token = localStorage.getItem('token')

  const res = await fetch(`${API}/agendamentos?negocioId=${negocioAtual._id}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  todosAgendamentos = await res.json()

  // Auto-concluir agendamentos passados
  const agora    = new Date()
  const passados = todosAgendamentos.filter(a => {
    if (a.status !== 'confirmado' || !a.data || !a.hora) return false
    const [ano, mes, dia] = a.data.split('-').map(Number)
    const [h, m]          = a.hora.split(':').map(Number)
    return new Date(ano, mes - 1, dia, h, m).getTime() < agora.getTime()
  })

  if (passados.length > 0) {
    await Promise.all(passados.map(a =>
      fetch(`${API}/agendamentos/${a._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: 'concluido' }),
      })
    ))
    todosAgendamentos = todosAgendamentos.map(a => {
      const foi = passados.find(p => p._id === a._id)
      if (!foi) return a
      const c = { ...a, status: 'concluido' }
      registrarLucro(c)
      return c
    })
  }

  const hoje  = new Date().toISOString().split('T')[0]
  const semana = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  document.getElementById('stat-total').textContent  = todosAgendamentos.length
  document.getElementById('stat-hoje').textContent   = todosAgendamentos.filter(a => a.data === hoje).length
  document.getElementById('stat-semana').textContent = todosAgendamentos.filter(a => a.data >= hoje && a.data <= semana).length

  seedLucroDoMes(todosAgendamentos)
  exibirLucro()
  renderHistorico()
  filtrarData()
}

/* ── Tabela / paginação ── */
const POR_PAGINA = 8
let paginaAtual  = 1
let listaFiltrada = []

function filtrarData() {
  const data = document.getElementById('filtro-data').value
  listaFiltrada = data
    ? todosAgendamentos.filter(a => a.data === data)
    : todosAgendamentos
  paginaAtual = 1
  renderTabela()
}

function renderTabela() {
  const tbody    = document.getElementById('tbody')
  const agCards  = document.getElementById('ag-cards')
  const paginacao = document.getElementById('paginacao')

  if (!listaFiltrada.length) {
    tbody.innerHTML   = '<tr><td colspan="6" class="vazio">Nenhum agendamento encontrado</td></tr>'
    agCards.innerHTML = '<div class="vazio">Nenhum agendamento encontrado</div>'
    paginacao.style.display = 'none'
    return
  }

  const total  = Math.ceil(listaFiltrada.length / POR_PAGINA)
  const inicio = (paginaAtual - 1) * POR_PAGINA
  const fim    = inicio + POR_PAGINA
  const slice  = listaFiltrada.slice(inicio, fim)

  // Tabela desktop
  tbody.innerHTML = slice.map(a => {
    const acoes = a.status === 'confirmado'
      ? `<button class="btn-acao concluir" onclick="atualizar('${a._id}','concluido')">Concluir</button>
         <button class="btn-acao cancelar" onclick="cancelarComAviso('${a._id}','${a.pacienteNome}','${a.pacienteTelefone}','${a.data}','${a.hora}')">Cancelar</button>`
      : ''
    return `<tr>
      <td>
        <div class="paciente-nome">${a.pacienteNome}</div>
        <div class="paciente-tel">${a.pacienteTelefone}</div>
      </td>
      <td style="color:var(--text2)">${a.servico}</td>
      <td style="color:var(--text2)">${formatarData(a.data)}</td>
      <td style="font-weight:600">${a.hora}</td>
      <td><span class="badge ${a.status}">${a.status}</span></td>
      <td><div class="acoes">${acoes}</div></td>
    </tr>`
  }).join('')

  // Cards mobile
  agCards.innerHTML = slice.map(a => {
    const acoes = a.status === 'confirmado'
      ? `<div class="ag-card-actions">
           <button class="btn-acao concluir" onclick="atualizar('${a._id}','concluido')">Concluir</button>
           <button class="btn-acao cancelar" onclick="cancelarComAviso('${a._id}','${a.pacienteNome}','${a.pacienteTelefone}','${a.data}','${a.hora}')">Cancelar</button>
         </div>`
      : ''
    return `<div class="ag-card">
      <div class="ag-card-top">
        <div>
          <div class="ag-card-nome">${a.pacienteNome}</div>
          <div class="paciente-tel">${a.pacienteTelefone}</div>
        </div>
        <span class="badge ${a.status}">${a.status}</span>
      </div>
      <div class="ag-card-body">
        <div class="ag-chip">${formatarData(a.data)}</div>
        <div class="ag-chip">${a.hora}</div>
        <div class="ag-chip">${a.servico}</div>
      </div>
      ${acoes}
    </div>`
  }).join('')

  // Info e botões de paginação
  document.getElementById('pg-info').textContent =
    `${inicio + 1}–${Math.min(fim, listaFiltrada.length)} de ${listaFiltrada.length}`

  let btns = `<button class="pg-btn" onclick="irPagina(${paginaAtual - 1})" ${paginaAtual === 1 ? 'disabled' : ''}>‹</button>`
  for (let i = 1; i <= total; i++) {
    if (total <= 7 || i === 1 || i === total || Math.abs(i - paginaAtual) <= 1)
      btns += `<button class="pg-btn ${i === paginaAtual ? 'ativo' : ''}" onclick="irPagina(${i})">${i}</button>`
    else if (Math.abs(i - paginaAtual) === 2)
      btns += `<span style="color:var(--text3);font-size:13px;padding:0 2px">…</span>`
  }
  btns += `<button class="pg-btn" onclick="irPagina(${paginaAtual + 1})" ${paginaAtual === total ? 'disabled' : ''}>›</button>`
  document.getElementById('pg-btns').innerHTML = btns

  paginacao.style.display = total > 1 ? 'flex' : 'none'
}

function irPagina(n) {
  const total = Math.ceil(listaFiltrada.length / POR_PAGINA)
  if (n < 1 || n > total) return
  paginaAtual = n
  renderTabela()
  document.getElementById('page-agendamentos').scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function atualizar(id, status) {
  const token = localStorage.getItem('token')
  if (status === 'concluido') {
    const ag = todosAgendamentos.find(a => a._id === id)
    if (ag) registrarLucro(ag)
  }
  await fetch(`${API}/agendamentos/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ status }),
  })
  todosAgendamentos = todosAgendamentos.map(a => a._id === id ? { ...a, status } : a)
  exibirLucro()
  renderHistorico()
  filtrarData()
}

async function cancelarComAviso(id, nome, telefone, data, hora) {
  if (!confirm(`Cancelar agendamento de ${nome}?`)) return
  const token = localStorage.getItem('token')
  await fetch(`${API}/agendamentos/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ status: 'cancelado' }),
  })
  todosAgendamentos = todosAgendamentos.map(a => a._id === id ? { ...a, status: 'cancelado' } : a)
  const [ano, mes, dia] = data.split('-')
  const msg = encodeURIComponent(`Olá ${nome}! Infelizmente precisamos cancelar seu agendamento do dia ${dia}/${mes}/${ano} às ${hora}. Entre em contato para reagendar.`)
  window.open(`https://wa.me/55${telefone.replace(/\D/g, '')}?text=${msg}`, '_blank')
  filtrarData()
}

/* ═══════════════════════════════════════════════════
   MODAL — NOVO AGENDAMENTO
═══════════════════════════════════════════════════ */
function abrirModalNovoAgendamento() {
  if (!negocioAtual) return
  const hoje = new Date().toISOString().split('T')[0]
  document.getElementById('m-data').value       = hoje
  document.getElementById('m-data').min         = hoje
  document.getElementById('m-nome').value       = ''
  document.getElementById('m-telefone').value   = ''
  document.getElementById('m-erro').textContent = ''
  document.getElementById('m-servico').innerHTML = servicosAtuais
    .map(s => {
      const n = typeof s === 'object' ? s.nome : s
      return `<option value="${n}">${n}</option>`
    }).join('')
  document.getElementById('modal-agendamento').style.display = 'flex'
  carregarHorariosModal()
}
function fecharModal() {
  document.getElementById('modal-agendamento').style.display = 'none'
}

async function carregarHorariosModal() {
  const data = document.getElementById('m-data').value
  if (!data || !negocioAtual) return

  const select = document.getElementById('m-hora')
  select.innerHTML = '<option>Carregando...</option>'

  const res      = await fetch(`${API}/agendamentos/horarios-ocupados?clinicaId=${negocioAtual._id}&data=${data}`)
  const resultado = await res.json()

  if (resultado.diaInativo || !resultado.horarios.length) {
    select.innerHTML = '<option value="">Sem horários disponíveis</option>'
    return
  }

  select.innerHTML = resultado.horarios.map(h => {
    const ocu = resultado.ocupados.includes(h)
    return `<option value="${h}" ${ocu ? 'disabled' : ''}>${h}${ocu ? ' (ocupado)' : ''}</option>`
  }).join('')

  const livre = resultado.horarios.find(h => !resultado.ocupados.includes(h))
  if (livre) select.value = livre
}

async function salvarAgendamentoManual() {
  const nome     = document.getElementById('m-nome').value.trim()
  const telefone = document.getElementById('m-telefone').value.trim()
  const servico  = document.getElementById('m-servico').value
  const data     = document.getElementById('m-data').value
  const hora     = document.getElementById('m-hora').value
  const erro     = document.getElementById('m-erro')

  if (!nome) { erro.textContent = 'Digite o nome do cliente'; return }
  if (!hora) { erro.textContent = 'Selecione um horário'; return }
  erro.textContent = ''

  const btn = document.querySelector('.btn-salvar-modal')
  btn.disabled = true; btn.textContent = 'Salvando...'

  const token = localStorage.getItem('token')
  const res   = await fetch(`${API}/agendamentos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ clinicaId: negocioAtual._id, pacienteNome: nome, pacienteTelefone: telefone, servico, data, hora }),
  })
  const resposta = await res.json()
  btn.disabled = false; btn.textContent = 'Confirmar agendamento'

  if (res.ok) { fecharModal(); carregarAgendamentos() }
  else erro.textContent = resposta.erro || 'Erro ao criar agendamento'
}

/* ═══════════════════════════════════════════════════
   SERVIÇOS
═══════════════════════════════════════════════════ */
async function carregarServicos() {
  if (!negocioAtual) return
  const res  = await fetch(`${API}/auth/negocio/${negocioAtual._id}`)
  const data = await res.json()
  servicosAtuais   = (data.servicos || []).map(s => typeof s === 'object' ? s : { nome: s, preco: 0 })
  pagamentosConfig = data.pagamentos || {}
  renderServicos()
  renderIntervalosServicos()
}

function renderServicos() {
  document.getElementById('servicos-tags').innerHTML = servicosAtuais.map((s, i) => {
    const nome  = typeof s === 'object' ? s.nome  : s
    const preco = typeof s === 'object' && s.preco ? Number(s.preco) : 0
    const precoLabel = preco > 0 ? `R$ ${preco.toFixed(2).replace('.', ',')}` : ''
    return `<div class="servico-tag-wrap">
      <span class="servico-tag">
        ${nome}
        ${precoLabel ? `<span class="servico-preco">${precoLabel}</span>` : ''}
        <button onclick="removerServico(${i})" title="Remover">×</button>
      </span>
    </div>`
  }).join('')
}

function adicionarServico() {
  const nomeInput  = document.getElementById('novo-servico')
  const precoInput = document.getElementById('novo-preco')
  const erroEl     = document.getElementById('servico-erro')
  const nome       = nomeInput.value.trim()
  const preco      = parseFloat(precoInput.value)

  erroEl.textContent = ''
  nomeInput.classList.remove('campo-erro')
  precoInput.classList.remove('campo-erro')

  if (!nome) {
    erroEl.textContent = '⚠ Digite o nome do serviço.'
    nomeInput.classList.add('campo-erro'); nomeInput.focus(); return
  }
  if (!precoInput.value.trim() || isNaN(preco) || preco <= 0) {
    erroEl.textContent = '⚠ O preço é obrigatório e deve ser maior que R$ 0,00.'
    precoInput.classList.add('campo-erro'); precoInput.focus(); return
  }
  if (servicosAtuais.some(s => (typeof s === 'object' ? s.nome : s).toLowerCase() === nome.toLowerCase())) {
    erroEl.textContent = '⚠ Já existe um serviço com esse nome.'
    nomeInput.classList.add('campo-erro'); nomeInput.focus(); return
  }

  servicosAtuais.push({ nome, preco })
  nomeInput.value = ''; precoInput.value = ''
  renderServicos()
  renderIntervalosServicos()
}

function removerServico(i) {
  const nome = typeof servicosAtuais[i] === 'object' ? servicosAtuais[i].nome : servicosAtuais[i]
  delete intervalosServicos[nome]
  servicosAtuais.splice(i, 1)
  renderServicos()
  renderIntervalosServicos()
}

async function salvarServicos() {
  if (!negocioAtual) return
  const token = localStorage.getItem('token')
  await fetch(`${API}/auth/servicos`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ negocioId: negocioAtual._id, servicos: servicosAtuais }),
  })
  mostrarSalvo('salvo-msg')
}

// Enter nos campos de serviço
document.addEventListener('DOMContentLoaded', () => {
  ['novo-servico', 'novo-preco'].forEach(id => {
    const el = document.getElementById(id)
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); adicionarServico() } })
  })
})

/* ═══════════════════════════════════════════════════
   INTERVALO PADRÃO
═══════════════════════════════════════════════════ */
function selecionarIntervalo(btn, valor) {
  document.querySelectorAll('.intervalo-btn').forEach(b => b.classList.remove('selecionado'))
  btn.classList.add('selecionado')
  intervaloAtual     = valor
  intervaloCustomAtivo = false
  document.getElementById('intervalo-custom-wrap').classList.remove('visivel')
}

function selecionarIntervaloCustom(btn) {
  document.querySelectorAll('.intervalo-btn').forEach(b => b.classList.remove('selecionado'))
  btn.classList.add('selecionado')
  intervaloCustomAtivo = true
  const wrap  = document.getElementById('intervalo-custom-wrap')
  wrap.classList.add('visivel')
  const input = document.getElementById('intervalo-custom')
  const preds = OPCOES_INTERVALO.map(o => o.valor)
  input.value = preds.includes(intervaloAtual) ? '' : intervaloAtual
  input.focus()
}

function atualizarIntervaloCustom(val) {
  const n = parseInt(val)
  if (!isNaN(n) && n >= 5 && n <= 480) intervaloAtual = n
}

function aplicarSelecaoIntervalo(valor) {
  const preds   = OPCOES_INTERVALO.map(o => o.valor)
  const btns    = document.querySelectorAll('.intervalo-btn:not(.custom-btn)')
  btns.forEach((btn, i) => btn.classList.toggle('selecionado', OPCOES_INTERVALO[i].valor === valor))

  const customBtn  = document.getElementById('btn-custom-intervalo')
  const customWrap = document.getElementById('intervalo-custom-wrap')

  if (!preds.includes(valor)) {
    customBtn.classList.add('selecionado')
    customWrap.classList.add('visivel')
    document.getElementById('intervalo-custom').value = valor
    intervaloCustomAtivo = true
  } else {
    customBtn.classList.remove('selecionado')
    customWrap.classList.remove('visivel')
    intervaloCustomAtivo = false
  }
}

/* ═══════════════════════════════════════════════════
   INTERVALO POR SERVIÇO
═══════════════════════════════════════════════════ */
function renderIntervalosServicos() {
  const grid = document.getElementById('servicos-intervalos-grid')
  if (!grid) return
  if (!servicosAtuais.length) {
    grid.innerHTML = `<div class="servicos-vazio"><div class="servicos-vazio-icon">🛠️</div>Adicione serviços em <strong>Configurações → Serviços</strong> para configurar durações individuais.</div>`
    return
  }

  const opcoesHtml = [
    ['0','Usar padrão'],['5','5 min'],['10','10 min'],['15','15 min'],
    ['20','20 min'],['25','25 min'],['30','30 min'],['45','45 min'],
    ['60','1 hora'],['75','1h15'],['90','1h30'],['105','1h45'],
    ['120','2 horas'],['150','2h30'],['180','3 horas'],['240','4 horas'],
    ['300','5 horas'],['360','6 horas'],['custom','Personalizado...'],
  ].map(([v, l]) => `<option value="${v}">${l}</option>`).join('')

  grid.innerHTML = servicosAtuais.map(s => {
    const nome    = typeof s === 'object' ? s.nome  : s
    const preco   = typeof s === 'object' && s.preco ? Number(s.preco) : 0
    const duracao = intervalosServicos[nome] || 0
    const precoLabel = preco > 0 ? `R$ ${preco.toFixed(2).replace('.', ',')}` : ''
    const badgeClass = duracao > 0 ? 'custom' : ''
    const badgeLabel = duracao > 0 ? formatarMinutos(duracao) : `Padrão (${formatarMinutos(intervaloAtual)})`

    return `<div class="servico-intervalo-card">
      <div class="servico-intervalo-info">
        <div class="servico-intervalo-nome">${nome}</div>
        ${precoLabel ? `<div class="servico-intervalo-preco">${precoLabel}</div>` : ''}
      </div>
      <span class="servico-intervalo-badge ${badgeClass}" id="badge-${nome.replace(/\s+/g, '-')}">${badgeLabel}</span>
      <select class="servico-intervalo-select" data-servico="${nome}" onchange="alterarIntervaloServico(this)">${opcoesHtml}</select>
    </div>`
  }).join('')

  // Selecionar valor correto em cada select
  const preds = [0,5,10,15,20,25,30,45,60,75,90,105,120,150,180,240,300,360]
  servicosAtuais.forEach(s => {
    const nome    = typeof s === 'object' ? s.nome : s
    const duracao = intervalosServicos[nome] || 0
    const select  = grid.querySelector(`[data-servico="${nome}"]`)
    if (!select) return
    if (duracao === 0 || preds.includes(duracao)) {
      select.value = String(duracao)
    } else {
      const opt = document.createElement('option')
      opt.value = String(duracao); opt.textContent = formatarMinutos(duracao)
      select.insertBefore(opt, select.querySelector('[value="custom"]'))
      select.value = String(duracao)
    }
  })
}

function alterarIntervaloServico(select) {
  const nome = select.dataset.servico
  const val  = select.value

  if (val === 'custom') {
    const customVal = prompt(`Digite a duração em minutos para "${nome}":`, intervalosServicos[nome] || 60)
    if (customVal === null) { select.value = String(intervalosServicos[nome] || 0); return }
    const min = parseInt(customVal)
    if (isNaN(min) || min < 1 || min > 720) { alert('Informe um valor entre 1 e 720 minutos.'); select.value = String(intervalosServicos[nome] || 0); return }
    intervalosServicos[nome] = min
    if (!select.querySelector(`[value="${min}"]`)) {
      const opt = document.createElement('option')
      opt.value = String(min); opt.textContent = formatarMinutos(min)
      select.insertBefore(opt, select.querySelector('[value="custom"]'))
    }
    select.value = String(min)
  } else {
    const min = parseInt(val)
    if (min === 0) delete intervalosServicos[nome]; else intervalosServicos[nome] = min
  }

  const badge = document.getElementById(`badge-${nome.replace(/\s+/g, '-')}`)
  if (badge) {
    const d = intervalosServicos[nome] || 0
    badge.textContent = d > 0 ? formatarMinutos(d) : `Padrão (${formatarMinutos(intervaloAtual)})`
    badge.className   = `servico-intervalo-badge ${d > 0 ? 'custom' : ''}`
  }
}

async function salvarIntervalosServicos() {
  if (!negocioAtual) return
  await patchHorarios()
  mostrarSalvo('salvo-intervalos-servicos')
}

/* ═══════════════════════════════════════════════════
   HORÁRIOS
═══════════════════════════════════════════════════ */
function renderDias() {
  document.getElementById('dias-container').innerHTML = diasNomes.map((nome, i) => {
    const cfg = horariosConfig[i] || { ativo: false, inicio: '08:00', fim: '18:00' }
    return `<div class="dia-row ${cfg.ativo ? '' : 'dia-inativo'}" id="dia-row-${i}">
      <div class="dia-toggle">
        <input type="checkbox" id="dia-${i}" ${cfg.ativo ? 'checked' : ''} onchange="toggleDia(${i})">
        <label for="dia-${i}">${nome}</label>
      </div>
      <div class="dia-horarios">
        <span>Das</span>
        <input type="time" id="inicio-${i}" value="${cfg.inicio}" />
        <span>às</span>
        <input type="time" id="fim-${i}"   value="${cfg.fim}" />
      </div>
    </div>`
  }).join('')
}

function toggleDia(i) {
  document.getElementById(`dia-row-${i}`).classList.toggle('dia-inativo', !document.getElementById(`dia-${i}`).checked)
}

async function carregarHorariosConfig() {
  if (!negocioAtual) return
  const res  = await fetch(`${API}/auth/negocio/${negocioAtual._id}`)
  const data = await res.json()
  horariosConfig     = data.horarios || {}
  intervaloAtual     = data.intervalo || 30
  pausasAtuais       = data.pausas || []
  intervalosServicos = data.intervalosServicos || {}
  renderPausas()
  aplicarSelecaoIntervalo(intervaloAtual)
  renderDias()
  renderIntervalosServicos()
}

async function salvarHorarios() {
  if (!negocioAtual) return
  diasNomes.forEach((_, i) => {
    horariosConfig[i] = {
      ativo:  document.getElementById(`dia-${i}`).checked,
      inicio: document.getElementById(`inicio-${i}`).value,
      fim:    document.getElementById(`fim-${i}`).value,
    }
  })
  await patchHorarios()
  mostrarSalvo('salvo-horarios')
}

// Helper compartilhado: salva tudo de horários num único PATCH
async function patchHorarios() {
  const token = localStorage.getItem('token')
  await fetch(`${API}/auth/horarios`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      negocioId: negocioAtual._id,
      horarios:  horariosConfig,
      intervalo: intervaloAtual,
      pausas:    pausasAtuais,
      intervalosServicos,
    }),
  })
}

/* ═══════════════════════════════════════════════════
   PAUSAS
═══════════════════════════════════════════════════ */
function mascaraHora(inp) {
  let v = inp.value.replace(/\D/g, '').slice(0, 4)
  if (v.length >= 3) v = v.slice(0, 2) + ':' + v.slice(2)
  inp.value = v
}

function renderPausas() {
  const lista = document.getElementById('pausas-lista')
  if (!pausasAtuais.length) {
    lista.innerHTML = '<p style="font-size:12.5px;color:var(--text3);padding:8px 0">Nenhuma pausa configurada</p>'
    return
  }
  lista.innerHTML = pausasAtuais.map((p, i) => `
    <div class="pausa-item">
      <span class="pausa-item-label">${p.label || 'Pausa'}</span>
      <span class="pausa-item-hora">${p.inicio} – ${p.fim}</span>
      <button onclick="removerPausa(${i})"
        style="margin-left:auto;background:none;border:none;color:var(--text3);cursor:pointer;font-size:18px;line-height:1;padding:2px 4px;border-radius:5px;transition:all .15s"
        onmouseover="this.style.color='var(--red)';this.style.background='var(--red-bg)'"
        onmouseout="this.style.color='var(--text3)';this.style.background='none'">×</button>
    </div>`).join('')
}

function adicionarPausa() {
  const inicio = document.getElementById('pausa-inicio').value
  const fim    = document.getElementById('pausa-fim').value
  const label  = document.getElementById('pausa-label').value.trim() || 'Pausa'
  if (!inicio || !fim) { alert('Preencha o horário de início e fim'); return }
  if (inicio >= fim)   { alert('O horário de início deve ser anterior ao fim'); return }
  pausasAtuais.push({ inicio, fim, label })
  document.getElementById('pausa-inicio').value = ''
  document.getElementById('pausa-fim').value    = ''
  document.getElementById('pausa-label').value  = ''
  renderPausas()
}

function removerPausa(i) { pausasAtuais.splice(i, 1); renderPausas() }

async function salvarPausas() {
  if (!negocioAtual) return
  await patchHorarios()
  mostrarSalvo('salvo-pausas')
}

/* ═══════════════════════════════════════════════════
   BIO
═══════════════════════════════════════════════════ */
async function carregarBioConfig() {
  if (!negocioAtual) return
  const res  = await fetch(`${API}/auth/negocio/${negocioAtual._id}`)
  const data = await res.json()
  const bio  = data.bio || {}
  document.getElementById('bio-foto').value      = bio.foto      || ''
  document.getElementById('bio-descricao').value = bio.descricao || ''
  document.getElementById('bio-endereco').value  = bio.endereco  || ''
  document.getElementById('bio-instagram').value = bio.instagram || ''
  document.getElementById('bio-whatsapp').value  = bio.whatsapp  || ''
  const prev = document.getElementById('foto-preview')
  prev.innerHTML = bio.foto ? `<img src="${bio.foto}">` : '👤'
}

async function salvarBio() {
  if (!negocioAtual) return
  const token = localStorage.getItem('token')
  await fetch(`${API}/auth/bio`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      negocioId: negocioAtual._id,
      foto:      document.getElementById('bio-foto').value,
      descricao: document.getElementById('bio-descricao').value,
      endereco:  document.getElementById('bio-endereco').value,
      instagram: document.getElementById('bio-instagram').value,
      whatsapp:  document.getElementById('bio-whatsapp').value,
    }),
  })
  mostrarSalvo('salvo-bio')
}

async function uploadFoto(input) {
  const file = input.files[0]
  if (!file) return
  document.getElementById('foto-status').textContent = 'Enviando...'
  const reader = new FileReader()
  reader.onload = async e => {
    const token = localStorage.getItem('token')
    const res   = await fetch(`${API}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ imagem: e.target.result }),
    })
    const data = await res.json()
    if (res.ok) {
      document.getElementById('bio-foto').value        = data.url
      document.getElementById('foto-status').textContent = '✓ Foto enviada!'
      document.getElementById('foto-preview').innerHTML  = `<img src="${data.url}">`
    } else {
      document.getElementById('foto-status').textContent = 'Erro ao enviar foto'
    }
  }
  reader.readAsDataURL(file)
}

/* ═══════════════════════════════════════════════════
   LEMBRETES
═══════════════════════════════════════════════════ */
function atualizarToggleVisual(ativo) {
  const track = document.getElementById('toggle-track')
  const thumb = document.getElementById('toggle-thumb')
  if (!track || !thumb) return
  track.style.background = ativo ? 'var(--accent)' : ''
  thumb.style.left       = ativo ? '24px' : '3px'
  document.getElementById('lembrete-info').style.display = ativo ? 'block' : 'none'
}

async function carregarLembretes() {
  if (!negocioAtual) return
  const res      = await fetch(`${API}/auth/negocio/${negocioAtual._id}`)
  const data     = await res.json()
  const lembrete = data.lembrete || {}
  const checkbox = document.getElementById('toggle-lembrete')
  if (checkbox) checkbox.checked = !!lembrete.ativo
  atualizarToggleVisual(!!lembrete.ativo)
  if (lembrete.mensagem) document.getElementById('lembrete-msg').value = lembrete.mensagem
}

async function salvarLembrete() {
  const ativo = document.getElementById('toggle-lembrete').checked
  atualizarToggleVisual(ativo)
  if (!negocioAtual) return
  const token = localStorage.getItem('token')
  await fetch(`${API}/auth/lembretes`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ negocioId: negocioAtual._id, ativo }),
  })
}

async function salvarConfLembrete() {
  if (!negocioAtual) return
  const token = localStorage.getItem('token')
  await fetch(`${API}/auth/lembretes`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      negocioId: negocioAtual._id,
      ativo:     document.getElementById('toggle-lembrete').checked,
      mensagem:  document.getElementById('lembrete-msg').value,
    }),
  })
  mostrarSalvo('salvo-lembrete')
}

/* ═══════════════════════════════════════════════════
   ACESSO / TRIAL
═══════════════════════════════════════════════════ */
async function verificarAcesso() {
  const token = localStorage.getItem('token')
  if (!token) return
  const res  = await fetch(`${API}/assinatura/status`, { headers: { 'Authorization': `Bearer ${token}` } })
  const data = await res.json()

  if (!data.temAcesso) { document.getElementById('bloqueio').style.display = 'flex'; return }

  if (data.plano === 'trial' && data.diasRestantes <= 7) {
    const banner = document.createElement('div')
    banner.className = 'trial-banner'
    banner.innerHTML = `<p>⏰ Seu trial expira em <strong>${data.diasRestantes} dias</strong>. Assine para não perder o acesso.</p>
      <button class="btn-assinar-banner" onclick="window.location.href='/planos.html'">Ver planos</button>`
    document.querySelector('.main').prepend(banner)
  }
}

/* ═══════════════════════════════════════════════════
   HISTÓRICO MENSAL
═══════════════════════════════════════════════════ */
let historicoMesOffset = 0

function chaveDoOffset(offset) {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + offset)
  return d.toISOString().slice(0, 7)
}
function formatarMesLabel(chave) {
  const [ano, mes] = chave.split('-').map(Number)
  const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  return `${nomes[mes - 1]} ${ano}`
}
function dadosMes(negocioId, chave) {
  const lucro = parseFloat(localStorage.getItem(`lucro_val_${negocioId}_${chave}`)) || 0
  const ids   = (() => { try { return JSON.parse(localStorage.getItem(`lucro_ids_${negocioId}_${chave}`) || '[]') } catch { return [] } })()
  return { lucro, atendimentos: ids.length }
}

function renderHistorico() {
  if (!negocioAtual) return
  const nid   = negocioAtual._id
  const chav  = chaveDoOffset(historicoMesOffset)
  const dados = dadosMes(nid, chav)

  document.getElementById('hist-mes-label').textContent = historicoMesOffset === 0 ? 'Este mês' : formatarMesLabel(chav)
  document.getElementById('hist-next').disabled         = historicoMesOffset >= 0

  const { lucro, atendimentos: atend } = dados
  const ticket = atend > 0 ? lucro / atend : 0

  document.getElementById('hist-lucro').textContent  = fmtBRL(lucro)
  document.getElementById('hist-atend').textContent  = atend
  document.getElementById('hist-ticket').textContent = fmtBRL(ticket)

  // Gráfico dos últimos 6 meses
  const meses = []
  for (let i = -5; i <= 0; i++) {
    const c = chaveDoOffset(i)
    const d = dadosMes(nid, c)
    meses.push({ chave: c, offset: i, lucro: d.lucro, atend: d.atendimentos })
  }
  const maxLucro = Math.max(...meses.map(m => m.lucro), 1)

  document.getElementById('hist-grafico').innerHTML = meses.map(m => {
    const pct   = Math.max((m.lucro / maxLucro) * 100, m.lucro > 0 ? 4 : 0)
    const ativo = m.chave === chav
    const zero  = m.lucro === 0
    return `<div class="hist-barra-wrap" onclick="historicoIrPara(${m.offset})" title="${formatarMesLabel(m.chave)}: ${fmtBRL(m.lucro)}">
      <span class="hist-barra-val">${formatarCompacto(m.lucro)}</span>
      <div class="hist-barra ${ativo ? 'ativo' : ''} ${zero ? 'zero' : ''}" style="height:${pct}%"></div>
    </div>`
  }).join('')

  const nomesM = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  document.getElementById('hist-grafico-labels').innerHTML = meses.map(m => {
    const mes = parseInt(m.chave.split('-')[1]) - 1
    return `<div class="hist-grafico-label ${m.chave === chav ? 'ativo' : ''}">${nomesM[mes]}</div>`
  }).join('')
}

function historicoPaginar(dir) {
  const novo = historicoMesOffset + dir
  if (novo > 0) return
  historicoMesOffset = novo
  renderHistorico()
}
function historicoIrPara(offset) {
  if (offset > 0) return
  historicoMesOffset = offset
  renderHistorico()
}

/* ═══════════════════════════════════════════════════
   HELPER — exibir mensagem "salvo"
═══════════════════════════════════════════════════ */
function mostrarSalvo(id) {
  const el = document.getElementById(id)
  if (!el) return
  el.style.display = 'inline'
  setTimeout(() => el.style.display = 'none', 2500)
}

/* ═══════════════════════════════════════════════════
   PWA — INSTALAR APP
   - Chrome/Edge/Android: instala direto via prompt nativo
   - Já instalado (standalone): esconde o botão
   - Outros navegadores: não faz nada (sem toast, sem alert)
═══════════════════════════════════════════════════ */
let deferredPrompt = null

// Registra Service Worker silenciosamente
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}

// Captura o prompt nativo (Chrome/Edge/Android/Desktop)
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault()
  deferredPrompt = e
})

// Após instalação concluída — esconde o botão
window.addEventListener('appinstalled', () => {
  deferredPrompt = null
  const btn = document.getElementById('btn-instalar-app')
  if (btn) btn.style.display = 'none'
})

document.getElementById('btn-instalar-app').onclick = function () {
  // Se já está rodando como PWA instalado — esconde o botão
  const isStandalone =
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  if (isStandalone) { this.style.display = 'none'; return }

  // Prompt nativo disponível → instala direto
  if (deferredPrompt) {
    deferredPrompt.prompt()
    deferredPrompt.userChoice.then(() => { deferredPrompt = null })
    return
  }

  // Navegador não suporta → não faz nada
}

/* ═══════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════ */
carregarTema()

const _token = localStorage.getItem('token')
if (_token) { mostrarPainel() } else { window.location.href = '/auth.html' }