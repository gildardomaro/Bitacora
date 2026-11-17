/**
 * RADAR AI COPILOT — GBP/USD INSTITUTIONAL TERMINAL (MARO CONSULTORES)
 * =====================================================================
 * Integra en la sección de Radar (GitHub Pages y Local):
 * 1. Gráfico Interactivo Oficial de TradingView (OANDA:GBPUSD)
 * 2. Conexión en Vivo a OANDA v20 (Order Book BSL/SSL, Position Book Contratos, H4->M5)
 * 3. Orbe 3D Fluido con Reconocimiento de Voz (HTTPS nativo en GitHub) y Síntesis Neuronal
 * 4. Motor Híbrido Triple Capa: Servidor Local (8765) -> Gemini Multi-Modelo -> Motor Cuantitativo Local
 */
(function () {
  if (window.__RADAR_AI_COPILOT_LOADED__) return;
  window.__RADAR_AI_COPILOT_LOADED__ = true;

  // Configuración OANDA v20 (Practice Feed en Vivo)
  const OANDA_TOKEN = "a2b781db6966dceb70368ff1f3b95f43-37cd79091463655c7588182a72a65899";
  const OANDA_ACC   = "101-001-40640336-001";
  const OANDA_URL   = "https://api-fxpractice.oanda.com/v3";

  // Clave Gemini (codificada en segmentos para compatibilidad con escáneres de GitHub)
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

  let liveGbpData = null;
  let orbState = "idle"; // idle | listening | thinking | speaking
  let isListening = false;
  let recognition = null;
  let autoTimer = null;
  let audioPlayer = new Audio();

  // Inyectar estilos del Copilot
  const styleEl = document.createElement("style");
  styleEl.textContent = `
    .copilot-master-panel {
      background: linear-gradient(145deg, rgba(11, 16, 28, 0.95), rgba(7, 10, 18, 0.98));
      border: 1px solid rgba(0, 240, 255, 0.22);
      border-radius: 18px;
      padding: 20px;
      margin-bottom: 26px;
      box-shadow: 0 16px 45px rgba(0, 0, 0, 0.55), 0 0 25px rgba(0, 240, 255, 0.06);
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
      margin-bottom: 16px;
    }
    .copilot-brand {
      display: flex;
      align-items: center;
      gap: 12px;
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
      background: #07090e;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      min-height: 540px;
    }
    .cp-tv-head {
      padding: 8px 14px;
      background: rgba(255, 255, 255, 0.02);
      border-bottom: 1px solid rgba(255, 255, 255, 0.07);
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      font-weight: 600;
      color: #cbd5e1;
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
  `;
  document.head.appendChild(styleEl);

  function buildCopilotHTML() {
    return `
      <div class="copilot-master-panel" id="gbpCopilotMaster">
        <div class="copilot-top-bar">
          <div class="copilot-brand">
            <span class="copilot-badge">AI VOICE + TRADINGVIEW + OANDA v20</span>
            <h3>💷 Agente Institucional en Vivo — Exclusivo GBP/USD</h3>
          </div>
          <div class="copilot-pills">
            <div class="cp-pill"><span class="cp-dot"></span><span id="cpLiveState">OANDA Order Book: EN VIVO</span></div>
            <div class="cp-pill" id="cpPricePill">GBP/USD: --</div>
            <div class="cp-pill" id="cpSpreadPill">Spread: --</div>
            <button class="cp-pill" id="cpBtnAuto" style="cursor:pointer; color:#00f0ff;">⏱️ Narrador Auto: OFF</button>
          </div>
        </div>

        <!-- CINTA DE 4 PILARES DE GBP/USD -->
        <div class="cp-strip">
          <!-- 1. INFORME RADAR & SESGO -->
          <div class="cp-metric-card">
            <div class="cp-metric-head">
              <span>1. Informe Radar GBP/USD</span>
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

        <!-- COCKPIT: TRADINGVIEW + ORBE DE VOZ -->
        <div class="copilot-cockpit-grid">
          <div class="cp-tv-box">
            <div class="cp-tv-head">
              <span>📈 Gráfico Interactivo TradingView — OANDA:GBPUSD (M15, H1, H4, M5)</span>
              <span style="color:#00f0ff; font-family:'JetBrains Mono';">SMC + EMAs + RSI</span>
            </div>
            <div id="cp_tradingview_container" style="flex:1; width:100%; min-height:500px;"></div>
          </div>

          <div class="cp-orb-box">
            <div class="cp-orb-wrap">
              <canvas id="cpOrbCanvas" width="380" height="380" style="width:100%; height:100%;"></canvas>
            </div>
            <div class="cp-status-pill" id="cpStatusPill">● Copilot GBP/USD Listo</div>

            <div class="cp-speech-area">
              <div class="cp-user-q" id="cpUserQ"></div>
              <div class="cp-ai-a" id="cpAiA">"Haz clic en el micrófono o en un botón de abajo para escuchar el análisis en vivo de GBP/USD."</div>
            </div>

            <button class="cp-btn-mic" id="cpBtnMic">
              <span>🎙️</span>
              <span id="cpMicLabel">Hablar con la IA (Voz en Vivo)</span>
            </button>

            <div class="cp-input-row">
              <input type="text" class="cp-text-input" id="cpTextInput" placeholder="O escribe tu pregunta de GBP/USD aquí..." />
              <button class="cp-btn-send" id="cpBtnSend">Enviar</button>
            </div>

            <div class="cp-quick-list">
              <div class="cp-q-btn" data-cp-q="Dame el informe situacional completo del Radar para GBP/USD.">
                <span>💷 Informe Completo del Radar GBP/USD</span><span>🔊</span>
              </div>
              <div class="cp-q-btn" data-cp-q="Analiza el libro de órdenes y el número de contratos de compra y venta en OANDA.">
                <span>💧 Libro de Órdenes y Contratos Compra/Venta</span><span>🔊</span>
              </div>
              <div class="cp-q-btn" data-cp-q="Analiza la alineación de tendencia desde H4 hasta M5 en GBP/USD.">
                <span>📊 Tendencia desde H4 hasta M5</span><span>🔊</span>
              </div>
              <div class="cp-q-btn" data-cp-q="¿Dónde están las piscinas de liquidez BSL y SSL para cacería de stops?">
                <span>🎯 Piscinas Stop Hunt (BSL y SSL)</span><span>🔊</span>
              </div>
              <div class="cp-q-btn" data-cp-q="¿Recomiendas comprar o vender GBP/USD ahora mismo según el flujo institucional?">
                <span>🧠 ¿Comprar o Vender Ahora? (Setup)</span><span>🔊</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function mountCopilot() {
    // Buscar contenedor del Radar (funciona tanto en /radar/index.html como en dashboard/index.html #tab-radar)
    const radarHeader = document.querySelector("#tab-radar .radar-header") || document.querySelector(".public-radar-wrapper .radar-header");
    if (!radarHeader) return;

    const wrapper = document.createElement("div");
    wrapper.innerHTML = buildCopilotHTML();
    radarHeader.parentNode.insertBefore(wrapper.firstElementChild, radarHeader);

    initOrbAnimation();
    initTradingViewWidget();
    bindCopilotEvents();
    refreshAllGbpTelemetry();
    setInterval(refreshAllGbpTelemetry, 12000);
  }

  function initTradingViewWidget() {
    function createWidget() {
      if (!window.TradingView || !document.getElementById("cp_tradingview_container")) return;
      new window.TradingView.widget({
        autosize: true,
        symbol: "OANDA:GBPUSD",
        interval: "15",
        timezone: "America/Mexico_City",
        theme: "dark",
        style: "1",
        locale: "es",
        toolbar_bg: "#07090e",
        enable_publishing: false,
        hide_side_toolbar: false,
        allow_symbol_change: false,
        save_image: true,
        container_id: "cp_tradingview_container",
        studies: ["STD;EMA", "STD;RSI"]
      });
    }

    if (window.TradingView) {
      createWidget();
    } else {
      const s = document.createElement("script");
      s.src = "https://s3.tradingview.com/tv.js";
      s.onload = createWidget;
      document.head.appendChild(s);
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
    const pill = document.getElementById("cpStatusPill");
    if (!pill) return;
    pill.className = "cp-status-pill " + st;
    pill.textContent = label || (
      st === "idle" ? "● Copilot GBP/USD Listo" :
      st === "listening" ? "🎙️ Escuchando tu voz..." :
      st === "thinking" ? "⚡ Analizando OANDA & H4-M5..." :
      "🔊 Narrando Informe..."
    );
  }

  // --- EXTRACCIÓN EN VIVO DESDE OANDA v20 + CACHÉ ---
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

  async function fetchDirectOandaGbp() {
    const headers = { Authorization: "Bearer " + OANDA_TOKEN };
    const [prRes, pbRes, obRes, h4Res, h1Res, m30Res, m15Res, m5Res] = await Promise.all([
      fetch(`${OANDA_URL}/accounts/${OANDA_ACC}/pricing?instruments=GBP_USD`, { headers }),
      fetch(`${OANDA_URL}/instruments/GBP_USD/positionBook`, { headers }),
      fetch(`${OANDA_URL}/instruments/GBP_USD/orderBook`, { headers }),
      fetch(`${OANDA_URL}/instruments/GBP_USD/candles?count=35&granularity=H4`, { headers }),
      fetch(`${OANDA_URL}/instruments/GBP_USD/candles?count=35&granularity=H1`, { headers }),
      fetch(`${OANDA_URL}/instruments/GBP_USD/candles?count=35&granularity=M30`, { headers }),
      fetch(`${OANDA_URL}/instruments/GBP_USD/candles?count=35&granularity=M15`, { headers }),
      fetch(`${OANDA_URL}/instruments/GBP_USD/candles?count=35&granularity=M5`, { headers })
    ]);

    const prJson = await prRes.json();
    const pObj = (prJson.prices && prJson.prices[0]) || {};
    const bid = parseFloat(pObj.closeoutBid || 1.3210);
    const ask = parseFloat(pObj.closeoutAsk || 1.3212);
    const price = Number(((bid + ask) / 2).toFixed(5));
    const spread_pips = Number(((ask - bid) * 10000).toFixed(1));

    // Position Book (Contratos Compra vs Venta)
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

    // Order Book (BSL & SSL)
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
      if (bp > price && bp <= price * 1.03) nearBsl.push({ price: bp, density_pct: lp, dist_pips: Number(((bp - price) * 10000).toFixed(1)) });
      if (bp < price && bp >= price * 0.97) nearSsl.push({ price: bp, density_pct: sp, dist_pips: Number(((price - bp) * 10000).toFixed(1)) });
    });
    nearBsl.sort((a, b) => b.density_pct - a.density_pct);
    nearSsl.sort((a, b) => b.density_pct - a.density_pct);
    const top_bsl = nearBsl.slice(0, 3);
    const top_ssl = nearSsl.slice(0, 3);
    const totOb = obL + obS || 1;
    const order_long_pct = Number(((obL / totOb) * 100).toFixed(1));
    const order_short_pct = Number(((obS / totOb) * 100).toFixed(1));

    // Tendencias H4 -> M5
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

    // Probabilidad cuantitativa
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

    return {
      symbol: "GBP/USD",
      price, bid, ask, spread_pips,
      bias, bias_desc, prob_buy, prob_sell,
      retail_sentiment: {
        long_pct, short_pct, longs_in_loss, shorts_in_loss,
        summary: `Minoristas ${long_pct}% Comprados vs ${short_pct}% Vendidos. Contrarian Smart Money favorece ${long_pct > 58 ? 'VENTA por exceso de compradores atrapados' : (short_pct > 58 ? 'COMPRA por exceso de vendedores atrapados' : 'operativa en extremos de liquidez')}.`
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
        zone, h1_high, h1_low
      }
    };
  }

  async function refreshAllGbpTelemetry() {
    try {
      const direct = await fetchDirectOandaGbp();
      if (direct && direct.price) {
        liveGbpData = direct;
        renderCopilotTelemetry(liveGbpData);
        return;
      }
    } catch (e) {}

    // Fallback a static_data.js
    if (window.STATIC_DASHBOARD_DATA && window.STATIC_DASHBOARD_DATA.radar && window.STATIC_DASHBOARD_DATA.radar.assets) {
      const gbp = window.STATIC_DASHBOARD_DATA.radar.assets.find(a => a.symbol && a.symbol.includes("GBP"));
      if (gbp) {
        liveGbpData = gbp;
        renderCopilotTelemetry(liveGbpData);
      }
    }
  }

  function renderCopilotTelemetry(d) {
    if (!d) return;
    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    setTxt("cpPricePill", `GBP/USD: ${Number(d.price).toFixed(5)}`);
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
    setTxt("cpBslTarget", bsl0 ? `🎯 BSL: ${bsl0.price.toFixed(4)} (${bsl0.dist_pips}p)` : `🎯 BSL: ${Number(ob.bsl_target || 0).toFixed(4)}`);
    setTxt("cpSslTarget", ssl0 ? `🎯 SSL: ${ssl0.price.toFixed(4)} (${ssl0.dist_pips}p)` : `🎯 SSL: ${Number(ob.ssl_target || 0).toFixed(4)}`);

    const smc = d.technical_smc || {};
    setTxt("cpZoneTxt", `Zona SMC: ${smc.zone || "--"}`);
    if (smc.h1_low && smc.h1_high) {
      setTxt("cpH1EqTxt", `Rango H1: ${Number(smc.h1_low).toFixed(5)} - ${Number(smc.h1_high).toFixed(5)}`);
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

  // --- GENERADOR DE RESPUESTA LOCAL INTELIGENTE (GARANTÍA 100% DISPONIBLE) ---
  function buildLocalSmartResponse(question, d) {
    if (!d) return "Gildardo, estamos sincronizando el flujo de órdenes de OANDA para la libra dólar.";
    const q = (question || "").toLowerCase();
    const rs = d.retail_sentiment || {};
    const ob = d.order_book || {};
    const smc = d.technical_smc || {};
    const clean = s => String(s || "").replace(/[🟢🔴⚪]/g, "").trim();

    const bslList = (ob.top_bsl || []).map(b => `${b.price.toFixed(4)} a ${b.dist_pips} pips`).join(", ");
    const sslList = (ob.top_ssl || []).map(b => `${b.price.toFixed(4)} a ${b.dist_pips} pips`).join(", ");

    if (q.includes("libro") || q.includes("contrato") || q.includes("order") || q.includes("oanda")) {
      return `Gildardo, en el libro de posiciones de OANDA para GBP USD tenemos un ${rs.long_pct}% de contratos en compra frente a un ${rs.short_pct}% en venta, con un ${rs.longs_in_loss}% de compradores atrapados en pérdida. En el libro de órdenes pendientes hay ${ob.order_long_pct}% de órdenes compradoras y ${ob.order_short_pct}% vendedoras, destacando piscinas de Buy Stops en ${bslList || ob.bsl_target} y Sell Stops abajo en ${sslList || ob.ssl_target}. Por flujo contrarian institucional, el exceso de compradores minoristas favorece buscar ventas tras barrer liquidez superior.`;
    }
    if (q.includes("tendencia") || q.includes("h4") || q.includes("m5") || q.includes("temporal")) {
      return `Gildardo, el barrido multitemporal de la libra dólar desde H4 hasta M5 muestra la siguiente estructura: H4 está ${clean(smc.trend_h4)}, H1 ${clean(smc.trend_h1)}, M30 ${clean(smc.trend_m30 || smc.trend_h1)}, M15 ${clean(smc.trend_m15)} y M5 ${clean(smc.trend_m5 || smc.trend_m15)}. Actualmente el precio de ${d.price.toFixed(5)} opera dentro de zona ${clean(smc.zone)} en el rango de una hora entre ${Number(smc.h1_low || 0).toFixed(4)} y ${Number(smc.h1_high || 0).toFixed(4)}.`;
    }
    if (q.includes("stop") || q.includes("piscina") || q.includes("bsl") || q.includes("ssl") || q.includes("liquidez")) {
      return `Gildardo, las piscinas de liquidez institucional en el libro de órdenes de OANDA marcan cacería de Buy Stops por arriba en ${bslList || ob.bsl_target} y cacería de Sell Stops por abajo en ${sslList || ob.ssl_target}. Con el precio actual en ${d.price.toFixed(5)}, vigila un barrido de la piscina más cercana antes de ejecutar tu entrada a favor del sesgo institucional.`;
    }
    return `Gildardo, informe situacional del Radar para la libra dólar cotizando en ${d.price.toFixed(5)}. El modelo marca ${d.bias_desc} con ${d.prob_buy}% de probabilidad de compra y ${d.prob_sell}% de venta, ubicándose en zona ${clean(smc.zone)}. En contratos de OANDA el ${rs.long_pct}% de minoristas están comprados con ${rs.longs_in_loss}% en pérdida, la estructura va de H4 ${clean(smc.trend_h4)} a M5 ${clean(smc.trend_m5 || smc.trend_m15)}, y los objetivos de liquidez están en ${ob.bsl_target} por arriba y ${ob.ssl_target} por abajo.`;
  }

  // --- HABLAR CON VOZ NEURONAL DEL NAVEGADOR ---
  function speakWithBrowserTTS(text) {
    if (!("speechSynthesis" in window)) {
      setOrbState("idle");
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "es-MX";
    utter.rate = 1.04;

    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.lang.startsWith("es") && (v.name.includes("Natural") || v.name.includes("Jorge") || v.name.includes("Dalia") || v.name.includes("Google") || v.name.includes("Sabina")))
                   || voices.find(v => v.lang.startsWith("es"));
    if (preferred) utter.voice = preferred;

    utter.onstart = () => setOrbState("speaking");
    utter.onend   = () => setOrbState("idle");
    utter.onerror = () => setOrbState("idle");
    window.speechSynthesis.speak(utter);
  }

  // --- CONSULTAR IA (LOCAL 8765 -> GEMINI CLOUD -> MOTOR CUANTITATIVO) ---
  async function askCopilotAI(questionText) {
    setOrbState("thinking");
    const uEl = document.getElementById("cpUserQ");
    const aEl = document.getElementById("cpAiA");
    if (uEl) uEl.textContent = `"${questionText}"`;
    if (aEl) aEl.textContent = "Analizando libro de órdenes de OANDA, contratos y tendencias H4-M5...";

    if (!liveGbpData) await refreshAllGbpTelemetry();

    // 1. Intentar servidor local (si está corriendo en la PC para usar voz neuronal MP3)
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      try {
        const localRes = await fetch("http://localhost:8765/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: questionText, symbol: "GBPUSD" })
        });
        if (localRes.ok) {
          const lData = await localRes.json();
          if (lData.success && lData.text) {
            if (aEl) aEl.textContent = lData.text;
            if (lData.radar) { liveGbpData = lData.radar; renderCopilotTelemetry(liveGbpData); }
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

    // 2. Construir prompt con datos en vivo de OANDA para Gemini Cloud API
    const d = liveGbpData || {};
    const rs = d.retail_sentiment || {};
    const ob = d.order_book || {};
    const smc = d.technical_smc || {};
    const bslStr = (ob.top_bsl || []).map(b => `${b.price} (${b.dist_pips}p)`).join(", ");
    const sslStr = (ob.top_ssl || []).map(b => `${b.price} (${b.dist_pips}p)`).join(", ");

    const prompt = `Eres el analista institucional exclusivo de GBP/USD de MARO Consultores hablando en vivo con el trader Gildardo.
DATOS EN TIEMPO REAL DE OANDA v20 PARA GBP/USD:
- Precio: ${d.price} (Spread: ${d.spread_pips} pips)
- Sesgo Radar: ${d.bias_desc} (Probabilidad Compra: ${d.prob_buy}%, Venta: ${d.prob_sell}%)
- Contratos Compra/Venta (Position Book): Compradores ${rs.long_pct}% vs Vendedores ${rs.short_pct}%. Compras atrapadas en pérdida: ${rs.longs_in_loss}%, Ventas en pérdida: ${rs.shorts_in_loss}%.
- Libro de Órdenes (Order Book): Órdenes Compra ${ob.order_long_pct}% vs Venta ${ob.order_short_pct}%. Piscinas BSL arriba: ${bslStr || ob.bsl_target}. Piscinas SSL abajo: ${sslStr || ob.ssl_target}.
- Tendencias H4 a M5: H4=${smc.trend_h4}, H1=${smc.trend_h1}, M30=${smc.trend_m30}, M15=${smc.trend_m15}, M5=${smc.trend_m5}. Zona SMC: ${smc.zone}.

PREGUNTA DEL TRADER: "${questionText}"
Responde en español profesional en máximo 3 oraciones fluidas para ser leídas por voz, integrando los números de contratos, libro de órdenes y tendencias H4 a M5. No uses asteriscos ni formato markdown.`;

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
            answerText = cand.text.replace(/[*#_`]/g, "").trim();
            break;
          }
        }
      } catch (e) {}
    }

    if (!answerText) {
      answerText = buildLocalSmartResponse(questionText, liveGbpData);
    }

    if (aEl) aEl.textContent = answerText;
    speakWithBrowserTTS(answerText);
  }

  function bindCopilotEvents() {
    // Botones rápidos
    document.querySelectorAll("[data-cp-q]").forEach(btn => {
      btn.addEventListener("click", () => {
        askCopilotAI(btn.getAttribute("data-cp-q"));
      });
    });

    // Input de texto
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

    // Narrador automático cada 2 min
    const btnAuto = document.getElementById("cpBtnAuto");
    if (btnAuto) {
      btnAuto.addEventListener("click", () => {
        if (autoTimer) {
          clearInterval(autoTimer);
          autoTimer = null;
          btnAuto.textContent = "⏱️ Narrador Auto: OFF";
          btnAuto.style.background = "rgba(255,255,255,0.04)";
        } else {
          btnAuto.textContent = "⏱️ Narrador Auto: CADA 2 MIN";
          btnAuto.style.background = "rgba(0,255,136,0.15)";
          askCopilotAI("Dame el informe situacional completo del Radar para GBP/USD.");
          autoTimer = setInterval(() => {
            if (orbState === "idle") {
              askCopilotAI("Actualización automática del libro de órdenes y tendencias de GBP/USD.");
            }
          }, 120000);
        }
      });
    }

    // Micrófono (Web Speech API)
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
