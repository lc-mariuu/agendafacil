/* ═══════════════════════════════════════════════════
   CONSTANTES E ESTADO GLOBAL
═══════════════════════════════════════════════════ */
const API = 'https://agendafacil-wf3q.onrender.com/api'

var todosAgendamentos  = []
var servicosAtuais     = []
var intervaloAtual     = 30
var intervaloCustomAtivo = false
var intervalosServicos = {}
var horariosConfig     = {}
var negocioAtual       = null
var todosNegocios      = []
var pausasAtuais       = []
var pagamentosConfig   = {}

var agFiltroAtivo     = 'todos'
var agFiltroDataAtivo = ''
var agPagina          = 1
var agPorPagina       = 10
var agListaFiltrada   = []

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

const srStyle = document.createElement('style')
srStyle.textContent = `
  .sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
  body.modal-open{overflow:hidden}
  :focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  button:focus-visible,a:focus-visible,[tabindex]:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}
  .notif-dot-badge{position:absolute;top:5px;right:5px;width:8px;height:8px;border-radius:50%;background:var(--red);border:2px solid var(--bg)}
  .badge.agendado{background:rgba(59,130,246,0.12);color:#60a5fa;border:1px solid rgba(59,130,246,0.25)}
`
document.head.appendChild(srStyle)

/* ═══════════════════════════════════════════════════
   LINKS — usa ?id= para compatibilidade com o backend
═══════════════════════════════════════════════════ */
const BASE_URL = 'https://agendorapido.com.br'

function urlAgendamento(negocio) {
  if (!negocio) return ''
  return `${BASE_URL}/agendar.html?id=${negocio._id}`
}

function urlBio(negocio) {
  if (!negocio) return ''
  return `${BASE_URL}/bio.html?id=${negocio._id}`
}

function atualizarTodosLinks(negocio) {
  if (!negocio) return
  const ag  = urlAgendamento(negocio)
  const bio = urlBio(negocio)

  const elAg = document.getElementById('link-agendamento')
  if (elAg) elAg.textContent = ag

  const elBio = document.getElementById('link-bio')
  if (elBio) elBio.textContent = bio

  const elWppLink = document.getElementById('wpp-link-agendamento')
  if (elWppLink) elWppLink.textContent = ag

  const elMsg = document.getElementById('wpp-mensagem-preview')
  if (elMsg) {
    elMsg.textContent =
      `Olá! 👋 Obrigado por entrar em contato com a *${negocio.nome}*.\n\n` +
      `Para agendar seu horário, acesse:\n\n` +
      `🔗 ${ag}\n\n` +
      `Escolha o serviço, data e horário. Rápido e fácil! 😊`
  }

  if (typeof atualizarPreviewAuto === 'function') atualizarPreviewAuto()
}

/* ═══════════════════════════════════════════════════
   EXPIRAÇÃO VISUAL DE CONCLUÍDOS (1 hora)
   Lucros, stats e insights ficam intactos no localStorage
═══════════════════════════════════════════════════ */
function conclusaoKey(id) {
  return `ag_concluido_em_${id}`
}

function registrarConclusao(id) {
  // Só registra se ainda não tiver — preserva o timestamp original
  if (!localStorage.getItem(conclusaoKey(id))) {
    localStorage.setItem(conclusaoKey(id), String(Date.now()))
  }
}

function concluídoExpirado(id) {
  const HORA_EM_MS = 60 * 60 * 1000
  const salvo = localStorage.getItem(conclusaoKey(id))
  if (!salvo) return false
  return (Date.now() - Number(salvo)) > HORA_EM_MS
}

// Filtra a lista removendo concluídos com mais de 1h — só visual
// Lucros e stats já foram calculados antes desta chamada
function filtrarExpirados(lista) {
  return lista.filter(a => {
    if (a.status !== 'concluido') return true
    return !concluídoExpirado(a._id)
  })
}

/* ═══════════════════════════════════════════════════
   LUCRO — localStorage helpers
═══════════════════════════════════════════════════ */
function mesAtualChave() { return new Date().toISOString().slice(0, 7) }
function lucroKey(id)    { return `lucro_val_${id}_${mesAtualChave()}` }
function lucroIdsKey(id) { return `lucro_ids_${id}_${mesAtualChave()}` }
function getLucroMes(id) { const v = localStorage.getItem(lucroKey(id)); return v !== null ? parseFloat(v) : null }
function getLucroIds(id) { try { return JSON.parse(localStorage.getItem(lucroIdsKey(id)) || '[]') } catch { return [] } }
function setLucroMes(id, v)   { localStorage.setItem(lucroKey(id), String(v)) }
function setLucroIds(id, ids) { localStorage.setItem(lucroIdsKey(id), JSON.stringify(ids)) }

function registrarLucro(ag) {
  if (!negocioAtual || !ag || !ag._id) return
  const nid = negocioAtual._id
  const ids = getLucroIds(nid)
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
  const idsJaSalvos = new Set(getLucroIds(nid))
  ags
    .filter(a => a.status === 'concluido' && a.data && a.data.startsWith(mes))
    .forEach(a => {
      if (!idsJaSalvos.has(a._id)) {
        const preco = Number(a.preco) || 0
        if (preco > 0) {
          setLucroMes(nid, (getLucroMes(nid) || 0) + preco)
          idsJaSalvos.add(a._id)
          setLucroIds(nid, [...idsJaSalvos])
        }
      }
    })
}

function exibirLucro() {
  if (!negocioAtual) return
  const v = getLucroMes(negocioAtual._id) || 0
  const el = document.getElementById('stat-lucro')
  if (el) el.textContent = fmtBRL(v)
}

function salvarStatsPersistentes(qtdHoje, qtdSemana) {
  if (!negocioAtual) return
  const nid = negocioAtual._id
  const savedHoje   = parseInt(localStorage.getItem(`stat_hoje_${nid}`)) || 0
  const savedSemana = parseInt(localStorage.getItem(`stat_semana_${nid}`)) || 0
  if (qtdHoje   > savedHoje)   localStorage.setItem(`stat_hoje_${nid}`, String(qtdHoje))
  if (qtdSemana > savedSemana) localStorage.setItem(`stat_semana_${nid}`, String(qtdSemana))
}

function carregarStatsSalvas() {
  if (!negocioAtual) return
  const nid = negocioAtual._id
  const elH = document.getElementById('stat-hoje')
  const elS = document.getElementById('stat-semana')
  const qtdH = localStorage.getItem(`stat_hoje_${nid}`)
  const qtdS = localStorage.getItem(`stat_semana_${nid}`)
  if (elH && qtdH !== null) elH.textContent = qtdH
  if (elS && qtdS !== null) elS.textContent = qtdS
  exibirLucro()
  atualizarInsights()
}

/* ═══════════════════════════════════════════════════
   UTILITÁRIOS
═══════════════════════════════════════════════════ */
function fmtBRL(v) { return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function formatarData(data) { if (!data) return ''; const [a,m,d] = data.split('-'); return `${d}/${m}/${a}` }
function formatarMinutos(min) {
  if (!min || min <= 0) return '—'
  const h = Math.floor(min / 60); const m = min % 60
  if (h === 0) return `${m} min`; if (m === 0) return `${h}h`; return `${h}h${String(m).padStart(2,'0')}`
}
function formatarCompacto(val) { if (val >= 1000) return `${(val/1000).toFixed(1).replace('.0','')}k`; return `${val.toFixed(0)}` }
function sair() { localStorage.clear(); window.location.href = '/auth.html' }
function mostrarSalvo(id) { const el = document.getElementById(id); if (!el) return; el.style.display = 'inline'; setTimeout(() => el.style.display = 'none', 2500) }
function flash(btn, txt) { const orig = btn.innerHTML; btn.innerHTML = txt; btn.disabled = true; setTimeout(() => { btn.innerHTML = orig; btn.disabled = false }, 2000) }
function flashBtn(id, txt) { const btn = document.getElementById(id); if (btn) flash(btn, txt) }

function openModal(id) {
  const el = document.getElementById(id); if (!el) return
  el.style.display = 'flex'; document.body.classList.add('modal-open')
  const fi = el.querySelector('input, select, textarea, button:not(.modal-close)')
  if (fi) setTimeout(() => fi.focus(), 50)
}
function closeModal(id) { const el = document.getElementById(id); if (el) { el.style.display = 'none'; document.body.classList.remove('modal-open') } }

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    ['modal-agendamento','modal-negocio','modal-gerenciar-dias','cfg-modal-editar','modal-link-curto'].forEach(id => {
      const el = document.getElementById(id); if (el && el.style.display !== 'none') closeModal(id)
    })
    if (buscaAberta) fecharBusca()
  }
})

function avatarColor(nome) {
  const colors = [['#1d4ed8','#3b82f6'],['#7c3aed','#8b5cf6'],['#0e7490','#06b6d4'],['#15803d','#22c55e'],['#b45309','#f59e0b'],['#be185d','#ec4899'],['#0369a1','#38bdf8'],['#6d28d9','#a78bfa']]
  let h = 0; for (const c of (nome||'A')) h = ((h<<5)-h)+c.charCodeAt(0); return colors[Math.abs(h)%colors.length]
}

/* ═══════════════════════════════════════════════════
   TEMA
═══════════════════════════════════════════════════ */
function definirTema(tema) {
  document.body.classList.remove('dark-mode','light-mode')
  document.body.classList.add(tema === 'claro' ? 'light-mode' : 'dark-mode')
  localStorage.setItem('tema', tema)
  const m = document.querySelector('meta[name="theme-color"]:not([media])') || document.createElement('meta')
  m.name = 'theme-color'; m.content = tema === 'claro' ? '#f0f4f8' : '#0b0f1a'
  if (!m.parentNode) document.head.appendChild(m)
}
function carregarTema() { definirTema(localStorage.getItem('tema') || 'escuro') }
function toggleTema() { definirTema(localStorage.getItem('tema') === 'claro' ? 'escuro' : 'claro') }

/* ═══════════════════════════════════════════════════
   SIDEBAR / NAVEGAÇÃO
═══════════════════════════════════════════════════ */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar')
  const overlay = document.getElementById('sidebar-overlay')
  const btn = document.getElementById('btn-hamburger')
  const aberta = sidebar.classList.toggle('aberta')
  overlay.classList.toggle('visivel', aberta)
  overlay.setAttribute('aria-hidden', !aberta)
  if (btn) btn.setAttribute('aria-expanded', aberta)
}
function fecharSidebar() {
  const sidebar = document.getElementById('sidebar')
  const overlay = document.getElementById('sidebar-overlay')
  const btn = document.getElementById('btn-hamburger')
  sidebar.classList.remove('aberta')
  overlay.classList.remove('visivel')
  overlay.setAttribute('aria-hidden','true')
  if (btn) btn.setAttribute('aria-expanded','false')
}

function irPara(pagina, btn) {
  document.querySelectorAll('.page').forEach(p => { p.classList.remove('ativo'); p.setAttribute('aria-hidden','true') })
  document.querySelectorAll('.menu-item').forEach(m => { m.classList.remove('ativo'); m.removeAttribute('aria-current') })
  const page = document.getElementById(`page-${pagina}`)
  if (page) { page.classList.add('ativo'); page.setAttribute('aria-hidden','false') }
  if (btn)  { btn.classList.add('ativo'); btn.setAttribute('aria-current','page') }
  fecharSidebar()
  const titulos = {
    dashboard:['Dashboard','Painel de controle do seu negócio'],
    agendamentos:['Agendamentos','Lista completa de agendamentos'],
    clientes:['Clientes','Todos os seus clientes'],
    horarios:['Horários','Configure seus horários de atendimento'],
    lembretes:['Automação','Lembretes automáticos via WhatsApp'],
    whatsapp:['WhatsApp Auto','Configure o WhatsApp Business'],
    bio:['Minha Bio','Sua página pública para o Instagram'],
    configuracoes:['Configurações','Serviços e aparência do painel'],
    pagamentos:['Pagamentos','Cobrança antecipada via Pix'],
    suporte:['Suporte','Estamos aqui para ajudar você'],
  }
  const t = titulos[pagina]
  if (t) {
    const el = document.getElementById('topbar-page-title'); const sub = document.getElementById('topbar-page-sub')
    if (el) el.textContent = t[0]; if (sub) sub.textContent = t[1]
    document.title = `AgendoRapido — ${t[0]}`
    const mobileTitle = document.getElementById('topbar-mobile-title')
    const mobileSub   = document.getElementById('topbar-mobile-sub')
    if (mobileTitle) mobileTitle.textContent = t[0]
    if (mobileSub)   mobileSub.textContent   = t[1]
  }
  if (pagina === 'clientes') renderClientes('')
  if (pagina === 'horarios') setTimeout(() => renderHorariosDiasLateral(), 100)
  if (pagina === 'configuracoes') cfgRenderServicos()
  if (pagina === 'agendamentos') {
    agFiltroAtivo = 'todos'; agFiltroDataAtivo = ''
    const di = document.getElementById('ag-filtro-data'); if (di) di.value = ''
    document.querySelectorAll('.ag-tab').forEach(b => { b.classList.remove('ativo'); b.setAttribute('aria-selected','false') })
    const primTab = document.querySelector('.ag-tab[data-filtro="todos"]')
    if (primTab) { primTab.classList.add('ativo'); primTab.setAttribute('aria-selected','true') }
    agAplicarFiltro()
  }
}

/* ═══════════════════════════════════════════════════
   DROPDOWN DE NEGÓCIOS
═══════════════════════════════════════════════════ */
function toggleDropdown() {
  document.getElementById('neg-dropdown').classList.toggle('show')
  document.getElementById('neg-chevron').classList.toggle('open')
}

document.addEventListener('click', e => {
  if (!e.target.closest('.negocio-selector') &&
      !e.target.closest('#notif-panel') &&
      !e.target.closest('#msg-panel') &&
      !e.target.closest('#avatar-menu') &&
      !e.target.closest('.topbar-icon-btn') &&
      !e.target.closest('#topbar-avatar-btn') &&
      !e.target.closest('.topbar-mobile-btn')) {
    fecharTodosDropdowns()
  }
})

function renderDropdown() {
  document.getElementById('neg-lista').innerHTML = todosNegocios.map(n =>
    `<div class="negocio-opt ${n._id===negocioAtual?._id?'ativo':''}" onclick="trocarNegocio('${n._id}')"><div class="negocio-opt-avatar">${n.nome[0].toUpperCase()}</div>${n.nome}</div>`
  ).join('')
}

function trocarNegocio(id) {
  negocioAtual = todosNegocios.find(n => n._id === id)
  localStorage.setItem('negocioId', negocioAtual._id); localStorage.setItem('negocio', negocioAtual.nome)
  atualizarSidebarNegocio(); renderDropdown()
  document.getElementById('neg-dropdown').classList.remove('show'); document.getElementById('neg-chevron').classList.remove('open')
  carregarDadosNegocio()
}

function atualizarSidebarNegocio() {
  if (!negocioAtual) return
  document.getElementById('neg-nome-sidebar').textContent = negocioAtual.nome || ''
  document.getElementById('neg-avatar').textContent = (negocioAtual.nome||'A')[0].toUpperCase()
  atualizarTodosLinks(negocioAtual)
}

function abrirModalNegocio() {
  document.getElementById('neg-dropdown').classList.remove('show')
  document.getElementById('neg-nome').value = ''; document.getElementById('neg-erro').textContent = ''
  const plano = localStorage.getItem('plano')||'trial'; const assinatura = localStorage.getItem('assinaturaAtiva')==='true'
  const badge = document.getElementById('badge-plano')
  if (badge) { badge.textContent=(plano==='pro'&&assinatura)?'Plano Pro':'Plano Trial'; badge.style.background=(plano==='pro'&&assinatura)?'#2563eb':'#f59e0b'; badge.style.color='#fff'; badge.style.padding='4px 12px'; badge.style.borderRadius='100px'; badge.style.fontSize='12px'; badge.style.fontWeight='600' }
  document.getElementById('modal-negocio').style.display = 'flex'
}
function fecharModalNegocio() { document.getElementById('modal-negocio').style.display = 'none' }

async function criarNegocio() {
  const nome = document.getElementById('neg-nome').value.trim(); const segmento = document.getElementById('neg-segmento').value; const erro = document.getElementById('neg-erro')
  if (!nome) { erro.textContent = 'Digite o nome do negócio'; return }
  const plano = localStorage.getItem('plano')||'trial'; const assinatura = localStorage.getItem('assinaturaAtiva')==='true'
  if (plano!=='pro'||!assinatura) { erro.textContent = 'Faça upgrade para o plano Pro para criar mais painéis'; return }
  const token = localStorage.getItem('token')
  const servicos = (servicosPorSegmento[segmento]||servicosPorSegmento['Outro']).map(s => ({nome:s,preco:0}))
  const res = await fetch(`${API}/auth/negocios`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({nome,segmento,servicos})})
  const data = await res.json()
  if (!res.ok) { erro.textContent = data.erro||'Erro ao criar painel'; return }
  todosNegocios.push({_id:data._id,nome:data.nome,segmento:data.segmento})
  fecharModalNegocio(); trocarNegocio(data._id)
}

/* ═══════════════════════════════════════════════════
   PAINEL — carregamento inicial
═══════════════════════════════════════════════════ */
async function mostrarPainel() {
  const token = localStorage.getItem('token')
  const res = await fetch(`${API}/auth/negocios`,{headers:{'Authorization':`Bearer ${token}`}})
  todosNegocios = await res.json()
  const savedId = localStorage.getItem('negocioId')
  negocioAtual = todosNegocios.find(n => n._id===savedId)||todosNegocios[0]
  if (negocioAtual) { localStorage.setItem('negocioId',negocioAtual._id); localStorage.setItem('negocio',negocioAtual.nome) }
  renderDropdown(); atualizarSidebarNegocio()
  const fd = document.getElementById('filtro-data'); if (fd) fd.value = new Date().toISOString().split('T')[0]
  carregarDadosNegocio(); verificarAcesso()
}

function carregarDadosNegocio() {
  carregarStatsSalvas()
  carregarAgendamentos()
  carregarServicos()
  carregarHorariosConfig()
  carregarBioConfig()
  carregarLembretes()
  carregarInsights()
}

/* ═══════════════════════════════════════════════════
   COPIAR LINKS
═══════════════════════════════════════════════════ */
function copiarLink() {
  if (!negocioAtual) return
  navigator.clipboard.writeText(urlAgendamento(negocioAtual))
    .then(() => flashBtn('btn-copiar-agendamento', '✓ Copiado!'))
}

function copiarLinkBio() {
  if (!negocioAtual) return
  navigator.clipboard.writeText(urlBio(negocioAtual))
    .then(() => flashBtn('btn-copiar-bio', '✓ Copiado!'))
}

function copiarLinkWpp() {
  if (!negocioAtual) return
  navigator.clipboard.writeText(urlAgendamento(negocioAtual))
    .then(() => { const btn = document.querySelector('[onclick="copiarLinkWpp()"]'); if (btn) flash(btn, '✓ Copiado!') })
}

function copiarMensagemWpp() {
  const el = document.getElementById('wpp-mensagem-preview'); if (!el) return
  navigator.clipboard.writeText(el.textContent).then(() => flashBtn('btn-copiar-msg', '✓ Mensagem copiada!'))
}

/* ═══════════════════════════════════════════════════
   AGENDAMENTOS
═══════════════════════════════════════════════════ */
async function carregarAgendamentos() {
  if (!negocioAtual) return
  const nid = negocioAtual._id
  const token = localStorage.getItem('token')

  const res = await fetch(`${API}/agendamentos?negocioId=${nid}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  let agsDaAPI = await res.json()

  // Marca como concluído os agendamentos passados
  const agora = new Date()
  const passados = agsDaAPI.filter(a => {
    if (a.status !== 'confirmado' || !a.data || !a.hora) return false
    const [ano, mes, dia] = a.data.split('-').map(Number)
    const [h, m] = a.hora.split(':').map(Number)
    return new Date(ano, mes - 1, dia, h, m).getTime() < agora.getTime()
  })

  if (passados.length > 0) {
    await Promise.all(passados.map(a =>
      fetch(`${API}/agendamentos/${a._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: 'concluido' })
      })
    ))
    agsDaAPI = agsDaAPI.map(a => {
      const foi = passados.find(p => p._id === a._id)
      if (!foi) return a
      const c = { ...a, status: 'concluido' }
      registrarLucro(c)
      return c
    })
  }

  // Salva concluídos no cache ANTES de qualquer merge
  salvarConcluidosNoCache(nid, agsDaAPI)

  // Mescla com o cache
  const listaMerged = mergeComCache(nid, agsDaAPI)

  // ── Registra timestamps de conclusão para todos os concluídos ──
  // Isso garante que o filtro visual funcione corretamente
  const hoje = new Date().toISOString().split('T')[0]
  agsDaAPI
    .filter(a => a.status === 'concluido')
    .forEach(a => {
      if (!localStorage.getItem(conclusaoKey(a._id))) {
        if (a.data < hoje) {
          // Agendamento de dia anterior → já expirado (marca 2h atrás)
          localStorage.setItem(conclusaoKey(a._id), String(Date.now() - 2 * 60 * 60 * 1000))
        } else {
          // Concluído hoje sem registro → trata como recém-concluído
          registrarConclusao(a._id)
        }
      }
    })

  // ── Stats de hoje e semana — calculados sobre lista COMPLETA ──
  const semana = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  const qtdHoje   = listaMerged.filter(a => a.data === hoje).length
  const qtdSemana = listaMerged.filter(a => a.data >= hoje && a.data <= semana).length

  const savedHoje   = parseInt(localStorage.getItem(`stat_hoje_${nid}`)) || 0
  const savedSemana = parseInt(localStorage.getItem(`stat_semana_${nid}`)) || 0
  const finalHoje   = Math.max(qtdHoje, savedHoje)
  const finalSemana = Math.max(qtdSemana, savedSemana)
  localStorage.setItem(`stat_hoje_${nid}`, String(finalHoje))
  localStorage.setItem(`stat_semana_${nid}`, String(finalSemana))

  const elH = document.getElementById('stat-hoje')
  const elS = document.getElementById('stat-semana')
  if (elH) elH.textContent = finalHoje
  if (elS) elS.textContent = finalSemana

  // ── Lucro calculado sobre lista COMPLETA ──
  seedLucroDoMes(listaMerged)
  exibirLucro()

  // ── Insights calculados sobre lista COMPLETA ──
  // Guardamos temporariamente a lista completa para atualizarInsights()
  todosAgendamentos = listaMerged
  atualizarInsights()

  // ── Agora aplica o filtro visual (concluídos com +1h somem da lista) ──
  todosAgendamentos = filtrarExpirados(listaMerged)

  // ── Renders ──
  renderHistorico()
  filtrarData()
  agAplicarFiltro()
  renderDashboardHoje()

  const dot = document.getElementById('notif-dot')
  if (dot) dot.style.display = finalHoje > 0 ? 'block' : 'none'
  const dotMobile = document.getElementById('notif-dot-mobile')
  if (dotMobile) dotMobile.style.display = finalHoje > 0 ? 'block' : 'none'
}

const POR_PAGINA = 8
let paginaAtual = 1; let listaFiltrada = []

function filtrarData() {
  const el = document.getElementById('filtro-data'); const data = el ? el.value : ''
  listaFiltrada = data ? todosAgendamentos.filter(a=>a.data===data) : todosAgendamentos
  paginaAtual = 1; renderTabela()
}

function renderizarLinhasComAvatar(slice) {
  return slice.map(a => {
    const ini = (a.pacienteNome||'C')[0].toUpperCase(); const [c1,c2] = avatarColor(a.pacienteNome)
    const isOnline = a.status==='confirmado'
    const nomeSafe = (a.pacienteNome||'').replace(/'/g,"\\'").replace(/"/g,'&quot;'); const telSafe = (a.pacienteTelefone||'').replace(/'/g,"\\'")
    const acoes = a.status==='confirmado' ? `<div class="acoes"><button class="btn-acao concluir" onclick="atualizar('${a._id}','concluido')" type="button">Concluir</button><button class="btn-acao cancelar" onclick="cancelarComAviso('${a._id}','${nomeSafe}','${telSafe}','${a.data}','${a.hora}')" type="button">Cancelar</button></div>` : ''
    const preco = a.preco ? `R$${Number(a.preco).toFixed(2).replace('.',',')}` : '—'
    return `<div class="ag-row"><div class="ag-avatar" style="background:linear-gradient(135deg,${c1},${c2})">${ini}${isOnline?'<div class="ag-avatar-online"></div>':''}</div><div class="ag-info"><div class="ag-nome">${a.pacienteNome||'—'}</div><div class="ag-servico">${a.servico||'—'}</div></div><div class="ag-time"><div class="ag-hora">às ${a.hora||'—'}</div><div class="ag-data">${a.data?formatarData(a.data):''}</div></div><span class="badge ${a.status||'pendente'}">${a.status||'pendente'}</span><div class="ag-preco">${preco}</div>${acoes}</div>`
  }).join('')
}

function renderTabela() {
  const wrap = document.getElementById('tbody-rows'); const cards = document.getElementById('ag-cards'); const paginacao = document.getElementById('paginacao')
  if (!listaFiltrada.length) {
    if (wrap) wrap.innerHTML='<div class="vazio">Nenhum agendamento encontrado</div>'
    if (cards) cards.innerHTML='<div class="vazio">Nenhum agendamento encontrado</div>'
    if (paginacao) paginacao.style.display='none'; return
  }
  const total = Math.ceil(listaFiltrada.length/POR_PAGINA); const inicio=(paginaAtual-1)*POR_PAGINA; const fim=inicio+POR_PAGINA; const slice=listaFiltrada.slice(inicio,fim)
  if (wrap) wrap.innerHTML = renderizarLinhasComAvatar(slice)
  if (cards) {
    cards.innerHTML = slice.map(a => {
      const [c1,c2]=avatarColor(a.pacienteNome); const ini=(a.pacienteNome||'C')[0].toUpperCase()
      const nomeSafe=(a.pacienteNome||'').replace(/'/g,"\\'"); const telSafe=(a.pacienteTelefone||'').replace(/'/g,"\\'")
      const acoes = a.status==='confirmado' ? `<div class="ag-card-actions"><button class="btn-acao concluir" onclick="atualizar('${a._id}','concluido')" type="button">Concluir</button><button class="btn-acao cancelar" onclick="cancelarComAviso('${a._id}','${nomeSafe}','${telSafe}','${a.data}','${a.hora}')" type="button">Cancelar</button></div>` : ''
      return `<div class="ag-card"><div class="ag-card-top"><div style="display:flex;align-items:center;gap:10px"><div class="ag-avatar" style="background:linear-gradient(135deg,${c1},${c2});width:32px;height:32px;font-size:11px;flex-shrink:0">${ini}</div><div><div class="ag-card-nome">${a.pacienteNome}</div><div class="paciente-tel">${a.pacienteTelefone||''}</div></div></div><span class="badge ${a.status}">${a.status}</span></div><div class="ag-card-body"><div class="ag-chip">${formatarData(a.data)}</div><div class="ag-chip">${a.hora}</div><div class="ag-chip">${a.servico}</div></div>${acoes}</div>`
    }).join('')
  }
  if (paginacao) {
    const elInfo = document.getElementById('pg-info'); const elBtns = document.getElementById('pg-btns')
    if (elInfo) elInfo.textContent = `${inicio+1}–${Math.min(fim,listaFiltrada.length)} de ${listaFiltrada.length}`
    if (elBtns) {
      let btns = `<button class="pg-btn" onclick="irPagina(${paginaAtual-1})" ${paginaAtual===1?'disabled':''}>‹</button>`
      for (let i=1;i<=total;i++) { if (total<=7||i===1||i===total||Math.abs(i-paginaAtual)<=1) btns+=`<button class="pg-btn ${i===paginaAtual?'ativo':''}" onclick="irPagina(${i})">${i}</button>`; else if (Math.abs(i-paginaAtual)===2) btns+=`<span style="color:var(--text3);font-size:13px;padding:0 2px">…</span>` }
      btns += `<button class="pg-btn" onclick="irPagina(${paginaAtual+1})" ${paginaAtual===total?'disabled':''}>›</button>`
      elBtns.innerHTML = btns
    }
    paginacao.style.display = total>1 ? 'flex' : 'none'
  }
}
function irPagina(n) { const total=Math.ceil(listaFiltrada.length/POR_PAGINA); if (n<1||n>total) return; paginaAtual=n; renderTabela() }

function renderDashboardHoje() {
  const ags=todosAgendamentos||[]; const hoje=new Date().toISOString().split('T')[0]
  const deHoje=ags.filter(a=>a.data===hoje).sort((a,b)=>(a.hora||'').localeCompare(b.hora||''))
  const wrap=document.getElementById('tbody-rows-dash'); const cards=document.getElementById('ag-cards-dash'); const vazio='<div class="vazio">Nenhum agendamento hoje</div>'
  if (!deHoje.length) { if (wrap) wrap.innerHTML=vazio; if (cards) cards.innerHTML=vazio; return }
  if (wrap) wrap.innerHTML = renderizarLinhasComAvatar(deHoje)
  if (cards) {
    cards.innerHTML = deHoje.map(a => {
      const [c1,c2]=avatarColor(a.pacienteNome); const ini=(a.pacienteNome||'C')[0].toUpperCase()
      const nomeSafe=(a.pacienteNome||'').replace(/'/g,"\\'"); const telSafe=(a.pacienteTelefone||'').replace(/'/g,"\\'")
      const acoes = a.status==='confirmado' ? `<div class="ag-card-actions"><button class="btn-acao concluir" onclick="atualizar('${a._id}','concluido')" type="button">Concluir</button><button class="btn-acao cancelar" onclick="cancelarComAviso('${a._id}','${nomeSafe}','${telSafe}','${a.data}','${a.hora}')" type="button">Cancelar</button></div>` : ''
      return `<div class="ag-card"><div class="ag-card-top"><div style="display:flex;align-items:center;gap:10px"><div class="ag-avatar" style="background:linear-gradient(135deg,${c1},${c2});width:32px;height:32px;font-size:11px;flex-shrink:0">${ini}</div><div><div class="ag-card-nome">${a.pacienteNome||'—'}</div><div class="paciente-tel">${a.pacienteTelefone||''}</div></div></div><span class="badge ${a.status||'pendente'}">${a.status||'pendente'}</span></div><div class="ag-card-body"><div class="ag-chip">${formatarData(a.data)}</div><div class="ag-chip">${a.hora||'—'}</div><div class="ag-chip">${a.servico||'—'}</div></div>${acoes}</div>`
    }).join('')
  }
}

async function atualizar(id, status) {
  const token = localStorage.getItem('token')
  const nid = negocioAtual?._id

  if (status === 'concluido') {
    const ag = todosAgendamentos.find(a => a._id === id)
    if (ag) {
      registrarLucro(ag)
      // Registra o timestamp de conclusão agora (para controle de expiração de 1h)
      registrarConclusao(id)
      // Salva imediatamente no cache ao concluir manualmente
      if (nid) {
        const agConcluido = { ...ag, status: 'concluido' }
        const cache = getCacheConc(nid)
        const cacheMap = {}
        cache.forEach(a => cacheMap[a._id] = a)
        cacheMap[agConcluido._id] = agConcluido
        setCacheConc(nid, Object.values(cacheMap))
      }
    }
  }

  await fetch(`${API}/agendamentos/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ status })
  })

  // Atualiza lista completa com novo status
  const listaCompleta = todosAgendamentos.map(a => a._id === id ? { ...a, status } : a)

  // Atualiza cache com o novo status
  if (nid) salvarConcluidosNoCache(nid, listaCompleta)

  const hoje   = new Date().toISOString().split('T')[0]
  const semana = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  salvarStatsPersistentes(
    listaCompleta.filter(a => a.data === hoje).length,
    listaCompleta.filter(a => a.data >= hoje && a.data <= semana).length
  )

  // Recalcula insights/lucro sobre lista completa ANTES do filtro visual
  const listaParaInsights = listaCompleta
  todosAgendamentos = listaParaInsights
  atualizarInsights()
  exibirLucro()

  // Aplica filtro visual
  todosAgendamentos = filtrarExpirados(listaCompleta)

  renderHistorico()
  filtrarData()
  renderDashboardHoje()
  agAplicarFiltro()
}

async function cancelarComAviso(id, nome, telefone, data, hora) {
  if (!confirm(`Cancelar agendamento de ${nome}?`)) return
  const token = localStorage.getItem('token')
  await fetch(`${API}/agendamentos/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({status:'cancelado'})})
  todosAgendamentos = todosAgendamentos.map(a=>a._id===id?{...a,status:'cancelado'}:a)
  const [ano,mes,dia] = data.split('-')
  window.open(`https://wa.me/55${telefone.replace(/\D/g,'')}?text=${encodeURIComponent(`Olá ${nome}! Infelizmente precisamos cancelar seu agendamento do dia ${dia}/${mes}/${ano} às ${hora}. Entre em contato para reagendar.`)}`, '_blank')
  filtrarData(); agAplicarFiltro()
}

/* ═══════════════════════════════════════════════════
   MODAL — NOVO AGENDAMENTO
═══════════════════════════════════════════════════ */
async function abrirModalNovoAgendamento() {
  if (!negocioAtual) return
  if (!servicosAtuais.length) await carregarServicos()
  const hoje = new Date().toISOString().split('T')[0]
  document.getElementById('m-data').value=hoje; document.getElementById('m-data').min=hoje
  document.getElementById('m-nome').value=''; document.getElementById('m-telefone').value=''; document.getElementById('m-erro').textContent=''
  document.getElementById('m-servico').innerHTML = servicosAtuais.map(s=>{const n=typeof s==='object'?s.nome:s;return `<option value="${n}">${n}</option>`}).join('')
  document.getElementById('modal-agendamento').style.display='flex'; document.body.classList.add('modal-open')
  carregarHorariosModal()
}
function fecharModal() { document.getElementById('modal-agendamento').style.display='none'; document.body.classList.remove('modal-open') }

async function carregarHorariosModal() {
  const data = document.getElementById('m-data').value; if (!data||!negocioAtual) return
  const select = document.getElementById('m-hora'); select.innerHTML='<option>Carregando...</option>'
  const res = await fetch(`${API}/agendamentos/horarios-ocupados?clinicaId=${negocioAtual._id}&data=${data}`)
  const resultado = await res.json()
  if (resultado.diaInativo||!resultado.horarios.length) { select.innerHTML='<option value="">Sem horários disponíveis</option>'; return }
  select.innerHTML = resultado.horarios.map(h=>{const ocu=resultado.ocupados.includes(h);return `<option value="${h}" ${ocu?'disabled':''}>${h}${ocu?' (ocupado)':''}</option>`}).join('')
  const livre = resultado.horarios.find(h=>!resultado.ocupados.includes(h)); if (livre) select.value=livre
}

async function salvarAgendamentoManual() {
  const nome=document.getElementById('m-nome').value.trim(); const telefone=document.getElementById('m-telefone').value.trim()
  const servico=document.getElementById('m-servico').value; const data=document.getElementById('m-data').value; const hora=document.getElementById('m-hora').value
  const erro=document.getElementById('m-erro')
  if (!nome) { erro.textContent='Digite o nome do cliente'; return }
  if (!hora) { erro.textContent='Selecione um horário'; return }
  erro.textContent=''
  const btn=document.querySelector('.btn-salvar-modal'); btn.disabled=true; btn.textContent='Salvando...'
  const token=localStorage.getItem('token')
  const res=await fetch(`${API}/agendamentos`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({clinicaId:negocioAtual._id,pacienteNome:nome,pacienteTelefone:telefone,servico,data,hora})})
  const resposta=await res.json(); btn.disabled=false; btn.textContent='Confirmar agendamento'
  if (res.ok) { fecharModal(); carregarAgendamentos() } else erro.textContent=resposta.erro||'Erro ao criar agendamento'
}

/* ═══════════════════════════════════════════════════
   SERVIÇOS
═══════════════════════════════════════════════════ */
async function carregarServicos() {
  if (!negocioAtual) return
  const res=await fetch(`${API}/auth/negocio/${negocioAtual._id}`); const data=await res.json()
  servicosAtuais = (data.servicos||[]).map(s => typeof s==='object' ? s : {nome:s, preco:0})
  pagamentosConfig = data.pagamentos||{}
  renderServicos()
  renderIntervalosServicos()
  cfgRenderServicos()
}

function renderServicos() {
  const el=document.getElementById('servicos-tags'); if (!el) return
  el.innerHTML=servicosAtuais.map((s,i)=>{const nome=typeof s==='object'?s.nome:s;const preco=typeof s==='object'&&s.preco?Number(s.preco):0;const pl=preco>0?`R$ ${preco.toFixed(2).replace('.',',')}`:'';return `<div class="servico-tag-wrap"><span class="servico-tag">${nome}${pl?`<span class="servico-preco">${pl}</span>`:''}<button onclick="removerServico(${i})" title="Remover" type="button">×</button></span></div>`}).join('')
}

function adicionarServico() {
  const nomeInput=document.getElementById('novo-servico'); const precoInput=document.getElementById('novo-preco'); const erroEl=document.getElementById('servico-erro')
  const nome=nomeInput.value.trim(); const preco=parseFloat(precoInput.value); erroEl.textContent=''
  nomeInput.classList.remove('campo-erro'); precoInput.classList.remove('campo-erro')
  if (!nome) { erroEl.textContent='⚠ Digite o nome do serviço.'; nomeInput.classList.add('campo-erro'); nomeInput.focus(); return }
  if (!precoInput.value.trim()||isNaN(preco)||preco<=0) { erroEl.textContent='⚠ O preço é obrigatório e deve ser maior que R$ 0,00.'; precoInput.classList.add('campo-erro'); precoInput.focus(); return }
  if (servicosAtuais.some(s=>(typeof s==='object'?s.nome:s).toLowerCase()===nome.toLowerCase())) { erroEl.textContent='⚠ Já existe um serviço com esse nome.'; nomeInput.classList.add('campo-erro'); nomeInput.focus(); return }
  servicosAtuais.push({nome,preco}); nomeInput.value=''; precoInput.value=''; renderServicos(); renderIntervalosServicos()
}

function removerServico(i) {
  const nome=typeof servicosAtuais[i]==='object'?servicosAtuais[i].nome:servicosAtuais[i]
  delete intervalosServicos[nome]
  servicosAtuais.splice(i,1)
  renderServicos()
  renderIntervalosServicos()
  cfgRenderServicos()
}

async function salvarServicos() {
  if (!negocioAtual) return; const token=localStorage.getItem('token')
  await fetch(`${API}/auth/servicos`,{method:'PATCH',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({negocioId:negocioAtual._id,servicos:servicosAtuais})})
  mostrarSalvo('salvo-msg')
}

/* ═══════════════════════════════════════════════════
   INTERVALO PADRÃO
═══════════════════════════════════════════════════ */
function selecionarIntervalo(btn,valor) { document.querySelectorAll('.intervalo-btn').forEach(b=>b.classList.remove('selecionado')); btn.classList.add('selecionado'); intervaloAtual=valor; intervaloCustomAtivo=false; document.getElementById('intervalo-custom-wrap').classList.remove('visivel') }
function selecionarIntervaloCustom(btn) {
  document.querySelectorAll('.intervalo-btn').forEach(b=>b.classList.remove('selecionado')); btn.classList.add('selecionado'); intervaloCustomAtivo=true
  const wrap=document.getElementById('intervalo-custom-wrap'); wrap.classList.add('visivel')
  const input=document.getElementById('intervalo-custom'); input.value=OPCOES_INTERVALO.map(o=>o.valor).includes(intervaloAtual)?'':intervaloAtual; input.focus()
}
function atualizarIntervaloCustom(val) { const n=parseInt(val); if (!isNaN(n)&&n>=5&&n<=480) intervaloAtual=n }
function aplicarSelecaoIntervalo(valor) {
  const preds=OPCOES_INTERVALO.map(o=>o.valor)
  document.querySelectorAll('.intervalo-btn:not(.custom-btn)').forEach((btn,i)=>btn.classList.toggle('selecionado',OPCOES_INTERVALO[i]&&OPCOES_INTERVALO[i].valor===valor))
  const customBtn=document.getElementById('btn-custom-intervalo'); const customWrap=document.getElementById('intervalo-custom-wrap')
  if (!preds.includes(valor)) { if(customBtn)customBtn.classList.add('selecionado'); if(customWrap)customWrap.classList.add('visivel'); const inp=document.getElementById('intervalo-custom');if(inp)inp.value=valor; intervaloCustomAtivo=true }
  else { if(customBtn)customBtn.classList.remove('selecionado'); if(customWrap)customWrap.classList.remove('visivel'); intervaloCustomAtivo=false }
}

/* ═══════════════════════════════════════════════════
   INTERVALO POR SERVIÇO
═══════════════════════════════════════════════════ */
function renderIntervalosServicos() {
  const grid=document.getElementById('servicos-intervalos-grid'); if (!grid) return
  if (!servicosAtuais.length) { grid.innerHTML=`<div class="servicos-vazio"><div class="servicos-vazio-icon">🛠️</div>Adicione serviços em <strong>Configurações → Serviços</strong> para configurar durações individuais.</div>`; return }
  const opcoesHtml=[['0','Usar padrão'],['5','5 min'],['10','10 min'],['15','15 min'],['20','20 min'],['25','25 min'],['30','30 min'],['45','45 min'],['60','1 hora'],['75','1h15'],['90','1h30'],['105','1h45'],['120','2 horas'],['150','2h30'],['180','3 horas'],['240','4 horas'],['300','5 horas'],['360','6 horas'],['custom','Personalizado...']].map(([v,l])=>`<option value="${v}">${l}</option>`).join('')
  grid.innerHTML=servicosAtuais.map(s=>{const nome=typeof s==='object'?s.nome:s;const preco=typeof s==='object'&&s.preco?Number(s.preco):0;const pl=preco>0?`R$ ${preco.toFixed(2).replace('.',',')}`:'';return `<div class="servico-intervalo-card"><div class="servico-intervalo-info"><div class="servico-intervalo-nome">${nome}</div>${pl?`<div class="servico-intervalo-preco">${pl}</div>`:''}</div><select class="servico-intervalo-select" data-servico="${nome}" onchange="alterarIntervaloServico(this)">${opcoesHtml}</select><div class="servico-intervalo-actions"><div class="servico-intervalo-act-btn" title="Remover" onclick="removerServico(${servicosAtuais.indexOf(s)})"><svg width="12" height="12" viewBox="0 0 15 15" fill="none"><path d="M2.5 4h10M5 4V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1M6 7v4M9 7v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.5 4l.5 8a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1l.5-8" stroke="currentColor" stroke-width="1.3"/></svg></div></div></div>`}).join('')
  const preds=[0,5,10,15,20,25,30,45,60,75,90,105,120,150,180,240,300,360]
  servicosAtuais.forEach(s=>{const nome=typeof s==='object'?s.nome:s;const duracao=intervalosServicos[nome]||0;const select=grid.querySelector(`[data-servico="${nome}"]`);if(!select)return;if(duracao===0||preds.includes(duracao)){select.value=String(duracao)}else{const opt=document.createElement('option');opt.value=String(duracao);opt.textContent=formatarMinutos(duracao);select.insertBefore(opt,select.querySelector('[value="custom"]'));select.value=String(duracao)}})
}
function alterarIntervaloServico(select) {
  const nome=select.dataset.servico; const val=select.value
  if (val==='custom') {
    const customVal=prompt(`Digite a duração em minutos para "${nome}":`,intervalosServicos[nome]||60); if(customVal===null){select.value=String(intervalosServicos[nome]||0);return}
    const min=parseInt(customVal); if(isNaN(min)||min<1||min>720){alert('Informe um valor entre 1 e 720 minutos.');select.value=String(intervalosServicos[nome]||0);return}
    intervalosServicos[nome]=min; if(!select.querySelector(`[value="${min}"]`)){const opt=document.createElement('option');opt.value=String(min);opt.textContent=formatarMinutos(min);select.insertBefore(opt,select.querySelector('[value="custom"]'))}; select.value=String(min)
  } else { const min=parseInt(val); if(min===0)delete intervalosServicos[nome];else intervalosServicos[nome]=min }
}
async function salvarIntervalosServicos() { if (!negocioAtual) return; await patchHorarios(); mostrarSalvo('salvo-intervalos-servicos') }

/* ═══════════════════════════════════════════════════
   HORÁRIOS
═══════════════════════════════════════════════════ */
function renderDias() {
  const el=document.getElementById('dias-container'); if (!el) return
  el.innerHTML=diasNomes.map((nome,i)=>{const cfg=horariosConfig[i]||{ativo:false,inicio:'08:00',fim:'18:00'};return `<div class="dia-row ${cfg.ativo?'':'dia-inativo'}" id="dia-row-${i}"><div class="dia-toggle"><input type="checkbox" id="dia-${i}" ${cfg.ativo?'checked':''} onchange="toggleDia(${i})"><label for="dia-${i}">${nome}</label></div><div class="dia-horarios"><span>Das</span><input type="time" id="inicio-${i}" value="${cfg.inicio}" /><span>às</span><input type="time" id="fim-${i}" value="${cfg.fim}" /></div></div>`}).join('')
}
function toggleDia(i) { const cb=document.getElementById(`dia-${i}`);const row=document.getElementById(`dia-row-${i}`);if(row&&cb)row.classList.toggle('dia-inativo',!cb.checked) }

async function carregarHorariosConfig() {
  if (!negocioAtual) return
  const res=await fetch(`${API}/auth/negocio/${negocioAtual._id}`); const data=await res.json()
  horariosConfig=data.horarios||{}; intervaloAtual=data.intervalo||30; pausasAtuais=data.pausas||[]; intervalosServicos=data.intervalosServicos||{}
  renderPausas(); aplicarSelecaoIntervalo(intervaloAtual); renderDias(); renderIntervalosServicos(); renderHorariosDiasLateral()
}
async function salvarHorarios() {
  if (!negocioAtual) return
  diasNomes.forEach((_,i)=>{const cb=document.getElementById(`dia-${i}`);if(!cb)return;horariosConfig[i]={ativo:cb.checked,inicio:document.getElementById(`inicio-${i}`).value,fim:document.getElementById(`fim-${i}`).value}})
  await patchHorarios(); renderHorariosDiasLateral(); mostrarSalvo('salvo-horarios')
}
async function patchHorarios() {
  const token=localStorage.getItem('token')
  await fetch(`${API}/auth/horarios`,{method:'PATCH',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({negocioId:negocioAtual._id,horarios:horariosConfig,intervalo:intervaloAtual,pausas:pausasAtuais,intervalosServicos})})
}

function renderHorariosDiasLateral() {
  const nomes=['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo']; const indices=[1,2,3,4,5,6,0]
  const container=document.getElementById('horarios-dias-lista'); if (!container) return
  container.innerHTML=indices.map((idx,i)=>{const cfg=horariosConfig[idx]||{ativo:false,inicio:'09:00',fim:'18:00'};const ativo=cfg.ativo;return `<div class="horarios-dia-row"><span class="horarios-dia-nome">${nomes[i]}</span><div class="horarios-dia-right">${ativo?`<span class="horarios-dia-horas">${cfg.inicio} - ${cfg.fim}</span>`:`<span class="horarios-dia-fechado">Fechado</span>`}<div class="horarios-dia-toggle ${ativo?'on':'off'}" onclick="toggleDiaLateral(${idx},this)" role="switch" aria-checked="${ativo}" aria-label="Ativar ${nomes[i]}" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' ')toggleDiaLateral(${idx},this)"><div class="horarios-dia-toggle-thumb"></div></div></div></div>`}).join('')
}
function toggleDiaLateral(idx,toggleEl) { const cfg=horariosConfig[idx]||{ativo:false,inicio:'09:00',fim:'18:00'}; cfg.ativo=!cfg.ativo; horariosConfig[idx]=cfg; renderHorariosDiasLateral(); abrirGerenciarDias() }
function abrirGerenciarDias() { renderDias(); const modal=document.getElementById('modal-gerenciar-dias'); if(modal){modal.style.display='flex';document.body.classList.add('modal-open')} }
function fecharGerenciarDias() { const modal=document.getElementById('modal-gerenciar-dias'); if(modal){modal.style.display='none';document.body.classList.remove('modal-open')} }

function mascaraHora(inp) { let v=inp.value.replace(/\D/g,'').slice(0,4); if(v.length>=3)v=v.slice(0,2)+':'+v.slice(2); inp.value=v }
function renderPausas() {
  const lista=document.getElementById('pausas-lista'); if (!lista) return
  if (!pausasAtuais.length) { lista.innerHTML='<p style="font-size:12.5px;color:var(--text3);padding:8px 0">Nenhuma pausa configurada</p>'; return }
  lista.innerHTML=pausasAtuais.map((p,i)=>`<div class="pausa-item"><span class="pausa-item-label">${p.label||'Pausa'}</span><span class="pausa-item-hora">${p.inicio} – ${p.fim}</span><button onclick="removerPausa(${i})" type="button" style="margin-left:auto;background:none;border:none;color:var(--text3);cursor:pointer;font-size:18px;line-height:1;padding:2px 4px;border-radius:5px">×</button></div>`).join('')
}
function adicionarPausa() {
  const inicio=document.getElementById('pausa-inicio').value; const fim=document.getElementById('pausa-fim').value; const label=document.getElementById('pausa-label').value.trim()||'Pausa'
  if (!inicio||!fim) { alert('Preencha o horário de início e fim'); return }
  if (inicio>=fim) { alert('O horário de início deve ser anterior ao fim'); return }
  pausasAtuais.push({inicio,fim,label}); document.getElementById('pausa-inicio').value=''; document.getElementById('pausa-fim').value=''; document.getElementById('pausa-label').value=''; renderPausas()
}
function removerPausa(i) { pausasAtuais.splice(i,1); renderPausas() }
async function salvarPausas() { if (!negocioAtual) return; await patchHorarios(); mostrarSalvo('salvo-pausas') }

/* ═══════════════════════════════════════════════════
   BIO
═══════════════════════════════════════════════════ */
async function carregarBioConfig() {
  if (!negocioAtual) return
  const res=await fetch(`${API}/auth/negocio/${negocioAtual._id}`); const data=await res.json(); const bio=data.bio||{}
  const campos=['foto','descricao','endereco','instagram','whatsapp']
  campos.forEach(c=>{const el=document.getElementById(`bio-${c}`);if(el)el.value=bio[c]||''})
  const prev=document.getElementById('foto-preview'); if(prev)prev.innerHTML=bio.foto?`<img src="${bio.foto}">`:'👤'
}
async function salvarBio() {
  if (!negocioAtual) return; const token=localStorage.getItem('token')
  await fetch(`${API}/auth/bio`,{method:'PATCH',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({negocioId:negocioAtual._id,foto:document.getElementById('bio-foto').value,descricao:document.getElementById('bio-descricao').value,endereco:document.getElementById('bio-endereco').value,instagram:document.getElementById('bio-instagram').value,whatsapp:document.getElementById('bio-whatsapp').value})})
  mostrarSalvo('salvo-bio')
}
async function uploadFoto(input) {
  const file=input.files[0]; if(!file) return
  document.getElementById('foto-status').textContent='Enviando...'
  const reader=new FileReader()
  reader.onload=async e=>{
    const token=localStorage.getItem('token')
    const res=await fetch(`${API}/upload`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({imagem:e.target.result})})
    const data=await res.json()
    if(res.ok){document.getElementById('bio-foto').value=data.url;document.getElementById('foto-status').textContent='✓ Foto enviada!';document.getElementById('foto-preview').innerHTML=`<img src="${data.url}">`}
    else document.getElementById('foto-status').textContent='Erro ao enviar foto'
  }
  reader.readAsDataURL(file)
}

/* ═══════════════════════════════════════════════════
   LEMBRETES
═══════════════════════════════════════════════════ */
function atualizarToggleVisual(ativo) {
  const track=document.getElementById('toggle-track'); const thumb=document.getElementById('toggle-thumb')
  if(!track||!thumb) return
  track.style.background=ativo?'var(--accent)':''; thumb.style.left=ativo?'24px':'3px'
  const info=document.getElementById('lembrete-info'); if(info)info.style.display=ativo?'block':'none'
}
async function carregarLembretes() {
  if (!negocioAtual) return
  const res=await fetch(`${API}/auth/negocio/${negocioAtual._id}`); const data=await res.json(); const lembrete=data.lembrete||{}
  const checkbox=document.getElementById('toggle-lembrete')
  if(checkbox)checkbox.checked=!!lembrete.ativo
  atualizarToggleVisual(!!lembrete.ativo)
  if(lembrete.mensagem){const msgEl=document.getElementById('lembrete-msg');if(msgEl)msgEl.value=lembrete.mensagem}
  const toggleEditor=document.getElementById('toggle-editor-main'); const labelAtivo=document.querySelector('.auto-ativo-label'); const toggle24h=document.getElementById('toggle-24h')
  if(checkbox&&toggleEditor){const isOn=checkbox.checked;toggleEditor.className='auto-tipo-toggle '+(isOn?'on':'off');if(labelAtivo){labelAtivo.textContent=isOn?'Ativo':'Inativo';labelAtivo.style.color=isOn?'#34d399':'var(--text3)'};if(toggle24h){toggle24h.className='auto-tipo-toggle '+(isOn?'on':'off');const card=toggle24h.closest('.auto-tipo-card');if(card){const badge=card.querySelector('.auto-tipo-badge');if(badge){badge.textContent=isOn?'Ativo':'Inativo';badge.className='auto-tipo-badge '+(isOn?'ativo':'inativo')}}}}
  const msgEl2=document.getElementById('lembrete-msg');const taAuto=document.getElementById('auto-mensagem-textarea')
  if(msgEl2&&taAuto&&msgEl2.value){taAuto.value=msgEl2.value;if(typeof atualizarPreviewAuto==='function')atualizarPreviewAuto()}
}
async function salvarLembrete() {
  const ativo=document.getElementById('toggle-lembrete').checked; atualizarToggleVisual(ativo)
  if(!negocioAtual) return; const token=localStorage.getItem('token')
  await fetch(`${API}/auth/lembretes`,{method:'PATCH',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({negocioId:negocioAtual._id,ativo})})
}
async function salvarConfLembrete() {
  if(!negocioAtual) return; const token=localStorage.getItem('token')
  await fetch(`${API}/auth/lembretes`,{method:'PATCH',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({negocioId:negocioAtual._id,ativo:document.getElementById('toggle-lembrete').checked,mensagem:document.getElementById('lembrete-msg').value})})
  mostrarSalvo('salvo-lembrete')
}

/* ═══════════════════════════════════════════════════
   ACESSO / TRIAL
═══════════════════════════════════════════════════ */
async function verificarAcesso() {
  const token=localStorage.getItem('token'); if(!token) return
  const res=await fetch(`${API}/assinatura/status`,{headers:{'Authorization':`Bearer ${token}`}}); const data=await res.json()
  localStorage.setItem('plano',data.plano||'trial'); localStorage.setItem('assinaturaAtiva',data.assinaturaAtiva?'true':'false')
  if(!data.temAcesso){document.getElementById('bloqueio').style.display='flex';return}
  if(data.plano==='trial'&&data.diasRestantes<=7){const banner=document.createElement('div');banner.className='trial-banner';banner.innerHTML=`<p>⏰ Seu trial expira em <strong>${data.diasRestantes} dias</strong>. Assine para não perder o acesso.</p><button class="btn-assinar-banner" onclick="window.location.href='/planos.html'" type="button">Ver planos</button>`;const main=document.querySelector('.main');if(main)main.prepend(banner)}
}

/* ═══════════════════════════════════════════════════
   HISTÓRICO MENSAL
═══════════════════════════════════════════════════ */
let historicoMesOffset=0
function chaveDoOffset(offset){const d=new Date();d.setDate(1);d.setMonth(d.getMonth()+offset);return d.toISOString().slice(0,7)}
function formatarMesLabel(chave){const [ano,mes]=chave.split('-').map(Number);const nomes=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];return `${nomes[mes-1]} ${ano}`}
function dadosMes(negocioId,chave){const lucro=parseFloat(localStorage.getItem(`lucro_val_${negocioId}_${chave}`))||0;const ids=(()=>{try{return JSON.parse(localStorage.getItem(`lucro_ids_${negocioId}_${chave}`)||'[]')}catch{return[]}})();return{lucro,atendimentos:ids.length}}
function renderHistorico() {
  if(!negocioAtual)return; const nid=negocioAtual._id; const chav=chaveDoOffset(historicoMesOffset)
  const dados=dadosMes(nid,chav); const elLabel=document.getElementById('hist-mes-label'); const elNext=document.getElementById('hist-next')
  if(elLabel)elLabel.textContent=historicoMesOffset===0?'Este mês':formatarMesLabel(chav); if(elNext)elNext.disabled=historicoMesOffset>=0
  const {lucro,atendimentos:atend}=dados; const ticket=atend>0?lucro/atend:0
  const elLucro=document.getElementById('hist-lucro'); const elAtend=document.getElementById('hist-atend'); const elTicket=document.getElementById('hist-ticket')
  if(elLucro)elLucro.textContent=fmtBRL(lucro); if(elAtend)elAtend.textContent=atend; if(elTicket)elTicket.textContent=fmtBRL(ticket)
  const meses=[]; for(let i=-5;i<=0;i++){const c=chaveDoOffset(i);const d=dadosMes(nid,c);meses.push({chave:c,offset:i,lucro:d.lucro,atend:d.atendimentos})}
  const maxLucro=Math.max(...meses.map(m=>m.lucro),1)
  const elGraf=document.getElementById('hist-grafico')
  if(elGraf)elGraf.innerHTML=meses.map(m=>{const pct=Math.max((m.lucro/maxLucro)*100,m.lucro>0?4:0);return `<div class="hist-barra-wrap" onclick="historicoIrPara(${m.offset})" title="${formatarMesLabel(m.chave)}: ${fmtBRL(m.lucro)}"><span class="hist-barra-val">${formatarCompacto(m.lucro)}</span><div class="hist-barra ${m.chave===chav?'ativo':''} ${m.lucro===0?'zero':''}" style="height:${pct}%"></div></div>`}).join('')
  const nomesM=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const elLabels=document.getElementById('hist-grafico-labels')
  if(elLabels)elLabels.innerHTML=meses.map(m=>{const mes=parseInt(m.chave.split('-')[1])-1;return `<div class="hist-grafico-label ${m.chave===chav?'ativo':''}">${nomesM[mes]}</div>`}).join('')
}
function historicoPaginar(dir){const novo=historicoMesOffset+dir;if(novo>0)return;historicoMesOffset=novo;renderHistorico()}
function historicoIrPara(offset){if(offset>0)return;historicoMesOffset=offset;renderHistorico()}

/* ═══════════════════════════════════════════════════
   INSIGHTS
   ATENÇÃO: atualizarInsights() deve ser chamado com
   todosAgendamentos ainda COMPLETO (antes de filtrarExpirados)
═══════════════════════════════════════════════════ */
function atualizarInsights() {
  const ags = todosAgendamentos || []
  const nid = negocioAtual?._id
  if (!nid) return

  // ── Melhor horário ──
  if (ags.length) {
    const freqHora = {}
    ags.forEach(a => { if (a.hora) freqHora[a.hora] = (freqHora[a.hora] || 0) + 1 })
    const topHora = Object.entries(freqHora).sort((a, b) => b[1] - a[1])[0]
    if (topHora) {
      localStorage.setItem(`insight_melhorHorario_${nid}`, topHora[0])
    }
  }
  const melhorHorario = localStorage.getItem(`insight_melhorHorario_${nid}`) || '—'
  const elH = document.getElementById('insight-melhor-horario')
  if (elH) elH.textContent = melhorHorario

  // ── Serviço mais lucrativo ──
  if (ags.length) {
    const freqServ = {}
    ags.forEach(a => {
      if (!a.servico) return
      if (!freqServ[a.servico]) freqServ[a.servico] = { total: 0, qtd: 0 }
      freqServ[a.servico].total += Number(a.preco) || 0
      freqServ[a.servico].qtd += 1
    })
    const topServ = Object.entries(freqServ).sort((a, b) => b[1].total - a[1].total)[0]
    if (topServ) {
      localStorage.setItem(`insight_topServico_${nid}`, topServ[0])
      localStorage.setItem(`insight_topServicoBRL_${nid}`, topServ[1].total.toFixed(2))
      localStorage.setItem(`insight_topServicoQtd_${nid}`, topServ[1].qtd)
    }
  }
  const topServicoNome = localStorage.getItem(`insight_topServico_${nid}`)
  const topServicoBRL  = parseFloat(localStorage.getItem(`insight_topServicoBRL_${nid}`)) || 0
  const topServicoQtd  = parseInt(localStorage.getItem(`insight_topServicoQtd_${nid}`)) || 0
  const elST = document.getElementById('insight-servico-top')
  const elSR = document.getElementById('insight-servico-receita')
  if (elST && topServicoNome) {
    elST.textContent = topServicoNome
    if (elSR) elSR.textContent = topServicoBRL > 0
      ? `R$ ${topServicoBRL.toFixed(2).replace('.', ',')} gerados`
      : `${topServicoQtd} agendamento${topServicoQtd !== 1 ? 's' : ''}`
  }

  // ── Clientes inativos ──
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  const cutStr = cutoff.toISOString().split('T')[0]
  if (ags.length) {
    const recentes = new Set(ags.filter(a => a.data >= cutStr).map(a => a.pacienteNome))
    const todos    = new Set(ags.map(a => a.pacienteNome))
    const inativos = [...todos].filter(c => !recentes.has(c)).length
    if (inativos > 0 || todos.size > 0) {
      localStorage.setItem(`insight_inativos_${nid}`, inativos)
    }
  }
  const inativosSalvo = parseInt(localStorage.getItem(`insight_inativos_${nid}`)) || 0
  const elI  = document.getElementById('insight-inativos')
  const elIS = document.getElementById('insight-inativos-sub')
  if (elI) elI.textContent = inativosSalvo > 0 ? `${inativosSalvo} cliente${inativosSalvo > 1 ? 's' : ''}` : 'Nenhum'
  if (elIS) { elIS.textContent = inativosSalvo > 0 ? 'há mais de 30 dias' : 'todos ativos'; elIS.className = 'insight-item-sub' + (inativosSalvo > 0 ? ' warning' : '') }
  const banner = document.getElementById('alert-clientes-inativos')
  if (banner) banner.style.display = inativosSalvo >= 3 ? 'flex' : 'none'
  if (inativosSalvo >= 3) {
    const t = document.getElementById('alert-clientes-texto')
    if (t) t.innerHTML = `<strong>${inativosSalvo} clientes estão inativos</strong>, mande uma promoção para reativá-los`
  }

  // ── Lucro da semana ──
  const hoje    = new Date().toISOString().split('T')[0]
  const semStart = new Date(); semStart.setDate(semStart.getDate() - 7)
  const lucroSemCalc = ags
    .filter(a => a.status === 'concluido' && a.data >= semStart.toISOString().split('T')[0] && a.data <= hoje)
    .reduce((s, a) => s + (Number(a.preco) || 0), 0)
  setStatSalvo(nid, 'lucroSemana', lucroSemCalc)
  const lucroSem = getStatComFallback(nid, 'lucroSemana', lucroSemCalc)
  const elTotal  = document.getElementById('stat-total')
  if (elTotal) elTotal.textContent = fmtBRL(lucroSem)

  // ── Finance card (este mês) ──
  const lucroMes    = getLucroMes(nid) || 0
  const idsDoMes    = getLucroIds(nid)
  const atendMesCalc = idsDoMes.length

  setStatSalvo(nid, 'atendMes', atendMesCalc)
  const atendMes = Math.max(atendMesCalc, getStatSalvo(nid, 'atendMes') || 0)

  const fv  = document.getElementById('finance-amount-val')
  const fm  = document.getElementById('finance-meta')
  const fa  = document.getElementById('finance-atend')
  const fcl = document.getElementById('finance-chart-label')
  if (fv)  fv.textContent  = lucroMes.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (fm)  fm.textContent  = `Movidas: ${atendMes} agendamento${atendMes !== 1 ? 's' : ''}`
  if (fa)  fa.textContent  = atendMes
  if (fcl) fcl.textContent = `R$${Math.round(lucroMes)}`

  atualizarPix()
}

async function carregarInsights() {
  if(!negocioAtual)return; const token=localStorage.getItem('token')
  try {
    const res=await fetch(`${API}/agendamentos/insights?negocioId=${negocioAtual._id}`,{headers:{'Authorization':`Bearer ${token}`}}); if(!res.ok)return
    const data=await res.json()
    const elMelhor=document.getElementById('insight-melhor-horario');if(elMelhor)elMelhor.textContent=data.melhorAgendamento||'—'
    const elServico=document.getElementById('insight-servico-top');const elReceita=document.getElementById('insight-servico-receita')
    if(data.topServico){if(elServico)elServico.textContent=data.topServico.nome;if(elReceita)elReceita.textContent=`+R$${data.topServico.receita.toFixed(0)} no mês`}
    const fin=data.finance||{}
    const elAmount=document.getElementById('finance-amount-val');const elMeta=document.getElementById('finance-meta');const elAtend=document.getElementById('finance-atend');const elChartL=document.getElementById('finance-chart-label');const elTotal2=document.getElementById('stat-total')
    if(elAmount)elAmount.textContent=(fin.lucroMes||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})
    if(elMeta)elMeta.textContent=`Movidas: ${fin.atendMes||0} agendamentos`
    if(elAtend)elAtend.textContent=fin.atendMes||0; if(elChartL)elChartL.textContent=`R$${Math.round(fin.lucroMes||0)}`;if(elTotal2)elTotal2.textContent=fmtBRL(fin.lucroSemana||0)
    if(fin.historicoMeses?.length&&negocioAtual){
      fin.historicoMeses.forEach(({mes,lucro,atendimentos})=>{
        localStorage.setItem(`lucro_val_${negocioAtual._id}_${mes}`,String(lucro))
        if(mes!==mesAtualChave()||getLucroIds(negocioAtual._id).length===0)
          localStorage.setItem(`lucro_ids_${negocioAtual._id}_${mes}`,JSON.stringify(Array.from({length:atendimentos},(_,i)=>`hist_${mes}_${i}`)))
      })
      renderHistorico()
    }
  } catch(err){console.error('Erro ao carregar insights:',err.message)}
}

/* ═══════════════════════════════════════════════════
   CLIENTES
═══════════════════════════════════════════════════ */
function renderClientes(filtro) {
  const ags=todosAgendamentos||[];const mapa={}
  ags.forEach(a=>{const nome=a.pacienteNome;if(!nome)return;if(!mapa[nome])mapa[nome]={nome,telefone:a.pacienteTelefone||'',servicos:new Set(),total:0,atendimentos:0,ultimaVisita:a.data||''};mapa[nome].servicos.add(a.servico);if(a.status==='concluido'){mapa[nome].total+=Number(a.preco)||0;mapa[nome].atendimentos+=1};if(a.data>mapa[nome].ultimaVisita)mapa[nome].ultimaVisita=a.data})
  let lista=Object.values(mapa).sort((a,b)=>b.ultimaVisita.localeCompare(a.ultimaVisita))
  if(filtro&&filtro.trim()){const t=filtro.toLowerCase();lista=lista.filter(c=>c.nome.toLowerCase().includes(t)||c.telefone.includes(t))}
  const container=document.getElementById('clientes-lista');if(!container)return
  if(!lista.length){container.innerHTML='<div class="vazio">Nenhum cliente encontrado</div>';return}
  container.innerHTML=lista.map(c=>{
    const [c1,c2]=avatarColor(c.nome);const ini=c.nome[0].toUpperCase()
    const dataFmt=c.ultimaVisita?c.ultimaVisita.split('-').reverse().join('/'):'—'
    const total=c.total>0?`R$ ${c.total.toFixed(2).replace('.',',')}`:'—'
    const wppLink=c.telefone?`https://wa.me/55${c.telefone.replace(/\D/g,'')}?text=${encodeURIComponent(`Olá ${c.nome}! 😊`)}`:null
    return `<div class="ag-row"><div class="ag-avatar" style="background:linear-gradient(135deg,${c1},${c2})">${ini}</div><div class="ag-info"><div class="ag-nome">${c.nome}</div><div class="ag-servico">${[...c.servicos].slice(0,2).join(', ')}</div></div><div class="ag-time"><div class="ag-hora" style="font-size:11px;font-weight:500;color:var(--text2)">Última visita</div><div class="ag-data">${dataFmt}</div></div><div style="min-width:60px;text-align:right"><div style="font-size:10px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.05em">Gasto total</div><div style="font-size:13px;font-weight:700;color:var(--green)">${total}</div></div><div style="min-width:50px;text-align:center"><div style="font-size:10px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.05em">Visitas</div><div style="font-size:15px;font-weight:800;color:var(--text)">${c.atendimentos}</div></div>${wppLink?`<a href="${wppLink}" target="_blank" style="display:flex;align-items:center;gap:5px;background:var(--green-bg);color:var(--green);border:1px solid var(--green-border);border-radius:7px;padding:5px 10px;font-size:11.5px;font-weight:700;text-decoration:none;white-space:nowrap" onmouseover="this.style.background='var(--green)';this.style.color='white'" onmouseout="this.style.background='var(--green-bg)';this.style.color='var(--green)'"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.852L.057 23.885l6.204-1.628A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.808 9.808 0 0 1-5.001-1.366l-.359-.213-3.682.966.983-3.594-.234-.371A9.818 9.818 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/></svg>WhatsApp</a>`:'<div style="width:80px"></div>'}</div>`
  }).join('')
}
function filtrarClientes(v){renderClientes(v)}

/* ═══════════════════════════════════════════════════
   BUSCA GLOBAL
═══════════════════════════════════════════════════ */
let buscaAberta=false

function abrirBusca(){
  const overlay=document.getElementById('busca-overlay');if(!overlay)return
  overlay.classList.add('aberta')
  overlay.removeAttribute('aria-hidden')
  buscaAberta=true
  document.body.classList.add('modal-open')
  const inp=document.getElementById('busca-input')
  if(inp){inp.value='';setTimeout(()=>{inp.focus();executarBusca('')},60)}
}
function fecharBusca(){
  const overlay=document.getElementById('busca-overlay')
  if(overlay){overlay.classList.remove('aberta');overlay.setAttribute('aria-hidden','true')}
  buscaAberta=false
  document.body.classList.remove('modal-open')
}
function executarBusca(q){
  const res=document.getElementById('busca-resultados');if(!res)return; const ags=todosAgendamentos||[]
  if(!q||!q.trim()){const hoje=new Date().toISOString().split('T')[0];const deHoje=ags.filter(a=>a.data===hoje).slice(0,6);if(!deHoje.length){res.innerHTML='<div style="text-align:center;color:var(--text3);padding:28px;font-size:13px">Digite para buscar por nome, serviço ou data</div>';return};res.innerHTML='<div class="busca-secao-label">Agendamentos de hoje</div>'+deHoje.map(buscaItemHTML).join('');return}
  const termo=q.toLowerCase().trim(); const encontrados=ags.filter(a=>(a.pacienteNome||'').toLowerCase().includes(termo)||(a.servico||'').toLowerCase().includes(termo)||(a.data||'').includes(termo)||(a.hora||'').includes(termo)||(a.pacienteTelefone||'').includes(termo)).slice(0,12)
  if(!encontrados.length){res.innerHTML=`<div style="text-align:center;color:var(--text3);padding:28px;font-size:13px">Nenhum resultado para "<strong>${q}</strong>"</div>`;return}
  res.innerHTML=`<div class="busca-secao-label">${encontrados.length} resultado${encontrados.length>1?'s':''}</div>`+encontrados.map(buscaItemHTML).join('')
}
function buscaItemHTML(a){
  const [c1,c2]=avatarColor(a.pacienteNome);const ini=(a.pacienteNome||'C')[0].toUpperCase()
  const dataFmt=a.data?a.data.split('-').reverse().join('/'):''; const preco=a.preco?` · R$${Number(a.preco).toFixed(2).replace('.',',')}`:'';
  const statusCor={confirmado:'#10b981',concluido:'#8b5cf6',cancelado:'#ef4444',pendente:'#f59e0b'}[a.status]||'#8b9ab4'
  return `<div class="busca-item" onclick="buscaSelecionarAgendamento('${a._id}','${a.data||''}')" role="option" tabindex="0"><div class="busca-avatar-mini" style="background:linear-gradient(135deg,${c1},${c2})">${ini}</div><div class="busca-item-info"><div class="busca-item-nome">${a.pacienteNome||'—'}</div><div class="busca-item-sub">${a.servico||''} · ${dataFmt} às ${a.hora||''}${preco}</div></div><span class="busca-item-badge" style="background:${statusCor}22;color:${statusCor};border:1px solid ${statusCor}44">${a.status}</span></div>`
}
function buscaSelecionarAgendamento(id,data){fecharBusca();irPara('agendamentos',document.getElementById('menu-agendamentos'));if(data){const inp=document.getElementById('ag-filtro-data');if(inp){inp.value=data;agFiltrarData(data)}}}

document.addEventListener('keydown',e=>{
  if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();buscaAberta?fecharBusca():abrirBusca()}
})

/* ═══════════════════════════════════════════════════
   TOPBAR — notificações, mensagens, avatar
═══════════════════════════════════════════════════ */
function abrirNotificacoes(){fecharTodosDropdowns();const panel=document.getElementById('notif-panel');if(!panel)return;renderNotificacoes();panel.classList.add('aberto')}

function renderNotificacoes(){
  const panel=document.getElementById('notif-panel');if(!panel)return
  const ags=todosAgendamentos||[];const hoje=new Date().toISOString().split('T')[0]
  const deHoje=ags.filter(a=>a.data===hoje).sort((a,b)=>a.hora.localeCompare(b.hora))
  const proximos=ags.filter(a=>a.data>hoje&&a.status==='confirmado').slice(0,3)
  const total=deHoje.length+proximos.length
  let html=`<div class="notif-header"><span class="notif-title">Notificações</span>${total>0?`<span class="notif-badge">${total}</span>`:''}</div><div class="notif-body">`
  if(!deHoje.length&&!proximos.length)html+=`<div class="notif-vazio">Sem agendamentos próximos</div>`
  if(deHoje.length){html+=`<div class="busca-secao-label" style="padding:12px 18px 6px">Hoje (${deHoje.length})</div>`;html+=deHoje.slice(0,5).map(a=>{const cor={confirmado:'blue',concluido:'green',cancelado:'red',pendente:'yellow'}[a.status]||'blue';const svgMap={blue:`<svg width="14" height="14" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="5.5" stroke="#3b82f6" stroke-width="1.4"/><path d="M7.5 4.5V8l2 2" stroke="#3b82f6" stroke-width="1.4" stroke-linecap="round"/></svg>`,green:`<svg width="14" height="14" viewBox="0 0 15 15" fill="none"><path d="M2 7l4 4L13 4" stroke="#10b981" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,red:`<svg width="14" height="14" viewBox="0 0 15 15" fill="none"><path d="M4 4l7 7M11 4l-7 7" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round"/></svg>`,yellow:`<svg width="14" height="14" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="5.5" stroke="#f59e0b" stroke-width="1.4"/><path d="M7.5 5v3M7.5 10v.5" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round"/></svg>`};return `<div class="notif-item"><div class="notif-icon ${cor}">${svgMap[cor]}</div><div class="notif-item-texto"><div class="notif-item-titulo">${a.pacienteNome}</div><div class="notif-item-sub">${a.servico}</div><div class="notif-item-hora">às ${a.hora}</div></div></div>`}).join('')}
  if(proximos.length){html+=`<div class="busca-secao-label" style="padding:12px 18px 6px">Próximos</div>`;html+=proximos.map(a=>{const dt=a.data?a.data.split('-').reverse().join('/'):'';return `<div class="notif-item"><div class="notif-icon blue"><svg width="14" height="14" viewBox="0 0 15 15" fill="none"><rect x="1.5" y="2.5" width="12" height="11" rx="1.5" stroke="#3b82f6" stroke-width="1.3"/><path d="M5 1.5v2M10 1.5v2M1.5 5.5h12" stroke="#3b82f6" stroke-width="1.3" stroke-linecap="round"/></svg></div><div class="notif-item-texto"><div class="notif-item-titulo">${a.pacienteNome}</div><div class="notif-item-sub">${a.servico}</div><div class="notif-item-hora">${dt} às ${a.hora}</div></div></div>`}).join('')}
  html+=`</div><div class="notif-ver-todos" onclick="irPara('agendamentos',document.getElementById('menu-agendamentos'));fecharTodosDropdowns()">Ver todos os agendamentos</div>`
  panel.innerHTML=html
}

function abrirMensagens(){
  fecharTodosDropdowns();const panel=document.getElementById('msg-panel');if(!panel)return
  const ags=todosAgendamentos||[];const vistos={};const cutoff=new Date(Date.now()-30*864e5).toISOString().split('T')[0]
  ags.filter(a=>a.pacienteTelefone&&a.data>=cutoff).forEach(a=>{if(!vistos[a.pacienteNome])vistos[a.pacienteNome]={nome:a.pacienteNome,tel:a.pacienteTelefone}})
  const lista=Object.values(vistos).slice(0,8); const negNome=negocioAtual?negocioAtual.nome:'nosso negócio'
  let html=`<div class="msg-header"><span class="msg-title">Enviar mensagem</span></div><div class="msg-sub">Clientes recentes — abre WhatsApp</div>`
  if(!lista.length)html+=`<div class="msg-vazio">Nenhum cliente com telefone cadastrado</div>`
  else html+=lista.map(c=>{const [c1,c2]=avatarColor(c.nome);const ini=c.nome[0].toUpperCase();const tel=c.tel.replace(/\D/g,'');const msg=encodeURIComponent(`Olá ${c.nome}! Tudo bem? Aqui é da ${negNome}. 😊`);const link=`https://wa.me/55${tel}?text=${msg}`;return `<div class="msg-item" onclick="window.open('${link}','_blank');fecharTodosDropdowns()"><div class="msg-avatar-mini" style="background:linear-gradient(135deg,${c1},${c2})">${ini}</div><div class="msg-item-info"><div class="msg-item-nome">${c.nome}</div><div class="msg-item-tel">${c.tel}</div></div><div class="msg-wpp-btn">WhatsApp</div></div>`}).join('')
  panel.innerHTML=html; panel.classList.add('aberto')
}

function abrirAvatarMenu(){
  const menu=document.getElementById('avatar-menu');if(!menu)return
  const aberto=menu.style.display!=='none'&&menu.style.display!==''; fecharTodosDropdowns()
  if(!aberto){
    const elNeg=document.getElementById('avatar-menu-negocio');const elAv=document.getElementById('avatar-menu-av')||document.getElementById('avatar-menu-avatar')
    if(negocioAtual&&elNeg)elNeg.textContent=negocioAtual.nome; if(negocioAtual&&elAv)elAv.textContent=negocioAtual.nome[0].toUpperCase()
    const elTema=document.getElementById('avatar-menu-tema-label');if(elTema)elTema.textContent=localStorage.getItem('tema')==='escuro'?'Mudar para claro':'Mudar para escuro'
    menu.style.display='block'; menu.removeAttribute('aria-hidden')
  }
}

function fecharTodosDropdowns(){
  const notif=document.getElementById('notif-panel');const msg=document.getElementById('msg-panel');const avatar=document.getElementById('avatar-menu');const neg=document.getElementById('neg-dropdown')
  if(notif)notif.classList.remove('aberto'); if(msg)msg.classList.remove('aberto')
  if(avatar){avatar.style.display='none';avatar.setAttribute('aria-hidden','true')}
  if(neg){neg.classList.remove('show');const chev=document.getElementById('neg-chevron');if(chev)chev.classList.remove('open')}
}
window.fecharTodosDropdowns=fecharTodosDropdowns

function atualizarPix(){const elPix=document.getElementById('finance-pix');if(!elPix)return;const mes=mesAtualChave();const doMes=todosAgendamentos.filter(a=>a.data?.startsWith(mes));const pagos=doMes.filter(a=>a.pagamento?.status==='pago').length;const pct=doMes.length>0?Math.round((pagos/doMes.length)*100):0;elPix.textContent=`${pct}%`}

/* ═══════════════════════════════════════════════════
   PWA
═══════════════════════════════════════════════════ */
let deferredPrompt=null
if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{})
function isAppInstalled(){return window.navigator.standalone===true||window.matchMedia('(display-mode: standalone)').matches}
function atualizarBotaoInstalar(){const btn=document.getElementById('btn-instalar-app');if(btn&&isAppInstalled())btn.style.display='none'}
atualizarBotaoInstalar()
document.addEventListener('visibilitychange',()=>{if(!document.hidden)atualizarBotaoInstalar()})
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;const btn=document.getElementById('btn-instalar-app');if(btn)btn.style.display=''})
window.addEventListener('appinstalled',()=>{deferredPrompt=null;const btn=document.getElementById('btn-instalar-app');if(btn)btn.style.display='none'})
const _installBtn=document.getElementById('btn-instalar-app')
if(_installBtn)_installBtn.onclick=function(){if(isAppInstalled()){this.style.display='none';return};if(deferredPrompt){deferredPrompt.prompt();deferredPrompt.userChoice.then(()=>{deferredPrompt=null})}}

/* ═══════════════════════════════════════════════════
   DOMContentLoaded
═══════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  ;['novo-servico','novo-preco'].forEach(id=>{const el=document.getElementById(id);if(el)el.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();adicionarServico()}})})

  const btnBusca = document.querySelector('.main-topbar-search')
  if(btnBusca) btnBusca.addEventListener('click', abrirBusca)

  const sinoBtn = document.getElementById('btn-notif')
  if(sinoBtn){
    sinoBtn.onclick = function(e){ e.stopPropagation(); fecharTodosDropdowns(); abrirNotificacoes() }
    const dot=document.createElement('div'); dot.id='notif-dot'; dot.className='notif-dot-badge'; dot.style.display='none'; dot.setAttribute('aria-hidden','true'); sinoBtn.appendChild(dot)
  }

  const envBtn = document.getElementById('btn-msg')
  if(envBtn) envBtn.onclick = function(e){ e.stopPropagation(); fecharTodosDropdowns(); abrirMensagens() }

  const avatarBtn = document.getElementById('topbar-avatar-btn')
  if(avatarBtn) avatarBtn.onclick = e => { e.stopPropagation(); abrirAvatarMenu() }

  const isMac = navigator.platform.toUpperCase().includes('MAC')
  const searchSpan = document.querySelector('.main-topbar-search span')
  if(searchSpan) searchSpan.textContent = `Buscar... (${isMac?'⌘K':'Ctrl+K'})`

  const btnBuscaMobile = document.querySelector('.topbar-mobile-btn[aria-label="Buscar"]')
  if(btnBuscaMobile) btnBuscaMobile.onclick = function(e){ e.stopPropagation(); abrirBusca() }

  const btnNotifMobile = document.getElementById('btn-notif-mobile')
  if(btnNotifMobile) btnNotifMobile.onclick = function(e){ e.stopPropagation(); fecharTodosDropdowns(); abrirNotificacoes() }

  const btnMsgMobile = document.querySelector('.topbar-mobile-btn[aria-label="Mensagens"]')
  if(btnMsgMobile) btnMsgMobile.onclick = function(e){ e.stopPropagation(); fecharTodosDropdowns(); abrirMensagens() }

  const btnTemaMobile = document.querySelector('.topbar-mobile-btn[aria-label="Tema"]')
  if(btnTemaMobile) btnTemaMobile.onclick = function(e){ e.stopPropagation(); toggleTema() }

  const buscaOverlay = document.getElementById('busca-overlay')
  if(buscaOverlay){
    buscaOverlay.addEventListener('click', function(e){
      if(e.target === buscaOverlay) fecharBusca()
    })
  }

  document.querySelectorAll('.page').forEach(p=>{if(!p.classList.contains('ativo'))p.setAttribute('aria-hidden','true')})
})

/* ═══════════════════════════════════════════════════
   AUTOMAÇÃO
═══════════════════════════════════════════════════ */
;(function () {
  let tipoSelecionado = '24h'
 
  const mensagensAuto = {
    '24h': 'Olá {nome}! 👋\nLembramos que você tem um agendamento amanhã, {data}, às {hora} — {servico}.\nEstamos te esperando! 🙏',
    '1h':  'Olá {nome}! ⏰\nSeu agendamento é em 1 hora — {hora}. Serviço: {servico}.\nTe esperamos em breve! 😊',
    'pos': 'Olá {nome}! 🙏\nObrigado por nos visitar hoje! Foi um prazer te atender.\nAgende seu próximo horário: {link}',
  }
 
  const titulos = {
    '24h': 'Editar lembrete 24h antes',
    '1h':  'Editar lembrete 1h antes',
    'pos': 'Editar mensagem pós-atendimento',
  }
 
  const campoBanco = {
    '24h': 'lembrete',
    '1h':  'lembrete1h',
    'pos': 'posAtendimento',
  }
 
  const estadoTipos = {
    '24h': { ativo: true,  mensagem: mensagensAuto['24h'] },
    '1h':  { ativo: true,  mensagem: mensagensAuto['1h']  },
    'pos': { ativo: false, mensagem: mensagensAuto['pos'] },
  }
 
  // ─── Lê o textarea e atualiza o estado do tipo selecionado ───────
  function syncTextareaParaEstado() {
    const ta = document.getElementById('auto-mensagem-textarea')
    if (ta) estadoTipos[tipoSelecionado].mensagem = ta.value
  }
 
  // ─── Lê o toggle do editor e atualiza o estado do tipo selecionado
  function syncToggleEditorParaEstado() {
    const toggleEditor = document.getElementById('toggle-editor-main')
    if (toggleEditor) {
      estadoTipos[tipoSelecionado].ativo = toggleEditor.classList.contains('on')
    }
  }
 
  // ─── Carrega configuração real do banco ao inicializar ───────────
  async function carregarAutomacaoDoServidor() {
    if (!window.negocioAtual) return
    try {
      const res  = await fetch(`${window.API}/auth/negocio/${window.negocioAtual._id}`)
      const data = await res.json()
 
      if (data.lembrete) {
        estadoTipos['24h'].ativo    = !!data.lembrete.ativo
        estadoTipos['24h'].mensagem = data.lembrete.mensagem || mensagensAuto['24h']
      }
      if (data.lembrete1h) {
        estadoTipos['1h'].ativo    = !!data.lembrete1h.ativo
        estadoTipos['1h'].mensagem = data.lembrete1h.mensagem || mensagensAuto['1h']
      }
      if (data.posAtendimento) {
        estadoTipos['pos'].ativo    = !!data.posAtendimento.ativo
        estadoTipos['pos'].mensagem = data.posAtendimento.mensagem || mensagensAuto['pos']
      }
 
      atualizarTodosToggleCards()
      atualizarEditor(tipoSelecionado)
    } catch (e) {
      console.error('[Automação] Erro ao carregar do servidor:', e)
    }
  }
 
  // ─── Atualiza os card-toggles com o estado atual ─────────────────
  function atualizarTodosToggleCards() {
    ;['24h', '1h', 'pos'].forEach(tipo => {
      const toggle = document.getElementById('toggle-' + tipo)
      if (!toggle) return
      const isOn = estadoTipos[tipo].ativo
      toggle.className = 'auto-tipo-toggle ' + (isOn ? 'on' : 'off')
      toggle.setAttribute('aria-checked', isOn)
      const card  = toggle.closest('.auto-tipo-card')
      if (!card) return
      const badge = card.querySelector('.auto-tipo-badge')
      if (badge) {
        badge.textContent = isOn ? 'Ativo' : 'Inativo'
        badge.className   = 'auto-tipo-badge ' + (isOn ? 'ativo' : 'inativo')
      }
    })
  }
 
  // ─── Atualiza o painel editor com o tipo selecionado ─────────────
  function atualizarEditor(tipo) {
    const estado = estadoTipos[tipo]
 
    const headerTitle = document.querySelector('.auto-editor-header-title')
    if (headerTitle) headerTitle.textContent = titulos[tipo] || 'Editar mensagem'
 
    const textarea = document.getElementById('auto-mensagem-textarea')
    if (textarea) {
      textarea.value = estado.mensagem
      atualizarPreviewAuto()
    }
 
    const toggleEditor = document.getElementById('toggle-editor-main')
    if (toggleEditor) {
      toggleEditor.className    = 'auto-tipo-toggle ' + (estado.ativo ? 'on' : 'off')
      toggleEditor.setAttribute('aria-checked', estado.ativo)
    }
 
    const labelAtivo = document.querySelector('.auto-ativo-label')
    if (labelAtivo) {
      labelAtivo.textContent = estado.ativo ? 'Ativo' : 'Inativo'
      labelAtivo.style.color = estado.ativo ? '#34d399' : 'var(--text3)'
    }
  }
 
  // ─── Selecionar tipo no card ──────────────────────────────────────
  window.selecionarTipoAuto = function (tipo, card) {
    // Salva o estado do textarea ANTES de trocar de tipo
    syncTextareaParaEstado()
    syncToggleEditorParaEstado()
 
    tipoSelecionado = tipo
 
    document.querySelectorAll('.auto-tipo-card').forEach(c =>
      c.classList.remove('ativo-selected')
    )
    card.classList.add('ativo-selected')
 
    atualizarEditor(tipo)
  }
 
  // ─── Toggle no card (ativa/desativa e salva imediatamente) ───────
  window.toggleAutoTipo = function (tipo, toggleEl) {
    const isOn = toggleEl.classList.contains('on')
    const novoAtivo = !isOn
 
    // 1. Atualiza estado local
    estadoTipos[tipo].ativo = novoAtivo
 
    // 2. Se for o tipo editado no momento, também sincroniza a mensagem do textarea
    if (tipo === tipoSelecionado) {
      syncTextareaParaEstado()
    }
 
    // 3. Atualiza visual do card
    toggleEl.className = 'auto-tipo-toggle ' + (novoAtivo ? 'on' : 'off')
    toggleEl.setAttribute('aria-checked', novoAtivo)
 
    const card = toggleEl.closest('.auto-tipo-card')
    if (card) {
      const badge = card.querySelector('.auto-tipo-badge')
      if (badge) {
        badge.textContent = novoAtivo ? 'Ativo' : 'Inativo'
        badge.className   = 'auto-tipo-badge ' + (novoAtivo ? 'ativo' : 'inativo')
      }
    }
 
    // 4. Se for o tipo editado, atualiza o editor principal também
    if (tipo === tipoSelecionado) {
      const toggleEditor = document.getElementById('toggle-editor-main')
      if (toggleEditor) {
        toggleEditor.className = 'auto-tipo-toggle ' + (novoAtivo ? 'on' : 'off')
        toggleEditor.setAttribute('aria-checked', novoAtivo)
      }
      const labelAtivo = document.querySelector('.auto-ativo-label')
      if (labelAtivo) {
        labelAtivo.textContent = novoAtivo ? 'Ativo' : 'Inativo'
        labelAtivo.style.color = novoAtivo ? '#34d399' : 'var(--text3)'
      }
    }
 
    // 5. Persiste imediatamente no banco
    salvarTipo(tipo)
  }
 
  // ─── Toggle no editor principal ──────────────────────────────────
  window.toggleEditorMain = function (toggleEl) {
    const isOn = toggleEl.classList.contains('on')
    const novoAtivo = !isOn
 
    // 1. Atualiza estado
    estadoTipos[tipoSelecionado].ativo = novoAtivo
    syncTextareaParaEstado()
 
    // 2. Atualiza visual do editor
    toggleEl.className = 'auto-tipo-toggle ' + (novoAtivo ? 'on' : 'off')
    toggleEl.setAttribute('aria-checked', novoAtivo)
 
    const labelAtivo = document.querySelector('.auto-ativo-label')
    if (labelAtivo) {
      labelAtivo.textContent = novoAtivo ? 'Ativo' : 'Inativo'
      labelAtivo.style.color = novoAtivo ? '#34d399' : 'var(--text3)'
    }
 
    // 3. Sincroniza o card correspondente
    const cardToggle = document.getElementById('toggle-' + tipoSelecionado)
    if (cardToggle) {
      cardToggle.className = 'auto-tipo-toggle ' + (novoAtivo ? 'on' : 'off')
      cardToggle.setAttribute('aria-checked', novoAtivo)
      const card = cardToggle.closest('.auto-tipo-card')
      if (card) {
        const badge = card.querySelector('.auto-tipo-badge')
        if (badge) {
          badge.textContent = novoAtivo ? 'Ativo' : 'Inativo'
          badge.className   = 'auto-tipo-badge ' + (novoAtivo ? 'ativo' : 'inativo')
        }
      }
    }
 
    // 4. Persiste imediatamente no banco
    salvarTipo(tipoSelecionado)
  }
 
  // ─── Inserir variável no textarea ────────────────────────────────
  window.inserirVarAuto = function (variavel) {
    const ta = document.getElementById('auto-mensagem-textarea')
    if (!ta) return
    const start = ta.selectionStart
    const end   = ta.selectionEnd
    ta.value = ta.value.substring(0, start) + variavel + ta.value.substring(end)
    ta.selectionStart = ta.selectionEnd = start + variavel.length
    ta.focus()
    atualizarPreviewAuto()
  }
 
  // ─── Preview WhatsApp ─────────────────────────────────────────────
  window.atualizarPreviewAuto = function () {
    const ta     = document.getElementById('auto-mensagem-textarea')
    const bubble = document.getElementById('auto-preview-bubble')
    if (!ta || !bubble) return
    const negNome         = (window.negocioAtual?.nome) || 'sua empresa'
    const linkAgendamento = window.negocioAtual
      ? `https://agendorapido.com.br/agendar.html?id=${window.negocioAtual._id}`
      : 'agendorapido.com.br/agendar.html?id=...'
 
    let txt = ta.value
      .replace(/\{nome\}/g,    'Carlos')
      .replace(/\{data\}/g,    '23/05')
      .replace(/\{hora\}/g,    '15:00')
      .replace(/\{servico\}/g, 'Barba')
      .replace(/\{negocio\}/g, negNome)
      .replace(/\{link\}/g,    linkAgendamento)
 
    bubble.innerHTML =
      txt.split('\n').map(l => l || '<br>').join('<br>') +
      `<div class="auto-wpp-bubble-time">10:30
        <svg width="14" height="10" viewBox="0 0 16 11" fill="none">
          <path d="M1 5.5l3.5 3.5L9 2M7 5.5l3.5 3.5L15 2"
                stroke="#4fc3f7" stroke-width="1.5"
                stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>`
  }
 
  // ─── Salvar UM tipo específico no banco ──────────────────────────
  // CORREÇÃO: sempre usa o estado já atualizado em estadoTipos[tipo]
  async function salvarTipo(tipo) {
    if (!window.negocioAtual) return
    const token = localStorage.getItem('token')
    const campo = campoBanco[tipo]
    const estado = estadoTipos[tipo]
 
    try {
      const res = await fetch(`${window.API}/auth/lembretes`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          negocioId: window.negocioAtual._id,
          campo,
          ativo: estado.ativo,
          mensagem: estado.mensagem,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('[Automação] Erro ao salvar tipo', tipo, err)
      }
    } catch (e) {
      console.error('[Automação] Erro de rede ao salvar tipo', tipo, e)
    }
  }
 
  // ─── Botão "Salvar alterações" no editor ─────────────────────────
  window.salvarAutomacao = async function () {
    syncTextareaParaEstado()
    syncToggleEditorParaEstado()
 
    const btn = document.querySelector('.auto-btn-salvar')
    if (btn) { btn.disabled = true; btn.innerHTML = 'Salvando...' }
 
    await salvarTipo(tipoSelecionado)
 
    if (btn) {
      btn.disabled = false
      btn.innerHTML = '✓ Salvo!'
      setTimeout(() => {
        btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L12 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> Salvar alterações'
      }, 2000)
    }
  }
 
  // ─── Botão "Enviar teste" ─────────────────────────────────────────
  window.enviarTesteAuto = function () {
    const btn = document.querySelector('.auto-btn-teste')
    if (!btn) return
    const orig = btn.innerHTML
    btn.innerHTML    = '✓ Teste enviado!'
    btn.style.color  = '#34d399'
    setTimeout(() => { btn.innerHTML = orig; btn.style.color = '' }, 2500)
  }
 
  window.carregarAutomacaoDoServidor = carregarAutomacaoDoServidor
})()

/* ═══════════════════════════════════════════════════
   TABELA DE AGENDAMENTOS
═══════════════════════════════════════════════════ */
function agAvatarColor(nome){const paletas=[['#1d4ed8','#3b82f6'],['#7c3aed','#8b5cf6'],['#0e7490','#06b6d4'],['#15803d','#22c55e'],['#b45309','#f59e0b'],['#be185d','#ec4899'],['#0369a1','#38bdf8'],['#6d28d9','#a78bfa'],['#9f1239','#f43f5e']];let h=0;for(const c of(nome||'A'))h=((h<<5)-h)+c.charCodeAt(0);return paletas[Math.abs(h)%paletas.length]}
function agServicoCor(status){if(status==='confirmado')return'#22c55e';if(status==='concluido')return'#a78bfa';if(status==='cancelado')return'#f87171';return'#f59e0b'}
function agDuracao(ag){if(ag.duracao)return ag.duracao+' min';const mapa={'Barba':45,'Corte':60,'Corte + Barba':75,'Sobrancelha':30,'Manicure':50};return(mapa[ag.servico]||30)+' min'}
function agFmtData(data){if(!data)return'—';const[a,m,d]=data.split('-');return `${d.padStart(2,'0')}/${m.padStart(2,'0')}/${a}`}

function agAtualizarStats(base,mes){
  const doMes=base.filter(a=>a.data&&a.data.startsWith(mes));const total=doMes.length;const concl=doMes.filter(a=>a.status==='concluido').length;const canc=doMes.filter(a=>a.status==='cancelado').length
  const pctConc=total?Math.round((concl/total)*100):0;const pctCanc=total?Math.round((canc/total)*100):0
  const elTotal=document.getElementById('ag-stat-total-num');const elConc=document.getElementById('ag-stat-conc-num');const elCanc=document.getElementById('ag-stat-canc-num');const elPConc=document.getElementById('ag-stat-conc-pct');const elPCanc=document.getElementById('ag-stat-canc-pct')
  if(elTotal)elTotal.textContent=total;if(elConc)elConc.textContent=concl;if(elCanc)elCanc.textContent=canc;if(elPConc)elPConc.textContent=pctConc+'%';if(elPCanc)elPCanc.textContent=pctCanc+'%'
}

function agAplicarFiltro(){
  const base=todosAgendamentos||[];const hoje=new Date().toISOString().split('T')[0]
  const inicioSemana=(()=>{const d=new Date();d.setDate(d.getDate()-d.getDay());return d.toISOString().split('T')[0]})()
  const fimSemana=(()=>{const d=new Date();d.setDate(d.getDate()+(6-d.getDay()));return d.toISOString().split('T')[0]})()
  const mes=new Date().toISOString().slice(0,7)
  let lista=[...base]
  if(agFiltroDataAtivo){lista=lista.filter(a=>a.data===agFiltroDataAtivo)}
  else if(agFiltroAtivo==='hoje')lista=lista.filter(a=>a.data===hoje)
  else if(agFiltroAtivo==='semana')lista=lista.filter(a=>a.data>=inicioSemana&&a.data<=fimSemana)
  else if(agFiltroAtivo==='mes')lista=lista.filter(a=>a.data&&a.data.startsWith(mes))
  else if(agFiltroAtivo==='concluido')lista=lista.filter(a=>a.status==='concluido')
  else if(agFiltroAtivo==='cancelado')lista=lista.filter(a=>a.status==='cancelado')
  lista.sort((a,b)=>((b.data||'')+(b.hora||'')).localeCompare((a.data||'')+(a.hora||'')))
  agListaFiltrada=lista; agPagina=1; agAtualizarStats(base,mes); agRenderTabela()
}

function agRenderTabela(){
  const tbody=document.getElementById('ag-nova-tbody');const mcards=document.getElementById('ag-mobile-cards');const pag=document.getElementById('ag-nova-pag')
  const total=agListaFiltrada.length;const totalPg=Math.ceil(total/agPorPagina);const inicio=(agPagina-1)*agPorPagina;const fim=inicio+agPorPagina;const slice=agListaFiltrada.slice(inicio,fim)
  if(!total){
    if(tbody)tbody.innerHTML='<div style="text-align:center;color:var(--text3);padding:52px 20px;font-size:13.5px">Nenhum agendamento encontrado</div>'
    if(mcards)mcards.innerHTML='<div style="text-align:center;color:var(--text3);padding:36px 18px;font-size:13px">Nenhum agendamento encontrado</div>'
    if(pag)pag.style.display='none'; return
  }
  const statusLabel={confirmado:'confirmado',concluido:'concluído',cancelado:'cancelado',pendente:'pendente',agendado:'agendado'}
  if(tbody){tbody.innerHTML=slice.map(a=>{const[c1,c2]=agAvatarColor(a.pacienteNome);const ini=(a.pacienteNome||'C')[0].toUpperCase();const corPonto=agServicoCor(a.status);const dur=agDuracao(a);const cls=a.status||'pendente';const label=statusLabel[a.status]||a.status;const nomeSafe=(a.pacienteNome||'').replace(/'/g,"\\'");const telSafe=(a.pacienteTelefone||'').replace(/'/g,"\\'");const acoes=a.status==='confirmado'?`<button class="btn-acao concluir" onclick="atualizar('${a._id}','concluido')" type="button">Concluir</button><button class="btn-acao cancelar" onclick="cancelarComAviso('${a._id}','${nomeSafe}','${telSafe}','${a.data}','${a.hora}')" type="button">Cancelar</button>`:`<button class="ag-ver-btn" type="button">Ver</button>`;return `<div class="ag-nova-row"><div class="ag-nova-cliente"><div class="ag-nova-avatar" style="background:linear-gradient(135deg,${c1},${c2})">${ini}<div class="ag-nova-avatar-dot" style="background:${corPonto}"></div></div><div><div class="ag-nova-nome">${a.pacienteNome||'—'}</div><div class="ag-nova-tel">${a.pacienteTelefone||'—'}</div></div></div><div class="ag-nova-servico"><div class="ag-nova-serv-nome">${a.servico||'—'}</div><div class="ag-nova-serv-dur">${dur}<span class="ag-nova-serv-dur-dot" style="background:${corPonto}"></span></div></div><div class="ag-nova-data"><div class="ag-nova-data-row">${agFmtData(a.data)}</div><div class="ag-nova-data-row">às ${a.hora||'—'}</div></div><div><span class="badge ${cls}">${label}</span></div><div class="ag-nova-acoes">${acoes}</div></div>`}).join('')}
  if(mcards){mcards.innerHTML=slice.map(a=>{const[c1,c2]=agAvatarColor(a.pacienteNome);const ini=(a.pacienteNome||'C')[0].toUpperCase();const cls=a.status||'pendente';const label=statusLabel[a.status]||a.status;const nomeSafe=(a.pacienteNome||'').replace(/'/g,"\\'");const telSafe=(a.pacienteTelefone||'').replace(/'/g,"\\'");const acoes=a.status==='confirmado'?`<button class="btn-acao concluir" onclick="atualizar('${a._id}','concluido')" type="button">Concluir</button><button class="btn-acao cancelar" onclick="cancelarComAviso('${a._id}','${nomeSafe}','${telSafe}','${a.data}','${a.hora}')" type="button">Cancelar</button>`:`<button class="ag-ver-btn" style="flex:1" type="button">Ver detalhes</button>`;return `<div class="ag-mobile-card"><div class="ag-mobile-top"><div style="display:flex;align-items:center;gap:10px"><div class="ag-nova-avatar" style="background:linear-gradient(135deg,${c1},${c2});width:34px;height:34px;font-size:12px;flex-shrink:0">${ini}</div><div><div class="ag-nova-nome">${a.pacienteNome||'—'}</div><div class="ag-nova-tel">${a.pacienteTelefone||''}</div></div></div><span class="badge ${cls}">${label}</span></div><div class="ag-mobile-chips"><span class="ag-mobile-chip">${agFmtData(a.data)}</span><span class="ag-mobile-chip">às ${a.hora||'—'}</span><span class="ag-mobile-chip">${a.servico||'—'}</span><span class="ag-mobile-chip">${agDuracao(a)}</span></div><div class="ag-mobile-actions">${acoes}</div></div>`}).join('')}
  if(pag){
    const elPagInfo=document.getElementById('ag-pag-info');const elPagBtns=document.getElementById('ag-pag-btns')
    if(elPagInfo)elPagInfo.textContent=`Mostrando ${inicio+1} a ${Math.min(fim,total)} de ${total} agendamentos`
    if(elPagBtns){let btns=`<button class="ag-pag-btn" onclick="agIrPagina(${agPagina-1})" ${agPagina===1?'disabled':''} type="button">‹</button>`;for(let i=1;i<=totalPg;i++){if(totalPg<=7||i===1||i===totalPg||Math.abs(i-agPagina)<=1)btns+=`<button class="ag-pag-btn ${i===agPagina?'ativo':''}" onclick="agIrPagina(${i})" type="button">${i}</button>`;else if(Math.abs(i-agPagina)===2)btns+=`<span style="color:var(--text3);font-size:12px;padding:0 2px">…</span>`};btns+=`<button class="ag-pag-btn" onclick="agIrPagina(${agPagina+1})" ${agPagina===totalPg?'disabled':''} type="button">›</button>`;elPagBtns.innerHTML=btns}
    pag.style.display=totalPg>=1?'flex':'none'
  }
}

function agFiltrar(filtro,btn){
  agFiltroAtivo=filtro;agFiltroDataAtivo='';const dataInput=document.getElementById('ag-filtro-data');if(dataInput)dataInput.value=''
  document.querySelectorAll('.ag-tab').forEach(b=>{b.classList.remove('ativo');b.setAttribute('aria-selected','false')})
  if(btn){btn.classList.add('ativo');btn.setAttribute('aria-selected','true')}
  agAplicarFiltro()
}
function agFiltrarData(val){
  agFiltroDataAtivo=val
  if(val){document.querySelectorAll('.ag-tab').forEach(b=>{b.classList.remove('ativo');b.setAttribute('aria-selected','false')})}
  agAplicarFiltro()
}
function agIrPagina(n){const total=Math.ceil(agListaFiltrada.length/agPorPagina);if(n<1||n>total)return;agPagina=n;agRenderTabela()}
function agMudarPorPagina(val){agPorPagina=parseInt(val);agPagina=1;agRenderTabela()}

/* ═══════════════════════════════════════════════════
   CONFIGURAÇÕES — lista de serviços avançada
═══════════════════════════════════════════════════ */
const CFG_PALETA=[{bg:'rgba(239,68,68,0.18)',bd:'rgba(239,68,68,0.35)',cor:'#f87171'},{bg:'rgba(249,115,22,0.18)',bd:'rgba(249,115,22,0.35)',cor:'#fb923c'},{bg:'rgba(234,179,8,0.18)',bd:'rgba(234,179,8,0.35)',cor:'#facc15'},{bg:'rgba(16,185,129,0.18)',bd:'rgba(16,185,129,0.35)',cor:'#34d399'},{bg:'rgba(59,130,246,0.18)',bd:'rgba(59,130,246,0.35)',cor:'#60a5fa'},{bg:'rgba(139,92,246,0.18)',bd:'rgba(139,92,246,0.35)',cor:'#a78bfa'},{bg:'rgba(236,72,153,0.18)',bd:'rgba(236,72,153,0.35)',cor:'#f472b6'},{bg:'rgba(6,182,212,0.18)',bd:'rgba(6,182,212,0.35)',cor:'#22d3ee'}]
function cfgPaletaFor(nome){let h=0;for(const c of(nome||'A'))h=((h<<5)-h)+c.charCodeAt(0);return CFG_PALETA[Math.abs(h)%CFG_PALETA.length]}
let cfgEditIdx=-1

function cfgRenderServicos(){
  const lista=servicosAtuais||[]
  const cont=document.getElementById('cfg-servicos-lista')
  const badge=document.getElementById('cfg-badge-num')
  if(badge)badge.textContent=lista.length
  if(!cont)return
  if(!lista.length){
    cont.innerHTML=`<div class="cfg-lista-vazia"><div>Nenhum serviço cadastrado ainda.</div><div style="font-size:12px;color:var(--text3);margin-top:4px">Use o formulário acima para adicionar.</div></div>`
    return
  }
  cont.innerHTML=lista.map((s,i)=>{
    const nome=typeof s==='object'?s.nome:s
    const preco=typeof s==='object'?Number(s.preco||0):0
    const desc=typeof s==='object'?(s.desc||s.descricao||''):''
    const dur=typeof s==='object'?(s.duracao||0):0
    const pal=cfgPaletaFor(nome)
    const ini=(nome||'?')[0].toUpperCase()
    const precoFmt=preco>0?`R$ ${preco.toFixed(2).replace('.',',')}`:`<span style="color:var(--text3)">—</span>`
    const durLabel=dur>0?`<span class="cfg-serv-dur">${dur} min</span>`:''
    const descLabel=desc?`<span class="cfg-serv-desc">${desc}</span>`:''
    return `<div class="cfg-serv-row" draggable="true" data-idx="${i}">
      <div class="cfg-drag-handle" title="Arrastar para reordenar">
        <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
          <circle cx="4" cy="3" r="1.2" fill="currentColor"/><circle cx="8" cy="3" r="1.2" fill="currentColor"/>
          <circle cx="4" cy="7" r="1.2" fill="currentColor"/><circle cx="8" cy="7" r="1.2" fill="currentColor"/>
          <circle cx="4" cy="11" r="1.2" fill="currentColor"/><circle cx="8" cy="11" r="1.2" fill="currentColor"/>
        </svg>
      </div>
      <div class="cfg-serv-avatar" style="background:${pal.bg};border-color:${pal.bd};color:${pal.cor}">${ini}</div>
      <div class="cfg-serv-info">
        <div class="cfg-serv-nome">${nome}</div>
        <div class="cfg-serv-meta">${descLabel}${durLabel}</div>
      </div>
      <div class="cfg-serv-preco">${precoFmt}</div>
      <div class="cfg-serv-acoes">
        <button class="cfg-act-btn cfg-act-edit" onclick="cfgAbrirModalEditar(${i})" title="Editar" type="button">
          <svg width="13" height="13" viewBox="0 0 15 15" fill="none"><path d="M10.5 2.5l2 2-8 8H2.5v-2l8-8Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
        </button>
        <button class="cfg-act-btn cfg-act-del" onclick="cfgRemoverServico(${i})" title="Remover" type="button">
          <svg width="13" height="13" viewBox="0 0 15 15" fill="none"><path d="M2.5 4h10M5 4V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1M6 7v4M9 7v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.5 4l.5 8a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1l.5-8" stroke="currentColor" stroke-width="1.3"/></svg>
        </button>
      </div>
    </div>`
  }).join('')
  cfgInitDragDrop()
}

function cfgAdicionarServico(){
  const nomeEl=document.getElementById('cfg-novo-servico')
  const precoEl=document.getElementById('cfg-novo-preco')
  const erroEl=document.getElementById('cfg-add-erro')
  const nome=(nomeEl?nomeEl.value:'').trim()
  const preco=parseFloat(precoEl?precoEl.value:'')
  if(erroEl)erroEl.textContent=''
  if(nomeEl)nomeEl.classList.remove('cfg-input-erro')
  if(precoEl)precoEl.classList.remove('cfg-input-erro')
  if(!nome){if(erroEl)erroEl.textContent='⚠ Digite o nome do serviço.';if(nomeEl){nomeEl.classList.add('cfg-input-erro');nomeEl.focus()};return}
  if(!precoEl||!precoEl.value.trim()||isNaN(preco)||preco<=0){if(erroEl)erroEl.textContent='⚠ O preço é obrigatório e deve ser maior que R$ 0,00.';if(precoEl){precoEl.classList.add('cfg-input-erro');precoEl.focus()};return}
  if(servicosAtuais.some(s=>(typeof s==='object'?s.nome:s).toLowerCase()===nome.toLowerCase())){if(erroEl)erroEl.textContent='⚠ Já existe um serviço com esse nome.';if(nomeEl){nomeEl.classList.add('cfg-input-erro');nomeEl.focus()};return}
  servicosAtuais.push({nome,preco})
  if(nomeEl)nomeEl.value=''
  if(precoEl)precoEl.value=''
  if(nomeEl)nomeEl.focus()
  cfgRenderServicos()
  renderIntervalosServicos()
}

function cfgRemoverServico(i){
  const nome=typeof servicosAtuais[i]==='object'?servicosAtuais[i].nome:servicosAtuais[i]
  if(intervalosServicos)delete intervalosServicos[nome]
  servicosAtuais.splice(i,1)
  cfgRenderServicos()
  renderIntervalosServicos()
}

function cfgAbrirModalEditar(i){
  cfgEditIdx=i
  const s=servicosAtuais[i]||{}
  const nomeEl=document.getElementById('cfg-edit-nome')
  const precoEl=document.getElementById('cfg-edit-preco')
  const descEl=document.getElementById('cfg-edit-desc')
  const durEl=document.getElementById('cfg-edit-duracao')
  if(nomeEl)nomeEl.value=typeof s==='object'?s.nome:s
  if(precoEl)precoEl.value=typeof s==='object'?(s.preco||''):''
  if(descEl)descEl.value=typeof s==='object'?(s.desc||s.descricao||''):''
  if(durEl)durEl.value=typeof s==='object'?(s.duracao||''):''
  const modal=document.getElementById('cfg-modal-editar')
  if(modal){modal.style.display='flex';document.body.classList.add('modal-open')}
}

function cfgFecharModalEditar(){
  const modal=document.getElementById('cfg-modal-editar')
  if(modal){modal.style.display='none';document.body.classList.remove('modal-open')}
  cfgEditIdx=-1
}

function cfgSalvarEdicao(){
  if(cfgEditIdx<0)return
  const nomeEl=document.getElementById('cfg-edit-nome')
  const precoEl=document.getElementById('cfg-edit-preco')
  const descEl=document.getElementById('cfg-edit-desc')
  const durEl=document.getElementById('cfg-edit-duracao')
  const nome=nomeEl?nomeEl.value.trim():''
  if(!nome){alert('Digite o nome do serviço.');return}
  const preco=parseFloat(precoEl?precoEl.value:'')||0
  const desc=descEl?descEl.value.trim():''
  const duracao=parseInt(durEl?durEl.value:'')||0
  servicosAtuais[cfgEditIdx]={nome,preco,desc,duracao}
  cfgRenderServicos()
  renderIntervalosServicos()
  cfgFecharModalEditar()
}

async function cfgSalvarServicos(){
  if(!negocioAtual)return
  const token=localStorage.getItem('token')
  const btn=document.getElementById('cfg-btn-salvar-servicos')
  if(btn){btn.disabled=true;btn.textContent='Salvando...'}
  try{
    const res=await fetch(`${API}/auth/servicos`,{method:'PATCH',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({negocioId:negocioAtual._id,servicos:servicosAtuais})})
    if(!res.ok){const err=await res.json();console.error('Erro ao salvar:',err);return}
    const msg=document.getElementById('cfg-salvo-msg')
    if(msg){msg.style.display='inline';setTimeout(()=>msg.style.display='none',2500)}
  }catch(e){console.error('Erro na requisição:',e)}
  finally{
    if(btn){btn.disabled=false;btn.innerHTML='<svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L12 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> Salvar alterações'}
  }
}

window.salvarServicos = cfgSalvarServicos

function abrirMinhaPagina(e){
  if(e)e.preventDefault()
  if(!negocioAtual)return
  window.open(urlAgendamento(negocioAtual),'_blank')
}

function cfgInitDragDrop(){
  let dragSrc=null
  document.querySelectorAll('.cfg-serv-row').forEach(row=>{
    row.addEventListener('dragstart',e=>{dragSrc=row;row.classList.add('cfg-dragging')})
    row.addEventListener('dragend',()=>{document.querySelectorAll('.cfg-serv-row').forEach(r=>r.classList.remove('cfg-dragging','cfg-drag-over'));dragSrc=null})
    row.addEventListener('dragover',e=>{e.preventDefault();if(row!==dragSrc){document.querySelectorAll('.cfg-serv-row').forEach(r=>r.classList.remove('cfg-drag-over'));row.classList.add('cfg-drag-over')}})
    row.addEventListener('drop',e=>{
      e.preventDefault()
      if(!dragSrc||row===dragSrc)return
      const src=parseInt(dragSrc.dataset.idx)
      const dest=parseInt(row.dataset.idx)
      const tmp=servicosAtuais.splice(src,1)[0]
      servicosAtuais.splice(dest,0,tmp)
      cfgRenderServicos()
    })
  })
}

/* ═══════════════════════════════════════════════════
   PERSISTÊNCIA DE STATS — nunca regride para zero
═══════════════════════════════════════════════════ */
function statKey(nid, campo) {
  return `stat_${campo}_${nid}_${mesAtualChave()}`
}

function getStatSalvo(nid, campo) {
  const v = localStorage.getItem(statKey(nid, campo))
  return v !== null ? parseFloat(v) : null
}

function setStatSalvo(nid, campo, valor) {
  const atual = getStatSalvo(nid, campo)
  if (atual === null || valor >= atual) {
    localStorage.setItem(statKey(nid, campo), String(valor))
  }
}

function getStatComFallback(nid, campo, valorCalculado) {
  const salvo = getStatSalvo(nid, campo) || 0
  return Math.max(valorCalculado, salvo)
}

/* ═══════════════════════════════════════════════════
   CACHE LOCAL DE AGENDAMENTOS CONCLUÍDOS
═══════════════════════════════════════════════════ */
function cacheKey(nid) { return `ags_concluidos_${nid}` }

function getCacheConc(nid) {
  try { return JSON.parse(localStorage.getItem(cacheKey(nid)) || '[]') } catch { return [] }
}

function setCacheConc(nid, lista) {
  const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 2)
  const cutStr = cutoff.toISOString().split('T')[0]
  const filtrado = lista.filter(a => (a.data || '') >= cutStr)
  try { localStorage.setItem(cacheKey(nid), JSON.stringify(filtrado)) } catch {}
}

function mergeComCache(nid, agsDaAPI) {
  const cache = getCacheConc(nid)
  const idsAPI = new Set(agsDaAPI.map(a => a._id))
  const apenasNoCache = cache.filter(a => !idsAPI.has(a._id))
  return [...agsDaAPI, ...apenasNoCache]
}

function salvarConcluidosNoCache(nid, ags) {
  const cache = getCacheConc(nid)
  const cacheMap = {}
  cache.forEach(a => cacheMap[a._id] = a)
  ags.filter(a => a.status === 'concluido').forEach(a => cacheMap[a._id] = a)
  setCacheConc(nid, Object.values(cacheMap))
}

document.addEventListener('DOMContentLoaded',()=>{
  const nEl=document.getElementById('cfg-novo-servico')
  const pEl=document.getElementById('cfg-novo-preco')
  if(nEl)nEl.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();cfgAdicionarServico()}})
  if(pEl)pEl.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();cfgAdicionarServico()}})
})

/* ═══════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════ */
carregarTema()
const _token = localStorage.getItem('token')
if(_token){ mostrarPainel() } else { window.location.href = '/auth.html' }