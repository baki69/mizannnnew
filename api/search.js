const Anthropic = require("@anthropic-ai/sdk");
const cheerio = require("cheerio");
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "Paramètre q manquant" });

  try {
    // ÉTAPE 1 : Traduction FR → AR
    const transMsg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 60,
      messages: [{ role: "user", content: `Traduis en 1 ou 2 mots-clés arabes pour recherche de hadiths sur Dorar.net. Réponds UNIQUEMENT avec les mots arabes, rien d'autre. Requête: "${q}"` }]
    });
    const arabicQuery = transMsg.content[0].text.trim();

    // ÉTAPE 2 : Fetch Dorar
    const dorarUrl = `https://www.dorar.net/hadith/search?q=${encodeURIComponent(arabicQuery)}`;
    const response = await fetch(dorarUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html",
        "Accept-Language": "ar",
        "Referer": "https://www.dorar.net/"
      }
    });

    if (!response.ok) return res.status(502).json({ error: `Dorar HTTP ${response.status}` });
    const html = await response.text();
    const $ = cheerio.load(html);
    const rawResults = [];

    // ÉTAPE 3 : Parser basé sur la vraie structure Dorar observée
    // Chaque résultat a : texte hadith → "خلاصة حكم المحدث" → "الراوي / المحدث / المصدر"
    
    // Chercher tous les blocs qui contiennent "خلاصة حكم المحدث"
    $("*").each((i, el) => {
      if (rawResults.length >= 5) return false;
      const text = $(el).text();
      if (!text.includes("خلاصة حكم المحدث")) return;
      
      // Ce bloc contient un hadith complet avec son grade
      const fullText = text.trim();
      
      // Extraire le grade : texte après "خلاصة حكم المحدث :"
      const gradeMatch = fullText.match(/خلاصة حكم المحدث\s*:\s*([^\n\r|]+)/);
      const grade = gradeMatch ? gradeMatch[1].trim().replace(/\s+/g, " ") : "";
      
      // Extraire le savant : texte après "المحدث :"
      const savantMatch = fullText.match(/المحدث\s*:\s*([^|\n\r]+)/);
      const savant = savantMatch ? savantMatch[1].trim() : "";
      
      // Extraire la source : texte après "المصدر :"
      const sourceMatch = fullText.match(/المصدر\s*:\s*([^|\n\r]+)/);
      const source = sourceMatch ? sourceMatch[1].trim() : "";
      
      // Extraire le texte arabe : c'est le premier grand bloc arabe du div
      // avant "خلاصة حكم المحدث"
      const beforeGrade = fullText.split("خلاصة حكم المحدث")[0];
      // Prendre les lignes arabes substantielles
      const lines = beforeGrade.split(/[\n\r]+/).map(l => l.trim()).filter(l => {
        const arChars = (l.match(/[\u0600-\u06FF]/g) || []).length;
        return arChars > 20;
      });
      const arabic_text = lines.join(" ").replace(/^\d+\s*-\s*/, "").replace(/\s+/g, " ").trim().substring(0, 500);
      
      if (!arabic_text || arabic_text.length < 30) return;
      
      // Déduplication
      const key = arabic_text.substring(0, 60);
      if (rawResults.find(r => r.arabic_text.startsWith(key))) return;
      
      rawResults.push({ arabic_text, savant, grade, source });
    });

    if (rawResults.length === 0) return res.status(200).json([]);

    // ÉTAPE 4 : Traduction FR avec Bouclier Doctrinal (Lexique de Fer)
    const arabicTexts = rawResults.map(r => r.arabic_text).join("\n---\n");

    const translateMsg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: `Tu es un traducteur orthodoxe spécialisé en sciences du Hadith, suivant la voie des Salaf As-Salih.
RÈGLES ABSOLUES :
1. Traduction strictement littérale, sans aucun Ta'wil des Attributs d'Allah.
2. Attributs d'Allah traduits selon la voie des Salafs :
   - استوى = "S'est établi"
   - يد الله = "La Main d'Allah"
   - نزول = "Descente"
   - وجه الله = "Le Visage d'Allah"
3. Aucun commentaire ni note. Traduis uniquement.`,
      messages: [{
        role: "user",
        content: `Traduis ces hadiths arabes en français. Séparateur entre chaque hadith : "---". Même ordre, sans numérotation, sans explication.\n\n${arabicTexts}`
      }]
    });

    const frenchTexts = translateMsg.content[0].text.trim().split("---").map(t => t.trim());

    const results = rawResults.map((r, i) => ({
      ...r,
      french_text: frenchTexts[i] || ""
    }));

    return res.status(200).json(results);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
