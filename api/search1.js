// ═══════════════════════════════════════════════════════════════════════════════
// MOTEUR MÎZÂN v9 — SSE RÉEL · ANTI-BUFFERING VERCEL · ISNAD 7e→21e SIÈCLE
// api/search.js — Prêt pour GitHub Push
// ═══════════════════════════════════════════════════════════════════════════════

export const maxDuration = 60;

const Anthropic = require("@anthropic-ai/sdk");
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM_TAKHRIJ v9
// ● Isnad 7e→21e siècle OBLIGATOIRE (format pipe strict)
// ● Terminologie authentique Jarh wa Ta'dil (zéro lexique de fer)
// ● Doctrine Salafiyyah pure — Albani · Ibn Baz · Ibn Uthaymin
// ● UN SEUL hadith par appel — UN SEUL objet JSON valide
// ═══════════════════════════════════════════════════════════════════════════════
const SYSTEM_TAKHRIJ = `\
Tu es un Hafidh de rang superieur, specialise en Takhrij, Jarh wa Ta'dil et Fiqh al-Hadith \
selon la methodologie des grands Imams de la Sunnah : \
Cheikh Abd al-Aziz ibn Baz, Cheikh Muhammad Nasir ad-Din al-Albani, \
et Cheikh Muhammad ibn Salih al-Uthaymin (rahimahumullah). \
Tu recois UN SEUL hadith. Tu produis UN SEUL objet JSON valide. \
Tu analyses le MATN ARABE fourni — jamais la requete utilisateur.

DOCTRINE DE REFERENCE : Aqidah Salafiyyah pure. \
Sources exclusives : Kutub al-Sittah, Musnad Ahmad, Muwatta Malik, \
Silsilah Sahihah et Da'ifah d Al-Albani, Fatawa Ibn Baz, Sharh d Ibn Uthaymin. \
ZERO citation de sources soufies, ash'arites, mu'tazilites ou modernistes.

PROTOCOLE MATN RECONNU — PRIORITE ABSOLUE : \
Si le matn arabe correspond a un hadith connu du corpus sunnite, \
tu DOIS exploiter integralement ta connaissance de ce hadith. \
INTERDICTION ABSOLUE d invoquer un manque d information sur un hadith mashhur ou mutawatir. \
Le champ french_text ne peut JAMAIS contenir 'n a pas pu etre etablie'. \
Le champ grade_explique ne peut JAMAIS contenir 'n a pas ete determine'. \
Le champ pertinence ne peut JAMAIS contenir 'Non evalue'. \
Si tu reconnais le matn : extrais immediatement la reference exacte (Bukhari, Muslim, no. precis), \
le verdict Al-Albani avec numero SS ou SD, et les rawis principaux avec leur tarjama Ibn Hajar.

INTERDICTIONS GENERALES : \
zero champ vide | zero 'Non documente' seul | zero translitteration dans french_text | \
zero repetition de la requete utilisateur dans french_text | \
zero phrase de repli si le hadith est identifiable | zero resume — TOUT en detail.

TERMINOLOGIE AUTHENTIQUE DU JARH WA TA'DIL (dictionnaire des Imams) — pour french_text ET jarh_tadil :
GRADES DE TA'DIL (du plus haut au plus bas) :
Thiqah Thabt = digne de confiance et exact | Thiqah = digne de confiance | \
Saduq = veridique | Saduq Yahimu = veridique mais commet des erreurs | \
Maqbul = accepte (si corrobore) | La ba'sa bihi = sans reproche.
GRADES DE JARH (du plus leger au plus severe) :
Layyin al-Hadith = souple en hadith | Da'if = faible | \
Munkar al-Hadith = reprehensible en hadith | Matruk = abandonne | \
Kadhdhab = menteur | Wada' = fabricateur de hadith.
TERMES DE DEFAUT ('Ilal) :
Illah = defaut cache | Inqita' = rupture de chaine | Tadlis = dissimulation | \
Irsal = omission du Sahabi | Mudtarib = contradictoire | Idtirab = confusion | \
Ikhtalat = deterioration memorielle | Jahalah = anonymat du rawi | Shudhudh = anomalie.
TERMES SIFAT (Attributs divins — traduction litterale obligatoire) :
istawa = S est etabli sur | Yad Allah = La Main d Allah | \
Nuzul = La Descente | Wajh Allah = Le Visage d Allah.

CHAMP french_text :
Traduction COMPLETE, LITTERALE, SOLENNELLE du matn arabe. Minimum 5 phrases. \
Style classique digne d un texte sacre. Chaque element du matn traduit fidelement. \
Ajoute le contexte de revelation (sabab al-wurud) si connu. \
Utilise <span style='color:#e8c96a;font-weight:bold;'>NOM_IMPORTANT</span> pour les noms propres importants.

CHAMP grade_explique :
CONTENU MASSIF OBLIGATOIRE. Minimum 4 lignes. \
Ligne 1 : <span style='color:[COULEUR];font-weight:bold;'>[VERDICT]</span> — [Savant], [Ouvrage], [no.]. \
Ligne 2 : Verdict d Al-Albani avec numero Silsilah exact. \
Ligne 3 : Verdict de Bin Baz si existant (Fatawa Bin Baz, tome/page). \
Ligne 4 : Explication detaillee de la raison du verdict (illah, shudhudh, etc.). \
Couleurs : #2ecc71=SAHIH | #f39c12=HASAN | #e74c3c=DA'IF | #8e44ad=MAWDU'. \
Separe chaque ligne par <br>.

CHAMP isnad_chain — FORMATAGE PIPE STRICT OBLIGATOIRE :
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGLES ABSOLUES ET NON NEGOCIABLES :
1. FORMAT UNIQUE PAR MAILLON (une ligne par maillon, separees par \\n) :
   Maillon N | NOM COMPLET DU RAWI | TITRE | VERDICT JARH WA TA'DIL | SIECLE
2. TITRES AUTORISES EXCLUSIVEMENT : Sahabi | Tabi_i | Tabi_Tabi_i | Muhaddith | Compilateur | Verificateur
3. VERDICTS JARH WA TA'DIL EXCLUSIVEMENT (terminologie authentique ci-dessus) :
   Ta'dil : Adul_par_Ijma | Thiqah_Thabt | Thiqah | La_Bas_Bihi | Saduq | Maqbul
   Jarh   : Da_if | Layyin | Munkar | Matruk | Kadhdhab | Mudallis | Majhul
4. CONTINUITE HISTORIQUE INTEGRALE DU 7e AU 21e SIECLE :
   ● Commence par le Sahabi (7e siecle) — le Prophete est implicitement au-dessus
   ● Inclus TOUS les intermediaires connus (Tabi_i, Tabi_Tabi_i, Muhaddithun)
   ● Inclus le Compilateur principal (Bukhari, Muslim, Tirmidhi, etc.) — 9e siecle
   ● TERMINE OBLIGATOIREMENT par les Verificateurs contemporains (20e/21e siecle) :
     → Al-Albani avec son verdict specifique sur ce hadith (authentifie / affaibli)
     → Ibn Baz avec son verdict (s il a commente ce hadith)
     → Ibn Uthaymin avec son verdict (s il a commente ce hadith)
5. INTERDICTION ABSOLUE de s arreter au 9e siecle. La chaine DOIT atteindre le 21e siecle.
6. ZERO PROSE. ZERO PHRASE. Format pipe uniquement.
7. VRAIS NOMS COMPLETS — pas de titres generiques comme "Les Savants".
8. Si Da_if ou Mawdu_ : identifie le maillon faible avec son verdict exact.
9. Minimum 8 maillons (Sahabi + intermediaires + Compilateur + 3 verificateurs contemporains).
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXEMPLE CANONIQUE (hadith des intentions) :
Maillon 1 | Umar ibn al-Khattab al-Faruq | Sahabi | Adul_par_Ijma | 7e siecle
Maillon 2 | Alqamah ibn Waqqas al-Laythi | Tabi_i | Thiqah | 7e siecle
Maillon 3 | Muhammad ibn Ibrahim at-Taymi | Tabi_i | Thiqah | 8e siecle
Maillon 4 | Yahya ibn Said al-Ansari | Muhaddith | Thiqah_Thabt | 8e siecle
Maillon 5 | Sufyan ibn Uyaynah | Muhaddith | Thiqah_Thabt | 8e siecle
Maillon 6 | Al-Imam Muhammad ibn Ismail al-Bukhari | Compilateur | Amir_al-Mu_minin_fil_Hadith | 9e siecle
Maillon 7 | Al-Imam Abu al-Husayn Muslim ibn al-Hajjaj | Compilateur | Imam_Sahih_Muslim | 9e siecle
Maillon 8 | Cheikh Muhammad Nasir ad-Din al-Albani | Verificateur | Muhaddith_al-Asr | 20e siecle — Authentifie SS no.1
Maillon 9 | Cheikh Abd al-Aziz ibn Baz | Verificateur | Mufti_General_KSA | 20e siecle — Confirme l authenticite
Maillon 10 | Cheikh Muhammad ibn Salih al-Uthaymin | Verificateur | Imam_Najd | 20e-21e siecle — Reference dans Sharh Riyadh

CHAMP jarh_tadil :
CONTENU MASSIF OBLIGATOIRE. Analyse nominative de TOUS les rawis de la chaine (minimum 3). \
Pour CHAQUE rawi : \
<span style='color:#5dade2;font-weight:bold;'>[NOM_RAWI]</span> : \
verdict complet Ibn Hajar (Taqrib al-Tahdhib, no.) — \
verdict Al-Dhahabi (Mizan al-I'tidal / Siyar) si different — \
verdict Al-Albani sur ce rawi si existant. \
Identifie l Illah PRECISE si hadith faible : tadlis, inqita', ikhtalat, jahala, etc. \
Separe chaque rawi par <br><br>.

CHAMP sanad_conditions :
Les 5 conditions d Ibn al-Salah (Muqaddimah) avec analyse DETAILLEE pour chacune : \
1. <span style='color:#d4af37;font-weight:bold;'>ITTISAL AL-SANAD</span> (Continuite) : [analyse detaillee]. \
2. <span style='color:#d4af37;font-weight:bold;'>ADALAT AR-RUWAT</span> (Probite) : [analyse detaillee]. \
3. <span style='color:#d4af37;font-weight:bold;'>DABT AR-RUWAT</span> (Precision) : [analyse detaillee]. \
4. <span style='color:#d4af37;font-weight:bold;'>ADAM ASH-SHUDHUDH</span> (Absence d anomalie) : [analyse detaillee]. \
5. <span style='color:#d4af37;font-weight:bold;'>ADAM AL-ILLAH</span> (Absence de defaut cache) : [analyse detaillee]. \
Conclure : <span style='color:#2ecc71;'>REMPLIE</span> ou <span style='color:#e74c3c;'>DEFAILLANTE — [raison]</span> pour chaque condition. \
Separe chaque condition par <br><br>.

CHAMP avis_savants : CONTENU MASSIF — minimum 5 paragraphes. Separe par <br><br>. \
P1 : <strong>Al-Imam Al-Bukhari</strong> : son verdict dans At-Tarikh al-Kabir ou Al-Jami'. \
P2 : <strong>Al-Imam Muslim</strong> / <strong>Ahmad ibn Hanbal</strong> : leurs verdicts. \
P3 : <strong>Ibn Hajar al-Asqalani</strong> : cite Fath al-Bari, Bulugh al-Maram, ou Taqrib. Arguments complets. \
P4 : <strong>Al-Dhahabi</strong> : cite Talkhis al-Mustadrak, Mizan al-I'tidal, ou Siyar. Arguments complets. \
P5 : <strong>Al-Albani</strong> : cite son verdict COMPLET avec le raisonnement entier \
tel qu il l a formule dans Silsilah Sahihah/Da'ifah, Irwa' al-Ghalil, ou Sahih/Da'if al-Jami'. \
Reproduis ses arguments, pas un resume. Numero exact obligatoire. \
Si DA'IF ou MAWDU' : <span style='color:#e74c3c;font-weight:bold;'>AVERTISSEMENT</span> \
suivi de la mise en garde de Bin Baz ou Ibn Uthaymin sur la citation de hadiths faibles.

CHAMP grille_albani :
RAPPORT COMPLET ET DETAILLE d Al-Albani sur ce hadith. Minimum 6 lignes. Separe par <br><br>. \
Ligne 1 : <span style='color:#f39c12;font-weight:bold;'>Al-Albani</span> : Verdict + numero exact (SS no. X ou SD no. X). \
Ligne 2 : Ouvrage(s) ou Al-Albani a traite ce hadith (Silsilah, Irwa', Sahih/Da'if al-Jami', Takhrij Mishkat). \
Ligne 3 : Methode de Tashih ou Ta'dif utilisee par Al-Albani — reproduis son raisonnement complet. \
Ligne 4 : Rawis specifiques evalues par Al-Albani dans cette chaine — cite ses verdicts textuels. \
Ligne 5 : Divergences avec d autres Muhaddithin (Ibn Hajar, Al-Dhahabi, Ahmad Shakir) et reponse d Al-Albani. \
Ligne 6 : Cite la parole de <span style='color:#f39c12;font-weight:bold;'>Bin Baz</span> ou \
<span style='color:#f39c12;font-weight:bold;'>Ibn Uthaymin</span> sur ce hadith si elle existe \
(Fatawa Bin Baz, Sharh Riyadh as-Salihin d Ibn Uthaymin, Liqaat al-Bab al-Maftuh).

CHAMP pertinence : OUI ou PARTIEL ou NON uniquement — zero phrase, zero explication dans ce champ.

REGLE ABSOLUE DE FORMAT — VIOLATION = ECHEC TOTAL :
Ta reponse doit commencer par { et finir par }.
ZERO texte avant le {. ZERO texte apres le }.
ZERO bonjour. ZERO introduction. ZERO explication. ZERO backtick. ZERO markdown.
COMMENCE TA REPONSE PAR { ET TERMINE PAR } — RIEN D'AUTRE.
{"i":0,"french_text":"...","grade_explique":"...","isnad_chain":"Maillon 1 | Nom | Titre | Verdict | Siecle\\nMaillon 2 | ...","jarh_tadil":"...","sanad_conditions":"...","avis_savants":"...","grille_albani":"...","pertinence":"..."}`;

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM_TARJAMA — Haiku traducteur FR→AR (prompt minimal)
// ═══════════════════════════════════════════════════════════════════════════════
const SYSTEM_TARJAMA =
  "Convertis en arabe pour recherche Dorar.net. " +
  "Si citation de hadith connue : retourne le debut exact du matn arabe. " +
  "Ex: 'les actes ne valent que par les intentions' -> إنما الأعمال بالنيات. " +
  "Si theme general : mot arabe principal uniquement. " +
  "UNIQUEMENT le texte arabe. Maximum 8 mots. Zero explication.";

// ═══════════════════════════════════════════════════════════════════════════════
// HADITHS_CELEBRES — court-circuit prioritaire, zéro latence
// ═══════════════════════════════════════════════════════════════════════════════
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
  { p: ["misericorde","rahma","misericordieux"],    ar: "الرحمة" },
  { p: ["patience","sabr"],                        ar: "الصبر" },
  { p: ["repentir","tawbah"],                      ar: "التوبة" },
  { p: ["science","connaissance","ilm"],           ar: "العلم" },
  { p: ["foi","iman","croyance"],                  ar: "الإيمان" },
  { p: ["priere","salat","namaz"],                 ar: "الصلاة" },
  { p: ["jeune","siyam","ramadan"],                ar: "الصيام" },
  { p: ["aumone","sadaqa","zakat"],                ar: "الصدقة" },
  { p: ["pardon","maghfirah"],                     ar: "المغفرة" },
  { p: ["orgueil","kibr"],                         ar: "الكبر" },
  { p: ["jalousie","hasad"],                       ar: "الحسد" },
  { p: ["medisance","ghiba"],                      ar: "الغيبة" },
  { p: ["pudeur","haya"],                          ar: "الحياء" },
  { p: ["sincerite","ikhlas"],                     ar: "الإخلاص" },
  { p: ["parents","walidayn","mere","pere"],        ar: "الوالدين" },
  { p: ["mariage","nikah"],                        ar: "الزواج" },
  { p: ["mort","mawt"],                            ar: "الموت" },
  { p: ["paradis","janna"],                        ar: "الجنة" },
  { p: ["enfer","jahannam"],                       ar: "النار" },
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
      model: "claude-haiku-4-5-20251001",
      max_tokens: 60,
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

// ═══════════════════════════════════════════════════════════════════════════════
// extractJSON — INCASSABLE
// Trouve le JSON même si : texte avant/après | backticks | JSON partiel
// ═══════════════════════════════════════════════════════════════════════════════
function extractJSON(text) {
  if (!text) return null;

  // Étape 1 : strip backticks
  let t = text.replace(/```[a-z]*\n?/gi, "").trim();

  // Étape 2 : tentative parse direct
  try { return JSON.parse(t); } catch (_) {}

  // ⛔️ SANCTUAIRE AL-MIZÂN : EXTRACTEUR JSON — NE JAMAIS MODIFIER
  // SYSTEM_TAKHRIJ v9 produit un objet {}, jamais un tableau [].
  // Étape 3 : chercher un objet JSON { } en priorité
  const mObj = t.match(/\{[\s\S]*\}/);
  if (mObj) {
    try { return JSON.parse(mObj[0]); } catch (_) {}
  }

  // Étape 4 : fallback tableau legacy (rétro-compatibilité)
  const mArr = t.match(/\[[\s\S]*\]/);
  if (mArr) {
    try { return JSON.parse(mArr[0]); } catch (_) {}
  }

  // Étape 5 : objet tronqué — reconstruction jusqu'à la dernière accolade complète
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

  console.log("EXTRACT_JSON_FAILED: impossible de récupérer le JSON");
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALEURS PAR DÉFAUT — jamais de champ vide dans la réponse finale
// ═══════════════════════════════════════════════════════════════════════════════
const DEFAULTS = {
  french_text:
    "La traduction de ce texte n a pas pu etre etablie par le systeme d analyse. " +
    "Veuillez consulter un traducteur specialise en textes hadithiques classiques " +
    "ou vous referer a la source originale sur Dorar.net.",
  grade_explique:
    "Le verdict authentificationnel de ce hadith n a pas ete determine avec certitude. " +
    "Consultez les ouvrages de Takhrij : Silsilah Sahihah et Da'ifah d Al-Albani, " +
    "ou le Mustadrak d Al-Hakim avec le Talkhis d Al-Dhahabi.",
  isnad_chain: "",
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
  grille_albani:
    "Le rapport detaille d Al-Albani n a pas pu etre genere pour ce hadith. " +
    "Consultez directement : Silsilah al-Ahadith as-Sahihah, Silsilah al-Ahadith ad-Da'ifah, " +
    "Irwa' al-Ghalil, Sahih al-Jami' et Da'if al-Jami' de Cheikh Al-Albani (rahimahullah).",
  pertinence: "NON"
};

function clean(s) {
  return (s || "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
}

function safeField(value, key) {
  if (key === "isnad_chain") return clean(value) || "";
  const v = clean(value);
  return (v && v.length >= 10) ? v : DEFAULTS[key];
}

// ═══════════════════════════════════════════════════════════════════════════════
// extractInfoValue — HTML Dorar confirmé
// ═══════════════════════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════════════════════
// parseHadiths — regex stricte class="hadith" (PAS hadith-info)
// ═══════════════════════════════════════════════════════════════════════════════
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
      french_text: "", grade_explique: "", isnad_chain: "", jarh_tadil: "",
      sanad_conditions: "", avis_savants: "", grille_albani: "", pertinence: ""
    });
  }

  // Fallback : blocs arabes bruts si aucun div.hadith trouvé
  if (results.length === 0) {
    console.log("FALLBACK: arabe brut");
    const blks = html.match(
      /[\u0600-\u06FF][\u0600-\u06FF\s،؛,.!؟\u064B-\u065F]{30,600}/g
    ) || [];
    for (const blk of blks.slice(0, 2)) {
      const text = blk.replace(/\s+/g, " ").trim();
      if (text.length >= 30)
        results.push({
          arabic_text: text, grade: "غير محدد", savant: "", source: "", rawi: "",
          french_text: "", grade_explique: "", isnad_chain: "", jarh_tadil: "",
          sanad_conditions: "", avis_savants: "", grille_albani: "", pertinence: ""
        });
    }
  }

  console.log("PARSED:", results.length, "hadiths");
  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// fetchWithTimeout — fetch avec AbortController
// ═══════════════════════════════════════════════════════════════════════════════
function fetchWithTimeout(url, options, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

// ═══════════════════════════════════════════════════════════════════════════════
// SSE HELPERS — Envoi progressif au frontend avec flush immédiat
// ═══════════════════════════════════════════════════════════════════════════════
function sseWrite(res, event, data) {
  const payload = "event: " + event + "\ndata: " + JSON.stringify(data) + "\n\n";
  res.write(payload);
  // Flush immédiat : si Express/Vercel expose flush(), on l'appelle
  if (typeof res.flush === "function") res.flush();
}

// ═══════════════════════════════════════════════════════════════════════════════
// analyserUnHadith — Streaming Anthropic, isnad 7e→21e siècle
// ═══════════════════════════════════════════════════════════════════════════════
async function analyserUnHadith(r, idx, q) {
  const prompt =
    "REQUETE_ORIGINALE_UTILISATEUR: " + q + "\n\n" +
    "[" + idx + "]\n" +
    "Matn : " + r.arabic_text + "\n" +
    "Grade Dorar : " + r.grade + "\n" +
    "Savant : " + r.savant + "\n" +
    "Source : " + r.source + "\n" +
    "Rawi : " + r.rawi + "\n\n" +
    "RAPPEL ISNAD : La chaine DOIT obligatoirement se terminer par les Verificateurs " +
    "contemporains (Al-Albani, Ibn Baz, Ibn Uthaymin) au 20e/21e siecle. " +
    "Minimum 8 maillons. Format pipe strict obligatoire.";

  // ⛔️ SANCTUAIRE AL-MIZÂN : SÉCURITÉ SDK ANTHROPIC — NE JAMAIS MODIFIER
  // INTERDICTION ABSOLUE de placer 'signal' ou 'AbortController' dans les paramètres ici.
  // Vercel coupe à 60s — le maxDuration=60 en export suffit comme garde-fou.
  try {
    let rawText = "";
    const stream = client.messages.stream({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8192,
      system: SYSTEM_TAKHRIJ,
      messages: [{ role: "user", content: prompt }]
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta?.text) {
        rawText += event.delta.text;
      }
    }

    console.log("HADITH[" + idx + "]_RAW_LEN:", rawText.length);
    console.log("HADITH[" + idx + "]_RAW:", rawText.substring(0, 300));

    let parsed = extractJSON(rawText);
    if (Array.isArray(parsed)) parsed = parsed[0] || null;
    console.log("HADITH[" + idx + "]_PARSE:", parsed ? "OK" : "ECHEC");
    return parsed;
  } catch (e) {
    console.log("HADITH[" + idx + "]_ERR:", e.message);
    return null;
  }
  // ⛔️ FIN DU SANCTUAIRE
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL — SSE PROGRESSIF + FALLBACK JSON
// Headers anti-buffering Vercel obligatoires
// ═══════════════════════════════════════════════════════════════════════════════
module.exports = async (req, res) => {

  // ── CORS ──────────────────────────────────────────────────────────────────
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  if (req.method === "OPTIONS") return res.status(200).end();

  const q = req.body?.q || req.query?.q;
  if (!q) return res.status(400).json({ error: "Requete vide" });
  console.log("DEBUT_RECHERCHE — method:", req.method, "| q:", q);

  // ── DÉTECTION MODE SSE ────────────────────────────────────────────────────
  // Si le frontend envoie Accept: text/event-stream → mode SSE progressif
  // Sinon → mode JSON classique (rétro-compatible)
  const wantSSE = (req.headers.accept || "").includes("text/event-stream");

  if (wantSSE) {
    // ── HEADERS ANTI-BUFFERING VERCEL (CRITIQUES POUR LE STREAMING) ──────────
    // X-Accel-Buffering: no  → désactive le buffering nginx/Vercel Edge
    // Cache-Control: no-cache, no-transform → empêche toute mise en tampon proxy
    // Connection: keep-alive → maintient la connexion SSE ouverte
    res.setHeader("Content-Type",       "text/event-stream; charset=utf-8");
    res.setHeader("X-Accel-Buffering",  "no");
    res.setHeader("Cache-Control",      "no-cache, no-transform");
    res.setHeader("Connection",         "keep-alive");
    res.setHeader("Transfer-Encoding",  "chunked");
    // Flush immédiat des headers
    if (typeof res.flushHeaders === "function") res.flushHeaders();
    sseWrite(res, "status", { step: "TRADUCTION", msg: "Conversion FR → AR..." });
  }

  try {
    // ── ÉTAPE 1 : FR→AR ───────────────────────────────────────────────────────
    let arabicQuery = frToArFast(q);
    const src = arabicQuery ? "DICT_FAST" : "HAIKU_TARJAMA";
    if (!arabicQuery) arabicQuery = await frToArHaiku(q);
    console.log("ARABIC_QUERY_SOURCE:", src, "| VALUE:", arabicQuery);

    if (wantSSE) sseWrite(res, "status", { step: "DORAR", msg: "Interrogation Dorar.net..." });

    // ── ÉTAPE 2 : DORAR ───────────────────────────────────────────────────────
    const dorarResp = await fetchWithTimeout(
      "https://dorar.net/dorar_api.json?skey=" + encodeURIComponent(arabicQuery),
      { headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://dorar.net/" } },
      8000
    );
    if (!dorarResp.ok) throw new Error("Dorar HTTP " + dorarResp.status);

    const dorarData = await dorarResp.json();
    const html = dorarData?.ahadith?.result || "";
    console.log("HTML_LEN:", html.length);

    if (!html || html.length < 20) {
      console.log("DORAR_EMPTY");
      if (wantSSE) { sseWrite(res, "done", []); res.end(); return; }
      return res.status(200).json([]);
    }

    // ── ÉTAPE 3 : PARSE ───────────────────────────────────────────────────────
    const results = parseHadiths(html);
    if (!results.length) {
      console.log("PARSE_EMPTY");
      if (wantSSE) { sseWrite(res, "done", []); res.end(); return; }
      return res.status(200).json([]);
    }

    if (wantSSE) {
      // Envoi immédiat des données Dorar brutes :
      // le frontend affiche le matn arabe + grade PENDANT que l'IA analyse
      sseWrite(res, "dorar", results);
      sseWrite(res, "status", {
        step:  "TAKHRIJ",
        msg:   "Analyse Jarh wa Ta'dil en cours — Isnad 7e→21e siècle...",
        count: results.length
      });
    }

    // ── ÉTAPE 4 : ANALYSE IA — PARALLÈLE + LIVRAISON PROGRESSIVE ─────────────
    console.log("PARALLEL_CALL: lancement", results.length, "appels IA");

    if (wantSSE) {
      // MODE SSE : envoyer chaque hadith dès qu'il est prêt
      const promises = results.map((r, i) =>
        analyserUnHadith(r, i, q).then(parsed => {
          const a = parsed || {};
          r.french_text      = safeField(a.french_text,      "french_text");
          r.grade_explique   = safeField(a.grade_explique,   "grade_explique");
          r.isnad_chain      = safeField(a.isnad_chain,      "isnad_chain");
          r.jarh_tadil       = safeField(a.jarh_tadil,       "jarh_tadil");
          r.sanad_conditions = safeField(a.sanad_conditions, "sanad_conditions");
          r.avis_savants     = safeField(a.avis_savants,     "avis_savants");
          r.grille_albani    = safeField(a.grille_albani,    "grille_albani");
          r.pertinence       = safeField(a.pertinence,       "pertinence");
          // Envoi immédiat de ce hadith enrichi au frontend
          sseWrite(res, "hadith", { index: i, data: r });
          console.log("SSE_HADITH[" + i + "] envoyé — isnad_chain len:", r.isnad_chain.length);
          return r;
        })
      );
      await Promise.all(promises);
      sseWrite(res, "done", results);
      res.end();

    } else {
      // MODE JSON CLASSIQUE (rétro-compatible)
      const analysesArray = await Promise.all(
        results.map((r, i) => analyserUnHadith(r, i, q))
      );
      console.log(
        "PARALLEL_DONE:", analysesArray.filter(Boolean).length,
        "succès /", results.length
      );

      results.forEach((r, i) => {
        const a = analysesArray[i] || {};
        r.french_text      = safeField(a.french_text,      "french_text");
        r.grade_explique   = safeField(a.grade_explique,   "grade_explique");
        r.isnad_chain      = safeField(a.isnad_chain,      "isnad_chain");
        r.jarh_tadil       = safeField(a.jarh_tadil,       "jarh_tadil");
        r.sanad_conditions = safeField(a.sanad_conditions, "sanad_conditions");
        r.avis_savants     = safeField(a.avis_savants,     "avis_savants");
        r.grille_albani    = safeField(a.grille_albani,    "grille_albani");
        r.pertinence       = safeField(a.pertinence,       "pertinence");
      });

      console.log("SUCCESS:", results.length, "hadiths enrichis");
      return res.status(200).json(results);
    }

  } catch (error) {
    console.log("ERROR:", error.message);
    if (wantSSE) {
      sseWrite(res, "error", { message: error.message });
      res.end();
    } else {
      return res.status(500).json({ error: error.message });
    }
  }
};
