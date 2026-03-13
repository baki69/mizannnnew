const Anthropic = require("@anthropic-ai/sdk");
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ═══════════════════════════════════════════════════════════════
// SYSTEM_TAKHRIJ — Constitution Al-Mizân (enrichie v3)
// ═══════════════════════════════════════════════════════════════
const SYSTEM_TAKHRIJ =
  "Tu es un Muhaddith de rang Hafidh, specialise dans le Takhrij et le Jarh wa Ta'dil selon " +
  "la methodologie stricte des Ahl al-Hadith : Al-Bukhari, Muslim, Ibn Hajar al-Asqalani, " +
  "Al-Dhahabi (Mizan al-I'tidal), Al-Albani (Silsilah Sahihah et Da'ifah), et leurs eleves. " +

  "LEXIQUE DE FER INTOUCHABLE — ces termes ne se traduisent jamais dans french_text : " +
  "istawa = S est etabli sur | Yad Allah = La Main d Allah | " +
  "Nuzul = La Descente | Wajh Allah = Le Visage d Allah. " +

  "REGLES DE PRODUCTION STRICTES : " +

  "(1) french_text : Traduction COMPLETE, LITTERALE et SOLENNELLE du matn arabe. " +
  "Minimum 2 phrases completes. Style digne d un texte sacre — jamais de paraphrase bacle. " +
  "ZERO mot arabe translittere dans le texte francais (ni niyyah, ni salat, ni ummah, ni amen). " +
  "Si le hadith contient une condition, une consequence ou une enumeration, tout doit figurer. " +

  "(2) grade_explique : Verdict definitif en majuscules (SAHIH / HASAN / DA'IF / MAWDU') + " +
  "nom complet du savant qui a statue + reference exacte de l ouvrage et numero si disponible. " +

  "(3) jarh_tadil : Analyse nominative de CHAQUE rawi de la chaine selon Ibn Hajar (Taqrib al-Tahdhib), " +
  "Al-Dhahabi (Mizan al-I'tidal), et Al-Albani si pertinent. " +
  "Cite les verdicts precis : Thiqah / Sadouq / Da'if / Matruk / Kadhdhab. " +
  "Si hadith Da'if : identifie l'ILLAH exacte (inqita, tadlis, rawi matruk, etc.). " +

  "(4) sanad_conditions : Analyse des 5 conditions de Sahih (Ibn al-Salah, Muqaddimah) : " +
  "Ittisal al-Sanad | Adala des transmetteurs | Dabt (memoriel et ecrit) | " +
  "absence de Shudhudh | absence d Illah. Precise la condition defaillante si hadith faible. " +

  "(5) avis_savants : " +
  "Si SAHIH ou HASAN : 2-3 savants qui l ont valide avec references. " +
  "Si DA'IF ou MAWDU : AVERTISSEMENT VIGOUREUX obligatoire. Explique pourquoi ce hadith " +
  "ne peut pas etre cite comme argument juridique. Cite Al-Albani (Silsilah Da'ifah no. X), " +
  "Ibn al-Jawzi (Al-Mawdu'at) ou Ibn Hajar selon le cas. " +
  "Rappelle l interdiction de transmettre un hadith faible sans mentionner sa faiblesse, " +
  "selon le consensus des Muhaddithin. " +

  "(6) pertinence : CHAMP OBLIGATOIRE. Evalue si le hadith trouve par Dorar correspond " +
  "a la REQUETE_ORIGINALE_UTILISATEUR. " +
  "Reponds : OUI (hadith correspond parfaitement) | PARTIEL (lien indirect) | NON (hors sujet). " +
  "Si PARTIEL ou NON : indique en une phrase quel hadith aurait du etre retourne, " +
  "avec sa reference exacte (ex: Sahih al-Bukhari no. 1, hadith de Umar ibn al-Khattab). " +

  "Reponds UNIQUEMENT avec un tableau JSON valide, zero backtick, zero texte avant ou apres : " +
  '[{"i":0,"french_text":"...","grade_explique":"...","jarh_tadil":"...","sanad_conditions":"...",' +
  '"avis_savants":"...","pertinence":"..."}]';

// ═══════════════════════════════════════════════════════════════
// SYSTEM_TARJAMA — Haiku traducteur litteral FR→AR
// ═══════════════════════════════════════════════════════════════
const SYSTEM_TARJAMA =
  "Tu es un traducteur specialise en textes islamiques classiques. " +
  "Ton unique role : convertir une phrase francaise en requete arabe pour Dorar.net. " +
  "REGLES : " +
  "(1) Si la phrase est une citation de hadith connue, retourne le DEBUT EXACT du matn arabe. " +
  "Exemple : 'les actes ne valent que par les intentions' -> إنما الأعمال بالنيات " +
  "Exemple : 'celui qui croit en Allah et au Jour dernier' -> من كان يؤمن بالله واليوم الآخر " +
  "(2) Si c est une translitteration phonetique, retourne l arabe exact. " +
  "Exemple : 'innamal a3mal binniyyat' -> إنما الأعمال بالنيات " +
  "(3) Si c est un theme general, retourne le mot arabe principal uniquement. " +
  "Exemple : 'misericorde divine' -> الرحمة " +
  "(4) Retourne UNIQUEMENT le texte arabe. Pas d explication. Maximum 8 mots.";

// ═══════════════════════════════════════════════════════════════
// HADITHS_CELEBRES — court-circuit prioritaire (zero latence)
// Couvre les requetes les plus frequentes avec le matn exact
// ═══════════════════════════════════════════════════════════════
const HADITHS_CELEBRES = [
  { patterns: ["innamal","a'mal","niyyat","niyyah","actes ne valent","valent par les int",
               "chaque homme n a que","homme n a que","intention","intentions","a3mal"],
    ar: "إنما الأعمال بالنيات" },
  { patterns: ["jibril","piliers de l islam","arkan al islam","islam iman ihsan",
               "qu est ce que l islam"],
    ar: "ما الإسلام" },
  { patterns: ["halal est clair","haram est clair","choses douteuses","halal bayyin"],
    ar: "الحلال بيّن والحرام بيّن" },
  { patterns: ["facilitez ne compliquez","yassiru","facilitez pas","ne compliquez pas"],
    ar: "يسروا ولا تعسروا" },
  { patterns: ["misericordieux envers les creatures","irham man fil ard","qui est sur terre"],
    ar: "ارحموا من في الأرض" },
  { patterns: ["sourire est une","tasabbum","sourire de ton frere","sourire en face"],
    ar: "تبسمك في وجه أخيك" },
  { patterns: ["purete est la moitie","tahurul shatar","nettete moitie"],
    ar: "الطهور شطر الإيمان" },
  { patterns: ["vrai musulman","langue et sa main","langue et main","salam"],
    ar: "المسلم من سلم المسلمون من لسانه ويده" },
  { patterns: ["religion est conseil","nasihah","ad-dinu nasihah","din nasihah"],
    ar: "الدين النصيحة" },
  { patterns: ["honte est une branche","haya min al iman","pudeur branche"],
    ar: "الحياء من الإيمان" },
  { patterns: ["paradis sous les pieds","janna tahta aqdami","mere paradis pieds"],
    ar: "الجنة تحت أقدام الأمهات" },
  { patterns: ["aucun de vous ne croit","hatta yuhibba","aime pour son frere ce qu il"],
    ar: "لا يؤمن أحدكم حتى يحب لأخيه" },
  { patterns: ["misericorde","rahma","misericordieux"],
    ar: "الرحمة" },
  { patterns: ["foi","iman","croyance"],
    ar: "الإيمان" },
  { patterns: ["repentir","tawbah","repentance"],
    ar: "التوبة" },
  { patterns: ["patience","sabr"],
    ar: "الصبر" },
  { patterns: ["science","connaissance","savoir","ilm"],
    ar: "العلم" },
];

// ─── Normalisation FR (retire accents + minuscules) ────────────
function normFr(s) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// ═══════════════════════════════════════════════════════════════
// frToArFast — dictionnaire instantane (pas d IA)
// ═══════════════════════════════════════════════════════════════
function frToArFast(q) {
  // Si arabe direct → retourner les 4 premiers mots
  if (/[\u0600-\u06FF]/.test(q)) {
    return (q.match(/[\u0600-\u06FF]+/g) || []).slice(0, 4).join(" ");
  }

  const low = normFr(q);

  // Hadiths celebres (priorite absolue)
  for (const h of HADITHS_CELEBRES) {
    for (const p of h.patterns) {
      if (low.includes(normFr(p))) {
        console.log("DICT_CELEBRE_MATCH:", p, "->", h.ar);
        return h.ar;
      }
    }
  }

  return null; // → Haiku prendra le relai
}

// ═══════════════════════════════════════════════════════════════
// frToArHaiku — traduction litterale IA (fallback)
// ═══════════════════════════════════════════════════════════════
async function frToArHaiku(q) {
  try {
    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 60,
      system: SYSTEM_TARJAMA,
      messages: [{ role: "user", content: q }]
    });
    const ar = (resp.content[0]?.text || "").trim().replace(/["""''`]/g, "");
    console.log("HAIKU_TARJAMA:", q.substring(0, 50), "->", ar);
    return ar || q.trim().split(/\s+/).slice(0, 2).join(" ");
  } catch (e) {
    console.log("HAIKU_TARJAMA_ERR:", e.message);
    return q.trim().split(/\s+/).slice(0, 2).join(" ");
  }
}

function clean(s) {
  return (s || "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
}

// ═══════════════════════════════════════════════════════════════
// extractInfoValue — HTML Dorar confirme (logs 2026-03-13)
// ═══════════════════════════════════════════════════════════════
function extractInfoValue(html, label) {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // P1 : valeur dans <span> suivant
  let rx = new RegExp(esc + "[^<]*<\\/span>\\s*<span[^>]*>([^<]{1,300})<\\/span>");
  let m = html.match(rx);
  if (m && m[1].trim()) return m[1].trim();
  // P2 : texte brut apres </span>
  rx = new RegExp(esc + "[^<]*<\\/span>([^<]{1,200})");
  m = html.match(rx);
  if (m) {
    const v = m[1].trim().replace(/^[-:—\s]+/, "").trim();
    if (v.length >= 2) return v;
  }
  return "";
}

// ═══════════════════════════════════════════════════════════════
// parseHadiths — regex stricte class="hadith" (PAS hadith-info)
// ═══════════════════════════════════════════════════════════════
function parseHadiths(html) {
  const results = [];
  const RE_HADITH = /<div\s[^>]*class="hadith"[^>]*>([\s\S]*?)<\/div>/g;
  const RE_INFO   = /<div\s[^>]*class="hadith-info"[^>]*>([\s\S]*?)<\/div>/g;
  const matns = [], infos = [];
  let m;

  while ((m = RE_HADITH.exec(html)) !== null) {
    const text = m[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .replace(/^\s*\d+\s*[-–]\s*/, "")
      .trim();
    if (text.length >= 10) {
      matns.push(text);
      console.log("MATN[" + matns.length + "]:", text.substring(0, 70));
    }
  }
  while ((m = RE_INFO.exec(html)) !== null) infos.push(m[1]);

  console.log("MATNS_COUNT:", matns.length, "| INFOS_COUNT:", infos.length);

  const limit = Math.min(matns.length, 2);
  for (let i = 0; i < limit; i++) {
    const infoHtml = infos[i] || "";
    const grade  = extractInfoValue(infoHtml, "خلاصة حكم المحدث");
    const savant = extractInfoValue(infoHtml, "المحدث");
    const source = extractInfoValue(infoHtml, "المصدر");
    const rawi   = extractInfoValue(infoHtml, "الراوي");
    console.log("HADITH[" + i + "] GRADE:", grade || "(vide)", "| SAVANT:", savant || "(vide)");
    results.push({
      arabic_text: matns[i].substring(0, 1200),
      grade: grade || "غير محدد", savant, source, rawi,
      french_text: "", grade_explique: "", jarh_tadil: "", sanad_conditions: "", avis_savants: "", pertinence: ""
    });
  }

  // Fallback arabe brut
  if (results.length === 0) {
    console.log("FALLBACK: extraction arabe brute");
    const blks = html.match(/[\u0600-\u06FF][\u0600-\u06FF\s،؛,.!؟\u064B-\u065F]{30,600}/g) || [];
    for (const blk of blks.slice(0, 2)) {
      const text = blk.replace(/\s+/g, " ").trim();
      if (text.length >= 30)
        results.push({ arabic_text: text, grade: "غير محدد", savant: "", source: "", rawi: "",
          french_text: "", grade_explique: "", jarh_tadil: "", sanad_conditions: "", avis_savants: "", pertinence: "" });
    }
  }

  console.log("PARSED:", results.length, "hadiths");
  return results;
}

// ═══════════════════════════════════════════════════════════════
// fetchWithTimeout — compatible Node < 17.3
// ═══════════════════════════════════════════════════════════════
function fetchWithTimeout(url, options, ms) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

// ═══════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ═══════════════════════════════════════════════════════════════
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const q = req.body?.q || req.query?.q;
  if (!q) return res.status(400).json({ error: "Requete vide" });
  console.log("DEBUT_RECHERCHE — method:", req.method, "| q:", q);

  try {
    // ETAPE 1 : Traduction FR→AR
    let arabicQuery = frToArFast(q);
    if (!arabicQuery) arabicQuery = await frToArHaiku(q);
    console.log("QUERY_FINAL:", q.substring(0, 60), "->", arabicQuery);

    // ETAPE 2 : Dorar
    const dorarResp = await fetchWithTimeout(
      "https://dorar.net/dorar_api.json?skey=" + encodeURIComponent(arabicQuery),
      { headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://dorar.net/" } },
      8000
    );
    if (!dorarResp.ok) throw new Error("Dorar HTTP " + dorarResp.status);

    const dorarData = await dorarResp.json();
    console.log("DORAR_KEYS:", JSON.stringify(Object.keys(dorarData)));

    const html = dorarData?.ahadith?.result || "";
    console.log("HTML_LEN:", html.length);
    console.log("HTML_SAMPLE:", html.substring(0, 400));

    if (!html || html.length < 20) { console.log("DORAR_EMPTY"); return res.status(200).json([]); }

    // ETAPE 3 : Parsing
    const results = parseHadiths(html);
    if (!results.length) { console.log("PARSE_EMPTY"); return res.status(200).json([]); }

    // ETAPE 4 : Haiku — Takhrij + Jarh + Pertinence
    // On passe la requete originale pour evaluation de pertinence
    const textes =
      "REQUETE_ORIGINALE_UTILISATEUR: " + q + "\n\n" +
      results.map((r, i) =>
        "[" + i + "]\nMatn : " + r.arabic_text +
        "\nGrade : " + r.grade +
        "\nSavant : " + r.savant +
        "\nSource : " + r.source +
        "\nRawi : " + r.rawi
      ).join("\n\n");

    console.log("HAIKU_CALL: envoi", results.length, "hadith(s)");

    const promptFr = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      system: SYSTEM_TAKHRIJ,
      messages: [{ role: "user", content: textes }]
    });

    const rawText = promptFr.content[0]?.text || "";
    console.log("HAIKU_RAW:", rawText.substring(0, 400));

    // ETAPE 5 : Parse JSON
    const analyses = {};
    try {
      const stripped = rawText.replace(/```[a-z]*\n?/gi, "").trim();
      const match    = stripped.match(/\[[\s\S]*\]/);
      if (match) {
        JSON.parse(match[0]).forEach(item => {
          if (typeof item.i === "number") analyses[item.i] = item;
        });
      }
    } catch (e) { console.log("JSON_PARSE_ERR:", e.message); }

    // ETAPE 6 : Merge
    results.forEach((r, i) => {
      const a = analyses[i] || {};
      r.french_text      = clean(a.french_text)      || "Non documente";
      r.grade_explique   = clean(a.grade_explique)    || "Non documente";
      r.jarh_tadil       = clean(a.jarh_tadil)        || "Non documente";
      r.sanad_conditions = clean(a.sanad_conditions)  || "Non documente";
      r.avis_savants     = clean(a.avis_savants)      || "Non documente";
      r.pertinence       = clean(a.pertinence)        || "Non evalue";
    });

    console.log("SUCCESS:", results.length, "hadiths enrichis");
    return res.status(200).json(results);

  } catch (error) {
    console.log("ERROR:", error.message);
    return res.status(500).json({ error: error.message });
  }
};
