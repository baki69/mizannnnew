const Anthropic = require("@anthropic-ai/sdk");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const q = req.query.q || (req.body && req.body.q);
  if (!q) return res.status(400).json({ error: "q manquant" });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    // ÉTAPE 1 : FR → 1 mot arabe
    const transMsg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 20,
      system: "Tu es un traducteur. Réponds UNIQUEMENT avec 1 seul mot arabe. Rien d'autre.",
      messages: [{ role: "user", content: `Traduis en 1 mot arabe pour recherche hadith: "${q}"` }]
    });
    const arabicQuery = transMsg.content[0].text.trim().split(/\s+/)[0];

    // ÉTAPE 2 : API JSON officielle Dorar (URL exacte de la documentation)
    const dorarUrl = `https://dorar.net/dorar_api.json?skey=${encodeURIComponent(arabicQuery)}`;
    const dorarResp = await fetch(dorarUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json"
      },
      signal: AbortSignal.timeout(15000)
    });

    const raw = await dorarResp.text();

    let ahadith = [];
    try {
      const json = JSON.parse(raw);
      ahadith = json.hadith || json.ahadith || [];
    } catch(e) {
      return res.status(200).json({ arabicQuery, results: [], debug: raw.substring(0, 300) });
    }

    if (ahadith.length === 0) {
      return res.status(200).json({ arabicQuery, results: [], debug: raw.substring(0, 300) });
    }

    const rawResults = ahadith.slice(0, 5).map(h => ({
      arabic_text: (h.hadith || h.htext || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().substring(0, 400),
      savant: (h.mohadith || h.mName || "").trim(),
      grade: (h.grade || h.hukm || "").trim(),
      source: (h.book || h.bName || "").trim(),
      rawi: (h.rawi || "").trim()
    })).filter(h => h.arabic_text.length > 20);

    if (rawResults.length === 0) {
      return res.status(200).json({ arabicQuery, results: [] });
    }

    // ÉTAPE 3 : Traduction AR → FR avec Bouclier Doctrinal
    const arabicTexts = rawResults.map(r => r.arabic_text).join("\n---\n");
    const translateMsg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: `Tu es un traducteur orthodoxe en sciences du Hadith, voie des Salaf As-Salih.
RÈGLES ABSOLUES :
- Traduction strictement littérale, zéro Ta'wil.
- استوى = "S'est établi" | يد الله = "La Main d'Allah" | نزول = "Descente" | وجه الله = "Le Visage d'Allah"
- Aucun commentaire. Traduis uniquement.`,
      messages: [{ role: "user", content: `Traduis en français. Séparateur : "---". Même ordre.\n\n${arabicTexts}` }]
    });

    const frenchTexts = translateMsg.content[0].text.trim().split("---").map(t => t.trim());
    const results = rawResults.map((r, i) => ({ ...r, french_text: frenchTexts[i] || "" }));

    return res.status(200).json({ arabicQuery, results });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
