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
  document.body.classList.remove('dark-mode', 'light-mode')
  document.body.classList.add(tema === 'claro' ? 'light-mode' : 'dark-mode')
  localStorage.setItem('tema', tema)
  const oc = document.getElementById('theme-opt-claro')
  const oe = document.getElementById('theme-opt-escuro')
  if (oc) oc.classList.toggle('ativo', tema === 'claro')
  if (oe) oe.classList.toggle('ativo', tema === 'escuro')
}
function carregarTema() {
  definirTema(localStorage.getItem('tema') || 'escuro')
}
function toggleTema() {
  const atual = localStorage.getItem('tema') || 'escuro'
  definirTema(atual === 'escuro' ? 'claro' : 'escuro')
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
  const page = document.getElementById(`page-${pagina}`)
  if (page) page.classList.add('ativo')
  if (btn) btn.classList.add('ativo')
  fecharSidebar()
  if (pagina === 'clientes') renderClientes('')
  if (pagina === 'agendamentos') {
    const fd = document.getElementById('filtro-data')
    if (fd) { fd.value = ''; if (window.filtrarData) window.filtrarData() }
  }
  const titulos = {
    dashboard:     ['Dashboard',           'Painel de controle do seu negócio'],
    agendamentos:  ['Agendamentos',        'Lista completa de agendamentos'],
    clientes:      ['Clientes',            'Todos os seus clientes'],
    horarios:      ['Horários',            'Configure seus horários de atendimento'],
    lembretes:     ['Automação',           'Lembretes automáticos via WhatsApp'],
    whatsapp:      ['WhatsApp Auto',       'Configure o WhatsApp Business'],
    bio:           ['Minha Bio',           'Sua página pública para o Instagram'],
    configuracoes: ['Configurações',       'Serviços e aparência do painel'],
    pagamentos:    ['Pagamentos',          'Cobrança antecipada via Pix'],
    suporte:       ['Suporte',             'Estamos aqui para ajudar você'],
  }
  const t = titulos[pagina]
  if (t) {
    const el  = document.getElementById('topbar-page-title')
    const sub = document.getElementById('topbar-page-sub')
    if (el)  el.textContent  = t[0]
    if (sub) sub.textContent = t[1]
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
  const plano      = localStorage.getItem('plano') || 'trial'
  const assinatura = localStorage.getItem('assinaturaAtiva') === 'true'
  const badge      = document.getElementById('badge-plano')
  if (badge) {
    badge.textContent        = (plano === 'pro' && assinatura) ? 'Plano Pro' : 'Plano Trial'
    badge.style.background   = (plano === 'pro' && assinatura) ? '#2563eb' : '#f59e0b'
    badge.style.color        = '#fff'
    badge.style.padding      = '4px 12px'
    badge.style.borderRadius = '100px'
    badge.style.fontSize     = '12px'
    badge.style.fontWeight   = '600'
  }
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
  const plano      = localStorage.getItem('plano') || 'trial'
  const assinatura = localStorage.getItem('assinaturaAtiva') === 'true'
  if (plano !== 'pro' || !assinatura) {
    erro.textContent = 'Faça upgrade para o plano Pro para criar mais painéis'
    return
  }
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
  carregarInsights()
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

  const hoje   = new Date().toISOString().split('T')[0]
  const semana = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  document.getElementById('stat-hoje').textContent   = todosAgendamentos.filter(a => a.data === hoje).length
  document.getElementById('stat-semana').textContent = todosAgendamentos.filter(a => a.data >= hoje && a.data <= semana).length

  seedLucroDoMes(todosAgendamentos)
  exibirLucro()
  renderHistorico()
  filtrarData()
  atualizarInsights()

  // Badge sino
  const dot = document.getElementById('notif-dot')
  if (dot) dot.style.display = todosAgendamentos.filter(a => a.data === hoje).length > 0 ? 'block' : 'none'
}

/* ── Tabela / paginação ── */
const POR_PAGINA = 8
let paginaAtual   = 1
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
  const wrap      = document.getElementById('tbody-rows')
  const cards     = document.getElementById('ag-cards')
  const paginacao = document.getElementById('paginacao')

  if (!listaFiltrada.length) {
    if (wrap)  wrap.innerHTML  = '<div class="vazio">Nenhum agendamento encontrado</div>'
    if (cards) cards.innerHTML = '<div class="vazio">Nenhum agendamento encontrado</div>'
    if (paginacao) paginacao.style.display = 'none'
    return
  }

  const total  = Math.ceil(listaFiltrada.length / POR_PAGINA)
  const inicio = (paginaAtual - 1) * POR_PAGINA
  const fim    = inicio + POR_PAGINA
  const slice  = listaFiltrada.slice(inicio, fim)

  if (wrap)  wrap.innerHTML  = renderizarLinhasComAvatar(slice)
  if (cards) {
    cards.innerHTML = slice.map(a => {
      const [c1,c2] = avatarColor(a.pacienteNome)
      const ini = (a.pacienteNome||'C')[0].toUpperCase()
      const acoes = a.status === 'confirmado'
        ? `<div class="ag-card-actions">
             <button class="btn-acao concluir" onclick="atualizar('${a._id}','concluido')">Concluir</button>
             <button class="btn-acao cancelar" onclick="cancelarComAviso('${a._id}','${a.pacienteNome}','${a.pacienteTelefone}','${a.data}','${a.hora}')">Cancelar</button>
           </div>` : ''
      return `<div class="ag-card">
        <div class="ag-card-top">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="ag-avatar" style="background:linear-gradient(135deg,${c1},${c2});width:32px;height:32px;font-size:11px;flex-shrink:0">${ini}</div>
            <div><div class="ag-card-nome">${a.pacienteNome}</div><div class="paciente-tel">${a.pacienteTelefone||''}</div></div>
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
  }

  if (paginacao) {
    document.getElementById('pg-info').textContent =
      `${inicio+1}–${Math.min(fim,listaFiltrada.length)} de ${listaFiltrada.length}`
    let btns = `<button class="pg-btn" onclick="irPagina(${paginaAtual-1})" ${paginaAtual===1?'disabled':''}>‹</button>`
    for (let i=1;i<=total;i++) {
      if (total<=7||i===1||i===total||Math.abs(i-paginaAtual)<=1)
        btns += `<button class="pg-btn ${i===paginaAtual?'ativo':''}" onclick="irPagina(${i})">${i}</button>`
      else if (Math.abs(i-paginaAtual)===2)
        btns += `<span style="color:var(--text3);font-size:13px;padding:0 2px">…</span>`
    }
    btns += `<button class="pg-btn" onclick="irPagina(${paginaAtual+1})" ${paginaAtual===total?'disabled':''}>›</button>`
    document.getElementById('pg-btns').innerHTML = btns
    paginacao.style.display = total > 1 ? 'flex' : 'none'
  }

  setTimeout(() => { atualizarInsights(); renderDashboardHoje() }, 100)
}

function irPagina(n) {
  const total = Math.ceil(listaFiltrada.length / POR_PAGINA)
  if (n < 1 || n > total) return
  paginaAtual = n
  renderTabela()
}

function avatarColor(nome) {
  const colors = [
    ['#1d4ed8','#3b82f6'],['#7c3aed','#8b5cf6'],['#0e7490','#06b6d4'],
    ['#15803d','#22c55e'],['#b45309','#f59e0b'],['#be185d','#ec4899'],
    ['#0369a1','#38bdf8'],['#6d28d9','#a78bfa'],
  ]
  let h = 0
  for (let c of (nome || 'A')) h = ((h << 5) - h) + c.charCodeAt(0)
  return colors[Math.abs(h) % colors.length]
}

function renderizarLinhasComAvatar(slice) {
  return slice.map(a => {
    const ini = (a.pacienteNome || 'C')[0].toUpperCase()
    const [c1, c2] = avatarColor(a.pacienteNome)
    const isOnline = a.status === 'confirmado'
    const acoes = a.status === 'confirmado'
      ? `<div class="acoes">
           <button class="btn-acao concluir" onclick="atualizar('${a._id}','concluido')">Concluir</button>
           <button class="btn-acao cancelar" onclick="cancelarComAviso('${a._id}','${a.pacienteNome}','${a.pacienteTelefone}','${a.data}','${a.hora}')">Cancelar</button>
         </div>` : ''
    const preco = a.preco ? `R$${Number(a.preco).toFixed(2).replace('.',',')}` : '—'
    return `<div class="ag-row">
      <div class="ag-avatar" style="background:linear-gradient(135deg,${c1},${c2})">
        ${ini}${isOnline ? '<div class="ag-avatar-online"></div>' : ''}
      </div>
      <div class="ag-info">
        <div class="ag-nome">${a.pacienteNome}</div>
        <div class="ag-servico">${a.servico}</div>
      </div>
      <div class="ag-time">
        <div class="ag-hora">às ${a.hora}</div>
        <div class="ag-data">${a.data ? formatarData(a.data) : ''}</div>
      </div>
      <span class="badge ${a.status}">${a.status}</span>
      <div class="ag-preco">${preco}</div>
      ${acoes}
    </div>`
  }).join('')
}

function renderDashboardHoje() {
  const ags   = todosAgendamentos || []
  const hoje  = new Date().toISOString().split('T')[0]
  const deHoje = ags.filter(a => a.data === hoje).sort((a,b) => a.hora.localeCompare(b.hora))
  const wrap  = document.getElementById('tbody-rows-dash')
  const cards = document.getElementById('ag-cards-dash')
  if (!deHoje.length) {
    if (wrap)  wrap.innerHTML  = '<div class="vazio">Nenhum agendamento hoje</div>'
    if (cards) cards.innerHTML = '<div class="vazio">Nenhum agendamento hoje</div>'
    return
  }
  if (wrap)  wrap.innerHTML = renderizarLinhasComAvatar(deHoje)
  if (cards) {
    cards.innerHTML = deHoje.map(a => {
      const [c1,c2] = avatarColor(a.pacienteNome)
      const ini = (a.pacienteNome||'C')[0].toUpperCase()
      const acoes = a.status === 'confirmado'
        ? `<div class="ag-card-actions">
             <button class="btn-acao concluir" onclick="atualizar('${a._id}','concluido')">Concluir</button>
             <button class="btn-acao cancelar" onclick="cancelarComAviso('${a._id}','${a.pacienteNome}','${a.pacienteTelefone}','${a.data}','${a.hora}')">Cancelar</button>
           </div>` : ''
      return `<div class="ag-card">
        <div class="ag-card-top">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="ag-avatar" style="background:linear-gradient(135deg,${c1},${c2});width:32px;height:32px;font-size:11px;flex-shrink:0">${ini}</div>
            <div><div class="ag-card-nome">${a.pacienteNome}</div><div class="paciente-tel">${a.pacienteTelefone||''}</div></div>
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
  }
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
  atualizarInsights()
  renderDashboardHoje()
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
    .map(s => { const n = typeof s === 'object' ? s.nome : s; return `<option value="${n}">${n}</option>` }).join('')
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
  if (!nome) { erroEl.textContent = '⚠ Digite o nome do serviço.'; nomeInput.classList.add('campo-erro'); nomeInput.focus(); return }
  if (!precoInput.value.trim() || isNaN(preco) || preco <= 0) { erroEl.textContent = '⚠ O preço é obrigatório e deve ser maior que R$ 0,00.'; precoInput.classList.add('campo-erro'); precoInput.focus(); return }
  if (servicosAtuais.some(s => (typeof s === 'object' ? s.nome : s).toLowerCase() === nome.toLowerCase())) { erroEl.textContent = '⚠ Já existe um serviço com esse nome.'; nomeInput.classList.add('campo-erro'); nomeInput.focus(); return }
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
 
    return `<div class="servico-intervalo-card">
      <div class="servico-intervalo-info">
        <div class="servico-intervalo-nome">${nome}</div>
        ${precoLabel ? `<div class="servico-intervalo-preco">${precoLabel}</div>` : ''}
      </div>
      <select class="servico-intervalo-select" data-servico="${nome}" onchange="alterarIntervaloServico(this)">${opcoesHtml}</select>
      <div class="servico-intervalo-actions">
        <div class="servico-intervalo-act-btn edit" title="Editar" onclick="alert('Para editar o serviço, vá em Configurações.')">
          <svg width="12" height="12" viewBox="0 0 15 15" fill="none"><path d="M10.5 2.5l2 2-8 8H2.5v-2l8-8Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
        </div>
        <div class="servico-intervalo-act-btn" title="Remover" onclick="removerServico(${servicosAtuais.indexOf(s)})">
          <svg width="12" height="12" viewBox="0 0 15 15" fill="none"><path d="M2.5 4h10M5 4V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1M6 7v4M9 7v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.5 4l.5 8a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1l.5-8" stroke="currentColor" stroke-width="1.3"/></svg>
        </div>
      </div>
    </div>`
  }).join('')
 
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
 
/* ── ADICIONE esta função (nova, não existe no original) ── */
function renderHorariosDiasLateral() {
  const diasNomesLateral = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo']
  const diasIndices = [1,2,3,4,5,6,0]
  const container = document.getElementById('horarios-dias-lista')
  if (!container) return
  container.innerHTML = diasIndices.map((idx, i) => {
    const cfg = horariosConfig[idx] || { ativo: false, inicio: '09:00', fim: '18:00' }
    const ativo = cfg.ativo
    return `<div class="horarios-dia-row">
      <span class="horarios-dia-nome">${diasNomesLateral[i]}</span>
      <div class="horarios-dia-right">
        ${ativo
          ? `<span class="horarios-dia-horas">${cfg.inicio} - ${cfg.fim}</span>`
          : `<span class="horarios-dia-fechado">Fechado</span>`
        }
        <div class="horarios-dia-toggle ${ativo ? 'on' : 'off'}" onclick="toggleDiaLateral(${idx}, this)">
          <div class="horarios-dia-toggle-thumb"></div>
        </div>
      </div>
    </div>`
  }).join('')
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
      document.getElementById('bio-foto').value           = data.url
      document.getElementById('foto-status').textContent  = '✓ Foto enviada!'
      document.getElementById('foto-preview').innerHTML   = `<img src="${data.url}">`
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
  localStorage.setItem('plano', data.plano || 'trial')
  localStorage.setItem('assinaturaAtiva', data.assinaturaAtiva ? 'true' : 'false')
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
   INSIGHTS
═══════════════════════════════════════════════════ */
function atualizarInsights() {
  const ags = todosAgendamentos || []
  if (!ags.length) return

  const freqHora = {}
  ags.forEach(a => { if (a.hora) freqHora[a.hora] = (freqHora[a.hora] || 0) + 1 })
  const topHora = Object.entries(freqHora).sort((a,b) => b[1]-a[1])[0]
  const elH = document.getElementById('insight-melhor-horario')
  if (elH) elH.textContent = topHora ? topHora[0] : 'Sem dados'

  const freqServ = {}
  ags.forEach(a => {
    if (!a.servico) return
    if (!freqServ[a.servico]) freqServ[a.servico] = { total:0, qtd:0 }
    freqServ[a.servico].total += Number(a.preco) || 0
    freqServ[a.servico].qtd  += 1
  })
  const topServ = Object.entries(freqServ).sort((a,b) => b[1].total - a[1].total)[0]
  const elST = document.getElementById('insight-servico-top')
  const elSR = document.getElementById('insight-servico-receita')
  if (elST && topServ) {
    elST.textContent = topServ[0]
    if (elSR) elSR.textContent = topServ[1].total > 0
      ? `R$ ${topServ[1].total.toFixed(2).replace('.',',')} gerados`
      : `${topServ[1].qtd} agendamento${topServ[1].qtd > 1 ? 's' : ''}`
  }

  const cutoff = new Date(); cutoff.setDate(cutoff.getDate()-30)
  const cutStr = cutoff.toISOString().split('T')[0]
  const recentes = new Set(ags.filter(a => a.data >= cutStr).map(a => a.pacienteNome))
  const todos    = new Set(ags.map(a => a.pacienteNome))
  const inativos = [...todos].filter(c => !recentes.has(c)).length
  const elI  = document.getElementById('insight-inativos')
  const elIS = document.getElementById('insight-inativos-sub')
  if (elI)  elI.textContent  = inativos > 0 ? `${inativos} cliente${inativos > 1 ? 's' : ''}` : 'Nenhum'
  if (elIS) { elIS.textContent = inativos > 0 ? 'há mais de 30 dias' : 'todos ativos'; elIS.className = 'insight-item-sub' + (inativos > 0 ? ' warning' : '') }

  const banner = document.getElementById('alert-clientes-inativos')
  if (banner) banner.style.display = inativos >= 3 ? 'flex' : 'none'
  if (inativos >= 3) { const t = document.getElementById('alert-clientes-texto'); if (t) t.innerHTML = `<strong>${inativos} clientes estão inativos</strong>, mande uma promoção para reativá-los` }

  const hoje   = new Date().toISOString().split('T')[0]
  const semStr = (() => { const d = new Date(); d.setDate(d.getDate()-7); return d.toISOString().split('T')[0] })()
  const lucroSem = ags.filter(a => a.status === 'concluido' && a.data >= semStr && a.data <= hoje)
    .reduce((s,a) => s + (Number(a.preco)||0), 0)
  const elTotal = document.getElementById('stat-total')
  if (elTotal) elTotal.textContent = 'R$ ' + lucroSem.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})

  const mes = new Date().toISOString().slice(0,7)
  const nid = negocioAtual?._id
  const lucroMes = nid ? (parseFloat(localStorage.getItem(`lucro_val_${nid}_${mes}`))||0) : 0
  const atendMes = nid ? (()=>{ try{return JSON.parse(localStorage.getItem(`lucro_ids_${nid}_${mes}`)||'[]').length}catch{return 0} })() : 0
  const fv=document.getElementById('finance-amount-val')
  const fm=document.getElementById('finance-meta')
  const fa=document.getElementById('finance-atend')
  const fcl=document.getElementById('finance-chart-label')
  if(fv) fv.textContent=lucroMes.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})
  if(fm) fm.textContent=`Movidas: ${atendMes} agendamento${atendMes!==1?'s':''}`
  if(fa) fa.textContent=atendMes
  if(fcl) fcl.textContent=`R$${Math.round(lucroMes)}`
}

async function carregarInsights() {
  if (!negocioAtual) return
  const token = localStorage.getItem('token')
  try {
    const res  = await fetch(`${API}/agendamentos/insights?negocioId=${negocioAtual._id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!res.ok) return
    const data = await res.json()
    const elMelhor = document.getElementById('insight-melhor-horario')
    if (elMelhor) elMelhor.textContent = data.melhorAgendamento || '—'
    const elServico = document.getElementById('insight-servico-top')
    const elReceita = document.getElementById('insight-servico-receita')
    if (data.topServico) {
      if (elServico) elServico.textContent = data.topServico.nome
      if (elReceita) elReceita.textContent = `+R$${data.topServico.receita.toFixed(0)} no mês`
    }
    const fin = data.finance || {}
    const elAmount = document.getElementById('finance-amount-val')
    const elMeta   = document.getElementById('finance-meta')
    const elAtend  = document.getElementById('finance-atend')
    const elChartL = document.getElementById('finance-chart-label')
    const elTotal  = document.getElementById('stat-total')
    if (elAmount) elAmount.textContent = (fin.lucroMes||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})
    if (elMeta)   elMeta.textContent   = `Movidas: ${fin.atendMes||0} agendamentos`
    if (elAtend)  elAtend.textContent  = fin.atendMes||0
    if (elChartL) elChartL.textContent = `R$${Math.round(fin.lucroMes||0)}`
    if (elTotal)  elTotal.textContent  = 'R$ ' + (fin.lucroSemana||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})
    if (fin.historicoMeses?.length && negocioAtual) {
      fin.historicoMeses.forEach(({ mes, lucro, atendimentos }) => {
        localStorage.setItem(`lucro_val_${negocioAtual._id}_${mes}`, String(lucro))
        if (mes !== mesAtualChave() || getLucroIds(negocioAtual._id).length === 0) {
          const fakeIds = Array.from({ length: atendimentos }, (_, i) => `hist_${mes}_${i}`)
          localStorage.setItem(`lucro_ids_${negocioAtual._id}_${mes}`, JSON.stringify(fakeIds))
        }
      })
      renderHistorico()
    }
  } catch (err) {
    console.error('Erro ao carregar insights:', err.message)
  }
}

/* ═══════════════════════════════════════════════════
   CLIENTES
═══════════════════════════════════════════════════ */
function renderClientes(filtro) {
  const ags = todosAgendamentos || []
  const mapa = {}
  ags.forEach(a => {
    const nome = a.pacienteNome
    if (!nome) return
    if (!mapa[nome]) mapa[nome] = { nome, telefone: a.pacienteTelefone || '', servicos: new Set(), total: 0, atendimentos: 0, ultimaVisita: a.data || '' }
    mapa[nome].servicos.add(a.servico)
    if (a.status === 'concluido') { mapa[nome].total += Number(a.preco) || 0; mapa[nome].atendimentos += 1 }
    if (a.data > mapa[nome].ultimaVisita) mapa[nome].ultimaVisita = a.data
  })
  let lista = Object.values(mapa).sort((a,b) => b.ultimaVisita.localeCompare(a.ultimaVisita))
  if (filtro && filtro.trim()) {
    const t = filtro.toLowerCase()
    lista = lista.filter(c => c.nome.toLowerCase().includes(t) || c.telefone.includes(t))
  }
  const container = document.getElementById('clientes-lista')
  if (!container) return
  if (!lista.length) { container.innerHTML = '<div class="vazio">Nenhum cliente encontrado</div>'; return }
  container.innerHTML = lista.map(c => {
    const [c1,c2] = avatarColor(c.nome)
    const ini = c.nome[0].toUpperCase()
    const dataFmt = c.ultimaVisita ? c.ultimaVisita.split('-').reverse().join('/') : '—'
    const total = c.total > 0 ? `R$ ${c.total.toFixed(2).replace('.',',')}` : '—'
    const tel = c.telefone
    const wppLink = tel ? `https://wa.me/55${tel.replace(/\D/g,'')}?text=${encodeURIComponent(`Olá ${c.nome}! 😊`)}` : null
    return `<div class="ag-row">
      <div class="ag-avatar" style="background:linear-gradient(135deg,${c1},${c2})">${ini}</div>
      <div class="ag-info">
        <div class="ag-nome">${c.nome}</div>
        <div class="ag-servico">${[...c.servicos].slice(0,2).join(', ')}</div>
      </div>
      <div class="ag-time">
        <div class="ag-hora" style="font-size:11px;font-weight:500;color:var(--text2)">Última visita</div>
        <div class="ag-data">${dataFmt}</div>
      </div>
      <div style="min-width:60px;text-align:right">
        <div style="font-size:10px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.05em">Gasto total</div>
        <div style="font-size:13px;font-weight:700;color:var(--green)">${total}</div>
      </div>
      <div style="min-width:50px;text-align:center">
        <div style="font-size:10px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.05em">Visitas</div>
        <div style="font-size:15px;font-weight:800;color:var(--text)">${c.atendimentos}</div>
      </div>
      ${wppLink ? `<a href="${wppLink}" target="_blank"
        style="display:flex;align-items:center;gap:5px;background:var(--green-bg);color:var(--green);border:1px solid var(--green-border);border-radius:7px;padding:5px 10px;font-size:11.5px;font-weight:700;text-decoration:none;white-space:nowrap;transition:all .15s"
        onmouseover="this.style.background='var(--green)';this.style.color='white'"
        onmouseout="this.style.background='var(--green-bg)';this.style.color='var(--green)'">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.852L.057 23.885l6.204-1.628A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.808 9.808 0 0 1-5.001-1.366l-.359-.213-3.682.966.983-3.594-.234-.371A9.818 9.818 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/></svg>
        WhatsApp
      </a>` : '<div style="width:80px"></div>'}
    </div>`
  }).join('')
}
function filtrarClientes(v) { renderClientes(v) }

/* ═══════════════════════════════════════════════════
   BUSCA GLOBAL — implementação única
═══════════════════════════════════════════════════ */
let buscaAberta = false

function abrirBusca() {
  const overlay = document.getElementById('busca-overlay')
  if (!overlay) return
  overlay.classList.add('aberta')
  buscaAberta = true
  const inp = document.getElementById('busca-input')
  if (inp) {
    inp.value = ''
    setTimeout(() => { inp.focus(); executarBusca('') }, 60)
  }
}

function fecharBusca() {
  const overlay = document.getElementById('busca-overlay')
  if (overlay) overlay.classList.remove('aberta')
  buscaAberta = false
}

function executarBusca(q) {
  const res = document.getElementById('busca-resultados')
  if (!res) return
  const ags = todosAgendamentos || []

  if (!q || !q.trim()) {
    const hoje   = new Date().toISOString().split('T')[0]
    const deHoje = ags.filter(a => a.data === hoje).slice(0, 6)
    if (!deHoje.length) {
      res.innerHTML = '<div style="text-align:center;color:var(--text3);padding:28px;font-size:13px">Digite para buscar por nome, serviço ou data</div>'
      return
    }
    res.innerHTML = '<div class="busca-secao-label">Agendamentos de hoje</div>' + deHoje.map(buscaItemHTML).join('')
    return
  }

  const termo = q.toLowerCase().trim()
  const encontrados = ags.filter(a =>
    (a.pacienteNome     || '').toLowerCase().includes(termo) ||
    (a.servico          || '').toLowerCase().includes(termo) ||
    (a.data             || '').includes(termo) ||
    (a.hora             || '').includes(termo) ||
    (a.pacienteTelefone || '').includes(termo)
  ).slice(0, 12)

  if (!encontrados.length) {
    res.innerHTML = `<div style="text-align:center;color:var(--text3);padding:28px;font-size:13px">Nenhum resultado para "<strong>${q}</strong>"</div>`
    return
  }

  res.innerHTML =
    `<div class="busca-secao-label">${encontrados.length} resultado${encontrados.length > 1 ? 's' : ''}</div>` +
    encontrados.map(buscaItemHTML).join('')
}

function buscaItemHTML(a) {
  const [c1,c2]   = avatarColor(a.pacienteNome)
  const ini       = (a.pacienteNome || 'C')[0].toUpperCase()
  const dataFmt   = a.data ? a.data.split('-').reverse().join('/') : ''
  const preco     = a.preco ? ` · R$${Number(a.preco).toFixed(2).replace('.',',')}` : ''
  const statusCor = { confirmado:'#10b981', concluido:'#8b5cf6', cancelado:'#ef4444', pendente:'#f59e0b' }[a.status] || '#8b9ab4'
  return `<div class="busca-item" onclick="buscaSelecionarAgendamento('${a._id}','${a.data||''}')">
    <div class="busca-avatar-mini" style="background:linear-gradient(135deg,${c1},${c2})">${ini}</div>
    <div class="busca-item-info">
      <div class="busca-item-nome">${a.pacienteNome}</div>
      <div class="busca-item-sub">${a.servico} · ${dataFmt} às ${a.hora}${preco}</div>
    </div>
    <span class="busca-item-badge" style="background:${statusCor}22;color:${statusCor};border:1px solid ${statusCor}44">${a.status}</span>
  </div>`
}

function buscaSelecionarAgendamento(id, data) {
  fecharBusca()
  const filtroEl = document.getElementById('filtro-data')
  if (filtroEl && data) { filtroEl.value = data; if (window.filtrarData) window.filtrarData() }
  irPara('agendamentos', document.getElementById('menu-agendamentos'))
}

/* Atalhos de teclado da busca */
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); buscaAberta ? fecharBusca() : abrirBusca() }
  if (e.key === 'Escape' && buscaAberta) fecharBusca()
})

/* ═══════════════════════════════════════════════════
   TOPBAR — notificações, mensagens, avatar
═══════════════════════════════════════════════════ */
function abrirNotificacoes() {
  fecharTodosDropdowns()
  const panel = document.getElementById('notif-panel')
  if (!panel) return
  renderNotificacoes()
  panel.classList.add('aberto')
}

function renderNotificacoes() {
  const panel = document.getElementById('notif-panel')
  if (!panel) return
  const ags     = todosAgendamentos || []
  const hoje    = new Date().toISOString().split('T')[0]
  const deHoje  = ags.filter(a => a.data === hoje).sort((a,b) => a.hora.localeCompare(b.hora))
  const proximos = ags.filter(a => a.data > hoje && a.status === 'confirmado').slice(0, 3)
  const total   = deHoje.length + proximos.length
  let html = `<div class="notif-header"><span class="notif-title">Notificações</span>${total > 0 ? `<span class="notif-badge">${total}</span>` : ''}</div><div class="notif-body">`
  if (!deHoje.length && !proximos.length) html += `<div class="notif-vazio">Sem agendamentos próximos</div>`
  if (deHoje.length) {
    html += `<div class="busca-secao-label" style="padding:12px 18px 6px">Hoje (${deHoje.length})</div>`
    html += deHoje.slice(0,5).map(a => {
      const cor = {confirmado:'blue',concluido:'green',cancelado:'red',pendente:'yellow'}[a.status]||'blue'
      const svgMap = {
        blue:  `<svg width="14" height="14" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="5.5" stroke="#3b82f6" stroke-width="1.4"/><path d="M7.5 4.5V8l2 2" stroke="#3b82f6" stroke-width="1.4" stroke-linecap="round"/></svg>`,
        green: `<svg width="14" height="14" viewBox="0 0 15 15" fill="none"><path d="M2 7l4 4L13 4" stroke="#10b981" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
        red:   `<svg width="14" height="14" viewBox="0 0 15 15" fill="none"><path d="M4 4l7 7M11 4l-7 7" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round"/></svg>`,
        yellow:`<svg width="14" height="14" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="5.5" stroke="#f59e0b" stroke-width="1.4"/><path d="M7.5 5v3M7.5 10v.5" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round"/></svg>`,
      }
      return `<div class="notif-item"><div class="notif-icon ${cor}">${svgMap[cor]}</div><div class="notif-item-texto"><div class="notif-item-titulo">${a.pacienteNome}</div><div class="notif-item-sub">${a.servico}</div><div class="notif-item-hora">às ${a.hora}</div></div></div>`
    }).join('')
  }
  if (proximos.length) {
    html += `<div class="busca-secao-label" style="padding:12px 18px 6px">Próximos</div>`
    html += proximos.map(a => {
      const dt = a.data ? a.data.split('-').reverse().join('/') : ''
      return `<div class="notif-item"><div class="notif-icon blue"><svg width="14" height="14" viewBox="0 0 15 15" fill="none"><rect x="1.5" y="2.5" width="12" height="11" rx="1.5" stroke="#3b82f6" stroke-width="1.3"/><path d="M5 1.5v2M10 1.5v2M1.5 5.5h12" stroke="#3b82f6" stroke-width="1.3" stroke-linecap="round"/></svg></div><div class="notif-item-texto"><div class="notif-item-titulo">${a.pacienteNome}</div><div class="notif-item-sub">${a.servico}</div><div class="notif-item-hora">${dt} às ${a.hora}</div></div></div>`
    }).join('')
  }
  html += `</div><div class="notif-ver-todos" onclick="irPara('agendamentos',document.getElementById('menu-agendamentos'));fecharTodosDropdowns()">Ver todos os agendamentos</div>`
  panel.innerHTML = html
  const dot = document.getElementById('notif-dot')
  if (dot) dot.style.display = deHoje.length > 0 ? 'block' : 'none'
}

function abrirMensagens() {
  fecharTodosDropdowns()
  const panel = document.getElementById('msg-panel')
  if (!panel) return
  const ags = todosAgendamentos || []
  const vistos = {}
  const cutoff = new Date(Date.now()-30*864e5).toISOString().split('T')[0]
  ags.filter(a => a.pacienteTelefone && a.data >= cutoff)
    .forEach(a => { if (!vistos[a.pacienteNome]) vistos[a.pacienteNome] = { nome: a.pacienteNome, tel: a.pacienteTelefone } })
  const lista = Object.values(vistos).slice(0, 8)
  const negNome = negocioAtual ? negocioAtual.nome : 'nosso negócio'
  let html = `<div class="msg-header"><span class="msg-title">Enviar mensagem</span></div><div class="msg-sub">Clientes recentes — abre WhatsApp</div>`
  if (!lista.length) {
    html += `<div class="msg-vazio">Nenhum cliente com telefone cadastrado</div>`
  } else {
    html += lista.map(c => {
      const [c1,c2] = avatarColor(c.nome)
      const ini = c.nome[0].toUpperCase()
      const tel = c.tel.replace(/\D/g,'')
      const msg = encodeURIComponent(`Olá ${c.nome}! Tudo bem? Aqui é da ${negNome}. 😊`)
      const link = `https://wa.me/55${tel}?text=${msg}`
      return `<div class="msg-item" onclick="window.open('${link}','_blank');fecharTodosDropdowns()">
        <div class="msg-avatar-mini" style="background:linear-gradient(135deg,${c1},${c2})">${ini}</div>
        <div class="msg-item-info"><div class="msg-item-nome">${c.nome}</div><div class="msg-item-tel">${c.tel}</div></div>
        <div class="msg-wpp-btn"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.852L.057 23.885l6.204-1.628A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.808 9.808 0 0 1-5.001-1.366l-.359-.213-3.682.966.983-3.594-.234-.371A9.818 9.818 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/></svg> WhatsApp</div>
      </div>`
    }).join('')
  }
  panel.innerHTML = html
  panel.classList.add('aberto')
}

function abrirAvatarMenu() {
  const menu = document.getElementById('avatar-menu')
  if (!menu) return
  const aberto = menu.classList.contains('aberto')
  fecharTodosDropdowns()
  if (!aberto) {
    const elNeg = document.getElementById('avatar-menu-negocio')
    const elAv  = document.getElementById('avatar-menu-avatar')
    if (negocioAtual) {
      if (elNeg) elNeg.textContent = negocioAtual.nome
      if (elAv)  elAv.textContent  = negocioAtual.nome[0].toUpperCase()
    }
    const tema = localStorage.getItem('tema') || 'escuro'
    const elTema = document.getElementById('avatar-menu-tema-label')
    if (elTema) elTema.textContent = tema === 'escuro' ? 'Mudar para claro' : 'Mudar para escuro'
    menu.classList.add('aberto')
  }
}

function fecharTodosDropdowns() {
  const notif  = document.getElementById('notif-panel')
  const msg    = document.getElementById('msg-panel')
  const avatar = document.getElementById('avatar-menu')
  if (notif)  notif.classList.remove('aberto')
  if (msg)    msg.classList.remove('aberto')
  if (avatar) avatar.classList.remove('aberto')
}
window.fecharTodosDropdowns = fecharTodosDropdowns

document.addEventListener('click', e => {
  if (!e.target.closest('#notif-panel') &&
      !e.target.closest('#msg-panel') &&
      !e.target.closest('#avatar-menu') &&
      !e.target.closest('.topbar-icon-btn') &&
      !e.target.closest('#topbar-avatar-btn')) {
    fecharTodosDropdowns()
  }
})

/* ═══════════════════════════════════════════════════
   PIX
═══════════════════════════════════════════════════ */
function atualizarPix() {
  const elPix = document.getElementById('finance-pix')
  if (!elPix) return
  const mes   = mesAtualChave()
  const doMes = todosAgendamentos.filter(a => a.data?.startsWith(mes))
  const pagos  = doMes.filter(a => a.pagamento?.status === 'pago').length
  const pct    = doMes.length > 0 ? Math.round((pagos / doMes.length) * 100) : 0
  elPix.textContent = `${pct}%`
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
═══════════════════════════════════════════════════ */
let deferredPrompt = null
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})

function isAppInstalled() {
  return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches
}
function atualizarBotaoInstalar() {
  const btn = document.getElementById('btn-instalar-app')
  if (btn && isAppInstalled()) btn.style.display = 'none'
}
atualizarBotaoInstalar()
document.addEventListener('visibilitychange', () => { if (!document.hidden) atualizarBotaoInstalar() })
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredPrompt = e
  const btn = document.getElementById('btn-instalar-app')
  if (btn) btn.style.display = ''
})
window.addEventListener('appinstalled', () => {
  deferredPrompt = null
  const btn = document.getElementById('btn-instalar-app')
  if (btn) btn.style.display = 'none'
})
document.getElementById('btn-instalar-app').onclick = function () {
  if (isAppInstalled()) { this.style.display = 'none'; return }
  if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt.userChoice.then(() => { deferredPrompt = null }) }
}

/* ═══════════════════════════════════════════════════
   LIGA BOTÕES DA TOPBAR após DOM pronto
═══════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const btnBusca  = document.querySelector('.main-topbar-search')
  const sinoBtn   = document.querySelectorAll('.topbar-icon-btn')[1]
  const envBtn    = document.querySelectorAll('.topbar-icon-btn')[2]
  const avatarBtn = document.getElementById('topbar-avatar-btn')

  if (btnBusca) btnBusca.addEventListener('click', abrirBusca)
  if (sinoBtn) {
    sinoBtn.onclick = abrirNotificacoes
    const dot = document.createElement('div')
    dot.id = 'notif-dot'
    dot.className = 'notif-dot-badge'
    dot.style.display = 'none'
    sinoBtn.appendChild(dot)
  }
  if (envBtn)    envBtn.onclick    = abrirMensagens
  if (avatarBtn) avatarBtn.onclick = e => { e.stopPropagation(); abrirAvatarMenu() }

  const isMac = navigator.platform.toUpperCase().includes('MAC')
  const searchSpan = document.querySelector('.main-topbar-search span')
  if (searchSpan) searchSpan.textContent = `Buscar... (${isMac ? '⌘K' : 'Ctrl+K'})`
})

function renderHorariosDiasLateral() {
  const diasNomesLateral = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo']
  const diasIndices = [1,2,3,4,5,6,0]
  const container = document.getElementById('horarios-dias-lista')
  if (!container) return
  container.innerHTML = diasIndices.map((idx, i) => {
    const cfg = horariosConfig[idx] || { ativo: false, inicio: '09:00', fim: '18:00' }
    const ativo = cfg.ativo
    return `<div class="horarios-dia-row">
      <span class="horarios-dia-nome">${diasNomesLateral[i]}</span>
      <div class="horarios-dia-right">
        ${ativo
          ? `<span class="horarios-dia-horas">${cfg.inicio} - ${cfg.fim}</span>`
          : `<span class="horarios-dia-fechado">Fechado</span>`
        }
        <div class="horarios-dia-toggle ${ativo ? 'on' : 'off'}" onclick="toggleDiaLateral(${idx}, this)">
          <div class="horarios-dia-toggle-thumb"></div>
        </div>
      </div>
    </div>`
  }).join('')
}
 
/* ── ADICIONE esta função auxiliar ── */
function toggleDiaLateral(idx, toggleEl) {
  const cfg = horariosConfig[idx] || { ativo: false, inicio: '09:00', fim: '18:00' }
  cfg.ativo = !cfg.ativo
  horariosConfig[idx] = cfg
  renderHorariosDiasLateral()
  /* Abre modal de gerenciar para o usuário salvar */
  abrirGerenciarDias()
}
 
/* ── ADICIONE estas funções do modal de dias ── */
function abrirGerenciarDias() {
  renderDias()
  document.getElementById('modal-gerenciar-dias').style.display = 'flex'
}
function fecharGerenciarDias() {
  document.getElementById('modal-gerenciar-dias').style.display = 'none'
}

/* ═══════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════ */
carregarTema()
const _token = localStorage.getItem('token')
if (_token) { mostrarPainel() } else { window.location.href = '/auth.html' }

(function() {
 
  let tipoSelecionado = '24h';
 
  const mensagensAuto = {
    '24h':        'Olá {nome}! 👋\nLembramos que você tem um agendamento amanhã, {data}, às {hora} — {servico}.\nEstamos te esperando! 🙏',
    '1h':         'Olá {nome}! ⏰\nSeu agendamento é em 1 hora — {hora}. Serviço: {servico}.\nTe esperamos em breve! 😊',
    'pos':        'Olá {nome}! 🙏\nObrigado por nos visitar hoje! Foi um prazer te atender.\nAgende seu próximo horário: {link}',
    'aniversario':'Feliz aniversário, {nome}! 🎉\nA equipe da {negocio} deseja tudo de melhor para você!\nTemos um presente especial esperando por você. 🎁',
  };
 
  const titulos = {
    '24h':        'Editar lembrete 24h antes',
    '1h':         'Editar lembrete 1h antes',
    'pos':        'Editar mensagem pós-atendimento',
    'aniversario':'Editar mensagem de aniversário',
  };
 
  window.selecionarTipoAuto = function(tipo, card) {
    tipoSelecionado = tipo;
    document.querySelectorAll('.auto-tipo-card').forEach(c => c.classList.remove('ativo-selected'));
    card.classList.add('ativo-selected');
 
    const headerTitle = document.querySelector('.auto-editor-header-title');
    if (headerTitle) headerTitle.textContent = titulos[tipo] || 'Editar mensagem';
 
    const textarea = document.getElementById('auto-mensagem-textarea');
    if (textarea) {
      textarea.value = mensagensAuto[tipo] || '';
      atualizarPreviewAuto();
    }
 
    // Sync toggle do editor com o toggle do card
    const toggleCard = document.getElementById('toggle-' + tipo);
    const toggleEditor = document.getElementById('toggle-editor-main');
    const labelAtivo = document.querySelector('.auto-ativo-label');
    if (toggleCard && toggleEditor) {
      const isOn = toggleCard.classList.contains('on');
      toggleEditor.className = 'auto-tipo-toggle ' + (isOn ? 'on' : 'off');
      if (labelAtivo) {
        labelAtivo.textContent = isOn ? 'Ativo' : 'Inativo';
        labelAtivo.style.color = isOn ? '#34d399' : 'var(--text3)';
      }
    }
  };
 
  window.toggleAutoTipo = function(tipo, toggleEl) {
    const isOn = toggleEl.classList.contains('on');
    toggleEl.className = 'auto-tipo-toggle ' + (isOn ? 'off' : 'on');
    const thumb = toggleEl.querySelector('.auto-tipo-toggle-thumb');
    if (thumb) {} // CSS handles it
 
    // Atualizar badge
    const card = toggleEl.closest('.auto-tipo-card');
    if (card) {
      const badge = card.querySelector('.auto-tipo-badge');
      if (badge) {
        badge.textContent = isOn ? 'Inativo' : 'Ativo';
        badge.className = 'auto-tipo-badge ' + (isOn ? 'inativo' : 'ativo');
      }
    }
 
    // Sync com editor se for o tipo selecionado
    if (tipo === tipoSelecionado) {
      const toggleEditor = document.getElementById('toggle-editor-main');
      const labelAtivo   = document.querySelector('.auto-ativo-label');
      if (toggleEditor) toggleEditor.className = 'auto-tipo-toggle ' + (isOn ? 'off' : 'on');
      if (labelAtivo) {
        labelAtivo.textContent = isOn ? 'Inativo' : 'Ativo';
        labelAtivo.style.color = isOn ? 'var(--text3)' : '#34d399';
      }
    }
  };
 
  window.toggleEditorMain = function(toggleEl) {
    const isOn = toggleEl.classList.contains('on');
    toggleEl.className = 'auto-tipo-toggle ' + (isOn ? 'off' : 'on');
    const labelAtivo = document.querySelector('.auto-ativo-label');
    if (labelAtivo) {
      labelAtivo.textContent = isOn ? 'Inativo' : 'Ativo';
      labelAtivo.style.color = isOn ? 'var(--text3)' : '#34d399';
    }
    // Sync card toggle
    const cardToggle = document.getElementById('toggle-' + tipoSelecionado);
    if (cardToggle) {
      cardToggle.className = 'auto-tipo-toggle ' + (isOn ? 'off' : 'on');
      const card = cardToggle.closest('.auto-tipo-card');
      if (card) {
        const badge = card.querySelector('.auto-tipo-badge');
        if (badge) {
          badge.textContent = isOn ? 'Inativo' : 'Ativo';
          badge.className = 'auto-tipo-badge ' + (isOn ? 'inativo' : 'ativo');
        }
      }
    }
  };
 
  window.inserirVarAuto = function(variavel) {
    const ta = document.getElementById('auto-mensagem-textarea');
    if (!ta) return;
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const val   = ta.value;
    ta.value = val.substring(0, start) + variavel + val.substring(end);
    ta.selectionStart = ta.selectionEnd = start + variavel.length;
    ta.focus();
    atualizarPreviewAuto();
  };
 
  window.atualizarPreviewAuto = function() {
    const ta      = document.getElementById('auto-mensagem-textarea');
    const bubble  = document.getElementById('auto-preview-bubble');
    if (!ta || !bubble) return;
 
    const negNome = (window.negocioAtual && window.negocioAtual.nome) ? window.negocioAtual.nome : 'sua empresa';
 
    let txt = ta.value
      .replace(/\{nome\}/g,    'Carlos')
      .replace(/\{data\}/g,    '23/05')
      .replace(/\{hora\}/g,    '15:00')
      .replace(/\{servico\}/g, 'Barba')
      .replace(/\{negocio\}/g, negNome)
      .replace(/\{link\}/g,    'agendorapido.com.br/...');
 
    const linhas = txt.split('\n').map(l => l || '<br>').join('<br>');
    bubble.innerHTML = linhas + `
      <div class="auto-wpp-bubble-time">
        10:30
        <svg width="14" height="10" viewBox="0 0 16 11" fill="none">
          <path d="M1 5.5l3.5 3.5L9 2M7 5.5l3.5 3.5L15 2" stroke="#4fc3f7" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>`;
  };
 
  window.salvarAutomacao = function() {
    const ta  = document.getElementById('auto-mensagem-textarea');
    const msg = ta ? ta.value : '';
    const isOn = document.getElementById('toggle-editor-main')?.classList.contains('on');
 
    if (!window.negocioAtual) return;
    const token = localStorage.getItem('token');
    fetch(`${window.API || 'https://agendafacil-wf3q.onrender.com/api'}/auth/lembretes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ negocioId: window.negocioAtual._id, ativo: isOn, mensagem: msg }),
    }).then(() => {
      const btn = document.querySelector('.auto-btn-salvar');
      if (btn) {
        const orig = btn.innerHTML;
        btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L12 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> Salvo!';
        setTimeout(() => btn.innerHTML = orig, 2000);
      }
    }).catch(() => {});
  };
 
  window.enviarTesteAuto = function() {
    const btn = document.querySelector('.auto-btn-teste');
    if (!btn) return;
    const orig = btn.innerHTML;
    btn.innerHTML = '✓ Teste enviado!';
    btn.style.color = '#34d399';
    setTimeout(() => { btn.innerHTML = orig; btn.style.color = ''; }, 2500);
  };
 
  // Carregar configuração existente ao trocar de negócio
  const _origCarregarLembretes = window.carregarLembretes;
  window.carregarLembretes = async function() {
    if (_origCarregarLembretes) await _origCarregarLembretes.apply(this, arguments);
    // Sync toggle do editor com o estado real
    const checkbox = document.getElementById('toggle-lembrete');
    const toggleEditor = document.getElementById('toggle-editor-main');
    const labelAtivo   = document.querySelector('.auto-ativo-label');
    const toggle24h    = document.getElementById('toggle-24h');
    if (checkbox && toggleEditor) {
      const isOn = checkbox.checked;
      toggleEditor.className = 'auto-tipo-toggle ' + (isOn ? 'on' : 'off');
      if (labelAtivo) {
        labelAtivo.textContent = isOn ? 'Ativo' : 'Inativo';
        labelAtivo.style.color = isOn ? '#34d399' : 'var(--text3)';
      }
      if (toggle24h) {
        toggle24h.className = 'auto-tipo-toggle ' + (isOn ? 'on' : 'off');
        const card = toggle24h.closest('.auto-tipo-card');
        if (card) {
          const badge = card.querySelector('.auto-tipo-badge');
          if (badge) {
            badge.textContent = isOn ? 'Ativo' : 'Inativo';
            badge.className = 'auto-tipo-badge ' + (isOn ? 'ativo' : 'inativo');
          }
        }
      }
    }
    // Carregar mensagem salva
    const msgEl = document.getElementById('lembrete-msg');
    const taAuto = document.getElementById('auto-mensagem-textarea');
    if (msgEl && taAuto && msgEl.value) {
      taAuto.value = msgEl.value;
      atualizarPreviewAuto();
    }
  };
 
})();