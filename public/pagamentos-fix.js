/* ═══════════════════════════════════════════════════
   pagamentos-fix.js
   Conecta a nova UI de Pagamentos (mpag-*) ao backend
   já existente em /api/pagamento/config
═══════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Estado local da página de pagamentos ── */
  var _cfg = {
    adiantado:        false,
    tipoValor:        'total',   // 'total' | 'personalizado' | 'fixo'
    porcentagem:      50,
    reembolso:        true,
    reembolsoCliente: true,
    reembolsoNegocio: true,
  };

  /* ─────────────────────────────────────────
     CARREGAR config do backend e popular UI
  ───────────────────────────────────────── */
  async function mpagCarregar() {
    var negocioId = window.negocioAtual && window.negocioAtual._id;
    if (!negocioId) return;

    try {
      var token = localStorage.getItem('token');
      var res   = await fetch(window.API + '/pagamento/config/' + negocioId, {
        headers: { 'Authorization': 'Bearer ' + token }
      });

      if (!res.ok) return;
      var data = await res.json();

      // Persistir no estado local
      _cfg.adiantado        = !!data.adiantado;
      _cfg.tipoValor        = data.tipoValor        || 'total';
      _cfg.porcentagem      = Number(data.porcentagem)  || 50;
      _cfg.reembolso        = data.reembolso        !== false;
      _cfg.reembolsoCliente = data.reembolsoCliente !== false;
      _cfg.reembolsoNegocio = data.reembolsoNegocio !== false;

      mpagPopularUI();
    } catch (e) {
      console.warn('[pagamentos-fix] Erro ao carregar config:', e.message);
    }
  }

  /* ─────────────────────────────────────────
     Popular todos os controles da UI
  ───────────────────────────────────────── */
  function mpagPopularUI() {
    /* Toggle principal — Pagamento adiantado */
    var togAdiantado = document.getElementById('mpag-toggle-adiantado');
    if (togAdiantado) togAdiantado.checked = _cfg.adiantado;
    _mpagAtualizarConteudoAdiantado(_cfg.adiantado);

    /* Radio buttons de tipo de valor */
    var radios = document.querySelectorAll('input[name="mpag-valor"]');
    radios.forEach(function (r) {
      r.checked = (r.value === _cfg.tipoValor);
    });
    _mpagAtualizarEstiloRadios(_cfg.tipoValor);
    _mpagAtualizarVisibilidadePct(_cfg.tipoValor);

    /* Porcentagem */
    window.mpagPct = _cfg.porcentagem;
    var elPct = document.getElementById('mpag-pct-display');
    if (elPct) elPct.textContent = _cfg.porcentagem + '%';
    _mpagAtualizarInfoBar();

    /* Reembolso automático */
    _mpagSetToggle('mpag-toggle-reembolso-main',    _cfg.reembolso);
    _mpagSetToggle('mpag-toggle-reembolso-cliente', _cfg.reembolsoCliente);
    _mpagSetToggle('mpag-toggle-reembolso-negocio', _cfg.reembolsoNegocio);

    /* Resumo lateral */
    _mpagAtualizarResumo();
  }

  /* ─────────────────────────────────────────
     SALVAR config no backend
  ───────────────────────────────────────── */
  async function mpagSalvar() {
    var negocioId = window.negocioAtual && window.negocioAtual._id;
    if (!negocioId) { alert('Nenhum painel selecionado.'); return; }

    /* Ler estado atual da UI antes de salvar */
    _mpagLerUI();

    var token = localStorage.getItem('token');
    var btn   = document.getElementById('mpag-btn-salvar');

    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

    try {
      var res = await fetch(window.API + '/pagamento/config', {
        method:  'PATCH',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify({
          negocioId:        negocioId,
          adiantado:        _cfg.adiantado,
          tipoValor:        _cfg.tipoValor,
          porcentagem:      _cfg.porcentagem,
          reembolso:        _cfg.reembolso,
          reembolsoCliente: _cfg.reembolsoCliente,
          reembolsoNegocio: _cfg.reembolsoNegocio,
        }),
      });

      if (!res.ok) throw new Error('HTTP ' + res.status);

      _mpagFlashSalvo();
    } catch (e) {
      console.error('[pagamentos-fix] Erro ao salvar:', e.message);
      alert('Erro ao salvar. Verifique sua conexão e tente novamente.');
    } finally {
      if (btn) {
        btn.disabled    = false;
        btn.textContent = 'Salvar configurações';
      }
    }
  }

  /* ─────────────────────────────────────────
     Ler todos os controles da UI → _cfg
  ───────────────────────────────────────── */
  function _mpagLerUI() {
    var togAdiantado = document.getElementById('mpag-toggle-adiantado');
    if (togAdiantado) _cfg.adiantado = togAdiantado.checked;

    var radioSel = document.querySelector('input[name="mpag-valor"]:checked');
    if (radioSel) _cfg.tipoValor = radioSel.value;

    _cfg.porcentagem = window.mpagPct || 50;

    _cfg.reembolso        = _mpagGetToggle('mpag-toggle-reembolso-main');
    _cfg.reembolsoCliente = _mpagGetToggle('mpag-toggle-reembolso-cliente');
    _cfg.reembolsoNegocio = _mpagGetToggle('mpag-toggle-reembolso-negocio');
  }

  /* ─────────────────────────────────────────
     Helpers de toggle (label > input[checkbox])
  ───────────────────────────────────────── */
  function _mpagGetToggle(id) {
    var el = document.getElementById(id);
    return el ? el.checked : true;
  }
  function _mpagSetToggle(id, val) {
    var el = document.getElementById(id);
    if (el) el.checked = !!val;
  }

  /* ─────────────────────────────────────────
     Atualizar opacidade do bloco "adiantado"
  ───────────────────────────────────────── */
  function _mpagAtualizarConteudoAdiantado(isOn) {
    var content = document.getElementById('mpag-adiantado-content');
    if (content) content.style.opacity = isOn ? '1' : '0.4';
  }

  /* ─────────────────────────────────────────
     Atualizar estilos dos radio buttons
  ───────────────────────────────────────── */
  function _mpagAtualizarEstiloRadios(tipo) {
    var mapa = {
      'total':         'mpag-opt-total',
      'personalizado': 'mpag-opt-personalizado',
      'fixo':          'mpag-opt-fixo',
    };
    Object.keys(mapa).forEach(function (k) {
      var el  = document.getElementById(mapa[k]);
      var dot = el && el.querySelector('.mpag-radio-dot');
      if (!el) return;
      if (k === tipo) {
        el.classList.add('mpag-radio-active');
        if (dot) dot.classList.add('mpag-radio-dot-active');
      } else {
        el.classList.remove('mpag-radio-active');
        if (dot) dot.classList.remove('mpag-radio-dot-active');
      }
    });
  }

  /* ─────────────────────────────────────────
     Mostrar/ocultar controle de porcentagem
  ───────────────────────────────────────── */
  function _mpagAtualizarVisibilidadePct(tipo) {
    var row = document.querySelector('.mpag-pct-row');
    if (!row) return;
    // Mostra para 'personalizado'; esconde para 'total' e 'fixo'
    row.style.display = (tipo === 'personalizado') ? 'flex' : 'none';
  }

  /* ─────────────────────────────────────────
     Atualizar texto informativo
  ───────────────────────────────────────── */
  function _mpagAtualizarInfoBar() {
    var el = document.getElementById('mpag-info-text');
    if (!el) return;
    var pct = window.mpagPct || 50;
    if (_cfg.tipoValor === 'total') {
      el.textContent = 'O cliente pagará 100% do valor do serviço para confirmar o agendamento.';
    } else if (_cfg.tipoValor === 'fixo') {
      el.textContent = 'O cliente pagará um valor fixo definido por serviço para confirmar o agendamento.';
    } else {
      el.textContent = 'O cliente pagará ' + pct + '% do valor do serviço para confirmar o agendamento.';
    }
  }

  /* ─────────────────────────────────────────
     Atualizar painel de Resumo (lateral)
  ───────────────────────────────────────── */
  function _mpagAtualizarResumo() {
    /* Reembolso automático no resumo */
    var elReemb = document.querySelector('.mpag-resumo-green');
    if (elReemb) {
      elReemb.textContent = _cfg.reembolso ? 'Ativado' : 'Desativado';
      elReemb.style.color = _cfg.reembolso ? '' : 'var(--red, #ef4444)';
    }
  }

  /* ─────────────────────────────────────────
     Flash de salvo
  ───────────────────────────────────────── */
  function _mpagFlashSalvo() {
    var btn = document.getElementById('mpag-btn-salvar');
    if (btn) {
      btn.textContent = '✓ Salvo!';
      btn.style.background = '#10b981';
      setTimeout(function () {
        btn.textContent      = 'Salvar configurações';
        btn.style.background = '';
      }, 2500);
    }
  }

  /* ─────────────────────────────────────────
     Substituir mpagChangePct para também
     atualizar _cfg e a info bar
  ───────────────────────────────────────── */
  window.mpagChangePct = function (delta) {
    window.mpagPct = Math.max(10, Math.min(100, (window.mpagPct || 50) + delta));
    _cfg.porcentagem = window.mpagPct;
    var el = document.getElementById('mpag-pct-display');
    if (el) el.textContent = window.mpagPct + '%';
    _mpagAtualizarInfoBar();
  };

  /* ─────────────────────────────────────────
     Injetar botão "Salvar configurações" na
     página de pagamentos (abaixo do bloco de
     reembolso, antes do fim do mpag-col-left)
  ───────────────────────────────────────── */
  function _mpagInjetarBotaoSalvar() {
    if (document.getElementById('mpag-btn-salvar')) return; // já existe

    var colLeft = document.querySelector('.mpag-col-left');
    if (!colLeft) return;

    var wrapper = document.createElement('div');
    wrapper.style.cssText = [
      'display:flex',
      'align-items:center',
      'gap:14px',
      'padding:4px 0 20px',
    ].join(';');

    var btn = document.createElement('button');
    btn.id        = 'mpag-btn-salvar';
    btn.type      = 'button';
    btn.textContent = 'Salvar configurações';
    btn.onclick   = mpagSalvar;
    btn.style.cssText = [
      'display:flex',
      'align-items:center',
      'gap:8px',
      'background:var(--accent,#2563eb)',
      'color:#fff',
      'border:none',
      'padding:10px 22px',
      'border-radius:10px',
      'font-size:13.5px',
      'font-weight:600',
      'cursor:pointer',
      'font-family:inherit',
      'transition:background .18s,opacity .18s',
      'box-shadow:0 2px 12px rgba(37,99,235,.35)',
    ].join(';');

    // SVG de check
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="flex-shrink:0"><path d="M2 7l3.5 3.5L12 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> Salvar configurações';

    wrapper.appendChild(btn);
    colLeft.appendChild(wrapper);
  }

  /* ─────────────────────────────────────────
     Vincular eventos aos controles existentes
  ───────────────────────────────────────── */
  function _mpagVincularEventos() {

    /* Toggle — Pagamento adiantado */
    var togAdiantado = document.getElementById('mpag-toggle-adiantado');
    if (togAdiantado) {
      togAdiantado.addEventListener('change', function () {
        _cfg.adiantado = this.checked;
        _mpagAtualizarConteudoAdiantado(this.checked);
      });
    }

    /* Radio buttons */
    var radios = document.querySelectorAll('input[name="mpag-valor"]');
    radios.forEach(function (r) {
      r.addEventListener('change', function () {
        _cfg.tipoValor = this.value;
        _mpagAtualizarEstiloRadios(this.value);
        _mpagAtualizarVisibilidadePct(this.value);
        _mpagAtualizarInfoBar();
      });
    });

    /* Clique nos labels dos radio buttons (melhor UX) */
    ['mpag-opt-total','mpag-opt-personalizado','mpag-opt-fixo'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('click', function () {
        var radio = this.querySelector('input[type="radio"]');
        if (radio) {
          radio.checked  = true;
          _cfg.tipoValor = radio.value;
          _mpagAtualizarEstiloRadios(radio.value);
          _mpagAtualizarVisibilidadePct(radio.value);
          _mpagAtualizarInfoBar();
        }
      });
    });

    /* Toggles de reembolso — os elementos são <label> wrappando <input> */
    /* Precisamos dar IDs às checkboxes do HTML. Como o HTML não tem IDs
       nessas checkboxes, vamos selecioná-las por posição dentro do bloco */
    var blocoReembolso = document.querySelector('.mpag-reimb-list');
    if (blocoReembolso) {
      var checkboxes = blocoReembolso.querySelectorAll('input[type="checkbox"]');
      if (checkboxes[0]) {
        checkboxes[0].id = 'mpag-toggle-reembolso-cliente';
        checkboxes[0].addEventListener('change', function () {
          _cfg.reembolsoCliente = this.checked;
          _mpagAtualizarResumo();
        });
      }
      if (checkboxes[1]) {
        checkboxes[1].id = 'mpag-toggle-reembolso-negocio';
        checkboxes[1].addEventListener('change', function () {
          _cfg.reembolsoNegocio = this.checked;
          _mpagAtualizarResumo();
        });
      }
    }

    /* Toggle principal de reembolso automático */
    var togReembolso = document.querySelector('.mpag-block:nth-child(3) .mpag-toggle-main-row input[type="checkbox"]');
    if (togReembolso) {
      togReembolso.id = 'mpag-toggle-reembolso-main';
      togReembolso.addEventListener('change', function () {
        _cfg.reembolso = this.checked;
        _mpagAtualizarResumo();
      });
    }

    /* Botão "Ver pagamentos recebidos" → abre histórico (placeholder) */
    var btnVer = document.querySelector('.mpag-ver-btn');
    if (btnVer) {
      btnVer.style.cursor = 'pointer';
      btnVer.addEventListener('click', function () {
        alert('Histórico de pagamentos: em breve disponível no painel.');
      });
    }
  }

  /* ─────────────────────────────────────────
     renderPagamentos — substituir a função
     original que era para a UI antiga
  ───────────────────────────────────────── */
  window.renderPagamentos = function () {
    _mpagInjetarBotaoSalvar();
    _mpagVincularEventos();
    mpagCarregar();
  };

  /* ─────────────────────────────────────────
     Hook: quando a página de pagamentos for
     aberta via irPara(), carregar os dados
  ───────────────────────────────────────── */
  var _irParaOriginal = window.irPara;
  window.irPara = function (pagina, btn) {
    _irParaOriginal(pagina, btn);
    if (pagina === 'pagamentos') {
      // Pequeno delay para o DOM estar visível
      setTimeout(function () {
        _mpagInjetarBotaoSalvar();
        _mpagVincularEventos();
        mpagCarregar();
      }, 80);
    }
  };

  /* ─────────────────────────────────────────
     Se a página de pagamentos já estiver ativa
     ao carregar (ex: deep link), inicializar
  ───────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    var pagePag = document.getElementById('page-pagamentos');
    if (pagePag && pagePag.classList.contains('ativo')) {
      _mpagInjetarBotaoSalvar();
      _mpagVincularEventos();
      mpagCarregar();
    }
  });

})();