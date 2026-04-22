/**
 * pagamentos-fix.js
 * Integra a página de Pagamentos com a API backend.
 * Salva e carrega: adiantado, tipoValor, porcentagem,
 * valorFixo, reembolso, reembolsoCliente, reembolsoVoce.
 */

(function () {
  'use strict';

  // ─── Helpers ─────────────────────────────────────────────────────────────
  function getToken() {
    return localStorage.getItem('token')
      || localStorage.getItem('authToken')
      || sessionStorage.getItem('token')
      || getCookie('token');
  }
  function getCookie(name) {
    const m = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return m ? m[2] : null;
  }
  function getNegocioId() {
    try {
      return localStorage.getItem('negocioAtivo')
        || localStorage.getItem('negocioId')
        || localStorage.getItem('negocio_id')
        || null;
    } catch (_) { return null; }
  }
  function authHeaders() {
    const t = getToken();
    const h = { 'Content-Type': 'application/json' };
    if (t) h['Authorization'] = 'Bearer ' + t;
    return h;
  }
  function apiUrl(path) {
    const base = (typeof API !== 'undefined' ? API : '') || '';
    return base + path;
  }

  // ─── Toast ────────────────────────────────────────────────────────────────
  function toast(msg, tipo) {
    const old = document.getElementById('mpag-toast');
    if (old) old.remove();
    const el = document.createElement('div');
    el.id = 'mpag-toast';
    const bg = tipo === 'erro' ? '#ef4444' : '#22c55e';
    el.style.cssText = [
      'position:fixed;bottom:28px;right:24px',
      'padding:13px 22px;border-radius:12px',
      'font-size:13.5px;font-weight:600;color:#fff',
      'z-index:99999;box-shadow:0 4px 24px rgba(0,0,0,.35)',
      'background:' + bg,
      'transition:opacity .35s;pointer-events:none;font-family:inherit'
    ].join(';');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () {
      el.style.opacity = '0';
      setTimeout(function () { el.remove(); }, 400);
    }, 3000);
  }

  // ─── Estado ───────────────────────────────────────────────────────────────
  var cfg = {
    adiantado: false,
    tipoValor: 'total',
    porcentagem: 50,
    valorFixo: 0,
    reembolso: true,
    reembolsoCliente: true,
    reembolsoVoce: true,
  };
  var salvando = false;

  // ─── Referências sem ID — pelo seletor estrutural ─────────────────────────
  function getToggleReembolsoPrincipal() {
    var bloco = document.querySelectorAll('.mpag-block')[2];
    return bloco
      ? bloco.querySelector('.mpag-toggle-main-row input[type="checkbox"]')
      : null;
  }
  function getToggleReembolsoCliente() {
    var items = document.querySelectorAll('.mpag-reimb-item');
    return items[0] ? items[0].querySelector('input[type="checkbox"]') : null;
  }
  function getToggleReembolsoVoce() {
    var items = document.querySelectorAll('.mpag-reimb-item');
    return items[1] ? items[1].querySelector('input[type="checkbox"]') : null;
  }

  // ─── Aplicar cfg na tela ─────────────────────────────────────────────────
  function aplicarNaTela() {
    var tA = document.getElementById('mpag-toggle-adiantado');
    if (tA) {
      tA.checked = cfg.adiantado;
      atualizarVisibilidadeAdiantado(cfg.adiantado);
    }

    atualizarRadios(cfg.tipoValor);

    var pctEl = document.getElementById('mpag-pct-display');
    if (pctEl) pctEl.textContent = cfg.porcentagem + '%';

    atualizarInfoBar();

    var tR  = getToggleReembolsoPrincipal();
    var tRC = getToggleReembolsoCliente();
    var tRV = getToggleReembolsoVoce();
    if (tR)  tR.checked  = cfg.reembolso;
    if (tRC) tRC.checked = cfg.reembolsoCliente;
    if (tRV) tRV.checked = cfg.reembolsoVoce;

    atualizarResumo();
  }

  function atualizarVisibilidadeAdiantado(ativo) {
    var c = document.getElementById('mpag-adiantado-content');
    if (c) c.style.display = ativo ? 'block' : 'none';
  }

  function atualizarRadios(valor) {
    var ids = { total: 'mpag-opt-total', personalizado: 'mpag-opt-personalizado', fixo: 'mpag-opt-fixo' };
    Object.keys(ids).forEach(function (k) {
      var el = document.getElementById(ids[k]);
      if (!el) return;
      var ativo = k === valor;
      el.classList.toggle('mpag-radio-active', ativo);
      var dot = el.querySelector('.mpag-radio-dot');
      if (dot) dot.classList.toggle('mpag-radio-dot-active', ativo);
      var radio = el.querySelector('input[type="radio"]');
      if (radio) radio.checked = ativo;
    });
  }

  function atualizarInfoBar() {
    var el = document.getElementById('mpag-info-text');
    if (!el) return;
    if (cfg.tipoValor === 'total') {
      el.textContent = 'O cliente pagará 100% do valor do serviço para confirmar o agendamento.';
    } else if (cfg.tipoValor === 'personalizado') {
      el.textContent = 'O cliente pagará ' + cfg.porcentagem + '% do valor do serviço para confirmar o agendamento.';
    } else {
      var v = Number(cfg.valorFixo).toFixed(2).replace('.', ',');
      el.textContent = 'O cliente pagará R$ ' + v + ' para confirmar o agendamento.';
    }
  }

  function atualizarResumo() {
    document.querySelectorAll('.mpag-resumo-row').forEach(function (row) {
      var key = row.querySelector('.mpag-resumo-key');
      var val = row.querySelector('.mpag-resumo-val');
      if (!key || !val) return;
      if (key.textContent.trim() === 'Reembolso automático') {
        val.textContent = cfg.reembolso ? 'Ativado' : 'Desativado';
        val.className   = 'mpag-resumo-val' + (cfg.reembolso ? ' mpag-resumo-green' : '');
      }
    });
  }

  // ─── Controle de porcentagem (chamado pelo onclick do HTML) ───────────────
  window.mpagChangePct = function (delta) {
    cfg.porcentagem = Math.min(100, Math.max(10, cfg.porcentagem + delta));
    var el = document.getElementById('mpag-pct-display');
    if (el) el.textContent = cfg.porcentagem + '%';
    atualizarInfoBar();
  };

  // ─── Ler tela → cfg ──────────────────────────────────────────────────────
  function lerDaTela() {
    var tA = document.getElementById('mpag-toggle-adiantado');
    if (tA) cfg.adiantado = tA.checked;

    var r = document.querySelector('input[name="mpag-valor"]:checked');
    if (r) cfg.tipoValor = r.value;

    var pctEl = document.getElementById('mpag-pct-display');
    if (pctEl) {
      var v = parseInt(pctEl.textContent);
      if (!isNaN(v)) cfg.porcentagem = v;
    }

    var tR  = getToggleReembolsoPrincipal();
    var tRC = getToggleReembolsoCliente();
    var tRV = getToggleReembolsoVoce();
    if (tR)  cfg.reembolso        = tR.checked;
    if (tRC) cfg.reembolsoCliente = tRC.checked;
    if (tRV) cfg.reembolsoVoce    = tRV.checked;
  }

  // ─── Carregar do backend ──────────────────────────────────────────────────
  async function carregarConfig() {
    try {
      var nid = getNegocioId();
      var qs  = nid ? '?negocioId=' + nid : '';
      var res = await fetch(apiUrl('/api/pagamentos/config') + qs, { headers: authHeaders() });
      if (!res.ok) {
        if (res.status === 401) return;
        throw new Error('HTTP ' + res.status);
      }
      var data = await res.json();
      if (data && data.config) cfg = Object.assign({}, cfg, data.config);
      console.log('[pagamentos-fix] Config carregada:', cfg);
      aplicarNaTela();
    } catch (e) {
      console.warn('[pagamentos-fix] Usando defaults:', e.message);
    }
  }

  // ─── Salvar no backend ────────────────────────────────────────────────────
  async function salvarConfig() {
    if (salvando) return;
    salvando = true;

    var btn = document.getElementById('mpag-btn-salvar');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; btn.style.opacity = '.7'; }

    lerDaTela();

    try {
      var nid  = getNegocioId();
      var body = { config: cfg };
      if (nid) body.negocioId = nid;

      var res = await fetch(apiUrl('/api/pagamentos/config'), {
        method:  'POST',
        headers: authHeaders(),
        body:    JSON.stringify(body),
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.message || 'HTTP ' + res.status);

      toast('✓ Configurações salvas!', 'ok');
    } catch (e) {
      console.error('[pagamentos-fix] Erro ao salvar:', e);
      toast('Erro ao salvar. Tente novamente.', 'erro');
    } finally {
      salvando = false;
      if (btn) { btn.disabled = false; btn.textContent = 'Salvar configurações'; btn.style.opacity = '1'; }
    }
  }

  // ─── Injetar botão Salvar no rodapé da seção ─────────────────────────────
  function injetarBotaoSalvar() {
    if (document.getElementById('mpag-btn-salvar')) return;
    var page = document.getElementById('page-pagamentos');
    if (!page) return;

    var bar = document.createElement('div');
    bar.style.cssText = [
      'display:flex;justify-content:flex-end;align-items:center;gap:14px',
      'margin-top:24px;padding:18px 0 4px',
      'border-top:1px solid rgba(255,255,255,.07)'
    ].join(';');

    var btn = document.createElement('button');
    btn.id   = 'mpag-btn-salvar';
    btn.type = 'button';
    btn.textContent = 'Salvar configurações';
    btn.style.cssText = [
      'display:inline-flex;align-items:center;gap:8px',
      'background:#2563eb;color:#fff;border:none',
      'padding:10px 24px;border-radius:10px',
      'font-size:13.5px;font-weight:600;cursor:pointer',
      'font-family:inherit;transition:all .18s',
      'box-shadow:0 2px 12px rgba(37,99,235,.35)'
    ].join(';');
    btn.onmouseenter = function () { btn.style.background = '#1d4ed8'; };
    btn.onmouseleave = function () { btn.style.background = '#2563eb'; };
    btn.onclick = salvarConfig;

    bar.appendChild(btn);

    var grid = page.querySelector('.mpag-grid');
    if (grid) grid.after(bar);
    else page.appendChild(bar);
  }

  // ─── Registrar eventos nos controles ─────────────────────────────────────
  function registrarEventos() {
    // Toggle adiantado
    var tA = document.getElementById('mpag-toggle-adiantado');
    if (tA) {
      tA.addEventListener('change', function () {
        cfg.adiantado = tA.checked;
        atualizarVisibilidadeAdiantado(tA.checked);
      });
    }

    // Radios de valor — via input
    document.querySelectorAll('input[name="mpag-valor"]').forEach(function (r) {
      r.addEventListener('change', function () {
        cfg.tipoValor = r.value;
        atualizarRadios(r.value);
        atualizarInfoBar();
      });
    });

    // Clique nos labels visuais
    ['mpag-opt-total', 'mpag-opt-personalizado', 'mpag-opt-fixo'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('click', function () {
        var radio = el.querySelector('input[type="radio"]');
        if (!radio) return;
        radio.checked = true;
        cfg.tipoValor = radio.value;
        atualizarRadios(radio.value);
        atualizarInfoBar();
      });
    });

    // Toggles de reembolso
    var tR  = getToggleReembolsoPrincipal();
    var tRC = getToggleReembolsoCliente();
    var tRV = getToggleReembolsoVoce();
    if (tR)  tR.addEventListener('change',  function () { cfg.reembolso        = tR.checked;  atualizarResumo(); });
    if (tRC) tRC.addEventListener('change', function () { cfg.reembolsoCliente = tRC.checked; });
    if (tRV) tRV.addEventListener('change', function () { cfg.reembolsoVoce    = tRV.checked; });
  }

  // ─── Init ─────────────────────────────────────────────────────────────────
  async function init() {
    // Pequeno delay para o painel.js terminar de montar o negócio
    await new Promise(function (r) { setTimeout(r, 350); });

    injetarBotaoSalvar();
    registrarEventos();
    await carregarConfig();

    // Re-carrega ao navegar para a aba de pagamentos
    document.addEventListener('click', function (e) {
      var menuBtn = e.target.closest && e.target.closest('#menu-pagamentos');
      if (menuBtn) setTimeout(carregarConfig, 300);
    });

    console.log('[pagamentos-fix] ✓ OK');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.PagamentosFix = { salvar: salvarConfig, carregar: carregarConfig };
})();