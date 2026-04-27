;(function () {
 
  /* ── Estado ── */
  var agv2CalDate      = new Date()
  var agv2SelectedDate = new Date()
  var agv2ShowAll      = false
  var agv2SortAsc      = true
 
  /* ── Constantes ── */
  var MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  var DIAS  = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira',
               'Quinta-feira','Sexta-feira','Sábado']
  var COLORS_DONUT = ['#3b82f6','#10b981','#f59e0b','#8b5cf6']
  var MAX_ROWS = 6
 
  /* ── Helpers ── */
  function dateToStr(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0')
  }
 
  function fmtBRL(v) {
    return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
 
  function getAgs() {
    return (typeof todosAgendamentos !== 'undefined' ? todosAgendamentos : []) || []
  }
 
  /* ════════════════════════════════════════════════
     CALENDÁRIO
  ════════════════════════════════════════════════ */
  function agv2RenderCalendar() {
    var mes = agv2CalDate.getMonth()
    var ano = agv2CalDate.getFullYear()
    var el  = document.getElementById('agv2-cal-grid')
    var lbl = document.getElementById('agv2-cal-month')
    if (!el || !lbl) return
 
    lbl.textContent = MESES[mes] + ' ' + ano
 
    var primeiroDia = new Date(ano, mes, 1).getDay()
    var totalDias   = new Date(ano, mes + 1, 0).getDate()
    var diasMesAnt  = new Date(ano, mes, 0).getDate()
    var hojeStr     = dateToStr(new Date())
    var selStr      = dateToStr(agv2SelectedDate)
 
    /* Mapeia dots por data */
    var porData = {}
    getAgs().forEach(function (a) {
      if (!a.data) return
      if (!porData[a.data]) porData[a.data] = { c: 0, p: 0, x: 0 }
      var s = a.status
      if (s === 'confirmado' || s === 'concluido' || s === 'agendado') porData[a.data].c++
      else if (s === 'pendente') porData[a.data].p++
      else if (s === 'cancelado') porData[a.data].x++
    })
 
    var html = ''
 
    /* Dias do mês anterior */
    for (var i = primeiroDia - 1; i >= 0; i--) {
      var d = diasMesAnt - i
      html += '<div class="agv2-cal-day outro-mes" role="gridcell">' +
        '<span class="agv2-cal-day-num">' + d + '</span>' +
        '<div class="agv2-cal-dots"></div></div>'
    }
 
    /* Dias do mês atual */
    for (var d = 1; d <= totalDias; d++) {
      var ds  = ano + '-' + String(mes + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0')
      var cls = ''
      if (ds === hojeStr) cls = 'today'
      else if (ds === selStr) cls = 'selected'
 
      var dots = ''
      if (porData[ds]) {
        if (porData[ds].c) dots += '<span class="agv2-cal-dot confirmado"></span>'
        if (porData[ds].p) dots += '<span class="agv2-cal-dot pendente"></span>'
        if (porData[ds].x) dots += '<span class="agv2-cal-dot cancelado"></span>'
      }
 
      html += '<div class="agv2-cal-day ' + cls + '" onclick="agv2SelecionarDia(' + d + ')" role="gridcell" tabindex="0"' +
        ' onkeydown="if(event.key===\'Enter\')agv2SelecionarDia(' + d + ')">' +
        '<span class="agv2-cal-day-num">' + d + '</span>' +
        '<div class="agv2-cal-dots">' + dots + '</div></div>'
    }
 
    /* Completar células */
    var total = Math.ceil((primeiroDia + totalDias) / 7) * 7
    for (var j = 1; j <= total - primeiroDia - totalDias; j++) {
      html += '<div class="agv2-cal-day outro-mes" role="gridcell">' +
        '<span class="agv2-cal-day-num">' + j + '</span>' +
        '<div class="agv2-cal-dots"></div></div>'
    }
 
    el.innerHTML = html
  }
 
  /* ── Navegar mês ── */
  window.agv2CalPrev = function () {
    agv2CalDate.setDate(1)
    agv2CalDate.setMonth(agv2CalDate.getMonth() - 1)
    agv2RenderCalendar()
  }
  window.agv2CalNext = function () {
    agv2CalDate.setDate(1)
    agv2CalDate.setMonth(agv2CalDate.getMonth() + 1)
    agv2RenderCalendar()
  }
  window.agv2CalHoje = function () {
    agv2CalDate      = new Date()
    agv2SelectedDate = new Date()
    agv2ShowAll      = false
    agv2RenderCalendar()
    agv2RenderDia()
  }
  window.agv2SelecionarDia = function (dia) {
    agv2SelectedDate = new Date(agv2CalDate.getFullYear(), agv2CalDate.getMonth(), dia)
    agv2ShowAll = false
    agv2RenderCalendar()
    agv2RenderDia()
  }
 
  /* ════════════════════════════════════════════════
     LISTA DE AGENDAMENTOS DO DIA
  ════════════════════════════════════════════════ */
  function agv2RenderDia() {
    var dateStr = dateToStr(agv2SelectedDate)
    var ags = getAgs().filter(function (a) { return a.data === dateStr })
 
    /* Ordenar */
    ags = ags.slice().sort(function (a, b) {
      var r = (a.hora || '').localeCompare(b.hora || '')
      return agv2SortAsc ? r : -r
    })
 
    /* Atualizar cabeçalho */
    var titleEl = document.getElementById('agv2-day-title')
    var countEl = document.getElementById('agv2-day-count')
    if (titleEl) {
      titleEl.textContent = DIAS[agv2SelectedDate.getDay()] + ', ' +
        agv2SelectedDate.getDate() + ' de ' + MESES[agv2SelectedDate.getMonth()]
    }
    if (countEl) {
      countEl.textContent = ags.length + (ags.length === 1 ? ' agendamento' : ' agendamentos')
    }
 
    /* Atualizar range de datas no header */
    agv2AtualizarDateRange()
 
    var lista   = document.getElementById('agv2-list')
    var verMais = document.getElementById('agv2-ver-mais')
    if (!lista) return
 
    if (!ags.length) {
      lista.innerHTML = '<div class="agv2-empty">' +
        '<div class="agv2-empty-icon">📅</div>' +
        '<div>Nenhum agendamento para este dia</div></div>'
      if (verMais) verMais.style.display = 'none'
      return
    }
 
    var toShow = agv2ShowAll ? ags : ags.slice(0, MAX_ROWS)
    var hasMore = !agv2ShowAll && ags.length > MAX_ROWS
 
    lista.innerHTML = toShow.map(agv2RowHTML).join('')
    if (verMais) verMais.style.display = hasMore ? 'flex' : 'none'
  }
 
  function agv2RowHTML(a) {
    var nome       = a.pacienteNome || 'Cliente'
    var ini        = nome.trim()[0].toUpperCase()
    var cols       = (typeof avatarColor === 'function') ? avatarColor(nome) : ['#2563eb', '#3b82f6']
    var preco      = fmtBRL(a.preco || 0)
    var status     = a.status || 'pendente'
    var labelMap   = { confirmado:'Confirmado', pendente:'Pendente', cancelado:'Cancelado', concluido:'Concluído', agendado:'Agendado' }
    var statusLbl  = labelMap[status] || status
    var tel        = (a.pacienteTelefone || '').replace(/\D/g, '')
    var wppHref    = tel ? 'https://wa.me/55' + tel + '?text=' + encodeURIComponent('Olá ' + nome + '! 😊') : 'javascript:void(0)'
    var nomeSafe   = nome.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;')
    var telSafe    = (a.pacienteTelefone || '').replace(/'/g, "\\'")
    var id         = a._id || ''
 
    var dropItems = ''
    if (status === 'confirmado') {
      dropItems +=
        '<div class="agv2-ag-drop-item" onclick="agv2Concluir(\'' + id + '\')">' +
        '<svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L12 4" stroke="#34d399" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> Concluir</div>' +
        '<div class="agv2-ag-drop-item danger" onclick="agv2Cancelar(\'' + id + '\',\'' + nomeSafe + '\',\'' + telSafe + '\',\'' + (a.data || '') + '\',\'' + (a.hora || '') + '\')">' +
        '<svg width="13" height="13" viewBox="0 0 15 15" fill="none"><path d="M4 4l7 7M11 4l-7 7" stroke="#f87171" stroke-width="1.5" stroke-linecap="round"/></svg> Cancelar</div>'
    }
    dropItems +=
      '<div class="agv2-ag-drop-item" onclick="agv2Wpp(\'' + tel + '\',\'' + nomeSafe + '\')">' +
      '<svg width="13" height="13" viewBox="0 0 24 24" fill="#25d366"><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.852L.057 23.885l6.204-1.628A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg> WhatsApp</div>'
 
    return [
      '<div class="agv2-ag-row" role="listitem">',
        '<div class="agv2-ag-indicator ' + status + '"></div>',
        '<div class="agv2-ag-time">' + (a.hora || '—') + '</div>',
        '<div class="agv2-ag-avatar" style="background:linear-gradient(135deg,' + cols[0] + ',' + cols[1] + ')">' + ini + '</div>',
        '<div class="agv2-ag-info">',
          '<div class="agv2-ag-name">' + nome + '</div>',
          '<div class="agv2-ag-service">' + (a.servico || '—') + '</div>',
        '</div>',
        '<div class="agv2-ag-price">' + preco + '</div>',
        '<span class="agv2-ag-status-badge ' + status + '">' + statusLbl + '</span>',
        '<div class="agv2-ag-actions">',
          '<a class="agv2-ag-wpp" href="' + wppHref + '" target="_blank" rel="noopener" title="WhatsApp" aria-label="Enviar WhatsApp para ' + nome + '">',
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">',
              '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>',
              '<path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.852L.057 23.885l6.204-1.628A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.808 9.808 0 01-5.001-1.366l-.359-.213-3.682.966.983-3.594-.234-.371A9.818 9.818 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>',
            '</svg>',
          '</a>',
          '<div class="agv2-ag-more" onclick="agv2ToggleDropdown(event, \'' + id + '\')" title="Mais opções" role="button" tabindex="0" aria-label="Mais opções">',
            '<svg width="14" height="14" viewBox="0 0 15 15" fill="none" aria-hidden="true">',
              '<circle cx="3.5" cy="7.5" r="1" fill="currentColor"/>',
              '<circle cx="7.5" cy="7.5" r="1" fill="currentColor"/>',
              '<circle cx="11.5" cy="7.5" r="1" fill="currentColor"/>',
            '</svg>',
            '<div class="agv2-ag-dropdown" id="agv2-drop-' + id + '" role="menu">' + dropItems + '</div>',
          '</div>',
        '</div>',
      '</div>'
    ].join('')
  }
 
  /* ── Ações das linhas ── */
  window.agv2Concluir = function (id) {
    agv2FecharDropdowns()
    if (typeof atualizar === 'function') {
      atualizar(id, 'concluido')
      setTimeout(agv2RenderDia, 300)
    }
  }
  window.agv2Cancelar = function (id, nome, tel, data, hora) {
    agv2FecharDropdowns()
    if (typeof cancelarComAviso === 'function') {
      cancelarComAviso(id, nome, tel, data, hora)
      setTimeout(agv2RenderDia, 300)
    }
  }
  window.agv2Wpp = function (tel, nome) {
    agv2FecharDropdowns()
    var t = tel.replace(/\D/g, '')
    if (t) window.open('https://wa.me/55' + t + '?text=' + encodeURIComponent('Olá ' + nome + '! 😊'), '_blank')
  }
 
  window.agv2ToggleDropdown = function (event, id) {
    event.stopPropagation()
    var current = document.getElementById('agv2-drop-' + id)
    var isOpen  = current && current.classList.contains('aberto')
    agv2FecharDropdowns()
    if (!isOpen && current) current.classList.add('aberto')
  }
 
  function agv2FecharDropdowns() {
    document.querySelectorAll('.agv2-ag-dropdown').forEach(function (d) {
      d.classList.remove('aberto')
    })
  }
 
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.agv2-ag-more')) agv2FecharDropdowns()
  })
 
  window.agv2VerMais = function () {
    agv2ShowAll = true
    agv2RenderDia()
  }
 
  window.agv2ToggleSort = function (btn) {
    agv2SortAsc = !agv2SortAsc
    agv2RenderDia()
  }
 
  /* ════════════════════════════════════════════════
     DATE RANGE LABEL
  ════════════════════════════════════════════════ */
  function agv2AtualizarDateRange() {
    var el = document.getElementById('agv2-date-range-label')
    if (!el) return
    var start = new Date(agv2SelectedDate)
    var end   = new Date(agv2SelectedDate)
    end.setDate(end.getDate() + 6)
    var fmt = function (d) {
      return String(d.getDate()).padStart(2, '0') + '/' +
        String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear()
    }
    el.textContent = fmt(start) + ' – ' + fmt(end)
  }
 
  /* ════════════════════════════════════════════════
     RESUMO DA SEMANA
  ════════════════════════════════════════════════ */
  function agv2RenderResumo() {
    var ags   = getAgs()
    var start = new Date(agv2SelectedDate)
    start.setDate(start.getDate() - start.getDay())
    var end = new Date(start)
    end.setDate(start.getDate() + 6)
 
    var startStr = dateToStr(start)
    var endStr   = dateToStr(end)
 
    var daSemana = ags.filter(function (a) { return a.data >= startStr && a.data <= endStr })
    var concl    = daSemana.filter(function (a) { return a.status === 'concluido' })
    var canc     = daSemana.filter(function (a) { return a.status === 'cancelado' })
    var fat      = concl.reduce(function (s, a) { return s + (Number(a.preco) || 0) }, 0)
    var total    = daSemana.length
    var ticket   = concl.length > 0 ? fat / concl.length : 0
    var taxa     = total > 0 ? Math.round((concl.length / total) * 100) : 0
    var pctCanc  = total > 0 ? Math.round((canc.length / total) * 100) : 0
 
    var set = function (id, txt) { var e = document.getElementById(id); if (e) e.textContent = txt }
    set('agv2-fat-semana',     fmtBRL(fat))
    set('agv2-ticket-medio',   fmtBRL(ticket))
    set('agv2-taxa-comp',      taxa + '%')
    set('agv2-cancelamentos',  canc.length + ' (' + pctCanc + '%)')
  }
 
  /* ════════════════════════════════════════════════
     DONUT CHART — SERVIÇOS
  ════════════════════════════════════════════════ */
  function agv2RenderServicos() {
    var ags  = getAgs()
    var freq = {}
    ags.forEach(function (a) {
      if (!a.servico) return
      freq[a.servico] = (freq[a.servico] || 0) + 1
    })
 
    var sorted    = Object.entries(freq).sort(function (a, b) { return b[1] - a[1] }).slice(0, 4)
    var totalFreq = sorted.reduce(function (s, e) { return s + e[1] }, 0)
 
    var svgEl = document.getElementById('agv2-donut-svg')
    var legEl = document.getElementById('agv2-servicos-legend')
    if (!svgEl || !legEl) return
 
    if (!totalFreq) {
      svgEl.innerHTML = '<circle cx="60" cy="60" r="38" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="16"/>'
      legEl.innerHTML = '<div style="font-size:12px;color:var(--text3);text-align:center;padding:4px 0">Sem dados ainda</div>'
      return
    }
 
    var R     = 38
    var CX    = 60
    var CY    = 60
    var SW    = 16
    var circ  = 2 * Math.PI * R
 
    /* Base track */
    var paths = '<circle cx="' + CX + '" cy="' + CY + '" r="' + R +
      '" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="' + SW + '"/>'
 
    var cumLen = 0
    sorted.forEach(function (entry, i) {
      var pct    = entry[1] / totalFreq
      var len    = pct * circ
      var gap    = circ - len
      var offset = -cumLen
      paths +=
        '<circle cx="' + CX + '" cy="' + CY + '" r="' + R +
        '" fill="none" stroke="' + COLORS_DONUT[i] +
        '" stroke-width="' + SW +
        '" stroke-dasharray="' + len.toFixed(2) + ' ' + gap.toFixed(2) +
        '" stroke-dashoffset="' + offset.toFixed(2) +
        '" transform="rotate(-90 ' + CX + ' ' + CY + ')"/>'
      cumLen += len
    })
 
    /* Center hole filler */
    paths += '<circle cx="' + CX + '" cy="' + CY + '" r="' + (R - SW / 2 + 1) + '" fill="var(--bg-card)"/>'
 
    svgEl.innerHTML = paths
 
    legEl.innerHTML = sorted.map(function (entry, i) {
      var pct = Math.round(entry[1] / totalFreq * 100)
      return '<div class="agv2-leg-row" role="listitem">' +
        '<span class="agv2-leg-dot" style="background:' + COLORS_DONUT[i] + '"></span>' +
        '<span>' + entry[0] + '</span>' +
        '<span class="agv2-leg-pct">' + pct + '%</span>' +
        '</div>'
    }).join('')
  }
 
  /* ════════════════════════════════════════════════
     LINK
  ════════════════════════════════════════════════ */
  function agv2AtualizarLink() {
    if (typeof negocioAtual === 'undefined' || !negocioAtual) return
    var link = 'https://agendorapido.com.br/agendar.html?id=' + negocioAtual._id
    var el   = document.getElementById('agv2-link-url')
    if (el) el.textContent = link
  }
 
  window.agv2CopiarLink = function () {
    if (typeof negocioAtual === 'undefined' || !negocioAtual) return
    var link = 'https://agendorapido.com.br/agendar.html?id=' + negocioAtual._id
    navigator.clipboard.writeText(link).then(function () {
      var btn = document.querySelector('.agv2-btn-copy')
      if (!btn) return
      var orig = btn.innerHTML
      btn.innerHTML = '✓ Copiado!'
      setTimeout(function () { btn.innerHTML = orig }, 2000)
    })
  }
 
  window.agv2CompartilharLink = function () {
    if (typeof negocioAtual === 'undefined' || !negocioAtual) return
    var link = 'https://agendorapido.com.br/agendar.html?id=' + negocioAtual._id
    if (navigator.share) {
      navigator.share({ title: negocioAtual.nome, url: link }).catch(function () { agv2CopiarLink() })
    } else {
      agv2CopiarLink()
    }
  }
 
  /* ════════════════════════════════════════════════
     INIT + HOOKS
  ════════════════════════════════════════════════ */
  function agv2Init() {
    agv2CalDate      = new Date()
    agv2SelectedDate = new Date()
    agv2RenderCalendar()
    agv2RenderDia()
    agv2RenderResumo()
    agv2RenderServicos()
    agv2AtualizarLink()
  }
 
  /* Hook: atualiza a view quando agendamentos são carregados/alterados */
  var _origRenderDash = window.renderDashboardHoje
  window.renderDashboardHoje = function () {
    if (typeof _origRenderDash === 'function') _origRenderDash.apply(this, arguments)
    agv2RenderCalendar()
    agv2RenderDia()
    agv2RenderResumo()
    agv2RenderServicos()
    agv2AtualizarLink()
  }
 
  /* Hook: re-renderiza ao navegar para agendamentos */
  var _origIrPara = window.irPara
  window.irPara = function (pagina, btn) {
    _origIrPara.apply(this, arguments)
    if (pagina === 'agendamentos') {
      setTimeout(function () {
        agv2RenderCalendar()
        agv2RenderDia()
        agv2RenderResumo()
        agv2RenderServicos()
        agv2AtualizarLink()
      }, 80)
    }
  }
 
  /* Init no DOMContentLoaded */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(agv2Init, 200)
    })
  } else {
    setTimeout(agv2Init, 200)
  }
 
})()