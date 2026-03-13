// Vercel max duration — obligatoire pour Hobby/Pro avec fonctions longues
export const maxDuration = 60;

const Anthropic = require("@anthropic-ai/sdk");
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ═══════════════════════════════════════════════════════════════
// SYSTEM_TAKHRIJ v6 — Parallele | grille_albani | HTML couleurs
// UN SEUL hadith par appel — budget token maximal pour chaque
// ═══════════════════════════════════════════════════════════════
// SYSTEM_TAKHRIJ v7 — BLINDAGE MATN RECONNU
const SYSTEM_TAKHRIJ =
  "Tu es un Hafidh expert en Takhrij et Jarh wa Ta'dil selon Ibn Hajar, Al-Dhahabi, Al-Albani. " +
  "Tu recois UN SEUL hadith. Tu produis UN SEUL objet JSON valide. " +
  "Tu analyses le MATN ARABE fourni — jamais la requete utilisateur. " +

  "PROTOCOLE MATN RECONNU — PRIORITE ABSOLUE : " +
  "Si le matn arabe correspond a un hadith connu du corpus sunnite (ex: إنما الأعمال بالنيات, " +
  "الحلال بيّن, لا يؤمن أحدكم, الطهور شطر الإيمان, ou tout autre hadith des Kutub al-Sittah), " +
  "tu DOIS exploiter integralement ta connaissance de ce hadith. " +
  "INTERDICTION ABSOLUE d invoquer un manque d information sur un hadith mashhur ou mutawatir. " +
  "Le champ french_text ne peut JAMAIS contenir 'n a pas pu etre etablie'. " +
  "Le champ grade_explique ne peut JAMAIS contenir 'n a pas ete determine'. " +
  "Le champ pertinence ne peut JAMAIS contenir 'Non evalue'. " +
  "Si tu reconnais le matn : extrais immediatement la reference exacte (Bukhari, Muslim, no. precis), " +
  "le verdict Al-Albani avec numero SS ou SD, et les rawis principaux avec leur tarjama Ibn Hajar. " +

  "INTERDICTIONS GENERALES : " +
  "zero champ vide | zero 'Non documente' seul | zero translitteration dans french_text | " +
  "zero repetition de la requete utilisateur dans french_text | " +
  "zero phrase de repli si le hadith est identifiable. " +

  "LEXIQUE DE FER — pour french_text ET jarh_tadil : " +
  "istawa = S est etabli sur | Yad Allah = La Main d Allah | " +
  "Nuzul = La Descente | Wajh Allah = Le Visage d Allah | " +
  "Thiqah = garant fiable | Sadouq = veridique | Da'if = faible | " +
  "Matruk = abandonne | Kadhdhab = grand menteur | Illah = defaut cache | " +
  "Inqita = rupture de chaine | Tadlis = dissimulation | Mudtarib = contradictoire. " +

  "CHAMP french_text : " +
  "Traduction COMPLETE, LITTERALE, SOLENNELLE du matn arabe. Minimum 3 phrases. " +
  "Style classique digne d un texte sacre. Chaque element du matn traduit. " +
  "Utilise <span style=\'color:#e8c96a;font-weight:bold;\'>NOM_DU_PROPHETE</span> " +
  "pour mettre en valeur les noms propres importants. " +

  "CHAMP grade_explique : " +
  "Format : <span style=\'color:[COULEUR];font-weight:bold;\'>[VERDICT]</span> — [Savant], [Ouvrage], [no.]. " +
  "Couleurs : #2ecc71=SAHIH | #f39c12=HASAN | #e74c3c=DA\'IF | #8e44ad=MAWDU. " +
  "Exemple : <span style=\'color:#2ecc71;font-weight:bold;\'>SAHIH</span> — Al-Bukhari, Al-Jami al-Sahih, no. 1. " +

  "CHAMP jarh_tadil : " +
  "Analyse nominative de 2 rawis minimum de la chaine de transmission. " +
  "Format : <span style=\'color:#5dade2;font-weight:bold;\'>[NOM_RAWI]</span> : [verdict Ibn Hajar, Taqrib] — [Al-Dhahabi, Mizan si different]. " +
  "Identifie l Illah si hadith faible. " +

  "CHAMP sanad_conditions : " +
  "Les 5 conditions Ibn al-Salah (Muqaddimah) : " +
  "1.Ittisal 2.Adala 3.Dabt 4.Shudhudh(absent) 5.Illah(absente). " +
  "Conclure : <span style=\'color:#2ecc71;\'>TOUTES REMPLIES</span> " +
  "ou <span style=\'color:#e74c3c;\'>[CONDITION X] DEFAILLANTE</span>. " +

  "CHAMP avis_savants : 3 paragraphes obligatoires. " +
  "P1 : Muhaddithin classiques (Al-Bukhari, Muslim, Ahmad, Ibn Khuzaymah). " +
  "P2 : Ibn Hajar (Fath al-Bari / Bulugh) + Al-Dhahabi (Talkhis / Mizan). " +
  "P3 : Al-Albani — cite son verdict avec numero Silsilah Sahihah ou Da'ifah. " +
  "Si DA\'IF ou MAWDU : <span style=\'color:#e74c3c;font-weight:bold;\'>AVERTISSEMENT</span> " +
  "+ interdiction de citation sans reserve. " +

  "CHAMP grille_albani : " +
  "Grille exclusive d Al-Albani sur ce hadith. " +
  "Cite le numero exact dans Silsilah Sahihah (SS) ou Da'ifah (SD). " +
  "Reproduis le raisonnement d Al-Albani : methode de Tashih ou Ta'dif, " +
  "rawis qu il a evalues, divergence avec d autres savants si existante. " +
  "Format : <span style=\'color:#f39c12;font-weight:bold;\'>Al-Albani :</span> [analyse]. " +

  "CHAMP pertinence : OUI/PARTIEL/NON uniquement — zero phrase, zero explication dans ce champ. " +

  "REGLE ABSOLUE DE FORMAT — VIOLATION = ECHEC TOTAL : " +
  "Ta reponse doit commencer par { et finir par }. " +
  "ZERO texte avant le {. ZERO texte apres le }. " +
  "ZERO bonjour. ZERO introduction. ZERO explication. ZERO backtick. ZERO markdown. " +
  "COMMENCE TA REPONSE PAR { ET TERMINE PAR } — RIEN D'AUTRE. " +
  '{"i":0,"french_text":"...","grade_explique":"...","jarh_tadil":"...","sanad_conditions":"...","avis_savants":"...","grille_albani":"...","pertinence":"..."}';

// ═══════════════════════════════════════════════════════════════
// SYSTEM_TARJAMA — Haiku traducteur FR→AR (prompt minimal)
// ═══════════════════════════════════════════════════════════════
const SYSTEM_TARJAMA =
  "Convertis en arabe pour recherche Dorar.net. " +
  "Si citation de hadith connue : retourne le debut exact du matn arabe. " +
  "Ex: 'les actes ne valent que par les intentions' -> إنما الأعمال بالنيات. " +
  "Si theme general : mot arabe principal uniquement. " +
  "UNIQUEMENT le texte arabe. Maximum 8 mots. Zero explication.";

// ═══════════════════════════════════════════════════════════════
// HADITHS_CELEBRES — court-circuit prioritaire zero latence
// ═══════════════════════════════════════════════════════════════
const HADITHS_CELEBRES = [
  { p: ["innamal","a'mal","niyyat","niyyah","actes ne valent","valent par les int",
        "homme n a que","chaque homme","intention","a3mal","binniyyat"],
    ar: "إنما الأعمال بالنيات" },
  { p: ["halal est clair","haram est clair","choses douteuses","halal bayyin"],
    ar: "الحلال بيّن والحرام بيّن" },
  { p: ["jibril","piliers de l islam","islam iman ihsan","arkan"],
    ar: "ما الإسلام" },
  { p: ["facilitez","yassiru","ne compliquez pas"],
    ar: "يسروا ولا تعسروا" },
  { p: ["purete est la moitie","tahurul shatar"],
    ar: "الطهور شطر الإيمان" },
  { p: ["vrai musulman","langue et sa main","salam al muslim"],
    ar: "المسلم من سلم المسلمون من لسانه ويده" },
  { p: ["religion est conseil","nasihah","ad-dinu nasihah"],
    ar: "الدين النصيحة" },
  { p: ["honte est une branche","haya min al iman","pudeur branche"],
    ar: "الحياء من الإيمان" },
  { p: ["paradis sous les pieds","mere paradis pieds"],
    ar: "الجنة تحت أقدام الأمهات" },
  { p: ["aucun de vous ne croit","hatta yuhibba","aime pour son frere"],
    ar: "لا يؤمن أحدكم حتى يحب لأخيه" },
  { p: ["sourire est une","sourire de ton frere"],
    ar: "تبسمك في وجه أخيك" },
  { p: ["misericorde","rahma","misericordieux"],
    ar: "الرحمة" },
  { p: ["patience","sabr"],          ar: "الصبر" },
  { p: ["repentir","tawbah"],        ar: "التوبة" },
  { p: ["science","connaissance","ilm"], ar: "العلم" },
  { p: ["foi","iman","croyance"],    ar: "الإيمان" },
  { p: ["priere","salat","namaz"],   ar: "الصلاة" },
  { p: ["jeune","siyam","ramadan"],  ar: "الصيام" },
  { p: ["aumone","sadaqa","zakat"],  ar: "الصدقة" },
  { p: ["pardon","maghfirah"],       ar: "المغفرة" },
  { p: ["orgueil","kibr"],           ar: "الكبر" },
  { p: ["jalousie","hasad"],         ar: "الحسد" },
  { p: ["medisance","ghiba"],        ar: "الغيبة" },
  { p: ["pudeur","haya"],            ar: "الحياء" },
  { p: ["sincerite","ikhlas"],       ar: "الإخلاص" },
  { p: ["parents","walidayn","mere","pere"], ar: "الوالدين" },
  { p: ["mariage","nikah"],          ar: "الزواج" },
  { p: ["mort","mawt"],              ar: "الموت" },
  { p: ["paradis","janna"],          ar: "الجنة" },
  { p: ["enfer","jahannam"],         ar: "النار" },
];

function normFr(s) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function frToArFast(q) {
  if (/[\u0600-\u06FF]/.test(q))
    return (q.match(/[\u0600-\u06FF]+/g) || []).slice(0, 4).join(" ");
  const low = normFr(q);
  for (const h of HADITHS_CELEBRES)
    for (const p of h.p)
      if (low.includes(normFr(p))) {
        console.log("DICT_CELEBRE_MATCH:", p, "->", h.ar);
        return h.ar;
      }
  return null;
}

async function frToArHaiku(q) {
  try {
    const r = await client.messages.create({
      model: "claude-haiku-4-5-20251001", max_tokens: 60,
      system: SYSTEM_TARJAMA,
      messages: [{ role: "user", content: q }]
    });
    const ar = (r.content[0]?.text || "").trim().replace(/["""''`]/g, "");
    console.log("HAIKU_TARJAMA:", q.substring(0, 50), "->", ar);
    return ar || q.trim().split(/\s+/).slice(0, 2).join(" ");
  } catch (e) {
    console.log("HAIKU_TARJAMA_ERR:", e.message);
    return q.trim().split(/\s+/).slice(0, 2).join(" ");
  }
}

// ═══════════════════════════════════════════════════════════════
// extractJSON — INCASSABLE
// Trouve le JSON meme si : texte avant/apres | backticks | JSON partiel
// ═══════════════════════════════════════════════════════════════
function extractJSON(text) {
  if (!text) return null;

  // Etape 1 : strip backticks
  let t = text.replace(/```[a-z]*\n?/gi, "").trim();

  // Etape 2 : tenter parse direct
  try { return JSON.parse(t); } catch (_) {}

  // ⛔️ SANCTUAIRE AL-MIZÂN : EXTRACTEUR JSON (NE JAMAIS MODIFIER)
  // Le prompt v7 génère un objet {}. La recherche de tableau [] brise le système.
  // EXTRACT_JSON_OBJET_UNIQUE — SYSTEM_TAKHRIJ v7 produit {}, pas []
  // Etape 3 : chercher un objet JSON { } en priorite
  const mObj = t.match(/\{[\s\S]*\}/);
  if (mObj) {
    try { return JSON.parse(mObj[0]); } catch (_) {}
  }

  // Etape 4 : fallback tableau legacy (retro-compatibilite)
  const mArr = t.match(/\[[\s\S]*\]/);
  if (mArr) {
    try { return JSON.parse(mArr[0]); } catch (_) {}
  }

  // Etape 5 : objet tronque — reconstruction jusqu a la derniere accolade complete
  const start = t.indexOf("{");
  if (start === -1) return null;

  let depth = 0, lastComplete = -1;
  for (let i = start; i < t.length; i++) {
    if (t[i] === "{") depth++;
    if (t[i] === "}") { depth--; if (depth === 0) lastComplete = i; }
  }

  if (lastComplete > start) {
    try { return JSON.parse(t.substring(start, lastComplete + 1)); } catch (_) {}
  }
  // ⛔️ FIN DU SANCTUAIRE

  console.log("EXTRACT_JSON_FAILED: impossible de recuperer le JSON");
  return null;
}

// ═══════════════════════════════════════════════════════════════
// VALEURS PAR DEFAUT — jamais de champ vide dans la reponse finale
// ═══════════════════════════════════════════════════════════════
const DEFAULTS = {
  french_text:
    "La traduction de ce texte n a pas pu etre etablie par le systeme d analyse. " +
    "Veuillez consulter un traducteur specialise en textes hadithiques classiques " +
    "ou vous referer a la source originale sur Dorar.net.",
  grade_explique:
    "Le verdict authentificationnel de ce hadith n a pas ete determine avec certitude. " +
    "Consultez les ouvrages de Takhrij : Silsilah Sahihah et Da'ifah d Al-Albani, " +
    "ou le Mustadrak d Al-Hakim avec le Talkhis d Al-Dhahabi.",
  jarh_tadil:
    "L analyse des transmetteurs de cette chaine n a pas pu etre completee. " +
    "Referez-vous au Taqrib al-Tahdhib d Ibn Hajar al-Asqalani " +
    "et au Mizan al-I'tidal d Al-Dhahabi pour les verdicts sur les rawis.",
  sanad_conditions:
    "La verification des 5 conditions du hadith Sahih (Ibn al-Salah, Muqaddimah) " +
    "n a pas pu etre menee a terme pour cette chaine de transmission. " +
    "Une etude approfondie du sanad original est necessaire.",
  avis_savants:
    "Les avis des savants n ont pas pu etre collectes pour ce hadith. " +
    "Consultez : Fath al-Bari d Ibn Hajar, Sharh Sahih Muslim d Al-Nawawi, " +
    "et les travaux d Al-Albani dans la Silsilah pour une analyse complete.",
  pertinence: "Non evalue — relancez la recherche avec un terme plus specifique."
};

function clean(s) {
  return (s || "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
}

function safeField(value, key) {
  const v = clean(value);
  return (v && v.length >= 10) ? v : DEFAULTS[key];
}

// ═══════════════════════════════════════════════════════════════
// extractInfoValue — HTML Dorar confirme (logs 2026-03-13)
// ═══════════════════════════════════════════════════════════════
function extractInfoValue(html, label) {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let rx = new RegExp(esc + "[^<]*<\\/span>\\s*<span[^>]*>([^<]{1,300})<\\/span>");
  let m = html.match(rx);
  if (m && m[1].trim()) return m[1].trim();
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
      .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")
      .replace(/^\s*\d+\s*[-–]\s*/, "").trim();
    if (text.length >= 10) {
      matns.push(text);
      console.log("MATN[" + matns.length + "]:", text.substring(0, 70));
    }
  }
  while ((m = RE_INFO.exec(html)) !== null) infos.push(m[1]);

  console.log("MATNS_COUNT:", matns.length, "| INFOS_COUNT:", infos.length);

  const limit = Math.min(matns.length, 2);
  for (let i = 0; i < limit; i++) {
    const inf   = infos[i] || "";
    const grade = extractInfoValue(inf, "خلاصة حكم المحدث");
    const savant= extractInfoValue(inf, "المحدث");
    const source= extractInfoValue(inf, "المصدر");
    const rawi  = extractInfoValue(inf, "الراوي");
    console.log("HADITH[" + i + "] GRADE:", grade || "(vide)", "| SAVANT:", savant || "(vide)");
    results.push({
      arabic_text: matns[i].substring(0, 1200),
      grade: grade || "غير محدد", savant, source, rawi,
      french_text: "", grade_explique: "", jarh_tadil: "",
      sanad_conditions: "", avis_savants: "", pertinence: ""
    });
  }

  if (results.length === 0) {
    console.log("FALLBACK: arabe brut");
    const blks = html.match(/[\u0600-\u06FF][\u0600-\u06FF\s،؛,.!؟\u064B-\u065F]{30,600}/g) || [];
    for (const blk of blks.slice(0, 2)) {
      const text = blk.replace(/\s+/g, " ").trim();
      if (text.length >= 30)
        results.push({ arabic_text: text, grade: "غير محدد", savant: "", source: "", rawi: "",
          french_text: "", grade_explique: "", jarh_tadil: "",
          sanad_conditions: "", avis_savants: "", pertinence: "" });
    }
  }

  console.log("PARSED:", results.length, "hadiths");
  return results;
}

function fetchWithTimeout(url, options, ms) {
  const ctrl = new AbortController();
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
    // ETAPE 1 : FR→AR
    let arabicQuery = frToArFast(q);
    const src = arabicQuery ? "DICT_FAST" : "HAIKU_TARJAMA";
    if (!arabicQuery) arabicQuery = await frToArHaiku(q);
    console.log("ARABIC_QUERY_SOURCE:", src);
    console.log("ARABIC_QUERY_VALUE:", arabicQuery);

    // ETAPE 2 : Dorar
    const dorarResp = await fetchWithTimeout(
      "https://dorar.net/dorar_api.json?skey=" + encodeURIComponent(arabicQuery),
      { headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://dorar.net/" } },
      8000
    );
    if (!dorarResp.ok) throw new Error("Dorar HTTP " + dorarResp.status);

    const dorarData = await dorarResp.json();
    const html = dorarData?.ahadith?.result || "";
    console.log("HTML_LEN:", html.length);
    console.log("HTML_SAMPLE:", html.substring(0, 400));
    if (!html || html.length < 20) { console.log("DORAR_EMPTY"); return res.status(200).json([]); }

    // ETAPE 3 : Parse
    const results = parseHadiths(html);
    if (!results.length) { console.log("PARSE_EMPTY"); return res.status(200).json([]); }
    console.log("MATN_0:", results[0].arabic_text.substring(0, 120));
    console.log("GRADE_0:", results[0].grade, "| SAVANT_0:", results[0].savant);

    // ETAPE 4 : TRAITEMENT PARALLELE — 1 appel API par hadith (Promise.all)
    // Chaque appel est isole : si hadith[1] echoue, hadith[0] reste intact
    console.log("PARALLEL_CALL: lancement", results.length, "appels simultanees");

    async function analyserUnHadith(r, idx) {
      const prompt =
        "REQUETE_ORIGINALE_UTILISATEUR: " + q + "\n\n" +
        "[" + idx + "]\n" +
        "Matn : " + r.arabic_text + "\n" +
        "Grade : " + r.grade + "\n" +
        "Savant : " + r.savant + "\n" +
        "Source : " + r.source + "\n" +
        "Rawi : " + r.rawi;

      // ⛔️ SANCTUAIRE AL-MIZÂN : SÉCURITÉ SDK ANTHROPIC (NE JAMAIS MODIFIER)
      // INTERDICTION ABSOLUE de placer 'signal' ou 'AbortController' dans les paramètres ici. Cela provoque une erreur 400 fatale.
      // ABORT_CONTROLLER_SUPPRIME — signal non supporte par SDK Anthropic (400 Extra inputs)
      // Vercel coupe a 60s — le maxDuration=60 suffit comme garde-fou
      const timer = null;

      try {
        const resp = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 4096,
          system: SYSTEM_TAKHRIJ,
          messages: [{ role: "user", content: prompt }]
        });
        const rawText = resp.content[0]?.text || "";
        console.log("HADITH[" + idx + "]_RAW_LEN:", rawText.length);
        console.log("HADITH[" + idx + "]_RAW:", rawText.substring(0, 300));

        // extractJSON attend un objet unique (pas un tableau) — on adapte
        let parsed = extractJSON(rawText);
        // Si extractJSON retourne un tableau, prendre le premier element
        if (Array.isArray(parsed)) parsed = parsed[0] || null;
        console.log("HADITH[" + idx + "]_PARSE:", parsed ? "OK" : "ECHEC");
        return parsed;
      } catch (e) {
        console.log("HADITH[" + idx + "]_ERR:", e.message);
        return null; // isolation : l autre hadith continue
      }
      // ⛔️ FIN DU SANCTUAIRE
    }

    // Lancement simultane — resilience totale par isolation
    const analysesArray = await Promise.all(
      results.map((r, i) => analyserUnHadith(r, i))
    );
    console.log("PARALLEL_DONE:", analysesArray.filter(Boolean).length, "succes /", results.length);

    // ETAPE 5+6 : Merge avec valeurs par defaut incassables
    results.forEach((r, i) => {
      const a = analysesArray[i] || {};
      r.french_text      = safeField(a.french_text,      "french_text");
      r.grade_explique   = safeField(a.grade_explique,   "grade_explique");
      r.jarh_tadil       = safeField(a.jarh_tadil,       "jarh_tadil");
      r.sanad_conditions = safeField(a.sanad_conditions, "sanad_conditions");
      r.avis_savants     = safeField(a.avis_savants,     "avis_savants");
      r.grille_albani    = safeField(a.grille_albani,    "avis_savants"); // fallback sur avis
      r.pertinence       = safeField(a.pertinence,       "pertinence");
    });

    console.log("SUCCESS:", results.length, "hadiths enrichis");
    return res.status(200).json(results);

  } catch (error) {
    console.log("ERROR:", error.message);
    return res.status(500).json({ error: error.message });
  }
};
