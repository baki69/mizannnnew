const Anthropic = require("@anthropic-ai/sdk");
const cheerio = require("cheerio");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Insère un espace à la place de chaque balise pour éviter la fusion des mots
function htmlToText(html) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Lit les champs d'un div.hadith-info en naviguant le DOM nœud par nœud
function parseHadithInfo($, infoEl) {
  const fields = {};
  let currentLabel = null;

  $(infoEl).contents().each((_, node) => {
    if (node.type === "tag" && $(node).hasClass("info-subtitle")) {
      currentLabel = $(node).text().replace(/:\s*$/, "").trim();
    } else if (currentLabel) {
      let val = "";
      if (node.type === "text") {
        val = node.data.trim();
      } else if (node.type === "tag") {
        val = $(node).text().trim();
      }
      if (val) {
        fields[currentLabel] = val;
        currentLabel = null;
      }
    }
  });

  return fields;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "Requete vide" });

  try {
    // 1. Traduction FR -> AR
    const promptAr = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 50,
      messages: [{ role: "user", content: "Mots-cles arabes uniquement pour : \"" + q + "\"" }]
    });
    const arabicQuery = promptAr.content[0].text.trim();

    // 2. Appel direct dorar_api.json (plus besoin de scrape.do)
    const apiUrl = "https://dorar.net/dorar_api.json?skey=" + encodeURIComponent(arabicQuery);
    const response = await fetch(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
        "Referer": "https://dorar.net/"
      },
      signal: AbortSignal.timeout(6000)
    });
    if (!response.ok) throw new Error("Dorar API error " + response.status);

    const json = await response.json();
    const htmlResult = json?.ahadith?.result;
    if (!htmlResult) return res.status(200).json({ found: false, query: arabicQuery, results: [] });

    // 3. Parsing avec sélecteurs confirmés : div.hadith + div.hadith-info
    const $ = cheerio.load(htmlResult);
    const rawResults = [];

    $("div.hadith-info").each((_, infoEl) => {
      if (rawResults.length >= 3) return false;

      const fields = parseHadithInfo($, infoEl);
      const grade  = fields["خلاصة حكم المحدث"] || "";
      const savant = fields["المحدث"]             || "";
      const source = fields["المصدر"]             || "";
      const rawi   = fields["الراوي"]             || "";

      // Texte du hadith : div.hadith qui précède immédiatement ce div.hadith-info
      const hadithHtml = $(infoEl).prev("div.hadith").html() || "";
      const arabic_text = htmlToText(hadithHtml)
        .replace(/^\d+\s*[-–]\s*/, "")
        .trim();

      if (arabic_text.length > 20 && grade) {
        rawResults.push({ arabic_text, grade, savant, source, rawi });
      }
    });

    if (rawResults.length === 0) {
      return res.status(200).json({ found: false, query: arabicQuery, results: [] });
    }

    // 4. Traduction AR -> FR — SYSTEM_PROMPT Salaf As-Salih, réponse JSON forcée
    const textsToTranslate = rawResults.map((r, i) => "[" + i + "] " + r.arabic_text).join("\n\n");

    const promptFr = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system: "Tu es un traducteur suivant la methodologie des Salaf As-Salih. Regles absolues : istawa = S est etabli, Yad Allah = La Main d Allah, Nuzul = Descente, Wajh Allah = Le Visage d Allah. Traduction litterale uniquement, aucun commentaire. Reponds UNIQUEMENT avec un tableau JSON valide : [{\"i\":0,\"t\":\"traduction\"},{\"i\":1,\"t\":\"traduction\"}]",
      messages: [{ role: "user", content: "Traduis ces hadiths en francais :\n\n" + textsToTranslate }]
    });

    // 5. Parse la réponse JSON avec fallback sur marqueurs [0], [1]...
    const translations = {};
    try {
      const raw = promptFr.content[0].text;
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) {
        JSON.parse(match[0]).forEach(item => {
          if (typeof item.i === "number" && typeof item.t === "string") {
            translations[item.i] = item.t;
          }
        });
      }
    } catch (_) {
      promptFr.content[0].text.split(/(?=\[\d+\])/).forEach(chunk => {
        const m = chunk.match(/^\[(\d+)\]\s*([\s\S]+)/);
        if (m) translations[parseInt(m[1])] = m[2].trim();
      });
    }

    const finalResponse = rawResults.map((r, i) => ({
      arabic_text: r.arabic_text,
      grade:       r.grade,
      savant:      r.savant,
      source:      r.source,
      rawi:        r.rawi,
      french_text: (translations[i] || "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim()
    }));

    return res.status(200).json({ found: true, query: arabicQuery, results: finalResponse });

  } catch (error) {
    return res.status(500).json({ error: error.message, results: [] });
  }
};
