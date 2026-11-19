/**
 * Vercel Serverless Proxy — OANDA v20 Institutional Flow & Candles
 * Mantiene OANDA_API_TOKEN y OANDA_ACCOUNT_ID exclusivamente en el servidor.
 *
 * Endpoints:
 *   GET /api/oanda?action=flow&instrument=GBP_USD
 *   GET /api/oanda?action=candles&instrument=GBP_USD&tf=M15&count=110
 */

const INSTRUMENTS = {
  GBP_USD: {
    key: "GBP/USD",
    raw: "GBP_USD",
    name: "GBP/USD (Libra / Dólar)",
    display: "GBP/USD",
    icon: "💷",
    digits: 5,
    pipMult: 10000
  },
  XAU_USD: {
    key: "XAU/USD",
    raw: "XAU_USD",
    name: "XAU/USD (Oro / Dólar)",
    display: "XAU/USD (Oro)",
    icon: "🥇",
    digits: 2,
    pipMult: 100
  },
  AUD_USD: {
    key: "AUD/USD",
    raw: "AUD_USD",
    name: "AUD/USD (Dólar Australiano)",
    display: "AUD/USD",
    icon: "🦘",
    digits: 5,
    pipMult: 10000
  }
};

const ALLOWED_TFS = new Set(["H4", "H1", "M30", "M15", "M5"]);
const FLOW_CANDLE_COUNT = 95; // Unificado con oanda_market_radar.py (95 velas por TF)

function analyzeCandlesTrend(candles) {
  if (!candles || !candles.length) {
    return { trend: "NEUTRAL ⚪", is_bull: true, ema: 0, high: 0, low: 0 };
  }
  const closes = [];
  const highs = [];
  const lows = [];
  for (const c of candles) {
    if (c && c.mid && c.mid.c !== undefined) {
      closes.push(parseFloat(c.mid.c));
      highs.push(parseFloat(c.mid.h));
      lows.push(parseFloat(c.mid.l));
    }
  }
  if (!closes.length) {
    return { trend: "NEUTRAL ⚪", is_bull: true, ema: 0, high: 0, low: 0 };
  }

  const period = Math.min(20, closes.length);
  const k = 2.0 / (period + 1);
  let ema = closes[0];
  for (let i = 1; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }

  const lastClose = closes[closes.length - 1];
  const isBull = lastClose >= ema;
  return {
    trend: isBull ? "ALCISTA 🟢" : "BAJISTA 🔴",
    is_bull: isBull,
    ema: Number(ema.toFixed(5)),
    high: Math.max(...highs),
    low: Math.min(...lows),
    last_close: lastClose
  };
}

function parseOhlc(candles, digits) {
  const out = [];
  for (const c of candles || []) {
    if (c && c.mid && c.time) {
      const ts = Math.floor(new Date(c.time).getTime() / 1000);
      if (!Number.isNaN(ts)) {
        out.push({
          time: ts,
          open: Number(parseFloat(c.mid.o).toFixed(digits)),
          high: Number(parseFloat(c.mid.h).toFixed(digits)),
          low: Number(parseFloat(c.mid.l).toFixed(digits)),
          close: Number(parseFloat(c.mid.c).toFixed(digits))
        });
      }
    }
  }
  return out;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = process.env.OANDA_API_TOKEN;
  const accountId = process.env.OANDA_ACCOUNT_ID;
  const baseUrl = process.env.OANDA_BASE_URL || "https://api-fxpractice.oanda.com/v3";

  if (!token || !accountId) {
    return res.status(503).json({
      error: "OANDA proxy not configured",
      hint: "Configure OANDA_API_TOKEN and OANDA_ACCOUNT_ID in environment variables."
    });
  }

  const action = String((req.query && req.query.action) || "flow").toLowerCase();
  const rawSymbol = String((req.query && req.query.instrument) || "GBP_USD").toUpperCase().replace("/", "_");
  const inst = INSTRUMENTS[rawSymbol];

  if (!inst) {
    return res.status(400).json({ error: "Unsupported instrument" });
  }

  const headers = { Authorization: `Bearer ${token}` };

  try {
    if (action === "candles") {
      const tf = String((req.query && req.query.tf) || "M15").toUpperCase();
      if (!ALLOWED_TFS.has(tf)) {
        return res.status(400).json({ error: "Unsupported timeframe" });
      }
      const count = Math.min(200, Math.max(20, parseInt((req.query && req.query.count) || "110", 10) || 110));
      const r = await fetch(`${baseUrl}/instruments/${inst.raw}/candles?count=${count}&granularity=${tf}`, { headers });
      if (!r.ok) {
        return res.status(r.status).json({ error: "Upstream candle fetch failed" });
      }
      const j = await r.json();
      return res.status(200).json({
        success: true,
        symbol: inst.key,
        tf,
        candles: parseOhlc(j.candles, inst.digits)
      });
    }

    // action === "flow": consulta completa unificada (95 velas por TF)
    const [prRes, pbRes, obRes, h4Res, h1Res, m30Res, m15Res, m5Res] = await Promise.all([
      fetch(`${baseUrl}/accounts/${accountId}/pricing?instruments=${inst.raw}`, { headers }),
      fetch(`${baseUrl}/instruments/${inst.raw}/positionBook`, { headers }),
      fetch(`${baseUrl}/instruments/${inst.raw}/orderBook`, { headers }),
      fetch(`${baseUrl}/instruments/${inst.raw}/candles?count=${FLOW_CANDLE_COUNT}&granularity=H4`, { headers }),
      fetch(`${baseUrl}/instruments/${inst.raw}/candles?count=${FLOW_CANDLE_COUNT}&granularity=H1`, { headers }),
      fetch(`${baseUrl}/instruments/${inst.raw}/candles?count=${FLOW_CANDLE_COUNT}&granularity=M30`, { headers }),
      fetch(`${baseUrl}/instruments/${inst.raw}/candles?count=${FLOW_CANDLE_COUNT}&granularity=M15`, { headers }),
      fetch(`${baseUrl}/instruments/${inst.raw}/candles?count=${FLOW_CANDLE_COUNT}&granularity=M5`, { headers })
    ]);

    const prJson = prRes.ok ? await prRes.json() : {};
    const pObj = (prJson.prices && prJson.prices[0]) || {};
    const bid = parseFloat(pObj.closeoutBid || 0);
    const ask = parseFloat(pObj.closeoutAsk || 0);
    let price = bid && ask ? Number(((bid + ask) / 2).toFixed(inst.digits)) : 0;
    const spread_pips = bid && ask ? Number(((ask - bid) * inst.pipMult).toFixed(1)) : 0;

    const pbJson = pbRes.ok ? ((await pbRes.json()).positionBook || {}) : {};
    if (!price && pbJson.price) price = parseFloat(pbJson.price);
    const pbBuckets = pbJson.buckets || [];
    let tLong = 0, tShort = 0, lLoss = 0, sLoss = 0;
    for (const b of pbBuckets) {
      const lp = parseFloat(b.longCountPercent || 0);
      const sp = parseFloat(b.shortCountPercent || 0);
      const bp = parseFloat(b.price || 0);
      tLong += lp;
      tShort += sp;
      if (bp > price) lLoss += lp;
      if (bp < price) sLoss += sp;
    }
    const totPos = tLong + tShort;
    const long_pct = totPos > 0 ? Number(((tLong / totPos) * 100).toFixed(1)) : 50.0;
    const short_pct = totPos > 0 ? Number(((tShort / totPos) * 100).toFixed(1)) : 50.0;
    const longs_in_loss = Number(lLoss.toFixed(1));
    const shorts_in_loss = Number(sLoss.toFixed(1));

    const obJson = obRes.ok ? ((await obRes.json()).orderBook || {}) : {};
    if (!price && obJson.price) price = parseFloat(obJson.price);
    const obBuckets = obJson.buckets || [];
    let obL = 0, obS = 0;
    const nearBsl = [];
    const nearSsl = [];
    for (const b of obBuckets) {
      const bp = parseFloat(b.price || 0);
      const lp = parseFloat(b.longCountPercent || 0);
      const sp = parseFloat(b.shortCountPercent || 0);
      obL += lp;
      obS += sp;
      if (bp > price && bp <= price * 1.03) {
        nearBsl.push({
          price: Number(bp.toFixed(inst.digits)),
          density_pct: Number(lp.toFixed(2)),
          dist_pips: Number(((bp - price) * inst.pipMult).toFixed(1)),
          label: "Buy Stops / BSL"
        });
      }
      if (bp < price && bp >= price * 0.97) {
        nearSsl.push({
          price: Number(bp.toFixed(inst.digits)),
          density_pct: Number(sp.toFixed(2)),
          dist_pips: Number(((price - bp) * inst.pipMult).toFixed(1)),
          label: "Sell Stops / SSL"
        });
      }
    }
    nearBsl.sort((a, b) => b.density_pct - a.density_pct);
    nearSsl.sort((a, b) => b.density_pct - a.density_pct);
    const top_bsl = nearBsl.slice(0, 3);
    const top_ssl = nearSsl.slice(0, 3);
    const totOb = obL + obS;
    const order_long_pct = totOb > 0 ? Number(((obL / totOb) * 100).toFixed(1)) : 50.0;
    const order_short_pct = totOb > 0 ? Number(((obS / totOb) * 100).toFixed(1)) : 50.0;

    const h4Raw = h4Res.ok ? ((await h4Res.json()).candles || []) : [];
    const h1Raw = h1Res.ok ? ((await h1Res.json()).candles || []) : [];
    const m30Raw = m30Res.ok ? ((await m30Res.json()).candles || []) : [];
    const m15Raw = m15Res.ok ? ((await m15Res.json()).candles || []) : [];
    const m5Raw = m5Res.ok ? ((await m5Res.json()).candles || []) : [];

    const tH4 = analyzeCandlesTrend(h4Raw);
    const tH1 = analyzeCandlesTrend(h1Raw);
    const tM30 = analyzeCandlesTrend(m30Raw);
    const tM15 = analyzeCandlesTrend(m15Raw);
    const tM5 = analyzeCandlesTrend(m5Raw);

    const h1_high = tH1.high || price;
    const h1_low = tH1.low || price;
    const h1_mid = h1_high !== h1_low ? (h1_high + h1_low) / 2.0 : price;
    const is_discount = price < h1_mid;
    const zone = is_discount ? "DESCUENTO 🟢 (Busca Compras)" : "PREMIUM 🔴 (Busca Ventas)";

    let sBuy = 50;
    let sSell = 50;
    if (long_pct > 55.0) sSell += Math.trunc((long_pct - 50) * 0.8);
    else if (short_pct > 55.0) sBuy += Math.trunc((short_pct - 50) * 0.8);
    if (order_long_pct > 55.0) sBuy += 10;
    else if (order_short_pct > 55.0) sSell += 10;
    if (tH4.is_bull) sBuy += 10; else sSell += 10;
    if (tH1.is_bull) sBuy += 10; else sSell += 10;
    if (tM15.is_bull) sBuy += 5; else sSell += 5;
    if (is_discount) sBuy += 15; else sSell += 15;

    const prob_buy = Math.round((sBuy / (sBuy + sSell)) * 100);
    const prob_sell = 100 - prob_buy;
    const bias = prob_buy >= 53 ? "BULLISH" : (prob_sell >= 53 ? "BEARISH" : "NEUTRAL");
    const bias_desc = bias === "BULLISH"
      ? "SESGO INSTITUCIONAL COMPRA"
      : (bias === "BEARISH" ? "SESGO INSTITUCIONAL VENTA" : "MERCADO EN RANGO / NEUTRAL");

    const candles_by_tf = {
      H4: parseOhlc(h4Raw, inst.digits),
      H1: parseOhlc(h1Raw, inst.digits),
      M30: parseOhlc(m30Raw, inst.digits),
      M15: parseOhlc(m15Raw, inst.digits),
      M5: parseOhlc(m5Raw, inst.digits)
    };

    const asset = {
      symbol: inst.key,
      raw_symbol: inst.raw,
      name: inst.name,
      display: inst.display,
      icon: inst.icon,
      price,
      bid,
      ask,
      spread_pips,
      bias,
      bias_desc,
      prob_buy,
      prob_sell,
      retail_sentiment: {
        long_pct,
        short_pct,
        longs_in_loss,
        shorts_in_loss,
        summary: `Minoristas ${long_pct}% Comprados vs ${short_pct}% Vendidos. Contrarian Smart Money favorece ${
          long_pct > 60
            ? "VENTA por exceso de compradores atrapados"
            : (short_pct > 60 ? "COMPRA por exceso de vendedores atrapados" : "equilibrio de flujo")
        }.`
      },
      order_book: {
        order_long_pct,
        order_short_pct,
        top_bsl,
        top_ssl,
        bsl_target: top_bsl[0] ? top_bsl[0].price : Number(h1_high.toFixed(inst.digits)),
        ssl_target: top_ssl[0] ? top_ssl[0].price : Number(h1_low.toFixed(inst.digits))
      },
      technical_smc: {
        trend_h4: tH4.trend,
        trend_h1: tH1.trend,
        trend_m30: tM30.trend,
        trend_m15: tM15.trend,
        trend_m5: tM5.trend,
        zone,
        h1_high: Number(h1_high.toFixed(inst.digits)),
        h1_low: Number(h1_low.toFixed(inst.digits)),
        h1_equilibrium: Number(h1_mid.toFixed(inst.digits)),
        candles_m15: candles_by_tf.M15,
        candles_by_tf
      }
    };

    return res.status(200).json({
      success: true,
      synced_at: new Date().toISOString(),
      asset
    });
  } catch (err) {
    return res.status(502).json({ error: "Error consultando feed institucional", detail: String(err && err.message || err) });
  }
};
