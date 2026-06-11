;(function () {
  'use strict';
 
  /* ── helpers reutilizados do módulo principal ── */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function escJs(s) {
    return String(s || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  }
  function avatarCor(nome) {
    var pals = [
      ['#1d4ed8','#3b82f6'],['#7c3aed','#8b5cf6'],['#0e7490','#06b6d4'],
      ['#15803d','#22c55e'],['#b45309','#f59e0b'],['#be185d','#ec4899'],
      ['#0369a1','#38bdf8'],['#6d28d9','#a78bfa']
    ];
    var h = 0, s = nome || 'A';
    for (var i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i);
    return pals[Math.abs(h) % pals.length];
  }
  function iniciais(nome) {
    return (nome || '?').split(' ').filter(Boolean).map(function(w){return w[0];}).slice(0,2).join('').toUpperCase();
  }
  function statusInfo(s) {
    if (s==='confirmado') return {label:'Confirmado',cor:'var(--green-2)',bg:'var(--green-bg)',dot:'var(--green)'};
    if (s==='concluido')  return {label:'Concluído', cor:'var(--purple)', bg:'var(--purple-bg)',dot:'var(--purple)'};
    if (s==='cancelado')  return {label:'Cancelado', cor:'#f87171',       bg:'var(--red-bg)',   dot:'var(--red)'};
    return {label:'Pendente',cor:'var(--yellow)',bg:'var(--yellow-bg)',dot:'var(--yellow)'};
  }
  function precoDe(a) { return Number(a.preco) || 0; }
  function fmtBRL(v)  { return 'R$ ' + Number(v||0).toLocaleString('pt-BR'); }
  var MES_ABBR = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
 
  /* ── BOTÕES DE AÇÃO ── */
  function acoesHTML(a) {
    var id  = a._id || '';
    var nom = escJs(a.pacienteNome);
    var tel = escJs(a.pacienteTelefone);
    var dt  = a.data || '';
    var hr  = a.hora || '';
 
    if (a.status === 'confirmado') {
      return '<button class="btn-acao concluir" type="button" ' +
               'onclick="event.stopPropagation();atualizar(\'' + id + '\',\'concluido\')">' +
               'Concluir</button>' +
             '<button class="btn-acao cancelar" type="button" ' +
               'onclick="event.stopPropagation();cancelarComAviso(\'' + id + '\',\'' + nom + '\',\'' + tel + '\',\'' + dt + '\',\'' + hr + '\')">' +
               'Cancelar</button>';
    }
    if (a.status === 'pendente') {
      return '<button class="btn-acao concluir" type="button" ' +
               'onclick="event.stopPropagation();atualizar(\'' + id + '\',\'confirmado\')">' +
               'Confirmar</button>' +
             '<button class="btn-acao cancelar" type="button" ' +
               'onclick="event.stopPropagation();cancelarComAviso(\'' + id + '\',\'' + nom + '\',\'' + tel + '\',\'' + dt + '\',\'' + hr + '\')">' +
               'Cancelar</button>';
    }
    // concluido ou cancelado: só badge
    var si = statusInfo(a.status);
    return '<span class="arag-badge" style="color:' + si.cor + ';background:' + si.bg + '">' +
             '<span class="arag-badge-dot" style="background:' + si.dot + '"></span>' + si.label +
           '</span>';
  }
 
  /* ── ROW DESKTOP (7 colunas — última = ações) ── */
  function rowHTML(a) {
    var cor = avatarCor(a.pacienteNome);
    var si  = statusInfo(a.status);
    var d   = a.data ? a.data.split('-') : [];
    var dataFmt = d.length === 3 ? (parseInt(d[2],10) + ' ' + MES_ABBR[parseInt(d[1],10)-1]) : '—';
 
    return '<div class="arag-row">' +
      /* Cliente */
      '<div class="arag-row-cli">' +
        '<div class="arag-avatar" style="width:34px;height:34px;font-size:12px;background:linear-gradient(135deg,' + cor[0] + ',' + cor[1] + ')">' + iniciais(a.pacienteNome) + '</div>' +
        '<div style="min-width:0">' +
          '<div class="arag-row-nome">' + esc(a.pacienteNome||'—') + '</div>' +
          '<div class="arag-row-tel">' + esc(a.pacienteTelefone||'') + '</div>' +
        '</div>' +
      '</div>' +
      /* Serviço */
      '<div class="arag-row-serv">' + esc(a.servico||'—') + '</div>' +
      /* Profissional */
      '<div class="arag-row-prof">' + esc(a.profissional||'—') + '</div>' +
      /* Data */
      '<div><div class="arag-row-data">' + dataFmt + '</div><div class="arag-row-hora">' + (a.hora||'') + '</div></div>' +
      /* Status */
      '<div><span class="arag-badge" style="color:' + si.cor + ';background:' + si.bg + '">' +
        '<span class="arag-badge-dot" style="background:' + si.dot + '"></span>' + si.label +
      '</span></div>' +
      /* Valor */
      '<div class="arag-row-val">' + fmtBRL(precoDe(a)) + '</div>' +
      /* Ações */
      '<div class="arag-row-acoes">' + acoesHTML(a) + '</div>' +
    '</div>';
  }
 
  /* ── CARD MOBILE ── */
  function mcardHTML(a) {
    var cor = avatarCor(a.pacienteNome);
    var si  = statusInfo(a.status);
    var d   = a.data ? a.data.split('-') : [];
    var dataFmt = d.length === 3 ? (String(d[2]).padStart(2,'0') + '/' + String(d[1]).padStart(2,'0')) : '—';
 
    return '<div class="arag-mcard">' +
      '<div class="arag-mcard-top">' +
        '<div class="arag-mcard-cli">' +
          '<div class="arag-avatar" style="width:36px;height:36px;font-size:13px;background:linear-gradient(135deg,' + cor[0] + ',' + cor[1] + ')">' + iniciais(a.pacienteNome) + '</div>' +
          '<div style="min-width:0">' +
            '<div class="arag-row-nome">' + esc(a.pacienteNome||'—') + '</div>' +
            '<div class="arag-row-tel">' + esc(a.pacienteTelefone||'') + '</div>' +
          '</div>' +
        '</div>' +
        '<span class="arag-badge" style="color:' + si.cor + ';background:' + si.bg + '">' +
          '<span class="arag-badge-dot" style="background:' + si.dot + '"></span>' + si.label +
        '</span>' +
      '</div>' +
      '<div class="arag-mcard-chips">' +
        '<span class="arag-mchip">' + dataFmt + '</span>' +
        '<span class="arag-mchip">' + (a.hora||'—') + '</span>' +
        '<span class="arag-mchip">' + esc(a.servico||'—') + '</span>' +
        '<span class="arag-mchip" style="font-weight:700;color:var(--text)">' + fmtBRL(precoDe(a)) + '</span>' +
      '</div>' +
      /* Botões de ação em bloco separado */
      (a.status === 'confirmado' || a.status === 'pendente'
        ? '<div class="arag-mcard-actions">' + acoesHTML(a) + '</div>'
        : '') +
    '</div>';
  }
 
  /* ── Patch: aguarda o módulo ARAG existir e substitui as funções ── */
  function aplicarPatch() {
    /* O módulo ARAG usa closure, mas expõe aragRenderLista globalmente.
       Sobrescrevemos aragRenderLista usando as novas funções locais.      */
    var ARAG = window.ARAG;
    if (!ARAG) return; // módulo ainda não carregou, tenta de novo
 
    var _origSetSort   = window.aragSetSort;
    var _origSetStatus = window.aragSetStatus;
    var _origBuscar    = window.aragBuscar;
    var _origIrPagina  = window.aragIrPagina;
 
    function aragFiltradas() {
      var lista = (window.todosAgendamentos || []).slice();
      if (ARAG.status !== 'todos')
        lista = lista.filter(function(a){ return a.status === ARAG.status; });
      var q = (ARAG.search || '').trim().toLowerCase();
      if (q)
        lista = lista.filter(function(a){
          return (a.pacienteNome||'').toLowerCase().indexOf(q) >= 0 ||
                 (a.servico||'').toLowerCase().indexOf(q) >= 0 ||
                 (a.pacienteTelefone||'').indexOf(q) >= 0;
        });
      if (ARAG.sort === 'cliente')
        lista.sort(function(a,b){ return (a.pacienteNome||'').localeCompare(b.pacienteNome||''); });
      else if (ARAG.sort === 'valor')
        lista.sort(function(a,b){ return precoDe(b) - precoDe(a); });
      else
        lista.sort(function(a,b){
          return ((b.data||'')+(b.hora||'')).localeCompare((a.data||'')+(a.hora||''));
        });
      return lista;
    }
 
    function renderListaFixed() {
      var lista = aragFiltradas();
      var countEl   = document.getElementById('arag-list-count');
      var rows      = document.getElementById('arag-rows');
      var mcards    = document.getElementById('arag-mcards');
      var pagWrap   = document.getElementById('arag-pag-wrap');
 
      if (countEl) countEl.textContent = lista.length;
 
      if (!lista.length) {
        var empty = '<div class="arag-empty">' +
          '<div class="arag-empty-ic"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2.5"/><path d="M3 9h18M8 2v4M16 2v4"/></svg></div>' +
          '<div class="arag-empty-title">Nenhum agendamento encontrado</div>' +
          '<div class="arag-empty-sub">Tente ajustar a busca ou os filtros.</div>' +
          '<button class="arag-btn arag-btn-primary" type="button" style="margin-top:18px" onclick="abrirModalNovoAgendamento()">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>' +
            'Novo agendamento' +
          '</button>' +
        '</div>';
        if (rows) rows.innerHTML = empty;
        if (mcards) mcards.innerHTML = empty;
        if (pagWrap) pagWrap.innerHTML = '';
        return;
      }
 
      var perPage    = ARAG.perPage || 6;
      var page       = ARAG.page    || 1;
      var totalPages = Math.max(1, Math.ceil(lista.length / perPage));
      if (page > totalPages) { ARAG.page = page = totalPages; }
      var start = (page - 1) * perPage;
      var slice = lista.slice(start, start + perPage);
 
      if (rows)   rows.innerHTML   = slice.map(rowHTML).join('');
      if (mcards) mcards.innerHTML = slice.map(mcardHTML).join('');
 
      /* paginação */
      if (pagWrap) {
        if (totalPages <= 1) {
          pagWrap.innerHTML = '';
        } else {
          var btns = '<button class="arag-pag-btn" type="button" ' + (page===1?'disabled':'') + ' onclick="aragIrPagina('+(page-1)+')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M15 6l-6 6 6 6"/></svg></button>';
          for (var p = 1; p <= totalPages; p++)
            btns += '<button class="arag-pag-btn ' + (p===page?'ativo':'') + '" type="button" onclick="aragIrPagina('+p+')">'+p+'</button>';
          btns += '<button class="arag-pag-btn" type="button" ' + (page===totalPages?'disabled':'') + ' onclick="aragIrPagina('+(page+1)+')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg></button>';
          pagWrap.innerHTML = '<div class="arag-pag"><div class="arag-pag-info">Mostrando '+(start+1)+'–'+Math.min(start+perPage,lista.length)+' de '+lista.length+'</div><div class="arag-pag-btns">'+btns+'</div></div>';
        }
      }
    }
 
    /* ── substitui a global aragRenderLista ── */
    window.aragRenderLista = renderListaFixed;
 
    /* ── garante que atualizar/cancelarComAviso re-renderiza tudo ── */
    var _origAtualizar = window.atualizar;
    window.atualizar = function(id, status) {
      var p = _origAtualizar ? _origAtualizar.apply(this, arguments) : Promise.resolve();
      if (p && p.then) {
        p.then(function(){ if (window.aragRenderAll) window.aragRenderAll(); });
      }
      return p;
    };
 
    var _origCancelar = window.cancelarComAviso;
    window.cancelarComAviso = function() {
      var r = _origCancelar ? _origCancelar.apply(this, arguments) : undefined;
      setTimeout(function(){ if (window.aragRenderAll) window.aragRenderAll(); }, 400);
      return r;
    };
 
    console.log('[arag-fix] patch aplicado ✓');
  }
 
  /* ── ASSISTENTE IA: re-renderiza corretamente quando dados chegam ── */
  function patchIA() {
    /* Aguarda aragRenderAll existir */
    if (typeof window.aragRenderAll !== 'function') return;
 
    /* Hook em carregarAgendamentos para acionar o render do IA depois */
    var _origCarregar = window.carregarAgendamentos;
    window.carregarAgendamentos = async function() {
      var r = _origCarregar ? await _origCarregar.apply(this, arguments) : undefined;
      /* Após os dados chegarem, re-renderiza a página de agendamentos se estiver ativa */
      setTimeout(function(){
        var pagAg = document.getElementById('page-agendamentos');
        if (pagAg && pagAg.classList.contains('ativo')) {
          if (typeof window.aragRenderAll === 'function') window.aragRenderAll();
        }
      }, 200);
      return r;
    };
  }
 
  /* ── Aguarda DOM + módulos carregarem ── */
  function tentarPatch() {
    if (window.ARAG && window.aragRenderAll) {
      aplicarPatch();
      patchIA();
    } else {
      setTimeout(tentarPatch, 150);
    }
  }
 
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(tentarPatch, 300); });
  } else {
    setTimeout(tentarPatch, 300);
  }
 
})();