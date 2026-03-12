const cheerio = require("cheerio");
const Anthropic = require("@anthropic-ai/sdk");

// Lexique de Fer — System Prompt Takhrij complet Salaf As-Salih
const SYSTEM_PROMPT =
  "Tu es un expert en sciences du Hadith selon la methodologie des Salaf As-Salih. " +
  "Lexique de Fer INTOUCHABLE : istawa = S est etabli | Yad Allah = La Main d Allah | " +
  "Nuzul = Descente | Wajh Allah = Le Visage d Allah. " +
  "Interdiction absolue de paraphraser ces termes. " +
  "Pour chaque hadith, genere un objet JSON avec ces 5 champs en francais : " +
  "french_text (traduction litterale du matn, Lexique de Fer strict), " +
  "grade_explique (verdict d authenticite detaille avec nom du savant source et reference), " +
  "jarh_tadil (analyse du rawi selon Ibn Hajar dans Taqrib al-Tahdhib, Al-Dhahabi dans Al-Kashif, Al-Albani), " +
  "sanad_conditions (verification des 5 conditions : Ittisal al-Sanad / Adala al-Rawi / Dabt al-Rawi / absence de Shudhudh / absence de Illa), " +
  "avis_savants (avis consolides des specialistes du Hadith avec references). " +
  "Reponds UNIQUEMENT avec un tableau JSON valide, zero commentaire : " +
  '[{"i":0,"french_text":"...","grade_explique":"...","jarh_tadil":"...","sanad_conditions":"...","avis_savants":"..."}]';

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
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [{ role: "user", content: userMessage }],
  };
  if (system) params.system = system;

  const response = await client.messages.create(params);
  const block = response.content.find((b) => b.type === "text");
  if (!block) throw new Error("Pas de réponse texte de Claude");
  return block.text;
}

function clean(s) {
  return (s || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
    // 1. Extraction du mot-clé arabe unique via Claude
    const KEYWORD_SYSTEM =
      "Tu es un extracteur de mot-clé arabe. " +
      "Règle absolue : réponds avec UN SEUL mot en arabe, le plus pertinent pour rechercher ce sujet dans une base de hadiths. " +
      "Interdit : listes, phrases, explications, translittération, ponctuation. " +
      "Réponse = UN mot arabe, rien d'autre.";
    const arabicQuery = (
      await callClaude(client, q, KEYWORD_SYSTEM)
    ).trim().split(/\s+/)[0];

    // 2. API JSON officielle Dorar
    const apiUrl =
      "https://dorar.net/dorar_api.json?skey=" +
      encodeURIComponent(arabicQuery);
    const dorarRes = await fetch(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
        Referer: "https://dorar.net/",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!dorarRes.ok) throw new Error("Dorar error " + dorarRes.status);

    const json = await dorarRes.json();
    const htmlResult = json?.ahadith?.result ?? json?.ahadith ?? null;
    if (!htmlResult)
      return res.status(200).json({ found: false, query: arabicQuery, results: [] });

    // 3. Parsing — double stratégie
    const $ = cheerio.load(htmlResult);
    const rawResults = [];

    $("div.hadith").each((_, hadithEl) => {
      if (rawResults.length >= 5) return false;
      const arabic_text = htmlToText($(hadithEl).html() || "")
        .replace(/^\d+\s*[-–]\s*/, "").trim();
      if (arabic_text.length < 20) return;

      const infoEl = $(hadithEl).next("div.hadith-info");
      if (!infoEl.length) return;

      const fields = parseHadithInfo($, infoEl[0]);
      const grade  = fields["خلاصة حكم المحدث"] || "";
      const savant = fields["المحدث"] || "";
      const source = fields["المصدر"] || "";
      const rawi   = fields["الراوي"] || "";
      if (!grade) return;

      rawResults.push({ arabic_text, grade, savant, source, rawi });
    });

    if (rawResults.length === 0) {
      const seen = new Set();
      $("*").each((_, el) => {
        if (rawResults.length >= 5) return false;
        const text = $(el).text().trim();
        if (!text.includes("خلاصة حكم المحدث")) return;
        if (!/ﷺ|صلى الله عليه وسلم/.test(text)) return;
        if (text.length > 1500 || text.length < 50) return;
        const key = text.substring(0, 60);
        if (seen.has(key)) return;
        seen.add(key);
        const gradeMatch  = text.match(/خلاصة حكم المحدث\s*:\s*([^\n\r|]{3,40})/);
        const savantMatch = text.match(/المحدث\s*:\s*([^|\n\r]{3,30})/);
        const sourceMatch = text.match(/المصدر\s*:\s*([^|\n\r]{3,30})/);
        const arabic_text = text.split("خلاصة حكم المحدث")[0]
          .replace(/\s+/g, " ").trim().substring(0, 400);
        if (arabic_text.length < 20) return;
        rawResults.push({
          arabic_text,
          grade:  gradeMatch?.[1].trim()  || "",
          savant: savantMatch?.[1].trim() || "",
          source: sourceMatch?.[1].trim() || "",
          rawi: "",
        });
      });
    }

    if (rawResults.length === 0)
      return res.status(200).json({ found: false, query: arabicQuery, results: [] });

    // 4. Takhrij complet AR -> FR via Claude (5 champs)
    const textsToAnalyze = rawResults
      .map((r, i) =>
        "[" + i + "]\n" +
        "Matn arabe : " + r.arabic_text + "\n" +
        "Grade : " + r.grade + "\n" +
        "Savant : " + r.savant + "\n" +
        "Rawi : " + r.rawi
      )
      .join("\n\n");

    const rawAnalysis = await callClaude(
      client,
      "Genere le Takhrij complet en francais pour ces hadiths :\n\n" + textsToAnalyze,
      SYSTEM_PROMPT
    );

    // 5. Parse JSON avec double fallback
    const analyses = {};
    try {
      const match = rawAnalysis.match(/\[[\s\S]*\]/);
      if (match) {
        JSON.parse(match[0]).forEach((item) => {
          if (typeof item.i === "number") {
            analyses[item.i] = item;
          }
        });
      }
    } catch (_) {
      // fallback : valeurs vides si JSON malformé
      rawResults.forEach((_, i) => {
        if (!analyses[i]) analyses[i] = {
          french_text: "Non documente",
          grade_explique: "Non documente",
          jarh_tadil: "Non documente",
          sanad_conditions: "Non documente",
          avis_savants: "Non documente"
        };
      });
    }

    const finalResponse = rawResults.map((r, i) => {
      const a = analyses[i] || {};
      return {
        arabic_text:      r.arabic_text,
        grade:            r.grade,
        savant:           r.savant,
        source:           r.source,
        rawi:             r.rawi,
        french_text:      clean(a.french_text),
        grade_explique:   clean(a.grade_explique),
        jarh_tadil:       clean(a.jarh_tadil),
        sanad_conditions: clean(a.sanad_conditions),
        avis_savants:     clean(a.avis_savants),
      };
    });

    return res.status(200).json({ found: true, query: arabicQuery, results: finalResponse });

  } catch (error) {
    return res.status(500).json({ error: error.message, results: [] });
  }
};
