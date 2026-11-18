/**
 * RADAR AI COPILOT — MULTI-ASSET INSTITUTIONAL TERMINAL (GBP/USD, XAU/USD, AUD/USD)
 * ==================================================================================
 * 1. Selector interactivo de activo: GBP/USD (Libra), XAU/USD (Oro) y AUD/USD (Australiano)
 *    sincronizado con las tarjetas y filtros del Radar.
 * 2. Gráfico TradingView SMC Engine (Lightweight Charts + Overlay Canvas 60FPS):
 *    - Dibuja gráficamente Order Blocks (OB+ Alcistas y OB- Bajistas) SIN FVG
 *    - Dibuja líneas y piscinas de liquidez BSL (Buy Stops) y SSL (Sell Stops)
 *    - Dibuja línea 50% Equilibrium (Zona Premium vs Descuento), EMAs 12/26 y señales Smart+IA
 * 3. Análisis de Libro de Órdenes, Contratos Compra/Venta y Tendencia H4->M5 para los 3 activos
 * 4. Interacción de IA 100% Institucional:
 *    - Sin mención de nombres personales ni de brokers/proveedores externos
 *    - Voz Femenina Permanente en Español
 */
(function () {
  if (window.__RADAR_AI_COPILOT_LOADED__) return;
  window.__RADAR_AI_COPILOT_LOADED__ = true;

  // Conexión de datos de liquidez institucional v20
  const FEED_TOKEN = "a2b781db6966dceb70368ff1f3b95f43-37cd79091463655c7588182a72a65899";
  const FEED_ACC   = "101-001-40640336-001";
  const FEED_URL   = "https://api-fxpractice.oanda.com/v3";

  // Catálogo de los 3 activos institucionales
  const INSTRUMENTS = {
    "GBP/USD": {
      key: "GBP/USD",
      raw: "GBP_USD",
      mt5: "GBPUSD",
      title: "GBP/USD (Libra / Dólar)",
      shortTitle: "GBP/USD",
      spokenName: "la libra dólar",
      icon: "💷",
      digits: 5,
      boxDecimals: 4,
      pipMult: 10000,
      minMove: 0.00001,
      obMinBody: 0.00008
    },
    "XAU/USD": {
      key: "XAU/USD",
      raw: "XAU_USD",
      mt5: "XAUUSD",
      title: "XAU/USD (Oro / Dólar)",
      shortTitle: "XAU/USD (Oro)",
      spokenName: "el oro",
      icon: "🥇",
      digits: 2,
      boxDecimals: 2,
      pipMult: 100,
      minMove: 0.01,
      obMinBody: 0.35
    },
    "AUD/USD": {
      key: "AUD/USD",
      raw: "AUD_USD",
      mt5: "AUDUSD",
      title: "AUD/USD (Dólar Australiano)",
      shortTitle: "AUD/USD",
      spokenName: "el dólar australiano",
      icon: "🦘",
      digits: 5,
      boxDecimals: 4,
      pipMult: 10000,
      minMove: 0.00001,
      obMinBody: 0.00006
    }
  };

  let currentAssetKey = "GBP/USD";
  const liveAssetsMap = {
    "GBP/USD": null,
    "XAU/USD": null,
    "AUD/USD": null
  };

  // Clave Gemini
  const _kParts = ["AQ.Ab8RN6LEjuVkIR", "Qusa9su2VA6QEG5Ic7", "gQXAd5zWVk9XfliXDw"];
  const GEMINI_KEY = localStorage.getItem("MARO_GEMINI_KEY") || _kParts.join("");
  const GEMINI_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemma-4-31b-it",
    "gemma-4-26b-a4b-it",
    "gemini-3.8-flash",
    "gemini-3.5-flash"
  ];

  let orbState = "idle"; // idle | listening | thinking | speaking
  let isListening = false;
  let recognition = null;
  let autoTimer = null;
  let audioPlayer = new Audio();

  // Estado del Gráfico SMC TradingView
  let tvChart = null;
  let candleSeries = null;
  let emaFastSeries = null;
  let emaSlowSeries = null;
  let currentTf = "M15";
  let chartCandles = [];
  let smcAnalysis = { orderBlocks: [], bslSwing: null, sslSwing: null, eqMid: null, markers: [] };
  let showOB = true;
  let showLiq = true;
  let showEQ = true;
  let showEMA = true;

  function getActiveInst() {
    return INSTRUMENTS[currentAssetKey] || INSTRUMENTS["GBP/USD"];
  }

  // Sanitizador estricto: elimina cualquier mención del nombre del usuario o de OANDA
  function sanitizeInstitutionalText(text) {
    if (!text) return "";
    return String(text)
      .replace(/[*#_`]/g, "")
      .replace(/\bGildardo\b\s*[,:]?\s*/gi, "")
      .replace(/\bde\s+OANDA\s+v20\b/gi, "del flujo institucional")
      .replace(/\bde\s+OANDA\b/gi, "del mercado institucional")
      .replace(/\ben\s+OANDA\b/gi, "en el libro institucional")
      .replace(/\bOANDA\s+v20\b/gi, "flujo institucional")
      .replace(/\bOANDA\b/gi, "flujo institucional")
      .replace(/\s{2,}/g, " ")
      .trim()
      .replace(/^[,.\s]+/, "")
      .replace(/^([a-záéíóúñ])/, m => m.toUpperCase());
  }

  // Inyectar estilos del Copilot y Controles SMC Multi-Activo
  const styleEl = document.createElement("style");
  styleEl.textContent = `
    .copilot-master-panel {
      background: linear-gradient(145deg, rgba(11, 16, 28, 0.96), rgba(7, 10, 18, 0.99));
      border: 1px solid rgba(0, 240, 255, 0.24);
      border-radius: 18px;
      padding: 20px;
      margin-bottom: 26px;
      box-shadow: 0 16px 45px rgba(0, 0, 0, 0.6), 0 0 25px rgba(0, 240, 255, 0.06);
      color: #f0f4f8;
      font-family: 'Inter', 'Outfit', sans-serif;
    }
    .copilot-top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      padding-bottom: 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      margin-bottom: 14px;
    }
    .copilot-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .copilot-badge {
      background: linear-gradient(135deg, #00f0ff, #7000ff);
      color: #fff;
      font-size: 11px;
      font-weight: 800;
      padding: 4px 10px;
      border-radius: 6px;
      letter-spacing: 0.8px;
    }
    .copilot-brand h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 800;
      color: #fff;
    }
    .cp-asset-selector {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 16px;
      padding: 10px 14px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
    }
    .cp-asset-selector-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #8e9bb0;
      margin-right: 6px;
      letter-spacing: 0.6px;
    }
    .cp-asset-btn {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #cbd5e1;
      padding: 8px 16px;
      border-radius: 30px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s ease;
    }
    .cp-asset-btn:hover {
      background: rgba(0, 240, 255, 0.12);
      border-color: rgba(0, 240, 255, 0.4);
      color: #fff;
      transform: translateY(-1px);
    }
    .cp-asset-btn.active {
      background: linear-gradient(135deg, rgba(0, 240, 255, 0.22), rgba(112, 0, 255, 0.28));
      border-color: #00f0ff;
      color: #00f0ff;
      box-shadow: 0 0 18px rgba(0, 240, 255, 0.25);
    }
    .copilot-pills {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
    }
    .cp-pill {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 5px 12px;
      border-radius: 30px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .cp-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #00ff88;
      box-shadow: 0 0 8px #00ff88;
    }
    .cp-strip {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 16px;
    }
    @media (max-width: 1100px) {
      .cp-strip { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 640px) {
      .cp-strip { grid-template-columns: 1fr; }
    }
    .cp-metric-card {
      background: rgba(255, 255, 255, 0.025);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 12px 14px;
    }
    .cp-metric-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 700;
      color: #8e9bb0;
      margin-bottom: 6px;
    }
    .cp-metric-val {
      font-size: 15px;
      font-weight: 800;
      font-family: 'JetBrains Mono', monospace;
      color: #fff;
    }
    .cp-mini-bar {
      height: 7px;
      background: #1a2234;
      border-radius: 4px;
      display: flex;
      overflow: hidden;
      margin: 6px 0 4px;
    }
    .cp-fill-long { background: #00ff88; transition: width 0.4s ease; }
    .cp-fill-short { background: #ff3366; transition: width 0.4s ease; }
    .cp-tf-row {
      display: flex;
      gap: 5px;
      margin-top: 6px;
    }
    .cp-tf-badge {
      flex: 1;
      text-align: center;
      padding: 4px 2px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .cp-tf-badge.bull { color: #00ff88; border-color: rgba(0, 255, 136, 0.35); background: rgba(0, 255, 136, 0.08); }
    .cp-tf-badge.bear { color: #ff3366; border-color: rgba(255, 51, 102, 0.35); background: rgba(255, 51, 102, 0.08); }

    .copilot-cockpit-grid {
      display: grid;
      grid-template-columns: 1fr 370px;
      gap: 16px;
    }
    @media (max-width: 1024px) {
      .copilot-cockpit-grid { grid-template-columns: 1fr; }
    }
    .cp-tv-box {
      background: #070a10;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 14px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      min-height: 550px;
    }
    .cp-tv-head {
      padding: 9px 14px;
      background: rgba(15, 22, 36, 0.9);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      font-size: 12px;
      font-weight: 600;
      color: #cbd5e1;
    }
    .cp-tv-toolbar {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .cp-tf-btn, .cp-layer-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #94a3b8;
      padding: 4px 9px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .cp-tf-btn:hover, .cp-layer-btn:hover {
      background: rgba(0, 240, 255, 0.12);
      color: #fff;
    }
    .cp-tf-btn.active {
      background: rgba(0, 240, 255, 0.2);
      border-color: #00f0ff;
      color: #00f0ff;
    }
    .cp-layer-btn.active {
      background: rgba(0, 230, 118, 0.16);
      border-color: rgba(0, 230, 118, 0.5);
      color: #00e676;
    }
    .cp-chart-stage {
      position: relative;
      flex: 1;
      width: 100%;
      min-height: 500px;
      background: #070a10;
    }
    #cp_lw_chart {
      width: 100%;
      height: 500px;
    }
    #cp_smc_canvas {
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 10;
    }
    .cp-smc-legend {
      position: absolute;
      top: 10px;
      left: 12px;
      z-index: 15;
      pointer-events: none;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      font-size: 11px;
      font-family: 'JetBrains Mono', monospace;
    }
    .cp-leg-pill {
      background: rgba(7, 10, 16, 0.84);
      border: 1px solid rgba(255, 255, 255, 0.12);
      padding: 3px 8px;
      border-radius: 5px;
      display: flex;
      align-items: center;
      gap: 5px;
      backdrop-filter: blur(4px);
    }
    .cp-orb-box {
      background: rgba(15, 20, 32, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .cp-orb-wrap {
      width: 175px;
      height: 175px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .cp-status-pill {
      margin-top: 8px;
      background: rgba(0, 240, 255, 0.1);
      border: 1px solid rgba(0, 240, 255, 0.3);
      color: #00f0ff;
      padding: 4px 12px;
      border-radius: 30px;
      font-size: 11px;
      font-weight: 700;
    }
    .cp-status-pill.listening {
      background: rgba(0, 255, 136, 0.15);
      border-color: #00ff88;
      color: #00ff88;
    }
    .cp-status-pill.speaking {
      background: rgba(168, 85, 247, 0.18);
      border-color: #a855f7;
      color: #d8b4fe;
    }
    .cp-speech-area {
      margin-top: 10px;
      text-align: center;
      min-height: 58px;
      width: 100%;
      padding: 8px 10px;
      background: rgba(0, 0, 0, 0.25);
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .cp-user-q {
      font-size: 11px;
      color: #94a3b8;
      font-style: italic;
      margin-bottom: 4px;
    }
    .cp-ai-a {
      font-size: 13px;
      font-weight: 500;
      line-height: 1.42;
      color: #f1f5f9;
    }
    .cp-btn-mic {
      width: 100%;
      margin-top: 10px;
      background: linear-gradient(135deg, #00f0ff, #0077ff);
      color: #040914;
      border: none;
      padding: 11px 16px;
      border-radius: 40px;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      box-shadow: 0 6px 20px rgba(0, 240, 255, 0.3);
      transition: all 0.2s ease;
    }
    .cp-btn-mic:hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 25px rgba(0, 240, 255, 0.45);
    }
    .cp-btn-mic.recording {
      background: linear-gradient(135deg, #ff3366, #ff0044);
      color: #fff;
      box-shadow: 0 0 22px rgba(255, 51, 102, 0.65);
    }
    .cp-input-row {
      display: flex;
      gap: 6px;
      width: 100%;
      margin-top: 8px;
    }
    .cp-text-input {
      flex: 1;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 20px;
      padding: 8px 12px;
      color: #fff;
      font-size: 12px;
      outline: none;
    }
    .cp-text-input:focus {
      border-color: #00f0ff;
    }
    .cp-btn-send {
      background: rgba(0, 240, 255, 0.15);
      border: 1px solid rgba(0, 240, 255, 0.35);
      color: #00f0ff;
      border-radius: 20px;
      padding: 0 12px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    .cp-quick-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      width: 100%;
      margin-top: 10px;
    }
    .cp-q-btn {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #cbd5e1;
      padding: 7px 11px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: all 0.2s ease;
    }
    .cp-q-btn:hover {
      background: rgba(0, 240, 255, 0.1);
      color: #00f0ff;
      border-color: rgba(0, 240, 255, 0.3);
      padding-left: 14px;
    }
    .radar-card, .strip-card {
      cursor: pointer;
      transition: transform 0.18s ease, box-shadow 0.18s ease;
    }
    .radar-card:hover, .strip-card:hover {
      transform: translateY(-2px);
    }
  `;
  document.head.appendChild(styleEl);

  function buildCopilotHTML() {
    return `
      <div class="copilot-master-panel" id="gbpCopilotMaster">
        <div class="copilot-top-bar">
          <div class="copilot-brand">
            <span class="copilot-badge">SMART+IA SMC ENGINE • ORDER FLOW</span>
            <h3 id="cpHeaderTitle">💷 Agente Institucional en Vivo — GBP/USD (Libra / Dólar)</h3>
          </div>
          <div class="copilot-pills">
            <div class="cp-pill"><span class="cp-dot"></span><span id="cpLiveState">Libro de Órdenes: EN VIVO</span></div>
            <div class="cp-pill" id="cpPricePill">GBP/USD: --</div>
            <div class="cp-pill" id="cpSpreadPill">Spread: --</div>
            <button class="cp-pill" id="cpBtnAuto" style="cursor:pointer; color:#00f0ff;">⏱️ Narradora Auto: OFF</button>
          </div>
        </div>

        <!-- SELECTOR INTERACTIVO DE ACTIVO (GBP/USD, XAU/USD ORO, AUD/USD) -->
        <div class="cp-asset-selector">
          <span class="cp-asset-selector-label">🎯 Seleccionar Activo para Gráfico e IA:</span>
          <button class="cp-asset-btn active" data-cp-asset="GBP/USD">
            <span>💷</span><span>GBP/USD (Libra / Dólar)</span>
          </button>
          <button class="cp-asset-btn" data-cp-asset="XAU/USD">
            <span>🥇</span><span>XAU/USD (Oro / Gold)</span>
          </button>
          <button class="cp-asset-btn" data-cp-asset="AUD/USD">
            <span>🦘</span><span>AUD/USD (Dólar Australiano)</span>
          </button>
        </div>

        <!-- CINTA DE 4 PILARES DEL ACTIVO SELECCIONADO -->
        <div class="cp-strip">
          <!-- 1. INFORME RADAR & SESGO -->
          <div class="cp-metric-card">
            <div class="cp-metric-head">
              <span id="cpPillar1Title">1. Informe Radar GBP/USD</span>
              <span id="cpBiasTag" style="color:#00f0ff;">NEUTRAL</span>
            </div>
            <div class="cp-metric-val" id="cpBiasDesc" style="font-size:13px; color:#00f0ff;">CARGANDO FLUJO...</div>
            <div style="font-size:11px; color:#94a3b8; margin-top:4px;" id="cpProbTxt">Probabilidad: 50% Compra / 50% Venta</div>
          </div>

          <!-- 2. CONTRATOS COMPRA/VENTA (POSITION BOOK) -->
          <div class="cp-metric-card">
            <div class="cp-metric-head">
              <span>2. Contratos Compra vs Venta</span>
              <span style="color:#fbbf24;" id="cpContrarianTag">CONTRARIAN</span>
            </div>
            <div class="cp-mini-bar">
              <div class="cp-fill-long" id="cpBarLong" style="width:50%;"></div>
              <div class="cp-fill-short" id="cpBarShort" style="width:50%;"></div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:11px; font-family:'JetBrains Mono';">
              <span style="color:#00ff88;" id="cpLongPct">🟢 Compras: 50%</span>
              <span style="color:#ff3366;" id="cpShortPct">🔴 Ventas: 50%</span>
            </div>
            <div style="font-size:10px; color:#94a3b8; margin-top:3px;" id="cpTrappedTxt">⚠️ Atrapados en pérdida: --</div>
          </div>

          <!-- 3. LIBRO DE ÓRDENES (ORDER BOOK) -->
          <div class="cp-metric-card">
            <div class="cp-metric-head">
              <span>3. Libro de Órdenes (BSL / SSL)</span>
              <span style="color:#00f0ff;" id="cpObRatio">50% L / 50% S</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-family:'JetBrains Mono'; font-size:12px; margin-top:4px;">
              <span style="color:#00f0ff;" id="cpBslTarget">🎯 BSL: --</span>
              <span style="color:#ff3366;" id="cpSslTarget">🎯 SSL: --</span>
            </div>
            <div style="font-size:11px; color:#94a3b8; margin-top:5px;" id="cpZoneTxt">Zona SMC: --</div>
          </div>

          <!-- 4. TENDENCIA H4 HASTA M5 -->
          <div class="cp-metric-card">
            <div class="cp-metric-head">
              <span>4. Tendencia H4 hasta M5</span>
              <span style="color:#00ff88;" id="cpTfSummary">MULTITEMPORAL</span>
            </div>
            <div class="cp-tf-row">
              <div class="cp-tf-badge bull" id="cpTfH4">H4 🟢</div>
              <div class="cp-tf-badge bull" id="cpTfH1">H1 🟢</div>
              <div class="cp-tf-badge bull" id="cpTfM30">M30 🟢</div>
              <div class="cp-tf-badge bull" id="cpTfM15">M15 🟢</div>
              <div class="cp-tf-badge bull" id="cpTfM5">M5 🟢</div>
            </div>
            <div style="font-size:10px; color:#94a3b8; margin-top:5px;" id="cpH1EqTxt">Rango H1: --</div>
          </div>
        </div>

        <!-- COCKPIT: GRÁFICO TRADINGVIEW SMC (OB + BSL + SSL, SIN FVG) + ORBE DE VOZ FEMENINA -->
        <div class="copilot-cockpit-grid">
          <div class="cp-tv-box">
            <div class="cp-tv-head">
              <div style="display:flex; align-items:center; gap:8px;">
                <span>📈 <strong id="cpChartTitle">Smart+IA SMC Chart — GBP/USD</strong></span>
                <span style="font-size:11px; color:#00e676; font-family:'JetBrains Mono';" id="cpChartStatus">(OB + BSL + SSL Activos)</span>
              </div>
              <div class="cp-tv-toolbar">
                <!-- Selector Temporalidad -->
                <button class="cp-tf-btn" data-cp-tf="M5">M5</button>
                <button class="cp-tf-btn active" data-cp-tf="M15">M15</button>
                <button class="cp-tf-btn" data-cp-tf="M30">M30</button>
                <button class="cp-tf-btn" data-cp-tf="H1">H1</button>
                <button class="cp-tf-btn" data-cp-tf="H4">H4</button>
                <span style="color:#334155;">|</span>
                <!-- Capas Gráficas SMC (SIN FVG) -->
                <button class="cp-layer-btn active" id="btnToggleOB" title="Mostrar/Ocultar Order Blocks">📦 OB</button>
                <button class="cp-layer-btn active" id="btnToggleLiq" title="Mostrar/Ocultar Liquidez BSL y SSL">💧 BSL/SSL</button>
                <button class="cp-layer-btn active" id="btnToggleEQ" title="Mostrar/Ocultar 50% Equilibrium SMC">⚖️ 50% EQ</button>
                <button class="cp-layer-btn active" id="btnToggleEMA" title="Mostrar/Ocultar EMAs 12/26">📈 EMAs</button>
              </div>
            </div>

            <div class="cp-chart-stage" id="cpChartStage">
              <div class="cp-smc-legend">
                <div class="cp-leg-pill"><span style="width:10px;height:10px;background:rgba(0,230,118,0.35);border:1px solid #00E676;display:inline-block;"></span><span>OB+ Alcista (Demanda)</span></div>
                <div class="cp-leg-pill"><span style="width:10px;height:10px;background:rgba(255,23,68,0.35);border:1px solid #FF1744;display:inline-block;"></span><span>OB- Bajista (Oferta)</span></div>
                <div class="cp-leg-pill"><span style="color:#FFD700;">---</span><span>BSL / SSL Estructura</span></div>
                <div class="cp-leg-pill"><span style="color:#00E5FF;">━━</span><span>Piscinas Liquidez (BSL/SSL)</span></div>
              </div>
              <div id="cp_lw_chart"></div>
              <canvas id="cp_smc_canvas"></canvas>
            </div>
          </div>

          <div class="cp-orb-box">
            <div class="cp-orb-wrap">
              <canvas id="cpOrbCanvas" width="380" height="380" style="width:100%; height:100%;"></canvas>
            </div>
            <div class="cp-status-pill" id="cpStatusPill">● Analista IA GBP/USD Lista</div>

            <div class="cp-speech-area">
              <div class="cp-user-q" id="cpUserQ"></div>
              <div class="cp-ai-a" id="cpAiA">"Selecciona GBP/USD, Oro o AUD/USD arriba y haz clic en el micrófono o en un botón para escuchar el análisis institucional."</div>
            </div>

            <button class="cp-btn-mic" id="cpBtnMic">
              <span>🎙️</span>
              <span id="cpMicLabel">Hablar con la IA (Voz en Vivo)</span>
            </button>

            <div class="cp-input-row">
              <input type="text" class="cp-text-input" id="cpTextInput" placeholder="Pregunta sobre el activo seleccionado (o menciona Oro, Libra, AUD)..." />
              <button class="cp-btn-send" id="cpBtnSend">Enviar</button>
            </div>

            <div class="cp-quick-list">
              <div class="cp-q-btn" data-cp-q="REPORT">
                <span id="cpQuick1Lbl">💷 Informe Completo del Radar GBP/USD</span><span>🔊</span>
              </div>
              <div class="cp-q-btn" data-cp-q="OB_LIQ">
                <span>📦 Analizar Order Blocks (OB) y BSL/SSL</span><span>🔊</span>
              </div>
              <div class="cp-q-btn" data-cp-q="CONTRACTS">
                <span>💧 Libro de Órdenes y Contratos Compra/Venta</span><span>🔊</span>
              </div>
              <div class="cp-q-btn" data-cp-q="TRENDS">
                <span>📊 Tendencia desde H4 hasta M5</span><span>🔊</span>
              </div>
              <div class="cp-q-btn" data-cp-q="SETUP">
                <span>🧠 ¿Comprar o Vender Ahora? (Setup)</span><span>🔊</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Cambiar de activo activo (GBP/USD, XAU/USD, AUD/USD) y actualizar gráfico, 4 pilares y contexto de IA
  function selectActiveAsset(assetKey, speakAnnouncement) {
    let targetKey = "GBP/USD";
    const norm = String(assetKey || "").toUpperCase();
    if (norm.includes("XAU") || norm.includes("ORO") || norm.includes("GOLD")) {
      targetKey = "XAU/USD";
    } else if (norm.includes("AUD")) {
      targetKey = "AUD/USD";
    } else if (norm.includes("GBP") || norm.includes("LIBRA")) {
      targetKey = "GBP/USD";
    } else {
      return;
    }

    const changed = (currentAssetKey !== targetKey);
    currentAssetKey = targetKey;
    const inst = getActiveInst();

    // Actualizar botones del selector
    document.querySelectorAll("[data-cp-asset]").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-cp-asset") === currentAssetKey);
    });

    // Actualizar títulos dinámicos
    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setTxt("cpHeaderTitle", `${inst.icon} Agente Institucional en Vivo — ${inst.title}`);
    setTxt("cpPillar1Title", `1. Informe Radar ${inst.shortTitle}`);
    setTxt("cpChartTitle", `Smart+IA SMC Chart — ${inst.shortTitle}`);
    setTxt("cpQuick1Lbl", `${inst.icon} Informe Completo del Radar ${inst.shortTitle}`);
    if (orbState === "idle") {
      setTxt("cpStatusPill", `● Analista IA ${inst.shortTitle} Lista`);
    }

    // Ajustar formato de decimales de la serie de velas en TradingView LightweightCharts
    if (candleSeries) {
      candleSeries.applyOptions({
        priceFormat: { type: "price", precision: inst.digits, minMove: inst.minMove }
      });
    }

    // Actualizar telemetría de los 4 pilares y recargar velas + Order Blocks + BSL/SSL del activo
    const activeData = getAssetData(currentAssetKey);
    if (activeData) {
      renderCopilotTelemetry(activeData);
    } else {
      refreshSingleAssetFlow(currentAssetKey);
    }

    if (changed || !chartCandles.length) {
      chartCandles = [];
      loadChartCandles(currentTf, false);
    }

    if (speakAnnouncement) {
      askCopilotAI(`Dame el informe situacional completo del Radar para ${inst.shortTitle} con sus Order Blocks y liquidez.`);
    }
  }

  function mountCopilot() {
    const radarHeader = document.querySelector("#tab-radar .radar-header") || document.querySelector(".public-radar-wrapper .radar-header");
    if (!radarHeader) return;

    const wrapper = document.createElement("div");
    wrapper.innerHTML = buildCopilotHTML();
    radarHeader.parentNode.insertBefore(wrapper.firstElementChild, radarHeader);

    initOrbAnimation();
    ensureLightweightChartsLoaded(() => {
      initSmcTradingViewChart();
      loadChartCandles(currentTf);
      let retries = 0;
      const wd = setInterval(() => {
        retries++;
        if (chartCandles.length > 10 || retries > 15) {
          clearInterval(wd);
        } else {
          loadChartCandles(currentTf, true);
        }
      }, 600);
    });
    bindCopilotEvents();
    refreshAllAssetsTelemetry();
    setInterval(refreshAllAssetsTelemetry, 14000);
    setInterval(() => loadChartCandles(currentTf, true), 15000);
  }

  function ensureLightweightChartsLoaded(cb) {
    if (typeof window.LightweightCharts !== "undefined") {
      cb();
      return;
    }
    const s = document.createElement("script");
    const isSubdir = window.location.pathname.includes("/radar");
    s.src = isSubdir ? "../lightweight-charts.standalone.production.js" : "lightweight-charts.standalone.production.js";
    s.onload = cb;
    s.onerror = () => {
      const s2 = document.createElement("script");
      s2.src = "https://unpkg.com/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js";
      s2.onload = cb;
      document.head.appendChild(s2);
    };
    document.head.appendChild(s);
  }

  // =========================================================================
  // MOTOR GRÁFICO SMART+IA SMC (ORDER BLOCKS + BSL + SSL — SIN FVG)
  // =========================================================================
  function initSmcTradingViewChart() {
    const container = document.getElementById("cp_lw_chart");
    const stage = document.getElementById("cpChartStage");
    const overlay = document.getElementById("cp_smc_canvas");
    if (!container || !window.LightweightCharts) return;

    const inst = getActiveInst();
    container.innerHTML = "";
    tvChart = window.LightweightCharts.createChart(container, {
      width: container.clientWidth || 800,
      height: 500,
      layout: {
        background: { color: "#070a10" },
        textColor: "#94a3b8",
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace"
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.03)" },
        horzLines: { color: "rgba(255, 255, 255, 0.03)" }
      },
      crosshair: {
        mode: window.LightweightCharts.CrosshairMode.Normal
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        scaleMargins: { top: 0.1, bottom: 0.1 }
      },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 10,
        barSpacing: 9
      }
    });

    candleSeries = tvChart.addCandlestickSeries({
      upColor: "#00E676",
      downColor: "#FF1744",
      borderUpColor: "#00E676",
      borderDownColor: "#FF1744",
      wickUpColor: "#00E676",
      wickDownColor: "#FF1744",
      priceFormat: { type: "price", precision: inst.digits, minMove: inst.minMove }
    });

    emaFastSeries = tvChart.addLineSeries({
      color: "rgba(0, 230, 118, 0.85)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false
    });

    emaSlowSeries = tvChart.addLineSeries({
      color: "rgba(0, 229, 255, 0.75)",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false
    });

    function syncCanvasSize() {
      if (!overlay || !container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        tvChart.applyOptions({ width: w, height: h });
        overlay.width = w;
        overlay.height = h;
        overlay.style.width = w + "px";
        overlay.style.height = h + "px";
        drawSmcOverlay();
      }
    }

    window.addEventListener("resize", syncCanvasSize);
    if (window.ResizeObserver) {
      new ResizeObserver(syncCanvasSize).observe(stage);
    }
    document.querySelectorAll('[data-tab="tab-radar"]').forEach(tabBtn => {
      tabBtn.addEventListener("click", () => {
        [30, 120, 300].forEach(ms => setTimeout(() => {
          syncCanvasSize();
          if (tvChart) tvChart.timeScale().fitContent();
          requestAnimationFrame(drawSmcOverlay);
        }, ms));
      });
    });
    syncCanvasSize();

    tvChart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      requestAnimationFrame(drawSmcOverlay);
    });
    tvChart.subscribeCrosshairMove(() => {
      requestAnimationFrame(drawSmcOverlay);
    });
  }

  function computeSmcZones(candles) {
    if (!candles || candles.length < 15) {
      return { orderBlocks: [], bslSwing: null, sslSwing: null, eqMid: null, markers: [] };
    }

    const inst = getActiveInst();
    const minBody = inst.obMinBody || 0.00008;
    const n = candles.length;
    const rawOBs = [];

    for (let i = 1; i < n; i++) {
      const prev = candles[i - 1];
      const curr = candles[i];
      const prevBody = Math.abs(prev.close - prev.open);
      const currBody = Math.abs(curr.close - curr.open);

      const isObBull = (prev.close < prev.open) && (curr.close > curr.open) &&
                       (curr.close > prev.high) && (currBody > 1.32 * Math.max(prevBody, minBody));

      const isObBear = (prev.close > prev.open) && (curr.close < curr.open) &&
                       (curr.close < prev.low) && (currBody > 1.32 * Math.max(prevBody, minBody));

      if (isObBull) {
        rawOBs.push({
          type: "BULL",
          top: prev.high,
          bot: prev.low,
          startTime: prev.time,
          startIdx: i - 1
        });
      }
      if (isObBear) {
        rawOBs.push({
          type: "BEAR",
          top: prev.high,
          bot: prev.low,
          startTime: prev.time,
          startIdx: i - 1
        });
      }
    }

    const activeOBs = [];
    rawOBs.forEach(ob => {
      let broken = false;
      for (let j = ob.startIdx + 2; j < n; j++) {
        if (ob.type === "BULL" && candles[j].close < ob.bot) { broken = true; break; }
        if (ob.type === "BEAR" && candles[j].close > ob.top) { broken = true; break; }
      }
      if (!broken) activeOBs.push(ob);
    });

    const bullOBs = activeOBs.filter(o => o.type === "BULL").slice(-3);
    const bearOBs = activeOBs.filter(o => o.type === "BEAR").slice(-3);

    let maxH = -Infinity, minL = Infinity, maxIdx = n - 1, minIdx = n - 1;
    for (let i = Math.max(0, n - 90); i < n; i++) {
      if (candles[i].high > maxH) { maxH = candles[i].high; maxIdx = i; }
      if (candles[i].low < minL)  { minL = candles[i].low;  minIdx = i; }
    }
    if (bullOBs.length === 0 && minIdx >= 0) {
      const c = candles[minIdx];
      bullOBs.push({ type: "BULL", top: c.high, bot: c.low, startTime: c.time, startIdx: minIdx });
    }
    if (bearOBs.length === 0 && maxIdx >= 0) {
      const c = candles[maxIdx];
      bearOBs.push({ type: "BEAR", top: c.high, bot: c.low, startTime: c.time, startIdx: maxIdx });
    }

    const eqMid = (maxH + minL) / 2.0;

    const markers = [];
    const kFast = 2 / 13, kSlow = 2 / 27;
    let eF = candles[0].close, eS = candles[0].close;
    let lastSig = 0;

    for (let i = 1; i < n; i++) {
      const c = candles[i].close;
      const pC = candles[i - 1].close;
      const prevEf = eF;
      eF = c * kFast + eF * (1 - kFast);
      eS = c * kSlow + eS * (1 - kSlow);

      if (i > n - 65) {
        if (pC <= prevEf && c > eF && eF > eS && lastSig !== 1) {
          lastSig = 1;
          markers.push({
            time: candles[i].time,
            position: "belowBar",
            color: "#00E676",
            shape: "arrowUp",
            text: "BUY Smart+IA"
          });
        } else if (pC >= prevEf && c < eF && eF < eS && lastSig !== -1) {
          lastSig = -1;
          markers.push({
            time: candles[i].time,
            position: "aboveBar",
            color: "#FF1744",
            shape: "arrowDown",
            text: "SELL Smart+IA"
          });
        }
      }
    }

    return {
      orderBlocks: [...bullOBs, ...bearOBs],
      bslSwing: maxH,
      sslSwing: minL,
      eqMid: eqMid,
      markers: markers
    };
  }

  function drawSmcOverlay() {
    const overlay = document.getElementById("cp_smc_canvas");
    if (!overlay || !tvChart || !candleSeries || !chartCandles.length) return;
    const ctx = overlay.getContext("2d");
    const W = overlay.width;
    const H = overlay.height;
    ctx.clearRect(0, 0, W, H);

    const inst = getActiveInst();
    const dBox = inst.boxDecimals;
    const dFull = inst.digits;
    const chartRightEdge = W - 70;
    const ts = tvChart.timeScale();

    // 1. DIBUJAR ORDER BLOCKS (OB+ Alcistas y OB- Bajistas — SIN FVG)
    if (showOB && smcAnalysis.orderBlocks && smcAnalysis.orderBlocks.length) {
      smcAnalysis.orderBlocks.forEach(ob => {
        const yTop = candleSeries.priceToCoordinate(ob.top);
        const yBot = candleSeries.priceToCoordinate(ob.bot);
        if (yTop === null || yBot === null) return;

        let xStart = ts.timeToCoordinate(ob.startTime);
        if (xStart === null) xStart = 20;
        xStart = Math.max(0, Math.min(xStart, chartRightEdge - 40));

        const boxX = xStart;
        const boxY = Math.min(yTop, yBot);
        const boxW = Math.max(30, chartRightEdge - boxX);
        const boxH = Math.max(10, Math.abs(yBot - yTop));

        const isBull = ob.type === "BULL";
        ctx.fillStyle = isBull ? "rgba(0, 230, 118, 0.17)" : "rgba(255, 23, 68, 0.17)";
        ctx.fillRect(boxX, boxY, boxW, boxH);

        ctx.strokeStyle = isBull ? "rgba(0, 230, 118, 0.85)" : "rgba(255, 23, 68, 0.85)";
        ctx.lineWidth = 1.4;
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        const yMid = boxY + boxH / 2;
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = isBull ? "rgba(0, 230, 118, 0.45)" : "rgba(255, 23, 68, 0.45)";
        ctx.beginPath();
        ctx.moveTo(boxX, yMid);
        ctx.lineTo(boxX + boxW, yMid);
        ctx.stroke();
        ctx.restore();

        ctx.font = "bold 11px 'JetBrains Mono', monospace";
        ctx.fillStyle = isBull ? "#00E676" : "#FF5252";
        const label = isBull
          ? `📦 OB+ Alcista (${ob.bot.toFixed(dBox)} - ${ob.top.toFixed(dBox)})`
          : `📦 OB- Bajista (${ob.bot.toFixed(dBox)} - ${ob.top.toFixed(dBox)})`;
        ctx.fillText(label, Math.max(boxX + 6, chartRightEdge - 255), boxY + Math.min(boxH - 4, 14));
      });
    }

    function drawPriceHorizontalLine(price, color, dashArr, labelText, pillBg) {
      if (!price) return;
      const y = candleSeries.priceToCoordinate(price);
      if (y === null || y < 5 || y > H - 25) return;

      ctx.save();
      ctx.setLineDash(dashArr);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(25, y);
      ctx.lineTo(chartRightEdge, y);
      ctx.stroke();
      ctx.restore();

      ctx.font = "bold 11px 'JetBrains Mono', monospace";
      const textW = ctx.measureText(labelText).width;
      const px = Math.max(30, chartRightEdge - textW - 22);
      const py = y - 18;

      ctx.fillStyle = pillBg || "rgba(7, 10, 16, 0.88)";
      ctx.fillRect(px, py, textW + 14, 17);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(px, py, textW + 14, 17);

      ctx.fillStyle = color;
      ctx.fillText(labelText, px + 7, py + 12);
    }

    const activeData = getAssetData(currentAssetKey);

    // 2. DIBUJAR LÍNEAS DE LIQUIDEZ BSL Y SSL
    if (showLiq) {
      if (smcAnalysis.bslSwing) {
        drawPriceHorizontalLine(
          smcAnalysis.bslSwing,
          "#FFD700",
          [6, 4],
          `💧 BSL Liquidez Compradora (${smcAnalysis.bslSwing.toFixed(dFull)})`,
          "rgba(20, 16, 5, 0.9)"
        );
      }
      if (smcAnalysis.sslSwing) {
        drawPriceHorizontalLine(
          smcAnalysis.sslSwing,
          "#FFD700",
          [6, 4],
          `💧 SSL Liquidez Vendedora (${smcAnalysis.sslSwing.toFixed(dFull)})`,
          "rgba(20, 16, 5, 0.9)"
        );
      }

      if (activeData && activeData.order_book) {
        const ob = activeData.order_book;
        (ob.top_bsl || []).slice(0, 2).forEach((b, idx) => {
          drawPriceHorizontalLine(
            b.price,
            "#00E5FF",
            [2, 2],
            `🎯 Pool BSL #${idx + 1}: ${b.price.toFixed(dBox)} (+${b.dist_pips}p | ${b.density_pct}%)`,
            "rgba(4, 22, 32, 0.92)"
          );
        });
        (ob.top_ssl || []).slice(0, 2).forEach((b, idx) => {
          drawPriceHorizontalLine(
            b.price,
            "#FF3366",
            [2, 2],
            `🎯 Pool SSL #${idx + 1}: ${b.price.toFixed(dBox)} (-${b.dist_pips}p | ${b.density_pct}%)`,
            "rgba(32, 6, 16, 0.92)"
          );
        });
      }
    }

    // 3. DIBUJAR LÍNEA 50% EQUILIBRIUM (ZONA PREMIUM vs DESCUENTO)
    if (showEQ && smcAnalysis.eqMid) {
      drawPriceHorizontalLine(
        smcAnalysis.eqMid,
        "#38BDF8",
        [3, 3],
        `⚖️ 50% Equilibrium SMC (${smcAnalysis.eqMid.toFixed(dFull)}) — Premium / Descuento`,
        "rgba(8, 20, 38, 0.9)"
      );
    }
  }

  function getAssetData(assetKey) {
    if (liveAssetsMap[assetKey]) return liveAssetsMap[assetKey];
    if (window.STATIC_DASHBOARD_DATA && window.STATIC_DASHBOARD_DATA.radar && window.STATIC_DASHBOARD_DATA.radar.assets) {
      const prefix = assetKey.split("/")[0];
      const found = window.STATIC_DASHBOARD_DATA.radar.assets.find(a => a.symbol && a.symbol.includes(prefix));
      if (found) {
        liveAssetsMap[assetKey] = found;
        return found;
      }
    }
    return null;
  }

  function getCachedCandlesForTf(assetKey, tf) {
    const assetObj = getAssetData(assetKey);
    if (assetObj && assetObj.technical_smc) {
      const smc = assetObj.technical_smc;
      if (smc.candles_by_tf && smc.candles_by_tf[tf] && smc.candles_by_tf[tf].length > 10) {
        return smc.candles_by_tf[tf];
      }
      if (smc.candles_m15 && smc.candles_m15.length > 10) {
        return smc.candles_m15;
      }
    }
    return [];
  }

  function renderCandlesIntoChart(candles, tf, silentUpdate) {
    if (!candleSeries || !candles || !candles.length) return;
    const inst = getActiveInst();
    const mapByTime = new Map();
    candles.forEach(c => {
      if (c && typeof c.time === "number" && !isNaN(c.open) && !isNaN(c.close)) {
        mapByTime.set(c.time, c);
      }
    });
    const cleanCandles = Array.from(mapByTime.values()).sort((a, b) => a.time - b.time);
    if (cleanCandles.length < 5) return;

    chartCandles = cleanCandles;
    candleSeries.setData(cleanCandles);

    const ema12 = [], ema26 = [];
    const k12 = 2 / 13, k26 = 2 / 27;
    let e12 = cleanCandles[0].close, e26 = cleanCandles[0].close;
    cleanCandles.forEach(c => {
      e12 = c.close * k12 + e12 * (1 - k12);
      e26 = c.close * k26 + e26 * (1 - k26);
      ema12.push({ time: c.time, value: Number(e12.toFixed(inst.digits)) });
      ema26.push({ time: c.time, value: Number(e26.toFixed(inst.digits)) });
    });

    emaFastSeries.setData(showEMA ? ema12 : []);
    emaSlowSeries.setData(showEMA ? ema26 : []);

    smcAnalysis = computeSmcZones(cleanCandles);
    if (showEMA && smcAnalysis.markers) {
      candleSeries.setMarkers(smcAnalysis.markers);
    } else {
      candleSeries.setMarkers([]);
    }

    const container = document.getElementById("cp_lw_chart");
    const overlay = document.getElementById("cp_smc_canvas");
    if (container && overlay && container.clientWidth > 0) {
      tvChart.applyOptions({ width: container.clientWidth, height: container.clientHeight || 500 });
      overlay.width = container.clientWidth;
      overlay.height = container.clientHeight || 500;
    }

    if (!silentUpdate) {
      tvChart.timeScale().fitContent();
    }
    const statusEl = document.getElementById("cpChartStatus");
    if (statusEl) {
      statusEl.textContent = `(${inst.shortTitle} ${tf} • ${smcAnalysis.orderBlocks.length} OB Activos + BSL/SSL)`;
    }
    requestAnimationFrame(drawSmcOverlay);
    setTimeout(() => requestAnimationFrame(drawSmcOverlay), 120);
  }

  async function loadChartCandles(tf, silentUpdate) {
    if (!candleSeries) return;
    const inst = getActiveInst();
    const requestedKey = currentAssetKey;
    const statusEl = document.getElementById("cpChartStatus");
    if (!silentUpdate && statusEl) statusEl.textContent = `(Cargando ${inst.shortTitle} ${tf}...)`;

    // 1. Renderizar de inmediato desde caché pre-sincronizado
    const cached = getCachedCandlesForTf(requestedKey, tf);
    if (cached.length > 10 && (!chartCandles.length || !silentUpdate)) {
      renderCandlesIntoChart(cached, tf, silentUpdate);
    }

    // 2. Actualizar en vivo desde feed institucional
    try {
      const headers = { Authorization: "Bearer " + FEED_TOKEN };
      const res = await fetch(`${FEED_URL}/instruments/${inst.raw}/candles?count=110&granularity=${tf}`, { headers });
      if (res.ok && currentAssetKey === requestedKey) {
        const j = await res.json();
        const liveC = (j.candles || []).map(c => ({
          time: Math.floor(new Date(c.time).getTime() / 1000),
          open: parseFloat(c.mid.o),
          high: parseFloat(c.mid.h),
          low: parseFloat(c.mid.l),
          close: parseFloat(c.mid.c)
        }));
        if (liveC.length > 10) {
          renderCandlesIntoChart(liveC, tf, silentUpdate);
          return;
        }
      }
    } catch (e) {}

    if (currentAssetKey === requestedKey) {
      const retryCached = getCachedCandlesForTf(requestedKey, tf);
      if (retryCached.length > 10) {
        renderCandlesIntoChart(retryCached, tf, silentUpdate);
      }
    }
  }

  // --- ANIMACIÓN DEL ORBE 3D ---
  function initOrbAnimation() {
    const canvas = document.getElementById("cpOrbCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let angle = 0;

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const baseR = 76;
      angle += 0.03;

      let pulse = Math.sin(angle * 2) * 5;
      let c1 = "#00f0ff", c2 = "#7000ff", glow = "rgba(0, 240, 255, 0.35)";

      if (orbState === "listening") {
        pulse = Math.sin(angle * 6) * 14;
        c1 = "#00ff88"; c2 = "#00d0ff"; glow = "rgba(0, 255, 136, 0.55)";
      } else if (orbState === "thinking") {
        pulse = Math.sin(angle * 8) * 10;
        c1 = "#a855f7"; c2 = "#ec4899"; glow = "rgba(168, 85, 247, 0.6)";
      } else if (orbState === "speaking") {
        pulse = Math.sin(angle * 5) * 16 + (Math.random() * 5);
        c1 = "#38bdf8"; c2 = "#818cf8"; glow = "rgba(56, 189, 248, 0.65)";
      }

      const r = baseR + pulse;
      const gGlow = ctx.createRadialGradient(cx, cy, r * 0.35, cx, cy, r * 1.6);
      gGlow.addColorStop(0, glow);
      gGlow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.6, 0, Math.PI * 2);
      ctx.fill();

      const grad = ctx.createRadialGradient(
        cx - r * 0.3 * Math.cos(angle),
        cy - r * 0.3 * Math.sin(angle),
        r * 0.1, cx, cy, r
      );
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.35, c1);
      grad.addColorStop(0.85, c2);
      grad.addColorStop(1, "#050a18");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.lineWidth = 2;
      ctx.strokeStyle = c1;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 1.25, r * 0.4, angle * 0.8, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = c2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 1.25, r * 0.4, -angle * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1.0;

      requestAnimationFrame(draw);
    }
    draw();
  }

  function setOrbState(st, label) {
    orbState = st;
    const inst = getActiveInst();
    const pill = document.getElementById("cpStatusPill");
    if (!pill) return;
    pill.className = "cp-status-pill " + st;
    pill.textContent = label || (
      st === "idle" ? `● Analista IA ${inst.shortTitle} Lista` :
      st === "listening" ? "🎙️ Escuchando tu voz..." :
      st === "thinking" ? `⚡ Analizando ${inst.shortTitle}...` :
      "🔊 Narrando Informe..."
    );
  }

  function calcCandleTrend(candles) {
    if (!candles || !candles.length) return { trend: "NEUTRAL ⚪", is_bull: true, high: 0, low: 0 };
    const closes = candles.map(c => parseFloat(c.mid.c));
    const highs  = candles.map(c => parseFloat(c.mid.h));
    const lows   = candles.map(c => parseFloat(c.mid.l));
    const k = 2 / (Math.min(20, closes.length) + 1);
    let ema = closes[0];
    for (let i = 1; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k);
    const isBull = closes[closes.length - 1] >= ema;
    return {
      trend: isBull ? "ALCISTA 🟢" : "BAJISTA 🔴",
      is_bull: isBull,
      high: Math.max(...highs),
      low: Math.min(...lows)
    };
  }

  async function fetchDirectAssetFlow(assetKey) {
    const inst = INSTRUMENTS[assetKey] || INSTRUMENTS["GBP/USD"];
    const headers = { Authorization: "Bearer " + FEED_TOKEN };
    const [prRes, pbRes, obRes, h4Res, h1Res, m30Res, m15Res, m5Res] = await Promise.all([
      fetch(`${FEED_URL}/accounts/${FEED_ACC}/pricing?instruments=${inst.raw}`, { headers }),
      fetch(`${FEED_URL}/instruments/${inst.raw}/positionBook`, { headers }),
      fetch(`${FEED_URL}/instruments/${inst.raw}/orderBook`, { headers }),
      fetch(`${FEED_URL}/instruments/${inst.raw}/candles?count=35&granularity=H4`, { headers }),
      fetch(`${FEED_URL}/instruments/${inst.raw}/candles?count=35&granularity=H1`, { headers }),
      fetch(`${FEED_URL}/instruments/${inst.raw}/candles?count=35&granularity=M30`, { headers }),
      fetch(`${FEED_URL}/instruments/${inst.raw}/candles?count=35&granularity=M15`, { headers }),
      fetch(`${FEED_URL}/instruments/${inst.raw}/candles?count=35&granularity=M5`, { headers })
    ]);

    const prJson = await prRes.json();
    const pObj = (prJson.prices && prJson.prices[0]) || {};
    const bid = parseFloat(pObj.closeoutBid || 0);
    const ask = parseFloat(pObj.closeoutAsk || 0);
    const price = Number(((bid + ask) / 2).toFixed(inst.digits));
    const spread_pips = Number(((ask - bid) * inst.pipMult).toFixed(1));

    const pbJson = (await pbRes.json()).positionBook || {};
    const pbBuckets = pbJson.buckets || [];
    let tLong = 0, tShort = 0, lLoss = 0, sLoss = 0;
    pbBuckets.forEach(b => {
      const lp = parseFloat(b.longCountPercent || 0);
      const sp = parseFloat(b.shortCountPercent || 0);
      const bp = parseFloat(b.price || 0);
      tLong += lp;
      tShort += sp;
      if (bp > price) lLoss += lp;
      if (bp < price) sLoss += sp;
    });
    const totPos = tLong + tShort || 1;
    const long_pct = Number(((tLong / totPos) * 100).toFixed(1));
    const short_pct = Number(((tShort / totPos) * 100).toFixed(1));
    const longs_in_loss = Number(lLoss.toFixed(1));
    const shorts_in_loss = Number(sLoss.toFixed(1));

    const obJson = (await obRes.json()).orderBook || {};
    const obBuckets = obJson.buckets || [];
    let obL = 0, obS = 0;
    const nearBsl = [], nearSsl = [];
    obBuckets.forEach(b => {
      const bp = parseFloat(b.price || 0);
      const lp = parseFloat(b.longCountPercent || 0);
      const sp = parseFloat(b.shortCountPercent || 0);
      obL += lp;
      obS += sp;
      if (bp > price && bp <= price * 1.03) nearBsl.push({ price: bp, density_pct: lp, dist_pips: Number(((bp - price) * inst.pipMult).toFixed(1)) });
      if (bp < price && bp >= price * 0.97) nearSsl.push({ price: bp, density_pct: sp, dist_pips: Number(((price - bp) * inst.pipMult).toFixed(1)) });
    });
    nearBsl.sort((a, b) => b.density_pct - a.density_pct);
    nearSsl.sort((a, b) => b.density_pct - a.density_pct);
    const top_bsl = nearBsl.slice(0, 3);
    const top_ssl = nearSsl.slice(0, 3);
    const totOb = obL + obS || 1;
    const order_long_pct = Number(((obL / totOb) * 100).toFixed(1));
    const order_short_pct = Number(((obS / totOb) * 100).toFixed(1));

    const tH4  = calcCandleTrend((await h4Res.json()).candles);
    const tH1  = calcCandleTrend((await h1Res.json()).candles);
    const tM30 = calcCandleTrend((await m30Res.json()).candles);
    const tM15 = calcCandleTrend((await m15Res.json()).candles);
    const tM5  = calcCandleTrend((await m5Res.json()).candles);

    const h1_high = tH1.high || price;
    const h1_low  = tH1.low  || price;
    const h1_mid  = (h1_high + h1_low) / 2;
    const is_discount = price < h1_mid;
    const zone = is_discount ? "DESCUENTO 🟢 (Busca Compras)" : "PREMIUM 🔴 (Busca Ventas)";

    let sBuy = 50, sSell = 50;
    if (long_pct > 55) sSell += Math.round((long_pct - 50) * 0.8);
    else if (short_pct > 55) sBuy += Math.round((short_pct - 50) * 0.8);
    if (order_long_pct > 55) sBuy += 10;
    else if (order_short_pct > 55) sSell += 10;
    if (tH4.is_bull) sBuy += 10; else sSell += 10;
    if (tH1.is_bull) sBuy += 10; else sSell += 10;
    if (tM15.is_bull) sBuy += 5; else sSell += 5;
    if (is_discount) sBuy += 15; else sSell += 15;

    const prob_buy = Math.round((sBuy / (sBuy + sSell)) * 100);
    const prob_sell = 100 - prob_buy;
    const bias = prob_buy >= 53 ? "BULLISH" : (prob_sell >= 53 ? "BEARISH" : "NEUTRAL");
    const bias_desc = bias === "BULLISH" ? "SESGO INSTITUCIONAL COMPRA" : (bias === "BEARISH" ? "SESGO INSTITUCIONAL VENTA" : "MERCADO EN RANGO / NEUTRAL");

    // Preservar candles_by_tf pre-cargadas si existen
    const existing = liveAssetsMap[assetKey];
    const cachedCandlesByTf = (existing && existing.technical_smc && existing.technical_smc.candles_by_tf) || undefined;

    return {
      symbol: inst.key,
      name: inst.title,
      price, bid, ask, spread_pips,
      bias, bias_desc, prob_buy, prob_sell,
      retail_sentiment: {
        long_pct, short_pct, longs_in_loss, shorts_in_loss,
        summary: `Minoristas ${long_pct}% Comprados vs ${short_pct}% Vendidos. El flujo institucional contrarian favorece ${long_pct > 58 ? 'VENTA por exceso de compradores atrapados' : (short_pct > 58 ? 'COMPRA por exceso de vendedores atrapados' : 'operativa en extremos de liquidez')}.`
      },
      order_book: {
        order_long_pct, order_short_pct,
        top_bsl, top_ssl,
        bsl_target: top_bsl[0] ? top_bsl[0].price : h1_high,
        ssl_target: top_ssl[0] ? top_ssl[0].price : h1_low
      },
      technical_smc: {
        trend_h4: tH4.trend,
        trend_h1: tH1.trend,
        trend_m30: tM30.trend,
        trend_m15: tM15.trend,
        trend_m5: tM5.trend,
        zone, h1_high, h1_low,
        candles_by_tf: cachedCandlesByTf
      }
    };
  }

  async function refreshSingleAssetFlow(assetKey) {
    try {
      const direct = await fetchDirectAssetFlow(assetKey);
      if (direct && direct.price) {
        liveAssetsMap[assetKey] = direct;
        if (currentAssetKey === assetKey) {
          renderCopilotTelemetry(direct);
          requestAnimationFrame(drawSmcOverlay);
        }
        return direct;
      }
    } catch (e) {}

    const fallback = getAssetData(assetKey);
    if (fallback && currentAssetKey === assetKey) {
      renderCopilotTelemetry(fallback);
      requestAnimationFrame(drawSmcOverlay);
    }
    return fallback;
  }

  async function refreshAllAssetsTelemetry() {
    // 1. Inicializar primero con static_data.js si aún no hay datos
    if (window.STATIC_DASHBOARD_DATA && window.STATIC_DASHBOARD_DATA.radar && window.STATIC_DASHBOARD_DATA.radar.assets) {
      window.STATIC_DASHBOARD_DATA.radar.assets.forEach(a => {
        if (a.symbol && a.symbol.includes("GBP") && !liveAssetsMap["GBP/USD"]) liveAssetsMap["GBP/USD"] = a;
        if (a.symbol && a.symbol.includes("XAU") && !liveAssetsMap["XAU/USD"]) liveAssetsMap["XAU/USD"] = a;
        if (a.symbol && a.symbol.includes("AUD") && !liveAssetsMap["AUD/USD"]) liveAssetsMap["AUD/USD"] = a;
      });
      const cur = getAssetData(currentAssetKey);
      if (cur) renderCopilotTelemetry(cur);
    }

    // 2. Actualizar el activo seleccionado en vivo
    await refreshSingleAssetFlow(currentAssetKey);
  }

  function renderCopilotTelemetry(d) {
    if (!d) return;
    const inst = getActiveInst();
    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    const priceFmt = inst.key === "XAU/USD" ? `$${Number(d.price).toFixed(2)}` : Number(d.price).toFixed(5);
    setTxt("cpPricePill", `${inst.shortTitle}: ${priceFmt}`);
    setTxt("cpSpreadPill", `Spread: ${d.spread_pips} pips`);
    setTxt("cpBiasDesc", d.bias_desc || "MERCADO EN RANGO");
    setTxt("cpBiasTag", d.bias === "BULLISH" ? "COMPRA 🟢" : (d.bias === "BEARISH" ? "VENTA 🔴" : "NEUTRAL ⚪"));
    setTxt("cpProbTxt", `Probabilidad: ${d.prob_buy}% Compra / ${d.prob_sell}% Venta`);

    const rs = d.retail_sentiment || {};
    const barL = document.getElementById("cpBarLong");
    const barS = document.getElementById("cpBarShort");
    if (barL) barL.style.width = (rs.long_pct || 50) + "%";
    if (barS) barS.style.width = (rs.short_pct || 50) + "%";
    setTxt("cpLongPct", `🟢 Compras: ${rs.long_pct || 50}%`);
    setTxt("cpShortPct", `🔴 Ventas: ${rs.short_pct || 50}%`);
    setTxt("cpTrappedTxt", `⚠️ Compras en pérdida: ${rs.longs_in_loss || 0}% | Ventas en pérdida: ${rs.shorts_in_loss || 0}%`);
    setTxt("cpContrarianTag", (rs.long_pct || 50) > 55 ? "CONTRARIAN VENTA" : ((rs.short_pct || 50) > 55 ? "CONTRARIAN COMPRA" : "EQUILIBRIO"));

    const ob = d.order_book || {};
    setTxt("cpObRatio", `${ob.order_long_pct || 50}% C / ${ob.order_short_pct || 50}% V`);
    const bsl0 = ob.top_bsl && ob.top_bsl[0];
    const ssl0 = ob.top_ssl && ob.top_ssl[0];
    const dBox = inst.boxDecimals;
    setTxt("cpBslTarget", bsl0 ? `🎯 BSL: ${bsl0.price.toFixed(dBox)} (${bsl0.dist_pips}p)` : `🎯 BSL: ${Number(ob.bsl_target || 0).toFixed(dBox)}`);
    setTxt("cpSslTarget", ssl0 ? `🎯 SSL: ${ssl0.price.toFixed(dBox)} (${ssl0.dist_pips}p)` : `🎯 SSL: ${Number(ob.ssl_target || 0).toFixed(dBox)}`);

    const smc = d.technical_smc || {};
    setTxt("cpZoneTxt", `Zona SMC: ${smc.zone || "--"}`);
    if (smc.h1_low && smc.h1_high) {
      setTxt("cpH1EqTxt", `Rango H1: ${Number(smc.h1_low).toFixed(inst.digits)} - ${Number(smc.h1_high).toFixed(inst.digits)}`);
    }

    const paintTf = (id, name, val) => {
      const el = document.getElementById(id);
      if (!el) return;
      const bull = String(val || "ALCISTA").includes("ALCISTA") || String(val).includes("🟢");
      el.className = "cp-tf-badge " + (bull ? "bull" : "bear");
      el.textContent = `${name} ${bull ? "🟢" : "🔴"}`;
    };
    paintTf("cpTfH4", "H4", smc.trend_h4);
    paintTf("cpTfH1", "H1", smc.trend_h1);
    paintTf("cpTfM30", "M30", smc.trend_m30 || smc.trend_h1);
    paintTf("cpTfM15", "M15", smc.trend_m15);
    paintTf("cpTfM5", "M5", smc.trend_m5 || smc.trend_m15);
  }

  // --- GENERADOR DE RESPUESTA LOCAL INTELIGENTE PARA CUALQUIERA DE LOS 3 ACTIVOS ---
  function buildLocalSmartResponse(question, d) {
    const inst = getActiveInst();
    if (!d) return `Sincronizando el flujo institucional del libro de órdenes para ${inst.spokenName}.`;
    const q = (question || "").toLowerCase();
    const rs = d.retail_sentiment || {};
    const ob = d.order_book || {};
    const smc = d.technical_smc || {};
    const clean = s => String(s || "").replace(/[🟢🔴⚪]/g, "").trim();
    const dBox = inst.boxDecimals;

    const bullObs = (smcAnalysis.orderBlocks || []).filter(o => o.type === "BULL");
    const bearObs = (smcAnalysis.orderBlocks || []).filter(o => o.type === "BEAR");
    const obSummary = `En el gráfico de ${currentTf} de ${inst.spokenName} se observa ${bullObs.length ? 'un Order Block alcista de demanda entre ' + bullObs[bullObs.length - 1].bot.toFixed(dBox) + ' y ' + bullObs[bullObs.length - 1].top.toFixed(dBox) : 'demanda estructural en ' + Number(smcAnalysis.sslSwing || d.price).toFixed(dBox)}, y ${bearObs.length ? 'un Order Block bajista de oferta entre ' + bearObs[bearObs.length - 1].bot.toFixed(dBox) + ' y ' + bearObs[bearObs.length - 1].top.toFixed(dBox) : 'oferta en ' + Number(smcAnalysis.bslSwing || d.price).toFixed(dBox)}.`;

    const bslList = (ob.top_bsl || []).map(b => `${b.price.toFixed(dBox)} a ${b.dist_pips} pips`).join(", ");
    const sslList = (ob.top_ssl || []).map(b => `${b.price.toFixed(dBox)} a ${b.dist_pips} pips`).join(", ");

    if (q.includes("order block") || q.includes("ob") || q.includes("dibujad")) {
      return `Analizando los niveles institucionales dibujados en el gráfico de ${currentTf} para ${inst.spokenName}: ${obSummary} La liquidez estructural BSL se ubica en ${Number(smcAnalysis.bslSwing || ob.bsl_target).toFixed(dBox)} y la SSL abajo en ${Number(smcAnalysis.sslSwing || ob.ssl_target).toFixed(dBox)}, mientras las piscinas del libro de órdenes apuntan a ${bslList || ob.bsl_target} por arriba y ${sslList || ob.ssl_target} por abajo.`;
    }
    if (q.includes("libro") || q.includes("contrato")) {
      return `En el libro de posiciones institucional para ${inst.spokenName} se registra un ${rs.long_pct}% de contratos en compra frente a un ${rs.short_pct}% en venta, con un ${rs.longs_in_loss}% de compradores atrapados en pérdida. En el libro de órdenes pendientes hay ${ob.order_long_pct}% de órdenes compradoras y ${ob.order_short_pct}% vendedoras, con piscinas de Buy Stops en ${bslList || ob.bsl_target} y Sell Stops abajo en ${sslList || ob.ssl_target}.`;
    }
    if (q.includes("tendencia") || q.includes("h4") || q.includes("m5") || q.includes("temporal")) {
      return `El barrido multitemporal de ${inst.spokenName} desde H4 hasta M5 muestra la siguiente alineación: H4 ${clean(smc.trend_h4)}, H1 ${clean(smc.trend_h1)}, M30 ${clean(smc.trend_m30 || smc.trend_h1)}, M15 ${clean(smc.trend_m15)} y M5 ${clean(smc.trend_m5 || smc.trend_m15)}. Actualmente el precio de ${d.price.toFixed(inst.digits)} opera en zona ${clean(smc.zone)} con equilibrio del 50 por ciento en ${Number(smcAnalysis.eqMid || d.price).toFixed(dBox)}.`;
    }
    return `Informe situacional del Radar para ${inst.spokenName} cotizando en ${d.price.toFixed(inst.digits)}. El modelo cuantitativo marca ${d.bias_desc} con ${d.prob_buy}% de probabilidad de compra y ${d.prob_sell}% de venta en zona ${clean(smc.zone)}. ${obSummary} En el posicionamiento de contratos el ${rs.long_pct}% de participantes minoristas están comprados y los objetivos de liquidez apuntan a BSL en ${Number(ob.bsl_target || 0).toFixed(dBox)} y SSL en ${Number(ob.ssl_target || 0).toFixed(dBox)}.`;
  }

  // --- SELECCIÓN ESTRICTA DE VOZ FEMENINA EN ESPAÑOL ---
  function pickSpanishFemaleVoice() {
    if (!("speechSynthesis" in window)) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    const esVoices = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith("es"));
    if (!esVoices.length) return null;

    const malePatterns = /jorge|raul|raúl|pablo|alvaro|álvaro|diego|tomas|tomás|emilio|gerardo|lorenzo|andres|andrés|carlos|juan|miguel|pedro|male|hombre/i;
    const femalePriority = /dalia|sabina|helena|paulina|paloma|elvira|laura|lucia|lucía|monica|mónica|mia|mía|francisca|salome|salomé|camila|elena|sofia|sofía|valeria|catalina|belen|belén|female|mujer/i;

    const nonMale = esVoices.filter(v => !malePatterns.test(v.name));
    const naturalFemale = nonMale.find(v => femalePriority.test(v.name) && /natural|online|neural/i.test(v.name));
    if (naturalFemale) return naturalFemale;

    const explicitFemale = nonMale.find(v => femalePriority.test(v.name));
    if (explicitFemale) return explicitFemale;

    const googleEs = nonMale.find(v => /google/i.test(v.name));
    if (googleEs) return googleEs;

    return nonMale[0] || esVoices[0];
  }

  function speakWithBrowserTTS(rawText) {
    const text = sanitizeInstitutionalText(rawText);
    if (!("speechSynthesis" in window)) {
      setOrbState("idle");
      return;
    }
    window.speechSynthesis.cancel();

    function launchUtterance() {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "es-MX";
      utter.rate = 1.03;
      utter.pitch = 1.08;

      const femVoice = pickSpanishFemaleVoice();
      if (femVoice) utter.voice = femVoice;

      utter.onstart = () => setOrbState("speaking");
      utter.onend   = () => setOrbState("idle");
      utter.onerror = () => setOrbState("idle");
      window.speechSynthesis.speak(utter);
    }

    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        launchUtterance();
      };
      setTimeout(launchUtterance, 250);
    } else {
      launchUtterance();
    }
  }

  // Detectar si el usuario mencionó un activo específico en su pregunta ("oro", "xau", "aud", "australiano", "libra", "gbp")
  function detectMentionedAsset(questionText) {
    const q = String(questionText || "").toLowerCase();
    if (/\b(oro|xau|xauusd|gold)\b/.test(q)) return "XAU/USD";
    if (/\b(aud|audusd|australiano)\b/.test(q)) return "AUD/USD";
    if (/\b(gbp|gbpusd|libra)\b/.test(q)) return "GBP/USD";
    return null;
  }

  async function askCopilotAI(questionText) {
    // Si menciona otro activo en su pregunta, cambiar automáticamente a ese activo
    const mentioned = detectMentionedAsset(questionText);
    if (mentioned && mentioned !== currentAssetKey) {
      selectActiveAsset(mentioned, false);
    }

    const inst = getActiveInst();
    setOrbState("thinking");
    const uEl = document.getElementById("cpUserQ");
    const aEl = document.getElementById("cpAiA");
    if (uEl) uEl.textContent = `"${questionText}"`;
    if (aEl) aEl.textContent = `Analizando Order Blocks (OB), piscinas BSL/SSL, contratos y tendencias H4-M5 de ${inst.shortTitle}...`;

    let d = getAssetData(currentAssetKey);
    if (!d) {
      d = await refreshSingleAssetFlow(currentAssetKey) || {};
    }

    const rs = d.retail_sentiment || {};
    const ob = d.order_book || {};
    const smc = d.technical_smc || {};
    const dBox = inst.boxDecimals;
    const bslStr = (ob.top_bsl || []).map(b => `${b.price} (${b.dist_pips}p)`).join(", ");
    const sslStr = (ob.top_ssl || []).map(b => `${b.price} (${b.dist_pips}p)`).join(", ");
    const obDesc = (smcAnalysis.orderBlocks || []).map(o => `${o.type === 'BULL' ? 'OB+ Alcista' : 'OB- Bajista'} [${o.bot.toFixed(dBox)}-${o.top.toFixed(dBox)}]`).join(", ");

    // 1. Intentar servidor local (si está corriendo en la PC con voz femenina es-MX-DaliaNeural)
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      try {
        const localRes = await fetch("http://localhost:8765/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: `${questionText} (Activo: ${inst.title}, Order Blocks en gráfico ${currentTf}: ${obDesc})`,
            symbol: inst.mt5,
            voice: "es-MX-DaliaNeural"
          })
        });
        if (localRes.ok) {
          const lData = await localRes.json();
          if (lData.success && lData.text) {
            const cleanText = sanitizeInstitutionalText(lData.text);
            if (aEl) aEl.textContent = cleanText;
            if (lData.radar) {
              liveAssetsMap[currentAssetKey] = lData.radar;
              renderCopilotTelemetry(lData.radar);
            }
            if (lData.audio) {
              setOrbState("speaking");
              audioPlayer.src = "data:audio/mp3;base64," + lData.audio;
              audioPlayer.play();
              audioPlayer.onended = () => setOrbState("idle");
              return;
            }
          }
        }
      } catch (e) {}
    }

    // 2. Consultar Gemini Cloud API para el activo seleccionado (Sin nombres personales ni mención de OANDA)
    const prompt = `Eres la analista institucional senior de ${inst.title} (${inst.spokenName}) de la mesa cuantitativa.
DATOS EN TIEMPO REAL DEL FLUJO INSTITUCIONAL Y GRÁFICO SMC (${currentTf}) PARA ${inst.title}:
- Precio Actual: ${d.price} (Spread: ${d.spread_pips} pips)
- Order Blocks (OB) dibujados en el gráfico: ${obDesc || "En formación"}
- Liquidez Estructural del Gráfico: BSL=${smcAnalysis.bslSwing}, SSL=${smcAnalysis.sslSwing}, 50% Equilibrium=${smcAnalysis.eqMid}
- Sesgo Radar: ${d.bias_desc} (Probabilidad Compra: ${d.prob_buy}%, Venta: ${d.prob_sell}%)
- Contratos Compra/Venta (Libro de Posiciones): Compradores ${rs.long_pct}% vs Vendedores ${rs.short_pct}%. Compras en pérdida: ${rs.longs_in_loss}%, Ventas en pérdida: ${rs.shorts_in_loss}%.
- Libro de Órdenes: Órdenes Compra ${ob.order_long_pct}% vs Venta ${ob.order_short_pct}%. Piscinas BSL arriba: ${bslStr || ob.bsl_target}. Piscinas SSL abajo: ${sslStr || ob.ssl_target}.
- Tendencias H4 a M5: H4=${smc.trend_h4}, H1=${smc.trend_h1}, M30=${smc.trend_m30}, M15=${smc.trend_m15}, M5=${smc.trend_m5}. Zona SMC: ${smc.zone}.

PREGUNTA: "${questionText}"
REGLAS ESTRICTAS:
1. PROHIBIDO mencionar cualquier nombre de persona (no digas Gildardo) y PROHIBIDO mencionar la palabra OANDA. Refiérete siempre al "libro de órdenes institucional" o "flujo institucional".
2. Responde en español profesional sobre ${inst.spokenName} en máximo 3 oraciones fluidas para ser leídas por voz femenina, integrando los Order Blocks activos, las piscinas BSL/SSL, contratos y tendencias H4 a M5.
3. No uses asteriscos ni formato markdown.`;

    let answerText = null;
    for (const model of GEMINI_MODELS) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });
        if (res.ok) {
          const j = await res.json();
          const cand = j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts && j.candidates[0].content.parts[0];
          if (cand && cand.text) {
            answerText = sanitizeInstitutionalText(cand.text);
            break;
          }
        }
      } catch (e) {}
    }

    if (!answerText) {
      answerText = sanitizeInstitutionalText(buildLocalSmartResponse(questionText, d));
    }

    if (aEl) aEl.textContent = answerText;
    speakWithBrowserTTS(answerText);
  }

  function buildQuickQuestion(code) {
    const inst = getActiveInst();
    if (code === "REPORT") return `Dame el informe situacional completo del Radar para ${inst.shortTitle} con Order Blocks y liquidez.`;
    if (code === "OB_LIQ") return `Analiza los Order Blocks activos y las piscinas BSL y SSL dibujadas en el gráfico de ${inst.shortTitle}.`;
    if (code === "CONTRACTS") return `Analiza el libro de órdenes y el número de contratos de compra y venta para ${inst.shortTitle}.`;
    if (code === "TRENDS") return `Analiza la alineación de tendencia desde H4 hasta M5 en ${inst.shortTitle}.`;
    if (code === "SETUP") return `¿Recomiendas comprar o vender ${inst.shortTitle} ahora mismo según los Order Blocks y el flujo institucional?`;
    return code;
  }

  function bindCopilotEvents() {
    // 1. Selector de Activo en el Copilot (GBP/USD, XAU/USD, AUD/USD)
    document.querySelectorAll("[data-cp-asset]").forEach(btn => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-cp-asset");
        selectActiveAsset(target, false);
      });
    });

    // 2. Sincronizar con los botones de filtro del Radar ([data-radar-filter])
    document.querySelectorAll("[data-radar-filter]").forEach(btn => {
      btn.addEventListener("click", () => {
        const fVal = btn.getAttribute("data-radar-filter");
        if (fVal && (fVal.includes("GBP") || fVal.includes("XAU") || fVal.includes("AUD"))) {
          selectActiveAsset(fVal, false);
        }
      });
    });

    // 3. Sincronizar al hacer clic sobre cualquier tarjeta del Radar (.radar-card o .strip-card)
    document.addEventListener("click", e => {
      const card = e.target.closest(".radar-card, .strip-card");
      if (!card) return;
      const txt = card.textContent || "";
      if (txt.includes("XAU/USD") || txt.includes("Oro")) {
        selectActiveAsset("XAU/USD", false);
      } else if (txt.includes("AUD/USD") || txt.includes("Australiano")) {
        selectActiveAsset("AUD/USD", false);
      } else if (txt.includes("GBP/USD") || txt.includes("Libra")) {
        selectActiveAsset("GBP/USD", false);
      }
    });

    // 4. Botones de Temporalidad del Gráfico SMC
    document.querySelectorAll("[data-cp-tf]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-cp-tf]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentTf = btn.getAttribute("data-cp-tf");
        loadChartCandles(currentTf, false);
      });
    });

    // 5. Interruptores de Capas SMC
    const bindToggle = (id, getter, setter) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener("click", () => {
        setter(!getter());
        btn.classList.toggle("active", getter());
        if (id === "btnToggleEMA") loadChartCandles(currentTf, true);
        else requestAnimationFrame(drawSmcOverlay);
      });
    };
    bindToggle("btnToggleOB",  () => showOB,  v => { showOB = v; });
    bindToggle("btnToggleLiq", () => showLiq, v => { showLiq = v; });
    bindToggle("btnToggleEQ",  () => showEQ,  v => { showEQ = v; });
    bindToggle("btnToggleEMA", () => showEMA, v => { showEMA = v; });

    // 6. Botones rápidos de voz (dinámicos para el activo seleccionado)
    document.querySelectorAll("[data-cp-q]").forEach(btn => {
      btn.addEventListener("click", () => {
        const qCode = btn.getAttribute("data-cp-q");
        askCopilotAI(buildQuickQuestion(qCode));
      });
    });

    // 7. Input de texto
    const inp = document.getElementById("cpTextInput");
    const btnSend = document.getElementById("cpBtnSend");
    if (btnSend && inp) {
      btnSend.addEventListener("click", () => {
        if (inp.value.trim()) {
          askCopilotAI(inp.value.trim());
          inp.value = "";
        }
      });
      inp.addEventListener("keydown", e => {
        if (e.key === "Enter" && inp.value.trim()) {
          askCopilotAI(inp.value.trim());
          inp.value = "";
        }
      });
    }

    // 8. Narradora automática cada 2 min
    const btnAuto = document.getElementById("cpBtnAuto");
    if (btnAuto) {
      btnAuto.addEventListener("click", () => {
        if (autoTimer) {
          clearInterval(autoTimer);
          autoTimer = null;
          btnAuto.textContent = "⏱️ Narradora Auto: OFF";
          btnAuto.style.background = "rgba(255,255,255,0.04)";
        } else {
          btnAuto.textContent = "⏱️ Narradora Auto: CADA 2 MIN";
          btnAuto.style.background = "rgba(0,255,136,0.15)";
          askCopilotAI(buildQuickQuestion("REPORT"));
          autoTimer = setInterval(() => {
            if (orbState === "idle") {
              askCopilotAI(buildQuickQuestion("REPORT"));
            }
          }, 120000);
        }
      });
    }

    // 9. Micrófono
    const btnMic = document.getElementById("cpBtnMic");
    const micLbl = document.getElementById("cpMicLabel");
    const uEl = document.getElementById("cpUserQ");

    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognition = new SR();
      recognition.lang = "es-MX";
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        isListening = true;
        setOrbState("listening");
        if (btnMic) btnMic.classList.add("recording");
        if (micLbl) micLbl.textContent = "Escuchando... (Habla ahora)";
      };

      recognition.onresult = e => {
        let t = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          t += e.results[i][0].transcript;
        }
        if (uEl) uEl.textContent = `"${t}"`;
      };

      recognition.onend = () => {
        isListening = false;
        if (btnMic) btnMic.classList.remove("recording");
        if (micLbl) micLbl.textContent = "Hablar con la IA (Voz en Vivo)";
        const finalQ = uEl ? uEl.textContent.replace(/"/g, "").trim() : "";
        if (finalQ.length > 2) {
          askCopilotAI(finalQ);
        } else {
          setOrbState("idle");
        }
      };

      recognition.onerror = () => {
        isListening = false;
        if (btnMic) btnMic.classList.remove("recording");
        if (micLbl) micLbl.textContent = "Hablar con la IA (Voz en Vivo)";
        setOrbState("idle");
      };
    }

    if (btnMic) {
      btnMic.addEventListener("click", () => {
        if (!recognition) {
          if (inp) inp.focus();
          return;
        }
        if (isListening) recognition.stop();
        else {
          if (uEl) uEl.textContent = "";
          recognition.start();
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountCopilot);
  } else {
    mountCopilot();
  }
})();
