const Anthropic = require("@anthropic-ai/sdk");

module.exports = async (req, res) => {
  // 1. Autorisations pour ton site (CORS)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { q } = req.body;
  if (!q) return res.status(400).json({ error: "Recherche vide" });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    // ÉTAPE 1 : Traduire ta recherche en Arabe (car l'API Dorar veut de l'arabe)
    const transPrompt = await client.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 30,
      system: "Tu es un traducteur expert. Traduis le mot ou la phrase en 1 ou 2 mots-clés arabes pour une recherche de hadith. Réponds UNIQUEMENT par les mots arabes.",
      messages: [{ role: "user", content: q }]
    });
    const arabicQuery = transPrompt.content[0].text.trim();

    // ÉTAPE 2 : Appel à l'API OFFICIELLE (La méthode du fichier PHP)
    // On utilise exactement l'URL que tu as trouvée
    const dorarUrl = `https://dorar.net/dorar_api.json?skey=${encodeURIComponent(arabicQuery)}`;
    const response = await fetch(dorarUrl);
    const data = await response.json();

    // ÉTAPE 3 : Extraction du contenu (Basé sur ton fichier : ahadith->result)
    // On récupère le bloc de texte officiel fourni par Dorar
    const rawResult = data.ahadith ? data.ahadith.result : "";

    if (!rawResult || rawResult.length < 10) {
      return res.status(200).json({ arabicQuery, results: [] });
    }

    // ÉTAPE 4 : Traduction et Nettoyage par Claude
    // On lui envoie le bloc HTML brut de Dorar pour qu'il en fasse une belle liste en français
    const translationMsg = await client.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 2500,
      system: `Tu es un traducteur orthodoxe spécialisé en sciences du Hadith (Manhaj Salaf).
RÈGLES :
- Traduction littérale stricte, aucun commentaire.
- Respect total des Noms et Attributs d'Allah (zéro Ta'wil).
- Sépare chaque hadith traduit par le marqueur "---".
- Nettoie les balises HTML pour ne garder que le texte sacré et le verdict du savant.`,
      messages: [{
        role: "user",
        content: `Traduis ce contenu officiel de Dorar en français :\n\n${rawResult}`
      }]
    });

    const frenchTexts = translationMsg.content[0].text.split("---").map(t => t.trim());

    // ÉTAPE 5 : Structuration pour ton interface
    const results = frenchTexts.map((text, i) => ({
      id: i,
      french_text: text,
      source: "Dorar.net (Méthode Officielle)",
      grade: "Vérifié"
    }));

    return res.status(200).json({ arabicQuery, results });

  } catch (error) {
    console.error("Erreur:", error);
    return res.status(500).json({ error: "Erreur technique" });
  }
};
