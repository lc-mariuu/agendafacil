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
var pixTipoAtual       = 'cpf'

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
  .pix-tipo-tab{padding:6px 13px;border-radius:20px;border:1px solid var(--border2);background:none;color:var(--text3);font-size:12px;font-weight:500;cursor:pointer;font-family:inherit;transition:all .15s}
  .pix-tipo-tab:hover{color:var(--text2)}
  .pix-tipo-tab.ativo{background:var(--accent-light);border-color:var(--accent-mid);color:#60a5fa;font-weight:600}
`
document.head.appendChild(srStyle)

/* ═══════════════════════════════════════════════════
   LINKS
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
═══════════════════════════════════════════════════ */
function conclusaoKey(id) { return `ag_concluido_em_${id}` }
function registrarConclusao(id) { if (!localStorage.getItem(conclusaoKey(id))) { localStorage.setItem(conclusaoKey(id), String(Date.now())) } }
function concluídoExpirado(id) { const HORA_EM_MS = 60*60*1000; const salvo = localStorage.getItem(conclusaoKey(id)); if (!salvo) return false; return (Date.now()-Number(salvo)) > HORA_EM_MS }
function filtrarExpirados(lista) { return lista.filter(a => { if (a.status !== 'concluido') return true; return !concluídoExpirado(a._id) }) }

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
  ags.filter(a => a.status === 'concluido' && a.data && a.data.startsWith(mes)).forEach(a => {
    if (!idsJaSalvos.has(a._id)) {
      const preco = Number(a.preco) || 0
      if (preco > 0) { setLucroMes(nid, (getLucroMes(nid) || 0) + preco); idsJaSalvos.add(a._id); setLucroIds(nid, [...idsJaSalvos]) }
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
function formatarMinutos(min) { if (!min || min <= 0) return '—'; const h = Math.floor(min/60); const m = min%60; if (h===0) return `${m} min`; if (m===0) return `${h}h`; return `${h}h${String(m).padStart(2,'0')}` }
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
    ['modal-agendamento','modal-negocio','modal-gerenciar-dias','cfg-modal-editar'].forEach(id => {
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
  if (pagina === 'pagamentos') renderPagamentos()
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
   PAINEL — CARREGAMENTO INICIAL
═══════════════════════════════════════════════════ */
async function mostrarPainel() {
  const token = localStorage.getItem('token')
  if (!token) { window.location.href = '/auth.html'; return }
  try {
    const res = await fetch(`${API}/auth/negocios`, { headers: { 'Authorization': `Bearer ${token}` } })
    if (res.status === 401) { localStorage.clear(); window.location.href = '/auth.html'; return }
    if (!res.ok) throw new Error(`Erro ${res.status}`)
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) { mostrarErroPainel('Nenhum painel encontrado. Entre em contato com o suporte.'); return }
    todosNegocios = data
    const savedId = localStorage.getItem('negocioId')
    negocioAtual  = todosNegocios.find(n => n._id === savedId) || todosNegocios[0]
    localStorage.setItem('negocioId', negocioAtual._id)
    localStorage.setItem('negocio',   negocioAtual.nome)
    renderDropdown()
    atualizarSidebarNegocio()
    const fd = document.getElementById('filtro-data')
    if (fd) fd.value = new Date().toISOString().split('T')[0]
    carregarDadosNegocio()
    verificarAcesso()
  } catch (err) {
    console.error('Erro ao carregar painel:', err.message)
    localStorage.clear()
    window.location.href = '/auth.html'
  }
}

function mostrarErroPainel(msg) {
  const el = document.getElementById('neg-nome-sidebar')
  if (el) el.textContent = 'Erro ao carregar'
  console.error('[Painel]', msg)
  const main = document.querySelector('.main')
  if (main && !document.getElementById('painel-erro-banner')) {
    const banner = document.createElement('div')
    banner.id = 'painel-erro-banner'
    banner.style.cssText = 'background:#fef2f2;border:1px solid rgba(220,38,38,0.2);color:#dc2626;padding:12px 18px;border-radius:10px;font-size:13px;font-weight:500;margin:16px 0;display:flex;align-items:center;gap:10px'
    banner.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="#dc2626" stroke-width="1.4"/><path d="M8 5v4M8 11v.5" stroke="#dc2626" stroke-width="1.5" stroke-linecap="round"/></svg> ${msg} <button onclick="window.location.reload()" style="margin-left:auto;background:#dc2626;color:#fff;border:none;padding:5px 12px;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">Recarregar</button>`
    main.prepend(banner)
  }
}

function carregarDadosNegocio() {
  carregarStatsSalvas()
  carregarAgendamentos()
  carregarServicos()
  carregarHorariosConfig()
  carregarBioConfig()
  carregarLembretes()
  carregarInsights()
  carregarPagamentosConfig()
}

/* ═══════════════════════════════════════════════════
   COPIAR LINKS
═══════════════════════════════════════════════════ */
function copiarLink() {
  if (!negocioAtual) return
  navigator.clipboard.writeText(urlAgendamento(negocioAtual)).then(() => flashBtn('btn-copiar-agendamento', '✓ Copiado!'))
}
function copiarLinkBio() {
  if (!negocioAtual) return
  navigator.clipboard.writeText(urlBio(negocioAtual)).then(() => flashBtn('btn-copiar-bio', '✓ Copiado!'))
}
function copiarLinkWpp() {
  if (!negocioAtual) return
  navigator.clipboard.writeText(urlAgendamento(negocioAtual)).then(() => { const btn = document.querySelector('[onclick="copiarLinkWpp()"]'); if (btn) flash(btn, '✓ Copiado!') })
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
  try {
    const res = await fetch(`${API}/agendamentos?negocioId=${nid}`, { headers: { 'Authorization': `Bearer ${token}` } })
    if (res.status === 401) { localStorage.clear(); window.location.href = '/auth.html'; return }
    if (!res.ok) throw new Error(`Erro ${res.status}`)
    let agsDaAPI = await res.json()
    const agora = new Date()
    const passados = agsDaAPI.filter(a => {
      if (a.status !== 'confirmado' || !a.data || !a.hora) return false
      const [ano, mes, dia] = a.data.split('-').map(Number)
      const [h, m] = a.hora.split(':').map(Number)
      return new Date(ano, mes-1, dia, h, m).getTime() < agora.getTime()
    })
    if (passados.length > 0) {
      await Promise.all(passados.map(a => fetch(`${API}/agendamentos/${a._id}`, { method:'PATCH', headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`}, body:JSON.stringify({status:'concluido'}) })))
      agsDaAPI = agsDaAPI.map(a => { const foi = passados.find(p => p._id === a._id); if (!foi) return a; const c = {...a, status:'concluido'}; registrarLucro(c); return c })
    }
    salvarConcluidosNoCache(nid, agsDaAPI)
    const listaMerged = mergeComCache(nid, agsDaAPI)
    const hoje = new Date().toISOString().split('T')[0]
    agsDaAPI.filter(a => a.status === 'concluido').forEach(a => {
      if (!localStorage.getItem(conclusaoKey(a._id))) {
        if (a.data < hoje) { localStorage.setItem(conclusaoKey(a._id), String(Date.now() - 2*60*60*1000)) }
        else { registrarConclusao(a._id) }
      }
    })
    const semana = new Date(Date.now() + 7*86400000).toISOString().split('T')[0]
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
    seedLucroDoMes(listaMerged)
    exibirLucro()
    todosAgendamentos = listaMerged
    atualizarInsights()
    todosAgendamentos = filtrarExpirados(listaMerged)
    renderHistorico()
    filtrarData()
    agAplicarFiltro()
    renderDashboardHoje()
    const dot = document.getElementById('notif-dot')
    if (dot) dot.style.display = finalHoje > 0 ? 'block' : 'none'
    const dotMobile = document.getElementById('notif-dot-mobile')
    if (dotMobile) dotMobile.style.display = finalHoje > 0 ? 'block' : 'none'
  } catch (err) {
    console.error('Erro ao carregar agendamentos:', err.message)
    const cache = getCacheConc(negocioAtual._id)
    if (cache.length) { todosAgendamentos = filtrarExpirados(cache); renderDashboardHoje(); agAplicarFiltro() }
  }
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
      registrarLucro(ag); registrarConclusao(id)
      if (nid) { const agConcluido = {...ag, status:'concluido'}; const cache = getCacheConc(nid); const cacheMap = {}; cache.forEach(a => cacheMap[a._id] = a); cacheMap[agConcluido._id] = agConcluido; setCacheConc(nid, Object.values(cacheMap)) }
    }
  }
  await fetch(`${API}/agendamentos/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`}, body:JSON.stringify({status}) })
  const listaCompleta = todosAgendamentos.map(a => a._id === id ? {...a, status} : a)
  if (nid) salvarConcluidosNoCache(nid, listaCompleta)
  const hoje   = new Date().toISOString().split('T')[0]
  const semana = new Date(Date.now() + 7*86400000).toISOString().split('T')[0]
  salvarStatsPersistentes(listaCompleta.filter(a => a.data === hoje).length, listaCompleta.filter(a => a.data >= hoje && a.data <= semana).length)
  todosAgendamentos = listaCompleta
  atualizarInsights(); exibirLucro()
  todosAgendamentos = filtrarExpirados(listaCompleta)
  renderHistorico(); filtrarData(); renderDashboardHoje(); agAplicarFiltro()
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
  renderServicos(); renderIntervalosServicos(); cfgRenderServicos()
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
  delete intervalosServicos[nome]; servicosAtuais.splice(i,1); renderServicos(); renderIntervalosServicos(); cfgRenderServicos()
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
    intervalosServicos[nome]=min; if(!select.querySelector(`[value="${min}"]`)){const opt=document.createElement('option');opt.value=String(min);opt.textContent=formatarMinutos(min);select.insertBefore(opt,select.querySelector('[value="custom"]'))};select.value=String(min)
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
  try {
    const res=await fetch(`${API}/assinatura/status`,{headers:{'Authorization':`Bearer ${token}`}}); if(!res.ok) return
    const data=await res.json()
    localStorage.setItem('plano',data.plano||'trial'); localStorage.setItem('assinaturaAtiva',data.assinaturaAtiva?'true':'false')
    if(!data.temAcesso){document.getElementById('bloqueio').style.display='flex';return}
    if(data.plano==='trial'&&data.diasRestantes<=7){const banner=document.createElement('div');banner.className='trial-banner';banner.innerHTML=`<p>⏰ Seu trial expira em <strong>${data.diasRestantes} dias</strong>. Assine para não perder o acesso.</p><button class="btn-assinar-banner" onclick="window.location.href='/planos.html'" type="button">Ver planos</button>`;const main=document.querySelector('.main');if(main)main.prepend(banner)}
  } catch(e) { console.warn('Erro ao verificar acesso:', e.message) }
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
═══════════════════════════════════════════════════ */
function atualizarInsights() {
  const ags = todosAgendamentos || []
  const nid = negocioAtual?._id
  if (!nid) return
  if (ags.length) {
    const freqHora = {}
    ags.forEach(a => { if (a.hora) freqHora[a.hora] = (freqHora[a.hora] || 0) + 1 })
    const topHora = Object.entries(freqHora).sort((a, b) => b[1] - a[1])[0]
    if (topHora) localStorage.setItem(`insight_melhorHorario_${nid}`, topHora[0])
  }
  const melhorHorario = localStorage.getItem(`insight_melhorHorario_${nid}`) || '—'
  const elH = document.getElementById('insight-melhor-horario')
  if (elH) elH.textContent = melhorHorario
  if (ags.length) {
    const freqServ = {}
    ags.forEach(a => { if (!a.servico) return; if (!freqServ[a.servico]) freqServ[a.servico] = { total: 0, qtd: 0 }; freqServ[a.servico].total += Number(a.preco) || 0; freqServ[a.servico].qtd += 1 })
    const topServ = Object.entries(freqServ).sort((a, b) => b[1].total - a[1].total)[0]
    if (topServ) { localStorage.setItem(`insight_topServico_${nid}`, topServ[0]); localStorage.setItem(`insight_topServicoBRL_${nid}`, topServ[1].total.toFixed(2)); localStorage.setItem(`insight_topServicoQtd_${nid}`, topServ[1].qtd) }
  }
  const topServicoNome = localStorage.getItem(`insight_topServico_${nid}`)
  const topServicoBRL  = parseFloat(localStorage.getItem(`insight_topServicoBRL_${nid}`)) || 0
  const topServicoQtd  = parseInt(localStorage.getItem(`insight_topServicoQtd_${nid}`)) || 0
  const elST = document.getElementById('insight-servico-top'); const elSR = document.getElementById('insight-servico-receita')
  if (elST && topServicoNome) { elST.textContent = topServicoNome; if (elSR) elSR.textContent = topServicoBRL > 0 ? `R$ ${topServicoBRL.toFixed(2).replace('.', ',')} gerados` : `${topServicoQtd} agendamento${topServicoQtd !== 1 ? 's' : ''}` }
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30); const cutStr = cutoff.toISOString().split('T')[0]
  if (ags.length) { const recentes = new Set(ags.filter(a => a.data >= cutStr).map(a => a.pacienteNome)); const todos = new Set(ags.map(a => a.pacienteNome)); const inativos = [...todos].filter(c => !recentes.has(c)).length; if (inativos > 0 || todos.size > 0) localStorage.setItem(`insight_inativos_${nid}`, inativos) }
  const inativosSalvo = parseInt(localStorage.getItem(`insight_inativos_${nid}`)) || 0
  const elI  = document.getElementById('insight-inativos'); const elIS = document.getElementById('insight-inativos-sub')
  if (elI) elI.textContent = inativosSalvo > 0 ? `${inativosSalvo} cliente${inativosSalvo > 1 ? 's' : ''}` : 'Nenhum'
  if (elIS) { elIS.textContent = inativosSalvo > 0 ? 'há mais de 30 dias' : 'todos ativos'; elIS.className = 'insight-item-sub' + (inativosSalvo > 0 ? ' warning' : '') }
  const banner = document.getElementById('alert-clientes-inativos')
  if (banner) banner.style.display = inativosSalvo >= 3 ? 'flex' : 'none'
  if (inativosSalvo >= 3) { const t = document.getElementById('alert-clientes-texto'); if (t) t.innerHTML = `<strong>${inativosSalvo} clientes estão inativos</strong>, mande uma promoção para reativá-los` }
  const hoje    = new Date().toISOString().split('T')[0]
  const semStart = new Date(); semStart.setDate(semStart.getDate() - 7)
  const lucroSemCalc = ags.filter(a => a.status === 'concluido' && a.data >= semStart.toISOString().split('T')[0] && a.data <= hoje).reduce((s, a) => s + (Number(a.preco) || 0), 0)
  setStatSalvo(nid, 'lucroSemana', lucroSemCalc)
  const lucroSem = getStatComFallback(nid, 'lucroSemana', lucroSemCalc)
  const elTotal  = document.getElementById('stat-total')
  if (elTotal) elTotal.textContent = fmtBRL(lucroSem)
  const lucroMes    = getLucroMes(nid) || 0
  const idsDoMes    = getLucroIds(nid)
  const atendMesCalc = idsDoMes.length
  setStatSalvo(nid, 'atendMes', atendMesCalc)
  const atendMes = Math.max(atendMesCalc, getStatSalvo(nid, 'atendMes') || 0)
  const fv  = document.getElementById('finance-amount-val'); const fm  = document.getElementById('finance-meta'); const fa  = document.getElementById('finance-atend'); const fcl = document.getElementById('finance-chart-label')
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
function abrirBusca(){const overlay=document.getElementById('busca-overlay');if(!overlay)return;overlay.classList.add('aberta');overlay.removeAttribute('aria-hidden');buscaAberta=true;document.body.classList.add('modal-open');const inp=document.getElementById('busca-input');if(inp){inp.value='';setTimeout(()=>{inp.focus();executarBusca('')},60)}}
function fecharBusca(){const overlay=document.getElementById('busca-overlay');if(overlay){overlay.classList.remove('aberta');overlay.setAttribute('aria-hidden','true')};buscaAberta=false;document.body.classList.remove('modal-open')}
function executarBusca(q){
  const res=document.getElementById('busca-resultados');if(!res)return; const ags=todosAgendamentos||[]
  if(!q||!q.trim()){const hoje=new Date().toISOString().split('T')[0];const deHoje=ags.filter(a=>a.data===hoje).slice(0,6);if(!deHoje.length){res.innerHTML='<div style="text-align:center;color:var(--text3);padding:28px;font-size:13px">Digite para buscar por nome, serviço ou data</div>';return};res.innerHTML='<div class="busca-secao-label">Agendamentos de hoje</div>'+deHoje.map(buscaItemHTML).join('');return}
  const termo=q.toLowerCase().trim(); const encontrados=ags.filter(a=>(a.pacienteNome||'').toLowerCase().includes(termo)||(a.servico||'').toLowerCase().includes(termo)||(a.data||'').includes(termo)||(a.hora||'').includes(termo)||(a.pacienteTelefone||'').includes(termo)).slice(0,12)
  if(!encontrados.length){res.innerHTML=`<div style="text-align:center;color:var(--text3);padding:28px;font-size:13px">Nenhum resultado para "<strong>${q}</strong>"</div>`;return}
  res.innerHTML=`<div class="busca-secao-label">${encontrados.length} resultado${encontrados.length>1?'s':''}</div>`+encontrados.map(buscaItemHTML).join('')
}
function buscaItemHTML(a){
  const [c1,c2]=avatarColor(a.pacienteNome);const ini=(a.pacienteNome||'C')[0].toUpperCase()
  const dataFmt=a.data?a.data.split('-').reverse().join('/'):''; const preco=a.preco?` · R$${Number(a.preco).toFixed(2).replace('.',',')}`:''
  const statusCor={confirmado:'#10b981',concluido:'#8b5cf6',cancelado:'#ef4444',pendente:'#f59e0b'}[a.status]||'#8b9ab4'
  return `<div class="busca-item" onclick="buscaSelecionarAgendamento('${a._id}','${a.data||''}')" role="option" tabindex="0"><div class="busca-avatar-mini" style="background:linear-gradient(135deg,${c1},${c2})">${ini}</div><div class="busca-item-info"><div class="busca-item-nome">${a.pacienteNome||'—'}</div><div class="busca-item-sub">${a.servico||''} · ${dataFmt} às ${a.hora||''}${preco}</div></div><span class="busca-item-badge" style="background:${statusCor}22;color:${statusCor};border:1px solid ${statusCor}44">${a.status}</span></div>`
}
function buscaSelecionarAgendamento(id,data){fecharBusca();irPara('agendamentos',document.getElementById('menu-agendamentos'));if(data){const inp=document.getElementById('ag-filtro-data');if(inp){inp.value=data;agFiltrarData(data)}}}
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();buscaAberta?fecharBusca():abrirBusca()}})

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
   PAGAMENTOS PIX
═══════════════════════════════════════════════════ */
var pixPlaceholders = { cpf:'000.000.000-00', cnpj:'00.000.000/0001-00', email:'seuemail@exemplo.com', telefone:'+55 (11) 99999-9999', aleatoria:'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' }
var pixLabels = { cpf:'Chave CPF', cnpj:'Chave CNPJ', email:'Chave E-mail', telefone:'Chave Telefone', aleatoria:'Chave Aleatória' }

function pixSelecionarTipo(tipo, btn) {
  pixTipoAtual = tipo
  document.querySelectorAll('.pix-tipo-tab').forEach(b => b.classList.remove('ativo'))
  if (btn) btn.classList.add('ativo')
  const input = document.getElementById('pix-chave-input')
  const label = document.getElementById('pix-key-label')
  if (input) { input.placeholder = pixPlaceholders[tipo]; input.value = '' }
  if (label)  label.textContent  = pixLabels[tipo]
}

function pixFormatarChave(input) {
  if (pixTipoAtual === 'cpf') {
    let v = input.value.replace(/\D/g,'').slice(0,11)
    v = v.replace(/^(\d{3})(\d)/,'$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d)/,'.$1-$2')
    input.value = v
  } else if (pixTipoAtual === 'cnpj') {
    let v = input.value.replace(/\D/g,'').slice(0,14)
    v = v.replace(/^(\d{2})(\d)/,'$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d)/,'.$1/$2').replace(/(\d{4})(\d)/,'$1-$2')
    input.value = v
  } else if (pixTipoAtual === 'telefone') {
    let v = input.value.replace(/\D/g,'').slice(0,13)
    if (v.length > 0) v = '+' + v
    input.value = v
  }
}

async function pixSalvarChave() {
  const input = document.getElementById('pix-chave-input')
  const btn   = document.getElementById('btn-salvar-pix-chave')
  if (!input) return
  const val = input.value.trim()
  if (!val) { alert('Digite a chave Pix.'); return }
  if (!negocioAtual) return
  const origHTML = btn ? btn.innerHTML : ''
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando...' }
  try {
    const token = localStorage.getItem('token')
    const res = await fetch(`${API}/pagamento/config`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ negocioId: negocioAtual._id, chavePix: val, tipoPix: pixTipoAtual })
    })
    if (!res.ok) throw new Error('Erro ao salvar chave')
    const prev    = document.getElementById('pix-chave-preview')
    const prevVal = document.getElementById('pix-chave-preview-val')
    if (prev)    prev.style.display = 'flex'
    if (prevVal) prevVal.textContent = val
    mostrarSalvo('pix-chave-salvo')
  } catch (e) {
    console.error('[pixSalvarChave]', e.message)
    alert('Erro ao salvar chave Pix. Tente novamente.')
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = origHTML }
  }
}

function renderPagamentos() {
  const container = document.getElementById('pag-servicos-lista')
  if (!container) return
  const servicos = servicosAtuais || []
  if (!servicos.length) {
    container.innerHTML = `<div style="text-align:center;padding:32px 20px;color:var(--text3);font-size:13px"><div style="font-size:14px;font-weight:700;color:var(--text2);margin-bottom:5px">Nenhum serviço cadastrado</div>Adicione serviços em <strong>Configurações</strong> para ativar a cobrança Pix.</div>`
    return
  }
  container.innerHTML = servicos.map((s, i) => {
    const nome  = typeof s === 'object' ? s.nome  : s
    const preco = typeof s === 'object' ? Number(s.preco || 0) : 0
    const cfg   = (pagamentosConfig || {})[nome] || { ativo: false, valor: preco }
    const isOn  = !!cfg.ativo
    const valor = cfg.valor != null ? cfg.valor : preco
    const pct   = preco > 0 ? Math.round((valor / preco) * 100) : 0
    return `<div id="pag-row-${i}" style="display:grid;grid-template-columns:1fr 130px 90px 60px;gap:8px;align-items:center;padding:11px 12px;border-radius:10px;border:1px solid ${isOn?'rgba(16,185,129,0.3)':'var(--border)'};background:${isOn?'rgba(16,185,129,0.04)':'var(--bg3,#1a2236)'};margin-bottom:8px;transition:border-color .2s,background .2s">
      <div><div style="font-size:13.5px;font-weight:600;color:var(--text)">${nome}</div><div style="font-size:12px;color:var(--text3);margin-top:2px">${preco>0?`R$ ${preco.toFixed(2).replace('.',',')}`:'Sem preço'}</div></div>
      <div style="display:flex;align-items:center;gap:5px">
        <span style="font-size:12px;font-weight:600;color:var(--text3)">R$</span>
        <input type="number" id="pag-input-${i}" value="${Number(valor).toFixed(2)}" min="0.01" step="0.01" ${!isOn?'disabled':''} oninput="pagAtualizarPct(${i},${preco})"
          style="width:72px;background:var(--bg4,#1e293b);border:1px solid var(--border2);border-radius:7px;color:var(--text);font-size:13px;font-family:inherit;padding:6px 7px;outline:none;text-align:right;transition:border-color .15s,opacity .15s;${!isOn?'opacity:.35;cursor:not-allowed':''}"
          onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border2)'" aria-label="Valor Pix para ${nome}">
      </div>
      <div id="pag-pct-${i}" style="font-size:12px;color:var(--text3)">${preco>0?`${pct}%`:'—'}</div>
      <div style="display:flex;justify-content:center">
        <div id="pag-toggle-${i}" onclick="pagToggle(${i})" role="switch" aria-checked="${isOn}" aria-label="Ativar Pix para ${nome}" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' ')pagToggle(${i})"
          style="width:40px;height:22px;border-radius:11px;background:${isOn?'var(--green)':'var(--bg4,#1e293b)'};border:1px solid ${isOn?'var(--green)':'var(--border2)'};position:relative;cursor:pointer;transition:background .2s,border-color .2s;flex-shrink:0" data-on="${isOn}">
          <div style="width:16px;height:16px;border-radius:50%;background:white;position:absolute;top:2px;left:${isOn?'19px':'3px'};transition:left .2s;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>
        </div>
      </div>
    </div>`
  }).join('')
  pagAtualizarResumo()
}

function pagToggle(idx) {
  const toggle = document.getElementById(`pag-toggle-${idx}`)
  const input  = document.getElementById(`pag-input-${idx}`)
  const row    = document.getElementById(`pag-row-${idx}`)
  if (!toggle) return
  const novoOn = toggle.dataset.on !== 'true'
  toggle.dataset.on = novoOn
  toggle.style.background  = novoOn ? 'var(--green)' : 'var(--bg4,#1e293b)'
  toggle.style.borderColor = novoOn ? 'var(--green)' : 'var(--border2)'
  toggle.setAttribute('aria-checked', novoOn)
  const thumb = toggle.querySelector('div')
  if (thumb) thumb.style.left = novoOn ? '19px' : '3px'
  if (input) { input.disabled = !novoOn; input.style.opacity = novoOn ? '1' : '0.35'; input.style.cursor = novoOn ? 'text' : 'not-allowed' }
  if (row) { row.style.borderColor = novoOn ? 'rgba(16,185,129,0.3)' : 'var(--border)'; row.style.background = novoOn ? 'rgba(16,185,129,0.04)' : 'var(--bg3,#1a2236)' }
  pagAtualizarResumo()
}

function pagAtualizarPct(idx, precoTotal) {
  const input = document.getElementById(`pag-input-${idx}`)
  const elPct = document.getElementById(`pag-pct-${idx}`)
  if (!input || !elPct || precoTotal <= 0) return
  elPct.textContent = `${Math.round((parseFloat(input.value)||0) / precoTotal * 100)}%`
}

function pagAtualizarResumo() {
  let count = 0
  ;(servicosAtuais || []).forEach((_, i) => { const t = document.getElementById(`pag-toggle-${i}`); if (t && t.dataset.on === 'true') count++ })
  const badge = document.getElementById('pag-badge-ativados')
  if (badge) badge.textContent = `${count} ativado${count !== 1 ? 's' : ''}`
  const resumo = document.getElementById('pag-resumo'); const resumoTxt = document.getElementById('pag-resumo-txt')
  if (resumo) { resumo.style.display = count > 0 ? 'flex' : 'none'; if (resumoTxt) resumoTxt.textContent = `Pix ativo em ${count} serviço${count !== 1 ? 's' : ''}` }
}

async function salvarPagamentos() {
  if (!negocioAtual) return
  const token    = localStorage.getItem('token')
  const servicos = servicosAtuais || []
  const btn      = document.getElementById('btn-salvar-pag')
  const origHTML = btn ? btn.innerHTML : ''
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando...' }
  const configServicos = {}
  servicos.forEach((s, i) => {
    const nome   = typeof s === 'object' ? s.nome : s
    const toggle = document.getElementById(`pag-toggle-${i}`)
    const input  = document.getElementById(`pag-input-${i}`)
    configServicos[nome] = { ativo: toggle ? toggle.dataset.on === 'true' : false, valor: input ? parseFloat(input.value) || 0 : 0 }
  })
  const inputChave = document.getElementById('pix-chave-input')
  const chavePix   = inputChave ? inputChave.value.trim() : ''
  try {
    const res = await fetch(`${API}/pagamento/config`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ negocioId: negocioAtual._id, chavePix, tipoPix: pixTipoAtual, servicos: configServicos })
    })
    if (!res.ok) throw new Error('Erro ao salvar')
    pagamentosConfig = configServicos
    mostrarSalvo('pag-salvo-msg')
  } catch (e) {
    console.error('[salvarPagamentos]', e.message)
    alert('Erro ao salvar configurações de pagamento.')
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = origHTML }
  }
}

async function carregarPagamentosConfig() {
  if (!negocioAtual) return
  try {
    const res = await fetch(`${API}/pagamento/config/${negocioAtual._id}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
    if (!res.ok) return
    const cfg = await res.json()
    pagamentosConfig = cfg.servicos || {}
    if (cfg.chavePix) {
      const input = document.getElementById('pix-chave-input')
      if (input) input.value = cfg.chavePix
      const prev    = document.getElementById('pix-chave-preview')
      const prevVal = document.getElementById('pix-chave-preview-val')
      if (prev)    prev.style.display = 'flex'
      if (prevVal) prevVal.textContent = cfg.chavePix
      if (cfg.tipoPix) { const tabBtn = document.querySelector(`.pix-tipo-tab[data-tipo="${cfg.tipoPix}"]`); if (tabBtn) pixSelecionarTipo(cfg.tipoPix, tabBtn) }
    }
  } catch (e) { console.error('[carregarPagamentosConfig]', e.message) }
}

/* ═══════════════════════════════════════════════════
   TABELA DE AGENDAMENTOS (nova)
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
  const statusLabel={confirmado:'confirmado',concluido:'concluído',cancelado:'cancelado',pendente:'pendente',agendado:'agendado'}
  if(!total){
    if(tbody)tbody.innerHTML='<div style="text-align:center;color:var(--text3);padding:52px 20px;font-size:13.5px">Nenhum agendamento encontrado</div>'
    if(mcards)mcards.innerHTML='<div style="text-align:center;color:var(--text3);padding:36px 18px;font-size:13px">Nenhum agendamento encontrado</div>'
    if(pag)pag.style.display='none'; return
  }
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
function agFiltrarData(val){agFiltroDataAtivo=val;if(val){document.querySelectorAll('.ag-tab').forEach(b=>{b.classList.remove('ativo');b.setAttribute('aria-selected','false')})};agAplicarFiltro()}
function agIrPagina(n){const total=Math.ceil(agListaFiltrada.length/agPorPagina);if(n<1||n>total)return;agPagina=n;agRenderTabela()}
function agMudarPorPagina(val){agPorPagina=parseInt(val);agPagina=1;agRenderTabela()}

/* ═══════════════════════════════════════════════════
   CONFIGURAÇÕES — lista de serviços avançada
═══════════════════════════════════════════════════ */
const CFG_PALETA=[{bg:'rgba(239,68,68,0.18)',bd:'rgba(239,68,68,0.35)',cor:'#f87171'},{bg:'rgba(249,115,22,0.18)',bd:'rgba(249,115,22,0.35)',cor:'#fb923c'},{bg:'rgba(234,179,8,0.18)',bd:'rgba(234,179,8,0.35)',cor:'#facc15'},{bg:'rgba(16,185,129,0.18)',bd:'rgba(16,185,129,0.35)',cor:'#34d399'},{bg:'rgba(59,130,246,0.18)',bd:'rgba(59,130,246,0.35)',cor:'#60a5fa'},{bg:'rgba(139,92,246,0.18)',bd:'rgba(139,92,246,0.35)',cor:'#a78bfa'},{bg:'rgba(236,72,153,0.18)',bd:'rgba(236,72,153,0.35)',cor:'#f472b6'},{bg:'rgba(6,182,212,0.18)',bd:'rgba(6,182,212,0.35)',cor:'#22d3ee'}]
function cfgPaletaFor(nome){let h=0;for(const c of(nome||'A'))h=((h<<5)-h)+c.charCodeAt(0);return CFG_PALETA[Math.abs(h)%CFG_PALETA.length]}
let cfgEditIdx=-1

function cfgRenderServicos(){
  const lista=servicosAtuais||[]; const cont=document.getElementById('cfg-servicos-lista'); const badge=document.getElementById('cfg-badge-num')
  if(badge)badge.textContent=lista.length
  if(!cont)return
  if(!lista.length){cont.innerHTML=`<div class="cfg-lista-vazia"><div>Nenhum serviço cadastrado ainda.</div><div style="font-size:12px;color:var(--text3);margin-top:4px">Use o formulário acima para adicionar.</div></div>`;return}
  cont.innerHTML=lista.map((s,i)=>{
    const nome=typeof s==='object'?s.nome:s; const preco=typeof s==='object'?Number(s.preco||0):0; const desc=typeof s==='object'?(s.desc||s.descricao||''):''; const dur=typeof s==='object'?(s.duracao||0):0
    const pal=cfgPaletaFor(nome); const ini=(nome||'?')[0].toUpperCase()
    const precoFmt=preco>0?`R$ ${preco.toFixed(2).replace('.',',')}`:`<span style="color:var(--text3)">—</span>`
    const durLabel=dur>0?`<span class="cfg-serv-dur">${dur} min</span>`:''
    const descLabel=desc?`<span class="cfg-serv-desc">${desc}</span>`:''
    return `<div class="cfg-serv-row" draggable="true" data-idx="${i}"><div class="cfg-drag-handle" title="Arrastar para reordenar"><svg width="12" height="14" viewBox="0 0 12 14" fill="none"><circle cx="4" cy="3" r="1.2" fill="currentColor"/><circle cx="8" cy="3" r="1.2" fill="currentColor"/><circle cx="4" cy="7" r="1.2" fill="currentColor"/><circle cx="8" cy="7" r="1.2" fill="currentColor"/><circle cx="4" cy="11" r="1.2" fill="currentColor"/><circle cx="8" cy="11" r="1.2" fill="currentColor"/></svg></div><div class="cfg-serv-avatar" style="background:${pal.bg};border-color:${pal.bd};color:${pal.cor}">${ini}</div><div class="cfg-serv-info"><div class="cfg-serv-nome">${nome}</div><div class="cfg-serv-meta">${descLabel}${durLabel}</div></div><div class="cfg-serv-preco">${precoFmt}</div><div class="cfg-serv-acoes"><button class="cfg-act-btn cfg-act-edit" onclick="cfgAbrirModalEditar(${i})" title="Editar" type="button"><svg width="13" height="13" viewBox="0 0 15 15" fill="none"><path d="M10.5 2.5l2 2-8 8H2.5v-2l8-8Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg></button><button class="cfg-act-btn cfg-act-del" onclick="cfgRemoverServico(${i})" title="Remover" type="button"><svg width="13" height="13" viewBox="0 0 15 15" fill="none"><path d="M2.5 4h10M5 4V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1M6 7v4M9 7v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.5 4l.5 8a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1l.5-8" stroke="currentColor" stroke-width="1.3"/></svg></button></div></div>`
  }).join('')
  cfgInitDragDrop()
}

function cfgAdicionarServico(){
  const nomeEl=document.getElementById('cfg-novo-servico'); const precoEl=document.getElementById('cfg-novo-preco'); const erroEl=document.getElementById('cfg-add-erro')
  const nome=(nomeEl?nomeEl.value:'').trim(); const preco=parseFloat(precoEl?precoEl.value:'')
  if(erroEl)erroEl.textContent=''; if(nomeEl)nomeEl.classList.remove('cfg-input-erro'); if(precoEl)precoEl.classList.remove('cfg-input-erro')
  if(!nome){if(erroEl)erroEl.textContent='⚠ Digite o nome do serviço.';if(nomeEl){nomeEl.classList.add('cfg-input-erro');nomeEl.focus()};return}
  if(!precoEl||!precoEl.value.trim()||isNaN(preco)||preco<=0){if(erroEl)erroEl.textContent='⚠ O preço é obrigatório e deve ser maior que R$ 0,00.';if(precoEl){precoEl.classList.add('cfg-input-erro');precoEl.focus()};return}
  if(servicosAtuais.some(s=>(typeof s==='object'?s.nome:s).toLowerCase()===nome.toLowerCase())){if(erroEl)erroEl.textContent='⚠ Já existe um serviço com esse nome.';if(nomeEl){nomeEl.classList.add('cfg-input-erro');nomeEl.focus()};return}
  servicosAtuais.push({nome,preco}); if(nomeEl)nomeEl.value=''; if(precoEl)precoEl.value=''; if(nomeEl)nomeEl.focus(); cfgRenderServicos(); renderIntervalosServicos()
}

function cfgRemoverServico(i){const nome=typeof servicosAtuais[i]==='object'?servicosAtuais[i].nome:servicosAtuais[i];if(intervalosServicos)delete intervalosServicos[nome];servicosAtuais.splice(i,1);cfgRenderServicos();renderIntervalosServicos()}

function cfgAbrirModalEditar(i){
  cfgEditIdx=i; const s=servicosAtuais[i]||{}
  const nomeEl=document.getElementById('cfg-edit-nome'); const precoEl=document.getElementById('cfg-edit-preco'); const descEl=document.getElementById('cfg-edit-desc'); const durEl=document.getElementById('cfg-edit-duracao')
  if(nomeEl)nomeEl.value=typeof s==='object'?s.nome:s; if(precoEl)precoEl.value=typeof s==='object'?(s.preco||''):''; if(descEl)descEl.value=typeof s==='object'?(s.desc||s.descricao||''):''; if(durEl)durEl.value=typeof s==='object'?(s.duracao||''):''
  const modal=document.getElementById('cfg-modal-editar'); if(modal){modal.style.display='flex';document.body.classList.add('modal-open')}
}
function cfgFecharModalEditar(){const modal=document.getElementById('cfg-modal-editar');if(modal){modal.style.display='none';document.body.classList.remove('modal-open')};cfgEditIdx=-1}
function cfgSalvarEdicao(){
  if(cfgEditIdx<0)return
  const nomeEl=document.getElementById('cfg-edit-nome'); const precoEl=document.getElementById('cfg-edit-preco'); const descEl=document.getElementById('cfg-edit-desc'); const durEl=document.getElementById('cfg-edit-duracao')
  const nome=nomeEl?nomeEl.value.trim():''; if(!nome){alert('Digite o nome do serviço.');return}
  servicosAtuais[cfgEditIdx]={nome,preco:parseFloat(precoEl?precoEl.value:'')||0,desc:descEl?descEl.value.trim():'',duracao:parseInt(durEl?durEl.value:'')||0}
  cfgRenderServicos(); renderIntervalosServicos(); cfgFecharModalEditar()
}

async function cfgSalvarServicos(){
  if(!negocioAtual)return; const token=localStorage.getItem('token')
  const btn=document.getElementById('cfg-btn-salvar-servicos'); if(btn){btn.disabled=true;btn.textContent='Salvando...'}
  try{
    const res=await fetch(`${API}/auth/servicos`,{method:'PATCH',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({negocioId:negocioAtual._id,servicos:servicosAtuais})})
    if(!res.ok){const err=await res.json();console.error('Erro ao salvar:',err);return}
    const msg=document.getElementById('cfg-salvo-msg'); if(msg){msg.style.display='inline';setTimeout(()=>msg.style.display='none',2500)}
  }catch(e){console.error('Erro na requisição:',e)}
  finally{if(btn){btn.disabled=false;btn.innerHTML='<svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L12 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> Salvar alterações'}}
}
window.salvarServicos = cfgSalvarServicos

function cfgInitDragDrop(){
  let dragSrc=null
  document.querySelectorAll('.cfg-serv-row').forEach(row=>{
    row.addEventListener('dragstart',e=>{dragSrc=row;row.classList.add('cfg-dragging')})
    row.addEventListener('dragend',()=>{document.querySelectorAll('.cfg-serv-row').forEach(r=>r.classList.remove('cfg-dragging','cfg-drag-over'));dragSrc=null})
    row.addEventListener('dragover',e=>{e.preventDefault();if(row!==dragSrc){document.querySelectorAll('.cfg-serv-row').forEach(r=>r.classList.remove('cfg-drag-over'));row.classList.add('cfg-drag-over')}})
    row.addEventListener('drop',e=>{e.preventDefault();if(!dragSrc||row===dragSrc)return;const src=parseInt(dragSrc.dataset.idx);const dest=parseInt(row.dataset.idx);const tmp=servicosAtuais.splice(src,1)[0];servicosAtuais.splice(dest,0,tmp);cfgRenderServicos()})
  })
}

/* ═══════════════════════════════════════════════════
   PERSISTÊNCIA DE STATS
═══════════════════════════════════════════════════ */
function statKey(nid, campo) { return `stat_${campo}_${nid}_${mesAtualChave()}` }
function getStatSalvo(nid, campo) { const v = localStorage.getItem(statKey(nid, campo)); return v !== null ? parseFloat(v) : null }
function setStatSalvo(nid, campo, valor) { const atual = getStatSalvo(nid, campo); if (atual === null || valor >= atual) { localStorage.setItem(statKey(nid, campo), String(valor)) } }
function getStatComFallback(nid, campo, valorCalculado) { const salvo = getStatSalvo(nid, campo) || 0; return Math.max(valorCalculado, salvo) }

/* ═══════════════════════════════════════════════════
   CACHE LOCAL DE AGENDAMENTOS
═══════════════════════════════════════════════════ */
function cacheKey(nid) { return `ags_concluidos_${nid}` }
function getCacheConc(nid) { try { return JSON.parse(localStorage.getItem(cacheKey(nid)) || '[]') } catch { return [] } }
function setCacheConc(nid, lista) {
  const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 2)
  const cutStr = cutoff.toISOString().split('T')[0]
  const filtrado = lista.filter(a => (a.data || '') >= cutStr)
  try { localStorage.setItem(cacheKey(nid), JSON.stringify(filtrado)) } catch {}
}
function mergeComCache(nid, agsDaAPI) { const cache = getCacheConc(nid); const idsAPI = new Set(agsDaAPI.map(a => a._id)); const apenasNoCache = cache.filter(a => !idsAPI.has(a._id)); return [...agsDaAPI, ...apenasNoCache] }
function salvarConcluidosNoCache(nid, ags) { const cache = getCacheConc(nid); const cacheMap = {}; cache.forEach(a => cacheMap[a._id] = a); ags.filter(a => a.status === 'concluido').forEach(a => cacheMap[a._id] = a); setCacheConc(nid, Object.values(cacheMap)) }

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
  const titulos = { '24h': 'Editar lembrete 24h antes', '1h': 'Editar lembrete 1h antes', 'pos': 'Editar mensagem pós-atendimento' }
  const campoBanco = { '24h': 'lembrete', '1h': 'lembrete1h', 'pos': 'posAtendimento' }
  const estadoTipos = { '24h': { ativo: true, mensagem: mensagensAuto['24h'] }, '1h': { ativo: true, mensagem: mensagensAuto['1h'] }, 'pos': { ativo: false, mensagem: mensagensAuto['pos'] } }

  function syncTextareaParaEstado() { const ta = document.getElementById('auto-mensagem-textarea'); if (ta) estadoTipos[tipoSelecionado].mensagem = ta.value }
  function syncToggleEditorParaEstado() { const toggleEditor = document.getElementById('toggle-editor-main'); if (toggleEditor) { estadoTipos[tipoSelecionado].ativo = toggleEditor.classList.contains('on') } }

  async function carregarAutomacaoDoServidor() {
    if (!window.negocioAtual) return
    try {
      const res  = await fetch(`${window.API}/auth/negocio/${window.negocioAtual._id}`)
      const data = await res.json()
      if (data.lembrete)       { estadoTipos['24h'].ativo = !!data.lembrete.ativo;       estadoTipos['24h'].mensagem = data.lembrete.mensagem       || mensagensAuto['24h'] }
      if (data.lembrete1h)     { estadoTipos['1h'].ativo  = !!data.lembrete1h.ativo;     estadoTipos['1h'].mensagem  = data.lembrete1h.mensagem     || mensagensAuto['1h']  }
      if (data.posAtendimento) { estadoTipos['pos'].ativo  = !!data.posAtendimento.ativo; estadoTipos['pos'].mensagem = data.posAtendimento.mensagem || mensagensAuto['pos'] }
      atualizarTodosToggleCards(); atualizarEditor(tipoSelecionado)
    } catch (e) { console.error('[Automação] Erro ao carregar do servidor:', e) }
  }

  function atualizarTodosToggleCards() {
    ;['24h', '1h', 'pos'].forEach(tipo => {
      const toggle = document.getElementById('toggle-' + tipo); if (!toggle) return
      const isOn = estadoTipos[tipo].ativo; toggle.className = 'auto-tipo-toggle ' + (isOn ? 'on' : 'off'); toggle.setAttribute('aria-checked', isOn)
      const card = toggle.closest('.auto-tipo-card'); if (!card) return
      const badge = card.querySelector('.auto-tipo-badge'); if (badge) { badge.textContent = isOn ? 'Ativo' : 'Inativo'; badge.className = 'auto-tipo-badge ' + (isOn ? 'ativo' : 'inativo') }
    })
  }

  function atualizarEditor(tipo) {
    const estado = estadoTipos[tipo]
    const headerTitle = document.querySelector('.auto-editor-header-title'); if (headerTitle) headerTitle.textContent = titulos[tipo] || 'Editar mensagem'
    const textarea = document.getElementById('auto-mensagem-textarea'); if (textarea) { textarea.value = estado.mensagem; atualizarPreviewAuto() }
    const toggleEditor = document.getElementById('toggle-editor-main'); if (toggleEditor) { toggleEditor.className = 'auto-tipo-toggle ' + (estado.ativo ? 'on' : 'off'); toggleEditor.setAttribute('aria-checked', estado.ativo) }
    const labelAtivo = document.querySelector('.auto-ativo-label'); if (labelAtivo) { labelAtivo.textContent = estado.ativo ? 'Ativo' : 'Inativo'; labelAtivo.style.color = estado.ativo ? '#34d399' : 'var(--text3)' }
  }

  window.selecionarTipoAuto = function (tipo, card) { syncTextareaParaEstado(); syncToggleEditorParaEstado(); tipoSelecionado = tipo; document.querySelectorAll('.auto-tipo-card').forEach(c => c.classList.remove('ativo-selected')); card.classList.add('ativo-selected'); atualizarEditor(tipo) }

  window.toggleAutoTipo = function (tipo, toggleEl) {
    const isOn = toggleEl.classList.contains('on'); const novoAtivo = !isOn; estadoTipos[tipo].ativo = novoAtivo
    if (tipo === tipoSelecionado) syncTextareaParaEstado()
    toggleEl.className = 'auto-tipo-toggle ' + (novoAtivo ? 'on' : 'off'); toggleEl.setAttribute('aria-checked', novoAtivo)
    const card = toggleEl.closest('.auto-tipo-card'); if (card) { const badge = card.querySelector('.auto-tipo-badge'); if (badge) { badge.textContent = novoAtivo ? 'Ativo' : 'Inativo'; badge.className = 'auto-tipo-badge ' + (novoAtivo ? 'ativo' : 'inativo') } }
    if (tipo === tipoSelecionado) { const toggleEditor = document.getElementById('toggle-editor-main'); if (toggleEditor) { toggleEditor.className = 'auto-tipo-toggle ' + (novoAtivo ? 'on' : 'off'); toggleEditor.setAttribute('aria-checked', novoAtivo) }; const labelAtivo = document.querySelector('.auto-ativo-label'); if (labelAtivo) { labelAtivo.textContent = novoAtivo ? 'Ativo' : 'Inativo'; labelAtivo.style.color = novoAtivo ? '#34d399' : 'var(--text3)' } }
    salvarTipo(tipo)
  }

  window.toggleEditorMain = function (toggleEl) {
    const novoAtivo = !toggleEl.classList.contains('on'); estadoTipos[tipoSelecionado].ativo = novoAtivo; syncTextareaParaEstado()
    toggleEl.className = 'auto-tipo-toggle ' + (novoAtivo ? 'on' : 'off'); toggleEl.setAttribute('aria-checked', novoAtivo)
    const labelAtivo = document.querySelector('.auto-ativo-label'); if (labelAtivo) { labelAtivo.textContent = novoAtivo ? 'Ativo' : 'Inativo'; labelAtivo.style.color = novoAtivo ? '#34d399' : 'var(--text3)' }
    const cardToggle = document.getElementById('toggle-' + tipoSelecionado); if (cardToggle) { cardToggle.className = 'auto-tipo-toggle ' + (novoAtivo ? 'on' : 'off'); cardToggle.setAttribute('aria-checked', novoAtivo); const card = cardToggle.closest('.auto-tipo-card'); if (card) { const badge = card.querySelector('.auto-tipo-badge'); if (badge) { badge.textContent = novoAtivo ? 'Ativo' : 'Inativo'; badge.className = 'auto-tipo-badge ' + (novoAtivo ? 'ativo' : 'inativo') } } }
    salvarTipo(tipoSelecionado)
  }

  window.inserirVarAuto = function (variavel) { const ta = document.getElementById('auto-mensagem-textarea'); if (!ta) return; const start = ta.selectionStart; const end = ta.selectionEnd; ta.value = ta.value.substring(0, start) + variavel + ta.value.substring(end); ta.selectionStart = ta.selectionEnd = start + variavel.length; ta.focus(); atualizarPreviewAuto() }

  window.atualizarPreviewAuto = function () {
    const ta = document.getElementById('auto-mensagem-textarea'); const bubble = document.getElementById('auto-preview-bubble'); if (!ta || !bubble) return
    const negNome = (window.negocioAtual?.nome) || 'sua empresa'
    const linkAgendamento = window.negocioAtual ? `https://agendorapido.com.br/agendar.html?id=${window.negocioAtual._id}` : 'agendorapido.com.br/agendar.html?id=...'
    let txt = ta.value.replace(/\{nome\}/g,'Carlos').replace(/\{data\}/g,'23/05').replace(/\{hora\}/g,'15:00').replace(/\{servico\}/g,'Barba').replace(/\{negocio\}/g,negNome).replace(/\{link\}/g,linkAgendamento)
    bubble.innerHTML = txt.split('\n').map(l => l || '<br>').join('<br>') + `<div class="auto-wpp-bubble-time">10:30<svg width="14" height="10" viewBox="0 0 16 11" fill="none"><path d="M1 5.5l3.5 3.5L9 2M7 5.5l3.5 3.5L15 2" stroke="#4fc3f7" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`
  }

  async function salvarTipo(tipo) {
    if (!window.negocioAtual) return; const token = localStorage.getItem('token'); const campo = campoBanco[tipo]; const estado = estadoTipos[tipo]
    try { await fetch(`${window.API}/auth/lembretes`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ negocioId: window.negocioAtual._id, campo, ativo: estado.ativo, mensagem: estado.mensagem }) }) } catch (e) { console.error('[Automação] Erro ao salvar tipo', tipo, e) }
  }

  window.salvarAutomacao = async function () {
    syncTextareaParaEstado(); syncToggleEditorParaEstado()
    const btn = document.querySelector('.auto-btn-salvar'); if (btn) { btn.disabled = true; btn.innerHTML = 'Salvando...' }
    await salvarTipo(tipoSelecionado)
    if (btn) { btn.disabled = false; btn.innerHTML = '✓ Salvo!'; setTimeout(() => { btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L12 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> Salvar alterações' }, 2000) }
  }

  window.enviarTesteAuto = function () { const btn = document.querySelector('.auto-btn-teste'); if (!btn) return; const orig = btn.innerHTML; btn.innerHTML = '✓ Teste enviado!'; btn.style.color = '#34d399'; setTimeout(() => { btn.innerHTML = orig; btn.style.color = '' }, 2500) }
  window.carregarAutomacaoDoServidor = carregarAutomacaoDoServidor
})()

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
  if(buscaOverlay){ buscaOverlay.addEventListener('click', function(e){ if(e.target === buscaOverlay) fecharBusca() }) }

  document.querySelectorAll('.page').forEach(p=>{if(!p.classList.contains('ativo'))p.setAttribute('aria-hidden','true')})

  const nEl=document.getElementById('cfg-novo-servico'); const pEl=document.getElementById('cfg-novo-preco')
  if(nEl)nEl.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();cfgAdicionarServico()}})
  if(pEl)pEl.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();cfgAdicionarServico()}})

  setInterval(() => { fetch(`${API}/health`).catch(() => {}) }, 10 * 60 * 1000)
})

/* ═══════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════ */
carregarTema()

const _token = localStorage.getItem('token')
if (!_token) {
  window.location.href = '/auth.html'
} else {
  mostrarPainel()
}

;(function () {
 
  var dashChart = {
    canvas:  null,
    tooltip: null,
    data:    [],
    labels:  [],
    values:  [],   // acumulado diário
    maxY:    0,
    rafId:   null,
  }
 
  /* Gera dados acumulados a partir dos agendamentos reais */
  function buildChartData () {
    var ags = todosAgendamentos || []
    var mes = new Date().toISOString().slice(0, 7) // "2025-04"
    var hoje = new Date()
    var diaHoje = hoje.getDate()
    var nomeMes = hoje.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })
 
    // Soma por dia
    var porDia = {}
    ags.forEach(function (a) {
      if (!a.data || !a.data.startsWith(mes)) return
      if (a.status !== 'concluido') return
      var dia = parseInt(a.data.split('-')[2], 10)
      porDia[dia] = (porDia[dia] || 0) + (Number(a.preco) || 0)
    })
 
    // Monta série do dia 1 até hoje
    var labels = [], dailyVals = [], acum = [], total = 0
    for (var d = 1; d <= diaHoje; d++) {
      total += (porDia[d] || 0)
      labels.push(d === 1 ? '1 Abr' : d === diaHoje ? 'hoje' : (d % 5 === 0 ? d + ' Abr' : ''))
      dailyVals.push(porDia[d] || 0)
      acum.push(total)
    }
 
    // Se não houver dados reais, usa curva demo para não ficar vazio
    if (total === 0) {
      var demo = [820,1050,980,1200,1100,1350,1480,1300,1600,1750,
                  1650,1900,2100,2050,2300,2500,2450,2700,2900,3100,
                  3300,3550,3800]
      var days = Math.min(diaHoje, demo.length)
      labels = []; acum = []; total = 0
      for (var i = 0; i < days; i++) {
        total += demo[i]
        labels.push(i === 0 ? '1 Abr' : i === days - 1 ? 'hoje' : ((i + 1) % 5 === 0 ? (i + 1) + ' Abr' : ''))
        acum.push(total)
      }
    }
 
    dashChart.labels = labels
    dashChart.values = acum
    dashChart.data   = dailyVals
    dashChart.maxY   = Math.max.apply(null, acum) || 1
    return total
  }
 
  function fmtBRLShort (v) {
    if (v >= 1000) return 'R$' + (v / 1000).toFixed(1).replace('.0', '') + 'k'
    return 'R$' + Math.round(v)
  }
 
  /* Actualiza eixo Y com valores reais */
  function updateYLabels () {
    var el = document.getElementById('dash-y-labels')
    if (!el) return
    var max = dashChart.maxY
    var steps = [0, 0.2, 0.4, 0.6, 0.8, 1].reverse()
    el.innerHTML = steps.map(function (s) {
      return '<span>' + fmtBRLShort(max * s) + '</span>'
    }).join('')
  }
 
  /* Actualiza X labels — mostra apenas alguns rótulos */
  function updateXLabels () {
    var el = document.getElementById('dash-x-labels')
    if (!el) return
    var n = dashChart.labels.length
    var show = []
    dashChart.labels.forEach(function (l, i) {
      if (i === 0 || i === n - 1 || l !== '') show.push(l)
      else if (i === Math.floor(n / 4) || i === Math.floor(n / 2) || i === Math.floor(3 * n / 4)) {
        show.push((i + 1) + ' Abr')
      } else show.push('')
    })
    // Mostra apenas 6 slots
    var slots = 6
    var step  = Math.max(1, Math.floor(n / (slots - 1)))
    var html  = ''
    for (var s = 0; s < slots; s++) {
      var idx = Math.min(s * step, n - 1)
      if (s === slots - 1) idx = n - 1
      html += '<span>' + ((idx + 1) + (s === slots - 1 ? ' Abr' : ' Abr')) + '</span>'
    }
    // Simplificado: rótulos fixos baseados no mês
    var hoje = new Date().getDate()
    var labels6 = ['1 Abr', '5 Abr', '10 Abr', '15 Abr', '20 Abr', hoje + ' Abr']
    el.innerHTML = labels6.map(function (l) { return '<span>' + l + '</span>' }).join('')
  }
 
  /* Desenha o canvas */
  function drawChart () {
    var canvas = dashChart.canvas
    if (!canvas) return
    var wrap = canvas.parentElement
    if (!wrap) return
 
    var dpr = window.devicePixelRatio || 1
    var W   = wrap.clientWidth
    var H   = wrap.clientHeight || 180
 
    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
      canvas.width  = W * dpr
      canvas.height = H * dpr
      canvas.style.width  = W + 'px'
      canvas.style.height = H + 'px'
    }
 
    var ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
 
    var CW = canvas.width
    var CH = canvas.height
    var padL = 0, padR = 8 * dpr, padT = 10 * dpr, padB = 4 * dpr
    var chartW = CW - padL - padR
    var chartH = CH - padT - padB
 
    var vals = dashChart.values
    if (!vals || vals.length < 2) return
 
    var maxV = dashChart.maxY || 1
 
    var pts = vals.map(function (v, i) {
      return {
        x: padL + (i / (vals.length - 1)) * chartW,
        y: padT + (1 - v / maxV) * chartH
      }
    })
 
    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'
    ctx.lineWidth   = 1
    for (var gi = 0; gi <= 5; gi++) {
      var gy = padT + (gi / 5) * chartH
      ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(CW - padR, gy); ctx.stroke()
    }
 
    // Gradient fill
    var grad = ctx.createLinearGradient(0, padT, 0, CH)
    grad.addColorStop(0, 'rgba(59,130,246,0.38)')
    grad.addColorStop(1, 'rgba(59,130,246,0.01)')
 
    ctx.beginPath()
    ctx.moveTo(pts[0].x, CH - padB)
    pts.forEach(function (p, i) {
      if (i === 0) { ctx.lineTo(p.x, p.y); return }
      var prev = pts[i - 1]
      var cpx  = (prev.x + p.x) / 2
      ctx.bezierCurveTo(cpx, prev.y, cpx, p.y, p.x, p.y)
    })
    ctx.lineTo(pts[pts.length - 1].x, CH - padB)
    ctx.closePath()
    ctx.fillStyle = grad
    ctx.fill()
 
    // Linha principal
    ctx.beginPath()
    pts.forEach(function (p, i) {
      if (i === 0) { ctx.moveTo(p.x, p.y); return }
      var prev = pts[i - 1]
      var cpx  = (prev.x + p.x) / 2
      ctx.bezierCurveTo(cpx, prev.y, cpx, p.y, p.x, p.y)
    })
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth   = 2 * dpr
    ctx.lineJoin    = 'round'
    ctx.stroke()
 
    // Ponto final
    var last = pts[pts.length - 1]
    ctx.beginPath(); ctx.arc(last.x, last.y, 5 * dpr, 0, Math.PI * 2)
    ctx.fillStyle = '#3b82f6'; ctx.fill()
    ctx.beginPath(); ctx.arc(last.x, last.y, 3 * dpr, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'; ctx.fill()
 
    // Tooltip fixo no último ponto
    showTooltipAt(pts.length - 1, last.x / dpr, last.y / dpr, true)
  }
 
  function showTooltipAt (idx, px, py, fixed) {
    var tooltip = dashChart.tooltip
    if (!tooltip) return
    var vals = dashChart.values
    var labs = dashChart.labels
    var v    = vals[Math.max(0, Math.min(idx, vals.length - 1))]
    var l    = labs[Math.max(0, Math.min(idx, labs.length - 1))] || ((idx + 1) + ' Abr')
 
    document.getElementById('dashTtVal').textContent  = 'R$' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    document.getElementById('dashTtDate').textContent = l || 'hoje'
 
    tooltip.style.display = 'block'
    tooltip.style.left    = Math.max(0, px - 55) + 'px'
    tooltip.style.top     = Math.max(0, py - 72) + 'px'
  }
 
  function hideTooltipFixed () {
    var vals = dashChart.values
    var idx  = vals.length - 1
    var canvas = dashChart.canvas
    if (!canvas) return
    var dpr  = window.devicePixelRatio || 1
    var maxV = dashChart.maxY || 1
    var CW   = canvas.width, CH = canvas.height
    var padL = 0, padR = 8 * dpr, padT = 10 * dpr, padB = 4 * dpr
    var chartW = CW - padL - padR
    var chartH = CH - padT - padB
    var v = vals[idx]
    var px = (padL + chartW) / dpr
    var py = (padT + (1 - v / maxV) * chartH) / dpr
    showTooltipAt(idx, px, py, true)
    drawChart()
  }
 
  function onMouseMove (e) {
    var canvas = dashChart.canvas
    if (!canvas) return
    var dpr  = window.devicePixelRatio || 1
    var rect = canvas.getBoundingClientRect()
    var mx   = (e.clientX - rect.left) * dpr
    var CW   = canvas.width
    var padL = 0, padR = 8 * dpr
    var chartW = CW - padL - padR
    var vals = dashChart.values
    if (!vals.length) return
 
    var idx = Math.round((mx / chartW) * (vals.length - 1))
    idx = Math.max(0, Math.min(idx, vals.length - 1))
 
    var maxV = dashChart.maxY || 1
    var CH   = canvas.height
    var padT = 10 * dpr, padB = 4 * dpr
    var chartH = CH - padT - padB
    var px = (padL + (idx / (vals.length - 1)) * chartW) / dpr
    var py = (padT + (1 - vals[idx] / maxV) * chartH) / dpr
 
    // Redesenha com crosshair
    drawChart()
    var ctx = canvas.getContext('2d')
    ctx.setLineDash([4, 3])
    ctx.strokeStyle = 'rgba(59,130,246,0.35)'
    ctx.lineWidth   = 1
    ctx.beginPath()
    ctx.moveTo(px * dpr, padT)
    ctx.lineTo(px * dpr, CH - padB)
    ctx.stroke()
    ctx.setLineDash([])
 
    showTooltipAt(idx, px, py)
  }
 
  /* Inicializa o gráfico quando o dashboard ficar visível */
  function initDashChart () {
    var canvas  = document.getElementById('dashChartCanvas')
    var tooltip = document.getElementById('dashChartTooltip')
    if (!canvas || !tooltip) return
 
    dashChart.canvas  = canvas
    dashChart.tooltip = tooltip
 
    var total = buildChartData()
    updateYLabels()
    updateXLabels()
    drawChart()
 
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mouseleave', hideTooltipFixed)
    window.addEventListener('resize', function () {
      buildChartData()
      updateYLabels()
      drawChart()
    })
  }
 
  /* Exporta para uso global */
  window.dashChartInit   = initDashChart
  window.dashChartRefresh = function () {
    buildChartData()
    updateYLabels()
    drawChart()
  }
 
})()
 
 
/* ─────────────────────────────────────────────
   RENDER — PRÓXIMOS AGENDAMENTOS (coluna esq)
───────────────────────────────────────────── */
function dashRenderProximos () {
  var container = document.getElementById('dash-proximos-lista')
  if (!container) return
 
  var ags  = todosAgendamentos || []
  var hoje = new Date().toISOString().split('T')[0]
 
  // Agendamentos de hoje + futuros confirmados, ordenados por hora
  var lista = ags
    .filter(function (a) {
      return a.data >= hoje && a.status === 'confirmado'
    })
    .sort(function (a, b) {
      return ((a.data || '') + (a.hora || '')).localeCompare((b.data || '') + (b.hora || ''))
    })
    .slice(0, 5)
 
  if (!lista.length) {
    container.innerHTML = '<div style="text-align:center;color:var(--text3);padding:28px 16px;font-size:12.5px">Nenhum agendamento futuro</div>'
    return
  }
 
  var barColors = ['#3b82f6','#10b981','#8b5cf6','#f59e0b','#ec4899']
 
  container.innerHTML = lista.map(function (a, i) {
    var colors  = avatarColor(a.pacienteNome)
    var ini     = (a.pacienteNome || 'C')[0].toUpperCase()
    var isHoje  = a.data === hoje
    var diaLabel = isHoje ? 'Hoje' : formatarData(a.data)
    var barColor = barColors[i % barColors.length]
    var status   = a.status === 'confirmado' ? 'conf' : 'pend'
    var statusTxt = a.status === 'confirmado' ? 'Confirmado' : 'Pendente'
 
    return [
      '<div class="dash-ag-item">',
        '<div class="dash-ag-time">',
          '<div class="dash-ag-hour">', (a.hora || '--'), '</div>',
          '<div class="dash-ag-day">',  diaLabel,         '</div>',
        '</div>',
        '<div class="dash-ag-bar" style="background:', barColor, '"></div>',
        '<div class="dash-ag-avatar" style="background:linear-gradient(135deg,', colors[0], ',', colors[1], ')">', ini, '</div>',
        '<div class="dash-ag-info">',
          '<div class="dash-ag-nome">', (a.pacienteNome || '—'), '</div>',
          '<div class="dash-ag-serv">', (a.servico      || '—'), '</div>',
        '</div>',
        '<div class="dash-ag-badge ', status, '">', statusTxt, '</div>',
      '</div>'
    ].join('')
  }).join('')
}
 
 
/* ─────────────────────────────────────────────
   RENDER — TRANSAÇÕES RECENTES (coluna dir)
───────────────────────────────────────────── */
function dashRenderTransacoes () {
  var container = document.getElementById('dash-trans-lista')
  if (!container) return
 
  var ags = todosAgendamentos || []
  // Usa concluídos como "pagamentos recebidos"
  var concluidos = ags
    .filter(function (a) { return a.status === 'concluido' && Number(a.preco) > 0 })
    .sort(function (a, b) {
      return ((b.data || '') + (b.hora || '')).localeCompare((a.data || '') + (a.hora || ''))
    })
    .slice(0, 5)
 
  if (!concluidos.length) {
    container.innerHTML = '<div style="text-align:center;color:var(--text3);padding:24px 16px;font-size:12px">Sem transações recentes</div>'
    return
  }
 
  container.innerHTML = concluidos.map(function (a) {
    var preco = Number(a.preco) || 0
    var dataFmt = a.data ? a.data.split('-').slice(1).reverse().join(' Abr, ').replace(',', ',') : ''
    // Formata como "23 Abr, 14:30"
    var mesNomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
    var dataObj  = a.data ? a.data.split('-') : []
    var mesLabel = dataObj.length === 3 ? mesNomes[parseInt(dataObj[1], 10) - 1] : ''
    var diaLabel = dataObj.length === 3 ? parseInt(dataObj[2], 10) + ' ' + mesLabel : ''
    var horaLabel = a.hora ? ', ' + a.hora : ''
 
    return [
      '<div class="dash-trans-item">',
        '<div class="dash-trans-icon" style="background:rgba(16,185,129,0.15)">',
          '<svg width="16" height="16" viewBox="0 0 16 16" fill="none">',
            '<path d="M3 8l4 4 6-7" stroke="#34d399" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
          '</svg>',
        '</div>',
        '<div class="dash-trans-info">',
          '<div class="dash-trans-nome">Pagamento recebido</div>',
          '<div class="dash-trans-meta">PIX • ', diaLabel, horaLabel, '</div>',
        '</div>',
        '<div class="dash-trans-val pos">+R$', preco.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), '</div>',
      '</div>'
    ].join('')
  }).join('')
}
 
 
/* ─────────────────────────────────────────────
   RENDER — STATS DO HEADER
───────────────────────────────────────────── */
function dashRenderStats () {
  var ags  = todosAgendamentos || []
  var nid  = negocioAtual ? negocioAtual._id : null
  var hoje = new Date().toISOString().split('T')[0]
  var mes  = hoje.slice(0, 7)

  /* Faturamento hoje */
  var fatHoje = ags
    .filter(function (a) { return a.data === hoje && a.status === 'concluido' })
    .reduce(function (s, a) { return s + (Number(a.preco) || 0) }, 0)
  if (nid && fatHoje > 0) localStorage.setItem('dash_fatHoje_' + nid + '_' + hoje, fatHoje)
  var fatHojeFinal = fatHoje || parseFloat(localStorage.getItem('dash_fatHoje_' + nid + '_' + hoje) || '0')

  var elFat = document.getElementById('dash-fat-hoje')
  if (elFat) elFat.textContent = 'R$' + fatHojeFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  /* Agendamentos hoje */
  var agHoje = ags.filter(function (a) { return a.data === hoje }).length
  if (nid && agHoje > 0) localStorage.setItem('dash_agHoje_' + nid + '_' + hoje, agHoje)
  var agHojeFinal = agHoje || parseInt(localStorage.getItem('dash_agHoje_' + nid + '_' + hoje) || '0')

  var elAg = document.getElementById('dash-ag-hoje')
  if (elAg) elAg.textContent = agHojeFinal

  /* Esta semana */
  var semStart = new Date(); semStart.setDate(semStart.getDate() - semStart.getDay())
  var semEnd   = new Date(semStart); semEnd.setDate(semEnd.getDate() + 6)
  var semStartStr = semStart.toISOString().split('T')[0]
  var semEndStr   = semEnd.toISOString().split('T')[0]
  var agSemana = ags.filter(function (a) { return a.data >= semStartStr && a.data <= semEndStr }).length
  if (nid && agSemana > 0) localStorage.setItem('dash_agSemana_' + nid + '_' + semStartStr, agSemana)
  var agSemanaFinal = agSemana || parseInt(localStorage.getItem('dash_agSemana_' + nid + '_' + semStartStr) || '0')

  var elSem = document.getElementById('dash-ag-semana-label')
  if (elSem) elSem.textContent = agSemanaFinal + ' esta semana'

  /* Clientes únicos */
  var clientes = new Set(ags.map(function (a) { return a.pacienteNome }).filter(Boolean))
  if (nid && clientes.size > 0) localStorage.setItem('dash_clientes_' + nid, clientes.size)
  var clientesFinal = clientes.size || parseInt(localStorage.getItem('dash_clientes_' + nid) || '0')

  var elCli = document.getElementById('dash-clientes')
  if (elCli) elCli.textContent = clientesFinal

  /* Ticket médio do mês */
  var doMes  = ags.filter(function (a) { return a.data && a.data.startsWith(mes) && a.status === 'concluido' })
  var fatMes = doMes.reduce(function (s, a) { return s + (Number(a.preco) || 0) }, 0)
  if (nid && fatMes > 0) localStorage.setItem('dash_fatMes_' + nid + '_' + mes, fatMes)
  var fatMesFinal = fatMes || parseFloat(localStorage.getItem('dash_fatMes_' + nid + '_' + mes) || '0')

  var ticket = doMes.length > 0 ? fatMes / doMes.length : 0
  if (nid && ticket > 0) localStorage.setItem('dash_ticket_' + nid + '_' + mes, ticket)
  var ticketFinal = ticket || parseFloat(localStorage.getItem('dash_ticket_' + nid + '_' + mes) || '0')

  var elTck = document.getElementById('dash-ticket')
  if (elTck) elTck.textContent = 'R$' + ticketFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  /* Saldo */
  var elSaldo = document.getElementById('dash-saldo-val')
  if (elSaldo) elSaldo.textContent = 'R$ ' + fatMesFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  /* Gráfico total */
  var elChartTotal = document.getElementById('dash-chart-total')
  if (elChartTotal) elChartTotal.textContent = 'R$ ' + fatMesFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
 
 
/* ─────────────────────────────────────────────
   RENDER — INSIGHTS (coluna dir)
───────────────────────────────────────────── */
function dashRenderInsights () {
  var ags = todosAgendamentos || []
 
  /* Melhor dia da semana */
  var diasNomesAbrev = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  var diasNomesCompletos = ['Domingo','Segunda','Terça','Quarta','Quintas','Sexta','Sábado']
  var porDiaSemana = {}
  ags.forEach(function (a) {
    if (!a.data || a.status !== 'concluido') return
    var d = new Date(a.data + 'T12:00:00')
    var dw = d.getDay()
    if (!porDiaSemana[dw]) porDiaSemana[dw] = { total: 0, qtd: 0 }
    porDiaSemana[dw].total += Number(a.preco) || 0
    porDiaSemana[dw].qtd  += 1
  })
  var melhorDw = null, melhorTotal = 0
  Object.keys(porDiaSemana).forEach(function (dw) {
    if (porDiaSemana[dw].total > melhorTotal) {
      melhorTotal = porDiaSemana[dw].total
      melhorDw    = parseInt(dw, 10)
    }
  })
  var elMDia = document.getElementById('dash-melhor-dia')
  var elMDiaVal = document.getElementById('dash-melhor-dia-val')
  if (elMDia) elMDia.textContent = melhorDw !== null ? diasNomesCompletos[melhorDw] : '—'
  if (elMDiaVal) elMDiaVal.textContent = melhorTotal > 0 ? 'R$' + melhorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
 
  /* Horário mais reservado */
  var porHora = {}
  ags.forEach(function (a) {
    if (!a.hora) return
    var h = a.hora.slice(0, 2) // "14"
    porHora[h] = (porHora[h] || 0) + 1
  })
  var topHora = null, topQtd = 0, totalAgs = ags.length
  Object.keys(porHora).forEach(function (h) {
    if (porHora[h] > topQtd) { topQtd = porHora[h]; topHora = h }
  })
  var elHora    = document.getElementById('dash-melhor-hora')
  var elHoraPct = document.getElementById('dash-melhor-hora-pct')
  if (elHora) elHora.textContent = topHora ? topHora + ':00 - ' + (parseInt(topHora, 10) + 2) + ':00' : '—'
  if (elHoraPct) {
    var pct = totalAgs > 0 ? Math.round((topQtd / totalAgs) * 100) : 0
    elHoraPct.textContent = pct + '% dos agendamentos'
  }
 
  /* Taxa de presença (concluídos / total) */
  var concl = ags.filter(function (a) { return a.status === 'concluido' }).length
  var taxa  = ags.length > 0 ? Math.round((concl / ags.length) * 100) : 0
  var elTaxa    = document.getElementById('dash-taxa-presenca')
  var elTaxaSub = document.getElementById('dash-taxa-sub')
  if (elTaxa) elTaxa.textContent = taxa + '%'
  if (elTaxaSub) elTaxaSub.textContent = taxa >= 80 ? '+' + taxa + '% de presença' : taxa + '% de presença'
}
 
 
/* ─────────────────────────────────────────────
   DATA LABEL NO HEADER
───────────────────────────────────────────── */
function dashAtualizarData () {
  var el = document.getElementById('dash-date-label')
  if (!el) return
  var hoje   = new Date()
  var meses  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                 'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  el.textContent = 'Hoje, ' + hoje.getDate() + ' de ' + meses[hoje.getMonth()]
}
 
/* Nome do negócio no greeting */
function dashAtualizarNome () {
  var el = document.getElementById('dash-user-nome')
  if (!el) return
  var nome = (negocioAtual && negocioAtual.nome) ? negocioAtual.nome.split(' ')[0] : 'você'
  el.textContent = nome
}
 
 
/* ─────────────────────────────────────────────
   FUNÇÃO PRINCIPAL — chama todos os renders
───────────────────────────────────────────── */
function dashRenderTudo () {
  dashAtualizarData()
  dashAtualizarNome()
  dashRenderStats()
  dashRenderProximos()
  dashRenderTransacoes()
  dashRenderInsights()
 
  // Gráfico: inicializa na primeira vez, atualiza nas seguintes
  if (!document.getElementById('dashChartCanvas')._dashInited) {
    document.getElementById('dashChartCanvas')._dashInited = true
    if (typeof dashChartInit === 'function') dashChartInit()
  } else {
    if (typeof dashChartRefresh === 'function') dashChartRefresh()
  }
}
 
 
/* ─────────────────────────────────────────────
   HOOK — substitui renderDashboardHoje original
   chamado automaticamente após carregarAgendamentos()
───────────────────────────────────────────── */
;(function () {
  // Guarda referência da função original se existir
  var _originalRenderDashboardHoje = window.renderDashboardHoje
 
  window.renderDashboardHoje = function () {
    // Chama o render novo do dashboard V2
    dashRenderTudo()
    // Mantém compatibilidade: chama o original se existir e se os elementos legados existirem
    if (typeof _originalRenderDashboardHoje === 'function') {
      var legacyEl = document.getElementById('tbody-rows-dash')
      if (legacyEl) _originalRenderDashboardHoje()
    }
  }
 
  // Também conecta ao irPara para re-renderizar ao navegar para o dashboard
  var _originalIrPara = window.irPara
  window.irPara = function (pagina, btn) {
    _originalIrPara(pagina, btn)
    if (pagina === 'dashboard') {
      // Pequeno delay para garantir que a section já está visível antes de desenhar o canvas
      setTimeout(dashRenderTudo, 80)
    }
  }
})()
 
 
/* ─────────────────────────────────────────────
   INIT IMEDIATO (quando o script carrega)
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function () {
  dashAtualizarData()
  dashAtualizarNome()
 
  // Se o canvas já existe (dashboard é a página inicial), inicializa o gráfico
  // com um pequeno delay para garantir que o layout já foi calculado
  setTimeout(function () {
    var canvas = document.getElementById('dashChartCanvas')
    if (canvas && !canvas._dashInited) {
      canvas._dashInited = true
      if (typeof dashChartInit === 'function') dashChartInit()
    }
  }, 150)
})

/* ── Chaves localStorage ── */
function saldoKey(nid)  { return 'saldo_disponivel_' + nid }
function saquesKey(nid) { return 'saques_ids_' + nid }
 
/* ── Lê saldo salvo ── */
function getSaldoSalvo(nid) {
  var v = localStorage.getItem(saldoKey(nid))
  return v !== null ? parseFloat(v) : 0
}
 
/* ── Grava saldo (nunca negativo) ── */
function setSaldoSalvo(nid, valor) {
  var v = Math.max(0, valor)
  localStorage.setItem(saldoKey(nid), String(v))
  return v
}
 
/* ── Saques realizados ── */
function getSaquesRealizados(nid) {
  try { return JSON.parse(localStorage.getItem(saquesKey(nid)) || '[]') }
  catch(e) { return [] }
}
function registrarSaqueLocal(nid, valor) {
  var lista = getSaquesRealizados(nid)
  lista.push({ valor: valor, data: new Date().toISOString() })
  localStorage.setItem(saquesKey(nid), JSON.stringify(lista))
}
 
/* ── Calcula saldo real ──
   Só conta agendamentos com pagamento.status === 'pago'
   Desconta saques já realizados                          */
function calcularSaldoReal(ags, nid) {
  if (!ags || !ags.length) return 0
 
  var totalPago = ags.reduce(function(soma, a) {
    if (a.pagamento && a.pagamento.status === 'pago' && Number(a.pagamento.valor) > 0) {
      return soma + Number(a.pagamento.valor)
    }
    return soma
  }, 0)
 
  var totalSacado = getSaquesRealizados(nid).reduce(function(s, item) {
    return s + (Number(item.valor) || 0)
  }, 0)
 
  return Math.max(0, totalPago - totalSacado)
}
 
/* ── Atualiza UI do saldo ── */
function atualizarUISaldo(saldo) {
  var fmt = 'R$ ' + saldo.toLocaleString('pt-BR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  })
 
  var elSaldo = document.getElementById('dash-saldo-val')
  if (elSaldo) elSaldo.textContent = fmt
 
  var semSaldo = saldo <= 0
 
  var btnTransferir = document.querySelector('.dash-saldo-btn.primary')
  var btnSaque      = document.querySelector('.dash-saldo-btn.secondary')
 
  if (btnTransferir) {
    btnTransferir.disabled       = semSaldo
    btnTransferir.style.opacity  = semSaldo ? '0.4' : ''
    btnTransferir.style.cursor   = semSaldo ? 'not-allowed' : ''
    btnTransferir.title          = semSaldo ? 'Sem saldo disponível' : ''
  }
  if (btnSaque) {
    btnSaque.disabled       = semSaldo
    btnSaque.style.opacity  = semSaldo ? '0.4' : ''
    btnSaque.style.cursor   = semSaldo ? 'not-allowed' : ''
    btnSaque.title          = semSaldo ? 'Sem saldo disponível' : ''
  }
}
 
/* ── Recalcula e exibe saldo ── */
function recalcularSaldo() {
  var nid = negocioAtual ? negocioAtual._id : null
  if (!nid) return 0
  var saldo = calcularSaldoReal(todosAgendamentos || [], nid)
  setSaldoSalvo(nid, saldo)
  atualizarUISaldo(saldo)
  return saldo
}
 
/* ── Toast simples ── */
function toastSaldo(msg, cor) {
  var id = 'toast-saldo-dash'
  var el = document.getElementById(id)
  if (!el) {
    el = document.createElement('div')
    el.id = id
    el.style.cssText = [
      'position:fixed;bottom:24px;left:50%;transform:translateX(-50%)',
      'padding:12px 22px;border-radius:10px;font-size:13.5px',
      'font-weight:600;color:#fff;z-index:9999',
      'box-shadow:0 4px 20px rgba(0,0,0,.4);transition:opacity .3s',
      'max-width:90vw;text-align:center;font-family:inherit'
    ].join(';')
    document.body.appendChild(el)
  }
  el.style.background = cor || '#10b981'
  el.style.opacity    = '1'
  el.textContent      = msg
  clearTimeout(el._t)
  el._t = setTimeout(function() { el.style.opacity = '0' }, 3500)
}
 
/* ── Saque com validação ── */
function solicitarSaqueDash() {
  var nid = negocioAtual ? negocioAtual._id : null
  if (!nid) return
 
  var saldo = recalcularSaldo()
 
  if (saldo <= 0) {
    toastSaldo('Você não tem saldo disponível para saque.', '#ef4444')
    return
  }
 
  var ok = confirm(
    'Solicitar saque de R$ ' +
    saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) +
    '?\n\nO valor será transferido para sua conta vinculada.'
  )
  if (!ok) return
 
  var token = localStorage.getItem('token')
  fetch(API + '/pagamento/sacar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ negocioId: nid, valor: saldo })
  })
  .then(function(res) { return res.json() })
  .then(function(data) {
    if (data && data.erro) {
      toastSaldo('Erro: ' + data.erro, '#ef4444')
      return
    }
    registrarSaqueLocal(nid, saldo)
    setSaldoSalvo(nid, 0)
    atualizarUISaldo(0)
    toastSaldo('Saque de R$ ' + saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + ' solicitado!', '#10b981')
  })
  .catch(function() {
    // Backend ainda não tem a rota? Registra local mesmo assim
    registrarSaqueLocal(nid, saldo)
    setSaldoSalvo(nid, 0)
    atualizarUISaldo(0)
    toastSaldo('Saque solicitado! Entraremos em contato.', '#10b981')
  })
}
 
/* ── Aplica onclick nos botões do saldo ── */
function bindBotoesSaldo() {
  var btnTransferir = document.querySelector('.dash-saldo-btn.primary')
  var btnSaque      = document.querySelector('.dash-saldo-btn.secondary')
 
  if (btnTransferir) {
    btnTransferir.onclick = function() {
      var nid   = negocioAtual ? negocioAtual._id : null
      var saldo = nid ? getSaldoSalvo(nid) : 0
      if (saldo <= 0) { toastSaldo('Sem saldo disponível.', '#ef4444'); return }
      irPara('pagamentos', document.getElementById('menu-pagamentos'))
    }
  }
 
  if (btnSaque) {
    btnSaque.onclick = solicitarSaqueDash
  }
}
 
/* ── Hook: recalcula sempre que agendamentos mudam ── */
;(function() {
  var _orig = window.renderDashboardHoje
  window.renderDashboardHoje = function() {
    if (typeof _orig === 'function') _orig.apply(this, arguments)
    requestAnimationFrame(function() {
      recalcularSaldo()
      bindBotoesSaldo()
    })
  }
})()
 
/* ── Hook: recalcula ao navegar para dashboard ── */
;(function() {
  var _orig = window.irPara
  window.irPara = function(pagina, btn) {
    _orig.apply(this, arguments)
    if (pagina === 'dashboard') {
      setTimeout(function() {
        recalcularSaldo()
        bindBotoesSaldo()
      }, 120)
    }
  }
})()
 
/* ── Init inicial ── */
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    recalcularSaldo()
    bindBotoesSaldo()
  }, 900)
})

;(function () {
  var _recalcularSaldoOrig = window.recalcularSaldo
 
  window.recalcularSaldo = function () {
    var nid = window.negocioAtual ? window.negocioAtual._id : null
    if (!nid) return 0
 
    var ags = window.todosAgendamentos || []
 
    // Soma TODOS os agendamentos com pagamento.status === 'pago'
    // independente de o agendamento estar 'confirmado' ou 'concluido'
    var totalPago = ags.reduce(function (soma, a) {
      if (a.pagamento && a.pagamento.status === 'pago') {
        return soma + (Number(a.pagamento.valor) || 0)
      }
      return soma
    }, 0)
 
    // Desconta saques já realizados
    var saques = []
    try { saques = JSON.parse(localStorage.getItem('saques_ids_' + nid) || '[]') } catch (_) {}
    var totalSacado = saques.reduce(function (s, item) {
      return s + (Number(item.valor) || 0)
    }, 0)
 
    var saldo = Math.max(0, totalPago - totalSacado)
 
    // Persiste e atualiza UI
    localStorage.setItem('saldo_disponivel_' + nid, String(saldo))
 
    var fmt = 'R$ ' + saldo.toLocaleString('pt-BR', {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    })
    var elSaldo = document.getElementById('dash-saldo-val')
    if (elSaldo) elSaldo.textContent = fmt
 
    // Habilita/desabilita botões de saque
    var semSaldo = saldo <= 0
    var btnT = document.querySelector('.dash-saldo-btn.primary')
    var btnS = document.querySelector('.dash-saldo-btn.secondary')
    if (btnT) { btnT.disabled = semSaldo; btnT.style.opacity = semSaldo ? '0.4' : '' }
    if (btnS) { btnS.disabled = semSaldo; btnS.style.opacity = semSaldo ? '0.4' : '' }
 
    return saldo
  }
 
  // Também corrige carregarAgendamentos para chamar recalcularSaldo após carregar
  var _origCarregarAgs = window.carregarAgendamentos
  if (typeof _origCarregarAgs === 'function') {
    window.carregarAgendamentos = async function () {
      await _origCarregarAgs.apply(this, arguments)
      // Recalcula saldo após agendamentos carregados
      setTimeout(function () {
        window.recalcularSaldo()
      }, 100)
    }
  }
 
  console.log('[saldo-patch] ✓ recalcularSaldo sobrescrito com suporte a pagamento.status=pago')
})()

/* ═══════════════════════════════════════════════════
   MÓDULO DE AGENDAMENTOS — GRADE SEMANAL COMPLETA
   Idêntico à imagem de referência
═══════════════════════════════════════════════════ */

;(function() {
'use strict';

/* ── CONSTANTES ── */
const CELL_H = 56; // altura em px de cada hora
const START_H = 8; // 08:00
const END_H   = 19; // 19:00 (última linha)
const HOURS   = Array.from({length: END_H - START_H}, (_, i) => START_H + i);

/* ── DADOS ESTÁTICOS DA SEMANA DE REFERÊNCIA ── */
const PROFISSIONAIS = [
  { id: 'todos', nome: 'Todos',          role: '',              cor: 'rgba(255,255,255,0.08)', initials: '👥', todos: true },
  { id: 'cs',    nome: 'Camila Santos',  role: 'Cabeleireira',  cor: 'linear-gradient(135deg,#ec4899,#f43f5e)', initials: 'CS' },
  { id: 'ra',    nome: 'Roberto Almeida',role: 'Barbeiro',      cor: 'linear-gradient(135deg,#3b82f6,#06b6d4)', initials: 'RA' },
  { id: 'ml',    nome: 'Mariana Lima',   role: 'Esteticista',   cor: 'linear-gradient(135deg,#8b5cf6,#a78bfa)', initials: 'ML' },
  { id: 'ja',    nome: 'Juliana Alves',  role: 'Colorista',     cor: 'linear-gradient(135deg,#f59e0b,#ef4444)', initials: 'JA' },
  { id: 'ce',    nome: 'Carlos Eduardo', role: 'Barbeiro',      cor: 'linear-gradient(135deg,#10b981,#06b6d4)', initials: 'CE' },
];

// colIdx: 0=DOM/17, 1=SEG/18, 2=TER/19(hoje), 3=QUA/20, 4=QUI/21, 5=SEX/22, 6=SAB/23
const EVENTS_DATA = [
  // DOM 17
  { colIdx:0, startH:9, startM:0,  durMin:65, cls:'ev-azul',    time:'09:00', servico:'Corte de cabelo', nome:'João Silva',      status:'check' },
  // SEG 18
  { colIdx:1, startH:10, startM:30, durMin:55, cls:'ev-rosa',   time:'10:30', servico:'Manicure',        nome:'Ana Paula',       status:'cancel' },
  // TER 19 (hoje)
  { colIdx:2, startH:9,  startM:0,  durMin:55, cls:'ev-azul',   time:'09:00', servico:'Corte de cabelo', nome:'João Silva',      status:'check' },
  { colIdx:2, startH:10, startM:0,  durMin:65, cls:'ev-roxo',   time:'10:00', servico:'Hidratação',      nome:'Mariana Lima',    status:'check' },
  { colIdx:2, startH:12, startM:0,  durMin:75, cls:'ev-laranja', time:'12:00', servico:'Coloração',       nome:'Juliana Alves',   status:'wait' },
  { colIdx:2, startH:15, startM:30, durMin:55, cls:'ev-azul',   time:'15:30', servico:'Escova',          nome:'Ana Beatriz',     status:'check' },
  { colIdx:2, startH:17, startM:0,  durMin:55, cls:'ev-verde',  time:'17:00', servico:'Luzes',           nome:'Gabriela Costa',  status:'check' },
  // QUA 20
  { colIdx:3, startH:11, startM:0,  durMin:50, cls:'ev-verde',  time:'11:00', servico:'Barba',           nome:'Carlos Eduardo',  status:'check' },
  { colIdx:3, startH:14, startM:0,  durMin:65, cls:'ev-vermelho',time:'14:00', servico:'Corte feminino', nome:'Patrícia Souza',  status:'cancel' },
  { colIdx:3, startH:16, startM:0,  durMin:55, cls:'ev-laranja', time:'16:00', servico:'Corte + Barba',  nome:'Lucas Martins',   status:'check' },
  { colIdx:3, startH:18, startM:30, durMin:55, cls:'ev-roxo',   time:'18:30', servico:'Penteado',        nome:'Isabela Pereira', status:'cancel' },
  // QUI 21
  { colIdx:4, startH:10, startM:0,  durMin:55, cls:'ev-ciano',  time:'10:00', servico:'Hidratação',      nome:'Mariana Lima',    status:'check' },
  // SEX 22
  { colIdx:5, startH:11, startM:0,  durMin:50, cls:'ev-verde',  time:'11:00', servico:'Barba',           nome:'Carlos Eduardo',  status:'check' },
  // SAB 23
  { colIdx:6, startH:10, startM:0,  durMin:65, cls:'ev-teal',   time:'10:00', servico:'Corte + Barba',   nome:'Roberto Almeida', status:'check' },
];

const DIAS_SEMANA = [
  { abrev:'DOM', num:17 },
  { abrev:'SEG', num:18 },
  { abrev:'TER', num:19, hoje: true },
  { abrev:'QUA', num:20 },
  { abrev:'QUI', num:21 },
  { abrev:'SEX', num:22 },
  { abrev:'SÁB', num:23 },
];

// Posição da linha "agora" — Terça (colIdx=2), 10:30
const NOW_COL = 2;
const NOW_H   = 10;
const NOW_M   = 30;

/* ══════════════════════════════════════════════════
   MINI CALENDÁRIO
══════════════════════════════════════════════════ */
function buildMiniCalendar(container) {
  if (!container) return;
  container.innerHTML = '';

  // Maio 2026: 1 = sexta (5), offset = 5
  const OFFSET = 5;
  const DAYS_IN_MAY = 31;
  const SELECTED_WEEK = [17,18,19,20,21,22,23];
  const TODAY = 19;
  const HAS_EVENTS = { 14:'p', 15:'c', 17:'c', 18:'c', 19:'c', 20:'p', 21:'c', 22:'c', 23:'x', 25:'p', 28:'c' };

  const cells = [];
  // dias do mês anterior (Abril tem 30 dias)
  for (let i = 0; i < OFFSET; i++) cells.push({ d: 30 - OFFSET + 1 + i, outro: true });
  // dias de Maio
  for (let d = 1; d <= DAYS_IN_MAY; d++) cells.push({ d, outro: false });
  // completar linha
  const rem = cells.length % 7;
  if (rem) for (let i = 1; i <= 7 - rem; i++) cells.push({ d: i, outro: true });

  cells.forEach(({ d, outro }) => {
    const div = document.createElement('div');
    let cls = 'ag-cal-day';
    if (outro) cls += ' outro-mes';
    else if (d === TODAY) cls += ' cal-hoje';
    else if (SELECTED_WEEK.includes(d)) cls += ' cal-semana';
    div.className = cls;

    const numSpan = document.createElement('span');
    numSpan.textContent = d;
    div.appendChild(numSpan);

    if (!outro && HAS_EVENTS[d]) {
      const dot = document.createElement('div');
      dot.className = 'ag-cal-day-dot ag-dot-' + HAS_EVENTS[d];
      div.appendChild(dot);
    }

    container.appendChild(div);
  });
}

/* ══════════════════════════════════════════════════
   PROFISSIONAIS AVATARES
══════════════════════════════════════════════════ */
function buildProfissionaisRow(container) {
  if (!container) return;
  container.innerHTML = '';

  PROFISSIONAIS.forEach(prof => {
    const item = document.createElement('div');
    item.className = 'ag-prof-item' + (prof.todos ? ' ativo' : '');
    item.setAttribute('data-prof', prof.id);

    const av = document.createElement('div');
    av.className = 'ag-prof-av' + (prof.todos ? ' todos-av' : '');
    if (prof.todos) {
      av.innerHTML = `<svg width="16" height="16" viewBox="0 0 20 20" fill="none">
        <circle cx="7" cy="6" r="2.5" stroke="currentColor" stroke-width="1.4"/>
        <path d="M2 16c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        <path d="M13.5 8.5a2 2 0 1 1 0-4M18 16c0-2.2-1.8-4-4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      </svg>`;
      av.style.color = 'var(--text2)';
    } else {
      av.textContent = prof.initials;
      av.style.background = prof.cor;
    }

    const nameDiv = document.createElement('div');
    nameDiv.className = 'ag-prof-name';
    nameDiv.textContent = prof.todos ? 'Todos' : prof.nome.split(' ')[0] + ' ' + (prof.nome.split(' ')[1] || '');

    const roleDiv = document.createElement('div');
    roleDiv.className = 'ag-prof-role';
    roleDiv.textContent = prof.role;

    item.appendChild(av);
    item.appendChild(nameDiv);
    if (prof.role) item.appendChild(roleDiv);

    item.addEventListener('click', function () {
      document.querySelectorAll('.ag-prof-item').forEach(el => el.classList.remove('ativo'));
      this.classList.add('ativo');
    });

    container.appendChild(item);
  });

  // Botão +
  const addItem = document.createElement('div');
  addItem.className = 'ag-prof-item';
  const addAv = document.createElement('div');
  addAv.className = 'ag-prof-av add-av';
  addAv.textContent = '+';
  const addName = document.createElement('div');
  addName.className = 'ag-prof-name';
  addName.textContent = 'Mais';
  addItem.appendChild(addAv);
  addItem.appendChild(addName);
  container.appendChild(addItem);
}

/* ══════════════════════════════════════════════════
   GRADE SEMANAL
══════════════════════════════════════════════════ */
function buildWeeklyGrid(container) {
  if (!container) return;
  container.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'ag-grid-wrap';

  /* — Header row — */
  // Célula vazia (canto)
  const cornerCell = document.createElement('div');
  cornerCell.className = 'ag-grid-day-hdr';
  cornerCell.style.cssText = 'position:sticky;left:0;z-index:15;background:var(--bg-card)';
  grid.appendChild(cornerCell);

  DIAS_SEMANA.forEach(dia => {
    const hdr = document.createElement('div');
    hdr.className = 'ag-grid-day-hdr';
    hdr.innerHTML = `<div class="ag-day-hdr-name">${dia.abrev}</div>`;
    if (dia.hoje) {
      hdr.innerHTML += `<div class="ag-day-hdr-hoje">${dia.num}</div>`;
    } else {
      hdr.innerHTML += `<div class="ag-day-hdr-num">${dia.num}</div>`;
    }
    grid.appendChild(hdr);
  });

  /* — Body: linha de tempo + colunas dos dias — */
  const timeCol = document.createElement('div');
  timeCol.className = 'ag-time-col';
  timeCol.style.cssText = 'display:flex;flex-direction:column;position:sticky;left:0;z-index:8;background:var(--bg-card)';

  HOURS.forEach(h => {
    const slot = document.createElement('div');
    slot.className = 'ag-time-slot';
    const lbl = document.createElement('span');
    lbl.className = 'ag-time-lbl';
    lbl.textContent = `${String(h).padStart(2,'0')}:00`;
    slot.appendChild(lbl);
    timeCol.appendChild(slot);
  });
  grid.appendChild(timeCol);

  // Colunas dos 7 dias
  DIAS_SEMANA.forEach((dia, colIdx) => {
    const col = document.createElement('div');
    col.className = 'ag-day-col';
    col.style.cssText = `position:relative;height:${HOURS.length * CELL_H}px`;
    col.setAttribute('data-col', colIdx);

    // Células de fundo (grid lines)
    HOURS.forEach(() => {
      const cell = document.createElement('div');
      cell.className = 'ag-day-cell';
      col.appendChild(cell);
    });

    // Linha "agora" (col TER/19)
    if (colIdx === NOW_COL) {
      const nowLine = document.createElement('div');
      nowLine.className = 'ag-now-line';
      const topPx = ((NOW_H - START_H) * 60 + NOW_M) / 60 * CELL_H;
      nowLine.style.top = topPx + 'px';
      col.appendChild(nowLine);
    }

    // Eventos desta coluna
    const colEvents = EVENTS_DATA.filter(ev => ev.colIdx === colIdx);
    colEvents.forEach(ev => {
      const el = createEventEl(ev);
      col.appendChild(el);
    });

    grid.appendChild(col);
  });

  container.appendChild(grid);
}

function createEventEl(ev) {
  const topPx = ((ev.startH - START_H) * 60 + ev.startM) / 60 * CELL_H;
  const height = Math.max(ev.durMin / 60 * CELL_H - 3, 32);

  const el = document.createElement('div');
  el.className = `ag-event ${ev.cls}`;
  el.style.cssText = `top:${topPx}px;height:${height}px`;

  const statusIconMap = {
    check:  `<svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    wait:   `<svg width="9" height="9" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="3.5" stroke="currentColor" stroke-width="1.2"/><path d="M5 3v2.5l1.5 1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`,
    cancel: `<svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  };

  el.innerHTML = `
    <div class="ag-ev-time">${ev.time}</div>
    <div class="ag-ev-servico">${ev.servico}</div>
    <div class="ag-ev-nome">${ev.nome}</div>
    <div class="ag-ev-status ag-ev-${ev.status}">${statusIconMap[ev.status] || ''}</div>
  `;

  // Tooltip hover
  el.addEventListener('mouseenter', function(e) {
    showEvTooltip(e, ev);
  });
  el.addEventListener('mousemove', function(e) {
    positionTooltip(e);
  });
  el.addEventListener('mouseleave', function() {
    hideEvTooltip();
  });

  return el;
}

/* ── TOOLTIP ── */
let _tooltip = null;
function ensureTooltip() {
  if (!_tooltip) {
    _tooltip = document.createElement('div');
    _tooltip.className = 'ag-ev-tooltip';
    _tooltip.id = 'ag-ev-tooltip-singleton';
    document.body.appendChild(_tooltip);
  }
  return _tooltip;
}
function showEvTooltip(e, ev) {
  const t = ensureTooltip();
  const statusLbl = { check: '✓ Confirmado', wait: '⏳ Pendente', cancel: '✕ Cancelado' };
  t.innerHTML = `<strong>${ev.servico}</strong><span>${ev.nome}</span><br><span>${ev.time} · ${ev.durMin} min</span><br><span>${statusLbl[ev.status] || ''}</span>`;
  t.style.display = 'block';
  positionTooltip(e);
}
function positionTooltip(e) {
  const t = ensureTooltip();
  if (!t) return;
  const x = e.clientX + 14;
  const y = e.clientY - 10;
  const maxX = window.innerWidth - 180;
  const maxY = window.innerHeight - 100;
  t.style.left  = Math.min(x, maxX) + 'px';
  t.style.top   = Math.min(y, maxY) + 'px';
}
function hideEvTooltip() {
  const t = ensureTooltip();
  if (t) t.style.display = 'none';
}

/* ══════════════════════════════════════════════════
   TAXA DE COMPARECIMENTO (donut SVG)
══════════════════════════════════════════════════ */
function buildTaxaDonut(container) {
  if (!container) return;
  const pct = 92;
  const r = 30;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const gap  = circ - dash;

  container.innerHTML = `
    <div class="ag-taxa-donut-wrap">
      <div class="ag-taxa-donut">
        <svg viewBox="0 0 72 72">
          <circle cx="36" cy="36" r="${r}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="7"/>
          <circle cx="36" cy="36" r="${r}" fill="none" stroke="#34d399" stroke-width="7"
            stroke-linecap="round"
            stroke-dasharray="${dash.toFixed(1)} ${gap.toFixed(1)}"
            style="transform-origin:center;transform:rotate(-90deg)"/>
        </svg>
        <div class="ag-taxa-val-abs">
          <span class="ag-taxa-pct">${pct}%</span>
        </div>
      </div>
      <div class="ag-taxa-info">
        <div class="ag-taxa-trend">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 2l4 4H2l4-4Z" fill="#34d399"/>
          </svg>
          5%
        </div>
        <div class="ag-taxa-sub">vs semana anterior</div>
      </div>
    </div>
  `;
}

/* ══════════════════════════════════════════════════
   RESUMO DA SEMANA
══════════════════════════════════════════════════ */
function buildResumoSemana(container) {
  if (!container) return;
  const rows = [
    { k: 'Faturamento',           v: 'R$ 1.245,00', cls: 'green' },
    { k: 'Ticket médio',          v: 'R$ 69,17',    cls: '' },
    { k: 'Taxa de comparecimento',v: '92%',         cls: 'blue' },
    { k: 'Cancelamentos',         v: '1 (8%)',      cls: 'red' },
  ];

  let html = rows.map(r =>
    `<div class="ag-resumo-row">
      <span class="ag-resumo-k">${r.k}</span>
      <span class="ag-resumo-v ${r.cls}">${r.v}</span>
    </div>`
  ).join('');

  container.innerHTML = html;
}

/* ══════════════════════════════════════════════════
   VIEW TABS
══════════════════════════════════════════════════ */
function initViewTabs(container) {
  if (!container) return;
  container.querySelectorAll('.ag-view-tab').forEach(tab => {
    tab.addEventListener('click', function () {
      container.querySelectorAll('.ag-view-tab').forEach(t => t.classList.remove('ativo'));
      this.classList.add('ativo');
    });
  });
}

/* ══════════════════════════════════════════════════
   AI BANNER
══════════════════════════════════════════════════ */
function initAiBanner(banner) {
  if (!banner) return;
  const closeBtn = banner.querySelector('.ag-ai-banner-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      banner.style.display = 'none';
    });
  }
}

function initAiCard(card) {
  if (!card) return;
  const closeBtn = card.querySelector('.ag-ai-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      card.style.opacity = '0.4';
      card.style.pointerEvents = 'none';
    });
  }
  // Opções clicáveis
  card.querySelectorAll('.ag-ai-opt').forEach(opt => {
    opt.addEventListener('click', function() {
      const input = card.querySelector('.ag-ai-input');
      if (input) {
        input.focus();
        const t = opt.querySelector('.ag-ai-opt-title');
        if (t) input.placeholder = t.textContent + '...';
      }
    });
  });
}

/* ══════════════════════════════════════════════════
   LINK DE AGENDAMENTO
══════════════════════════════════════════════════ */
function initLinkCard(card) {
  if (!card) return;
  const copyIconBtn = card.querySelector('.ag-link-copy-icon');
  const copyLinkBtn = card.querySelector('[data-copy-link]');
  const url = card.querySelector('.ag-link-url');
  const link = url ? url.textContent : '';

  function doCopy() {
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      if (copyLinkBtn) {
        const orig = copyLinkBtn.innerHTML;
        copyLinkBtn.innerHTML = '✓ Copiado!';
        setTimeout(() => { copyLinkBtn.innerHTML = orig; }, 2000);
      }
    }).catch(() => {});
  }

  if (copyIconBtn) copyIconBtn.addEventListener('click', doCopy);
  if (copyLinkBtn) copyLinkBtn.addEventListener('click', doCopy);
}

/* ══════════════════════════════════════════════════
   ENTRADA PRINCIPAL
══════════════════════════════════════════════════ */
function initAgendamentosV2() {
  // Mini calendário
  buildMiniCalendar(document.getElementById('ag-mini-cal-grid'));

  // Profissionais
  buildProfissionaisRow(document.getElementById('ag-profs-row'));

  // Grade semanal
  buildWeeklyGrid(document.getElementById('ag-weekly-grid-body'));

  // Donut taxa
  buildTaxaDonut(document.getElementById('ag-taxa-donut-container'));

  // Resumo semana
  buildResumoSemana(document.getElementById('ag-resumo-rows'));

  // View tabs
  initViewTabs(document.querySelector('.ag-view-tabs-wrap'));

  // AI banner
  initAiBanner(document.querySelector('.ag-ai-banner'));

  // AI card
  initAiCard(document.querySelector('.ag-ai-card'));

  // Link card
  initLinkCard(document.querySelector('.ag-link-card'));
}

// Executa quando o painel de agendamentos fica ativo
window.initAgendamentosV2 = initAgendamentosV2;

// Auto-init se o elemento já existir
document.addEventListener('DOMContentLoaded', function() {
  if (document.getElementById('ag-mini-cal-grid')) {
    initAgendamentosV2();
  }
});

})();

/* ════════════════════════════════════════════════════════
   AGENDAMENTOS V3 — JS COMPLETO
   Cole no final do painel.js (antes do DOMContentLoaded
   ou em qualquer ponto global)
════════════════════════════════════════════════════════ */

;(function () {
'use strict';
 
/* ── ESTADO ──────────────────────────────────────────── */
var ag3 = {
  periodoAtivo:   'hoje',
  statusAtivo:    'todos',
  buscaTermo:     '',
  dataFiltro:     '',
  viewAtiva:      'lista',
  paginaAtual:    1,
  porPagina:      8,
  timelineLimite: 8,
  listaFiltrada:  [],
  calMes:  new Date().getMonth(),
  calAno:  new Date().getFullYear(),
  idDetalhe: null,
};
 
/* ── UTILITÁRIOS ─────────────────────────────────────── */
function ag3fmtData(data) {
  if (!data) return '—';
  var p = data.split('-');
  return p[2] + '/' + p[1] + '/' + p[0];
}
function ag3fmtDia(data) {
  if (!data) return '—';
  var p = data.split('-');
  return p[2] + '/' + p[1];
}
function ag3fmtBRL(v) {
  if (!v || isNaN(v) || Number(v) <= 0) return null;
  return 'R$\u00A0' + Number(v).toLocaleString('pt-BR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
}
function ag3avatarCor(nome) {
  var pals = [
    ['#1d4ed8','#3b82f6'],['#7c3aed','#8b5cf6'],['#0e7490','#06b6d4'],
    ['#15803d','#22c55e'],['#b45309','#f59e0b'],['#be185d','#ec4899'],
    ['#0369a1','#38bdf8'],['#6d28d9','#a78bfa'],['#9f1239','#f43f5e']
  ];
  var h = 0;
  for (var i = 0; i < (nome || 'A').length; i++)
    h = ((h << 5) - h) + (nome || 'A').charCodeAt(i);
  return pals[Math.abs(h) % pals.length];
}
function ag3statusLabel(s) {
  return { confirmado:'confirmado', concluido:'concluído',
           cancelado:'cancelado', pendente:'pendente' }[s] || s;
}
function ag3badgeHtml(status) {
  var bg  = { confirmado:'var(--green-bg)',  concluido:'rgba(139,92,246,0.12)',
              cancelado:'var(--red-bg)',     pendente:'var(--yellow-bg)' };
  var cor = { confirmado:'var(--green)',     concluido:'#a78bfa',
              cancelado:'var(--red)',        pendente:'var(--yellow)' };
  var bd  = { confirmado:'var(--green-border)', concluido:'rgba(139,92,246,0.25)',
              cancelado:'var(--red-border)',    pendente:'var(--yellow-border)' };
  return '<span class="badge" style="background:'+(bg[status]||'rgba(255,255,255,0.06)')+
    ';color:'+(cor[status]||'var(--text3)')+';border-color:'+(bd[status]||'var(--border2)')+'">'+
    ag3statusLabel(status)+'</span>';
}
 
/* ── FILTRAGEM ───────────────────────────────────────── */
function ag3Filtrar() {
  var ags  = window.todosAgendamentos || [];
  var hoje = new Date().toISOString().split('T')[0];
  var ama  = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  var semI = (function(){ var d=new Date(); d.setDate(d.getDate()-d.getDay()); return d.toISOString().split('T')[0]; })();
  var semF = (function(){ var d=new Date(); d.setDate(d.getDate()+(6-d.getDay())); return d.toISOString().split('T')[0]; })();
  var mes  = new Date().toISOString().slice(0,7);
 
  var lista = ags.slice();
 
  if (ag3.dataFiltro) {
    lista = lista.filter(function(a){ return a.data === ag3.dataFiltro; });
  } else {
    if      (ag3.periodoAtivo === 'hoje')   lista = lista.filter(function(a){ return a.data === hoje; });
    else if (ag3.periodoAtivo === 'amanha') lista = lista.filter(function(a){ return a.data === ama; });
    else if (ag3.periodoAtivo === 'semana') lista = lista.filter(function(a){ return a.data >= semI && a.data <= semF; });
    else if (ag3.periodoAtivo === 'mes')    lista = lista.filter(function(a){ return a.data && a.data.startsWith(mes); });
    /* 'todos' sem filtro de data */
  }
 
  if (ag3.statusAtivo !== 'todos')
    lista = lista.filter(function(a){ return a.status === ag3.statusAtivo; });
 
  if (ag3.buscaTermo) {
    var t = ag3.buscaTermo.toLowerCase();
    lista = lista.filter(function(a){
      return (a.pacienteNome||'').toLowerCase().includes(t) ||
             (a.servico||'').toLowerCase().includes(t) ||
             (a.pacienteTelefone||'').includes(t) ||
             (a.data||'').includes(t) || (a.hora||'').includes(t);
    });
  }
 
  lista.sort(function(a,b){
    var ka = (a.data||'')+(a.hora||'');
    var kb = (b.data||'')+(b.hora||'');
    if (ag3.periodoAtivo==='hoje'||ag3.periodoAtivo==='amanha') return ka.localeCompare(kb);
    return kb.localeCompare(ka);
  });
 
  ag3.listaFiltrada = lista;
  ag3.paginaAtual   = 1;
}
 
/* ── STATS ───────────────────────────────────────────── */
function ag3RenderStats() {
  var ags  = window.todosAgendamentos || [];
  var hoje = new Date().toISOString().split('T')[0];
  var semI = (function(){ var d=new Date(); d.setDate(d.getDate()-d.getDay()); return d.toISOString().split('T')[0]; })();
  var semF = new Date(Date.now()+6*86400000).toISOString().split('T')[0];
  var mes  = new Date().toISOString().slice(0,7);
 
  var numHoje   = ags.filter(function(a){ return a.data===hoje; }).length;
  var numSemana = ags.filter(function(a){ return a.data>=semI&&a.data<=semF; }).length;
  var numConf   = ags.filter(function(a){ return a.status==='confirmado'&&a.data&&a.data.startsWith(mes); }).length;
  var numCanc   = ags.filter(function(a){ return a.status==='cancelado'&&a.data&&a.data.startsWith(mes); }).length;
  var fatMes    = ags.filter(function(a){ return a.status==='concluido'&&a.data&&a.data.startsWith(mes); })
                     .reduce(function(s,a){ return s+(Number(a.preco)||0); },0);
 
  function sv(id,v){ var el=document.getElementById(id); if(el) el.textContent=v; }
  sv('ag3-num-hoje',   numHoje);
  sv('ag3-num-semana', numSemana);
  sv('ag3-num-conf',   numConf);
  sv('ag3-num-canc',   numCanc);
  sv('ag3-num-fat',    fatMes>=1000
    ? 'R$\u00A0'+(fatMes/1000).toFixed(1).replace(/\.0$/,'')+'k'
    : 'R$\u00A0'+fatMes.toFixed(0));
 
  sv('ag3-count-todos', ags.length);
  sv('ag3-count-conf',  ags.filter(function(a){ return a.status==='confirmado'; }).length);
  sv('ag3-count-conc',  ags.filter(function(a){ return a.status==='concluido';  }).length);
  sv('ag3-count-canc2', ags.filter(function(a){ return a.status==='cancelado';  }).length);
  sv('ag3-count-pend',  ags.filter(function(a){ return a.status==='pendente';   }).length);
 
  ag3RenderTopServicos(ags, mes);
}
 
function ag3RenderTopServicos(ags, mes) {
  var cont = document.getElementById('ag3-top-servicos');
  if (!cont) return;
  var doMes = ags.filter(function(a){ return a.data&&a.data.startsWith(mes); });
  var freq  = {};
  doMes.forEach(function(a){
    if (!a.servico) return;
    if (!freq[a.servico]) freq[a.servico]={qtd:0,fat:0};
    freq[a.servico].qtd++;
    freq[a.servico].fat += Number(a.preco)||0;
  });
  var lista = Object.keys(freq)
    .map(function(k){ return {nome:k,qtd:freq[k].qtd,fat:freq[k].fat}; })
    .sort(function(a,b){ return b.qtd-a.qtd; }).slice(0,5);
  if (!lista.length){ cont.innerHTML='<div class="ag3-top-vazio">Sem dados neste mês</div>'; return; }
  var maxQtd = lista[0].qtd || 1;
  var cores  = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ec4899'];
  cont.innerHTML = lista.map(function(sv,i){
    var pct    = Math.round((sv.qtd/maxQtd)*100);
    var fatStr = sv.fat>0 ? ' · R$'+sv.fat.toFixed(0) : '';
    return '<div class="ag3-top-item">'+
      '<div class="ag3-top-row">'+
        '<span class="ag3-top-nome">'+sv.nome+'</span>'+
        '<span class="ag3-top-qtd">'+sv.qtd+'x'+fatStr+'</span>'+
      '</div>'+
      '<div class="ag3-top-bar-wrap">'+
        '<div class="ag3-top-bar" style="width:'+pct+'%;background:'+cores[i]+'"></div>'+
      '</div>'+
    '</div>';
  }).join('');
}
 
/* ── INFO DE RESULTADO ───────────────────────────────── */
function ag3RenderResultInfo() {
  var el   = document.getElementById('ag3-result-count');
  var btnC = document.getElementById('ag3-clear-filtros');
  var n    = ag3.listaFiltrada.length;
  if (el) el.textContent = n + ' agendamento' + (n!==1?'s':'');
  var temFiltro = ag3.buscaTermo || ag3.dataFiltro || ag3.statusAtivo!=='todos';
  if (btnC) btnC.style.display = temFiltro ? '' : 'none';
}
 
/* ── RENDER LISTA ────────────────────────────────────── */
/*
  REGRA: aba "Hoje" sem filtros → mostra SÓ a timeline (limitada).
  Qualquer outro filtro → mostra SÓ a lista paginada.
  Nunca as duas ao mesmo tempo → sem duplicatas.
*/
function ag3RenderLista() {
  var hoje  = new Date().toISOString().split('T')[0];
  var lista = ag3.listaFiltrada;
  var wrap  = document.getElementById('ag3-cards-lista');
  var vazel = document.getElementById('ag3-vazio');
  var vazsb = document.getElementById('ag3-vazio-sub');
  var pag   = document.getElementById('ag3-paginacao');
  var tl    = document.getElementById('ag3-hoje-timeline');
 
  var usarTimeline = (
    ag3.periodoAtivo === 'hoje' &&
    !ag3.dataFiltro &&
    !ag3.buscaTermo &&
    ag3.statusAtivo === 'todos'
  );
 
  /* ── TIMELINE ── */
  if (tl) {
    var deHoje = (window.todosAgendamentos || [])
      .filter(function(a){ return a.data === hoje; })
      .sort(function(a,b){ return (a.hora||'').localeCompare(b.hora||''); });
 
    if (usarTimeline && deHoje.length) {
      tl.style.display = '';
      var lbl = document.getElementById('ag3-hoje-data-label');
      if (lbl) lbl.textContent = new Date().toLocaleDateString('pt-BR',
        {weekday:'long',day:'numeric',month:'long'});
 
      var tlWrap = document.getElementById('ag3-timeline-hoje');
      if (tlWrap) {
        var lim  = ag3.timelineLimite;
        var sl   = deHoje.slice(0, lim);
        var rst  = deHoje.length - lim;
        var html = sl.map(ag3HtmlTimeline).join('');
        if (rst > 0) {
          html += '<div style="padding:12px 0 4px;text-align:center">' +
            '<button class="ag3-btn-export" ' +
            'onclick="ag3MudarPeriodo(\'todos\',document.querySelector(\'.ag3-tab[data-periodo=\\\"todos\\\"]\'))"' +
            ' type="button">Ver mais ' + rst + ' agendamento' + (rst!==1?'s':'') + ' ›</button>' +
            '</div>';
        }
        tlWrap.innerHTML = html;
      }
    } else {
      tl.style.display = 'none';
    }
  }
 
  /* quando timeline ativa, oculta lista e sai */
  if (usarTimeline) {
    if (wrap)  wrap.innerHTML = '';
    if (vazel) vazel.style.display = 'none';
    if (pag)   pag.style.display   = 'none';
    return;
  }
 
  /* ── LISTA PAGINADA ── */
  var ini   = (ag3.paginaAtual - 1) * ag3.porPagina;
  var fim   = ini + ag3.porPagina;
  var fatia = lista.slice(ini, fim);
 
  if (!lista.length) {
    if (wrap)  wrap.innerHTML = '';
    if (vazel) vazel.style.display = '';
    if (pag)   pag.style.display   = 'none';
    if (vazsb) {
      if (ag3.buscaTermo)          vazsb.textContent = 'Nenhum resultado para "'+ag3.buscaTermo+'".';
      else if (ag3.dataFiltro)     vazsb.textContent = 'Sem agendamentos em '+ag3fmtData(ag3.dataFiltro)+'.';
      else if (ag3.periodoAtivo==='amanha') vazsb.textContent = 'Nenhum agendamento para amanhã.';
      else                         vazsb.textContent = 'Tente outro filtro ou crie um novo agendamento.';
    }
    return;
  }
 
  if (vazel) vazel.style.display = 'none';
  if (wrap)  wrap.innerHTML = fatia.map(ag3HtmlCard).join('');
 
  var totalPgs = Math.ceil(lista.length / ag3.porPagina);
  if (pag) {
    pag.style.display = totalPgs > 1 ? 'flex' : 'none';
    var infoEl = document.getElementById('ag3-pag-info');
    var btnsEl = document.getElementById('ag3-pag-btns');
    if (infoEl) infoEl.textContent = (ini+1)+'–'+Math.min(fim,lista.length)+' de '+lista.length;
    if (btnsEl) {
      var btns = '<button class="ag3-pag-btn" onclick="ag3IrPagina('+(ag3.paginaAtual-1)+')" '+
        (ag3.paginaAtual===1?'disabled':'')+' type="button">‹</button>';
      for (var i=1;i<=totalPgs;i++){
        if (totalPgs<=7||i===1||i===totalPgs||Math.abs(i-ag3.paginaAtual)<=1)
          btns+='<button class="ag3-pag-btn '+(i===ag3.paginaAtual?'ativo':'')+
            '" onclick="ag3IrPagina('+i+')" type="button">'+i+'</button>';
        else if (Math.abs(i-ag3.paginaAtual)===2)
          btns+='<span style="color:var(--text3);font-size:12px;padding:0 2px">…</span>';
      }
      btns+='<button class="ag3-pag-btn" onclick="ag3IrPagina('+(ag3.paginaAtual+1)+')" '+
        (ag3.paginaAtual===totalPgs?'disabled':'')+' type="button">›</button>';
      btnsEl.innerHTML = btns;
    }
  }
}
 
/* ── HTML: ITEM TIMELINE ─────────────────────────────── */
function ag3HtmlTimeline(a) {
  var agora   = new Date();
  var passado = false;
  if (a.data && a.hora) {
    var p=a.data.split('-'), h=a.hora.split(':');
    passado = new Date(p[0],p[1]-1,p[2],h[0],h[1]).getTime() < agora.getTime();
  }
  var cores = ag3avatarCor(a.pacienteNome);
  var ini   = (a.pacienteNome||'C')[0].toUpperCase();
  var idS   = (a._id||'').replace(/'/g,"\\'");
  var nmS   = (a.pacienteNome||'').replace(/'/g,"\\'");
  var tlS   = (a.pacienteTelefone||'').replace(/'/g,"\\'");
  var preco = ag3fmtBRL(a.preco);
 
  var acoes = (a.status==='confirmado' && !passado)
    ? '<button class="ag3-btn-acao ag3-btn-conc" onclick="event.stopPropagation();atualizar(\''+idS+'\',\'concluido\')" type="button">Concluir</button>'+
      '<button class="ag3-btn-acao ag3-btn-canc" onclick="event.stopPropagation();cancelarComAviso(\''+idS+'\',\''+nmS+'\',\''+tlS+'\',\''+(a.data||'')+'\',\''+(a.hora||'')+'\')" type="button">Cancelar</button>'
    : ag3badgeHtml(a.status);
 
  return '<div class="ag3-tl-item">'+
    '<div class="ag3-tl-left">'+
      '<span class="ag3-tl-hora">'+(a.hora||'--')+'</span>'+
      '<div class="ag3-tl-avatar" style="background:linear-gradient(135deg,'+cores[0]+','+cores[1]+')">'+ini+'</div>'+
    '</div>'+
    '<div class="ag3-tl-content" onclick="ag3AbrirDetalhe(\''+idS+'\')" style="'+(passado?'opacity:.65':'')+'">' +
      '<div class="ag3-tl-nome">'+(a.pacienteNome||'—')+'</div>'+
      '<div class="ag3-tl-servico">'+(a.servico||'—')+(preco?' · <strong style="color:var(--green)">'+preco+'</strong>':'')+'</div>'+
      '<div class="ag3-tl-footer">'+
        '<span class="ag3-tl-chip">'+(a.hora||'—')+'</span>'+
        (a.pacienteTelefone?'<span class="ag3-tl-chip">'+a.pacienteTelefone+'</span>':'')+
        '<div class="ag3-tl-actions" onclick="event.stopPropagation()">'+acoes+'</div>'+
      '</div>'+
    '</div>'+
  '</div>';
}
 
/* ── HTML: CARD LISTA ────────────────────────────────── */
function ag3HtmlCard(a) {
  var hoje  = new Date().toISOString().split('T')[0];
  var agora = new Date();
  var passado = false;
  if (a.data && a.hora) {
    var p=a.data.split('-'), hh=a.hora.split(':');
    passado = new Date(p[0],p[1]-1,p[2],hh[0],hh[1]).getTime() < agora.getTime();
  }
  var deHojeItem = a.data === hoje;
  var cores = ag3avatarCor(a.pacienteNome);
  var ini   = (a.pacienteNome||'C')[0].toUpperCase();
  var idS   = (a._id||'').replace(/'/g,"\\'");
  var nmS   = (a.pacienteNome||'').replace(/'/g,"\\'");
  var tlS   = (a.pacienteTelefone||'').replace(/'/g,"\\'");
  var preco = ag3fmtBRL(a.preco);
  var tel   = a.pacienteTelefone ? a.pacienteTelefone.replace(/\D/g,'') : '';
 
  var acoes = '';
  if (a.status==='confirmado') {
    acoes += '<button class="ag3-btn-acao ag3-btn-conc" onclick="event.stopPropagation();atualizar(\''+idS+'\',\'concluido\')" type="button">Concluir</button>';
    acoes += '<button class="ag3-btn-acao ag3-btn-canc" onclick="event.stopPropagation();cancelarComAviso(\''+idS+'\',\''+nmS+'\',\''+tlS+'\',\''+(a.data||'')+'\',\''+(a.hora||'')+'\')" type="button">Cancelar</button>';
  } else {
    acoes += ag3badgeHtml(a.status);
  }
  if (tel) {
    var msg = encodeURIComponent('Olá '+(a.pacienteNome||'')+'!');
    acoes += '<a href="https://wa.me/55'+tel+'?text='+msg+'" target="_blank" '+
      'onclick="event.stopPropagation()" class="ag3-btn-wpp" title="WhatsApp">'+
      '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">'+
      '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>'+
      '<path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.852L.057 23.885l6.204-1.628A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.808 9.808 0 0 1-5.001-1.366l-.359-.213-3.682.966.983-3.594-.234-.371A9.818 9.818 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>'+
      '</svg></a>';
  }
 
  var clss = 'ag3-card-item' +
    (deHojeItem ? ' ag3-item-hoje' : '') +
    (passado && a.status==='concluido' ? ' ag3-item-passado' : '');
 
  return '<div class="'+clss+'" onclick="ag3AbrirDetalhe(\''+idS+'\')">'+
    '<div class="ag3-card-avatar" style="background:linear-gradient(135deg,'+cores[0]+','+cores[1]+')">'+ini+'</div>'+
    '<div class="ag3-card-info">'+
      '<div class="ag3-card-nome">'+(a.pacienteNome||'—')+'</div>'+
      '<div class="ag3-card-tel">'+(a.pacienteTelefone||'Sem telefone')+'</div>'+
    '</div>'+
    '<div class="ag3-card-middle">'+
      '<div class="ag3-card-servico">'+(a.servico||'—')+'</div>'+
      '<div class="ag3-card-dt">'+ag3fmtData(a.data)+' às '+(a.hora||'—')+'</div>'+
    '</div>'+
    '<div class="ag3-card-preco'+(preco?'':' sem-preco')+'">'+(preco||'—')+'</div>'+
    '<div class="ag3-card-acoes" onclick="event.stopPropagation()">'+acoes+'</div>'+
  '</div>';
}
 
/* ── KANBAN ──────────────────────────────────────────── */
function ag3RenderKanban() {
  var lista = ag3.listaFiltrada;
  var cols  = ['confirmado','pendente','concluido','cancelado'];
  function sv(id,v){ var el=document.getElementById(id); if(el) el.textContent=v; }
  cols.forEach(function(status){
    var items   = lista.filter(function(a){ return a.status===status; });
    var shortId = {confirmado:'conf',pendente:'pend',concluido:'conc',cancelado:'canc'}[status];
    sv('ag3-k-count-'+shortId, items.length);
    var cont = document.getElementById('ag3-k-'+status);
    if (!cont) return;
    if (!items.length){ cont.innerHTML='<div class="ag3-kanban-vazio">Nenhum item</div>'; return; }
    cont.innerHTML = items.slice(0,20).map(function(a){
      var idS   = (a._id||'').replace(/'/g,"\\'");
      var preco = ag3fmtBRL(a.preco);
      return '<div class="ag3-kanban-card" onclick="ag3AbrirDetalhe(\''+idS+'\')">'+
        '<div class="ag3-kc-nome">'+(a.pacienteNome||'—')+'</div>'+
        '<div class="ag3-kc-serv">'+(a.servico||'—')+'</div>'+
        '<div class="ag3-kc-row">'+
          '<span class="ag3-kc-chip">'+ag3fmtDia(a.data)+'</span>'+
          '<span class="ag3-kc-chip">'+(a.hora||'—')+'</span>'+
          (preco?'<span class="ag3-kc-preco">'+preco+'</span>':'')+
        '</div>'+
      '</div>';
    }).join('');
  });
}
 
/* ── CALENDÁRIO ──────────────────────────────────────── */
function ag3RenderCal() {
  var grid  = document.getElementById('ag3-cal-grid');
  var lblEl = document.getElementById('ag3-cal-mes-label');
  if (!grid) return;
  var ano  = ag3.calAno, mes = ag3.calMes;
  var nomes= ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  if (lblEl) lblEl.textContent = nomes[mes]+' '+ano;
  var hoje = new Date().toISOString().split('T')[0];
  var ags  = window.todosAgendamentos || [];
  var agDias = {};
  ags.forEach(function(a){
    if (!a.data) return;
    var p = a.data.split('-');
    if (parseInt(p[0])===ano && parseInt(p[1])===mes+1) agDias[parseInt(p[2])]=true;
  });
  var primeiroDia = new Date(ano,mes,1).getDay();
  var diasNoMes   = new Date(ano,mes+1,0).getDate();
  var diasAntMes  = new Date(ano,mes,0).getDate();
  var mesPad = String(mes+1).padStart(2,'0');
  var sel    = ag3.dataFiltro;
  var cells  = [];
  for (var i=0;i<primeiroDia;i++) cells.push({d:diasAntMes-primeiroDia+1+i,outro:true});
  for (var d=1;d<=diasNoMes;d++)  cells.push({d:d,outro:false});
  var rem = cells.length%7; if(rem) for(var j=1;j<=7-rem;j++) cells.push({d:j,outro:true});
  grid.innerHTML = cells.map(function(cell){
    if (cell.outro) return '<div class="ag3-cal-dia ag3-cal-outro">'+cell.d+'</div>';
    var ds  = ano+'-'+mesPad+'-'+String(cell.d).padStart(2,'0');
    var cls = 'ag3-cal-dia';
    if (ds===hoje) cls+=' ag3-cal-hoje';
    if (ds===sel && ds!==hoje) cls+=' ag3-cal-selecionado';
    if (agDias[cell.d]) cls+=' ag3-cal-tem-ag';
    return '<div class="'+cls+'" onclick="ag3CalClicar(\''+ds+'\')" title="'+ag3fmtData(ds)+'">'+cell.d+'</div>';
  }).join('');
}
 
function ag3CalClicar(data) {
  if (ag3.dataFiltro === data) {
    ag3.dataFiltro   = '';
    ag3.periodoAtivo = 'hoje';
    var inp = document.getElementById('ag3-data-filtro'); if(inp) inp.value='';
    document.querySelectorAll('.ag3-tab').forEach(function(b){ b.classList.remove('ativo'); b.setAttribute('aria-selected','false'); });
    var t = document.querySelector('.ag3-tab[data-periodo="hoje"]');
    if(t){ t.classList.add('ativo'); t.setAttribute('aria-selected','true'); }
  } else {
    ag3.dataFiltro   = data;
    ag3.periodoAtivo = '';
    var inp2 = document.getElementById('ag3-data-filtro'); if(inp2) inp2.value=data;
    document.querySelectorAll('.ag3-tab').forEach(function(b){ b.classList.remove('ativo'); b.setAttribute('aria-selected','false'); });
  }
  ag3Atualizar();
}
 
/* ── LINK ────────────────────────────────────────────── */
function ag3AtualizarLink() {
  if (!window.negocioAtual) return;
  var url = 'https://agendorapido.com.br/agendar.html?id='+window.negocioAtual._id;
  var elU = document.getElementById('ag3-link-url');
  var elW = document.getElementById('ag3-link-wpp');
  if (elU) elU.textContent = url;
  if (elW) elW.href = 'https://wa.me/?text='+encodeURIComponent('Agende agora: '+url);
}
 
window.ag3CopiarLink = function() {
  if (!window.negocioAtual) return;
  var url = 'https://agendorapido.com.br/agendar.html?id='+window.negocioAtual._id;
  navigator.clipboard.writeText(url).then(function(){
    var btn = document.getElementById('ag3-btn-copiar-link');
    if (btn){
      var orig=btn.innerHTML;
      btn.innerHTML='✓'; btn.style.color='var(--green)';
      setTimeout(function(){ btn.innerHTML=orig; btn.style.color=''; },2000);
    }
  });
};
 
/* ── MODAL DETALHE ───────────────────────────────────── */
window.ag3AbrirDetalhe = function(id) {
  var ags = window.todosAgendamentos || [];
  var a   = ags.find(function(x){ return x._id===id; });
  if (!a) return;
  ag3.idDetalhe = id;
  var cores = ag3avatarCor(a.pacienteNome);
  var ini   = (a.pacienteNome||'C')[0].toUpperCase();
  var elAv  = document.getElementById('ag3-det-avatar');
  if (elAv){ elAv.textContent=ini; elAv.style.background='linear-gradient(135deg,'+cores[0]+','+cores[1]+')'; }
  function sv(id,v){ var el=document.getElementById(id); if(el) el.textContent=v; }
  sv('ag3-det-nome',    a.pacienteNome||'—');
  sv('ag3-det-tel',     a.pacienteTelefone||'Sem telefone');
  sv('ag3-det-servico', a.servico||'—');
  sv('ag3-det-data',    ag3fmtData(a.data));
  sv('ag3-det-hora',    a.hora||'—');
  sv('ag3-det-preco',   ag3fmtBRL(a.preco)||'Não informado');
  var badgeEl = document.getElementById('ag3-det-badge');
  if (badgeEl) badgeEl.innerHTML = ag3badgeHtml(a.status);
  var pagRow = document.getElementById('ag3-det-pag-row');
  if (a.pagamento && a.pagamento.status) {
    if (pagRow) pagRow.style.display='';
    sv('ag3-det-pag', a.pagamento.status==='pago'
      ? '✓ Pago · '+(ag3fmtBRL(a.pagamento.valor)||'') : 'Pendente');
  } else { if (pagRow) pagRow.style.display='none'; }
  var acEl = document.getElementById('ag3-det-acoes');
  if (acEl) {
    var idS = id.replace(/'/g,"\\'");
    var nmS = (a.pacienteNome||'').replace(/'/g,"\\'");
    var tlS = (a.pacienteTelefone||'').replace(/'/g,"\\'");
    var btns = '';
    if (a.status==='confirmado'){
      btns += '<button class="ag3-det-btn ag3-det-btn-conc" onclick="atualizar(\''+idS+'\',\'concluido\');ag3FecharDetalhe()" type="button">✓ Concluir</button>';
      btns += '<button class="ag3-det-btn ag3-det-btn-canc" onclick="ag3FecharDetalhe();cancelarComAviso(\''+idS+'\',\''+nmS+'\',\''+tlS+'\',\''+(a.data||'')+'\',\''+(a.hora||'')+'\')" type="button">✕ Cancelar</button>';
    }
    if (a.pacienteTelefone){
      var tel2 = a.pacienteTelefone.replace(/\D/g,'');
      var msg2 = encodeURIComponent('Olá '+(a.pacienteNome||'')+'! 😊');
      btns += '<a href="https://wa.me/55'+tel2+'?text='+msg2+'" target="_blank" class="ag3-det-btn ag3-det-btn-wpp" onclick="ag3FecharDetalhe()">WhatsApp</a>';
    }
    if (!btns) btns='<button class="ag3-det-btn" onclick="ag3FecharDetalhe()" type="button">Fechar</button>';
    acEl.innerHTML = btns;
  }
  var modal = document.getElementById('ag3-modal-detalhe');
  if (modal){ modal.style.display='flex'; document.body.classList.add('modal-open'); }
};
 
window.ag3FecharDetalhe = function() {
  var modal = document.getElementById('ag3-modal-detalhe');
  if (modal){ modal.style.display='none'; document.body.classList.remove('modal-open'); }
  ag3.idDetalhe = null;
};
 
/* ── ATUALIZAR TUDO ──────────────────────────────────── */
function ag3Atualizar() {
  ag3Filtrar();
  ag3RenderResultInfo();
  ag3RenderCal();
  if (ag3.viewAtiva==='lista') ag3RenderLista();
  else                         ag3RenderKanban();
  ag3AtualizarLink();
}
 
/* ── FUNÇÕES GLOBAIS ─────────────────────────────────── */
window.ag3FiltrarStatus = function(status, btn) {
  ag3.statusAtivo = status;
  document.querySelectorAll('.ag3-fstatus').forEach(function(b){ b.classList.remove('ativo'); });
  if (btn) btn.classList.add('ativo');
  ag3Atualizar();
};
 
window.ag3MudarPeriodo = function(periodo, btn) {
  ag3.periodoAtivo = periodo;
  ag3.dataFiltro   = '';
  var inp = document.getElementById('ag3-data-filtro'); if(inp) inp.value='';
  document.querySelectorAll('.ag3-tab').forEach(function(b){
    b.classList.remove('ativo'); b.setAttribute('aria-selected','false');
  });
  if (btn){ btn.classList.add('ativo'); btn.setAttribute('aria-selected','true'); }
  ag3Atualizar();
};
 
window.ag3FiltrarPorData = function(val) {
  ag3.dataFiltro   = val;
  ag3.periodoAtivo = val ? '' : 'hoje';
  if (!val) {
    var tab = document.querySelector('.ag3-tab[data-periodo="hoje"]');
    if (tab){ tab.classList.add('ativo'); tab.setAttribute('aria-selected','true'); }
  } else {
    document.querySelectorAll('.ag3-tab').forEach(function(b){
      b.classList.remove('ativo'); b.setAttribute('aria-selected','false');
    });
  }
  ag3Atualizar();
};
 
window.ag3Buscar = function(val) {
  ag3.buscaTermo = val;
  var btn = document.getElementById('ag3-busca-clear');
  if (btn) btn.style.display = val ? '' : 'none';
  ag3Atualizar();
};
 
window.ag3LimparBusca = function() {
  ag3.buscaTermo = '';
  var inp = document.getElementById('ag3-busca');       if(inp) inp.value='';
  var btn = document.getElementById('ag3-busca-clear'); if(btn) btn.style.display='none';
  ag3Atualizar();
};
 
window.ag3LimparFiltros = function() {
  ag3.buscaTermo   = '';
  ag3.statusAtivo  = 'todos';
  ag3.dataFiltro   = '';
  ag3.periodoAtivo = 'hoje';
  var inp = document.getElementById('ag3-busca');       if(inp) inp.value='';
  var dt  = document.getElementById('ag3-data-filtro'); if(dt)  dt.value='';
  document.querySelectorAll('.ag3-tab').forEach(function(b){
    b.classList.remove('ativo'); b.setAttribute('aria-selected','false');
  });
  var tabH = document.querySelector('.ag3-tab[data-periodo="hoje"]');
  if (tabH){ tabH.classList.add('ativo'); tabH.setAttribute('aria-selected','true'); }
  document.querySelectorAll('.ag3-fstatus').forEach(function(b){ b.classList.remove('ativo'); });
  var todos = document.querySelector('.ag3-fstatus[data-status="todos"]');
  if (todos) todos.classList.add('ativo');
  ag3Atualizar();
};
 
window.ag3MudarView = function(view, btn) {
  ag3.viewAtiva = view;
  document.querySelectorAll('.ag3-view-btn').forEach(function(b){ b.classList.remove('ativo'); });
  if (btn) btn.classList.add('ativo');
  var listaWrap  = document.getElementById('ag3-view-lista-wrap');
  var kanbanWrap = document.getElementById('ag3-view-kanban-wrap');
  if (listaWrap)  listaWrap.style.display  = view==='lista'  ? '' : 'none';
  if (kanbanWrap) kanbanWrap.style.display = view==='kanban' ? '' : 'none';
  ag3Atualizar();
};
 
window.ag3IrPagina = function(n) {
  var total = Math.ceil(ag3.listaFiltrada.length/ag3.porPagina);
  if (n<1||n>total) return;
  ag3.paginaAtual = n;
  ag3RenderLista();
  var pg = document.getElementById('page-agendamentos');
  if (pg) pg.scrollIntoView({behavior:'smooth',block:'start'});
};
 
window.ag3ExportarCSV = function() {
  var lista = ag3.listaFiltrada.length ? ag3.listaFiltrada : (window.todosAgendamentos||[]);
  var linhas = [['Nome','Telefone','Serviço','Data','Hora','Status','Valor (R$)']];
  lista.forEach(function(a){
    linhas.push([a.pacienteNome||'',a.pacienteTelefone||'',a.servico||'',
                 a.data||'',a.hora||'',a.status||'',
                 a.preco?Number(a.preco).toFixed(2):'']);
  });
  var csv  = linhas.map(function(l){
    return l.map(function(c){ return '"'+String(c).replace(/"/g,'""')+'"'; }).join(',');
  }).join('\n');
  var blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
  var url  = URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.href=url; link.download='agendamentos.csv'; link.click();
  setTimeout(function(){ URL.revokeObjectURL(url); },500);
};
 
/* ── NAV CALENDÁRIO + MODAL ──────────────────────────── */
document.addEventListener('DOMContentLoaded', function(){
  var prev = document.getElementById('ag3-cal-prev');
  var next = document.getElementById('ag3-cal-next');
  if (prev) prev.onclick = function(){
    ag3.calMes--; if(ag3.calMes<0){ag3.calMes=11;ag3.calAno--;} ag3RenderCal();
  };
  if (next) next.onclick = function(){
    ag3.calMes++; if(ag3.calMes>11){ag3.calMes=0;ag3.calAno++;} ag3RenderCal();
  };
  var mdModal = document.getElementById('ag3-modal-detalhe');
  if (mdModal) mdModal.addEventListener('click', function(e){
    if(e.target===mdModal) ag3FecharDetalhe();
  });
});
 
/* ── HOOK ÚNICO em renderDashboardHoje ───────────────── */
;(function(){
  var _origRender = window.renderDashboardHoje;
  window.renderDashboardHoje = function(){
    if (typeof _origRender==='function') _origRender.apply(this,arguments);
    if (document.getElementById('ag3-cards-lista')){
      ag3RenderStats();
      ag3Atualizar();
    }
  };
})();
 
/* ── HOOK ÚNICO em irPara ────────────────────────────── */
;(function(){
  var _origIrPara = window.irPara;
  window.irPara = function(pagina, btn){
    _origIrPara.apply(this,arguments);
    if (pagina==='agendamentos'){
      setTimeout(function(){
        ag3.periodoAtivo = 'hoje';
        ag3.statusAtivo  = 'todos';
        ag3.buscaTermo   = '';
        ag3.dataFiltro   = '';
        var inp = document.getElementById('ag3-busca');       if(inp) inp.value='';
        var dt  = document.getElementById('ag3-data-filtro'); if(dt)  dt.value='';
        document.querySelectorAll('.ag3-tab').forEach(function(b){
          b.classList.remove('ativo'); b.setAttribute('aria-selected','false');
        });
        var tabH = document.querySelector('.ag3-tab[data-periodo="hoje"]');
        if (tabH){ tabH.classList.add('ativo'); tabH.setAttribute('aria-selected','true'); }
        document.querySelectorAll('.ag3-fstatus').forEach(function(b){ b.classList.remove('ativo'); });
        var todos = document.querySelector('.ag3-fstatus[data-status="todos"]');
        if (todos) todos.classList.add('ativo');
        ag3RenderStats();
        ag3Atualizar();
        ag3AtualizarLink();
      }, 60);
    }
  };
})();
 
})();