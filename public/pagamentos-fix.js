/* ═══════════════════════════════════════════════════
   pagamentos-fix.js  (versão corrigida)
   Conecta a UI de Pagamentos (mpag-*) ao backend
═══════════════════════════════════════════════════ */

(function () {
  'use strict';

  function _getAPI() {
    try { if (typeof API !== 'undefined' && API) return API; } catch(e) {}
    return 'https://agendafacil-wf3q.onrender.com/api';
  }

  function _getNegocio() {
    try { if (typeof negocioAtual !== 'undefined' && negocioAtual && negocioAtual._id) return negocioAtual; } catch(e) {}
    return (window.negocioAtual && window.negocioAtual._id) ? window.negocioAtual : null;
  }

  async function _esperarNegocio(maxMs) {
    var tentativas = Math.ceil((maxMs || 6000) / 300);
    for (var i = 0; i < tentativas; i++) {
      var neg = _getNegocio();
      if (neg) return neg;
      await new Promise(function(r) { setTimeout(r, 300); });
    }
    return null;
  }

  // ── Estado local ──────────────────────────────────────────────
  var _cfg = {
    adiantado: false,
    tipoValor: 'total',
    porcentagem: 50,
    valorFixo: 0,
    reembolso: true,
    reembolsoCliente: true,
    reembolsoNegocio: true,
  };

  // ── Carregar config do backend ────────────────────────────────
  async function mpagCarregar() {
    var neg = await _esperarNegocio(6000);
    if (!neg) { console.warn('[pagamentos-fix] negocioAtual indisponível'); return; }
    try {
      var res = await fetch(_getAPI() + '/pagamento/config/' + neg._id, {
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
      });
      if (!res.ok) { console.warn('[pagamentos-fix] HTTP', res.status); return; }
      var d = await res.json();

      _cfg.adiantado        = !!d.adiantado;
      _cfg.tipoValor        = d.tipoValor        || 'total';
      _cfg.porcentagem      = Number(d.porcentagem) || 50;
      _cfg.valorFixo        = Number(d.valorFixo)   || 0;
      _cfg.reembolso        = d.reembolso        !== false;
      _cfg.reembolsoCliente = d.reembolsoCliente !== false;
      _cfg.reembolsoNegocio = d.reembolsoNegocio !== false;

      console.log('[pagamentos-fix] Config carregada:', _cfg);
      mpagPopularUI();
    } catch(e) { console.warn('[pagamentos-fix] carregar:', e.message); }
  }

  // ── Popular UI com os valores carregados ──────────────────────
  function mpagPopularUI() {
    // Toggle principal (adiantado)
    var tog = document.getElementById('mpag-toggle-adiantado');
    if (tog) {
      tog.checked = _cfg.adiantado;
    }
    _atualizarOpacidade(_cfg.adiantado);

    // Radios de tipo de valor
    document.querySelectorAll('input[name="mpag-valor"]').forEach(function(r) {
      r.checked = (r.value === _cfg.tipoValor);
    });
    _atualizarRadios(_cfg.tipoValor);
    _atualizarPctVisivel(_cfg.tipoValor);

    // Porcentagem
    window.mpagPct = _cfg.porcentagem;
    var elP = document.getElementById('mpag-pct-display');
    if (elP) elP.textContent = _cfg.porcentagem + '%';
    _atualizarInfoBar();

    // Toggles de reembolso
    _setToggle('mpag-toggle-reembolso-main',    _cfg.reembolso);
    _setToggle('mpag-toggle-reembolso-cliente', _cfg.reembolsoCliente);
    _setToggle('mpag-toggle-reembolso-negocio', _cfg.reembolsoNegocio);
    _atualizarResumo();
  }

  // ── Salvar config no backend ──────────────────────────────────
  async function mpagSalvar() {
    var neg = await _esperarNegocio(3000);
    if (!neg) { alert('Painel ainda carregando. Aguarde e tente novamente.'); return; }

    _lerUI();

    var btn = document.getElementById('mpag-btn-salvar');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

    try {
      var res = await fetch(_getAPI() + '/pagamento/config', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('token')
        },
        body: JSON.stringify({
          negocioId:        neg._id,
          adiantado:        _cfg.adiantado,
          tipoValor:        _cfg.tipoValor,
          porcentagem:      _cfg.porcentagem,
          valorFixo:        _cfg.valorFixo,
          reembolso:        _cfg.reembolso,
          reembolsoCliente: _cfg.reembolsoCliente,
          reembolsoNegocio: _cfg.reembolsoNegocio,
        }),
      });

      if (!res.ok) throw new Error('HTTP ' + res.status);

      if (btn) {
        btn.textContent = '✓ Salvo!';
        btn.style.background = '#10b981';
      }
      setTimeout(function() {
        if (btn) {
          btn.style.background = '';
          btn.innerHTML = _btnHTML();
          btn.disabled = false;
        }
      }, 2500);

    } catch(e) {
      console.error('[pagamentos-fix] salvar:', e.message);
      alert('Erro ao salvar. Verifique sua conexão e tente novamente.');
      if (btn) { btn.disabled = false; btn.innerHTML = _btnHTML(); }
    }
  }

  // ── Ler estado atual da UI → _cfg ────────────────────────────
  function _lerUI() {
    // Toggle adiantado
    var tog = document.getElementById('mpag-toggle-adiantado');
    if (tog) _cfg.adiantado = tog.checked;

    // Radio tipo valor
    var r = document.querySelector('input[name="mpag-valor"]:checked');
    if (r) _cfg.tipoValor = r.value;

    // Porcentagem
    _cfg.porcentagem = window.mpagPct || 50;

    // Toggles de reembolso
    _cfg.reembolso        = _getToggle('mpag-toggle-reembolso-main');
    _cfg.reembolsoCliente = _getToggle('mpag-toggle-reembolso-cliente');
    _cfg.reembolsoNegocio = _getToggle('mpag-toggle-reembolso-negocio');
  }

  // ── Helpers de toggle ─────────────────────────────────────────
  function _getToggle(id) {
    var el = document.getElementById(id);
    return el ? el.checked : true;
  }
  function _setToggle(id, val) {
    var el = document.getElementById(id);
    if (el) el.checked = !!val;
  }

  // ── Atualizar visual ──────────────────────────────────────────
  function _atualizarOpacidade(on) {
    var c = document.getElementById('mpag-adiantado-content');
    if (c) c.style.opacity = on ? '1' : '0.4';
  }

  function _atualizarRadios(tipo) {
    var map = {
      total:         'mpag-opt-total',
      personalizado: 'mpag-opt-personalizado',
      fixo:          'mpag-opt-fixo'
    };
    Object.keys(map).forEach(function(k) {
      var el  = document.getElementById(map[k]);
      var dot = el && el.querySelector('.mpag-radio-dot');
      if (!el) return;
      el.classList.toggle('mpag-radio-active', k === tipo);
      if (dot) dot.classList.toggle('mpag-radio-dot-active', k === tipo);
    });
  }

  function _atualizarPctVisivel(tipo) {
    var row = document.querySelector('.mpag-pct-row');
    if (row) row.style.display = (tipo === 'personalizado') ? 'flex' : 'none';
  }

  function _atualizarInfoBar() {
    var el  = document.getElementById('mpag-info-text');
    if (!el) return;
    var pct = window.mpagPct || 50;
    var msgs = {
      total: 'O cliente pagará 100% do valor do serviço para confirmar o agendamento.',
      fixo:  'O cliente pagará um valor fixo para confirmar o agendamento.',
    };
    el.textContent = msgs[_cfg.tipoValor] || ('O cliente pagará ' + pct + '% do valor do serviço para confirmar o agendamento.');
  }

  function _atualizarResumo() {
    var el = document.querySelector('.mpag-resumo-green');
    if (el) {
      el.textContent  = _cfg.reembolso ? 'Ativado' : 'Desativado';
      el.style.color  = _cfg.reembolso ? '' : '#ef4444';
    }
  }

  // ── Controle da porcentagem (chamado pelos botões +/- do HTML) ─
  window.mpagChangePct = function(delta) {
    window.mpagPct = Math.max(10, Math.min(100, (window.mpagPct || 50) + delta));
    _cfg.porcentagem = window.mpagPct;
    var el = document.getElementById('mpag-pct-display');
    if (el) el.textContent = window.mpagPct + '%';
    _atualizarInfoBar();
  };

  // ── HTML do botão salvar ──────────────────────────────────────
  function _btnHTML() {
    return '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="flex-shrink:0"><path d="M2 7l3.5 3.5L12 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> Salvar configurações';
  }

  // ── Injetar botão Salvar no DOM ───────────────────────────────
  function _injetarBotao() {
    if (document.getElementById('mpag-btn-salvar')) return;
    var col = document.querySelector('.mpag-col-left');
    if (!col) return;

    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;gap:14px;padding:4px 0 20px';

    var btn = document.createElement('button');
    btn.id        = 'mpag-btn-salvar';
    btn.type      = 'button';
    btn.onclick   = mpagSalvar;
    btn.innerHTML = _btnHTML();
    btn.style.cssText = 'display:flex;align-items:center;gap:8px;background:var(--accent,#2563eb);color:#fff;border:none;padding:10px 22px;border-radius:10px;font-size:13.5px;font-weight:600;cursor:pointer;font-family:inherit;transition:background .18s;box-shadow:0 2px 12px rgba(37,99,235,.35)';

    wrap.appendChild(btn);
    col.appendChild(wrap);
  }

  // ── Vincular eventos da UI ────────────────────────────────────
  function _vincularEventos() {
    // Toggle principal: ativa/desativa pagamento adiantado
    var tog = document.getElementById('mpag-toggle-adiantado');
    if (tog && !tog._fix) {
      tog._fix = true;
      tog.addEventListener('change', function() {
        _cfg.adiantado = this.checked;
        _atualizarOpacidade(this.checked);
      });
    }

    // Opções de tipo de valor (total / personalizado / fixo)
    ['mpag-opt-total', 'mpag-opt-personalizado', 'mpag-opt-fixo'].forEach(function(id) {
      var el = document.getElementById(id);
      if (!el || el._fix) return;
      el._fix = true;
      el.addEventListener('click', function() {
        var r = this.querySelector('input[type="radio"]');
        if (!r) return;
        r.checked      = true;
        _cfg.tipoValor = r.value;
        _atualizarRadios(r.value);
        _atualizarPctVisivel(r.value);
        _atualizarInfoBar();
      });
    });

    // ── Toggles de reembolso ──────────────────────────────────
    // Estratégia: atribui IDs fixos aos checkboxes de reembolso
    // para que _getToggle() funcione corretamente ao salvar

    // Toggle principal de reembolso (3º bloco)
    var mainTog = document.querySelector(
      '.mpag-block:nth-child(3) .mpag-toggle-main-row input[type="checkbox"],' +
      '.mpag-block:nth-child(4) .mpag-toggle-main-row input[type="checkbox"]'
    );
    if (mainTog && !mainTog.id) {
      mainTog.id = 'mpag-toggle-reembolso-main';
    }
    if (mainTog && !mainTog._fix) {
      mainTog._fix = true;
      mainTog.addEventListener('change', function() {
        _cfg.reembolso = this.checked;
        _atualizarResumo();
      });
    }

    // Checkboxes internos de reembolso (cliente / negócio)
    var lista = document.querySelector('.mpag-reimb-list');
    if (lista) {
      var cbs = lista.querySelectorAll('input[type="checkbox"]');
      if (cbs[0] && !cbs[0].id) {
        cbs[0].id = 'mpag-toggle-reembolso-cliente';
      }
      if (cbs[0] && !cbs[0]._fix) {
        cbs[0]._fix = true;
        cbs[0].addEventListener('change', function() { _cfg.reembolsoCliente = this.checked; });
      }
      if (cbs[1] && !cbs[1].id) {
        cbs[1].id = 'mpag-toggle-reembolso-negocio';
      }
      if (cbs[1] && !cbs[1]._fix) {
        cbs[1]._fix = true;
        cbs[1].addEventListener('change', function() { _cfg.reembolsoNegocio = this.checked; });
      }
    }
  }

  // ── Init completo ─────────────────────────────────────────────
  function _init() {
    _injetarBotao();
    _vincularEventos();
    mpagCarregar();   // carrega do backend e popula UI
  }

  // ── Exportar para uso externo ─────────────────────────────────
  window.renderPagamentos  = _init;
  window.mpagSalvar        = mpagSalvar;
  window.mpagCarregar      = mpagCarregar;

  // ── Hookar no sistema de navegação do painel ──────────────────
  var _orig = window.irPara;
  if (typeof _orig === 'function') {
    window.irPara = function(pagina, btn) {
      _orig(pagina, btn);
      if (pagina === 'pagamentos') setTimeout(_init, 120);
    };
  }

  // ── Inicializar se já estiver na página de pagamentos ─────────
  document.addEventListener('DOMContentLoaded', function() {
    var p = document.getElementById('page-pagamentos');
    if (p && p.classList.contains('ativo')) {
      setTimeout(_init, 120);
    }
  });

  // ── Observar quando a página de pagamentos se torna ativa ─────
  // (caso o painel use classList sem chamar irPara)
  var _observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      if (m.type === 'attributes' && m.attributeName === 'class') {
        var el = m.target;
        if (el.id === 'page-pagamentos' && el.classList.contains('ativo')) {
          setTimeout(_init, 120);
        }
      }
    });
  });

  var _pageEl = document.getElementById('page-pagamentos');
  if (_pageEl) {
    _observer.observe(_pageEl, { attributes: true });
  } else {
    // DOM ainda não pronto: espera e tenta de novo
    document.addEventListener('DOMContentLoaded', function() {
      var p2 = document.getElementById('page-pagamentos');
      if (p2) _observer.observe(p2, { attributes: true });
    });
  }

})();