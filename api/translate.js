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
    // 1. Traduction de la recherche (Modèle SONNET - Le plus fiable)
    const translationToArabic = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 50,
      system: "Traduis uniquement en 1 ou 2 mots-clés arabes pour une recherche de hadith.",
      messages: [{ role: "user", content: q }]
    });
    const arabicQuery = translationToArabic.content[0].text.trim();

    // 2. Appel à l'API Dorar
    const dorarUrl = `https://dorar.net/dorar_api.json?skey=${encodeURIComponent(arabicQuery)}`;
    const response = await fetch(dorarUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await response.json();
    const rawContent = data.ahadith ? data.ahadith.result : "";

    if (!rawContent || rawContent.length < 10) {
      return res.status(200).json({ results: [] });
    }

    // 3. Traduction finale (Modèle SONNET)
    const finalTranslation = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 3000,
      system: "Tu es un traducteur expert en hadith. Traduis fidèlement du texte arabe vers le français.",
      messages: [{ role: "user", content: `Traduis ce texte :\n\n${rawContent}` }]
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
    return res.status(500).json({ error: "Erreur technique de l'IA" });
  }
};
