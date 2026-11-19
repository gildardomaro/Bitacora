/**
 * Vercel Serverless Proxy — Gemini Copilot IA para el Radar Institucional
 * Mantiene GEMINI_API_KEY exclusivamente en el servidor.
 *
 * Endpoint:
 *   POST /api/copilot  { "prompt": "..." }
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

const DEFAULT_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemma-4-31b-it",
  "gemma-4-26b-a4b-it",
  "gemini-3.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash"
];

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Radar-Auth");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!isAuthorizedRequest(req)) {
    return res.status(401).json({ success: false, error: "Acceso restringido. Inicia sesión para continuar." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      success: false,
      error: "Gemini proxy not configured",
      hint: "Configure GEMINI_API_KEY in Vercel environment variables."
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

  const prompt = String((body && body.prompt) || "").trim();
  if (!prompt || prompt.length > 6000) {
    return res.status(400).json({ success: false, error: "Invalid prompt length" });
  }

  const envModels = process.env.GEMINI_MODELS
    ? process.env.GEMINI_MODELS.split(",").map(s => s.trim()).filter(Boolean)
    : DEFAULT_MODELS;

  for (const model of envModels) {
    try {
      const upstream = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        }
      );
      if (upstream.ok) {
        const j = await upstream.json();
        const text = j && j.candidates && j.candidates[0] && j.candidates[0].content &&
                     j.candidates[0].content.parts && j.candidates[0].content.parts[0] &&
                     j.candidates[0].content.parts[0].text;
        if (text) {
          return res.status(200).json({ success: true, text, model });
        }
      }
    } catch (_) {
      // Siguiente modelo en la rotación
    }
  }

  return res.status(502).json({ success: false, error: "All Gemini models failed or quota exceeded" });
};
