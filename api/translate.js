const Anthropic = require("@anthropic-ai/sdk");
const cheerio = require("cheerio");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { q } = req.body;
  if (!q) return res.status(400).json({ error: "q manquant" });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    // ÉTAPE 1 : FR → arabe
    const transMsg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 20,
      system: "Tu es un traducteur. Réponds UNIQUEMENT avec 1 seul mot arabe. Rien d'autre.",
      messages: [{ role: "user", content: `Traduis en 1 mot arabe pour recherche hadith: "${q}"` }]
    });
    const arabicQuery = transMsg.content[0].text.trim().split(/\s+/)[0];

    // ÉTAPE 2 : Vercel fetch Dorar directement
    const dorarUrl = `https://dorar.net/hadith/search?q=${encodeURIComponent(arabicQuery)}&ajax=1`;
    const dorarResp = await fetch(dorarUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "ar,fr;q=0.9",
        "Referer": "https://dorar.net/"
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!dorarResp.ok) {
      return res.status(200).json({ arabicQuery, results: [], error: `Dorar: ${dorarResp.status}` });
    }

    const html = await dorarResp.text();
    const $ = cheerio.load(html);
    const rawResults = [];
    const seen = new Set();

    $(".hadith-info, .hadith, article").each((i, el) => {
      if (rawResults.length >= 5) return false;
      const text = $(el).text().trim();
      if (text.length < 50) return;
      const key = text.substring(0, 60);
      if (seen.has(key)) return;
      seen.add(key);

      const gradeMatch = text.match(/خلاصة حكم المحدث\s*:\s*([^\n\r|]{3,40})/);
      const savantMatch = text.match(/المحدث\s*:\s*([^|\n\r]{3,30})/);
      const sourceMatch = text.match(/المصدر\s*:\s*([^|\n\r]{3,30})/);
      const arabic_text = text.split("خلاصة حكم المحدث")[0]
        .replace(/\s+/g, " ").trim().substring(0, 400);

      if (arabic_text.length < 20) return;
      rawResults.push({
        arabic_text,
        savant: savantMatch?.[1].trim() || "",
        grade: gradeMatch?.[1].trim() || "",
        source: sourceMatch?.[1].trim() || ""
      });
    });

    if (rawResults.length === 0) {
      return res.status(200).json({ arabicQuery, results: [], debug: html.substring(0, 500) });
    }

    // ÉTAPE 3 : Traduction AR → FR
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
