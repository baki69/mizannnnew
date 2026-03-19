/*******************************************************************
 * LOI D'AIRAIN VERCEL & NODE.JS - NE JAMAIS MODIFIER
 * 1. CommonJS strict (require / module.exports). ZERO ESM.
 * 2. package.json : ZERO "type": "module", engines "node": "20.x"
 * 3. .vercelignore avec "server.js" a la racine
 *******************************************************************/

// ═══════════════════════════════════════════════════════════════════════════════
// MOTEUR MIZAN v18.6 — api/search.js — CommonJS — SSE STREAMING
//
//   Modele   : claude-3-haiku-20240307 (traducteur + analyse)
//   Tokens   : 2500 — Jarh Mufassar integral
//   Timeout  : 45s interne (Promise.race) — resultats partiels si depasse
//   Flux     : SSE (text/event-stream) avec signal done obligatoire
//   Compat   : server.js (require) + Vercel Serverless
// ═══════════════════════════════════════════════════════════════════════════════

const Anthropic = require("@anthropic-ai/sdk");
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT — 14 SIECLES · 9 CHAMPS
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

REPONDS UNIQUEMENT par un objet JSON valide. ZERO texte avant/apres. ZERO backtick.
Premier caractere = {. Dernier caractere = }.
Format :
{
  "french_text": "...",
  "grade_explique": "...",
  "isnad_chain": "Maillon 1 | Nom (m.XXH) | Titre | Verdict | Siecle\\nMaillon 2 | ...",
  "jarh_tadil": "...",
  "sanad_conditions": "...",
  "mutabaat": "...",
  "avis_savants": "...",
  "grille_albani": "...",
  "pertinence": "OUI|NON"
}

DETAILS DES 9 CHAMPS :
1. french_text : traduction litterale du matn. Min 3 phrases.
2. grade_explique : <b>Sources :</b> [recueils]<br><b>Cause :</b> [resume]<br><b>Sceau :</b> [Al-Albani SS/SD]<br><b>Statut :</b> [PEUT ETRE CITE / NE DOIT PAS ETRE PRATIQUE]
3. isnad_chain : FORMAT PIPE \\n STRICT. Min 6 maillons du Sahabi au contemporain.
   VERDICTS : Adul_par_Ijma | Thiqah_Thabt | Thiqah | Saduq | Da_if | Matruk
4. jarh_tadil : verdict Ibn Hajar + adh-Dhahabi + Al-Albani par rawi.
5. sanad_conditions : 5 conditions (Ittisal/Adala/Dabt/Shudhudh/Illa) avec ETABLI ou ABSENT.
6. mutabaat : autres chaines + shawahid + verdict de renfort.
7. avis_savants : commentaires couvrant les 14 siecles.
8. grille_albani : verdict Al-Albani + reference + methode.
9. pertinence : OUI | PARTIEL | NON.

HTML -> guillemets simples UNIQUEMENT.`;

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
  return (v && v.length >= 5) ? v : (fallback || "Non disponible");
}

function extractInfoValue(html, label) {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rx1 = new RegExp(esc + "[^<]*<\\/span>\\s*<span[^>]*>([^<]{1,300})<\\/span>");
  const m1 = html.match(rx1);
  if (m1 && m1[1].trim()) return m1[1].trim();
  const rx2 = new RegExp(esc + "[^<]*<\\/span>([^<]{1,200})");
  const m2 = html.match(rx2);
  if (m2) { const v = m2[1].trim().replace(/^[-:\u2014\s]+/, "").trim(); if (v.length >= 2) return v; }
  return "";
}

// ═══════════════════════════════════════════════════════════════════════════════
// SSE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
function sseWrite(res, event, data) {
  res.write("event: " + event + "\ndata: " + JSON.stringify(data) + "\n\n");
  if (typeof res.flush === "function") res.flush();
}

function sseStatus(res, id) {
  res.write("event: status\ndata: " + JSON.stringify(id) + "\n\n");
  if (typeof res.flush === "function") res.flush();
  console.log("SSE_STATUS:", id);
}

function sseDone(res) {
  res.write("event: done\ndata: {\"done\": true}\n\n");
  if (typeof res.flush === "function") res.flush();
  res.end();
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRADUCTION FR -> AR
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

  const segments = html.split(/<div[^>]*class="hadith[^"]*"[^>]*>/i);
  const infoSegs = html.split(/<div[^>]*class="hadith-info[^"]*"[^>]*>/i);

  for (var i = 1; i < segments.length && results.length < 1; i++) {
    const text = segments[i].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").replace(/^\s*\d+\s*[-\u2013]\s*/, "").trim();
    if (text.length < 10) continue;
    const norm = text.replace(/[\u064B-\u065F\u0670\u060C\u061B\u061F.,!?;:()\[\]{}"'\s]/g, "");
    if (seen.has(norm)) continue;
    seen.add(norm);

    const info = (infoSegs[i] || "").substring(0, 2000);
    results.push({
      arabic_text: text.substring(0, 1200),
      grade: extractInfoValue(info, "\u062E\u0644\u0627\u0635\u0629 \u062D\u0643\u0645 \u0627\u0644\u0645\u062D\u062F\u062B") || "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F",
      savant: extractInfoValue(info, "\u0627\u0644\u0645\u062D\u062F\u062B"),
      source: extractInfoValue(info, "\u0627\u0644\u0645\u0635\u062F\u0631"),
      rawi: extractInfoValue(info, "\u0627\u0644\u0631\u0627\u0648\u064A"),
      french_text: "", grade_explique: "", isnad_chain: "",
      jarh_tadil: "", sanad_conditions: "", mutabaat: "",
      avis_savants: "", grille_albani: "", pertinence: ""
    });
  }

  // Fallback regex
  if (!results.length) {
    const blks = html.match(/[\u0600-\u06FF][\u0600-\u06FF\s\u060C\u061B,.!\u061F\u064B-\u065F]{30,600}/g) || [];
    for (var b = 0; b < blks.length && results.length < 1; b++) {
      const text = blks[b].replace(/\s+/g, " ").trim();
      if (text.length >= 30) {
        results.push({
          arabic_text: text, grade: "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F", savant: "", source: "", rawi: "",
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
// EXTRACT JSON — parseur robuste
// ═══════════════════════════════════════════════════════════════════════════════
function extractJSON(text) {
  if (!text) return null;
  var t = text.replace(/```[a-z]*\n?/gi, "").replace(/```/g, "").trim();
  try { return JSON.parse(t); } catch (_) {}
  var start = t.indexOf("{");
  if (start === -1) return null;
  var depth = 0, end = -1;
  for (var i = start; i < t.length; i++) {
    if (t[i] === "{") depth++;
    else if (t[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) return null;
  var bloc = t.substring(start, end + 1);
  try { return JSON.parse(bloc); } catch (_) {}
  var fixed = bloc.replace(/style="([^"]*)"/g, "style='$1'").replace(/ class="([^"]*)"/g, " class='$1'");
  try { return JSON.parse(fixed); } catch (_) {}
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL — SSE STREAMING — l'UNIQUE module.exports
// ═══════════════════════════════════════════════════════════════════════════════
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  if (req.method === "OPTIONS") return res.status(200).end();

  var parsedUrl = new URL(req.url || "/", "http://localhost");
  var q = req.body?.q || req.query?.q || parsedUrl.searchParams.get("q");
  if (!q) return res.status(400).json({ error: "Requete vide" });
  console.log("MIZAN v18.6 SSE — q:", q);

  var wantSSE = (req.headers.accept || "").indexOf("text/event-stream") !== -1;

  // ══════════════════════════════════════════════════════════════
  // BRANCHE SSE — flux temps reel vers le frontend
  // ══════════════════════════════════════════════════════════════
  if (wantSSE) {
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    if (typeof res.flushHeaders === "function") res.flushHeaders();

    try {
      sseStatus(res, "INITIALISATION");

      // ETAPE 1 : Traduction
      var arabicQuery = await translateToArabic(q);
      console.log("ARABIC:", arabicQuery);
      sseStatus(res, "DORAR");

      // ETAPE 2 : Dorar.net
      var dorarUrl = new URL("https://dorar.net/dorar_api.json");
      dorarUrl.searchParams.set("skey", arabicQuery);
      var ctrl = new AbortController();
      var dorarTimeout = setTimeout(function() { ctrl.abort(); }, 9000);
      var dorarResp = await fetch(dorarUrl.href, {
        headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://dorar.net/" },
        signal: ctrl.signal
      }).finally(function() { clearTimeout(dorarTimeout); });
      if (!dorarResp.ok) throw new Error("Dorar HTTP " + dorarResp.status);
      var dorarData = await dorarResp.json();
      var html = dorarData?.ahadith?.result || "";
      console.log("DORAR_HTML:", html.length, "chars");

      // ETAPE 3 : Parse
      if (!html || html.length < 10) {
        sseWrite(res, "dorar", []);
        sseDone(res);
        return;
      }
      var results = parseDorar(html);
      if (!results.length) { sseWrite(res, "dorar", []); sseDone(res); return; }
      console.log("PARSED:", results.length, "hadith(s)");

      // Envoyer les metadonnees Dorar immediatement
      sseWrite(res, "dorar", results);
      sseStatus(res, "TAKHRIJ");

      // ETAPE 4 : Analyse IA par hadith — avec timeout 45s
      for (var i = 0; i < results.length; i++) {
        var r = results[i];
        sseStatus(res, "RIJAL");

        var prompt =
          "REQUETE : " + q + "\n" +
          "Matn : " + r.arabic_text + "\n" +
          "Grade Dorar : " + r.grade + "\n" +
          "Savant : " + (r.savant || "non precise") + "\n" +
          "Source : " + (r.source || "non precise") + "\n" +
          "Rawi : " + (r.rawi || "non precise") + "\n\n" +
          "RAPPELS : { premier caractere. } dernier. isnad_chain min 6 maillons pipe \\n. guillemets simples HTML.";

        try {
          var analysisPromise = client.messages.create({
            model: "claude-3-haiku-20240307",
            max_tokens: 2500,
            system: SYSTEM_PROMPT,
            messages: [{ role: "user", content: prompt }]
          });

          var timeoutPromise = new Promise(function(_, reject) {
            setTimeout(function() { reject(new Error("TIMEOUT_45S")); }, 45000);
          });

          var aiResp = await Promise.race([analysisPromise, timeoutPromise]);
          var rawText = aiResp.content[0]?.text || "";
          var parsed = extractJSON(rawText);

          sseStatus(res, "JARH");

          if (parsed) {
            r.french_text      = safeField(parsed.french_text);
            r.grade_explique   = safeField(parsed.grade_explique);
            r.isnad_chain      = cleanIsnad(parsed.isnad_chain || "");
            r.jarh_tadil       = safeField(parsed.jarh_tadil);
            r.sanad_conditions = safeField(parsed.sanad_conditions);
            r.mutabaat         = safeField(parsed.mutabaat, "Non analyse");
            r.avis_savants     = safeField(parsed.avis_savants);
            r.grille_albani    = safeField(parsed.grille_albani, "Consultez la Silsilah");
            r.pertinence       = /^OUI/i.test(parsed.pertinence || "") ? "OUI" :
                                 /^PARTIEL/i.test(parsed.pertinence || "") ? "PARTIEL" : "NON";
            console.log("ANALYSE OK — isnad:", r.isnad_chain.length, "fr:", r.french_text.length);
          }
        } catch (aiErr) {
          console.log("ANALYSE_ERR[" + i + "]:", aiErr.message);
          // Resultats Dorar bruts deja envoyes — le frontend a le matn + grade
        }

        sseStatus(res, "HUKM");
        sseWrite(res, "hadith", { index: i, data: r });
      }

      // Signal de fin obligatoire
      sseDone(res);

    } catch (error) {
      console.log("SSE_ERROR:", error.message);
      try { sseWrite(res, "error", { message: error.message }); sseDone(res); }
      catch (_) { try { res.end(); } catch (__) {} }
    }
    return;
  }

  // ══════════════════════════════════════════════════════════════
  // BRANCHE JSON — fallback pour clients non-SSE
  // ══════════════════════════════════════════════════════════════
  try {
    var arabicQ = await translateToArabic(q);
    var dUrl = new URL("https://dorar.net/dorar_api.json");
    dUrl.searchParams.set("skey", arabicQ);
    var dCtrl = new AbortController();
    var dTo = setTimeout(function() { dCtrl.abort(); }, 9000);
    var dResp = await fetch(dUrl.href, {
      headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://dorar.net/" },
      signal: dCtrl.signal
    }).finally(function() { clearTimeout(dTo); });
    if (!dResp.ok) throw new Error("Dorar HTTP " + dResp.status);
    var dData = await dResp.json();
    var dHtml = dData?.ahadith?.result || "";
    if (!dHtml || dHtml.length < 10) return res.status(200).json([]);
    var jResults = parseDorar(dHtml);
    if (!jResults.length) return res.status(200).json([]);

    // Analyse avec timeout 45s
    for (var j = 0; j < jResults.length; j++) {
      try {
        var jPrompt =
          "Matn : " + jResults[j].arabic_text + "\nGrade : " + jResults[j].grade +
          "\nSavant : " + (jResults[j].savant || "") + "\nRawi : " + (jResults[j].rawi || "");
        var jAP = client.messages.create({
          model: "claude-3-haiku-20240307", max_tokens: 2500,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: jPrompt }]
        });
        var jTP = new Promise(function(_, rej) { setTimeout(function() { rej(new Error("TIMEOUT")); }, 45000); });
        var jR = await Promise.race([jAP, jTP]);
        var jParsed = extractJSON(jR.content[0]?.text || "");
        if (jParsed) {
          jResults[j].french_text      = safeField(jParsed.french_text);
          jResults[j].grade_explique   = safeField(jParsed.grade_explique);
          jResults[j].isnad_chain      = cleanIsnad(jParsed.isnad_chain || "");
          jResults[j].jarh_tadil       = safeField(jParsed.jarh_tadil);
          jResults[j].sanad_conditions = safeField(jParsed.sanad_conditions);
          jResults[j].mutabaat         = safeField(jParsed.mutabaat, "Non analyse");
          jResults[j].avis_savants     = safeField(jParsed.avis_savants);
          jResults[j].grille_albani    = safeField(jParsed.grille_albani, "Consultez la Silsilah");
          jResults[j].pertinence       = /^OUI/i.test(jParsed.pertinence || "") ? "OUI" : "NON";
        }
      } catch (_) {}
    }
    return res.status(200).json(jResults);

  } catch (error) {
    console.log("JSON_ERROR:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

module.exports.maxDuration = 60;
