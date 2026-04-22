/* ═══════════════════════════════════════════════════════════════════════
   PAGAMENTOS — LÓGICA COMPLETA DO FRONTEND
   
   Cole este código no final do seu painel.js (substitui as funções
   mpagChangePct, renderPagamentos e carregarPagamentosConfig existentes)
   
   Taxa SaaS: R$ 0,50 por transação cobrada do usuário
═══════════════════════════════════════════════════════════════════════ */

// ─── Estado local da página de pagamentos ───────────────────────────────────
var mpagState = {
  adiantadoAtivo: true,
  tipoValor: 'total',     // 'total' | 'personalizado' | 'fixo'
  porcentagem: 50,
  valorFixo: 50.00,
  reembolsoAtivo: true,
  reembolsoCliente: true,
  reembolsoNegocio: true,
  salvando: false,
}

// Taxa SaaS: R$ 0,50 cobrado do USUÁRIO por cada transação processada
var TAXA_SAAS_CENTAVOS = 50   // em centavos = R$ 0,50

// ─── Inicializa a página de pagamentos ──────────────────────────────────────
function renderPagamentos() {
  _mpagSincronizarToggleAdiantado()
  _mpagSincronizarRadios()
  _mpagSincronizarPct()
  _mpagSincronizarReembolso()
  _mpagAtualizarInfoBar()
  _mpagAtualizarResumo()
  _mpagAtualizarConteudoAdiantado()
}

// ─── Carrega configurações salvas da API ────────────────────────────────────
async function carregarPagamentosConfig() {
  if (!negocioAtual) return
  try {
    const token = localStorage.getItem('token')
    const res = await fetch(`${API}/pagamento/config/${negocioAtual._id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!res.ok) return
    const cfg = await res.json()

    // Popula o estado local com os dados da API
    if (cfg.adiantado !== undefined)       mpagState.adiantadoAtivo    = !!cfg.adiantado
    if (cfg.tipoValor)                     mpagState.tipoValor          = cfg.tipoValor
    if (cfg.porcentagem !== undefined)     mpagState.porcentagem        = Number(cfg.porcentagem) || 50
    if (cfg.valorFixo !== undefined)       mpagState.valorFixo          = Number(cfg.valorFixo)   || 50
    if (cfg.reembolso !== undefined)       mpagState.reembolsoAtivo     = !!cfg.reembolso
    if (cfg.reembolsoCliente !== undefined) mpagState.reembolsoCliente  = !!cfg.reembolsoCliente
    if (cfg.reembolsoNegocio !== undefined) mpagState.reembolsoNegocio  = !!cfg.reembolsoNegocio

    // Também armazena no estado global (retrocompatibilidade)
    pagamentosConfig = cfg.servicos || {}

    // Re-renderiza com os dados carregados
    renderPagamentos()
  } catch (e) {
    console.error('[carregarPagamentosConfig]', e.message)
  }
}

// ─── Salva as configurações na API ──────────────────────────────────────────
async function mpagSalvar() {
  if (!negocioAtual || mpagState.salvando) return
  mpagState.salvando = true

  const btn = document.getElementById('mpag-btn-salvar')
  const origHTML = btn ? btn.innerHTML : ''
  if (btn) {
    btn.disabled = true
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="animation:spin 1s linear infinite">
      <circle cx="7" cy="7" r="5.5" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
      <path d="M7 1.5a5.5 5.5 0 0 1 5.5 5.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
    </svg> Salvando...`
  }

  try {
    const token = localStorage.getItem('token')
    const payload = {
      negocioId:        negocioAtual._id,
      adiantado:        mpagState.adiantadoAtivo,
      tipoValor:        mpagState.tipoValor,
      porcentagem:      mpagState.porcentagem,
      valorFixo:        mpagState.valorFixo,
      reembolso:        mpagState.reembolsoAtivo,
      reembolsoCliente: mpagState.reembolsoCliente,
      reembolsoNegocio: mpagState.reembolsoNegocio,
      taxaSaasCentavos: TAXA_SAAS_CENTAVOS,   // enviado ao backend para cálculo
    }

    const res = await fetch(`${API}/pagamento/config`, {
      method: 'PATCH',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.erro || `HTTP ${res.status}`)
    }

    // Feedback de sucesso
    if (btn) {
      btn.innerHTML = '✅ Salvo com sucesso!'
      btn.style.background = '#059669'
      setTimeout(() => {
        btn.innerHTML = origHTML
        btn.style.background = ''
        btn.disabled = false
      }, 2500)
    }
    _mpagAtualizarResumo()
  } catch (e) {
    console.error('[mpagSalvar]', e.message)
    if (btn) {
      btn.innerHTML = '⚠ Erro ao salvar'
      btn.style.background = '#dc2626'
      setTimeout(() => {
        btn.innerHTML = origHTML
        btn.style.background = ''
        btn.disabled = false
      }, 2500)
    }
  } finally {
    mpagState.salvando = false
  }
}

// ─── Toggle "Pagamento Adiantado" ───────────────────────────────────────────
function mpagToggleAdiantado(checkbox) {
  mpagState.adiantadoAtivo = checkbox.checked
  _mpagAtualizarConteudoAdiantado()
  _mpagAtualizarInfoBar()
  _mpagAtualizarResumo()
}

function _mpagAtualizarConteudoAdiantado() {
  const content = document.getElementById('mpag-adiantado-content')
  if (!content) return
  content.style.opacity      = mpagState.adiantadoAtivo ? '1' : '0.35'
  content.style.pointerEvents = mpagState.adiantadoAtivo ? 'all' : 'none'
}

function _mpagSincronizarToggleAdiantado() {
  const tog = document.getElementById('mpag-toggle-adiantado')
  if (tog) tog.checked = mpagState.adiantadoAtivo
  _mpagAtualizarConteudoAdiantado()
}

// ─── Seleção do tipo de valor ────────────────────────────────────────────────
function mpagSelecionarTipo(tipo) {
  mpagState.tipoValor = tipo
  _mpagSincronizarRadios()
  _mpagSincronizarPct()
  _mpagAtualizarInfoBar()
  _mpagAtualizarResumo()
}

function _mpagSincronizarRadios() {
  const opts = document.querySelectorAll('.mpag-radio-opt')
  opts.forEach(opt => {
    const radio = opt.querySelector('input[type=radio]')
    const dot   = opt.querySelector('.mpag-radio-dot')
    if (!radio) return
    const isActive = radio.value === mpagState.tipoValor
    opt.classList.toggle('mpag-radio-active', isActive)
    if (dot) dot.classList.toggle('mpag-radio-dot-active', isActive)
    radio.checked = isActive
  })
}

// ─── Controle de porcentagem ─────────────────────────────────────────────────
function mpagChangePct(delta) {
  // Se o tipo for "total", fica fixo em 100
  if (mpagState.tipoValor === 'total') {
    mpagState.porcentagem = 100
  } else {
    mpagState.porcentagem = Math.max(5, Math.min(100, mpagState.porcentagem + delta))
  }
  _mpagSincronizarPct()
  _mpagAtualizarInfoBar()
  _mpagAtualizarResumo()
}

function mpagSetPct(val) {
  const n = parseInt(val)
  if (!isNaN(n)) {
    mpagState.porcentagem = Math.max(5, Math.min(100, n))
    _mpagSincronizarPct()
    _mpagAtualizarInfoBar()
    _mpagAtualizarResumo()
  }
}

function _mpagSincronizarPct() {
  const el      = document.getElementById('mpag-pct-display')
  const pctRow  = document.getElementById('mpag-pct-row')
  const fixRow  = document.getElementById('mpag-fixo-row')
  const btnMinus = document.querySelector('.mpag-pct-btn:first-child')
  const btnPlus  = document.querySelector('.mpag-pct-btn:last-child')

  if (mpagState.tipoValor === 'total') {
    mpagState.porcentagem = 100
    if (el) el.textContent = '100%'
    if (btnMinus) btnMinus.disabled = true
    if (btnPlus)  btnPlus.disabled  = true
    if (pctRow)   pctRow.style.display = 'flex'
    if (fixRow)   fixRow.style.display = 'none'
  } else if (mpagState.tipoValor === 'personalizado') {
    if (el) el.textContent = mpagState.porcentagem + '%'
    if (btnMinus) btnMinus.disabled = (mpagState.porcentagem <= 5)
    if (btnPlus)  btnPlus.disabled  = (mpagState.porcentagem >= 100)
    if (pctRow)   pctRow.style.display = 'flex'
    if (fixRow)   fixRow.style.display = 'none'
  } else if (mpagState.tipoValor === 'fixo') {
    if (pctRow)   pctRow.style.display = 'none'
    if (fixRow)   fixRow.style.display = 'flex'
    _mpagAtualizarInputFixo()
  }
}

// ─── Valor fixo ──────────────────────────────────────────────────────────────
function mpagChangeFixo(delta) {
  mpagState.valorFixo = Math.max(1, parseFloat((mpagState.valorFixo + delta).toFixed(2)))
  _mpagAtualizarInputFixo()
  _mpagAtualizarInfoBar()
  _mpagAtualizarResumo()
}

function mpagSetFixo(val) {
  const n = parseFloat(val)
  if (!isNaN(n) && n > 0) {
    mpagState.valorFixo = parseFloat(n.toFixed(2))
    _mpagAtualizarInfoBar()
    _mpagAtualizarResumo()
  }
}

function _mpagAtualizarInputFixo() {
  const inp = document.getElementById('mpag-fixo-input')
  if (inp) inp.value = mpagState.valorFixo.toFixed(2).replace('.', ',')
}

// ─── Toggle Reembolso ────────────────────────────────────────────────────────
function mpagToggleReembolso(checkbox) {
  mpagState.reembolsoAtivo = checkbox.checked
  const lista = document.getElementById('mpag-reimb-list')
  if (lista) {
    lista.style.opacity      = mpagState.reembolsoAtivo ? '1' : '0.35'
    lista.style.pointerEvents = mpagState.reembolsoAtivo ? 'all' : 'none'
  }
  _mpagAtualizarResumo()
}

function mpagToggleReembolsoCliente(checkbox) {
  mpagState.reembolsoCliente = checkbox.checked
  _mpagAtualizarResumo()
}

function mpagToggleReembolsoNegocio(checkbox) {
  mpagState.reembolsoNegocio = checkbox.checked
  _mpagAtualizarResumo()
}

function _mpagSincronizarReembolso() {
  const togReemb = document.querySelector('#mpag-block-reembolso input[type=checkbox]:first-of-type')
  if (togReemb) togReemb.checked = mpagState.reembolsoAtivo
}

// ─── Barra de informação dinâmica ────────────────────────────────────────────
function _mpagAtualizarInfoBar() {
  const el = document.getElementById('mpag-info-text')
  if (!el) return
  if (!mpagState.adiantadoAtivo) {
    el.textContent = 'O pagamento antecipado está desativado. O cliente pagará no momento do atendimento.'
    return
  }
  if (mpagState.tipoValor === 'total') {
    el.textContent = 'O cliente pagará 100% do valor do serviço para confirmar o agendamento.'
  } else if (mpagState.tipoValor === 'personalizado') {
    el.textContent = `O cliente pagará ${mpagState.porcentagem}% do valor do serviço para confirmar o agendamento.`
  } else if (mpagState.tipoValor === 'fixo') {
    el.textContent = `O cliente pagará R$ ${mpagState.valorFixo.toFixed(2).replace('.', ',')} para confirmar o agendamento.`
  }
}

// ─── Painel de resumo lateral ────────────────────────────────────────────────
function _mpagAtualizarResumo() {
  // "Meio de pagamento"
  _mpagSetResumoVal('mpag-resumo-meio', 'PIX via Mercado Pago')

  // "Taxa por transação" — mostra taxa do SaaS + taxa MP
  const taxaSaas = (TAXA_SAAS_CENTAVOS / 100).toFixed(2).replace('.', ',')
  _mpagSetResumoVal('mpag-resumo-taxa', `R$ ${taxaSaas} + 0,99% (MP)`)

  // "Prazo de recebimento"
  _mpagSetResumoVal('mpag-resumo-prazo', 'Instantâneo')

  // "Reembolso automático"
  const elReemb   = document.getElementById('mpag-resumo-reembolso')
  if (elReemb) {
    elReemb.textContent = mpagState.reembolsoAtivo ? 'Ativado' : 'Desativado'
    elReemb.style.color = mpagState.reembolsoAtivo ? '#34d399' : '#f87171'
  }

  // "Valor cobrado"
  let valorLabel = '—'
  if (mpagState.adiantadoAtivo) {
    if (mpagState.tipoValor === 'total')          valorLabel = '100% do serviço'
    else if (mpagState.tipoValor === 'personalizado') valorLabel = `${mpagState.porcentagem}% do serviço`
    else if (mpagState.tipoValor === 'fixo')      valorLabel = `R$ ${mpagState.valorFixo.toFixed(2).replace('.', ',')}`
  } else {
    valorLabel = 'Desativado'
  }
  _mpagSetResumoVal('mpag-resumo-valor', valorLabel)
}

function _mpagSetResumoVal(id, txt) {
  const el = document.getElementById(id)
  if (el) el.textContent = txt
}

// ─── Injeção do HTML completo da seção de pagamentos ─────────────────────────
// Chame esta função dentro de irPara('pagamentos', ...) OU no DOMContentLoaded
// para substituir o HTML estático por um HTML totalmente funcional.
function mpagInjetarHTML() {
  const section = document.getElementById('page-pagamentos')
  if (!section) return

  section.innerHTML = `
  <!-- HERO -->
  <div class="mpag-hero">
    <div class="mpag-hero-left">
      <div class="mpag-hero-icon-wrap">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="5" width="20" height="16" rx="3" stroke="#34d399" stroke-width="1.8"/>
          <path d="M2 10h20" stroke="#34d399" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M6 15h4" stroke="#34d399" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </div>
      <div>
        <div class="mpag-hero-title">Pagamentos</div>
        <div class="mpag-hero-sub">
          Receba pagamentos antecipados e garanta mais segurança<br>
          para o seu negócio e para seus clientes.
        </div>
      </div>
    </div>
    <div class="mpag-hero-right">
      <div class="mpag-card-white">
        <div class="mpag-card-white-title">Pagamento 100% seguro</div>
        <div class="mpag-card-white-sub">Processado pelo</div>
        <div class="mpag-card-white-logos">
          <div class="mpag-logo-mp">
            <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="14" fill="#009ee3"/>
              <path d="M9 16a7 7 0 1 1 14 0" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
              <circle cx="16" cy="16" r="2.5" fill="white"/>
            </svg>
            <div class="mpag-logo-mp-text"><span>mercado</span><span>pago</span></div>
          </div>
          <div class="mpag-logo-pix">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 3L3 12l9 9 9-9-9-9Z" stroke="#32BCAD" stroke-width="1.8" stroke-linejoin="round"/>
              <path d="M8 12l2 2 4-4" stroke="#32BCAD" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="mpag-logo-pix-text">PIX</span>
          </div>
        </div>
      </div>
      <div class="mpag-hero-phone">
        <svg width="72" height="130" viewBox="0 0 72 130" fill="none">
          <rect x="2" y="2" width="68" height="126" rx="12" fill="#0a1628" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>
          <rect x="8" y="10" width="56" height="110" rx="8" fill="#0f1e35"/>
          <rect x="26" y="4" width="20" height="4" rx="2" fill="rgba(255,255,255,0.1)"/>
          <rect x="14" y="22" width="44" height="6" rx="3" fill="rgba(59,130,246,0.3)"/>
          <rect x="14" y="32" width="30" height="4" rx="2" fill="rgba(255,255,255,0.12)"/>
          <rect x="14" y="44" width="44" height="32" rx="6" fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.25)" stroke-width="1"/>
          <path d="M26 60l4 4 8-8" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <rect x="14" y="84" width="20" height="4" rx="2" fill="rgba(255,255,255,0.12)"/>
          <rect x="14" y="92" width="34" height="4" rx="2" fill="rgba(255,255,255,0.08)"/>
          <rect x="14" y="102" width="44" height="10" rx="5" fill="rgba(59,130,246,0.3)"/>
        </svg>
      </div>
      <div class="mpag-hero-shield">
        <svg width="38" height="38" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="22" fill="#1e3a8a" stroke="rgba(96,165,250,0.5)" stroke-width="2"/>
          <path d="M24 8L10 14v10c0 9 6.5 17 14 19.5C31.5 41 38 33 38 24V14L24 8Z" fill="#2563eb" stroke="rgba(96,165,250,0.4)" stroke-width="1.5" stroke-linejoin="round"/>
          <path d="M18 24l4 4 8-8" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </div>
  </div>

  <!-- MAIN GRID -->
  <div class="mpag-grid">
    <div class="mpag-col-left">

      <!-- BLOCO 1: Pagamento adiantado -->
      <div class="mpag-block">
        <div class="mpag-block-body">
          <div class="mpag-toggle-main-row">
            <div>
              <div class="mpag-section-title">Pagamento adiantado</div>
              <div class="mpag-section-sub">Ative para solicitar pagamento antecipado no momento do agendamento.</div>
            </div>
            <label class="mpag-toggle-sw">
              <input type="checkbox" id="mpag-toggle-adiantado" onchange="mpagToggleAdiantado(this)">
              <span class="mpag-toggle-track"><span class="mpag-toggle-thumb"></span></span>
            </label>
          </div>

          <div id="mpag-adiantado-content">
            <!-- Tipo de valor -->
            <div class="mpag-subsection-title">Valor a ser cobrado</div>
            <div class="mpag-subsection-sub">Escolha quanto do valor do serviço será cobrado antecipadamente.</div>

            <div class="mpag-radio-grid">
              <label class="mpag-radio-opt" onclick="mpagSelecionarTipo('total')">
                <input type="radio" name="mpag-valor" value="total" hidden>
                <div class="mpag-radio-dot"></div>
                <div>
                  <div class="mpag-radio-label">Valor total</div>
                  <div class="mpag-radio-desc">100% do valor do serviço</div>
                </div>
              </label>
              <label class="mpag-radio-opt" onclick="mpagSelecionarTipo('personalizado')">
                <input type="radio" name="mpag-valor" value="personalizado" hidden>
                <div class="mpag-radio-dot"></div>
                <div>
                  <div class="mpag-radio-label">Valor personalizado</div>
                  <div class="mpag-radio-desc">Definir uma porcentagem</div>
                </div>
              </label>
              <label class="mpag-radio-opt" onclick="mpagSelecionarTipo('fixo')">
                <input type="radio" name="mpag-valor" value="fixo" hidden>
                <div class="mpag-radio-dot"></div>
                <div>
                  <div class="mpag-radio-label">Valor fixo</div>
                  <div class="mpag-radio-desc">Definir um valor específico</div>
                </div>
              </label>
            </div>

            <!-- Controle de porcentagem -->
            <div class="mpag-pct-row" id="mpag-pct-row">
              <div>
                <div class="mpag-subsection-title" style="margin-bottom:2px">Porcentagem do serviço</div>
                <div class="mpag-subsection-sub">Defina a porcentagem do valor do serviço que será cobrada antecipadamente.</div>
              </div>
              <div class="mpag-pct-control">
                <button class="mpag-pct-btn" onclick="mpagChangePct(-10)" type="button">−</button>
                <div class="mpag-pct-value" id="mpag-pct-display">50%</div>
                <button class="mpag-pct-btn" onclick="mpagChangePct(10)" type="button">+</button>
              </div>
            </div>

            <!-- Controle de valor fixo (oculto por padrão) -->
            <div class="mpag-pct-row" id="mpag-fixo-row" style="display:none">
              <div>
                <div class="mpag-subsection-title" style="margin-bottom:2px">Valor fixo (R$)</div>
                <div class="mpag-subsection-sub">O cliente paga exatamente esse valor para confirmar o agendamento.</div>
              </div>
              <div class="mpag-pct-control">
                <button class="mpag-pct-btn" onclick="mpagChangeFixo(-10)" type="button">−</button>
                <div class="mpag-pct-value" style="min-width:80px;font-size:13px">
                  <input id="mpag-fixo-input" type="text" value="50,00"
                    style="background:none;border:none;outline:none;font-size:13px;font-weight:800;
                           color:var(--text);text-align:center;width:70px;font-family:inherit;"
                    onchange="mpagSetFixo(this.value.replace(',','.'))"
                    oninput="mpagSetFixo(this.value.replace(',','.'))"
                  >
                </div>
                <button class="mpag-pct-btn" onclick="mpagChangeFixo(10)" type="button">+</button>
              </div>
            </div>

            <!-- Info bar -->
            <div class="mpag-info-bar">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="#60a5fa" stroke-width="1.4"/>
                <path d="M8 7v4M8 5.5v.5" stroke="#60a5fa" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              <span id="mpag-info-text">O cliente pagará 50% do valor do serviço para confirmar o agendamento.</span>
            </div>
          </div>
        </div>
      </div>

      <!-- BLOCO 2: Forma de pagamento -->
      <div class="mpag-block">
        <div class="mpag-block-body">
          <div class="mpag-subsection-title" style="margin-bottom:4px">Forma de pagamento</div>
          <div class="mpag-subsection-sub" style="margin-bottom:14px">Receba pagamentos via Mercado Pago.</div>

          <div class="mpag-fp-card">
            <div class="mpag-fp-row">
              <div class="mpag-fp-icon">
                <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
                  <rect width="32" height="32" rx="8" fill="#009ee3"/>
                  <path d="M8 16a8 8 0 1 1 16 0" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
                  <circle cx="16" cy="16" r="3" fill="white"/>
                </svg>
              </div>
              <div class="mpag-fp-info">
                <div class="mpag-fp-name">
                  PIX
                  <span class="mpag-fp-badge-mp">Mercado Pago</span>
                </div>
                <div class="mpag-fp-sub">Pagamento instantâneo</div>
              </div>
              <div class="mpag-fp-divider"></div>
              <div class="mpag-fp-desc">
                O pagamento é confirmado na hora e o agendamento é liberado automaticamente.
                <br><small style="color:var(--text3);margin-top:4px;display:block">
                  Taxa: R$ 0,50 (plataforma) + 0,99% (Mercado Pago) por transação.
                </small>
              </div>
              <div class="mpag-fp-status">
                <span class="mpag-badge-ativo">Ativo</span>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M6 4l4 4-4 4" stroke="rgba(255,255,255,0.35)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>
            <div class="mpag-fp-security">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M8 1.5L2 4v6c0 3.5 2.6 6.8 6 7.5 3.4-.7 6-4 6-7.5V4L8 1.5Z" stroke="rgba(255,255,255,0.25)" stroke-width="1.3" stroke-linejoin="round"/>
              </svg>
              <span>Seus pagamentos são processados com segurança pelo Mercado Pago.</span>
            </div>
          </div>

          <!-- TAXA SAAS — AVISO VISÍVEL PARA O USUÁRIO -->
          <div style="margin-top:14px;padding:13px 16px;border-radius:10px;
                      background:rgba(245,158,11,0.07);border:1px solid rgba(245,158,11,0.22);
                      display:flex;align-items:flex-start;gap:10px;">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink:0;margin-top:1px">
              <circle cx="8" cy="8" r="6.5" stroke="#f59e0b" stroke-width="1.4"/>
              <path d="M8 5v3.5M8 11v.5" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <div>
              <div style="font-size:12.5px;font-weight:700;color:#f59e0b;margin-bottom:3px">
                Taxa de plataforma: R$ 0,50 por transação
              </div>
              <div style="font-size:12px;color:var(--text2);line-height:1.55">
                A cada pagamento confirmado pelo seu cliente, R$ 0,50 são descontados automaticamente
                antes do repasse. Exemplo: serviço de R$ 100 → você recebe R$ 99,50 (- taxa MP).
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- BLOCO 3: Reembolso automático -->
      <div class="mpag-block" id="mpag-block-reembolso">
        <div class="mpag-block-body">
          <div class="mpag-toggle-main-row" style="margin-bottom:20px">
            <div>
              <div class="mpag-section-title">Reembolso automático</div>
              <div class="mpag-section-sub">Configure o reembolso automático caso o cliente cancele o agendamento.</div>
            </div>
            <label class="mpag-toggle-sw">
              <input type="checkbox" onchange="mpagToggleReembolso(this)">
              <span class="mpag-toggle-track"><span class="mpag-toggle-thumb"></span></span>
            </label>
          </div>

          <div id="mpag-reimb-list">
            <div class="mpag-subsection-title" style="margin-bottom:2px">Reembolsar automaticamente quando</div>
            <div class="mpag-subsection-sub" style="margin-bottom:14px">O reembolso será processado de forma automática nas situações abaixo.</div>

            <div class="mpag-reimb-list">
              <div class="mpag-reimb-item">
                <div class="mpag-reimb-icon mpag-reimb-purple">
                  <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
                    <rect x="2" y="2" width="16" height="16" rx="8" fill="rgba(139,92,246,0.2)"/>
                    <path d="M7 13l6-6M13 13L7 7" stroke="#a78bfa" stroke-width="1.6" stroke-linecap="round"/>
                  </svg>
                </div>
                <div class="mpag-reimb-text">
                  <div class="mpag-reimb-name">Cancelamento pelo cliente</div>
                  <div class="mpag-reimb-sub">Reembolso automático quando o cliente cancelar o agendamento.</div>
                </div>
                <label class="mpag-toggle-sw">
                  <input type="checkbox" onchange="mpagToggleReembolsoCliente(this)">
                  <span class="mpag-toggle-track"><span class="mpag-toggle-thumb"></span></span>
                </label>
              </div>
              <div class="mpag-reimb-item" style="margin-top:10px">
                <div class="mpag-reimb-icon mpag-reimb-orange">
                  <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="8" fill="rgba(249,115,22,0.2)"/>
                    <path d="M10 7v4" stroke="#fb923c" stroke-width="1.8" stroke-linecap="round"/>
                    <circle cx="10" cy="14" r="0.8" fill="#fb923c"/>
                  </svg>
                </div>
                <div class="mpag-reimb-text">
                  <div class="mpag-reimb-name">Cancelamento por você</div>
                  <div class="mpag-reimb-sub">Reembolso automático quando o agendamento for cancelado por você.</div>
                </div>
                <label class="mpag-toggle-sw">
                  <input type="checkbox" onchange="mpagToggleReembolsoNegocio(this)">
                  <span class="mpag-toggle-track"><span class="mpag-toggle-thumb"></span></span>
                </label>
              </div>
            </div>

            <div class="mpag-info-bar" style="margin-top:16px">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="#60a5fa" stroke-width="1.4"/>
                <path d="M8 7v4M8 5.5v.5" stroke="#60a5fa" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              <span>O reembolso será feito automaticamente via PIX para a conta do cliente.</span>
            </div>
          </div>
        </div>
      </div>

      <!-- BOTÃO SALVAR -->
      <div style="display:flex;justify-content:flex-end;margin-top:4px">
        <button id="mpag-btn-salvar" onclick="mpagSalvar()" type="button"
          style="display:inline-flex;align-items:center;gap:8px;
                 background:var(--green);color:white;border:none;
                 padding:11px 28px;border-radius:11px;
                 font-size:14px;font-weight:700;cursor:pointer;
                 font-family:inherit;
                 box-shadow:0 3px 16px rgba(16,185,129,0.35);">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 7l3.5 3.5L12 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Salvar configurações
        </button>
      </div>

    </div><!-- /col-left -->

    <!-- COLUNA DIREITA -->
    <div class="mpag-col-right">

      <!-- Como funciona -->
      <div class="mpag-side-block">
        <div class="mpag-side-title">Como funciona</div>
        <div class="mpag-steps">
          <div class="mpag-step">
            <div class="mpag-step-icon mpag-step-purple">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <rect x="2.5" y="3.5" width="15" height="13.5" rx="2.5" stroke="#a78bfa" stroke-width="1.6"/>
                <path d="M2.5 7.5h15M7 2v3M13 2v3" stroke="#a78bfa" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </div>
            <div class="mpag-step-body">
              <div class="mpag-step-title">Cliente faz o agendamento</div>
              <div class="mpag-step-desc">O cliente escolhe o serviço, data e horário.</div>
            </div>
          </div>
          <div class="mpag-step">
            <div class="mpag-step-icon mpag-step-blue">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="5" width="16" height="13" rx="2.5" stroke="#60a5fa" stroke-width="1.6"/>
                <path d="M2 9h16M6 13h4" stroke="#60a5fa" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </div>
            <div class="mpag-step-body">
              <div class="mpag-step-title">Pagamento antecipado</div>
              <div class="mpag-step-desc">O cliente realiza o pagamento via PIX e o agendamento é confirmado.</div>
            </div>
          </div>
          <div class="mpag-step">
            <div class="mpag-step-icon mpag-step-green">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="7.5" stroke="#34d399" stroke-width="1.6"/>
                <path d="M6.5 10l2.5 2.5 5-5" stroke="#34d399" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="mpag-step-body">
              <div class="mpag-step-title">Você recebe o pagamento</div>
              <div class="mpag-step-desc">O valor (menos R$ 0,50 de taxa + 0,99% MP) entra na sua conta via Mercado Pago.</div>
            </div>
          </div>
          <div class="mpag-step">
            <div class="mpag-step-icon mpag-step-orange">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="7.5" stroke="#fb923c" stroke-width="1.6"/>
                <path d="M10 7v4" stroke="#fb923c" stroke-width="1.8" stroke-linecap="round"/>
                <circle cx="10" cy="14.5" r="0.9" fill="#fb923c"/>
              </svg>
            </div>
            <div class="mpag-step-body">
              <div class="mpag-step-title">Cancelamento e reembolso</div>
              <div class="mpag-step-desc">Se houver cancelamento, o reembolso é feito automaticamente via PIX.</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Resumo -->
      <div class="mpag-side-block mpag-resumo-block">
        <div class="mpag-side-title">Resumo</div>
        <div class="mpag-resumo-rows">
          <div class="mpag-resumo-row">
            <span class="mpag-resumo-key">Meio de pagamento</span>
            <span class="mpag-resumo-val" id="mpag-resumo-meio">PIX via Mercado Pago</span>
          </div>
          <div class="mpag-resumo-row">
            <span class="mpag-resumo-key">Valor cobrado</span>
            <span class="mpag-resumo-val" id="mpag-resumo-valor">—</span>
          </div>
          <div class="mpag-resumo-row">
            <span class="mpag-resumo-key">Taxa por transação</span>
            <span class="mpag-resumo-val" id="mpag-resumo-taxa">R$ 0,50 + 0,99%</span>
          </div>
          <div class="mpag-resumo-row">
            <span class="mpag-resumo-key">Prazo para recebimento</span>
            <span class="mpag-resumo-val" id="mpag-resumo-prazo">Instantâneo</span>
          </div>
          <div class="mpag-resumo-row">
            <span class="mpag-resumo-key">Reembolso automático</span>
            <span class="mpag-resumo-val mpag-resumo-green" id="mpag-resumo-reembolso">Ativado</span>
          </div>
        </div>
        <div class="mpag-ver-btn" onclick="irPara('agendamentos', document.getElementById('menu-agendamentos'))">
          <span style="display:flex;align-items:center;gap:8px">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M2 12.5L13 7.5 2 2.5v4l8 1-8 1v4Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
            </svg>
            Ver agendamentos
          </span>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="mpag-mp-footer">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M8 1.5L2 4v6c0 3.5 2.6 6.8 6 7.5 3.4-.7 6-4 6-7.5V4L8 1.5Z" stroke="rgba(255,255,255,0.3)" stroke-width="1.3" stroke-linejoin="round"/>
          </svg>
          <span>Seus pagamentos são 100% seguros com o Mercado Pago.</span>
          <div class="mpag-mp-logo-small">
            <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="14" fill="#009ee3"/>
              <path d="M9 16a7 7 0 1 1 14 0" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
              <circle cx="16" cy="16" r="2.5" fill="white"/>
            </svg>
            <span>mercado pago</span>
          </div>
        </div>
      </div>

    </div><!-- /col-right -->
  </div><!-- /mpag-grid -->

  <style>
    @keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
  </style>
  `

  // Após injetar, sincroniza o estado
  renderPagamentos()
}

// ─── Sobrescreve irPara para chamar mpagInjetarHTML na aba pagamentos ────────
;(function() {
  const _irParaOriginal = window.irPara || function(){}
  window.irPara = function(pagina, btn) {
    _irParaOriginal(pagina, btn)
    if (pagina === 'pagamentos') {
      // Injeta HTML funcional e sincroniza estado
      setTimeout(() => {
        mpagInjetarHTML()
        // Carrega config da API se ainda não carregou
        carregarPagamentosConfig()
      }, 30)
    }
  }
})()