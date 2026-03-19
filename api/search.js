// ═══════════════════════════════════════════════════════════════════════════════
// MOTEUR MÎZÂN v18.6 — api/search.js — CommonJS
//
// BUGS CORRIGÉS :
//   ✅ ZÉRO duplicate module.exports (le debug endpoint a été supprimé)
//   ✅ Modèles : claude-3-5-sonnet-20240620 + claude-3-haiku-20240307
//   ✅ 9 champs JSON incluant isnad_chain (pour l'Arbre de Lumière)
//   ✅ 14 siècles de science dans le prompt
//   ✅ Compatible server.js (require) ET Vercel Serverless
// ═══════════════════════════════════════════════════════════════════════════════

const Anthropic = require("@anthropic-ai/sdk");
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

console.log("%c ✅ Mîzân v18.6 : Prêt pour Production", "color: #00ff00; font-weight: bold;");

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM_TAKHRIJ — 14 SIÈCLES · 9 CHAMPS · SCHOLAR-GLOW
// ═══════════════════════════════════════════════════════════════════════════════
const SYSTEM_PROMPT = `\
Tu es un MUHADDITH NUMERIQUE specialise en Takhrij et Jarh wa Ta dil.
Lexique de Fer : Istawa = S est etabli | Yad = Main d Allah | Nuzul = Descente | Wajh = Visage d Allah.

SOURCES — 14 SIECLES :
SAHABA (7e s.) : Umar, Ali, Aisha, Ibn Abbas, Abu Hurayra, Anas ibn Malik.
TABI IN (8e s.) : Said ibn al-Musayyab, al-Hasan al-Basri, Ibn Sirine, Mujahid.
IMAMS (8e-9e s.) : Malik, ash-Shafi i, Ahmad ibn Hanbal, al-Bukhari, Muslim, Abu Dawud, at-Tirmidhi, an-Nasa i, Ibn Majah, ad-Daraqutni.
HUFFADH (13e-15e s.) : Ibn Taymiyyah, Ibn al-Qayyim, adh-Dhahabi, an-Nawawi, Ibn Hajar al-Asqalani, Ibn Kathir.
CONTEMPORAINS (20e-21e s.) : Al-Albani (SS/SD), Ibn Baz, Ibn Uthaymin.

REGLE ABSOLUE : grade_explique DOIT refleter le Grade Dorar. ZERO inversion.
Si Al-Albani a un verdict -> le citer EN PREMIER avec reference SS/SD.

REPONDS UNIQUEMENT par un tableau JSON valide. ZERO texte avant/apres. ZERO backtick.
Format : [{"i":0, "french_text":"...", "grade_explique":"...", "isnad_chain":"...", "jarh_tadil":"...", "sanad_conditions":"...", "mutabaat":"...", "avis_savants":"...", "grille_albani":"...", "pertinence":"OUI|NON"}]

DETAILS DES 9 CHAMPS :
1. french_text : traduction litterale du matn. Min 3 phrases.
2. grade_explique : <b>Sources :</b> [recueils]<br><b>Cause :</b> [resume]<br><b>Sceau :</b> [Al-Albani SS/SD]<br><b>Statut :</b> [PEUT ETRE CITE / NE DOIT PAS ETRE PRATIQUE]
3. isnad_chain : FORMAT PIPE STRICT, \\n entre maillons :
   Maillon 1 | Nom complet (m.XXH) | Titre | Verdict | Siecle\\n
   Maillon 2 | ... (min 6 maillons, du Sahabi au contemporain)
   VERDICTS : Adul_par_Ijma | Thiqah_Thabt | Thiqah | Saduq | Da_if | Matruk
4. jarh_tadil : verdict Ibn Hajar + adh-Dhahabi + Al-Albani par rawi.
5. sanad_conditions : 5 conditions (Ittisal/Adala/Dabt/Shudhudh/Illa) avec ETABLI ou ABSENT.
6. mutabaat : autres chaines + shawahid + verdict de renfort.
7. avis_savants : 7 paragraphes couvrant les 14 siecles.
8. grille_albani : verdict Al-Albani + reference + methode.
9. pertinence : OUI | PARTIEL | NON.

HTML -> guillemets simples UNIQUEMENT. ZERO guillemets doubles dans les attributs HTML.`;

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITAIRES
// ═══════════════════════════════════════════════════════════════════════════════
function clean(s) {
  return (s || "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
}

function cleanIsnad(s) {
  if (!s) return "";
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, " ")
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function safeField(val, fallback) {
  const v = clean(val);
  return (v && v.length >= 5) ? v : (fallback || "Non disponible — consultez Dorar.net");
}

function extractInfoValue(html, label) {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rx1 = new RegExp(esc + "[^<]*<\\/span>\\s*<span[^>]*>([^<]{1,300})<\\/span>");
  const m1 = html.match(rx1);
  if (m1 && m1[1].trim()) return m1[1].trim();
  const rx2 = new RegExp(esc + "[^<]*<\\/span>([^<]{1,200})");
  const m2 = html.match(rx2);
  if (m2) { const v = m2[1].trim().replace(/^[-:—\s]+/, "").trim(); if (v.length >= 2) return v; }
  return "";
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRADUCTION FR → AR
// ═══════════════════════════════════════════════════════════════════════════════
async function translateToArabic(query) {
  if (/[\u0600-\u06FF]/.test(query)) {
    return (query.match(/[\u0600-\u06FF\s]+/g) || []).join(" ").trim().split(/\s+/).slice(0, 6).join(" ") || query;
  }
  try {
    const resp = await client.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 80,
      temperature: 0,
      system: "Tu es un traducteur. Reponds UNIQUEMENT avec les mots arabes. Zero explication.",
      messages: [{ role: "user", content: query.trim() }]
    });
    const raw = (resp.content[0]?.text || "").trim();
    const arOnly = raw.replace(/[a-zA-Z`'"*_#\[\]()0-9\-]/g, " ").replace(/\s+/g, " ").trim();
    if (/[\u0600-\u06FF]/.test(arOnly) && arOnly.length >= 2) return arOnly.split(/\s+/).slice(0, 8).join(" ");
    return query.trim();
  } catch (e) {
    console.log("TRADUCTEUR_ERR:", e.message);
    return query.trim();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARSE DORAR HTML
// ═══════════════════════════════════════════════════════════════════════════════
function parseDorar(html) {
  if (!html || html.length < 20) return [];
  const results = [];
  const seen = new Set();

  // Stratégie 1 : blocs <div class="hadith...">
  const segments = html.split(/<div[^>]*class="hadith[^"]*"[^>]*>/i);
  const infoSegs = html.split(/<div[^>]*class="hadith-info[^"]*"[^>]*>/i);

  for (let i = 1; i < segments.length && results.length < 1; i++) {
    const text = segments[i].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").replace(/^\s*\d+\s*[-–]\s*/, "").trim();
    if (text.length < 10) continue;
    const norm = text.replace(/[\u064B-\u065F\u0670\u060C\u061B\u061F.,!?;:()\[\]{}"'\s]/g, "");
    if (seen.has(norm)) continue;
    seen.add(norm);

    const info = (infoSegs[i] || "").substring(0, 2000);
    results.push({
      arabic_text: text.substring(0, 1200),
      grade: extractInfoValue(info, "خلاصة حكم المحدث") || "غير محدد",
      savant: extractInfoValue(info, "المحدث"),
      source: extractInfoValue(info, "المصدر"),
      rawi: extractInfoValue(info, "الراوي"),
      french_text: "", grade_explique: "", isnad_chain: "",
      jarh_tadil: "", sanad_conditions: "", mutabaat: "",
      avis_savants: "", grille_albani: "", pertinence: ""
    });
  }

  // Stratégie 2 : regex fallback
  if (!results.length) {
    const blks = html.match(/[\u0600-\u06FF][\u0600-\u06FF\s،؛,.!؟\u064B-\u065F]{30,600}/g) || [];
    for (const blk of blks) {
      if (results.length >= 1) break;
      const text = blk.replace(/\s+/g, " ").trim();
      if (text.length >= 30) {
        results.push({
          arabic_text: text, grade: "غير محدد", savant: "", source: "", rawi: "",
          french_text: "", grade_explique: "", isnad_chain: "",
          jarh_tadil: "", sanad_conditions: "", mutabaat: "",
          avis_savants: "", grille_albani: "", pertinence: ""
        });
      }
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYSE IA — TAKHRIJ COMPLET (9 champs)
// ═══════════════════════════════════════════════════════════════════════════════
async function analyserHadiths(results, query) {
  const textes = results.map(function(r, i) {
    return "[" + i + "]\nRequete: " + query +
      "\nMatn: " + r.arabic_text +
      "\nGrade Dorar: " + r.grade +
      "\nSavant: " + (r.savant || "non precise") +
      "\nSource: " + (r.source || "non precise") +
      "\nRawi: " + (r.rawi || "non precise");
  }).join("\n\n");

  try {
    const resp = await client.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 3500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: "Genere le Takhrij complet :\n\n" + textes }]
    });

    const raw = resp.content[0]?.text || "";
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      const arr = JSON.parse(match[0]);
      arr.forEach(function(item) {
        if (typeof item.i === "number" && results[item.i]) {
          const r = results[item.i];
          r.french_text      = safeField(item.french_text);
          r.grade_explique   = safeField(item.grade_explique);
          r.isnad_chain      = cleanIsnad(item.isnad_chain || "");
          r.jarh_tadil       = safeField(item.jarh_tadil);
          r.sanad_conditions = safeField(item.sanad_conditions);
          r.mutabaat         = safeField(item.mutabaat, "Voies de renfort non analysees.");
          r.avis_savants     = safeField(item.avis_savants);
          r.grille_albani    = safeField(item.grille_albani, "Consultez la Silsilah d Al-Albani.");
          r.pertinence       = /^OUI/i.test(item.pertinence || "") ? "OUI" :
                               /^PARTIEL/i.test(item.pertinence || "") ? "PARTIEL" : "NON";
        }
      });
    }
  } catch (e) {
    console.log("ANALYSE_ERR:", e.message);
    // Les champs restent vides — le frontend affichera le fallback
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL — l'UNIQUE module.exports
// ═══════════════════════════════════════════════════════════════════════════════
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  if (req.method === "OPTIONS") return res.status(200).end();

  // ── Extraction du query — compatible server.js ET Vercel ──
  const parsedUrl = new URL(req.url || "/", "http://localhost");
  const q = req.body?.q || req.query?.q || parsedUrl.searchParams.get("q");
  if (!q) return res.status(400).json({ error: "Requete vide" });
  console.log("MIZAN v18.6 — q:", q);

  try {
    // ÉTAPE 1 : Traduction FR → AR
    const arabicQuery = await translateToArabic(q);
    console.log("ARABIC:", arabicQuery);

    // ÉTAPE 2 : Dorar.net — new URL() (zéro url.parse)
    const dorarUrl = new URL("https://dorar.net/dorar_api.json");
    dorarUrl.searchParams.set("skey", arabicQuery);

    const ctrl = new AbortController();
    const timeout = setTimeout(function() { ctrl.abort(); }, 9000);
    const dorarResp = await fetch(dorarUrl.href, {
      headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://dorar.net/" },
      signal: ctrl.signal
    }).finally(function() { clearTimeout(timeout); });

    if (!dorarResp.ok) throw new Error("Dorar HTTP " + dorarResp.status);
    const dorarData = await dorarResp.json();
    const html = dorarData?.ahadith?.result || "";
    console.log("DORAR_HTML:", html.length, "chars");

    // ÉTAPE 3 : Parse
    const results = parseDorar(html);
    if (!results.length) return res.status(200).json([]);
    console.log("PARSED:", results.length, "hadith(s)");

    // ÉTAPE 4 : Takhrij IA (9 champs)
    await analyserHadiths(results, q);
    console.log("ANALYSE OK — isnad:", (results[0]?.isnad_chain || "").length, "chars");

    return res.status(200).json(results);

  } catch (error) {
    console.log("SEARCH_ERROR:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

// ── maxDuration pour Vercel Serverless ──
module.exports.maxDuration = 60;
