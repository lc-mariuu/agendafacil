/* ═══════════════════════════════════════════════════════════════
   pagamentos-fix.js — substitui as funções de pagamento do painel.js
   Cole em public/pagamentos-fix.js · carregue DEPOIS do painel.js
═══════════════════════════════════════════════════════════════ */

var mpagState = {
  adiantadoAtivo:   true,
  tipoValor:        'total',
  porcentagem:      50,
  valorFixo:        50.00,
  reembolsoAtivo:   true,
  reembolsoCliente: true,
  reembolsoNegocio: true,
  salvando:         false,
}

var TAXA_SAAS_CENTAVOS = 50

// ─── renderPagamentos — chamada toda vez que a aba abre ──────────────────────
window.renderPagamentos = function () {
  mpagInjetarHTML()
  carregarPagamentosConfig()
}

// ─── Carrega config do backend ───────────────────────────────────────────────
window.carregarPagamentosConfig = async function () {
  if (!window.negocioAtual) return
  try {
    var token = localStorage.getItem('token')
    var res = await fetch(window.API + '/pagamento/config/' + window.negocioAtual._id, {
      headers: { 'Authorization': 'Bearer ' + token }
    })
    if (!res.ok) return
    var cfg = await res.json()

    if (cfg.adiantado        !== undefined) mpagState.adiantadoAtivo    = !!cfg.adiantado
    if (cfg.tipoValor)                      mpagState.tipoValor          = cfg.tipoValor
    if (cfg.porcentagem      !== undefined) mpagState.porcentagem        = Number(cfg.porcentagem) || 50
    if (cfg.valorFixo        !== undefined) mpagState.valorFixo          = Number(cfg.valorFixo)   || 50
    if (cfg.reembolso        !== undefined) mpagState.reembolsoAtivo     = !!cfg.reembolso
    if (cfg.reembolsoCliente !== undefined) mpagState.reembolsoCliente   = !!cfg.reembolsoCliente
    if (cfg.reembolsoNegocio !== undefined) mpagState.reembolsoNegocio   = !!cfg.reembolsoNegocio

    window.pagamentosConfig = cfg.servicos || {}
    _mpagSincronizarUI()
  } catch (e) {
    console.error('[carregarPagamentosConfig]', e.message)
  }
}

// ─── Salvar no backend ───────────────────────────────────────────────────────
window.mpagSalvar = async function () {
  if (!window.negocioAtual || mpagState.salvando) return
  mpagState.salvando = true
  var btn = document.getElementById('mpag-btn-salvar')
  var origHTML = btn ? btn.innerHTML : ''
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando...' }
  try {
    var token = localStorage.getItem('token')
    var res = await fetch(window.API + '/pagamento/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({
        negocioId:        window.negocioAtual._id,
        adiantado:        mpagState.adiantadoAtivo,
        tipoValor:        mpagState.tipoValor,
        porcentagem:      mpagState.porcentagem,
        valorFixo:        mpagState.valorFixo,
        reembolso:        mpagState.reembolsoAtivo,
        reembolsoCliente: mpagState.reembolsoCliente,
        reembolsoNegocio: mpagState.reembolsoNegocio,
        taxaSaasCentavos: TAXA_SAAS_CENTAVOS,
      })
    })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    if (btn) {
      btn.innerHTML = '&#10003; Salvo!'
      btn.style.background = '#059669'
      setTimeout(function () { btn.innerHTML = origHTML; btn.style.background = ''; btn.disabled = false }, 2500)
    }
    _mpagAtualizarResumo()
  } catch (e) {
    console.error('[mpagSalvar]', e.message)
    if (btn) {
      btn.textContent = 'Erro ao salvar'
      btn.style.background = '#dc2626'
      setTimeout(function () { btn.innerHTML = origHTML; btn.style.background = ''; btn.disabled = false }, 2500)
    }
  } finally {
    mpagState.salvando = false
  }
}

// ─── Toggles ─────────────────────────────────────────────────────────────────
window.mpagToggleAdiantado = function (cb) {
  mpagState.adiantadoAtivo = cb.checked
  _mpagAtualizarConteudoAdiantado()
  _mpagAtualizarInfoBar()
  _mpagAtualizarResumo()
}

function _mpagAtualizarConteudoAdiantado () {
  var c = document.getElementById('mpag-adiantado-content')
  if (!c) return
  c.style.opacity       = mpagState.adiantadoAtivo ? '1' : '0.35'
  c.style.pointerEvents = mpagState.adiantadoAtivo ? 'all' : 'none'
}

window.mpagSelecionarTipo = function (tipo) {
  mpagState.tipoValor = tipo
  _mpagSincronizarRadios()
  _mpagSincronizarPct()
  _mpagAtualizarInfoBar()
  _mpagAtualizarResumo()
}

function _mpagSincronizarRadios () {
  document.querySelectorAll('.mpag-radio-opt').forEach(function (opt) {
    var radio = opt.querySelector('input[type=radio]')
    var dot   = opt.querySelector('.mpag-radio-dot')
    if (!radio) return
    var ativo = radio.value === mpagState.tipoValor
    opt.classList.toggle('mpag-radio-active', ativo)
    if (dot) dot.classList.toggle('mpag-radio-dot-active', ativo)
    radio.checked = ativo
  })
}

window.mpagChangePct = function (delta) {
  if (mpagState.tipoValor === 'total') { mpagState.porcentagem = 100 }
  else { mpagState.porcentagem = Math.max(5, Math.min(100, mpagState.porcentagem + delta)) }
  _mpagSincronizarPct()
  _mpagAtualizarInfoBar()
  _mpagAtualizarResumo()
}

function _mpagSincronizarPct () {
  var el      = document.getElementById('mpag-pct-display')
  var pctRow  = document.getElementById('mpag-pct-row')
  var fixRow  = document.getElementById('mpag-fixo-row')

  if (mpagState.tipoValor === 'total') {
    mpagState.porcentagem = 100
    if (el) el.textContent = '100%'
    if (pctRow) pctRow.style.display = 'flex'
    if (fixRow) fixRow.style.display = 'none'
  } else if (mpagState.tipoValor === 'personalizado') {
    if (el) el.textContent = mpagState.porcentagem + '%'
    if (pctRow) pctRow.style.display = 'flex'
    if (fixRow) fixRow.style.display = 'none'
  } else {
    if (pctRow) pctRow.style.display = 'none'
    if (fixRow) fixRow.style.display = 'flex'
    var inp = document.getElementById('mpag-fixo-input')
    if (inp) inp.value = mpagState.valorFixo.toFixed(2).replace('.', ',')
  }
}

window.mpagChangeFixo = function (delta) {
  mpagState.valorFixo = Math.max(1, parseFloat((mpagState.valorFixo + delta).toFixed(2)))
  var inp = document.getElementById('mpag-fixo-input')
  if (inp) inp.value = mpagState.valorFixo.toFixed(2).replace('.', ',')
  _mpagAtualizarInfoBar()
  _mpagAtualizarResumo()
}

window.mpagSetFixo = function (val) {
  var n = parseFloat(String(val).replace(',', '.'))
  if (!isNaN(n) && n > 0) { mpagState.valorFixo = parseFloat(n.toFixed(2)); _mpagAtualizarInfoBar(); _mpagAtualizarResumo() }
}

window.mpagToggleReembolso = function (cb) {
  mpagState.reembolsoAtivo = cb.checked
  var lista = document.getElementById('mpag-reimb-list')
  if (lista) { lista.style.opacity = cb.checked ? '1' : '0.35'; lista.style.pointerEvents = cb.checked ? 'all' : 'none' }
  _mpagAtualizarResumo()
}

window.mpagToggleReembolsoCliente = function (cb) { mpagState.reembolsoCliente = cb.checked; _mpagAtualizarResumo() }
window.mpagToggleReembolsoNegocio  = function (cb) { mpagState.reembolsoNegocio  = cb.checked; _mpagAtualizarResumo() }

function _mpagAtualizarInfoBar () {
  var el = document.getElementById('mpag-info-text')
  if (!el) return
  if (!mpagState.adiantadoAtivo) { el.textContent = 'O pagamento antecipado está desativado. O cliente pagará no momento do atendimento.'; return }
  if (mpagState.tipoValor === 'total')              el.textContent = 'O cliente pagará 100% do valor do serviço para confirmar o agendamento.'
  else if (mpagState.tipoValor === 'personalizado') el.textContent = 'O cliente pagará ' + mpagState.porcentagem + '% do valor do serviço para confirmar o agendamento.'
  else                                              el.textContent = 'O cliente pagará R$ ' + mpagState.valorFixo.toFixed(2).replace('.', ',') + ' para confirmar o agendamento.'
}

function _mpagAtualizarResumo () {
  function set (id, txt) { var el = document.getElementById(id); if (el) el.textContent = txt }
  set('mpag-resumo-meio',  'PIX via Mercado Pago')
  set('mpag-resumo-taxa',  'R$ 0,50 + 0,99% (MP)')
  set('mpag-resumo-prazo', 'Instantâneo')
  var elR = document.getElementById('mpag-resumo-reembolso')
  if (elR) { elR.textContent = mpagState.reembolsoAtivo ? 'Ativado' : 'Desativado'; elR.style.color = mpagState.reembolsoAtivo ? '#34d399' : '#f87171' }
  var v = '—'
  if (mpagState.adiantadoAtivo) {
    if (mpagState.tipoValor === 'total')              v = '100% do serviço'
    else if (mpagState.tipoValor === 'personalizado') v = mpagState.porcentagem + '% do serviço'
    else                                              v = 'R$ ' + mpagState.valorFixo.toFixed(2).replace('.', ',')
  } else { v = 'Desativado' }
  set('mpag-resumo-valor', v)
}

function _mpagSincronizarUI () {
  var tog = document.getElementById('mpag-toggle-adiantado')
  if (tog) tog.checked = mpagState.adiantadoAtivo
  _mpagAtualizarConteudoAdiantado()
  _mpagSincronizarRadios()
  _mpagSincronizarPct()
  _mpagAtualizarInfoBar()
  _mpagAtualizarResumo()
  var reembs = document.querySelectorAll('#mpag-block-reembolso .mpag-toggle-sw input')
  if (reembs[0]) reembs[0].checked = mpagState.reembolsoAtivo
  if (reembs[1]) reembs[1].checked = mpagState.reembolsoCliente
  if (reembs[2]) reembs[2].checked = mpagState.reembolsoNegocio
  var lista = document.getElementById('mpag-reimb-list')
  if (lista) { lista.style.opacity = mpagState.reembolsoAtivo ? '1' : '0.35'; lista.style.pointerEvents = mpagState.reembolsoAtivo ? 'all' : 'none' }
}

// ─── HTML completo ────────────────────────────────────────────────────────────
function mpagInjetarHTML () {
  var section = document.getElementById('page-pagamentos')
  if (!section) return
  section.innerHTML = [
    '<div class="mpag-hero">',
      '<div class="mpag-hero-left">',
        '<div class="mpag-hero-icon-wrap">',
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none">',
            '<rect x="2" y="5" width="20" height="16" rx="3" stroke="#34d399" stroke-width="1.8"/>',
            '<path d="M2 10h20" stroke="#34d399" stroke-width="1.8" stroke-linecap="round"/>',
            '<path d="M6 15h4" stroke="#34d399" stroke-width="1.8" stroke-linecap="round"/>',
          '</svg>',
        '</div>',
        '<div>',
          '<div class="mpag-hero-title">Pagamentos</div>',
          '<div class="mpag-hero-sub">Receba pagamentos antecipados e garanta mais seguran\u00e7a<br>para o seu neg\u00f3cio e para seus clientes.</div>',
        '</div>',
      '</div>',
      '<div class="mpag-hero-right">',
        '<div class="mpag-card-white">',
          '<div class="mpag-card-white-title">Pagamento 100% seguro</div>',
          '<div class="mpag-card-white-sub">Processado pelo</div>',
          '<div class="mpag-card-white-logos">',
            '<div class="mpag-logo-mp">',
              '<svg width="22" height="22" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="14" fill="#009ee3"/><path d="M9 16a7 7 0 1 1 14 0" stroke="white" stroke-width="2.5" stroke-linecap="round"/><circle cx="16" cy="16" r="2.5" fill="white"/></svg>',
              '<div class="mpag-logo-mp-text"><span>mercado</span><span>pago</span></div>',
            '</div>',
            '<div class="mpag-logo-pix">',
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 3L3 12l9 9 9-9-9-9Z" stroke="#32BCAD" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 12l2 2 4-4" stroke="#32BCAD" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
              '<span class="mpag-logo-pix-text">PIX</span>',
            '</div>',
          '</div>',
        '</div>',
      '</div>',
    '</div>',

    '<div class="mpag-grid">',
    '<div class="mpag-col-left">',

    /* BLOCO 1 */
    '<div class="mpag-block"><div class="mpag-block-body">',
      '<div class="mpag-toggle-main-row">',
        '<div>',
          '<div class="mpag-section-title">Pagamento adiantado</div>',
          '<div class="mpag-section-sub">Ative para solicitar pagamento antecipado no momento do agendamento.</div>',
        '</div>',
        '<label class="mpag-toggle-sw">',
          '<input type="checkbox" id="mpag-toggle-adiantado" onchange="mpagToggleAdiantado(this)">',
          '<span class="mpag-toggle-track"><span class="mpag-toggle-thumb"></span></span>',
        '</label>',
      '</div>',
      '<div id="mpag-adiantado-content">',
        '<div class="mpag-subsection-title">Valor a ser cobrado</div>',
        '<div class="mpag-subsection-sub">Escolha quanto do valor do servi\u00e7o ser\u00e1 cobrado antecipadamente.</div>',
        '<div class="mpag-radio-grid">',
          '<label class="mpag-radio-opt" onclick="mpagSelecionarTipo(\'total\')">',
            '<input type="radio" name="mpag-valor" value="total" hidden>',
            '<div class="mpag-radio-dot"></div>',
            '<div><div class="mpag-radio-label">Valor total</div><div class="mpag-radio-desc">100% do valor do servi\u00e7o</div></div>',
          '</label>',
          '<label class="mpag-radio-opt" onclick="mpagSelecionarTipo(\'personalizado\')">',
            '<input type="radio" name="mpag-valor" value="personalizado" hidden>',
            '<div class="mpag-radio-dot"></div>',
            '<div><div class="mpag-radio-label">Valor personalizado</div><div class="mpag-radio-desc">Definir uma porcentagem</div></div>',
          '</label>',
          '<label class="mpag-radio-opt" onclick="mpagSelecionarTipo(\'fixo\')">',
            '<input type="radio" name="mpag-valor" value="fixo" hidden>',
            '<div class="mpag-radio-dot"></div>',
            '<div><div class="mpag-radio-label">Valor fixo</div><div class="mpag-radio-desc">Definir um valor espec\u00edfico</div></div>',
          '</label>',
        '</div>',
        '<div class="mpag-pct-row" id="mpag-pct-row">',
          '<div>',
            '<div class="mpag-subsection-title" style="margin-bottom:2px">Porcentagem do servi\u00e7o</div>',
            '<div class="mpag-subsection-sub">Defina a porcentagem do valor do servi\u00e7o que ser\u00e1 cobrada antecipadamente.</div>',
          '</div>',
          '<div class="mpag-pct-control">',
            '<button class="mpag-pct-btn" onclick="mpagChangePct(-10)" type="button">\u2212</button>',
            '<div class="mpag-pct-value" id="mpag-pct-display">50%</div>',
            '<button class="mpag-pct-btn" onclick="mpagChangePct(10)" type="button">+</button>',
          '</div>',
        '</div>',
        '<div class="mpag-pct-row" id="mpag-fixo-row" style="display:none">',
          '<div>',
            '<div class="mpag-subsection-title" style="margin-bottom:2px">Valor fixo (R$)</div>',
            '<div class="mpag-subsection-sub">O cliente paga exatamente esse valor para confirmar o agendamento.</div>',
          '</div>',
          '<div class="mpag-pct-control">',
            '<button class="mpag-pct-btn" onclick="mpagChangeFixo(-10)" type="button">\u2212</button>',
            '<div class="mpag-pct-value" style="min-width:80px">',
              '<input id="mpag-fixo-input" type="text" value="50,00"',
              ' style="background:none;border:none;outline:none;font-size:13px;font-weight:800;color:var(--text);text-align:center;width:70px;font-family:inherit"',
              ' onchange="mpagSetFixo(this.value)" oninput="mpagSetFixo(this.value)">',
            '</div>',
            '<button class="mpag-pct-btn" onclick="mpagChangeFixo(10)" type="button">+</button>',
          '</div>',
        '</div>',
        '<div class="mpag-info-bar">',
          '<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="#60a5fa" stroke-width="1.4"/><path d="M8 7v4M8 5.5v.5" stroke="#60a5fa" stroke-width="1.5" stroke-linecap="round"/></svg>',
          '<span id="mpag-info-text">O cliente pagar\u00e1 50% do valor do servi\u00e7o para confirmar o agendamento.</span>',
        '</div>',
      '</div>',
    '</div></div>',

    /* BLOCO 2 */
    '<div class="mpag-block"><div class="mpag-block-body">',
      '<div class="mpag-subsection-title" style="margin-bottom:4px">Forma de pagamento</div>',
      '<div class="mpag-subsection-sub" style="margin-bottom:14px">Receba pagamentos via Mercado Pago.</div>',
      '<div class="mpag-fp-card">',
        '<div class="mpag-fp-row">',
          '<div class="mpag-fp-icon"><svg width="22" height="22" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="8" fill="#009ee3"/><path d="M8 16a8 8 0 1 1 16 0" stroke="white" stroke-width="2.5" stroke-linecap="round"/><circle cx="16" cy="16" r="3" fill="white"/></svg></div>',
          '<div class="mpag-fp-info"><div class="mpag-fp-name">PIX <span class="mpag-fp-badge-mp">Mercado Pago</span></div><div class="mpag-fp-sub">Pagamento instant\u00e2neo</div></div>',
          '<div class="mpag-fp-divider"></div>',
          '<div class="mpag-fp-desc">O pagamento \u00e9 confirmado na hora e o agendamento \u00e9 liberado automaticamente.<small style="color:var(--text3);margin-top:4px;display:block">Taxa: R$ 0,50 (plataforma) + 0,99% (Mercado Pago) por transa\u00e7\u00e3o.</small></div>',
          '<div class="mpag-fp-status"><span class="mpag-badge-ativo">Ativo</span><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="rgba(255,255,255,0.35)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>',
        '</div>',
        '<div class="mpag-fp-security"><svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 1.5L2 4v6c0 3.5 2.6 6.8 6 7.5 3.4-.7 6-4 6-7.5V4L8 1.5Z" stroke="rgba(255,255,255,0.25)" stroke-width="1.3" stroke-linejoin="round"/></svg><span>Seus pagamentos s\u00e3o processados com seguran\u00e7a pelo Mercado Pago.</span></div>',
      '</div>',
      '<div style="margin-top:14px;padding:13px 16px;border-radius:10px;background:rgba(245,158,11,0.07);border:1px solid rgba(245,158,11,0.22);display:flex;align-items:flex-start;gap:10px">',
        '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink:0;margin-top:1px"><circle cx="8" cy="8" r="6.5" stroke="#f59e0b" stroke-width="1.4"/><path d="M8 5v3.5M8 11v.5" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round"/></svg>',
        '<div><div style="font-size:12.5px;font-weight:700;color:#f59e0b;margin-bottom:3px">Taxa de plataforma: R$ 0,50 por transa\u00e7\u00e3o</div><div style="font-size:12px;color:var(--text2);line-height:1.55">A cada pagamento confirmado, R$ 0,50 s\u00e3o descontados antes do repasse. Exemplo: servi\u00e7o de R$ 100 \u2192 voc\u00ea recebe R$ 99,50 (menos taxa MP).</div></div>',
      '</div>',
    '</div></div>',

    /* BLOCO 3 */
    '<div class="mpag-block" id="mpag-block-reembolso"><div class="mpag-block-body">',
      '<div class="mpag-toggle-main-row" style="margin-bottom:20px">',
        '<div><div class="mpag-section-title">Reembolso autom\u00e1tico</div><div class="mpag-section-sub">Configure o reembolso autom\u00e1tico caso o cliente cancele o agendamento.</div></div>',
        '<label class="mpag-toggle-sw"><input type="checkbox" onchange="mpagToggleReembolso(this)"><span class="mpag-toggle-track"><span class="mpag-toggle-thumb"></span></span></label>',
      '</div>',
      '<div id="mpag-reimb-list">',
        '<div class="mpag-subsection-title" style="margin-bottom:2px">Reembolsar automaticamente quando</div>',
        '<div class="mpag-subsection-sub" style="margin-bottom:14px">O reembolso ser\u00e1 processado de forma autom\u00e1tica nas situa\u00e7\u00f5es abaixo.</div>',
        '<div class="mpag-reimb-list">',
          '<div class="mpag-reimb-item">',
            '<div class="mpag-reimb-icon mpag-reimb-purple"><svg width="17" height="17" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="16" height="16" rx="8" fill="rgba(139,92,246,0.2)"/><path d="M7 13l6-6M13 13L7 7" stroke="#a78bfa" stroke-width="1.6" stroke-linecap="round"/></svg></div>',
            '<div class="mpag-reimb-text"><div class="mpag-reimb-name">Cancelamento pelo cliente</div><div class="mpag-reimb-sub">Reembolso autom\u00e1tico quando o cliente cancelar o agendamento.</div></div>',
            '<label class="mpag-toggle-sw"><input type="checkbox" onchange="mpagToggleReembolsoCliente(this)"><span class="mpag-toggle-track"><span class="mpag-toggle-thumb"></span></span></label>',
          '</div>',
          '<div class="mpag-reimb-item" style="margin-top:10px">',
            '<div class="mpag-reimb-icon mpag-reimb-orange"><svg width="17" height="17" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" fill="rgba(249,115,22,0.2)"/><path d="M10 7v4" stroke="#fb923c" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="14" r="0.8" fill="#fb923c"/></svg></div>',
            '<div class="mpag-reimb-text"><div class="mpag-reimb-name">Cancelamento por voc\u00ea</div><div class="mpag-reimb-sub">Reembolso autom\u00e1tico quando o agendamento for cancelado por voc\u00ea.</div></div>',
            '<label class="mpag-toggle-sw"><input type="checkbox" onchange="mpagToggleReembolsoNegocio(this)"><span class="mpag-toggle-track"><span class="mpag-toggle-thumb"></span></span></label>',
          '</div>',
        '</div>',
        '<div class="mpag-info-bar" style="margin-top:16px"><svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="#60a5fa" stroke-width="1.4"/><path d="M8 7v4M8 5.5v.5" stroke="#60a5fa" stroke-width="1.5" stroke-linecap="round"/></svg><span>O reembolso ser\u00e1 feito automaticamente via PIX para a conta do cliente.</span></div>',
      '</div>',
    '</div></div>',

    /* BOTÃO SALVAR */
    '<div style="display:flex;justify-content:flex-end;margin-top:4px">',
      '<button id="mpag-btn-salvar" onclick="mpagSalvar()" type="button"',
      ' style="display:inline-flex;align-items:center;gap:8px;background:var(--green,#10b981);color:white;',
      'border:none;padding:11px 28px;border-radius:11px;font-size:14px;font-weight:700;',
      'cursor:pointer;font-family:inherit;box-shadow:0 3px 16px rgba(16,185,129,0.35);transition:all .2s">',
        '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L12 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        ' Salvar configura\u00e7\u00f5es',
      '</button>',
    '</div>',

    '</div>', /* /col-left */

    /* COLUNA DIREITA */
    '<div class="mpag-col-right">',
      '<div class="mpag-side-block">',
        '<div class="mpag-side-title">Como funciona</div>',
        '<div class="mpag-steps">',
          '<div class="mpag-step"><div class="mpag-step-icon mpag-step-purple"><svg width="18" height="18" viewBox="0 0 20 20" fill="none"><rect x="2.5" y="3.5" width="15" height="13.5" rx="2.5" stroke="#a78bfa" stroke-width="1.6"/><path d="M2.5 7.5h15M7 2v3M13 2v3" stroke="#a78bfa" stroke-width="1.6" stroke-linecap="round"/></svg></div><div class="mpag-step-body"><div class="mpag-step-title">Cliente faz o agendamento</div><div class="mpag-step-desc">O cliente escolhe o servi\u00e7o, data e hor\u00e1rio.</div></div></div>',
          '<div class="mpag-step"><div class="mpag-step-icon mpag-step-blue"><svg width="18" height="18" viewBox="0 0 20 20" fill="none"><rect x="2" y="5" width="16" height="13" rx="2.5" stroke="#60a5fa" stroke-width="1.6"/><path d="M2 9h16M6 13h4" stroke="#60a5fa" stroke-width="1.6" stroke-linecap="round"/></svg></div><div class="mpag-step-body"><div class="mpag-step-title">Pagamento antecipado</div><div class="mpag-step-desc">O cliente paga via PIX e o agendamento \u00e9 confirmado automaticamente.</div></div></div>',
          '<div class="mpag-step"><div class="mpag-step-icon mpag-step-green"><svg width="18" height="18" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7.5" stroke="#34d399" stroke-width="1.6"/><path d="M6.5 10l2.5 2.5 5-5" stroke="#34d399" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div class="mpag-step-body"><div class="mpag-step-title">Voc\u00ea recebe o pagamento</div><div class="mpag-step-desc">O valor (menos R$ 0,50 + 0,99% MP) entra na sua conta via Mercado Pago.</div></div></div>',
          '<div class="mpag-step"><div class="mpag-step-icon mpag-step-orange"><svg width="18" height="18" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7.5" stroke="#fb923c" stroke-width="1.6"/><path d="M10 7v4" stroke="#fb923c" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="14.5" r="0.9" fill="#fb923c"/></svg></div><div class="mpag-step-body"><div class="mpag-step-title">Cancelamento e reembolso</div><div class="mpag-step-desc">Se houver cancelamento, o reembolso \u00e9 feito automaticamente via PIX.</div></div></div>',
        '</div>',
      '</div>',
      '<div class="mpag-side-block mpag-resumo-block">',
        '<div class="mpag-side-title">Resumo</div>',
        '<div class="mpag-resumo-rows">',
          '<div class="mpag-resumo-row"><span class="mpag-resumo-key">Meio de pagamento</span><span class="mpag-resumo-val" id="mpag-resumo-meio">PIX via Mercado Pago</span></div>',
          '<div class="mpag-resumo-row"><span class="mpag-resumo-key">Valor cobrado</span><span class="mpag-resumo-val" id="mpag-resumo-valor">\u2014</span></div>',
          '<div class="mpag-resumo-row"><span class="mpag-resumo-key">Taxa por transa\u00e7\u00e3o</span><span class="mpag-resumo-val" id="mpag-resumo-taxa">R$ 0,50 + 0,99%</span></div>',
          '<div class="mpag-resumo-row"><span class="mpag-resumo-key">Prazo para recebimento</span><span class="mpag-resumo-val" id="mpag-resumo-prazo">Instant\u00e2neo</span></div>',
          '<div class="mpag-resumo-row"><span class="mpag-resumo-key">Reembolso autom\u00e1tico</span><span class="mpag-resumo-val mpag-resumo-green" id="mpag-resumo-reembolso">Ativado</span></div>',
        '</div>',
        '<div class="mpag-ver-btn" onclick="irPara(\'agendamentos\',document.getElementById(\'menu-agendamentos\'))">',
          '<span style="display:flex;align-items:center;gap:8px"><svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M2 12.5L13 7.5 2 2.5v4l8 1-8 1v4Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>Ver agendamentos</span>',
          '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        '</div>',
        '<div class="mpag-mp-footer"><svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 1.5L2 4v6c0 3.5 2.6 6.8 6 7.5 3.4-.7 6-4 6-7.5V4L8 1.5Z" stroke="rgba(255,255,255,0.3)" stroke-width="1.3" stroke-linejoin="round"/></svg><span>Seus pagamentos s\u00e3o 100% seguros com o Mercado Pago.</span><div class="mpag-mp-logo-small"><svg width="16" height="16" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="14" fill="#009ee3"/><path d="M9 16a7 7 0 1 1 14 0" stroke="white" stroke-width="2.5" stroke-linecap="round"/><circle cx="16" cy="16" r="2.5" fill="white"/></svg><span>mercado pago</span></div></div>',
      '</div>',
    '</div>', /* /col-right */
    '</div>', /* /mpag-grid */
  ].join('')

  _mpagSincronizarUI()
}