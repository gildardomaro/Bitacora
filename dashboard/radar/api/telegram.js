/**
 * Vercel Serverless Function — Envío de Señales SMC + Captura de Gráfico a Telegram
 * Mantiene TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_IDS exclusivamente en el servidor.
 *
 * Endpoint:
 *   POST /api/telegram
 *   Headers: { "Content-Type": "application/json", "X-Radar-Auth": "<token>" }
 *   Body:    { "message": "...", "caption": "...", "imageBase64": "data:image/jpeg;base64,...", "parseMode": "HTML" }
 */

const crypto = require("crypto");

const EXPECTED_AUTH_TOKEN = process.env.RADAR_AUTH_TOKEN ||
  "1a442fdc3e588ede068248fb11cc950266fa3642bc132375d12e354d641cd122";

function isAuthorizedRequest(req) {
  const provided = String((req.headers && (req.headers["x-radar-auth"] || req.headers["X-Radar-Auth"])) || "").trim();
  if (!provided || provided.length !== EXPECTED_AUTH_TOKEN.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(EXPECTED_AUTH_TOKEN));
  } catch (_) {
    return false;
  }
}

function getConfiguredChatIds() {
  const rawList = process.env.TELEGRAM_CHAT_IDS || process.env.TELEGRAM_CHAT_ID || "";
  const ids = [];
  rawList.split(/[\s,;]+/).forEach((id) => {
    const clean = id.trim();
    if (clean && !ids.includes(clean)) {
      ids.push(clean);
    }
  });
  return ids;
}

async function sendTextMessage(botToken, chatId, text, parseMode) {
  const url = `https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text: text,
    disable_web_page_preview: true
  };
  if (parseMode) payload.parse_mode = parseMode;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.ok) {
    // Reintentar sin parse_mode por si algún carácter especial rompió el formato
    if (parseMode) {
      const retry = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: text.replace(/<[^>]+>/g, ""),
          disable_web_page_preview: true
        })
      });
      const retryData = await retry.json().catch(() => ({}));
      if (retry.ok && retryData.ok) return { ok: true };
    }
    return { ok: false, error: data.description || `HTTP ${resp.status}` };
  }
  return { ok: true };
}

async function sendPhotoMessage(botToken, chatId, imageBuffer, mimeType, caption, parseMode) {
  const url = `https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendPhoto`;
  const ext = mimeType === "image/png" ? "png" : "jpg";
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("photo", new Blob([imageBuffer], { type: mimeType }), `radar_smc_signal.${ext}`);
  if (caption) {
    form.append("caption", caption);
    if (parseMode) form.append("parse_mode", parseMode);
  }

  const resp = await fetch(url, {
    method: "POST",
    body: form
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.ok) {
    // Reintentar caption plano si el parse_mode falló
    if (caption && parseMode) {
      const formPlain = new FormData();
      formPlain.append("chat_id", String(chatId));
      formPlain.append("photo", new Blob([imageBuffer], { type: mimeType }), `radar_smc_signal.${ext}`);
      formPlain.append("caption", caption.replace(/<[^>]+>/g, ""));
      const retry = await fetch(url, { method: "POST", body: formPlain });
      const retryData = await retry.json().catch(() => ({}));
      if (retry.ok && retryData.ok) return { ok: true };
    }
    return { ok: false, error: data.description || `HTTP ${resp.status}` };
  }
  return { ok: true };
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Radar-Auth");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }
  if (!isAuthorizedRequest(req)) {
    return res.status(401).json({ success: false, error: "Acceso restringido. Inicia sesión para continuar." });
  }

  const botToken = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  const chatIds = getConfiguredChatIds();

  if (!botToken || chatIds.length === 0) {
    return res.status(503).json({
      success: false,
      error: "Telegram no configurado en Vercel.",
      hint: "Configura TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_IDS en las variables de entorno de Vercel."
    });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (_) {
      body = {};
    }
  }

  const message = String((body && body.message) || "").trim();
  const shortCaption = String((body && body.caption) || "").trim();
  const parseMode = (body && body.parseMode) || "HTML";
  const imageBase64 = String((body && body.imageBase64) || "").trim();

  if (!message && !imageBase64) {
    return res.status(400).json({ success: false, error: "Falta mensaje o imagen para enviar a Telegram." });
  }
  if (message.length > 4000) {
    return res.status(400).json({ success: false, error: "El mensaje excede el límite permitido." });
  }

  let imageBuffer = null;
  let mimeType = "image/jpeg";
  if (imageBase64) {
    const match = imageBase64.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i);
    const rawB64 = match ? match[2] : imageBase64;
    if (match && match[1]) {
      mimeType = match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase();
    }
    try {
      imageBuffer = Buffer.from(rawB64, "base64");
      if (!imageBuffer || imageBuffer.length < 100 || imageBuffer.length > 4 * 1024 * 1024) {
        imageBuffer = null;
      }
    } catch (_) {
      imageBuffer = null;
    }
  }

  const sentTo = [];
  const errors = [];

  for (const chatId of chatIds) {
    try {
      if (imageBuffer) {
        // Telegram permite hasta 1024 caracteres en caption de foto
        if (message && message.length <= 1000) {
          const rPhoto = await sendPhotoMessage(botToken, chatId, imageBuffer, mimeType, message, parseMode);
          if (rPhoto.ok) {
            sentTo.push(chatId);
          } else {
            // Fallback a texto si falló la foto
            const rText = await sendTextMessage(botToken, chatId, message, parseMode);
            if (rText.ok) sentTo.push(chatId);
            else errors.push(`${chatId}: ${rPhoto.error || rText.error}`);
          }
        } else {
          // Enviar foto con título corto + mensaje completo inmediatamente después
          const cap = shortCaption || "📡 Señal Institucional Smart+IA SMC";
          const rPhoto = await sendPhotoMessage(botToken, chatId, imageBuffer, mimeType, cap.slice(0, 1000), parseMode);
          const rText = message ? await sendTextMessage(botToken, chatId, message, parseMode) : { ok: true };
          if (rPhoto.ok || rText.ok) {
            sentTo.push(chatId);
          } else {
            errors.push(`${chatId}: ${rPhoto.error || rText.error}`);
          }
        }
      } else {
        const rText = await sendTextMessage(botToken, chatId, message, parseMode);
        if (rText.ok) sentTo.push(chatId);
        else errors.push(`${chatId}: ${rText.error}`);
      }
    } catch (err) {
      errors.push(`${chatId}: ${err.message || String(err)}`);
    }
  }

  if (sentTo.length === 0) {
    return res.status(502).json({
      success: false,
      error: "No se pudo entregar la señal a Telegram.",
      details: errors
    });
  }

  return res.status(200).json({
    success: true,
    sentCount: sentTo.length,
    mode: imageBuffer ? "photo+setup" : "text",
    errors: errors.length ? errors : undefined
  });
};
