const cheerio = require("cheerio");
const Anthropic = require("@anthropic-ai/sdk");

// Lexique de Fer — System Prompt Salaf As-Salih
const SYSTEM_PROMPT =
  "Tu es un traducteur suivant la methodologie des Salaf As-Salih. " +
  "Regles absolues : istawa = S est etabli, Yad Allah = La Main d Allah, " +
  "Nuzul = Descente, Wajh Allah = Le Visage d Allah. " +
  "Traduction litterale uniquement, aucun commentaire. " +
  "Reponds UNIQUEMENT avec un tableau JSON valide : " +
  '[{"i":0,"t":"traduction"},{"i":1,"t":"traduction"}]';

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

// Lit les champs d'un div.hadith-info nœud par nœud
function parseHadithInfo($, infoEl) {
  const fields = {};
  let currentLabel = null;
  $(infoEl).contents().each((_, node) => {
    if (node.type === "tag" && $(node).hasClass("info-subtitle")) {
      currentLabel = $(node).text().replace(/:\s*$/, "").trim();
    } else if (currentLabel) {
      const val =
        node.type === "text"
          ? node.data.trim()
          : node.type === "tag"
          ? $(node).text().trim()
          : "";
      if (val) {
        fields[currentLabel] = val;
        currentLabel = null;
      }
    }
  });
  return fields;
}

async function callClaude(client, userMessage, system) {
  const params = {
    model: "claude-opus-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: userMessage }],
  };
  if (system) params.system = system;

  const response = await client.messages.create(params);
  const block = response.content.find((b) => b.type === "text");
  if (!block) throw new Error("Pas de réponse texte de Claude");
  return block.text;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "Requete vide" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY manquante" });

  const client = new Anthropic({ apiKey });

  try {
    // 1. Traduction FR -> AR via Claude
    const arabicQuery = (
      await callClaude(client, 'Mots-cles arabes uniquement pour : "' + q + '"')
    ).trim();

    // 2. Appel direct dorar_api.json
    const apiUrl =
      "https://dorar.net/dorar_api.json?skey=" +
      encodeURIComponent(arabicQuery);
    const dorarRes = await fetch(apiUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
        Referer: "https://dorar.net/",
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!dorarRes.ok) throw new Error("Dorar API error " + dorarRes.status);

    const json = await dorarRes.json();
    const htmlResult = json?.ahadith;
    if (!htmlResult)
      return res
        .status(200)
        .json({ found: false, query: arabicQuery, results: [] });

    // 3. Parsing avec sélecteurs : div.hadith + div.hadith-info
    const $ = cheerio.load(htmlResult);
    const rawResults = [];

    $("div.hadith-info").each((_, infoEl) => {
      if (rawResults.length >= 3) return false;
      const fields = parseHadithInfo($, infoEl);
      const grade = fields["خلاصة حكم المحدث"] || "";
      const savant = fields["المحدث"] || "";
      const source = fields["المصدر"] || "";
      const rawi = fields["الراوي"] || "";
      const arabic_text = htmlToText(
        $(infoEl).prev("div.hadith").html() || ""
      )
        .replace(/^\d+\s*[-–]\s*/, "")
        .trim();
      if (arabic_text.length > 20 && grade) {
        rawResults.push({ arabic_text, grade, savant, source, rawi });
      }
    });

    if (rawResults.length === 0)
      return res
        .status(200)
        .json({ found: false, query: arabicQuery, results: [] });

    // 4. Traduction AR -> FR via Claude (Lexique de Fer)
    const textsToTranslate = rawResults
      .map((r, i) => "[" + i + "] " + r.arabic_text)
      .join("\n\n");
    const rawTranslation = await callClaude(
      client,
      "Traduis ces hadiths en francais :\n\n" + textsToTranslate,
      SYSTEM_PROMPT
    );

    // 5. Parse JSON avec fallback sur marqueurs [0], [1]...
    const translations = {};
    try {
      const match = rawTranslation.match(/\[[\s\S]*\]/);
      if (match) {
        JSON.parse(match[0]).forEach((item) => {
          if (typeof item.i === "number" && typeof item.t === "string") {
            translations[item.i] = item.t;
          }
        });
      }
    } catch (_) {
      rawTranslation.split(/(?=\[\d+\])/).forEach((chunk) => {
        const m = chunk.match(/^\[(\d+)\]\s*([\s\S]+)/);
        if (m) translations[parseInt(m[1])] = m[2].trim();
      });
    }

    const finalResponse = rawResults.map((r, i) => ({
      arabic_text: r.arabic_text,
      grade: r.grade,
      savant: r.savant,
      source: r.source,
      rawi: r.rawi,
      french_text: (translations[i] || "")
        .replace(/[\u0000-\u001F\u007F]/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    }));

    return res
      .status(200)
      .json({ found: true, query: arabicQuery, results: finalResponse });
  } catch (error) {
    return res.status(500).json({ error: error.message, results: [] });
  }
};
