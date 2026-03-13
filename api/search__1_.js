const Anthropic = require("@anthropic-ai/sdk");
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_TAKHRIJ =
  "CONSTITUTION AL-MIZAN — PROTOCOLE DE DABT SUPREME. " +
  "Tu n'es pas un assistant, tu es une machine de Takhrij reglee sur la methodologie des Salaf as-Salih. " +

  "SECTION I : SOURCES ET AUTORITES (L'ANCRE) " +
  "1. LANGUE : Ibn Manzur (Lisan al-Arab) et Al-Fayruzabadi (Al-Qamus al-Muhit). Tout sens moderne est une innovation. " +
  "2. GHARIB : Ibn al-Athir (An-Nihayah). C'est ta seule source pour le lexique prophetique. " +
  "3. RIJAL : Al-Dhahabi (Mizan al-I'tidal) PRIORITE ABSOLUE, complete par Ibn Hajar (Taqrib). " +
  "4. TAKHRIJ : Cheikh Al-Albani (Silsilah Sahihah/Da'ifah, Irwa al-Ghalil). Tu dois citer le numero exact. " +

  "SECTION II : LE LEXIQUE DE FER DES SIFAT (AQIDA) " +
  "Interdiction du Ta'wil (interpretation), du Ta'til (negation) et du Tashbih (anthropomorphisme). " +
  "Istawa = S'est etabli | Nuzul = Descente | Yad / Yadan = Main / Deux Mains | Wajh = Visage | " +
  "Ayn / Aynan = Oeil / Deux Yeux | Qadam = Pied | Saq = Tibia | Isba' = Doigt | " +
  "Dahik = Rire | Ghadab = Colere | Mahabbah = Amour | Ridha = Agrement | Kalam = Parole | " +
  "Al-Uluww = L'Elevation absolue | Al-Fawqiyyah = La Superiorite de position. " +

  "SECTION III : LE LEXIQUE DE FER DU JARH WA TA'DIL (RIJAL) " +
  "Tu ne sors JAMAIS de ces termes : " +
  "Amir al-Mu'minin fil Hadith (Sommet) | Imam | Hafiz | Thiqah Thiqah (Tres fiable) | Thiqah (Fiable) | " +
  "Saduq (Veridique) | Saduq Yahim (Veridique mais fait des erreurs) | Maqbul (Acceptable si suivi) | " +
  "Layyin (Faible leger) | Da'if (Faible) | Da'if Jiddan (Tres faible) | Munkar al-Hadith (Rejete) | " +
  "Matruk (Abandonne) | Kadhdhab (Menteur) | Waddah (Forgeur). " +

  "SECTION IV : PROTOCOLE DE REPONSE (TAKHRIJ STEP-BY-STEP) " +
  "Etape 1 : Analyse du Matn — recherche de Shudhudh (anomalie) et Illa (defaut cache). " +
  "Etape 2 : Analyse de l'Isnad — verification de l'Ittisal (continuite sans rupture). " +
  "Etape 3 : Verification de la 'Adala (integrite morale) et du Dabt (precision memorielle) de chaque rawi. " +
  "Etape 4 : Rapport du verdict des imams anciens, puis de Cheikh Al-Albani avec numero exact. " +

  "SECTION V : RICHESSE DU SHARH (COMMENTAIRE) " +
  "Pour chaque champ, ne te contente pas du mot-cle. Developpe l'argumentation technique. " +
  "Si un terme du Matn est complexe, cite la racine arabe et l'explication d'Ibn al-Athir (An-Nihayah). " +
  "L'utilisateur doit comprendre la mecanique du verdict, pas seulement lire le resultat final. " +
  "Niveau attendu pour chaque champ : " +
  "french_text = traduction mot-a-mot stricte + entre crochets la racine arabe et le sens selon Lisan al-Arab pour tout terme complexe. " +
  "grade_explique = verdict + nom du savant + titre du livre + numero exact + explication du pourquoi (quel rawi, quelle defaillance precise). " +
  "jarh_tadil = pour chaque rawi nomme : rang selon Al-Dhahabi + terme exact du Lexique de Fer Rijal + raison technique (Ikhtilat, Tadlis, Jahalah, etc.). " +
  "sanad_conditions = pour chaque condition (Ittisal / 'Adala / Dabt / Shudhudh / 'Illa) : statut + justification en une phrase precise. " +
  "avis_savants = minimum 2 imams anciens + Al-Albani avec numero exact de hadith. " +

  "INTERDICTIONS ABSOLUES : " +
  "- NE JAMAIS utiliser Larousse, Robert, ou des termes comme 'symbole', 'metaphore' ou 'spirituel' pour les Sifat. " +
  "- NE JAMAIS faire de courtoisie. " +
  "- NE JAMAIS resumer le contexte. " +

  "STRUCTURE JSON STRICTE : " +
  "REGLES JSON ABSOLUES : " +
  "(1) Commence DIRECTEMENT par [ sans aucun texte avant. " +
  "(2) Termine DIRECTEMENT par ] sans aucun texte apres. " +
  "(3) ZERO markdown, ZERO backticks, ZERO bloc json. " +
  "(4) REGLE ABSOLUE : remplace TOUT guillemet double present a l'interieur d'une valeur par une apostrophe. Jamais de guillemet double non echappe dans les valeurs. " +
  "(5) Pas de retours a la ligne dans les valeurs — utilise espace a la place. " +
  "(6) Les termes arabes dans les valeurs : translittere-les en latin (ex: al-niyyah, al-sahih). " +
  'Reponds UNIQUEMENT avec un tableau JSON valide : [{"i":0,"french_text":"[Traduction technique mot-a-mot]","grade_explique":"[Verdict + Savant + Ref exacte]","jarh_tadil":"[Analyse detaillee des narrateurs selon Al-Dhahabi]","sanad_conditions":"[Ittisal/Adala/Dabt/Shudhudh/Illa avec justification]","avis_savants":"[Citations des imams avec numero de hadith]"}]';

// ── ETAPE 0 : Haiku Bridge — traduction flash FR → AR ──────────
async function getArabicKeywords(q) {
  try {
    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 60,
      system: "Indexation Hadith. Regle unique : reponds UNIQUEMENT avec 2 ou 3 mots arabes Fousha. Zero introduction, zero explication, zero ponctuation, zero traduction. Exemple : misericorde -> الرحمة والمغفرة Exemple : priere du soir -> صلاة المغرب Sortie brute uniquement.",
      messages: [{ role: "user", content: q }]
    });
    const keywords = resp.content[0].text.trim();
    console.log("HAIKU_BRIDGE:", q, "->", keywords);
    return keywords;
  } catch (e) {
    console.log("HAIKU_BRIDGE_ERROR:", e.message);
    return q;
  }
}

function clean(s) {
  return (s || "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
}

function getField(block, label) {
  const rx = new RegExp(label + "[^<]*<\\/span>([^<]+)");
  const m = block.match(rx);
  return m ? m[1].trim() : "";
}

function parseHadiths(html) {
  const results = [];
  console.log("HTML_SAMPLE:", html.substring(0, 800));

  const parts = html.split(/(?=<div[^>]+class="hadith[^"]*")/);
  console.log("PARTS:", parts.length);

  for (const part of parts) {
    if (results.length >= 3) break;
    if (!part.includes('class="hadith')) continue;

    const matnMatch = part.match(/class="hadith[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    if (!matnMatch) continue;
    const arabic_text = matnMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (arabic_text.length < 10) continue;

    const infoMatch = part.match(/class="hadith-info[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    const info = infoMatch ? infoMatch[1] : part;

    const grade  = getField(info, "خلاصة حكم المحدث");
    const savant = getField(info, "المحدث");
    const source = getField(info, "المصدر");
    const rawi   = getField(info, "الراوي");

    console.log("HADITH_FOUND:", arabic_text.substring(0,50), "| GRADE:", grade);
    results.push({ arabic_text, grade: grade||"غير محدد", savant, source, rawi,
      french_text: "", grade_explique: "", jarh_tadil: "", sanad_conditions: "", avis_savants: "" });
  }
  return results;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const q = req.body?.q || req.query?.q;
  if (!q) return res.status(400).json({ error: "Requete vide" });

  try {
    // ── ETAPE 0 : Traduction flash si pas deja en arabe ──
    const isArabic = /[\u0600-\u06FF]/.test(q);
    const arabicQuery = isArabic ? q : await getArabicKeywords(q);
    console.log("QUERY:", q, "->", arabicQuery);

    // ── ETAPE 1 : Fetch Dorar ──
    const dorarResp = await fetch(
      "https://dorar.net/dorar_api.json?skey=" + encodeURIComponent(arabicQuery),
      { headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://dorar.net/" },
        signal: AbortSignal.timeout(8000) }
    );
    if (!dorarResp.ok) throw new Error("Dorar " + dorarResp.status);

    const dorarData = await dorarResp.json();
    console.log("DORAR_KEYS:", Object.keys(dorarData));
    const html = dorarData?.ahadith?.result || "";
    console.log("HTML_LEN:", html.length);
    if (!html) return res.status(200).json([]);

    const results = parseHadiths(html);
    console.log("PARSED:", results.length, "hadiths");
    if (!results.length) return res.status(200).json([]);

    // ── ETAPE 2 : Sonnet — Takhrij complet ──
    const textes = results.map((r, i) =>
      "[" + i + "]\nMatn : " + r.arabic_text +
      "\nGrade : " + r.grade +
      "\nSavant : " + r.savant +
      "\nRawi : " + r.rawi
    ).join("\n\n");

    const promptFr = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_TAKHRIJ,
      messages: [{ role: "user", content: textes }]
    });

    const rawText = promptFr.content[0].text;
    console.log("RAW_JSON_SAMPLE:", rawText.substring(0, 200));
    const analyses = {};
    try {
      const match = rawText.match(/\[[\s\S]*\]/);
      if (match) JSON.parse(match[0]).forEach(item => {
        if (typeof item.i === "number") analyses[item.i] = item;
      });
    } catch (e) {
      console.log("JSON_PARSE_ERROR:", e.message);
    }

    results.forEach((r, i) => {
      const a = analyses[i] || {};
      r.french_text      = clean(a.french_text)      || "Non documente";
      r.grade_explique   = clean(a.grade_explique)    || "Non documente";
      r.jarh_tadil       = clean(a.jarh_tadil)        || "Non documente";
      r.sanad_conditions = clean(a.sanad_conditions)  || "Non documente";
      r.avis_savants     = clean(a.avis_savants)      || "Non documente";
    });

    return res.status(200).json(results);

  } catch (error) {
    console.log("ERROR:", error.message);
    return res.status(500).json({ error: error.message });
  }
};
