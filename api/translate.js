const Anthropic = require("@anthropic-ai/sdk");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { q } = req.body;
  if (!q) return res.status(400).json({ error: "Recherche vide" });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    // 1. TRADUCTION DE LA RECHERCHE (Français -> Arabe)
    const translationToArabic = await client.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 50,
      system: "Traduis uniquement en 1 ou 2 mots-clés arabes pour une recherche de hadith. Pas de texte superflu.",
      messages: [{ role: "user", content: q }]
    });
    const arabicQuery = translationToArabic.content[0].text.trim();

    // 2. APPEL OFFICIEL DORAR (Lien de ton fichier PHP)
    const dorarUrl = `https://dorar.net/dorar_api.json?skey=${encodeURIComponent(arabicQuery)}`;
    
    const response = await fetch(dorarUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const data = await response.json();

    // 3. EXTRACTION (ahadith -> result)
    const rawContent = data.ahadith ? data.ahadith.result : "";

    if (!rawContent || rawContent.length < 10) {
      return res.status(200).json({ results: [] });
    }

    // 4. TRADUCTION DES RÉSULTATS (Arabe -> Français)
    const finalTranslation = await client.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 3000,
      system: "Tu es un traducteur expert en hadith (Manhaj Salaf). Traduis fidèlement. Sépare les hadiths par '---'. Nettoie le HTML.",
      messages: [{ role: "user", content: `Traduis ce texte officiel de Dorar :\n\n${rawContent}` }]
    });

    const translatedSections = finalTranslation.content[0].text.split("---").map(t => t.trim());

    const finalResults = translatedSections.map((text, index) => ({
      id: index,
      french_text: text,
      source: "Dorar.net",
      grade: "Vérifié"
    }));

    return res.status(200).json({ results: finalResults });

  } catch (error) {
    console.error("Erreur:", error);
    return res.status(500).json({ error: "Vérifiez la connexion ou les crédits." });
  }
};
