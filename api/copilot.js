/**
 * Vercel Serverless Proxy — Gemini Copilot IA para el Radar Institucional
 * Mantiene GEMINI_API_KEY exclusivamente en el servidor.
 *
 * Endpoint:
 *   POST /api/copilot  { "prompt": "..." }
 */

const DEFAULT_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash",
  "gemma-3-27b-it"
];

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
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
