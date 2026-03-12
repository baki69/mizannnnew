const Anthropic = require("@anthropic-ai/sdk");

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
    // ETAPE 1 : FR -> mot arabe via Claude
    const transMsg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 20,
      system: "Reponds UNIQUEMENT avec 1 seul mot arabe. Rien d'autre.",
      messages: [{ role: "user", content: "Traduis en 1 mot arabe : " + q }]
    });
    const arabicQuery = transMsg.content[0].text.trim().split(/\s+/)[0];

    // ETAPE 2 : API officielle Dorar (JSON direct, pas de scraping)
    const apiUrl = "https://dorar.net/dorar_api.json?skey=" + encodeURIComponent(arabicQuery);
    const dorarResp = await fetch(apiUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000)
    });

    if (!dorarResp.ok) {
      return res.status(502).json({ error: "Dorar API " + dorarResp.status, results: [] });
    }

    const dorarData = await dorarResp.json();

    if (!dorarData.hadith || !dorarData.hadith.length) {
      return res.status(200).json({ arabicQuery, results: [] });
    }

    // ETAPE 3 : Extraire les champs depuis le HTML de chaque hadith
    const rawResults = dorarData.hadith.slice(0, 5).map(function(h) {
      var html = h.css || h.html || h.info || "";
      // Nettoyer les balises HTML
      var text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

      var gradeMatch  = text.match(/\u062e\u0644\u0627\u0635\u0629 \u062d\u0643\u0645 \u0627\u0644\u0645\u062d\u062f\u062b\s*:\s*([^\|]{3,50})/);
      var savantMatch = text.match(/\u0627\u0644\u0645\u062d\u062f\u062b\s*:\s*([^\|]{3,40})/);
      var sourceMatch = text.match(/\u0627\u0644\u0645\u0635\u062f\u0631\s*:\s*([^\|]{3,60})/);
      var rawiMatch   = text.match(/\u0627\u0644\u0631\u0627\u0648\u064a\s*:\s*([^\|]{3,40})/);

      // Texte arabe = tout avant "الراوي" ou "خلاصة"
      var arabic_text = text
        .split(/\u0627\u0644\u0631\u0627\u0648\u064a|\u062e\u0644\u0627\u0635\u0629/)[0]
        .replace(/^\d+\s*[-\.]\s*/, "")
        .trim()
        .substring(0, 600);

      return {
        arabic_text: arabic_text,
        grade:  gradeMatch  ? gradeMatch[1].trim()  : "",
        savant: savantMatch ? savantMatch[1].trim() : "",
        source: sourceMatch ? sourceMatch[1].trim() : "",
        rawi:   rawiMatch   ? rawiMatch[1].trim()   : ""
      };
    }).filter(function(r) { return r.arabic_text.length > 20; });

    if (rawResults.length === 0) {
      return res.status(200).json({ arabicQuery, results: [] });
    }

    // ETAPE 4 : Traduction AR -> FR Lexique de Fer Salaf As-Salih
    const arabicTexts = rawResults.map(function(r) { return r.arabic_text; }).join("\n---\n");

    const translateMsg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: "Tu es un traducteur Salaf As-Salih. REGLES ABSOLUES : istawa = S est etabli | Yad Allah = La Main d Allah | Nuzul = Descente | Wajh Allah = Le Visage d Allah. Traduction litterale uniquement. Zero commentaire.",
      messages: [{
        role: "user",
        content: "Traduis chaque hadith en francais. Separateur : ---\n\n" + arabicTexts
      }]
    });

    const frenchTexts = translateMsg.content[0].text.trim().split("---").map(function(t) { return t.trim(); });

    const results = rawResults.map(function(r, i) {
      return {
        arabic_text: r.arabic_text,
        french_text: frenchTexts[i] || "",
        grade:       r.grade,
        savant:      r.savant,
        source:      r.source,
        rawi:        r.rawi
      };
    });

    return res.status(200).json({ arabicQuery, results: results });

  } catch (err) {
    return res.status(500).json({ error: err.message, results: [] });
  }
};
