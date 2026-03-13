const Anthropic = require("@anthropic-ai/sdk");
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ═══════════════════════════════════════════════════════════════
// SYSTEM_TAKHRIJ — INTOUCHABLE (Constitution Al-Mizân)
// ═══════════════════════════════════════════════════════════════
const SYSTEM_TAKHRIJ =
  "Tu es un expert en sciences du Hadith selon la methodologie des Salaf As-Salih. " +
  "Lexique de Fer INTOUCHABLE : istawa = S est etabli | Yad Allah = La Main d Allah | " +
  "Nuzul = Descente | Wajh Allah = Le Visage d Allah. " +
  "Pour chaque hadith, produis un objet JSON avec ces 5 champs en francais : " +
  "french_text (traduction litterale du matn, Lexique de Fer strict, ZERO mot arabe translittere dans le texte francais), " +
  "grade_explique (verdict + savant + reference), " +
  "jarh_tadil (analyse rawi selon Ibn Hajar / Al-Dhahabi / Al-Albani), " +
  "sanad_conditions (Ittisal / Adala / Dabt / Shudhudh / Illa), " +
  "avis_savants (avis consolides avec references). " +
  "Reponds UNIQUEMENT avec un tableau JSON valide, zero backtick, zero texte autour : " +
  '[{"i":0,"french_text":"...","grade_explique":"...","jarh_tadil":"...","sanad_conditions":"...","avis_savants":"..."}]';

// ═══════════════════════════════════════════════════════════════
// DICT FR→AR (termes islamiques courants)
// ═══════════════════════════════════════════════════════════════
const DICT = {
  "intention":"النية","intentions":"النية","niya":"النية","foi":"الإيمان",
  "islam":"الإسلام","priere":"الصلاة","salat":"الصلاة","zakat":"الزكاة",
  "jeune":"الصيام","ramadan":"رمضان","hajj":"الحج","coran":"القرآن",
  "paradis":"الجنة","enfer":"النار","mort":"الموت","jugement":"القيامة",
  "prophete":"النبي","sunna":"السنة","hadith":"الحديث","sincere":"النصيحة",
  "sincerite":"الإخلاص","patience":"الصبر","gratitude":"الشكر","verite":"الصدق",
  "mensonge":"الكذب","honnete":"الأمانة","confiance":"التوكل","purification":"الطهارة",
  "ablution":"الوضوء","mosquee":"المسجد","aumone":"الصدقة","licite":"الحلال",
  "illicite":"الحرام","repentir":"التوبة","pardon":"المغفرة","misericorde":"الرحمة",
  "connaissance":"العلم","savoir":"العلم","savant":"العلم","bien":"الخير",
  "mal":"الشر","acte":"العمل","actes":"الأعمال","jour dernier":"يوم القيامة",
  "allah":"الله","dieu":"الله","ange":"الملائكة","destin":"القدر",
  "tawhid":"التوحيد","tawbah":"التوبة","dhikr":"الذكر","dua":"الدعاء",
  "wudu":"الوضوء","ghusl":"الغسل","tayammum":"التيمم","adhan":"الأذان",
  "sujud":"السجود","ruku":"الركوع","qiyam":"القيام","witr":"الوتر",
  "kibr":"الكبر","orgueil":"الكبر","hasad":"الحسد","jalousie":"الحسد",
  "ghiba":"الغيبة","namima":"النميمة","haya":"الحياء","pudeur":"الحياء",
  "zuhd":"الزهد","wara":"الورع","ihsan":"الإحسان","adl":"العدل",
  "nikah":"الزواج","mariage":"الزواج","divorce":"الطلاق","parents":"الوالدين",
  "mere":"الأم","pere":"الأب","orphelin":"اليتيم","voisin":"الجار",
  "fraternite":"الأخوة","amitie":"الصداقة","aumone obligatoire":"الزكاة"
};

function frToAr(q) {
  const low = q.toLowerCase().trim();
  // Essai multiword en priorité
  for (const [fr, ar] of Object.entries(DICT)) {
    if (fr.includes(" ") && low.includes(fr)) return ar;
  }
  // Puis mots simples
  for (const [fr, ar] of Object.entries(DICT)) {
    if (low.includes(fr)) return ar;
  }
  // Fallback : 2 premiers mots arabes si présents, sinon 2 premiers mots latins
  const arabicWords = q.match(/[\u0600-\u06FF]+/g);
  if (arabicWords) return arabicWords.slice(0, 2).join(" ");
  return q.trim().split(/\s+/).slice(0, 2).join(" ");
}

function clean(s) {
  return (s || "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
}

// ═══════════════════════════════════════════════════════════════
// extractInfoValue — CONSTRUIT sur la structure HTML Dorar CONFIRMÉE
//
// Structure réelle (logs Vercel 2026-03-13) :
//   <span class="info-subtitle">المحدث:</span> أحمد شاكر
//   <span class="info-subtitle">خلاصة حكم المحدث:</span>  <span >إسناده صحيح</span>
//
// Deux patterns :
//   P1 (grade) : LABEL</span> <span*>VALEUR</span>
//   P2 (autres): LABEL</span> TEXTE_BRUT
// ═══════════════════════════════════════════════════════════════
function extractInfoValue(html, label) {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // P1 : valeur dans un <span> séparé (grade)
  let rx = new RegExp(esc + "[^<]*<\\/span>\\s*<span[^>]*>([^<]{1,200})<\\/span>");
  let m = html.match(rx);
  if (m && m[1].trim()) return m[1].trim();

  // P2 : valeur en texte brut après </span>
  rx = new RegExp(esc + "[^<]*<\\/span>([^<]{1,200})");
  m = html.match(rx);
  if (m) {
    const v = m[1].trim().replace(/^[-:—\s]+/, "").trim();
    if (v.length >= 2) return v;
  }

  return "";
}

// ═══════════════════════════════════════════════════════════════
// parseHadiths — REÉCRIT depuis la structure HTML confirmée
//
// BUG RACINE IDENTIFIÉ :
//   class="hadith[^"]*" matchait AUSSI class="hadith-info"
//   → split créait 16 parts (hadith + hadith-info mélangés)
//   → les parts hadith-info écrasaient les slots valides
//   → PARSED: 0 dans tous les cas
//
// FIX : regex STRICTE class="hadith" (ancre sur le guillemet fermant)
//       Puis extraction de hadith-info en PARALLÈLE, appariement par index
// ═══════════════════════════════════════════════════════════════
function parseHadiths(html) {
  const results = [];

  // ── REGEX STRICTE : class="hadith" UNIQUEMENT (PAS hadith-info) ──
  // L'ancre `"` après hadith exclut hadith-info
  const RE_HADITH = /<div\s[^>]*class="hadith"[^>]*>([\s\S]*?)<\/div>/g;
  const RE_INFO   = /<div\s[^>]*class="hadith-info"[^>]*>([\s\S]*?)<\/div>/g;

  const matns = [];
  const infos = [];

  let m;
  while ((m = RE_HADITH.exec(html)) !== null) {
    // Strip HTML + strip numéro en début ("1 - ", "2 - ")
    const text = m[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .replace(/^\s*\d+\s*-\s*/, "")
      .trim();
    if (text.length >= 10) {
      matns.push(text);
      console.log("MATN[" + matns.length + "]:", text.substring(0, 60));
    }
  }

  while ((m = RE_INFO.exec(html)) !== null) {
    infos.push(m[1]);
  }

  console.log("MATNS_COUNT:", matns.length, "| INFOS_COUNT:", infos.length);

  const limit = Math.min(matns.length, 2); // MAX 2 hadiths
  for (let i = 0; i < limit; i++) {
    const infoHtml = infos[i] || "";

    const grade  = extractInfoValue(infoHtml, "خلاصة حكم المحدث");
    const savant = extractInfoValue(infoHtml, "المحدث");
    const source = extractInfoValue(infoHtml, "المصدر");
    const rawi   = extractInfoValue(infoHtml, "الراوي");

    console.log("HADITH[" + i + "] GRADE:", grade || "(vide)", "| SAVANT:", savant || "(vide)");

    results.push({
      arabic_text: matns[i].substring(0, 1200),
      grade:  grade  || "غير محدد",
      savant: savant || "",
      source: source || "",
      rawi:   rawi   || "",
      french_text: "", grade_explique: "", jarh_tadil: "", sanad_conditions: "", avis_savants: ""
    });
  }

  // ── Fallback : regex sur texte arabe brut si aucun matn trouvé ──
  if (results.length === 0) {
    console.log("FALLBACK: extraction arabe brute");
    const arabicBlocks = html.match(/[\u0600-\u06FF][\u0600-\u06FF\s،؛,.!؟\u064B-\u065F]{30,600}/g) || [];
    for (const blk of arabicBlocks.slice(0, 2)) {
      const text = blk.replace(/\s+/g, " ").trim();
      if (text.length >= 30) {
        console.log("FALLBACK_MATN:", text.substring(0, 60));
        results.push({
          arabic_text: text, grade: "غير محدد", savant: "", source: "", rawi: "",
          french_text: "", grade_explique: "", jarh_tadil: "", sanad_conditions: "", avis_savants: ""
        });
      }
    }
  }

  console.log("PARSED:", results.length, "hadiths");
  return results;
}

// ═══════════════════════════════════════════════════════════════
// fetchWithTimeout — compatible Node < 17.3 (pas d'AbortSignal.timeout)
// ═══════════════════════════════════════════════════════════════
function fetchWithTimeout(url, options, ms) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...options, signal: ctrl.signal })
    .finally(() => clearTimeout(timer));
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
    const isArabic = /[\u0600-\u06FF]/.test(q);
    const arabicQuery = isArabic ? q : frToAr(q);
    console.log("QUERY:", q, "->", arabicQuery);

    // ── Appel Dorar ─────────────────────────────────────────────
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
    console.log("HTML_SAMPLE:", html.substring(0, 500));

    if (!html || html.length < 20) {
      console.log("DORAR_EMPTY");
      return res.status(200).json([]);
    }

    // ── Parse ────────────────────────────────────────────────────
    const results = parseHadiths(html);

    if (!results.length) {
      console.log("PARSE_EMPTY — retour []");
      return res.status(200).json([]);
    }

    // ── Appel Haiku — Takhrij + Jarh wa Ta'dil ──────────────────
    const textes = results
      .map((r, i) =>
        "[" + i + "]\nMatn : " + r.arabic_text +
        "\nGrade : " + r.grade +
        "\nSavant : " + r.savant +
        "\nRawi : " + r.rawi
      )
      .join("\n\n");

    console.log("HAIKU_CALL: envoi", results.length, "hadith(s)");

    const promptFr = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: SYSTEM_TAKHRIJ,
      messages: [{ role: "user", content: textes }]
    });

    const rawText = promptFr.content[0]?.text || "";
    console.log("HAIKU_RAW:", rawText.substring(0, 300));

    // ── Parse JSON Haiku ─────────────────────────────────────────
    const analyses = {};
    try {
      // Strip backticks éventuels (au cas où Haiku les ajoute malgré la consigne)
      const stripped = rawText.replace(/```[a-z]*\n?/gi, "").trim();
      const match    = stripped.match(/\[[\s\S]*\]/);
      if (match) {
        JSON.parse(match[0]).forEach(item => {
          if (typeof item.i === "number") analyses[item.i] = item;
        });
      }
    } catch (e) {
      console.log("JSON_PARSE_ERR:", e.message, "| RAW:", rawText.substring(0, 200));
    }

    // ── Merge résultats ──────────────────────────────────────────
    results.forEach((r, i) => {
      const a = analyses[i] || {};
      r.french_text      = clean(a.french_text)      || "Non documente";
      r.grade_explique   = clean(a.grade_explique)    || "Non documente";
      r.jarh_tadil       = clean(a.jarh_tadil)        || "Non documente";
      r.sanad_conditions = clean(a.sanad_conditions)  || "Non documente";
      r.avis_savants     = clean(a.avis_savants)      || "Non documente";
    });

    console.log("SUCCESS:", results.length, "hadiths enrichis");
    return res.status(200).json(results);

  } catch (error) {
    console.log("ERROR:", error.message);
    return res.status(500).json({ error: error.message });
  }
};
