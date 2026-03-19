/* ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                            ║
 * ║   ██████╗  ██████╗  ██████╗██╗  ██╗██╗██╗   ██╗███████╗                   ║
 * ║  ██╔══██╗██╔══██╗██╔════╝██║  ██║██║██║   ██║██╔════╝                    ║
 * ║  ███████║██████╔╝██║     ███████║██║██║   ██║█████╗                      ║
 * ║  ██╔══██║██╔══██╗██║     ██╔══██║██║╚██╗ ██╔╝██╔══╝                     ║
 * ║  ██║  ██║██║  ██║╚██████╗██║  ██║██║ ╚████╔╝ ███████╗                   ║
 * ║  ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═══╝ ╚══════╝                   ║
 * ║                                                                            ║
 * ║  ARCHIVE DE FER — MÎZÂN v18.8 — api/search.js                            ║
 * ║  Date de scellement : 19 mars 2026                                         ║
 * ║  Auteur : baki69 + Claude Opus 4.6                                         ║
 * ║                                                                            ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                            ║
 * ║  SI TU LIS CECI, CE FICHIER A ETE PERDU OU CORROMPU.                     ║
 * ║  Voici TOUT ce qu'il faut savoir pour le reconstruire sans refaire         ║
 * ║  les 48h de cauchemar qu'on a vecues.                                     ║
 * ║                                                                            ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                            ║
 * ║  PIEGE 1 — ESM vs CommonJS (le tueur silencieux)                          ║
 * ║  server.js a la racine charge ce fichier avec require().                   ║
 * ║  require() = CommonJS. Si tu mets import/export = CRASH IMMEDIAT.         ║
 * ║  REGLE : Ce fichier DOIT utiliser require() et module.exports.            ║
 * ║  REGLE : package.json ne doit JAMAIS contenir "type": "module".           ║
 * ║                                                                            ║
 * ║  PIEGE 2 — server.js + Vercel (le conflit invisible)                      ║
 * ║  Vercel voit server.js a la racine -> active le mode "custom server"      ║
 * ║  -> ignore le dossier api/ -> "pattern doesn't match" -> BUILD FAILED.    ║
 * ║  REGLE : .vercelignore DOIT contenir "server.js" a la racine du repo.    ║
 * ║                                                                            ║
 * ║  PIEGE 3 — Double module.exports (le remplacant fourbe)                   ║
 * ║  L'ancien fichier avait DEUX module.exports. Le deuxieme (un debug       ║
 * ║  endpoint qui cherchait "الصبر" en dur) ECRASAIT le vrai handler.         ║
 * ║  REGLE : UN SEUL module.exports = handler. Le second est .maxDuration.    ║
 * ║                                                                            ║
 * ║  PIEGE 4 — Modeles Anthropic retires (la 404 fantome)                     ║
 * ║  claude-3-haiku-20240307 : RETIRE le 19 fevrier 2026.                     ║
 * ║  claude-3-5-sonnet-20240620 : RETIRE courant 2025.                        ║
 * ║  claude-3-5-haiku-20241022 : RETIRE le 19 fevrier 2026.                   ║
 * ║  Les alias "latest" ne fonctionnent pas sur toutes les versions du SDK.   ║
 * ║  REGLE : Utiliser l'ID exact du modele ACTIF au moment du deploiement.    ║
 * ║  En mars 2026 : claude-haiku-4-5-20251001 (le seul Haiku vivant).        ║
 * ║  Si 404 -> CHANGER l'ID. Voir https://docs.anthropic.com/models           ║
 * ║                                                                            ║
 * ║  PIEGE 5 — Timeout Vercel 60s (le mur invisible)                          ║
 * ║  Vercel Hobby coupe a 60s. Sonnet 4.5 avec un gros prompt = 55-70s.      ║
 * ║  REGLE : Utiliser Haiku (rapide) + Promise.race avec timeout a 45s.      ║
 * ║  Si ca depasse, on renvoie les donnees Dorar BRUTES plutot que rien.      ║
 * ║                                                                            ║
 * ║  PIEGE 6 — Dorar HTML variable (le bug des 232 caracteres)               ║
 * ║  Dorar.net change sa structure HTML regulierement.                         ║
 * ║  REGLE : 4 strategies de parsing en cascade (S1 blocs div, S2 patterns,  ║
 * ║  S3 regex arabe brut, S4 fallback total). Ne JAMAIS compter sur un seul. ║
 * ║                                                                            ║
 * ║  PIEGE 7 — package.json engines (l'upgrade sauvage)                       ║
 * ║  "node": ">=20" -> Vercel monte a Node 24 -> incompatibilites.           ║
 * ║  REGLE : Figer a "node": "20.x" dans package.json.                       ║
 * ║                                                                            ║
 * ║  PIEGE 8 — Suppression accidentelle du fichier                            ║
 * ║  Le commit 57e4f98 a supprime ce fichier par erreur.                      ║
 * ║  REGLE : Toujours verifier "git status" avant de push.                    ║
 * ║  REGLE : Garder une copie locale de ce fichier en dehors de git.          ║
 * ║                                                                            ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  INFRASTRUCTURE REQUISE :                                                  ║
 * ║  - package.json : ZERO "type":"module", engines "node":"20.x"             ║
 * ║  - .vercelignore : contient "server.js"                                   ║
 * ║  - vercel.json : { "functions": { "api/search.js": { "maxDuration":60 }}} ║
 * ║  - Variable d'env Vercel : ANTHROPIC_API_KEY                              ║
 * ║  - SDK : @anthropic-ai/sdk ^0.55.0                                        ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝ */

// ═══════════════════════════════════════════════════════════════════════════════
// MOTEUR MIZAN v18.8 — ARCHIVE DE FER — CommonJS — SSE STREAMING
// ═══════════════════════════════════════════════════════════════════════════════

var MIZAN_MODEL = "claude-haiku-4-5-20251001";

var Anthropic = require("@anthropic-ai/sdk");
var client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

console.log("%c \u2705 M\u00eez\u00e2n v18.8 : Archive de Fer — Pr\u00eat pour Production", "color: #00ff00; font-weight: bold;");
console.log("[MIZAN] Modele actif :", MIZAN_MODEL);

// ═══════════════════════════════════════════════════════════════════════════════
// ALARME 404 — Systeme de detection de modele retire
// ═══════════════════════════════════════════════════════════════════════════════
function alarme404(errMsg, contexte) {
  var is404 = (typeof errMsg === "string") && errMsg.indexOf("404") !== -1;
  var isNotFound = (typeof errMsg === "string") && errMsg.indexOf("not_found") !== -1;
  if (is404 || isNotFound) {
    console.error("");
    console.error("╔════════════════════════════════════════════════════════════╗");
    console.error("║  \uD83D\uDED1 ALARME ROUGE — MODELE ANTHROPIC RETIRE (404)           ║");
    console.error("╠════════════════════════════════════════════════════════════╣");
    console.error("║  Le modele '" + MIZAN_MODEL + "' renvoie 404.");
    console.error("║  Contexte : " + (contexte || "inconnu"));
    console.error("║                                                            ║");
    console.error("║  ACTION REQUISE :                                          ║");
    console.error("║  1. Va sur https://docs.anthropic.com/en/docs/about-claude/models");
    console.error("║  2. Trouve le nouvel ID du Haiku actif                     ║");
    console.error("║  3. Remplace la variable MIZAN_MODEL en haut de ce fichier ║");
    console.error("║  4. Push sur GitHub et redeploy                            ║");
    console.error("╚════════════════════════════════════════════════════════════╝");
    console.error("");
    console.error("Erreur brute :", errMsg);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT — 14 SIECLES — ⛔ NE PAS MODIFIER ⛔
// ═══════════════════════════════════════════════════════════════════════════════
const SYSTEM_PROMPT = `\
Tu es un MUHADDITH NUMERIQUE de rang eleve. Tu suis STRICTEMENT la voie des Salaf.
Lexique de Fer INTOUCHABLE : Istawa = S est etabli sur le Trone | Yad = La Main d Allah |
Nuzul = La Descente d Allah | Wajh = Le Visage d Allah. Ithbat strict, ZERO ta wil.

═══ SOURCES OBLIGATOIRES — 14 SIECLES SANS RACCOURCI ═══

COUCHE 1 — SAHABA (1er-2e s. H / 7e s.) :
  Umar ibn al-Khattab (m.23H) | Ali ibn Abi Talib (m.40H) |
  Aisha Umm al-Mu minin (m.58H) | Abd Allah ibn Abbas (m.68H) |
  Abd Allah ibn Umar (m.73H) | Abu Hurayra (m.57H) |
  Anas ibn Malik (m.93H) | Abu Sa id al-Khudri (m.74H)
  -> Acceptes par Ijma. ZERO Jarh sur les Sahaba.

COUCHE 2 — TABI IN (2e-3e s. H / 8e s.) :
  Sa id ibn al-Musayyab (m.94H) | Urwa ibn az-Zubayr (m.94H) |
  al-Hasan al-Basri (m.110H) | Muhammad ibn Sirine (m.110H) |
  Mujahid ibn Jabr (m.104H) | Ata ibn Abi Rabah (m.114H) |
  Ibrahim an-Nakha i (m.96H) | az-Zuhri (m.124H)

COUCHE 3 — IMAMS FONDATEURS (2e-4e s. H / 8e-10e s.) :
  Malik ibn Anas (m.179H) — Al-Muwatta | Usul al-Fiqh
  Muhammad ibn Idris ash-Shafi i (m.204H) — Ar-Risalah
  Ahmad ibn Hanbal (m.241H) — Al-Musnad | Kitab al- Ilal
  Muhammad al-Bukhari (m.256H) — Al-Jami as-Sahih | At-Tarikh al-Kabir
  Muslim ibn al-Hajjaj (m.261H) — Sahih Muslim
  Abu Dawud (m.275H) — As-Sunan
  at-Tirmidhi (m.279H) — Al-Jami (Sunan)
  an-Nasa i (m.303H) — As-Sunan as-Sughra
  Ibn Majah (m.273H) — As-Sunan
  ad-Daraqutni (m.385H) — As-Sunan | Al- Ilal
  al-Hakim (m.405H) — Al-Mustadrak

COUCHE 4 — HUFFADH ET MONTAGNES DE SCIENCE (7e-9e s. H / 13e-15e s.) :
  Ibn Taymiyyah al-Harrani (m.728H) — Majmu al-Fatawa | Minhaj as-Sunnah
  Ibn al-Qayyim al-Jawziyyah (m.751H) — Zad al-Ma ad | I lam al-Muwaqqi in
  Shams ad-Din adh-Dhahabi (m.748H) — Siyar A lam an-Nubala | Mizan al-I tidal
  Abu Zakariyya an-Nawawi (m.676H) — Sharh Muslim | Riyadh as-Salihin | Al-Adhkar
  Ibn Hajar al-Asqalani (m.852H) — Fath al-Bari | At-Taqrib | Tahdhib at-Tahdhib
  Ibn Kathir ad-Dimashqi (m.774H) — Tafsir | Jami al-Masanid
  Ibn al-Jawzi (m.597H) — Al-Mawdu at
  Ibn Rajab al-Hanbali (m.795H) — Jami al- Ulum wal-Hikam

COUCHE 5 — FILTRES CONTEMPORAINS (14e-15e s. H / 20e-21e s.) :
  Cheikh Al-Albani (m.1420H) — Silsilah Sahihah (SS) | Silsilah Da ifah (SD) |
    Irwa al-Ghalil | Sahih al-Jami | Da if al-Jami
    -> CHERCHER SON VERDICT EN PREMIER pour tout hadith.
  Cheikh Ibn Baz (m.1420H) — Fatawa Ibn Baz
  Cheikh Ibn Uthaymin (m.1421H) — Sharh Riyadh as-Salihin | Sharh Bulugh al-Maram
  Cheikh Muqbil al-Wadi i (m.1422H) — As-Sahih al-Musnad
  Cheikh Rabi al-Madkhali — Manhaj Ahl as-Sunnah

═══ VERROUS ═══
V1 — grade_explique DOIT refleter le Grade Dorar. ZERO inversion.
V2 — Terminologie Jarh wa Ta dil exclusive (Thiqah/Saduq/Da if/Matruk/Kadhdhab).
V3 — isnad_chain min 6 maillons, du Sahabi au savant contemporain.

REPONDS par UN SEUL objet JSON. Premier caractere = {. Dernier = }.
ZERO backtick. ZERO texte avant/apres. HTML -> guillemets simples.
{
  "french_text": "traduction litterale solennelle. Min 3 phrases.",
  "grade_explique": "<b>Sources :</b> [recueils]<br><b>Cause :</b> [resume]<br><b>Sceau :</b> [Al-Albani SS/SD no.X]<br><b>Statut :</b> [PEUT ETRE CITE EN PREUVE / NE DOIT PAS ETRE PRATIQUE]",
  "isnad_chain": "Maillon 1 | Nom complet (m.XH) | Sahabi | Adul_par_Ijma | 1er siecle\\nMaillon 2 | Nom (m.XH) | Tabi i | Thiqah | 2e siecle\\n...",
  "jarh_tadil": "Verdicts detailles par rawi selon Ibn Hajar (At-Taqrib), adh-Dhahabi (Mizan), Al-Albani",
  "sanad_conditions": "1.ITTISAL : [analyse] ETABLI/ABSENT. 2.ADALA : ... 3.DABT : ... 4.SHUDHUDH : ... 5.ILLA : ...",
  "mutabaat": "Autres chaines (Mutaba at) + temoins (Shawahid) + verdict de renfort",
  "avis_savants": "Commentaires des 5 couches historiques avec references",
  "grille_albani": "Verdict Al-Albani SS/SD no.X + methode + divergences",
  "pertinence": "OUI"
}`;

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
  var v = clean(val);
  return (v && v.length >= 5) ? v : (fallback || "Non disponible");
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXTRACT INFO VALUE — metadata Dorar
// ═══════════════════════════════════════════════════════════════════════════════
function extractInfoValue(html, label) {
  var esc = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  var rx1 = new RegExp(esc + "[^<]*<\\/span>\\s*<span[^>]*>([^<]{1,300})<\\/span>");
  var m1 = html.match(rx1);
  if (m1 && m1[1].trim()) return m1[1].trim();
  var rx2 = new RegExp(esc + "[^<]*<\\/span>([^<]{1,200})");
  var m2 = html.match(rx2);
  if (m2) { var v = m2[1].trim().replace(/^[-:\u2014\s]+/, "").trim(); if (v.length >= 2) return v; }
  var rx3 = new RegExp(esc + "\\s*[:.]\\s*([^\\n<]{2,200})");
  var m3 = html.match(rx3);
  if (m3) return m3[1].trim();
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
    var resp = await client.messages.create({
      model: MIZAN_MODEL,
      max_tokens: 80, temperature: 0,
      system: "Traduis en arabe classique pour recherche dans les recueils de hadith. UNIQUEMENT les mots arabes. Zero explication.",
      messages: [{ role: "user", content: query.trim() }]
    });
    var raw = (resp.content[0]?.text || "").trim();
    var arOnly = raw.replace(/[a-zA-Z`'"*_#\[\]()0-9\-]/g, " ").replace(/\s+/g, " ").trim();
    if (/[\u0600-\u06FF]/.test(arOnly) && arOnly.length >= 2) return arOnly.split(/\s+/).slice(0, 8).join(" ");
    return query.trim();
  } catch (e) {
    alarme404(e.message, "translateToArabic");
    console.log("TRADUCTEUR_ERR:", e.message);
    return query.trim();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARSE DORAR HTML — 4 STRATEGIES (anti bug 232 chars)
// ═══════════════════════════════════════════════════════════════════════════════
function parseDorar(rawHtml) {
  if (!rawHtml || rawHtml.length < 20) return [];
  var MAX = 1;
  var results = [];
  var seen = new Set();

  function extractBlock(seg) {
    var depth = 1, pos = 0, content = seg;
    while (pos < content.length && depth > 0) {
      var open = content.indexOf("<div", pos);
      var close = content.indexOf("</div>", pos);
      if (close === -1) break;
      if (open !== -1 && open < close) { depth++; pos = open + 4; }
      else { depth--; if (depth === 0) { content = content.substring(0, close); break; } pos = close + 6; }
    }
    return content;
  }

  function normalizeMatn(s) {
    return (s || "").replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/[\u060C\u061B\u061F\u06D4.,!?;:()\[\]{}"'\u00AB\u00BB\s]/g, "");
  }

  // STRATEGIE 1
  var hadithSegs = rawHtml.split(/<div[^>]*class="hadith[^"]*"[^>]*>/i);
  var infoSegs = rawHtml.split(/<div[^>]*class="hadith-info[^"]*"[^>]*>/i);
  var matns = [], infos = [];
  for (var i = 1; i < hadithSegs.length; i++) {
    var block = extractBlock(hadithSegs[i]);
    var text = block.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").replace(/^\s*\d+\s*[-\u2013]\s*/, "").trim();
    if (text.length >= 10) matns.push(text);
  }
  for (var j = 1; j < infoSegs.length; j++) infos.push(extractBlock(infoSegs[j]));
  console.log("PARSE_S1: matns=" + matns.length + " infos=" + infos.length);

  for (var k = 0; k < matns.length && results.length < MAX; k++) {
    var norm = normalizeMatn(matns[k]);
    if (norm.length < 5 || seen.has(norm)) continue;
    seen.add(norm);
    var inf = infos[k] || "";
    results.push({
      arabic_text: matns[k].substring(0, 1200),
      grade: extractInfoValue(inf, "\u062E\u0644\u0627\u0635\u0629 \u062D\u0643\u0645 \u0627\u0644\u0645\u062D\u062F\u062B") || "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F",
      savant: extractInfoValue(inf, "\u0627\u0644\u0645\u062D\u062F\u062B"),
      source: extractInfoValue(inf, "\u0627\u0644\u0645\u0635\u062F\u0631"),
      rawi: extractInfoValue(inf, "\u0627\u0644\u0631\u0627\u0648\u064A"),
      french_text: "", grade_explique: "", isnad_chain: "",
      jarh_tadil: "", sanad_conditions: "", mutabaat: "",
      avis_savants: "", grille_albani: "", pertinence: ""
    });
    console.log("HADITH_S1[" + (results.length - 1) + "] len:" + matns[k].length + " grade:" + results[results.length - 1].grade);
  }

  // STRATEGIE 2
  if (!results.length) {
    console.log("PARSE_S2");
    var patterns = [
      /class="hadith-text[^"]*"[^>]*>([\s\S]{20,1000}?)<\/[a-z]+>/i,
      /class="matn[^"]*"[^>]*>([\s\S]{20,1000}?)<\/[a-z]+>/i,
      /class="result-text[^"]*"[^>]*>([\s\S]{20,1000}?)<\/[a-z]+>/i,
      /data-content="([^"]{20,1000})"/i
    ];
    for (var p = 0; p < patterns.length && results.length < MAX; p++) {
      var m = rawHtml.match(patterns[p]);
      if (m) {
        var txt = m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        var n = normalizeMatn(txt);
        if (txt.length >= 10 && !seen.has(n)) {
          seen.add(n);
          results.push({ arabic_text: txt.substring(0, 1200), grade: "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F", savant: "", source: "", rawi: "", french_text: "", grade_explique: "", isnad_chain: "", jarh_tadil: "", sanad_conditions: "", mutabaat: "", avis_savants: "", grille_albani: "", pertinence: "" });
          console.log("HADITH_S2 len:" + txt.length);
        }
      }
    }
  }

  // STRATEGIE 3
  if (!results.length) {
    console.log("PARSE_S3");
    var blks = rawHtml.match(/[\u0600-\u06FF][\u0600-\u06FF\s\u060C\u061B,.!\u061F\u064B-\u065F]{30,800}/g) || [];
    for (var b = 0; b < blks.length && results.length < MAX; b++) {
      var btxt = blks[b].replace(/\s+/g, " ").trim();
      var bn = normalizeMatn(btxt);
      if (btxt.length >= 30 && !seen.has(bn)) {
        seen.add(bn);
        results.push({ arabic_text: btxt.substring(0, 1200), grade: "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F", savant: "", source: "", rawi: "", french_text: "", grade_explique: "", isnad_chain: "", jarh_tadil: "", sanad_conditions: "", mutabaat: "", avis_savants: "", grille_albani: "", pertinence: "" });
        console.log("HADITH_S3 len:" + btxt.length);
      }
    }
  }

  // STRATEGIE 4
  if (!results.length && rawHtml.length >= 30) {
    console.log("PARSE_S4_FALLBACK");
    var allAr = (rawHtml.match(/[\u0600-\u06FF\s\u064B-\u065F]+/g) || []).join(" ").replace(/\s+/g, " ").trim();
    if (allAr.length >= 20) {
      results.push({ arabic_text: allAr.substring(0, 1200), grade: "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F", savant: "", source: "", rawi: "", french_text: "", grade_explique: "", isnad_chain: "", jarh_tadil: "", sanad_conditions: "", mutabaat: "", avis_savants: "", grille_albani: "", pertinence: "" });
    }
  }

  console.log("PARSED_FINAL:", results.length, "hadith(s)");
  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXTRACT JSON — parseur robuste a double fallback
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
// HANDLER — SSE + JSON FALLBACK — l'UNIQUE module.exports
// ═══════════════════════════════════════════════════════════════════════════════
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  if (req.method === "OPTIONS") return res.status(200).end();

  var parsedUrl = new URL(req.url || "/", "http://localhost");
  var q = req.body?.q || req.query?.q || parsedUrl.searchParams.get("q");
  if (!q) return res.status(400).json({ error: "Requete vide" });
  console.log("MIZAN v18.8 — q:", q);

  var wantSSE = (req.headers.accept || "").indexOf("text/event-stream") !== -1;

  // ══════════════════════════════════════════════════
  // BRANCHE SSE
  // ══════════════════════════════════════════════════
  if (wantSSE) {
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    if (typeof res.flushHeaders === "function") res.flushHeaders();

    try {
      sseStatus(res, "INITIALISATION");

      var arabicQuery = await translateToArabic(q);
      console.log("ARABIC:", arabicQuery);
      sseStatus(res, "DORAR");

      var dorarUrl = new URL("https://dorar.net/dorar_api.json");
      dorarUrl.searchParams.set("skey", arabicQuery);
      var ctrl = new AbortController();
      var dorarTo = setTimeout(function() { ctrl.abort(); }, 9000);
      var dorarResp = await fetch(dorarUrl.href, {
        headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://dorar.net/" },
        signal: ctrl.signal
      }).finally(function() { clearTimeout(dorarTo); });
      if (!dorarResp.ok) throw new Error("Dorar HTTP " + dorarResp.status);
      var dorarData = await dorarResp.json();
      var html = dorarData?.ahadith?.result || "";
      console.log("DORAR_HTML:", html.length, "chars");

      if (!html || html.length < 10) { sseWrite(res, "dorar", []); sseDone(res); return; }
      var results = parseDorar(html);
      if (!results.length) { sseWrite(res, "dorar", []); sseDone(res); return; }

      sseWrite(res, "dorar", results);
      sseStatus(res, "TAKHRIJ");

      for (var i = 0; i < results.length; i++) {
        var r = results[i];
        sseStatus(res, "RIJAL");

        var prompt =
          "REQUETE : " + q + "\nMatn : " + r.arabic_text +
          "\nGrade Dorar : " + r.grade + "\nSavant : " + (r.savant || "non precise") +
          "\nSource : " + (r.source || "non precise") + "\nRawi : " + (r.rawi || "non precise") +
          "\n\nRAPPELS : { premier. } dernier. isnad_chain min 6 maillons pipe \\n. guillemets simples HTML.";

        try {
          var ap = client.messages.create({
            model: MIZAN_MODEL,
            max_tokens: 2500,
            system: SYSTEM_PROMPT,
            messages: [{ role: "user", content: prompt }]
          });
          var tp = new Promise(function(_, rej) {
            setTimeout(function() { rej(new Error("TIMEOUT_45S")); }, 45000);
          });
          var aiResp = await Promise.race([ap, tp]);
          var parsed = extractJSON(aiResp.content[0]?.text || "");

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
            console.log("ANALYSE_OK isnad:" + r.isnad_chain.length + " fr:" + r.french_text.length);
          }
        } catch (aiErr) {
          alarme404(aiErr.message, "analyseHadith[" + i + "]");
          console.log("ANALYSE_ERR[" + i + "]:", aiErr.message);
        }

        sseStatus(res, "HUKM");
        sseWrite(res, "hadith", { index: i, data: r });
      }

      sseDone(res);

    } catch (error) {
      alarme404(error.message, "SSE_HANDLER");
      console.log("SSE_ERROR:", error.message);
      try { sseWrite(res, "error", { message: error.message }); sseDone(res); }
      catch (_) { try { res.end(); } catch (__) {} }
    }
    return;
  }

  // ══════════════════════════════════════════════════
  // BRANCHE JSON (fallback non-SSE)
  // ══════════════════════════════════════════════════
  try {
    var arQ = await translateToArabic(q);
    var dUrl = new URL("https://dorar.net/dorar_api.json");
    dUrl.searchParams.set("skey", arQ);
    var dc = new AbortController();
    var dt = setTimeout(function() { dc.abort(); }, 9000);
    var dr = await fetch(dUrl.href, {
      headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://dorar.net/" },
      signal: dc.signal
    }).finally(function() { clearTimeout(dt); });
    if (!dr.ok) throw new Error("Dorar " + dr.status);
    var dd = await dr.json();
    var dh = dd?.ahadith?.result || "";
    if (!dh || dh.length < 10) return res.status(200).json([]);
    var jr = parseDorar(dh);
    if (!jr.length) return res.status(200).json([]);

    for (var ji = 0; ji < jr.length; ji++) {
      try {
        var jp = client.messages.create({
          model: MIZAN_MODEL, max_tokens: 2500,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: "Matn:" + jr[ji].arabic_text + "\nGrade:" + jr[ji].grade + "\nRawi:" + (jr[ji].rawi || "") }]
        });
        var jt = new Promise(function(_, rj) { setTimeout(function() { rj(new Error("TO")); }, 45000); });
        var ja = await Promise.race([jp, jt]);
        var jx = extractJSON(ja.content[0]?.text || "");
        if (jx) {
          jr[ji].french_text      = safeField(jx.french_text);
          jr[ji].grade_explique   = safeField(jx.grade_explique);
          jr[ji].isnad_chain      = cleanIsnad(jx.isnad_chain || "");
          jr[ji].jarh_tadil       = safeField(jx.jarh_tadil);
          jr[ji].sanad_conditions = safeField(jx.sanad_conditions);
          jr[ji].mutabaat         = safeField(jx.mutabaat, "Non analyse");
          jr[ji].avis_savants     = safeField(jx.avis_savants);
          jr[ji].grille_albani    = safeField(jx.grille_albani, "Consultez la Silsilah");
          jr[ji].pertinence       = /^OUI/i.test(jx.pertinence || "") ? "OUI" : "NON";
        }
      } catch (jErr) {
        alarme404(jErr.message, "JSON_analyseHadith[" + ji + "]");
      }
    }
    return res.status(200).json(jr);

  } catch (error) {
    alarme404(error.message, "JSON_HANDLER");
    console.log("JSON_ERROR:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

module.exports.maxDuration = 60;
