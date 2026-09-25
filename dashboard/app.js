/**
 * MASSMARO QUANT DASHBOARD - CLIENT CONTROLLER
 * PANEL INTERACTIVO DE RENDIMIENTO MENSUAL, WIN/LOSS & EXTRACTO DE BITÁCORA
 */

function startDashboard() {
  // Estado global de la aplicación
  const state = {
    activeTerminal: 'PEPPERSTONE',
    activeSymbol: 'XAUUSD',
    equityStrategy: 'real1000',
    tradeAccountFilter: 'ALL',
    selectedMonth: '2026-09',
    allTrades: [],
    monthlyAnalytics: null,
    pollInterval: null
  };

  // Referencias DOM
  const dom = {
    terminalSelector: document.getElementById('terminalSelector'),
    btnManualRefresh: document.getElementById('btnManualRefresh'),
    btnRefreshText: document.getElementById('btnRefreshText'),
    mt5StatusBadge: document.getElementById('mt5StatusBadge'),
    mt5StatusText: document.getElementById('mt5StatusText'),
    syncTimerBadge: document.getElementById('syncTimerBadge'),
    syncTimerText: document.getElementById('syncTimerText'),
    localClock: document.getElementById('localClock'),
    kpiBalance: document.getElementById('kpiBalance'),
    kpiMonthlyAvg: document.getElementById('kpiMonthlyAvg') || document.getElementById('kpiEquity'),
    kpiMonthlyAvgMeta: document.getElementById('kpiMonthlyAvgMeta') || document.getElementById('kpiMarginFree'),
    kpiEquity: document.getElementById('kpiEquity'),
    kpiFloating: document.getElementById('kpiFloating'),
    kpiLot: document.getElementById('kpiLot'),
    kpiWinRate: document.getElementById('kpiWinRate'),
    kpiWinRateMeta: document.getElementById('kpiWinRateMeta'),
    kpiTerminalName: document.getElementById('kpiTerminalName'),
    kpiMarginFree: document.getElementById('kpiMarginFree'),
    kpiOpenPositions: document.getElementById('kpiOpenPositions'),
    lotProgressFill: document.getElementById('lotProgressFill'),
    kpiNextLot: document.getElementById('kpiNextLot'),

    // Panel interactivo & analítica
    panelAccountPill: document.getElementById('panelAccountPill'),
    panelAccountServer: document.getElementById('panelAccountServer'),
    panelAccountSymbol: document.getElementById('panelAccountSymbol'),
    monthFilterSelector: document.getElementById('monthFilterSelector'),
    tagBestMonth: document.getElementById('tagBestMonth'),
    tagWinRatePill: document.getElementById('tagWinRatePill'),
    pieSubtitle: document.getElementById('pieSubtitle'),
    statPieWins: document.getElementById('statPieWins'),
    statPieLosses: document.getElementById('statPieLosses'),
    statPieTotal: document.getElementById('statPieTotal'),
    extractTitle: document.getElementById('extractTitle'),
    extractMonthTrades: document.getElementById('extractMonthTrades'),
    extractMonthCosts: document.getElementById('extractMonthCosts'),
    extractMonthProfit: document.getElementById('extractMonthProfit'),
    monthlyExtractTableBody: document.getElementById('monthlyExtractTableBody'),

    // Bitácora general
    tradesTableBody: document.getElementById('tradesTableBody'),
    tradeSearchInput: document.getElementById('tradeSearchInput'),
    tradeAccountFilter: document.getElementById('tradeAccountFilter'),

    // Curva de equidad
    statInitialBalance: document.getElementById('statInitialBalance'),
    statFinalBalance: document.getElementById('statFinalBalance'),
    statNetReturn: document.getElementById('statNetReturn'),
    statProfitFactor: document.getElementById('statProfitFactor'),
    statTotalTrades: document.getElementById('statTotalTrades'),
    kpiStrategyName: document.getElementById('kpiStrategyName'),
    btnShowReal1000: document.getElementById('btnShowReal1000'),
    btnShowHector: document.getElementById('btnShowHector'),
    btnShowBot1000: document.getElementById('btnShowBot1000'),
    btnShowGold: document.getElementById('btnShowGold'),
    btnShowMaro: document.getElementById('btnShowMaro'),

    // Radar
    radarGridContainer: document.getElementById('radarGridContainer')
  };

  // Modo estático: file:// local  O  GitHub Pages (sin servidor MT5 local)
  const isLocalServer = window.location.protocol === 'http:' || window.location.protocol === 'https:';
  const isGitHubPages = isLocalServer && (window.location.hostname.endsWith('github.io') || window.location.hostname.endsWith('githubusercontent.com'));
  const isFileMode = window.location.protocol === 'file:' || isGitHubPages;

  // Mostrar badge de última actualización publicada (desde static_data.js)
  (function showPublishedBadge() {
    const ts = window.STATIC_DASHBOARD_DATA && window.STATIC_DASHBOARD_DATA.generated_at;
    const badge = document.getElementById('mt5StatusBadge');
    const text  = document.getElementById('mt5StatusText');
    if (!ts || !badge || !text) return;
    if (isGitHubPages) {
      badge.className = 'status-badge sync-timer';
      const d = new Date(ts);
      const fmt = d.toLocaleString('es-MX', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
      text.textContent = `📡 Datos al: ${fmt}`;
    }
  })();

  // =========================================================================
  // RELOJ DE MERCADO
  // =========================================================================
  function updateClock() {
    const now = new Date();
    dom.localClock.textContent = now.toLocaleTimeString('es-MX', { hour12: false });
  }
  setInterval(updateClock, 1000);
  updateClock();

  // =========================================================================
  // GRÁFICOS CHART.JS (BARRA MENSUAL & PASTEL WIN/LOSS)
  // =========================================================================
  let monthlyBarChartInstance = null;
  let winLossPieChartInstance = null;

  function renderMonthlyBarChart(series) {
    const ctx = document.getElementById('monthlyBarChart');
    if (!ctx) return;

    if (monthlyBarChartInstance) {
      monthlyBarChartInstance.destroy();
    }

    if (!series || series.length === 0) return;

    const labels = series.map(s => {
      const parts = s.month.split('-');
      const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      const mIdx = parseInt(parts[1], 10) - 1;
      return `${monthNames[mIdx] || parts[1]} '${parts[0].slice(2)}`;
    });

    const dataPct = series.map(s => s.profit_pct);
    const bgColors = dataPct.map(v => v >= 0 ? 'rgba(0, 230, 118, 0.75)' : 'rgba(255, 23, 68, 0.75)');
    const borderColors = dataPct.map(v => v >= 0 ? '#00E676' : '#FF1744');

    // Mejor mes
    const maxVal = Math.max(...dataPct);
    if (dom.tagBestMonth) {
      dom.tagBestMonth.textContent = `Mejor: +${maxVal.toFixed(1)}%`;
      dom.tagBestMonth.className = `chart-tag ${maxVal >= 0 ? 'green' : ''}`;
    }

    monthlyBarChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: '% Ganancia Mensual',
          data: dataPct,
          backgroundColor: bgColors,
          borderColor: borderColors,
          borderWidth: 1.5,
          borderRadius: 6,
          maxBarThickness: 42
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(13, 17, 26, 0.95)',
            titleColor: '#FFFFFF',
            bodyColor: '#94A3B8',
            borderColor: 'rgba(255, 255, 255, 0.15)',
            borderWidth: 1,
            padding: 12,
            displayColors: false,
            callbacks: {
              label: function(context) {
                const idx = context.dataIndex;
                const item = series[idx];
                const baseCap = state.monthlyAnalytics ? state.monthlyAnalytics.base_capital : 0;
                return [
                  ` Rendimiento: ${item.profit_pct >= 0 ? '+' : ''}${item.profit_pct.toFixed(2)}% (s/ Cap. Inicial $${baseCap})`,
                  ` Beneficio Neto: ${item.profit_usd >= 0 ? '+' : ''}$${item.profit_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`,
                  ` Operaciones: ${item.total_trades} (${item.wins}W / ${item.losses}L)`,
                  ` Win Rate: ${item.win_rate}%`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: { color: '#94A3B8', font: { family: "'JetBrains Mono', monospace", size: 11 } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: {
              color: '#94A3B8',
              font: { family: "'JetBrains Mono', monospace", size: 11 },
              callback: function(value) { return value + '%'; }
            }
          }
        }
      }
    });
  }

  function renderWinLossPieChart(wins, losses) {
    const ctx = document.getElementById('winLossPieChart');
    if (!ctx) return;

    if (winLossPieChartInstance) {
      winLossPieChartInstance.destroy();
    }

    const total = wins + losses;
    const wr = total > 0 ? ((wins / total) * 100).toFixed(1) : '0.0';

    if (dom.tagWinRatePill) dom.tagWinRatePill.textContent = `Win Rate: ${wr}%`;
    if (dom.statPieWins) dom.statPieWins.textContent = wins.toLocaleString();
    if (dom.statPieLosses) dom.statPieLosses.textContent = losses.toLocaleString();
    if (dom.statPieTotal) dom.statPieTotal.textContent = total.toLocaleString();

    winLossPieChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Operaciones Ganadas', 'Operaciones Perdidas'],
        datasets: [{
          data: [wins, losses],
          backgroundColor: [
            'rgba(0, 230, 118, 0.85)',
            'rgba(255, 23, 68, 0.85)'
          ],
          borderColor: ['#00E676', '#FF1744'],
          borderWidth: 2,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#94A3B8',
              font: { family: "'Outfit', sans-serif", size: 12 },
              padding: 14,
              usePointStyle: true
            }
          },
          tooltip: {
            backgroundColor: 'rgba(13, 17, 26, 0.95)',
            titleColor: '#FFFFFF',
            bodyColor: '#94A3B8',
            borderColor: 'rgba(255, 255, 255, 0.15)',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: function(context) {
                const val = context.raw;
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                return ` ${context.label}: ${val} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  // =========================================================================
  // CARGA DE ANALÍTICA MENSUAL Y EXTRACTO DE BITÁCORA
  // =========================================================================
  async function loadAnalyticsData() {
    let analytics = null;

    if (!isFileMode) {
      try {
        const res = await fetch(`/api/analytics?terminal=${state.activeTerminal}`);
        const data = await res.json();
        if (data && data.success && data.data) {
          analytics = data.data;
        }
      } catch (err) {
        console.warn('Aviso cargando analítica mensual online, usando static_data:', err);
      }
    }

    if (!analytics && window.STATIC_DASHBOARD_DATA && window.STATIC_DASHBOARD_DATA.monthly_analytics) {
      analytics = window.STATIC_DASHBOARD_DATA.monthly_analytics[state.activeTerminal];
    }

    if (!analytics) return;
    state.monthlyAnalytics = analytics;

    // Actualizar los KPIs del mes actual y promedio mensual
    updateCurrentMonthKpi();
    updateMonthlyAverageKpi();

    // Actualizar badges del panel superior
    const termNames = {
      "PEPPERSTONE": "🦅 smart+IA SMC (Oro Demo)",
      "REAL1000": "💎 Vantage REAL (REAL1000)",
      "HECTOR": "🛡️ Vantage REAL (HECTOR)",
      "VANTAGE": "📊 Vantage DEMO (BOT-1000)"
    };
    const termServers = {
      "PEPPERSTONE": "Pepperstone-Demo (61595338)",
      "REAL1000": "VantageMarkets-Live 5 (27497962)",
      "HECTOR": "VantageMarkets-Live 5 (29263904)",
      "VANTAGE": "Pepperstone-Demo (61587621)"
    };

    if (dom.panelAccountPill) dom.panelAccountPill.textContent = termNames[state.activeTerminal] || analytics.name;
    if (dom.panelAccountServer) dom.panelAccountServer.textContent = termServers[state.activeTerminal] || 'Servidor MT5';
    if (dom.panelAccountSymbol) dom.panelAccountSymbol.textContent = analytics.symbol || 'GBPUSD';

    // Poblar selector de meses disponibles
    populateMonthSelector(analytics.months_available, analytics.current_month);

    // Renderizar gráficos comparativos
    renderMonthlyBarChart(analytics.monthly_series || []);
    renderWinLossPieChart(analytics.total_wins || 0, analytics.total_losses || 0);

    // Renderizar extracto del mes actual seleccionado
    renderMonthlyExtractTable(state.selectedMonth);
  }

  // =========================================================================
  // KPI: % DEL MES ACTUAL PARA LA CUENTA SELECCIONADA
  // =========================================================================
  function updateCurrentMonthKpi() {
    if (!state.monthlyAnalytics) return;

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const series = state.monthlyAnalytics.monthly_series || [];

    // Buscar el mes actual; si no existe, tomar el ultimo mes disponible
    let monthData = series.find(s => s.month === currentMonth);
    if (!monthData && series.length > 0) {
      monthData = series[series.length - 1];
    }

    if (!monthData) return;

    const pct = monthData.profit_pct;
    const pctStr = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
    const isCurrentMonth = monthData.month === currentMonth;
    const monthLabel = isCurrentMonth ? 'mes actual' : monthData.month;

    if (dom.kpiWinRate) {
      dom.kpiWinRate.textContent = pctStr;
      dom.kpiWinRate.className = `kpi-value ${pct >= 0 ? 'win' : 'negative'}`;
    }
    if (dom.kpiWinRateMeta) {
      const depStr = monthData.deposit_usd
        ? `$${monthData.deposit_usd.toLocaleString('en-US', { minimumFractionDigits: 0 })} dep.`
        : `$${(state.monthlyAnalytics.base_capital || 0).toLocaleString('en-US')} base`;
      dom.kpiWinRateMeta.textContent =
        `${monthData.wins}G / ${monthData.losses}P | WR ${monthData.win_rate}% | sobre ${depStr}`;
    }
  }

  // =========================================================================
  // KPI: PROMEDIO DE GANANCIA MENSUAL (BASADO EN % DE CADA MES)
  // =========================================================================
  function updateMonthlyAverageKpi() {
    if (!state.monthlyAnalytics) return;

    const series = state.monthlyAnalytics.monthly_series || [];
    if (!dom.kpiMonthlyAvg) return;

    if (series.length === 0) {
      dom.kpiMonthlyAvg.textContent = "--%";
      dom.kpiMonthlyAvg.className = "kpi-value neutral";
      if (dom.kpiMonthlyAvgMeta) dom.kpiMonthlyAvgMeta.textContent = "Sin datos mensuales";
      return;
    }

    // Promedio aritmético de los porcentajes de ganancia de cada mes
    const totalPct = series.reduce((sum, item) => sum + (Number(item.profit_pct) || 0), 0);
    const avgPct = totalPct / series.length;
    const avgPctStr = `${avgPct >= 0 ? '+' : ''}${avgPct.toFixed(1)}%`;

    dom.kpiMonthlyAvg.textContent = avgPctStr;
    dom.kpiMonthlyAvg.className = `kpi-value ${avgPct >= 0 ? 'win' : 'negative'}`;

    if (dom.kpiMonthlyAvgMeta) {
      const totalProfitUsd = series.reduce((sum, item) => sum + (Number(item.profit_usd) || 0), 0);
      const avgProfitUsd = totalProfitUsd / series.length;
      const profitUsdSign = avgProfitUsd >= 0 ? '+' : '-';
      const profitUsdStr = `${profitUsdSign}$${Math.abs(avgProfitUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD/m`;
      const count = series.length;
      const countLabel = count === 1 ? '1 mes auditado' : `${count} meses auditados`;
      dom.kpiMonthlyAvgMeta.textContent = `${countLabel} | Prom. ${profitUsdStr}`;
    }
  }

  function populateMonthSelector(months, currentMonth) {
    if (!dom.monthFilterSelector || !months || months.length === 0) return;

    dom.monthFilterSelector.innerHTML = '';
    const monthNames = {
      "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
      "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
      "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre"
    };

    // Agregar opción "Todos los meses acumulados"
    const allOpt = document.createElement('option');
    allOpt.value = 'ALL_MONTHS';
    allOpt.textContent = '🌟 Todos los Meses Acumulados';
    dom.monthFilterSelector.appendChild(allOpt);

    // Ordenar de más reciente a más antiguo
    const reversed = [...months].reverse();
    reversed.forEach((m, idx) => {
      const parts = m.split('-');
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = `📅 ${monthNames[parts[1]] || parts[1]} ${parts[0]}`;
      if (m === currentMonth || (idx === 0 && !currentMonth)) {
        opt.selected = true;
        state.selectedMonth = m;
      }
      dom.monthFilterSelector.appendChild(opt);
    });
  }

  function renderMonthlyExtractTable(targetMonth) {
    if (!state.monthlyAnalytics || !dom.monthlyExtractTableBody) return;

    const allTradesMap = state.monthlyAnalytics.all_trades_by_month || {};
    let tradesToDisplay = [];

    if (targetMonth === 'ALL_MONTHS') {
      Object.keys(allTradesMap).forEach(m => {
        tradesToDisplay.push(...allTradesMap[m]);
      });
      if (dom.extractTitle) dom.extractTitle.textContent = `📑 Extracto de Bitácora - Historial Completo Acumulado`;
    } else {
      tradesToDisplay = allTradesMap[targetMonth] || [];
      const parts = (targetMonth || '2026-09').split('-');
      const monthNames = {
        "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
        "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
        "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre"
      };
      const label = `${monthNames[parts[1]] || parts[1]} ${parts[0]}`;
      if (dom.extractTitle) dom.extractTitle.textContent = `📑 Extracto de Bitácora del Mes: ${label}`;
    }

    if (!tradesToDisplay || tradesToDisplay.length === 0) {
      dom.monthlyExtractTableBody.innerHTML = '<tr><td colspan="9" class="text-center" style="padding:28px; color:var(--text-muted);">No hay operaciones cerradas registradas en el periodo seleccionado</td></tr>';
      if (dom.extractMonthTrades) dom.extractMonthTrades.textContent = '0';
      if (dom.extractMonthCosts) dom.extractMonthCosts.textContent = '$0.00 USD';
      if (dom.extractMonthProfit) {
        dom.extractMonthProfit.textContent = '$0.00 USD';
        dom.extractMonthProfit.className = 'neutral';
      }
      return;
    }

    // Totales del mes
    let totalProfit = 0;
    let totalCosts = 0;
    let monthWins = 0;
    let monthLosses = 0;

    tradesToDisplay.forEach(t => {
      const p = Number(t.profit || 0);
      const c = Number(t.commission || 0) + Number(t.swap || 0);
      totalProfit += p;
      totalCosts += c;
      if (p >= 0) monthWins++;
      else monthLosses++;
    });

    if (dom.extractMonthTrades) dom.extractMonthTrades.textContent = tradesToDisplay.length.toString();
    if (dom.extractMonthCosts) dom.extractMonthCosts.textContent = `$${totalCosts.toFixed(2)} USD`;
    if (dom.extractMonthProfit) {
      dom.extractMonthProfit.textContent = `${totalProfit >= 0 ? '+' : ''}$${totalProfit.toFixed(2)} USD`;
      dom.extractMonthProfit.className = totalProfit >= 0 ? 'green' : 'red';
    }

    // Si se seleccionó un mes específico, actualizar el gráfico de pastel para reflejar ese mes
    if (targetMonth !== 'ALL_MONTHS') {
      renderWinLossPieChart(monthWins, monthLosses);
      if (dom.pieSubtitle) dom.pieSubtitle.textContent = `Distribución de operaciones en ${targetMonth}`;
    } else {
      renderWinLossPieChart(state.monthlyAnalytics.total_wins, state.monthlyAnalytics.total_losses);
      if (dom.pieSubtitle) dom.pieSubtitle.textContent = `Distribución histórica total de operaciones`;
    }

    dom.monthlyExtractTableBody.innerHTML = '';
    // Mostrar del más reciente al más antiguo
    const reversedTrades = [...tradesToDisplay].reverse();

    reversedTrades.forEach(t => {
      const isWin = t.result === 'WIN' || t.profit >= 0;
      const isBuy = (t.type || 'BUY').toUpperCase() === 'BUY';
      const costs = (Number(t.commission || 0) + Number(t.swap || 0)).toFixed(2);
      const priceStr = t.price ? t.price.toFixed(t.symbol && t.symbol.includes('XAU') ? 2 : 5) : '-';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${t.date || t.time.split(' ')[0]}</strong></td>
        <td style="font-family:var(--font-mono); color:var(--text-secondary);">${t.hour || (t.time.includes(' ') ? t.time.split(' ')[1] : '-')}</td>
        <td><strong>${t.symbol || 'GBPUSD'}</strong></td>
        <td><span class="badge ${isBuy ? 'buy' : 'sell'}">${t.type || 'BUY'}</span></td>
        <td style="font-family:var(--font-mono);">${Number(t.volume || t.lot || 0).toFixed(2)}</td>
        <td style="font-family:var(--font-mono);">${priceStr}</td>
        <td style="font-family:var(--font-mono); color:var(--text-muted);">$${costs}</td>
        <td class="${isWin ? 'green' : 'red'}" style="font-weight:700; font-family:var(--font-mono);">${t.profit >= 0 ? '+' : ''}$${Number(t.profit).toFixed(2)} USD</td>
        <td><span class="badge ${isWin ? 'win' : 'loss'}">${isWin ? 'WIN' : 'LOSS'}</span></td>
      `;
      dom.monthlyExtractTableBody.appendChild(tr);
    });
  }

  // Listener para el selector de mes del extracto
  if (dom.monthFilterSelector) {
    dom.monthFilterSelector.addEventListener('change', (e) => {
      state.selectedMonth = e.target.value;
      renderMonthlyExtractTable(state.selectedMonth);
    });
  }

  // =========================================================================
  // ACTUALIZACIÓN DE CUENTA Y POSICIONES (POLLING 3S)
  // =========================================================================
  async function updateAccountData() {
    let acc = null;
    if (!isFileMode) {
      try {
        const res = await fetch(`/api/account?terminal=${state.activeTerminal}&_t=${Date.now()}`);
        acc = await res.json();
      } catch (err) {
        console.warn('Error en polling de cuenta online, usando datos locales:', err);
      }
    }
    if (!acc && window.STATIC_DASHBOARD_DATA) {
      if (state.activeTerminal === 'PEPPERSTONE') {
        acc = window.STATIC_DASHBOARD_DATA.account_pepperstone;
      } else if (state.activeTerminal === 'REAL1000') {
        acc = window.STATIC_DASHBOARD_DATA.account_real1000;
      } else if (state.activeTerminal === 'HECTOR') {
        acc = window.STATIC_DASHBOARD_DATA.account_hector;
      } else {
        acc = window.STATIC_DASHBOARD_DATA.account_vantage;
      }
    }

    if (!acc) return;

    if (!acc.connected) {
      dom.mt5StatusBadge.className = 'status-badge offline';
      dom.mt5StatusText.textContent = 'MT5 DESCONECTADO';
      dom.kpiTerminalName.textContent = acc.error || 'Sin conexión';
      return;
    }

    dom.mt5StatusBadge.className = 'status-badge live';
    if (isGitHubPages) {
      dom.mt5StatusBadge.className = 'status-badge sync-timer';
      const ts = window.STATIC_DASHBOARD_DATA && window.STATIC_DASHBOARD_DATA.generated_at;
      if (ts) {
        const d = new Date(ts);
        const fmt = d.toLocaleString('es-MX', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
        dom.mt5StatusText.textContent = `📡 Datos al: ${fmt}`;
      } else {
        dom.mt5StatusText.textContent = '📡 DATOS PUBLICADOS';
      }
    } else {
      dom.mt5StatusText.textContent = isFileMode ? 'MODO LOCAL (CARPETA)' : 'MT5 EN LÍNEA';
    }
    dom.kpiTerminalName.textContent = `${acc.terminal} (Login: ${acc.login})`;

    // Formatear valores
    dom.kpiBalance.innerHTML = `$${acc.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <small>USD</small>`;
    if (dom.kpiEquity && dom.kpiEquity !== dom.kpiMonthlyAvg) {
      dom.kpiEquity.innerHTML = `$${acc.equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <small>USD</small>`;
    }
    if (dom.kpiMarginFree && dom.kpiMarginFree !== dom.kpiMonthlyAvgMeta) {
      dom.kpiMarginFree.textContent = `Margen Libre: $${acc.margin_free.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    }
    if (state.monthlyAnalytics) {
      updateMonthlyAverageKpi();
    }

    // Flotante
    const flt = acc.floating;
    dom.kpiFloating.textContent = `${flt >= 0 ? '+' : ''}$${flt.toFixed(2)} USD`;
    dom.kpiFloating.className = `kpi-value ${flt > 0 ? 'positive' : (flt < 0 ? 'negative' : 'neutral')}`;
    dom.kpiOpenPositions.textContent = `${acc.positions_count} posición(es) viva(s)`;

    // Lotaje compuesto (opcional si existe en DOM)
    if (dom.kpiLot && acc.dynamic_lot !== undefined) {
      dom.kpiLot.innerHTML = `${acc.dynamic_lot.toFixed(2)} <small>LOT</small>`;
    }
    if (dom.kpiNextLot && acc.next_lot_balance !== undefined) {
      dom.kpiNextLot.textContent = `Próximo escalón (+0.01 lot): $${acc.next_lot_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    }
    if (dom.lotProgressFill && acc.balance !== undefined) {
      const currentStepProgress = ((acc.balance % 100) / 100) * 100;
      dom.lotProgressFill.style.width = `${Math.min(100, Math.max(5, currentStepProgress))}%`;
    }
  }

  // =========================================================================
  // INICIALIZACIÓN GRÁFICO DE CURVA DE EQUIDAD (PESTAÑA 2)
  // =========================================================================
  const equityContainer = document.getElementById('equityChartContainer');
  let equityChart = null;
  let equityAreaSeries = null;

  function initEquityChart() {
    if (!equityContainer || typeof LightweightCharts === 'undefined') return;

    equityContainer.innerHTML = '';
    equityChart = LightweightCharts.createChart(equityContainer, {
      width: equityContainer.clientWidth,
      height: 480,
      layout: {
        background: { color: '#090D14' },
        textColor: '#94A3B8',
        fontSize: 12,
        fontFamily: "'JetBrains Mono', monospace"
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.03)' }
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        scaleMargins: { top: 0.08, bottom: 0.08 }
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        timeVisible: true
      }
    });

    equityAreaSeries = equityChart.addAreaSeries({
      topColor: 'rgba(0, 230, 118, 0.45)',
      bottomColor: 'rgba(0, 230, 118, 0.0)',
      lineColor: '#00E676',
      lineWidth: 2
    });

    window.addEventListener('resize', () => {
      if (equityChart) equityChart.applyOptions({ width: equityContainer.clientWidth });
    });
  }

  async function loadEquityCurves() {
    let data = null;
    if (!isFileMode) {
      try {
        const res = await fetch('/api/equity');
        data = await res.json();
      } catch (err) {
        console.warn('Aviso cargando curva de equidad online, usando datos locales:', err);
      }
    }
    if (!data && window.STATIC_DASHBOARD_DATA) {
      data = window.STATIC_DASHBOARD_DATA.equity;
    }

    if (!data || !equityAreaSeries) return;
    const current = data[state.equityStrategy];
    if (!current || !current.curve) return;

    // Actualizar stats destacados
    if (dom.statInitialBalance) {
      dom.statInitialBalance.textContent = `$${(current.initial_balance || 250).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`;
    }
    dom.statFinalBalance.textContent = `$${current.final_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`;
    const netPct = ((current.final_balance - current.initial_balance) / current.initial_balance) * 100;
    dom.statNetReturn.textContent = `${netPct >= 0 ? '+' : ''}${netPct.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;
    dom.statTotalTrades.textContent = current.total_trades.toLocaleString();
    dom.kpiWinRate.textContent = `${current.win_rate}%`;

    if (state.equityStrategy === 'real1000') {
      dom.statProfitFactor.textContent = '1.70';
      if (dom.kpiStrategyName) dom.kpiStrategyName.textContent = 'REAL1000 (Vantage Real $250 -> $2,133.86 | WR 65.0%)';
    } else if (state.equityStrategy === 'hector') {
      dom.statProfitFactor.textContent = '1.51';
      if (dom.kpiStrategyName) dom.kpiStrategyName.textContent = 'HECTOR (Vantage Real $200 -> $210.61 | WR 65.5%)';
    } else if (state.equityStrategy === 'bot1000') {
      dom.statProfitFactor.textContent = '5.92';
      if (dom.kpiStrategyName) dom.kpiStrategyName.textContent = 'BOT-1000 (Vantage Demo $1,000 -> $1,104.35 | WR 93.3%)';
    } else if (state.equityStrategy === 'gold_m30') {
      dom.statProfitFactor.textContent = '1.49';
      if (dom.kpiStrategyName) dom.kpiStrategyName.textContent = 'smart+IA (SMC Oro 59.7% WR)';
    } else {
      dom.statProfitFactor.textContent = '1.23';
      if (dom.kpiStrategyName) dom.kpiStrategyName.textContent = 'MARO (GBPUSD 92.8% WR)';
    }

    // Mapear datos para TradingView Area Series
    const seenTimes = new Set();
    const areaData = [];
    current.curve.forEach(c => {
      if (!seenTimes.has(c.time)) {
        seenTimes.add(c.time);
        areaData.push({ time: c.time, value: c.balance });
      }
    });

    areaData.sort((a, b) => new Date(a.time) - new Date(b.time));
    equityAreaSeries.setData(areaData);
    equityChart.timeScale().fitContent();
  }

  // =========================================================================
  // BITÁCORA GENERAL DE OPERACIONES (PESTAÑA 3)
  // =========================================================================
  async function loadBitacoraTrades() {
    let trades = null;
    if (!isFileMode) {
      try {
        const filterParam = state.tradeAccountFilter !== 'ALL' ? `?account=${state.tradeAccountFilter}` : '';
        const res = await fetch(`/api/trades${filterParam}`);
        const data = await res.json();
        if (data && data.trades) {
          trades = data.trades;
        }
      } catch (err) {
        console.warn('Aviso cargando trades online, usando fallback local:', err);
      }
    }
    if (!trades && window.STATIC_DASHBOARD_DATA && window.STATIC_DASHBOARD_DATA.real_trades) {
      const all = window.STATIC_DASHBOARD_DATA.real_trades;
      if (state.tradeAccountFilter === 'ALL') {
        trades = all;
      } else {
        trades = all.filter(t => t.account === state.tradeAccountFilter);
      }
    }

    if (!trades) trades = [];
    state.allTrades = trades;
    renderTradesTable(trades);
  }

  function renderTradesTable(trades) {
    if (!trades || trades.length === 0) {
      dom.tradesTableBody.innerHTML = '<tr><td colspan="9" class="text-center" style="padding:24px; color:var(--text-muted);">No se encontraron operaciones registradas</td></tr>';
      return;
    }

    const filterText = (dom.tradeSearchInput ? dom.tradeSearchInput.value : '').toLowerCase();
    const filtered = trades.filter(t => 
      (t.result && t.result.toLowerCase().includes(filterText)) ||
      (t.time && t.time.toLowerCase().includes(filterText)) ||
      (t.symbol && t.symbol.toLowerCase().includes(filterText)) ||
      (t.account && t.account.toLowerCase().includes(filterText)) ||
      (t.strategy && t.strategy.toLowerCase().includes(filterText))
    );

    dom.tradesTableBody.innerHTML = '';
    const displayList = filtered.slice(-200).reverse();

    displayList.forEach(t => {
      const isWin = t.result === 'WIN' || (t.profit && t.profit > 0);
      const isBuy = (t.type || 'BUY').toUpperCase() === 'BUY';
      
      let accBadge = `<span class="badge" style="background:rgba(255, 171, 0, 0.15); color:#FFAB00; border:1px solid rgba(255,171,0,0.4);">${t.account || 'GENERAL'}</span>`;
      if (t.account === 'REAL1000') {
        accBadge = `<span class="badge" style="background:rgba(0, 230, 118, 0.15); color:#00E676; border:1px solid rgba(0,230,118,0.4);">REAL1000</span>`;
      } else if (t.account === 'HECTOR') {
        accBadge = `<span class="badge" style="background:rgba(0, 229, 255, 0.15); color:#00E5FF; border:1px solid rgba(0,229,255,0.4);">HECTOR</span>`;
      } else if (t.account === 'BOT-1000') {
        accBadge = `<span class="badge" style="background:rgba(187, 134, 252, 0.15); color:#BB86FC; border:1px solid rgba(187,134,252,0.4);">BOT-1000</span>`;
      } else if (t.account === 'SMART+IA') {
        accBadge = `<span class="badge" style="background:rgba(255, 215, 0, 0.15); color:#FFD700; border:1px solid rgba(255,215,0,0.4);">SMART+IA</span>`;
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${t.time || '-'}</td>
        <td>${accBadge}</td>
        <td><strong>${t.symbol || 'GBPUSD'}</strong></td>
        <td><span class="badge ${isBuy ? 'buy' : 'sell'}">${t.type || 'BUY'}</span></td>
        <td>${(t.lot || 0.01).toFixed(2)}</td>
        <td><span class="badge ${isWin ? 'win' : 'loss'}">${isWin ? 'WIN' : 'LOSS'}</span></td>
        <td class="${isWin ? 'green' : 'red'}" style="font-weight:600;">${t.profit >= 0 ? '+' : ''}$${(t.profit || 0).toFixed(2)}</td>
        <td><strong>$${(t.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></td>
        <td><small style="color:var(--text-muted); font-size:11px;">${t.strategy || 'BITACORA REAL'}</small></td>
      `;
      dom.tradesTableBody.appendChild(tr);
    });
  }

  if (dom.tradeSearchInput) {
    dom.tradeSearchInput.addEventListener('input', () => {
      renderTradesTable(state.allTrades);
    });
  }

  if (dom.tradeAccountFilter) {
    dom.tradeAccountFilter.addEventListener('change', (e) => {
      state.tradeAccountFilter = e.target.value;
      loadBitacoraTrades();
    });
  }

  // =========================================================================
  // RADAR INSTITUCIONAL 5:00 AM (PESTAÑA 4)
  // =========================================================================
  async function loadMarketRadar() {
    try {
      let data = null;
      if (!isFileMode) {
        try {
          const res = await fetch('/api/radar');
          data = await res.json();
        } catch (err) {
          console.warn('Aviso cargando radar online:', err);
        }
      }
      if (!data && window.STATIC_DASHBOARD_DATA) {
        data = window.STATIC_DASHBOARD_DATA.radar;
      }

      if (!data || !data.assets || !dom.radarGridContainer) return;

      dom.radarGridContainer.innerHTML = '';
      data.assets.forEach(a => {
        const isBull = a.bias === 'BULLISH';
        const pBuy = a.prob_buy;
        const pSell = a.prob_sell;

        const card = document.createElement('div');
        card.className = `radar-card ${isBull ? 'bullish-glow' : 'bearish-glow'}`;
        card.innerHTML = `
          <div class="radar-card-header">
            <div>
              <div class="radar-asset-title">${a.name}</div>
              <small style="font-family:var(--font-mono); color:var(--text-muted);">${a.symbol} Cotización: ${a.price.toFixed(a.symbol.includes('XAU') ? 2 : 5)}</small>
            </div>
            <span class="radar-bias-pill ${isBull ? 'badge win' : 'badge loss'}">${isBull ? 'SESGO COMPRA' : 'SESGO VENTA'}</span>
          </div>

          <div class="prob-bar-wrapper">
            <div class="prob-labels">
              <span class="green">🟢 Compra: ${pBuy}%</span>
              <span class="red">🔴 Venta: ${pSell}%</span>
            </div>
            <div class="prob-track">
              <div class="prob-fill" style="width: ${pBuy}%;"></div>
            </div>
          </div>

          <div class="multi-tf-row">
            <div class="tf-box">
              <span>H4</span>
              <strong class="${a.trend_h4.includes('ALCISTA') ? 'green' : 'red'}">${a.trend_h4.includes('ALCISTA') ? '▲ ALC' : '▼ BAJ'}</strong>
            </div>
            <div class="tf-box">
              <span>H1</span>
              <strong class="${a.trend_h1.includes('ALCISTA') ? 'green' : 'red'}">${a.trend_h1.includes('ALCISTA') ? '▲ ALC' : '▼ BAJ'}</strong>
            </div>
            <div class="tf-box">
              <span>M15</span>
              <strong class="${a.trend_m15.includes('ALCISTA') ? 'green' : 'red'}">${a.trend_m15.includes('ALCISTA') ? '▲ ALC' : '▼ BAJ'}</strong>
            </div>
            <div class="tf-box">
              <span>Zona</span>
              <strong class="accent">${a.zone.includes('DESCUENTO') ? 'DESCUENTO' : 'PREMIUM'}</strong>
            </div>
          </div>

          <div style="font-size:12px; color:var(--text-secondary); background:rgba(0,0,0,0.25); padding:10px; border-radius:6px;">
            <strong>📰 Análisis Macro / Noticias:</strong>
            <p style="margin-top:4px; font-size:11px; color:var(--text-muted);">${a.news_bias}</p>
          </div>
        `;
        dom.radarGridContainer.appendChild(card);
      });
    } catch (err) {
      console.warn('Aviso cargando radar:', err);
    }
  }

  // =========================================================================
  // EVENT LISTENERS & TABS
  // =========================================================================
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      const pane = document.getElementById(targetId);
      if (pane) pane.classList.add('active');

      if (targetId === 'tab-equity' && equityChart) {
        setTimeout(() => equityChart.applyOptions({ width: equityContainer.clientWidth }), 50);
      }
    });
  });

  // Selector de terminal / bot -> Actualiza panel interactivo, gráficos y cuenta
  dom.terminalSelector.addEventListener('change', (e) => {
    state.activeTerminal = e.target.value;
    state.activeSymbol = state.activeTerminal === 'PEPPERSTONE' ? 'XAUUSD' : 'GBPUSD';
    updateAccountData();
    loadAnalyticsData();
  });

  // Toggle de estrategia / cuenta en Curva de Equidad
  const equityButtons = [
    { btn: dom.btnShowReal1000, key: 'real1000' },
    { btn: dom.btnShowHector, key: 'hector' },
    { btn: dom.btnShowBot1000, key: 'bot1000' },
    { btn: dom.btnShowGold, key: 'gold_m30' },
    { btn: dom.btnShowMaro, key: 'maro_m15' }
  ];

  equityButtons.forEach(item => {
    if (item.btn) {
      item.btn.addEventListener('click', () => {
        equityButtons.forEach(b => b.btn && b.btn.classList.remove('active'));
        item.btn.classList.add('active');
        state.equityStrategy = item.key;
        loadEquityCurves();
      });
    }
  });

  // =========================================================================
  // SECUENCIA DE ARRANQUE
  // =========================================================================
  initEquityChart();

  updateAccountData();
  loadAnalyticsData();
  loadEquityCurves();
  loadBitacoraTrades();
  loadMarketRadar();

  // =========================================================================
  // TEMPORIZADOR Y SINCRONIZACIÓN / REFRESH (ACTIVO EN HTTP Y EN ARCHIVO LOCAL)
  // =========================================================================
  const SYNC_INTERVAL_SEC = 30 * 60; // 30 minutos
  let syncSecondsLeft = SYNC_INTERVAL_SEC;

  function formatCountdown(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `Sinc: ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // Recargar el archivo static_data.js dinámicamente en modo archivo local
  function reloadStaticDataScript() {
    return new Promise((resolve) => {
      const oldScript = document.getElementById('staticDataScript');
      if (oldScript) {
        oldScript.remove();
      }
      const script = document.createElement('script');
      script.id = 'staticDataScript';
      script.src = `static_data.js?t=${Date.now()}`;
      script.onload = () => resolve(true);
      script.onerror = () => {
        console.warn('No se pudo recargar static_data.js con parámetro, intentando sin query');
        const fallback = document.createElement('script');
        fallback.id = 'staticDataScript';
        fallback.src = 'static_data.js';
        fallback.onload = () => resolve(true);
        fallback.onerror = () => resolve(false);
        document.body.appendChild(fallback);
      };
      document.body.appendChild(script);
    });
  }

  async function triggerFullDataRefresh() {
    if (dom.btnRefreshText) dom.btnRefreshText.textContent = "Sincronizando...";
    if (dom.btnManualRefresh) dom.btnManualRefresh.disabled = true;
    if (dom.syncTimerText) {
      dom.syncTimerText.textContent = "Sincronizando...";
    }
    const icon = (dom.btnManualRefresh && dom.btnManualRefresh.querySelector('.sync-icon')) || 
                 (dom.syncTimerBadge && dom.syncTimerBadge.querySelector('.sync-icon'));
    if (icon) icon.classList.add('rotating');

    try {
      if (isFileMode) {
        // En modo carpeta directa (file://), recargar static_data.js para obtener los últimos datos guardados
        await reloadStaticDataScript();
      } else {
        // En modo servidor (http://), invocar extracción en MT5 si el servidor lo soporta
        try {
          await fetch('/api/sync');
        } catch (e) {
          console.warn('Aviso al llamar /api/sync:', e);
        }
      }

      // Re-renderizar todos los módulos con la nueva información
      await Promise.all([
        updateAccountData(),
        loadAnalyticsData(),
        loadBitacoraTrades(),
        loadEquityCurves(),
        loadMarketRadar()
      ]);
    } catch (err) {
      console.warn("Aviso en refresco de datos:", err);
    } finally {
      if (icon) icon.classList.remove('rotating');
      if (dom.btnRefreshText) dom.btnRefreshText.textContent = "Refrescar Datos";
      if (dom.btnManualRefresh) dom.btnManualRefresh.disabled = false;
      syncSecondsLeft = SYNC_INTERVAL_SEC;
      if (dom.syncTimerText) {
        dom.syncTimerText.textContent = formatCountdown(syncSecondsLeft);
      }
    }
  }

  // Activar botón de refresco manual
  if (dom.btnManualRefresh) {
    dom.btnManualRefresh.addEventListener('click', () => {
      triggerFullDataRefresh();
    });
  }

  // Activar badge de sincronización inmediata con cursor clickeable y evento click
  if (dom.syncTimerBadge) {
    dom.syncTimerBadge.style.cursor = isGitHubPages ? 'default' : 'pointer';
    dom.syncTimerBadge.title = isGitHubPages
      ? 'Los datos se actualizan automáticamente desde la PC local cada 30 min'
      : isFileMode
        ? 'Clic para refrescar datos desde static_data.js (Auto-actualiza cada 30 min)'
        : 'Clic para sincronizar en vivo con MT5 (Auto-actualiza cada 30 min)';
    if (!isGitHubPages) {
      dom.syncTimerBadge.addEventListener('click', () => {
        triggerFullDataRefresh();
      });
    }
  }

  // Intervalo de 1 segundo para el reloj del temporizador de 30 minutos (siempre activo)
  setInterval(() => {
    syncSecondsLeft--;
    if (syncSecondsLeft <= 0) {
      triggerFullDataRefresh();
    } else if (dom.syncTimerText) {
      dom.syncTimerText.textContent = formatCountdown(syncSecondsLeft);
    }
  }, 1000);

  // Polling en vivo solo si estamos corriendo con el servidor (http://)
  if (!isFileMode) {
    // Balance y flotante en tiempo real (cada 3 segundos)
    state.pollInterval = setInterval(() => {
      updateAccountData();
    }, 3000);
  }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startDashboard);
} else {
  startDashboard();
}
