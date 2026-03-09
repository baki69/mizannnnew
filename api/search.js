// api/search.js — Mizan as-Sunnah
// IA aiguilleur d'intention (Anthropic) + Dorar.net
// Clé API dans variable d'environnement Vercel : ANTHROPIC_API_KEY

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const q = req.query.q || '';
  if (!q) { res.status(400).json({ error: 'Paramètre q manquant' }); return; }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'Clé API non configurée' }); return; }

  try {

    // ── ÉTAPE 1 : Détecter si déjà en arabe ─────────────────────
    const isArabic = /[\u0600-\u06FF]/.test(q);
    let arKeywords = q;

    if (!isArabic) {
      // ── ÉTAPE 2 : IA traduit l'intention en mots-clés arabes ───
      const aiResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 60,
          system: `Tu es un expert en terminologie islamique classique. L'utilisateur pose une question ou écrit une phrase en français. Ta mission est d'en extraire le sens et de renvoyer UNIQUEMENT 1 à 3 mots-clés en arabe classique pur (sans ponctuation, sans phrase, sans explication) correspondant au chapitre de la Sunnah adéquat pour interroger le moteur Dorar.net.

Règle d'or : Utilise strictement le vocabulaire des Salafs. Si la question concerne les Attributs d'Allah, traduis littéralement sans aucun Ta'wil (ex: "Main d'Allah" = يد الله, "S'est établi" = استوى).

Exemples :
- "comment traiter mes parents" → بر الوالدين
- "je suis triste et déprimé" → الصبر
- "l'argent et la richesse" → الزهد الدنيا
- "bien manger" → الطعام الأكل
- "mon voisin m'énerve" → الجار
- "la mort" → الموت
- "le paradis" → الجنة
- "prier la nuit" → قيام الليل

Réponds UNIQUEMENT avec les mots-clés arabes, rien d'autre.`,
          messages: [{ role: 'user', content: q }]
        })
      });

      const aiData = await aiResp.json();
      const keywords = aiData.content?.[0]?.text?.trim() || '';

      if (keywords && /[\u0600-\u06FF]/.test(keywords)) {
        arKeywords = keywords;
      }
    }

    // ── ÉTAPE 3 : Interroger Dorar avec les mots-clés arabes ─────
    const dorarResp = await fetch(
      `https://dorar.net/dorar_api.json?skey=${encodeURIComponent(arKeywords)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', 'Referer': 'https://dorar.net/' } }
    );

    const dorarData = await dorarResp.json();

    // ── ÉTAPE 4 : Retourner résultat enrichi ─────────────────────
    res.status(200).json({
      query_original: q,
      query_arabic:   arKeywords,
      translated:     !isArabic,
      ahadith:        dorarData.ahadith || ''
    });

  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
