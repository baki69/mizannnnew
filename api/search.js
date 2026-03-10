// ═══════════════════════════════════════════════════════════════
//  AL MIZAN — api/search.js  (Backend Vercel — Version Definitive)
//  Architecture : Intention FR -> Traduction AR -> Dorar via Proxy
//                -> Parsing sans fusion -> Traduction FR complete
//  Variables Vercel requises :
//    ANTHROPIC_API_KEY  — cle Anthropic
//    SCRAPER_TOKEN      — token scrape.do (ou ZenRows)
// ═══════════════════════════════════════════════════════════════

const Anthropic = require("@anthropic-ai/sdk");
const cheerio   = require("cheerio");
const client    = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Prompt Systeme Methodologie Salaf As-Salih ─────────────────
const SYSTEM_PROMPT =
  "Tu es un expert en sciences du Hadith suivant strictement la methodologie des Salaf As-Salih. " +
  "Ta mission est de traduire les Hadiths de l'arabe vers le francais de maniere litterale et fidele. " +
  "REGLE DOGMATIQUE ABSOLUE : Interdiction totale d'interpreter les Attributs d'Allah (Ta'wil). " +
  "Tu dois traduire litteralement : " +
  "'istawa' (Istiwâ) = 'S est etabli' | " +
  "'yad Allah' (Yad Allah) = 'La Main d Allah' | " +
  "'nuzul' (Nuzûl) = 'Descente' | " +
  "'wajh Allah' (Wajh Allah) = 'Le Visage d Allah'. " +
  "Ne fournis aucun commentaire, aucune explication, aucune note. Donne uniquement la traduction francaise pure.";

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "Requete vide" });

  try {
    // ══════════════════════════════════════════════════════════
    //  ETAPE 1 — Traduction de l'intention (FR/AR -> mots-cles AR)
    // ══════════════════════════════════════════════════════════
    const transMsg = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 80,
      messages: [{
        role: "user",
        content:
          "Tu es un expert en hadith. Traduis cette requete en 3-5 mots-cles arabes " +
          "pour rechercher sur Dorar.net. Reponds UNIQUEMENT avec les mots arabes, " +
          "rien d'autre, pas d'explication, pas de ponctuation.\n\nRequete : " + q
      }]
    });

    const arabicQuery = transMsg.content[0].text.trim();

    // ══════════════════════════════════════════════════════════
    //  ETAPE 2 — Fetch Dorar via Proxy scraping (bypass Cloudflare)
    // ══════════════════════════════════════════════════════════
    const dorarUrl   = `https://www.dorar.net/hadith/search?q=${encodeURIComponent(arabicQuery)}&page=1`;
    const scraperUrl = `https://api.scrape.do?token=${process.env.SCRAPER_TOKEN}&url=${encodeURIComponent(dorarUrl)}&render=true`;

    const response = await fetch(scraperUrl, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) {
      return res.status(502).json({
        error:    "Erreur connexion Dorar",
        detail:   `Proxy status : ${response.status}`,
        fallback: []
      });
    }

    const html = await response.text();

    // ══════════════════════════════════════════════════════════
    //  ETAPE 3 — Parsing infaillible (zero fusion de mots)
    //  Methode : .contents() pour injecter des espaces entre noeuds
    // ══════════════════════════════════════════════════════════
    const $          = cheerio.load(html);
    const rawResults = [];

    $("div").each((i, el) => {
      if (rawResults.length >= 5) return false; // stopper each

      // Reconstruction du texte avec espaces explicites entre noeuds
      const fullText = $(el)
        .contents()
        .map(function () {
          return this.type === "text" ? $(this).text() : " ";
        })
        .get()
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      // Filtres : doit contenir la marque d'un resultat Dorar valide
      if (!fullText.includes("\u062e\u0644\u0627\u0635\u0629 \u062d\u0643\u0645 \u0627\u0644\u0645\u062d\u062f\u062b")) return; // "خلاصة حكم المحدث"
      if (!/\uFDFA|\u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645/.test(fullText)) return; // ﷺ

      // Regex avec Lookahead (zero debordement inter-champs)
      const gradeMatch  = fullText.match(/\u062e\u0644\u0627\u0635\u0629 \u062d\u0643\u0645 \u0627\u0644\u0645\u062d\u062f\u062b\s*:\s*(.*?)(?=\s*(?:\u0627\u0644\u0645\u062d\u062f\u062b|\u0627\u0644\u0645\u0635\u062f\u0631|$))/i);
      const savantMatch = fullText.match(/\u0627\u0644\u0645\u062d\u062f\u062b\s*:\s*(.*?)(?=\s*(?:\u0627\u0644\u0645\u0635\u062f\u0631|\u062e\u0644\u0627\u0635\u0629|$))/i);
      const sourceMatch = fullText.match(/\u0627\u0644\u0645\u0635\u062f\u0631\s*:\s*(.*?)(?=\s*(?:\u0627\u0644\u0645\u062d\u062f\u062b|\u062e\u0644\u0627\u0635\u0629|$))/i);

      // Texte arabe du hadith = apres "الراوي :" avant les champs meta
      const textParts = fullText.split(/\u0627\u0644\u0631\u0627\u0648\u064a\s*:/); // "الراوي :"
      let arabic_text = (textParts[1] || textParts[0] || "")
        .replace(/^\d+\s*-\s*/, "")
        .replace(/(\u0627\u0644\u0645\u062d\u062f\u062b|\u0627\u0644\u0645\u0635\u062f\u0631|\u062e\u0644\u0627\u0635\u0629 \u062d\u0643\u0645).*$/i, "")
        .trim();

      if (arabic_text.length < 60) return;
      // Exclure textes parasites : universites, titres, references
      if (/\u062c\u0627\u0645\u0639\u0629|\u062f\u0643\u062a\u0648\u0631|\u0623\u0633\u062a\u0627\u0630|\u0643\u0644\u064a\u0629|\u0645\u0639\u0647\u062f/.test(arabic_text)) return;
      // Doit contenir une vraie formule prophetique
      if (!/\uFDFA|\u0635\u0644\u0649 \u0627\u0644\u0644\u0647/.test(arabic_text)) return;

      rawResults.push({
        arabic_text,
        grade:  gradeMatch  ? gradeMatch[1].trim()  : "غير معروف",
        savant: savantMatch ? savantMatch[1].trim() : "—",
        source: sourceMatch ? sourceMatch[1].trim() : "—"
      });
    });

    // Si parsing vide -> retour rapide sans appel Claude inutile
    if (rawResults.length === 0) {
      return res.status(200).json({
        found:   false,
        query_ar: arabicQuery,
        results: []
      });
    }

    // ══════════════════════════════════════════════════════════
    //  ETAPE 4 — Traduction Claude (methode Salaf As-Salih)
    //  Un seul appel groupé pour tous les résultats = economique
    // ══════════════════════════════════════════════════════════
    const textsToTranslate = rawResults
      .map((h, i) => `HADITH ${i + 1} :\n${h.arabic_text}`)
      .join("\n\n---\n\n");

    const translateMsg = await client.messages.create({
      model:  "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content:
          "Traduis chaque hadith ci-dessous en francais. " +
          "Reponds en JSON valide uniquement, sans markdown ni backticks. " +
          "Format : [{\"index\":0,\"traduction\":\"...\",\"explication\":\"...\",\"conditions\":[\"...\",\"...\",\"...\",\"...\",\"...\"],\"savants\":[{\"nom\":\"...\",\"jugement\":\"...\"}],\"erreur_frequente\":\"...\"}]\n\n" +
          textsToTranslate
      }]
    });

    let translations = [];
    try {
      const raw = translateMsg.content[0].text
        .replace(/```json|```/g, "")
        .trim();
      translations = JSON.parse(raw);
    } catch (e) {
      // Si JSON malformé, on renvoie quand même les résultats arabes bruts
      console.error("[Al-Mizan] Erreur parsing JSON traduction :", e.message);
    }

    // ══════════════════════════════════════════════════════════
    //  ETAPE 5 — Assemblage final (arabe + traduction fusionnés)
    // ══════════════════════════════════════════════════════════
    const finalResults = rawResults.map((h, i) => {
      const t = translations.find(x => x.index === i) || {};
      return {
        arabic_text:      h.arabic_text,
        grade:            h.grade,
        savant:           h.savant,
        source:           h.source,
        traduction:       t.traduction        || "",
        explication:      t.explication       || "",
        conditions:       t.conditions        || [],
        savants_fr:       t.savants           || [],
        erreur_frequente: t.erreur_frequente  || ""
      };
    });

    return res.status(200).json({
      found:    true,
      query_ar: arabicQuery,
      results:  finalResults
    });

  } catch (err) {
    console.error("[Al-Mizan] Erreur search.js :", err.message);
    return res.status(500).json({ error: err.message });
  }
};
