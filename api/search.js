const Anthropic = require("@anthropic-ai/sdk");
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_TAKHRIJ =
  "Tu es un expert en sciences du Hadith selon la methodologie des Salaf As-Salih. " +
  "Lexique de Fer INTOUCHABLE : istawa = S est etabli | Yad Allah = La Main d Allah | " +
  "Nuzul = Descente | Wajh Allah = Le Visage d Allah. Interdiction de paraphraser ces termes. " +
  "Pour chaque hadith, produis un objet JSON avec exactement ces 5 champs en francais : " +
  "french_text (traduction litterale du matn, Lexique de Fer strict), " +
  "grade_explique (verdict d authenticite detaille + nom du savant + reference), " +
  "jarh_tadil (analyse du rawi selon Ibn Hajar Taqrib al-Tahdhib, Al-Dhahabi Al-Kashif, Al-Albani), " +
  "sanad_conditions (verification : Ittisal al-Sanad / Adala al-Rawi / Dabt al-Rawi / Shudhudh / Illa), " +
  "avis_savants (avis consolides des mouhaddithoune avec references). " +
  'Reponds UNIQUEMENT avec un tableau JSON valide : [{"i":0,"french_text":"...","grade_explique":"...","jarh_tadil":"...","sanad_conditions":"...","avis_savants":"..."}]';

function clean(s) {
  return (s || "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
}

// Structure réelle Dorar : <span class='info-subtitle'>LABEL : </span>VALEUR
function getField(block, label) {
  const rx = new RegExp(label + "[^<]*<\\/span>([^<]+)");
  const m = block.match(rx);
  return m ? m[1].trim() : "";
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const q = req.body?.q || req.query?.q;
  if (!q) return res.status(400).json({ error: "Requete vide" });

  try {
    // 1. FR → 1 mot arabe (Haiku)
    const isArabic = /[\u0600-\u06FF]/.test(q);
    let arabicQuery = q;

    if (!isArabic) {
      const promptAr = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 20,
        system: "Reponds UNIQUEMENT avec 1 seul mot arabe. Rien d autre.",
        messages: [{ role: "user", content: "Traduis en 1 mot arabe : " + q }]
      });
      arabicQuery = promptAr.content[0].text.trim().split(/\s+/)[0];
    }

    // 2. API officielle Dorar — structure : data.ahadith.result (HTML brut)
    const dorarResp = await fetch(
      "https://dorar.net/dorar_api.json?skey=" + encodeURIComponent(arabicQuery),
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) }
    );
    if (!dorarResp.ok) throw new Error("Dorar " + dorarResp.status);

    const dorarData = await dorarResp.json();
    const html = dorarData?.ahadith?.result || "";
    console.log("DORAR_KEYS:", JSON.stringify(Object.keys(dorarData||{})));
    console.log("HTML200:", html.substring(0,200));
    if (!html) return res.status(200).json([]);

    // 3. Parser HTML Dorar
    // Structure réelle confirmée par dorar_api.php officiel :
    // <div class='hadith'>MATN</div>
    // <div class='hadith-info'>
    //   <span class='info-subtitle'>الراوي : </span>VALEUR
    //   <span class='info-subtitle'>خلاصة حكم المحدث : </span>VALEUR
    // </div>
    // <hr>
    const results = [];
    const blocks = html.split(/<hr\s*\/?>/i);

    for (const block of blocks) {
      if (results.length >= 3) break;

      const hadithMatch = block.match(/class=['"']hadith['"'][^>]*>([\s\S]*?)<\/div>/);
      if (!hadithMatch) continue;
      const arabic_text = hadithMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (arabic_text.length < 10) continue;

      const grade  = getField(block, "خلاصة حكم المحدث");
      const savant = getField(block, "المحدث");
      const source = getField(block, "المصدر");
      const rawi   = getField(block, "الراوي");

      if (!grade) continue;

      results.push({
        arabic_text, grade, savant, source, rawi,
        french_text: "", grade_explique: "", jarh_tadil: "", sanad_conditions: "", avis_savants: ""
      });
    }

    if (!results.length) return res.status(200).json([]);

    // 4. Takhrij complet → 5 champs via Haiku (sous 10s Vercel)
    const textes = results.map((r, i) =>
      "[" + i + "]\nMatn : " + r.arabic_text +
      "\nGrade : " + r.grade +
      "\nSavant : " + r.savant +
      "\nRawi : " + r.rawi
    ).join("\n\n");

    const promptFr = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: SYSTEM_TAKHRIJ,
      messages: [{ role: "user", content: "Genere le Takhrij complet pour ces hadiths :\n\n" + textes }]
    });

    const rawText = promptFr.content[0].text;

    // 5. Parse JSON double fallback
    const analyses = {};
    try {
      const match = rawText.match(/\[[\s\S]*\]/);
      if (match) {
        JSON.parse(match[0]).forEach((item) => {
          if (typeof item.i === "number") analyses[item.i] = item;
        });
      }
    } catch (_) {}

    results.forEach((r, i) => {
      const a = analyses[i] || {};
      r.french_text      = clean(a.french_text)      || "Non documente";
      r.grade_explique   = clean(a.grade_explique)    || "Non documente";
      r.jarh_tadil       = clean(a.jarh_tadil)        || "Non documente";
      r.sanad_conditions = clean(a.sanad_conditions)  || "Non documente";
      r.avis_savants     = clean(a.avis_savants)      || "Non documente";
    });

    return res.status(200).json(results); // tableau direct attendu par index.html

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
