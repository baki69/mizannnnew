// api/search.js — Mizan as-Sunnah
// IA aiguilleur (Anthropic) + Dorar parsing complet + format JSON structuré

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const q = (req.query.q || '').trim();
  if (!q) { res.status(400).json({ error: 'Paramètre q manquant' }); return; }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'Clé API non configurée' }); return; }

  try {
    // ── ÉTAPE 1 : Traduire l'intention FR → mots-clés arabes ─────
    const isArabic = /[\u0600-\u06FF]/.test(q);
    let arKeywords = q;

    if (!isArabic) {
      const aiResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 30,
          system: `Tu es un expert en terminologie islamique classique. Reçois une phrase en français et renvoie UNIQUEMENT 1 à 3 mots-clés en arabe classique pur (sans ponctuation, sans phrase, sans explication) pour interroger Dorar.net. Exemples: "je suis triste"→الصبر | "mes parents"→بر الوالدين | "mariage"→الزواج | "paradis"→الجنة | "mensonge"→الكذب. Réponds UNIQUEMENT les mots arabes.`,
          messages: [{ role: 'user', content: q }]
        })
      });
      const aiData = await aiResp.json();
      const kw = (aiData.content?.[0]?.text || '').trim();
      if (kw && /[\u0600-\u06FF]/.test(kw)) arKeywords = kw;
    }

    // ── ÉTAPE 2 : Appel Dorar API ─────────────────────────────────
    const dorarResp = await fetch(
      `https://dorar.net/dorar_api.json?skey=${encodeURIComponent(arKeywords)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', 'Referer': 'https://dorar.net/' } }
    );
    const dorarData = await dorarResp.json();
    const htmlStr = dorarData.ahadith || '';

    // ── ÉTAPE 3 : Parsing regex du HTML Dorar ────────────────────
    const hadiths = parseDorarHTML(htmlStr);

    // ── ÉTAPE 4 : Retourner tableau JSON structuré ────────────────
    res.status(200).json({
      query_original: q,
      query_arabic:   arKeywords,
      translated:     !isArabic,
      results:        hadiths
    });

  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}

// ── PARSING REGEX COMPLET DU HTML DORAR ──────────────────────────
function parseDorarHTML(html) {
  if (!html) return [];
  const results = [];

  // Séparer chaque bloc hadith
  const blocks = html.split(/(?=<div class="hadith")|(?=<br\/><br\/>)/g)
    .filter(b => b.includes('search-keys') || b.includes('hadith-info'));

  // Alternative : découper sur les séparateurs Dorar
  const hadithBlocks = [];
  const rx = /<div[^>]*class="hadith[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="hadith|$)/gi;
  let m;
  while ((m = rx.exec(html)) !== null) {
    hadithBlocks.push(m[1]);
  }

  const toProcess = hadithBlocks.length > 0 ? hadithBlocks : [html];

  for (const block of toProcess) {
    // Extraire le texte arabe (dans search-keys ou le premier grand texte arabe)
    let arabic_text = '';
    const arMatch = block.match(/class="search-keys[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    if (arMatch) {
      arabic_text = stripTags(arMatch[1]).trim();
    }
    if (!arabic_text) {
      // Fallback : prendre le plus long texte arabe du bloc
      const allTexts = block.match(/[\u0600-\u06FF][^<]{15,}/g) || [];
      if (allTexts.length) {
        arabic_text = allTexts.reduce((a, b) => a.length > b.length ? a : b, '');
      }
    }
    if (!arabic_text) continue;

    // Extraire الراوي
    let rawi = '';
    const rawiM = block.match(/الراوي[^<]*<\/span>\s*<span[^>]*>([^<]+)/i)
      || block.match(/class="info-subtitle">الراوي:<\/span>\s*([^<\n]+)/i);
    if (rawiM) rawi = rawiM[1].trim();

    // Extraire المحدث (savant)
    let savant = '';
    const savantM = block.match(/المحدث[^<]*<\/span>\s*<span[^>]*>([^<]+)/i)
      || block.match(/class="info-subtitle">المحدث:<\/span>\s*([^<\n]+)/i);
    if (savantM) savant = savantM[1].trim();

    // Extraire المصدر (source)
    let source = '';
    const sourceM = block.match(/المصدر[^<]*<\/span>\s*<span[^>]*>([^<]+)/i)
      || block.match(/class="info-subtitle">المصدر:<\/span>\s*([^<\n]+)/i);
    if (sourceM) source = sourceM[1].trim();

    // Extraire الصفحة أو الرقم
    let numero = '';
    const numM = block.match(/الصفحة أو الرقم[^<]*<\/span>\s*<span[^>]*>([^<]+)/i);
    if (numM) numero = numM[1].trim();

    // Extraire خلاصة حكم المحدث (grade complet)
    let grade = '';
    const gradeM = block.match(/خلاصة حكم المحدث[^<]*<\/span>\s*<span[^>]*>([^<]+)/i)
      || block.match(/class="info-subtitle">خلاصة حكم المحدث:<\/span>\s*([^<\n]+)/i);
    if (gradeM) grade = gradeM[1].trim();

    // Si pas de grade complet, chercher grade court
    if (!grade) {
      const gShort = block.match(/حكم[^<]*<\/span>\s*<span[^>]*>([^<]+)/i);
      if (gShort) grade = gShort[1].trim();
    }

    // Normaliser le grade pour le frontend
    let gradeKey = 'INCONNU';
    if (/صحيح/.test(grade))           gradeKey = 'SAHIH';
    else if (/حسن/.test(grade))       gradeKey = 'HASAN';
    else if (/ضعيف/.test(grade))      gradeKey = 'DAIF';
    else if (/موضوع|مكذوب|باطل/.test(grade)) gradeKey = 'MAWDU';

    results.push({
      arabic_text,
      rawi:     rawi   || '—',
      savant:   savant || '—',
      source:   source || '—',
      numero:   numero || '',
      grade:    grade  || '—',
      gradeKey
    });
  }

  return results;
}

function stripTags(str) {
  return str.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}
