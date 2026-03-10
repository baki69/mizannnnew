const Anthropic = require("@anthropic-ai/sdk");
const cheerio = require("cheerio");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

    // 2. Fetch Dorar via scrape.do SANS render=true + geoCode=de
    const targetUrl = "https://www.dorar.net/hadith/search?q=" + encodeURIComponent(arabicQuery);
    const scraperUrl = "https://api.scrape.do?token=" + process.env.SCRAPER_TOKEN + "&url=" + encodeURIComponent(targetUrl) + "&geoCode=de";

    const response = await fetch(scraperUrl, { signal: AbortSignal.timeout(7000) });
    if (!response.ok) throw new Error("Erreur Proxy/Dorar");

    const html = await response.text();
    const $ = cheerio.load(html);
    const rawResults = [];

    // 3. Parsing selecteurs Dorar
    $(".hadith-info, .result-hadith, div").each((i, el) => {
      if (rawResults.length >= 3) return false;

      const fullText = $(el).text().replace(/\s+/g, " ").trim();

      if (fullText.indexOf("\u062e\u0644\u0627\u0635\u0629 \u062d\u0643\u0645 \u0627\u0644\u0645\u062d\u062f\u062b") === -1) return;
      if (!/\uFDFA|\u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645/.test(fullText)) return;

      const grade  = (fullText.match(/\u062e\u0644\u0627\u0635\u0629 \u062d\u0643\u0645 \u0627\u0644\u0645\u062d\u062f\u062b\s*:\s*([^|]+)/) || [null, ""])[1].trim();
      const savant = (fullText.match(/\u0627\u0644\u0645\u062d\u062f\u062b\s*:\s*([^|]+)/)  || [null, ""])[1].trim();
      const source = (fullText.match(/\u0627\u0644\u0645\u0635\u062f\u0631\s*:\s*([^|]+)/)  || [null, ""])[1].trim();
      const arabic_text = fullText.split("\u0627\u0644\u0631\u0627\u0648\u064a")[0].replace(/^\d+\s*-\s*/, "").trim();

      if (arabic_text.length > 20) {
        rawResults.push({ arabic_text, grade, savant, source });
      }
    });

    if (rawResults.length === 0) {
      return res.status(200).json({ found: false, query: arabicQuery, results: [] });
    }

    // 4. Traduction AR -> FR avec Lexique de Fer Salaf As-Salih
    const textsToTranslate = rawResults.map((r, i) => "[" + i + "] " + r.arabic_text).join("\n\n");

    const promptFr = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      system: "Tu es un traducteur suivant la methodologie des Salaf As-Salih. Regles absolues : istawa = S est etabli, Yad Allah = La Main d Allah, Nuzul = Descente, Wajh Allah = Le Visage d Allah. Traduction litterale uniquement, aucun commentaire.",
      messages: [{ role: "user", content: "Traduis ces hadiths en francais :\n\n" + textsToTranslate }]
    });

    const translations = promptFr.content[0].text.split("\n\n");

    const finalResponse = rawResults.map((r, i) => ({
      arabic_text:  r.arabic_text,
      grade:        r.grade,
      savant:       r.savant,
      source:       r.source,
      french_text:  translations[i] ? translations[i].replace(/^\[\d+\]\s*/, "") : ""
    }));

    return res.status(200).json({ found: true, query: arabicQuery, results: finalResponse });

  } catch (error) {
    return res.status(500).json({ error: error.message, results: [] });
  }
};
