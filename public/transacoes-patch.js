// ─────────────────────────────────────────────────────────────
// PATCH: cole no final do painel.js (após todo o código existente)
// Corrige "Transações recentes" e "Saldo disponível" para mostrar
// apenas agendamentos com pagamento Pix real (pagamento.status === 'pago')
// ─────────────────────────────────────────────────────────────

;(function () {

  // ── Transações recentes ─────────────────────────────────────
  // Sobrescreve dashRenderTransacoes para filtrar só pagamentos reais
  window.dashRenderTransacoes = function () {
    var container = document.getElementById('dash-trans-lista')
    if (!container) return

    var ags = window.todosAgendamentos || []

    // ✅ Só mostra agendamentos com pagamento Pix confirmado
    var pagos = ags
      .filter(function (a) {
        return a.pagamento && a.pagamento.status === 'pago' && Number(a.pagamento.valor) > 0
      })
      .sort(function (a, b) {
        return ((b.data || '') + (b.hora || '')).localeCompare((a.data || '') + (a.hora || ''))
      })
      .slice(0, 5)

    if (!pagos.length) {
      container.innerHTML = '<div style="text-align:center;color:var(--text3);padding:24px 16px;font-size:12px">Sem transações recentes</div>'
      return
    }

    var mesNomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

    container.innerHTML = pagos.map(function (a) {
      var valor = Number(a.pagamento.valor) || 0
      var dataObj = a.data ? a.data.split('-') : []
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
          '<div class="dash-trans-val pos">+R$', valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), '</div>',
        '</div>'
      ].join('')
    }).join('')
  }

  // ── Saldo disponível ────────────────────────────────────────
  // Sobrescreve recalcularSaldo para usar pagamento.valor (não preco do serviço)
  window.recalcularSaldo = function () {
    var nid = window.negocioAtual ? window.negocioAtual._id : null
    if (!nid) return 0

    var ags = window.todosAgendamentos || []

    // Soma apenas pagamentos Pix realmente confirmados
    var totalPago = ags.reduce(function (soma, a) {
      if (a.pagamento && a.pagamento.status === 'pago' && Number(a.pagamento.valor) > 0) {
        return soma + Number(a.pagamento.valor)
      }
      return soma
    }, 0)

    // Desconta saques realizados
    var saques = []
    try { saques = JSON.parse(localStorage.getItem('saques_ids_' + nid) || '[]') } catch (_) {}
    var totalSacado = saques.reduce(function (s, item) {
      return s + (Number(item.valor) || 0)
    }, 0)

    var saldo = Math.max(0, totalPago - totalSacado)
    localStorage.setItem('saldo_disponivel_' + nid, String(saldo))

    var fmt = 'R$ ' + saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    var elSaldo = document.getElementById('dash-saldo-val')
    if (elSaldo) elSaldo.textContent = fmt

    var semSaldo = saldo <= 0
    var btnT = document.querySelector('.dash-saldo-btn.primary')
    var btnS = document.querySelector('.dash-saldo-btn.secondary')
    if (btnT) { btnT.disabled = semSaldo; btnT.style.opacity = semSaldo ? '0.4' : '' }
    if (btnS) { btnS.disabled = semSaldo; btnS.style.opacity = semSaldo ? '0.4' : '' }

    return saldo
  }

  // ── Faturamento hoje / ticket médio ────────────────────────
  // Sobrescreve dashRenderStats para separar:
  //   - "Faturamento hoje" = serviços concluídos (valor do serviço)
  //   - "Saldo disponível" = só Pix recebido
  window.dashRenderStats = function () {
    var ags  = window.todosAgendamentos || []
    var nid  = window.negocioAtual ? window.negocioAtual._id : null
    var hoje = new Date().toISOString().split('T')[0]
    var mes  = hoje.slice(0, 7)

    // Faturamento hoje = serviços CONCLUÍDOS (receita real do negócio)
    var fatHoje = ags
      .filter(function (a) { return a.data === hoje && a.status === 'concluido' })
      .reduce(function (s, a) { return s + (Number(a.preco) || 0) }, 0)
    if (nid && fatHoje > 0) localStorage.setItem('dash_fatHoje_' + nid + '_' + hoje, fatHoje)
    var fatHojeFinal = fatHoje || parseFloat(localStorage.getItem('dash_fatHoje_' + nid + '_' + hoje) || '0')

    var elFat = document.getElementById('dash-fat-hoje')
    if (elFat) elFat.textContent = 'R$' + fatHojeFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    // Agendamentos hoje
    var agHoje = ags.filter(function (a) { return a.data === hoje }).length
    if (nid && agHoje > 0) localStorage.setItem('dash_agHoje_' + nid + '_' + hoje, agHoje)
    var agHojeFinal = agHoje || parseInt(localStorage.getItem('dash_agHoje_' + nid + '_' + hoje) || '0')
    var elAg = document.getElementById('dash-ag-hoje')
    if (elAg) elAg.textContent = agHojeFinal

    // Esta semana
    var semStart = new Date(); semStart.setDate(semStart.getDate() - semStart.getDay())
    var semEnd   = new Date(semStart); semEnd.setDate(semEnd.getDate() + 6)
    var semStartStr = semStart.toISOString().split('T')[0]
    var semEndStr   = semEnd.toISOString().split('T')[0]
    var agSemana = ags.filter(function (a) { return a.data >= semStartStr && a.data <= semEndStr }).length
    if (nid && agSemana > 0) localStorage.setItem('dash_agSemana_' + nid + '_' + semStartStr, agSemana)
    var agSemanaFinal = agSemana || parseInt(localStorage.getItem('dash_agSemana_' + nid + '_' + semStartStr) || '0')
    var elSem = document.getElementById('dash-ag-semana-label')
    if (elSem) elSem.textContent = agSemanaFinal + ' esta semana'

    // Clientes únicos
    var clientes = new Set(ags.map(function (a) { return a.pacienteNome }).filter(Boolean))
    if (nid && clientes.size > 0) localStorage.setItem('dash_clientes_' + nid, clientes.size)
    var clientesFinal = clientes.size || parseInt(localStorage.getItem('dash_clientes_' + nid) || '0')
    var elCli = document.getElementById('dash-clientes')
    if (elCli) elCli.textContent = clientesFinal

    // Ticket médio do mês (baseado em serviços concluídos)
    var doMes  = ags.filter(function (a) { return a.data && a.data.startsWith(mes) && a.status === 'concluido' })
    var fatMes = doMes.reduce(function (s, a) { return s + (Number(a.preco) || 0) }, 0)
    if (nid && fatMes > 0) localStorage.setItem('dash_fatMes_' + nid + '_' + mes, fatMes)
    var fatMesFinal = fatMes || parseFloat(localStorage.getItem('dash_fatMes_' + nid + '_' + mes) || '0')

    var ticket = doMes.length > 0 ? fatMes / doMes.length : 0
    if (nid && ticket > 0) localStorage.setItem('dash_ticket_' + nid + '_' + mes, ticket)
    var ticketFinal = ticket || parseFloat(localStorage.getItem('dash_ticket_' + nid + '_' + mes) || '0')
    var elTck = document.getElementById('dash-ticket')
    if (elTck) elTck.textContent = 'R$' + ticketFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    // Saldo disponível = só Pix recebido (chama a função corrigida)
    window.recalcularSaldo()

    // Gráfico total do mês
    var elChartTotal = document.getElementById('dash-chart-total')
    if (elChartTotal) elChartTotal.textContent = 'R$ ' + fatMesFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  console.log('[trans-patch] ✓ dashRenderTransacoes, recalcularSaldo e dashRenderStats corrigidos')

})()