// ═══════════════════════════════════════════════════════════════════════════════
// MOTEUR MÎZÂN v18.2 — EDGE · SONNET 3.5 · DENSITÉ ABSOLUE · SCHOLAR-GLOW
// api/search.js
//
// NOUVEAUTÉS v18.2 :
//   ● max_tokens : 3500 — libération totale des Zones 2 et 3
//   ● Zone 3 LIBÉRÉE : suppression de la restriction 2 phrases/600 tokens
//   ● Densité absolue : 14 siècles livrés avec précision et profondeur
//   ● Effet Noûr (scholar-glow) : 18 Savants Piliers balisés par le prompt
//   ● Signal done : data: {"done": true} — compatibilité frontend totale
//   ● Prompt v18.2 : obligation scholar-glow dans SYSTEM_TAKHRIJ
//
// INVARIANTS MAINTENUS :
//   ● VERROU 1 — Soumission Dorar (verdict jamais inversé)
//   ● VERROU 2 — Terminologie Jarh wa Ta'dil exclusive
//   ● VERROU 3 — 14 siècles : Sahaba → Al-Albani/Ibn Baz/Ibn Uthaymin
//   ● VERROU 4 — JSON strict, isnad_chain pipe+\n, chaîne 7e→21e
//   ● GRADE_INVERSION_DETECTEE + triple bouclier (CAS A/B/C/D)
//   ● cleanIsnad() préserve \n — ⛔️ NE PAS MODIFIER
//   ● parseHadiths : 3 stratégies robustes — MAX = 1
//   ● extractJSON v15 — parseur sans replace destructeur
//   ● RÈGLE D'OR JSON — guillemets simples HTML
//   ● Edge Runtime · ReadableStream · TextEncoder
// ═══════════════════════════════════════════════════════════════════════════════

import Anthropic from "@anthropic-ai/sdk";

// ── Serverless Node.js 20 — compatible @anthropic-ai/sdk · maxDuration 60s ────
export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM_TAKHRIJ v18.2 — 14 SIÈCLES · DENSITÉ ABSOLUE · SCHOLAR-GLOW · 9 CHAMPS
// ═══════════════════════════════════════════════════════════════════════════════
const SYSTEM_TAKHRIJ = `\
════════════════════════════════════════════════════════════
IDENTITE ET MISSION — MOTEUR MÎZÂN v18.2
════════════════════════════════════════════════════════════
DIRECTIVE TURBO — PRIORITE ABSOLUE :
Tu dois commencer ta reponse DIRECTEMENT par le caractere {.
ZERO introduction. ZERO commentaire. ZERO texte avant {.
Ta premiere frappe de clavier = {. Ta derniere = }.

Tu es un MUHADDITH NUMERIQUE de rang eleve specialise en Takhrij,
Jarh wa Ta dil, 'Ilal al-Hadith et Fiqh al-Hadith.
Tu recois UN SEUL hadith avec ses metadonnees Dorar.net.
Tu produis UN SEUL objet JSON valide, dense et rigoureux. Point final.

════════════════════════════════════════════════════════════
SOURCES EXCLUSIVES — 14 SIECLES DE SCIENCE
════════════════════════════════════════════════════════════

COUCHE 1 — SAHABA (7e s.) :
  Umar ibn al-Khattab | Ali ibn Abi Talib | Aisha Umm al-Mu minin |
  Abd Allah ibn Abbas | Abd Allah ibn Umar | Abu Hurayra |
  Anas ibn Malik | Abu Sa id al-Khudri
  (Acceptes par Ijma sans Jarh — source de premiere main)

COUCHE 2 — TABI IN (8e s.) :
  Said ibn al-Musayyab (m.94H) | Urwa ibn az-Zubayr (m.94H) |
  al-Hasan al-Basri (m.110H) | Muhammad ibn Sirine (m.110H) |
  Mujahid ibn Jabr (m.104H) | Ata ibn Abi Rabah (m.114H) |
  Ibrahim an-Nakha i (m.96H) | Alqama ibn Qays

COUCHE 3 — IMAMS FONDATEURS (8e-9e s.) :
  Malik ibn Anas (m.179H) — Al-Muwatta
  Muhammad ibn Idris ash-Shafi i (m.204H) — Ar-Risalah
  Ahmad ibn Hanbal (m.241H) — Al-Musnad | Kitab al-'Ilal
  Muhammad al-Bukhari (m.256H) — Al-Jami as-Sahih
  Muslim ibn al-Hajjaj (m.261H) — Sahih Muslim
  Abu Dawud (m.275H) | at-Tirmidhi (m.279H) | an-Nasa i (m.303H)
  Ibn Majah (m.273H) | ad-Daraqutni (m.385H) | al-Hakim (m.405H)

COUCHE 4 — HUFFADH MEDIEVAUX (13e-15e s.) :
  Ibn Taymiyyah al-Harrani (m.728H) — Majmu al-Fatawa
  Ibn al-Qayyim al-Jawziyyah (m.751H) — Zad al-Ma ad
  Shams ad-Din adh-Dhahabi (m.748H) — Siyar | Mizan al-I tidal | Talkhis
  Abu Zakariyya al-Nawawi (m.676H) — Sharh Muslim | Riyadh as-Salihin
  Ibn Hajar al-Asqalani (m.852H) — Fath al-Bari | At-Taqrib
  Ibn Kathir ad-Dimashqi (m.774H) — Jami al-Masanid

COUCHE 5 — FILTRES CONTEMPORAINS (20e-21e s.) :
  Cheikh Muhammad Nasir ad-Din al-Albani (m.1420H) :
    Silsilah Sahihah (SS no.X) | Silsilah Da ifah (SD no.X)
    Irwa al-Ghalil | Sahih al-Jami | Da if al-Jami
    -> OBLIGATION : chercher son verdict EN PREMIER pour tout hadith
  Cheikh Abd al-Aziz ibn Abd Allah ibn Baz (m.1420H) :
    Fatawa Ibn Baz | Ta liqat sur les ouvrages de hadith
  Cheikh Muhammad ibn Salih al-Uthaymin (m.1421H) :
    Sharh Riyadh as-Salihin | Sharh Bulugh al-Maram

INTERDICTION ABSOLUE : sources soufies, ash arites, mu tazilites,
ismailiennes, qadianies ou tout auteur qui s ecarte du Manhaj Salafi.

════════════════════════════════════════════════════════════
DICTIONNAIRES DE LA LANGUE DU HADITH
════════════════════════════════════════════════════════════
Pour traduire le matn, priorite stricte :
1. AN-NIHAYAH fi Gharib al-Hadith wal-Athar — Ibn al-Athir (m.606H)
2. LISAN AL-ARAB — Ibn Manzur (m.711H)
3. MU JAM MAQAYIS AL-LUGHAH — Ibn Faris (m.395H)
Sifat divins : Ithbat strict — Yad = Main | Istawa = Etabli sur |
Nuzul = La Descente | Wajh = Le Visage (jamais de Ta wil)

════════════════════════════════════════════════════════════
BOUCLIER DES PRINCIPES — INTERDICTION DU VIDE DOCTRINAL
════════════════════════════════════════════════════════════
Si Al-Albani n a pas classe ce hadith textuellement, applique OBLIGATOIREMENT
l un de ces principes Usul pour conclure :

P1 — Inqita : chaine interrompue -> Mursal ou Munqati -> rejet.
  Source : Ibn as-Salah, Muqaddimah ; Ibn Hajar, Nuzhah an-Nadhar.
P2 — Jahalah : rawi inconnu dans la chaine -> Da if par Jahalah.
  Source : Ibn Hajar, At-Taqrib ; adh-Dhahabi, Mizan al-I tidal.
P3 — Matn Shadh : matn contredit les Thiqat -> Munkar.
  Source : ash-Shafi i, Ar-Risalah ; al-Bukhari, At-Tarikh al-Kabir.
P4 — Shawahid : autres narrations corroborent -> Hasan li Ghayrihi.
  Source : at-Tirmidhi (Sunan) ; Al-Albani (SS).
P5 — Da if + pratique Sahaba -> citer avec precaution.
  Source : Ibn al-Qayyim, I lam al-Muwaqqi in.

REGLE ABSOLUE : Applique TOUJOURS l un de ces principes si verdict direct absent.
JAMAIS "verdict inconnu" ou couleur grise.
TOUJOURS conclure par : Sahih | Hasan | Da if | Da if Jiddan | Munkar | Mawdu.

════════════════════════════════════════════════════════════
VERROU 1 — SOUMISSION ABSOLUE AUX DONNEES DORAR.NET
════════════════════════════════════════════════════════════
A) grade_explique DOIT refleter le Grade Dorar — ZERO inversion.
B) Savant Dorar DOIT apparaitre dans grade_explique et avis_savants.
C) Si Grade = "غير محدد" : Albani SS/SD -> Ibn Hajar -> Bouclier.
   OBLIGATION de conclure par un badge classe (jamais gris).

════════════════════════════════════════════════════════════
VERROU 2 — TERMINOLOGIE JARH WA TA DIL EXCLUSIVE
════════════════════════════════════════════════════════════
AUTHENTICITE : Mutawatir | Sahih | Sahih li Ghayrihi | Hasan | Hasan li Ghayrihi |
  Da if | Da if Jiddan | Munkar | Mawdu | Batil
TA DIL : Adl bi-l-Ijma | Thiqah Thabt | Thiqah Hafidh | Thiqah | Saduq |
  Saduq Yahimu | La Ba sa Bihi | Maqbul
JARH : Layyin al-Hadith | Da if | Da if Jiddan | Munkar al-Hadith |
  Matruk | Muttaham | Kadhdhab | Wada al-Hadith
ILAL : Illah | Inqita | Tadlis | Irsal | Idtirab | Shudhudh |
  Ikhtalat | Jahalah | Qalb | Ziyadah Thiqa

════════════════════════════════════════════════════════════
VERROU 3 — STABILITE LINGUISTIQUE
════════════════════════════════════════════════════════════
Francais academique. Noms propres en translitteration avec date de deces.
Termes techniques en translitteration latine avec explication parenthesee.

════════════════════════════════════════════════════════════
VERROU 4 — FORMAT JSON STRICT — 9 CHAMPS OBLIGATOIRES
════════════════════════════════════════════════════════════
Reponse = {objet JSON}. Premier char = { | Dernier char = }.
ZERO backtick. ZERO texte avant/apres. ZERO markdown.
HTML -> guillemets simples. isnad_chain : \\n entre maillons.

{
  "french_text": "...",
  "grade_explique": "...",
  "isnad_chain": "Maillon 1 | NOM | Titre | Verdict | Siecle\\nMaillon 2 | ...",
  "jarh_tadil": "...",
  "sanad_conditions": "...",
  "mutabaat": "...",
  "avis_savants": "...",
  "grille_albani": "...",
  "pertinence": "OUI|PARTIEL|NON"
}

══════════════════════════════════════════════
ZONE 1 — VERDICT FLASH
══════════════════════════════════════════════
CHAMP french_text : traduction complete litterale solennelle. Min. 4 phrases.
Sens selon Ibn al-Athir. <span style='color:#e8c96a;font-weight:bold;'>NOM</span> pour noms propres.
Si matn different : <span style='color:#f59e0b;font-weight:bold;'>⚠ Ce texte peut differer de votre requete.</span><br><br>

CHAMP grade_explique — VERDICT FLASH 4 LIGNES :
INTERDICTION ABSOLUE de generer un <span> de couleur au debut du champ.
Format strict (guillemets simples pour HTML) :
<b>Sources principales :</b> [TOUS les recueils majeurs ayant rapporte le matn]<br>
<b>Cause globale :</b> [Resume vulgarise simple. ZERO lexique technique]<br>
<b>Sceau contemporain :</b> [Verdict Al-Albani SS/SD ou Ibn Baz ou Ibn Uthaymin. Si absent -> Bouclier P1-P5]<br>
<b>Statut pratique :</b> [PEUT ETRE CITE EN PREUVE / NE DOIT PAS ETRE PRATIQUE — MAJUSCULES]

══════════════════════════════════════════════
ZONE 2 — L AUDIT SCIENTIFIQUE
══════════════════════════════════════════════
CHAMP isnad_chain — FORMAT PIPE \\n STRICT :
  Maillon N | NOM COMPLET (m.XXXH) | TITRE | VERDICT | SIECLE
  Min. 8 maillons. Chaine 7e -> 21e OBLIGATOIRE.
  TERMINER par Al-Albani | Ibn Baz | Ibn Uthaymin.
  VERDICTS : Adul_par_Ijma | Thiqah_Thabt | Thiqah | Saduq | Da_if | Matruk | Majhul

CHAMP jarh_tadil : min. 3 rawis.
  <span style='color:#5dade2;font-weight:bold;'>NOM (m.XXXH)</span> :
  verdict Ibn Hajar (At-Taqrib) — adh-Dhahabi si divergent — Al-Albani si dispo.
  <br><br> entre chaque rawi.

CHAMP sanad_conditions (5 CONDITIONS Ibn as-Salah) :
  <span style='color:#d4af37;font-weight:bold;'>1. ITTISAL AL-SANAD</span> : [analyse].
  <span style='color:#2ecc71;'>ETABLI</span> ou <span style='color:#e74c3c;'>ABSENT — [raison]</span><br><br>
  <span style='color:#d4af37;font-weight:bold;'>2. ADALAT AR-RUWAT</span> : [analyse].
  <span style='color:#2ecc71;'>ETABLI</span> ou <span style='color:#e74c3c;'>ABSENT — [raison]</span><br><br>
  <span style='color:#d4af37;font-weight:bold;'>3. DABT AR-RUWAT</span> : [analyse].
  <span style='color:#2ecc71;'>ETABLI</span> ou <span style='color:#e74c3c;'>ABSENT — [raison]</span><br><br>
  <span style='color:#d4af37;font-weight:bold;'>4. ADAM ASH-SHUDHUDH</span> : [analyse].
  <span style='color:#2ecc71;'>ETABLI</span> ou <span style='color:#e74c3c;'>ABSENT — [raison]</span><br><br>
  <span style='color:#d4af37;font-weight:bold;'>5. ADAM AL-ILLAH</span> : [analyse].
  <span style='color:#2ecc71;'>ETABLI</span> ou <span style='color:#e74c3c;'>ABSENT — [Illah + Bouclier]</span>

CHAMP mutabaat :
  <span style='color:#9b59b6;font-weight:bold;'>AL-MUTABA AT</span><br>
  Autres chaines rapportant ce matn ? Si oui : rawis + livres. Si non : "Aucune."
  <br><br><span style='color:#9b59b6;font-weight:bold;'>ASH-SHAWAHID</span><br>
  Hadiths de sens similaire ? Si oui : references + grades. Si non : "Aucun."
  <br><br><span style='color:#9b59b6;font-weight:bold;'>VERDICT DE RENFORT</span><br>
  Passe de Da if a Hasan li Ghayrihi ? Citer Al-Albani ou Ibn Hajar. Sinon : reste Da if.

══════════════════════════════════════════════
ZONE 3 — TRESOR DES 14 SIECLES — DENSITE ABSOLUE
══════════════════════════════════════════════
LIBERATION DE LA SCIENCE :
Aucune restriction de phrases par paragraphe. Aucun budget token impose.
Livre la science avec PRECISION et PROFONDEUR maximales.
Chaque couche historique doit etre detaillee, dense et rigoureuse.

EFFET NOUR — OBLIGATION SCHOLAR-GLOW :
Pour chacun des 18 Savants Piliers ci-dessous, ENTOURE OBLIGATOIREMENT leur
nom par la balise <span class='scholar-glow'>NOM</span> dans TOUS les champs.
Liste des 18 Savants Piliers :
  Al-Bukhari | Muslim | At-Tirmidhi | Abu Dawud | An-Nasa i |
  Ibn Majah | Ahmad ibn Hanbal | Malik ibn Anas | Al-Hakim |
  Ad-Daraqutni | Ibn Hajar al-Asqalani | Ibn Taymiyyah |
  Ibn al-Qayyim | Adh-Dhahabi | An-Nawawi |
  Al-Albani | Ibn Baz | Ibn Uthaymin
EXEMPLE CORRECT : <span class='scholar-glow'>Al-Albani</span> a classe ce hadith...
EXEMPLE CORRECT : selon <span class='scholar-glow'>Ibn Hajar al-Asqalani</span> (m.852H)...
INTERDICTION : Ne jamais ecrire un nom de ces 18 savants sans sa balise.

CHAMP avis_savants : 7 PARAGRAPHES COMPLETS — SCIENCE PLEINE ET ENTIERE.

<span style='color:#d4af37;font-weight:bold;font-size:14px;'>❮ TRESOR DES 14 SIECLES — SCIENCE ET SAGESSE ❯</span><br><br>

P1 <span style='color:#e8c96a;font-weight:bold;'>✹ AL-MANA AL-IJMALI — Sens du hadith selon Ibn al-Athir</span><br>
Sens lexical complet selon An-Nihayah (<span class='scholar-glow'>Ibn al-Athir</span>, m.606H).
Contexte de la revelation (Asbab al-Wurud) si connu.
Signification profonde du matn, portee spirituelle et juridique du message prophetique.

P2 <span style='color:#a78bfa;font-weight:bold;'>✹ SAHABA ET TABI IN (7e-8e s.) — Manhaj des Anciens</span><br>
Comment les Compagnons comprenaient et appliquaient ce texte.
Avis de Umar ibn al-Khattab, Ali ibn Abi Talib, Abd Allah ibn Abbas, Aisha Umm al-Mu minin si rapporte.
Transmission et commentaire par Said ibn al-Musayyab (m.94H), al-Hasan al-Basri (m.110H),
Muhammad ibn Sirine (m.110H) ou Mujahid ibn Jabr (m.104H) si disponible.

P3 <span style='color:#5dade2;font-weight:bold;'>✹ IMAMS FONDATEURS (8e-9e s.) — Fiqh et Usul</span><br>
Position de <span class='scholar-glow'>Malik ibn Anas</span> (m.179H) — Al-Muwatta.
Position d Ahmad ibn Hanbal (m.241H) — Al-Musnad.
Position de Muhammad ibn Idris ash-Shafi i (m.204H) — Ar-Risalah.
Divergences eventuelles entre les ecoles juridiques (Hanafi, Maliki, Shafi i, Hanbali).

P4 <span style='color:#f59e0b;font-weight:bold;'>✹ HUFFADH MEDIEVAUX (13e-15e s.) — Precision doctrinale</span><br>
<span class='scholar-glow'>Ibn Taymiyyah</span> al-Harrani (m.728H) — Majmu al-Fatawa : commentaire de fond.
<span class='scholar-glow'>Ibn al-Qayyim</span> al-Jawziyyah (m.751H) — Zad al-Ma ad : precision methodologique.
<span class='scholar-glow'>Ibn Hajar al-Asqalani</span> (m.852H) — Fath al-Bari / At-Taqrib : analyse de l isnad et du matn.
<span class='scholar-glow'>Adh-Dhahabi</span> (m.748H) — Siyar / Mizan al-I tidal : verdict complementaire si divergent.
<span class='scholar-glow'>An-Nawawi</span> (m.676H) — Sharh Muslim / Riyadh as-Salihin : explication pedagogique.

P5 <span style='color:#22c55e;font-weight:bold;'>✹ AL-AHKAM — Regles de la Loi islamique</span><br>
Statut juridique exact derive de ce hadith : Wajib | Mustahabb | Haram | Mubah | Makruh.
Conditions, exceptions et cas particuliers mentionnes par les Fuqaha.
Divergences inter-madhabs et raisons de ces divergences si existantes.

P6 <span style='color:#34d399;font-weight:bold;'>✹ AT-TATBIQ AL-AMALI — Application pratique aujourd hui</span><br>
Conduite pratique si hadith Sahih ou Hasan : comment l appliquer concretement.
Conduite pratique si hadith Da if ou Mawdu : ne pas citer en preuve, avertissement explicite.
Conseils du musulman moderne selon la methodologie Salafi.

P7 <span style='color:#f39c12;font-weight:bold;'>✹ SYNTHESE CONTEMPORAINE — Al-Albani · Ibn Baz · Ibn Uthaymin</span><br>
<span class='scholar-glow'>Al-Albani</span> (m.1420H) : verdict SS no.X ou SD no.X + raisonnement methodologique complet.
<span class='scholar-glow'>Ibn Baz</span> (m.1420H) : position dans Fatawa Ibn Baz + application pratique.
<span class='scholar-glow'>Ibn Uthaymin</span> (m.1421H) : explication pedagogique pour les musulmans d aujourd hui.
Si Da if ou Mawdu : <span style='color:#e74c3c;font-weight:bold;'>AVERTISSEMENT FINAL</span> — ce hadith ne peut pas etre cite en preuve ni propage.

CHAMP grille_albani : rapport complet d Al-Albani separe par <br><br>.
1. Verdict precis + no.SS/SD (si inconnu : "numero non retrouve — consulter Fihris de la Silsilah").
2. Ouvrages ou <span class='scholar-glow'>Al-Albani</span> a traite ce hadith : SS | SD | Irwa | Sahih al-Jami | Da if al-Jami.
3. Methode : rawis examines + shawahid ou mutaba at identifies.
4. Divergences avec d autres savants et position d Al-Albani.

CHAMP pertinence : OUI | PARTIEL | NON. Un seul mot.

════════════════════════════════════════════════════════════
REGLE D OR JSON
════════════════════════════════════════════════════════════
INTERDICTION 1 : ZERO guillemets doubles dans les attributs HTML.
CORRECT : <span style='color:#2ecc71;'> | INTERDIT : <span style="color:#2ecc71;">

INTERDICTION 2 : ZERO retours chariots reels dans les valeurs JSON.
Utilise \\n pour les sauts de ligne. Exception : isnad_chain utilise \\n entre maillons.

AUTO-VERIFICATION :
1.{ premier ? 2.} dernier ? 3.HTML guillemets SIMPLES ? 4.\\n pas de retour chariot ?
5.isnad_chain >= 8 maillons ? 6.grade_explique 4 lignes ?
7.Zone 3 : 7 paragraphes avec profondeur et densite ?
8.18 Savants Piliers entoures de <span class='scholar-glow'>... </span> ?`;


// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM_TRADUCTEUR
// ═══════════════════════════════════════════════════════════════════════════════
const SYSTEM_TRADUCTEUR = `\
Tu es un traducteur du lexique prophetique classique.
Priorite : (1) Ibn al-Athir (2) Ibn Manzur (3) Ibn Faris.
Sifat divins : Ithbat strict.

MISSION 1 — MATN EXACT :
"actes ne valent que par intentions" -> إنما الأعمال بالنيات
"paradis sous les pieds des meres" -> الجنة تحت أقدام الأمهات
"ne te mets pas en colere" -> لا تغضب
"la religion est facilite" -> إن الدين يسر
"pudeur fait partie de la foi" -> الحياء من الإيمان
"sois comme un etranger" -> كن في الدنيا كأنك غريب
"cherchez la science" -> اطلبوا العلم
"tout innovateur va en enfer" -> كل بدعة ضلالة
"le vrai musulman" -> المسلم من سلم المسلمون من لسانه

MISSION 2 : theme islamique general -> terme classique.
MISSION 3 : si arabe dans requete -> extraire 6 mots max.
SORTIE : mots arabes uniquement. Zero explication. Max 12 mots.`;

// ═══════════════════════════════════════════════════════════════════════════════
// TRIPLE BOUCLIER
// ═══════════════════════════════════════════════════════════════════════════════
const RE_MAWDU    = /موضوع|باطل|مكذوب|لا أصل له|ليس له أصل|ليس لهذا|كذب|منكر|شاذ|متروك|تالف|ضعيف جد[اً]|لا يصح|لا يثبت|ليس بحديث|لا يصح حديثا|ليس بحديث مرفوع|كلام|من قول|ليس من حديث/;
const RE_DAIF_JID = /منكر|ضعيف جد[اً]|ضعيف جداً|واهٍ|واه\b|متروك/;
const RE_DAIF     = /ضعيف|فيه ضعف|مجهول|مرسل|منقطع|معضل|مدلس|مضطرب|لين|لا يحتج|لا يعرف|في إسناده|إسناده ضعيف|ضعّفه/;
const RE_STRONG   = /صحيح|حسن/;

function classifyGrade(g) {
  const isMawdu   = RE_MAWDU.test(g);
  const isDaifJid = !isMawdu && RE_DAIF_JID.test(g);
  const isDaif    = !isMawdu && !isDaifJid && RE_DAIF.test(g);
  return { isMawdu, isDaifJid, isDaif, isWeak: isMawdu||isDaifJid||isDaif, isStrong: RE_STRONG.test(g) };
}

// ═══════════════════════════════════════════════════════════════════════════════
// _translateQueryToArabic
// ═══════════════════════════════════════════════════════════════════════════════
async function _translateQueryToArabic(query) {
  if (/[\u0600-\u06FF]/.test(query)) {
    const r = (query.match(/[\u0600-\u06FF\s]+/g)||[]).join(" ").replace(/\s+/g," ").trim().split(/\s+/).slice(0,6).join(" ");
    return r || query.trim();
  }
  try {
    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001", max_tokens: 80, temperature: 0,
      system: SYSTEM_TRADUCTEUR, messages: [{ role: "user", content: query.trim() }]
    });
    const raw = (resp.content[0]?.text || "").trim();
    const arOnly = raw.replace(/[`'"*_#\[\]()]/g,"").replace(/[a-zA-Z\-]/g," ").replace(/[0-9]/g,"").replace(/\s+/g," ").trim();
    if (!/[\u0600-\u06FF]/.test(arOnly)||arOnly.length<2) return query.trim().split(/\s+/).slice(0,3).join(" ");
    const result = arOnly.split(/\s+/).filter(Boolean).slice(0,12).join(" ");
    console.log("TRADUCTEUR:", query.substring(0,50), "->", result);
    return result;
  } catch (err) {
    console.log("TRADUCTEUR_ERR:", err.message);
    return query.trim().split(/\s+/).slice(0,3).join(" ");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// extractJSON v15 — PARSEUR ROBUSTE SANS REPLACE DESTRUCTEUR
// ═══════════════════════════════════════════════════════════════════════════════
function extractJSON(text) {
  if (!text) return null;
  let t = text.replace(/```[a-z]*\n?/gi,"").replace(/```/g,"").trim();
  try { return JSON.parse(t); } catch (_) {}
  const start = t.indexOf("{");
  if (start===-1) { console.log("EXTRACT_JSON_FAILED — aucune accolade ouvrante"); return null; }
  let depth=0, end=-1;
  for (let i=start;i<t.length;i++) {
    if (t[i]==="{") depth++;
    else if (t[i]==="}") { depth--; if (depth===0) { end=i; break; } }
  }
  if (end===-1) { console.log("EXTRACT_JSON_FAILED — accolade fermante introuvable"); return null; }
  const bloc = t.substring(start, end+1);
  try { return JSON.parse(bloc); } catch (_) {}
  const fixed = bloc.replace(/style="([^"]*)"/g,"style='$1'").replace(/ class="([^"]*)"/g," class='$1'");
  try {
    const result = JSON.parse(fixed);
    console.log("EXTRACT_JSON — recuperation style-quotes");
    return result;
  } catch (_) {}
  console.log("EXTRACT_JSON_FAILED — non parseable");
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALEURS PAR DÉFAUT
// ═══════════════════════════════════════════════════════════════════════════════
const DEFAULTS = {
  french_text:      "La traduction n'a pas pu etre etablie. Consultez Dorar.net.",
  grade_explique:   "Le verdict est celui fourni par Dorar.net. Consultez la Silsilah d Al-Albani.",
  isnad_chain:      "",
  jarh_tadil:       "Analyse des transmetteurs non completee. Referez-vous au Taqrib d Ibn Hajar.",
  sanad_conditions: "Verification des 5 conditions non completee (Ibn as-Salah, Al-Muqaddimah).",
  mutabaat:         "Voies de renfort non analysees. Consultez Fath al-Bari et la Silsilah d Al-Albani.",
  avis_savants:     "Avis des savants non collectes. Consultez Fath al-Bari et la Silsilah.",
  grille_albani:    "Rapport non disponible. Consultez Silsilah Sahihah, Da ifah, Irwa al-Ghalil.",
  pertinence:       "NON"
};

// ═══════════════════════════════════════════════════════════════════════════════
// Utilitaires
// ═══════════════════════════════════════════════════════════════════════════════
function clean(s) { return (s||"").replace(/[\u0000-\u001F\u007F]/g," ").replace(/\s+/g," ").trim(); }

// ⛔️ cleanIsnad — préserve \n — NE PAS MODIFIER
function cleanIsnad(s) {
  if (!s) return "";
  return s.replace(/\r\n/g,"\n").replace(/\r/g,"\n")
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g," ")
    .replace(/[ \t]+/g," ").replace(/\n{3,}/g,"\n\n").trim();
}

function safeField(value, key) {
  if (key==="isnad_chain") { const v=cleanIsnad(value); return (v&&v.length>=5)?v:""; }
  if (key==="pertinence") {
    const v=(value||"").trim().toUpperCase();
    if (v.startsWith("OUI")) return "OUI";
    if (v.startsWith("PARTIEL")) return "PARTIEL";
    if (v.startsWith("NON")) return "NON";
    return DEFAULTS.pertinence;
  }
  const v=clean(value);
  return (v&&v.length>=10)?v:DEFAULTS[key];
}

// ═══════════════════════════════════════════════════════════════════════════════
// SSE helpers — Edge Runtime (TextEncoder + controller.enqueue)
// ═══════════════════════════════════════════════════════════════════════════════
const _enc = new TextEncoder();

function sseWrite(ctrl, event, data) {
  ctrl.enqueue(_enc.encode("event: "+event+"\ndata: "+JSON.stringify(data)+"\n\n"));
}
function sseStatus(ctrl, id) {
  ctrl.enqueue(_enc.encode("event: status\ndata: "+JSON.stringify(id)+"\n\n"));
  console.log("SSE_STATUS:", id);
}
function sseChunk(ctrl, idx, deltaText) {
  if (!deltaText) return;
  ctrl.enqueue(_enc.encode("event: chunk\ndata: "+JSON.stringify({index:idx,delta:deltaText})+"\n\n"));
}

// ═══════════════════════════════════════════════════════════════════════════════
// extractInfoValue — HTML Dorar
// ═══════════════════════════════════════════════════════════════════════════════
function extractInfoValue(html, label) {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  let rx = new RegExp(esc+"[^<]*<\\/span>\\s*<span[^>]*>([^<]{1,300})<\\/span>");
  let m = html.match(rx);
  if (m&&m[1].trim()) return m[1].trim();
  rx = new RegExp(esc+"[^<]*<\\/span>([^<]{1,200})");
  m = html.match(rx);
  if (m) { const v=m[1].trim().replace(/^[-:—\s]+/,"").trim(); if (v.length>=2) return v; }
  return "";
}

// ═══════════════════════════════════════════════════════════════════════════════
// normalizeMatn
// ═══════════════════════════════════════════════════════════════════════════════
function normalizeMatn(s) {
  return (s||"")
    .replace(/[\u064B-\u065F\u0670]/g,"")
    .replace(/[\u060C\u061B\u061F\u06D4]/g,"")
    .replace(/[.,!?;:()\[\]{}"'«»\-\u2013\u2014]/g,"")
    .replace(/[\u0660-\u06690-9]/g,"")
    .replace(/\s+/g,"");
}

// ═══════════════════════════════════════════════════════════════════════════════
// parseHadiths — 3 stratégies — MAX = 1
// ═══════════════════════════════════════════════════════════════════════════════
function parseHadiths(rawHtml) {
  const MAX=1;
  const seen=new Set();
  const results=[];

  const newResult = () => ({
    arabic_text:"",grade:"غير محدد",savant:"",source:"",rawi:"",
    french_text:"",grade_explique:"",isnad_chain:"",jarh_tadil:"",
    sanad_conditions:"",mutabaat:"",avis_savants:"",grille_albani:"",pertinence:""
  });

  const hadithSegments = rawHtml.split(/<div[^>]*class="hadith[^"]*"[^>]*>/i);
  const infoSegments   = rawHtml.split(/<div[^>]*class="hadith-info[^"]*"[^>]*>/i);

  const extractBlock = (seg) => {
    let depth=1,pos=0,content=seg;
    while (pos<content.length&&depth>0) {
      const open=content.indexOf("<div",pos);
      const close=content.indexOf("</div>",pos);
      if (close===-1) break;
      if (open!==-1&&open<close) { depth++; pos=open+4; }
      else { depth--; if (depth===0) { content=content.substring(0,close); break; } pos=close+6; }
    }
    return content;
  };

  const matns=[],infos=[];
  for (let i=1;i<hadithSegments.length;i++) {
    const block=extractBlock(hadithSegments[i]);
    const text=block.replace(/<[^>]+>/g," ").replace(/\s+/g," ").replace(/^\s*\d+\s*[-–]\s*/,"").trim();
    if (text.length>=10) matns.push(text);
  }
  for (let i=1;i<infoSegments.length;i++) infos.push(extractBlock(infoSegments[i]));
  console.log("STRAT1 matns:",matns.length,"infos:",infos.length);

  for (let i=0;i<matns.length&&results.length<MAX;i++) {
    const norm=normalizeMatn(matns[i]);
    if (norm.length<5||seen.has(norm)) { console.log("SKIP["+i+"] doublon"); continue; }
    seen.add(norm);
    const inf=infos[i]||"";
    const grade=extractInfoValue(inf,"خلاصة حكم المحدث");
    const savant=extractInfoValue(inf,"المحدث");
    const source=extractInfoValue(inf,"المصدر");
    const rawi=extractInfoValue(inf,"الراوي");
    const r=newResult();
    r.arabic_text=matns[i].substring(0,1200);
    r.grade=grade||"غير محدد"; r.savant=savant; r.source=source; r.rawi=rawi;
    results.push(r);
    console.log("HADITH_S1["+(results.length-1)+"] GRADE:",r.grade||"(vide)","| TEXT:",r.arabic_text.substring(0,60));
  }

  if (!results.length) {
    console.log("STRAT2");
    const patterns=[
      /class="hadith-text[^"]*"[^>]*>([\s\S]{20,1000}?)<\/[a-z]+>/i,
      /class="matn[^"]*"[^>]*>([\s\S]{20,1000}?)<\/[a-z]+>/i,
      /data-content="([^"]{20,1000})"/i
    ];
    for (const pat of patterns) {
      if (results.length>=MAX) break;
      const m2=rawHtml.match(pat);
      if (m2) {
        const text=m2[1].replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
        const norm=normalizeMatn(text);
        if (text.length>=10&&!seen.has(norm)) {
          seen.add(norm);
          const r=newResult(); r.arabic_text=text.substring(0,1200);
          results.push(r);
          console.log("HADITH_S2:",text.substring(0,70));
        }
      }
    }
  }

  if (!results.length) {
    console.log("STRAT3");
    const blks=rawHtml.match(/[\u0600-\u06FF][\u0600-\u06FF\s،؛,.!؟\u064B-\u065F]{30,600}/g)||[];
    for (const blk of blks) {
      if (results.length>=MAX) break;
      const text=blk.replace(/\s+/g," ").trim();
      const norm=normalizeMatn(text);
      if (text.length>=30&&!seen.has(norm)) {
        seen.add(norm);
        const r=newResult(); r.arabic_text=text;
        results.push(r);
        console.log("HADITH_S3:",text.substring(0,70));
      }
    }
  }

  console.log("PARSED_FINAL:",results.length,"hadith(s)");
  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// fetchWithTimeout — AbortController (Edge-compatible)
// ═══════════════════════════════════════════════════════════════════════════════
function fetchWithTimeout(url, opts, ms) {
  const ctrl=new AbortController();
  const t=setTimeout(()=>ctrl.abort(),ms);
  return fetch(url,{...opts,signal:ctrl.signal}).finally(()=>clearTimeout(t));
}

// ═══════════════════════════════════════════════════════════════════════════════
// analyserUnHadith — Streaming Edge + Garde-fou
// ⛔️ SANCTUAIRE — NE PAS MODIFIER LA STRUCTURE DU STREAM
// ═══════════════════════════════════════════════════════════════════════════════
async function analyserUnHadith(r, idx, q, ctrl, wantSSE) {
  const prompt =
    "REQUETE_UTILISATEUR : "+q+"\n\n"+
    "DONNEES DORAR.NET (SOURCE AUTORITAIRE) :\n"+
    "  Matn arabe : "+r.arabic_text+"\n"+
    "  Grade Dorar : "+r.grade+"\n"+
    "  Savant source : "+(r.savant||"non precise")+"\n"+
    "  Livre source  : "+(r.source||"non precise")+"\n"+
    "  Rawi principal : "+(r.rawi||"non precise")+"\n\n"+
    "RAPPELS IMPERATIFS :\n"+
    "  TURBO : commence DIRECTEMENT par {. ZERO texte avant {.\n"+
    "  BUDGET : max 3500 tokens. JSON DOIT se fermer avant la limite.\n"+
    "  DENSITE ABSOLUE : Zone 3 = profondeur maximale, aucune restriction de phrases.\n"+
    "  SCHOLAR-GLOW : 18 Savants Piliers OBLIGATOIREMENT dans <span class='scholar-glow'>NOM</span>.\n"+
    "  V1 — grade_explique reflete Grade Dorar. ZERO inversion.\n"+
    "  V4 — isnad_chain min. 8 maillons | pipe | \\n separateurs.\n"+
    "  V4 — Terminer par Al-Albani | Ibn Baz | Ibn Uthaymin.\n"+
    "  V4 — 9 champs. { premier. } dernier. ZERO backtick.\n"+
    "  Zone 3 — 7 paragraphes avec profondeur et densite maximales.\n"+
    "  HTML : guillemets SIMPLES. Aucun retour chariot reel.\n";

  try {
    let rawText="", chunkCount=0;
    const stream = client.messages.stream({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 3500,
      system: SYSTEM_TAKHRIJ,
      messages: [{ role:"user", content:prompt }]
    });

    for await (const event of stream) {
      if (event.type==="content_block_delta"&&event.delta?.text) {
        const chunk=event.delta.text;
        rawText+=chunk;
        chunkCount++;
        if (wantSSE&&chunkCount%5===0) sseChunk(ctrl,idx,chunk);
      }
    }
    if (wantSSE&&chunkCount%5!==0) sseChunk(ctrl,idx," ");

    console.log("HADITH["+idx+"]_LEN:",rawText.length,"| CHUNKS:",chunkCount);

    let parsed=extractJSON(rawText);
    if (Array.isArray(parsed)) parsed=parsed[0]||null;
    console.log("HADITH["+idx+"]_PARSE:",parsed?"OK":"ECHEC");

    // ── GARDE-FOU GRADE_INVERSION + CAS A/B/C/D ──────────────────────────────
    if (parsed&&r.grade) {
      const cls=classifyGrade(r.grade);
      const expl=(parsed.grade_explique||"").toLowerCase();
      const aiGood=/\bsahih\b|\bhasan\b|#2ecc71|#f39c12/.test(expl);
      const aiBad=/\bda.if\b|mawdu|munkar|#e74c3c|#8e44ad/.test(expl);

      // Cas A : Da'if -> Sahih (inversion)
      if (cls.isWeak&&aiGood&&!aiBad) {
        const n=cls.isMawdu?"Mawdu'":cls.isDaifJid?"Da'if Jiddan":"Da'if";
        console.log("HADITH["+idx+"]_GRADE_INVERSION ("+n+"->Sahih) — corrige");
        parsed.grade_explique=DEFAULTS.grade_explique;
      }
      // Cas B : Sahih -> Da'if (inversion inverse)
      if (cls.isStrong&&aiBad&&!aiGood) {
        console.log("HADITH["+idx+"]_GRADE_INVERSION (Sahih->Da'if) — corrige");
        parsed.grade_explique=DEFAULTS.grade_explique;
      }
      // Cas C : phrase complexe sans badge
      if (cls.isWeak&&!aiBad&&!aiGood) {
        const lbl=cls.isMawdu?"REJETE \u2014 CE N'EST PAS UN HADITH (MAWDU')":
                  cls.isDaifJid?"DA'IF JIDDAN \u2014 TRES FAIBLE":"DA'IF \u2014 FAIBLE";
        console.log("HADITH["+idx+"]_PHRASE_COMPLEXE ("+r.grade.substring(0,35)+") — texte force");
        parsed.grade_explique=
          "<b>Sources principales :</b> "+(r.source||"voir Dorar.net")+".<br>"+
          "<b>Cause globale :</b> "+lbl+" \u2014 "+(r.savant||"Muhaddith")+".<br>"+
          "<b>Sceau contemporain :</b> Verdict Dorar.net : "+r.grade+".<br>"+
          "<b>Statut pratique :</b> NE DOIT PAS ETRE PRATIQUE.";
      }
      // Cas D : grade non classe
      const gradeUnknown=!cls.isWeak&&!cls.isStrong;
      if (gradeUnknown&&!aiGood&&!aiBad) {
        console.log("HADITH["+idx+"]_GRADE_INCONNU — texte neutre force");
        parsed.grade_explique=
          "<b>Sources principales :</b> "+(r.source||"voir Dorar.net")+".<br>"+
          "<b>Cause globale :</b> Grade non d\u00e9termin\u00e9 par Dorar.net.<br>"+
          "<b>Sceau contemporain :</b> Consulter Silsilah Sahihah/Da\u2019ifah du Cheikh al-Alb\u0101ni.<br>"+
          "<b>Statut pratique :</b> NE PAS CITER AVANT V\u00c9RIFICATION.";
      }
    }
    return parsed;
  } catch (e) {
    console.log("HADITH["+idx+"]_ERR:",e.message);
    return null;
  }
  // ⛔️ FIN DU SANCTUAIRE
}

// ═══════════════════════════════════════════════════════════════════════════════
// _doDirectAnalysis — Analyse IA directe quand Dorar ne trouve rien
// Crée un hadith synthétique depuis la requête utilisateur et appelle l'IA.
// Déclenché si DORAR_EMPTY ou PARSE_EMPTY.
// ═══════════════════════════════════════════════════════════════════════════════
async function _doDirectAnalysis(q, arabicQuery, controller) {
  // Résultat synthétique — le matn = la requête arabe traduite
  const synth = {
    arabic_text: arabicQuery.substring(0, 500) || q.substring(0, 500),
    grade: "غير محدد",
    savant: "Non indexé dans Dorar.net — Analyse directe",
    source: "Analyse directe — requête utilisateur",
    rawi: ""
  };

  // Informer le frontend : 1 résultat synthétique disponible (badges immédiats)
  sseWrite(controller, "dorar", [synth]);
  sseStatus(controller, "TAKHRIJ");
  sseStatus(controller, "RIJAL");

  // Appel IA : l'IA va évaluer le texte avec tous les outils de Takhrij
  const parsed = await analyserUnHadith(synth, 0, q, controller, true);
  sseStatus(controller, "JARH");

  const a = parsed || {};
  synth.french_text      = safeField(a.french_text,      "french_text");
  synth.grade_explique   = safeField(a.grade_explique,   "grade_explique");
  synth.isnad_chain      = safeField(a.isnad_chain,      "isnad_chain");
  synth.jarh_tadil       = safeField(a.jarh_tadil,       "jarh_tadil");
  synth.sanad_conditions = safeField(a.sanad_conditions, "sanad_conditions");
  synth.mutabaat         = safeField(a.mutabaat,         "mutabaat");
  synth.avis_savants     = safeField(a.avis_savants,     "avis_savants");
  synth.grille_albani    = safeField(a.grille_albani,    "grille_albani");
  synth.pertinence       = safeField(a.pertinence,       "pertinence");

  sseStatus(controller, "HUKM");
  sseWrite(controller, "hadith", { index: 0, data: synth });
  console.log("DIRECT_ANALYSIS fr:", synth.french_text.length, "isnad:", synth.isnad_chain.length);

  controller.enqueue(_enc.encode("event: done\ndata: {\"done\": true}\n\n"));
  controller.close();
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL — SERVERLESS NODE.JS 20
// ═══════════════════════════════════════════════════════════════════════════════
export default async function handler(req) {
  const corsHeaders = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept"
  };

  if (req.method==="OPTIONS") {
    return new Response(null, { status:200, headers:corsHeaders });
  }

  // Extraction de la requete (GET ou POST)
  let q="";
  try {
    const url=new URL(req.url);
    q=url.searchParams.get("q")||"";
    if (!q&&req.method==="POST") {
      const body=await req.json().catch(()=>({}));
      q=body.q||"";
    }
  } catch (_) {}

  if (!q) {
    return new Response(JSON.stringify({error:"Requete vide"}), {
      status:400, headers:{...corsHeaders,"Content-Type":"application/json"}
    });
  }

  console.log("DEBUT v18.2 SERVERLESS — q:", q);

  const wantSSE=(req.headers.get("accept")||"").includes("text/event-stream");

  // ── SSE : ReadableStream Edge ───────────────────────────────────────────────
  if (wantSSE) {
    const stream = new ReadableStream({
      async start(controller) {
        try {
          sseStatus(controller,"INITIALISATION");

          const arabicQuery=await _translateQueryToArabic(q);
          console.log("ARABIC_QUERY:",arabicQuery);
          sseStatus(controller,"DORAR");

          const dorarResp=await fetchWithTimeout(
            "https://dorar.net/dorar_api.json?skey="+encodeURIComponent(arabicQuery),
            {headers:{"User-Agent":"Mozilla/5.0","Referer":"https://dorar.net/"}},
            9000
          );
          if (!dorarResp.ok) throw new Error("Dorar HTTP "+dorarResp.status);

          const dorarData=await dorarResp.json();
          const html=dorarData?.ahadith?.result||"";
          console.log("HTML_LEN:",html.length,"| PREVIEW:",html.substring(0,120));

          if (!html||html.length<10) {
            console.log("DORAR_EMPTY — analyse directe sur requete");
            await _doDirectAnalysis(q, arabicQuery, controller);
            return;
          }

          const results=parseHadiths(html);
          if (!results.length) {
            console.log("PARSE_EMPTY — analyse directe sur requete");
            await _doDirectAnalysis(q, arabicQuery, controller);
            return;
          }

          sseWrite(controller,"dorar",results);
          sseStatus(controller,"TAKHRIJ");

          for (let i=0;i<results.length;i++) {
            const r=results[i];
            sseStatus(controller,"RIJAL");
            const parsed=await analyserUnHadith(r,i,q,controller,true);
            sseStatus(controller,"JARH");
            const a=parsed||{};
            r.french_text      = safeField(a.french_text,      "french_text");
            r.grade_explique   = safeField(a.grade_explique,   "grade_explique");
            r.isnad_chain      = safeField(a.isnad_chain,      "isnad_chain");
            r.jarh_tadil       = safeField(a.jarh_tadil,       "jarh_tadil");
            r.sanad_conditions = safeField(a.sanad_conditions, "sanad_conditions");
            r.mutabaat         = safeField(a.mutabaat,         "mutabaat");
            r.avis_savants     = safeField(a.avis_savants,     "avis_savants");
            r.grille_albani    = safeField(a.grille_albani,    "grille_albani");
            r.pertinence       = safeField(a.pertinence,       "pertinence");
            sseStatus(controller,"HUKM");
            sseWrite(controller,"hadith",{index:i,data:r});
            console.log("SSE_HADITH["+i+"] isnad:",r.isnad_chain.length,
              "fr:",r.french_text.length,"mutabaat:",r.mutabaat.length);
          }

          controller.enqueue(_enc.encode("event: done\ndata: {\"done\": true}\n\n"));
          controller.close();

        } catch (error) {
          console.log("STREAM_ERROR:",error.message);
          try {
            sseWrite(controller,"error",{message:error.message});
            controller.close();
          } catch (_) {}
        }
      }
    });

    return new Response(stream, {
      status:200,
      headers:{
        ...corsHeaders,
        "Content-Type":      "text/event-stream; charset=utf-8",
        "Cache-Control":     "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        "Connection":        "keep-alive"
      }
    });
  }

  // ── FALLBACK JSON ────────────────────────────────────────────────────────────
  try {
    const arabicQuery=await _translateQueryToArabic(q);
    const dorarResp=await fetchWithTimeout(
      "https://dorar.net/dorar_api.json?skey="+encodeURIComponent(arabicQuery),
      {headers:{"User-Agent":"Mozilla/5.0","Referer":"https://dorar.net/"}},
      9000
    );
    if (!dorarResp.ok) throw new Error("Dorar HTTP "+dorarResp.status);
    const dorarData=await dorarResp.json();
    const html=dorarData?.ahadith?.result||"";
    if (!html||html.length<10) {
      return new Response(JSON.stringify([]),{status:200,headers:{...corsHeaders,"Content-Type":"application/json"}});
    }
    const results=parseHadiths(html);
    if (!results.length) {
      return new Response(JSON.stringify([]),{status:200,headers:{...corsHeaders,"Content-Type":"application/json"}});
    }
    const analyses=await Promise.all(results.map((r,i)=>analyserUnHadith(r,i,q,null,false)));
    results.forEach((r,i)=>{
      const a=analyses[i]||{};
      r.french_text      = safeField(a.french_text,      "french_text");
      r.grade_explique   = safeField(a.grade_explique,   "grade_explique");
      r.isnad_chain      = safeField(a.isnad_chain,      "isnad_chain");
      r.jarh_tadil       = safeField(a.jarh_tadil,       "jarh_tadil");
      r.sanad_conditions = safeField(a.sanad_conditions, "sanad_conditions");
      r.mutabaat         = safeField(a.mutabaat,         "mutabaat");
      r.avis_savants     = safeField(a.avis_savants,     "avis_savants");
      r.grille_albani    = safeField(a.grille_albani,    "grille_albani");
      r.pertinence       = safeField(a.pertinence,       "pertinence");
    });
    return new Response(JSON.stringify(results),{
      status:200,headers:{...corsHeaders,"Content-Type":"application/json"}
    });

  } catch (error) {
    console.log("JSON_ERROR:",error.message);
    return new Response(JSON.stringify({error:error.message}),{
      status:500,headers:{...corsHeaders,"Content-Type":"application/json"}
    });
  }
}
