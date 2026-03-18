// ═══════════════════════════════════════════════════════════════════════════════
// MOTEUR MÎZÂN v11 — TRADUCTEUR IA SALAFI BILINGUE
// api/search.js
//
// NOUVEAUTÉS v11 :
//   ● Suppression du dictionnaire statique (HADITHS_CELEBRES / frToArFast)
//   ● _translateQueryToArabic() — LLM température 0, lexique Ibn al-Athir,
//     doctrine Ithbat (Sifat littérales), matn exact si connu
//   ● Résultat final bilingue AR + FR garanti (french_text obligatoire)
//
// INVARIANTS MAINTENUS (v10 → v11) :
//   ● VERROU 1 — Soumission Dorar (verdict jamais inventé)
//   ● VERROU 2 — Terminologie Jarh wa Ta'dil exclusive
//   ● VERROU 3 — Stabilité linguistique FR académique
//   ● VERROU 4 — JSON strict, isnad_chain pipe+\n, 7e→21e siècle
//   ● GRADE_INVERSION_DETECTEE (garde-fou post-parse)
//   ● SSE anti-buffering Vercel (X-Accel-Buffering: no)
//   ● cleanIsnad() préserve \n — NE PAS MODIFIER
// ═══════════════════════════════════════════════════════════════════════════════

export const maxDuration = 60;

const Anthropic = require("@anthropic-ai/sdk");
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM_TAKHRIJ v11 — VERROUILLAGE DICTATORIAL (inchangé depuis v10)
// ═══════════════════════════════════════════════════════════════════════════════
const SYSTEM_TAKHRIJ = `\
════════════════════════════════════════════════════════════
IDENTITE ET MISSION
════════════════════════════════════════════════════════════
Tu es un ANALYSEUR SYNTAXIQUE specialise en science du Hadith. \
Tu n es pas un Mufti. Tu n inventes rien. \
Tu recois UN SEUL hadith avec ses metadonnees Dorar.net. \
Tu produis UN SEUL objet JSON valide. Point final.

════════════════════════════════════════════════════════════
VERROU 1 — SOUMISSION ABSOLUE AUX DONNEES DORAR.NET
════════════════════════════════════════════════════════════
Les donnees qui te sont transmises contiennent :
  - Matn : le texte arabe du hadith
  - Grade Dorar : le verdict authentificationnel (ex: صحيح, ضعيف, حسن, موضوع)
  - Savant : le nom du Muhaddith qui a emis le verdict
  - Source : le livre source
  - Rawi : le transmetteur principal

REGLES ABSOLUES SUR LE VERDICT :
A) Le champ grade_explique DOIT reflechir le Grade Dorar fourni. \
   Si Grade Dorar = ضعيف → tu expliques POURQUOI il est Da'if. \
   Si Grade Dorar = صحيح → tu confirmes et documentes son authenticite. \
   INTERDICTION ABSOLUE d inverser un Da'if en Sahih ou un Sahih en Da'if. \
   INTERDICTION ABSOLUE d ignorer le Grade Dorar fourni.
B) Le Savant fourni par Dorar DOIT apparaitre dans grade_explique et avis_savants. \
   Tu acceptes TOUS les savants du Hadith mentionnes par Dorar : \
   Al-Albani, Ibn Baz, Ibn Uthaymin, Al-Bukhari, Muslim, Ahmad, \
   Al-Hakim, Al-Dhahabi, Ibn Hajar, At-Tirmidhi, An-Nasai, Ibn Ma'in, \
   Ad-Daraqutni, Ibn Hibban, Al-Baghawi, As-Suyuti, et tout autre Muhaddith. \
   INTERDICTION ABSOLUE de rejeter ou de minimiser le verdict d un savant fourni.
C) Si le Grade Dorar est "غير محدد" (non determine) : \
   tu indiques que le verdict n est pas disponible dans les sources consultees \
   et tu invites a consulter les ouvrages specialises. Tu n inventes pas de verdict.

════════════════════════════════════════════════════════════
VERROU 2 — DICTIONNAIRE EXCLUSIF DES IMAMS DU HADITH
════════════════════════════════════════════════════════════
INTERDICTION TOTALE d utiliser tout vocabulaire profane ou generaliste \
pour decrire les transmetteurs ou les hadiths. \
Tu utilises EXCLUSIVEMENT la terminologie technique suivante :

TERMINOLOGIE D AUTHENTICITE (par ordre decroissant) :
  Sahih = authentique (toutes les conditions reunies)
  Hasan = bon (chaine acceptable, leger defaut de memoire)
  Da'if = faible (defaut identifie dans la chaine)
  Da'if Jiddan = tres faible
  Munkar = reprehensible (contrarie les Thiqat)
  Mawdu' = fabrique (mensonge deliberement attribue au Prophete)
  Batil = invalide
  Mardud = rejete

TERMINOLOGIE TA'DIL — EVALUATION POSITIVE DES RAWIS :
  'Adl par Ijma' = probite acceptee par consensus (Sahabah)
  Thiqah Thabt = digne de confiance et memoriel exact (rang supreme)
  Thiqah Hafidh = digne de confiance et grand memorisateur
  Thiqah = digne de confiance (Adl + Dabt reunis)
  Saduq = veridique (Adl etabli, Dabt partiel)
  Saduq Yahimu = veridique mais commet des erreurs memorielles
  La Ba'sa Bihi = sans reproche (rang acceptable)
  Maqbul = acceptable si corrobore (sinon : Layyin)
  Shaykh = transmetteur ordinaire (ni eloge ni critique formelle)

TERMINOLOGIE JARH — CRITIQUE DES RAWIS (par ordre de severite) :
  Layyin al-Hadith = souple en hadith (leger defaut)
  Da'if = faible (defaut memoriel ou de probite)
  Da'if Jiddan = tres faible (defaut severe)
  Munkar al-Hadith = reprehensible en hadith (narrations anormales)
  Matruk = abandonne (rejet par la majorite des Muhaddithin)
  Muttaham = suspecte de mensonge
  Kadhdhab = menteur etabli
  Wada' al-Hadith = fabricateur de hadiths (rang ultime du Jarh)

TERMINOLOGIE DES DEFAUTS ('ILAL AL-HADITH) :
  'Illah = defaut cache invalidant
  Inqita' = rupture de chaine (maillon absent)
  Tadlis = dissimulation d un maillon faible
  Tadlis al-Isnad = dissimulation dans la chaine
  Tadlis at-Taswiya = nivellement frauduleux de la chaine
  Irsal = omission du Sahabi (Mursal)
  Idtirab = contradiction entre les versions (Mudtarib)
  Shudhudh = anomalie (narration du faible contre les Thiqat)
  Ziyadah Thiqa = addition par un Thiqah (acceptable ou non selon les cas)
  Qalb = inversion de noms dans la chaine
  Ikhtalat = deterioration memorielle tardive du rawi
  Jahalah = anonymat du rawi ('Ain ou Hal)
  Bid'ah = innovation doctrinale du rawi (affecte la reception)

TRADUCTION DES TERMES DIVINS (Sifat) — LITTERALE OBLIGATOIRE :
  Istawa = S est etabli sur (jamais "s est assis" ni "s est installe")
  Yad Allah = La Main d Allah (jamais "puissance" ni "force")
  Nuzul = La Descente (jamais "manifestation")
  Wajh Allah = Le Visage d Allah (jamais "face" profane)
  'Uluww = L Elevation (attribut divin)

════════════════════════════════════════════════════════════
VERROU 3 — STABILITE LINGUISTIQUE
════════════════════════════════════════════════════════════
LANGUE DES EXPLICATIONS : Francais academique impeccable. \
Phrases completes. Pas d abreviations. Pas d argot. \
LANGUE DES TERMES TECHNIQUES : Translitteration latine des termes arabes \
tels qu ils sont utilises par les savants (ex: Thiqah, Saduq, Da'if, 'Illah). \
NOMS PROPRES : Ecrits en translitteration complete \
(ex: Muhammad ibn Isma'il al-Bukhari, pas "Bukhari" seul).

════════════════════════════════════════════════════════════
VERROU 4 — FORMAT JSON STRICT ET INCASSABLE
════════════════════════════════════════════════════════════
Ta reponse = UN SEUL objet JSON. \
Commence par { et termine par }. \
ZERO texte avant {. ZERO texte apres }. \
ZERO backtick. ZERO markdown. ZERO commentaire. \
ZERO escape invalide dans les strings JSON.

STRUCTURE OBLIGATOIRE (8 champs, tous requis) :
{
  "french_text": "...",
  "grade_explique": "...",
  "isnad_chain": "Maillon 1 | Nom | Titre | Verdict | Siecle\\nMaillon 2 | ...",
  "jarh_tadil": "...",
  "sanad_conditions": "...",
  "avis_savants": "...",
  "grille_albani": "...",
  "pertinence": "OUI|PARTIEL|NON"
}

REGLES JSON CRITIQUES :
- Les strings ne peuvent contenir NI guillemets doubles non echappes NI backslashes invalides.
- Les balises HTML dans les strings DOIVENT utiliser des guillemets simples : style='color:#...'
- Tout apostrophe dans le texte francais DOIT etre ecrit tel quel (UTF-8 valide).
- Le champ isnad_chain utilise \\n (antislash+n dans le JSON) comme separateur de maillons.
- INTERDICTION de tronquer un champ. Si tu manques d espace : reduis la longueur de chaque champ, \
  mais TOUS les 8 champs doivent etre presents et non vides.

════════════════════════════════════════════════════════════
SPECIFICATIONS DES 8 CHAMPS
════════════════════════════════════════════════════════════

CHAMP french_text :
Traduction complete, litterale et solennelle du matn arabe. \
Minimum 3 phrases. Style digne d un texte sacre. \
Ne pas repeter la requete utilisateur. \
Ne pas translitterer — traduire completement. \
Utiliser <span style='color:#e8c96a;font-weight:bold;'>NOM</span> pour les noms propres importants. \
Si le hadith contient des Sifat divins : traduire litteralement (voir Verrou 2).

CHAMP grade_explique :
IMPERATIF : Ce champ DOIT refleter le Grade Dorar fourni (voir Verrou 1). \
Format HTML avec <br> entre chaque element. \
Element 1 : <span style='color:[COULEUR];font-weight:bold;'>[VERDICT EN FRANCAIS]</span> \
  selon : صحيح=#2ecc71 | حسن=#f39c12 | ضعيف=#e74c3c | موضوع=#8e44ad | غير محدد=rgba(201,168,76,.6). \
  Suivi de : — [Savant Dorar], [Source Dorar]. \
Element 2 : Explication de la raison du verdict avec terminologie Verrou 2. \
Element 3 : Numero de reference dans la Silsilah d Al-Albani si connu (SS no.X ou SD no.X). \
Element 4 : Consequence pratique : ce hadith peut-il etre cite en preuve ? \
INTERDICTION d inverser le verdict fourni par Dorar.

CHAMP isnad_chain :
FORMAT PIPE STRICT — REGLE D OR DE L APPLICATION :
Une ligne par maillon, separees par \\n dans le JSON (\\n = antislash + n).
Format de chaque ligne : Maillon N | NOM COMPLET | TITRE | VERDICT_JARH_TA_DIL | SIECLE

TITRES AUTORISES : Sahabi | Tabi_i | Tabi_Tabi_i | Muhaddith | Compilateur | Verificateur
VERDICTS AUTORISES (utiliser uniquement les termes du Verrou 2 avec underscores) :
  Adul_par_Ijma | Thiqah_Thabt | Thiqah_Hafidh | Thiqah | Saduq | La_Bas_Bihi | Maqbul
  Da_if | Matruk | Kadhdhab | Munkar | Mudallis | Majhul | Layyin
SIECLES : ecrire "7e siecle", "8e siecle", ..., "20e siecle", "21e siecle"

CONTINUITE OBLIGATOIRE 7e → 21e SIECLE :
  Debut  : Sahabi (7e siecle) — premier transmetteur humain apres le Prophete
  Coeur  : Tabi'in + Tabi' al-Tabi'in (8e-9e siecle)
  Pivot  : Compilateur (Al-Bukhari, Muslim, Abu Dawud, etc.) — 9e siecle
  Fin OBLIGATOIRE : Verificateurs contemporains (20e-21e siecle)
    → Cheikh Muhammad Nasir ad-Din al-Albani | Verificateur | Muhaddith_al-Asr | 20e siecle
    → Cheikh Abd al-Aziz ibn Abd Allah ibn Baz | Verificateur | Mufti_General_KSA | 20e siecle
    → Cheikh Muhammad ibn Salih al-Uthaymin | Verificateur | Imam_Najd | 20e-21e siecle
INTERDICTION de s arreter avant le 20e siecle.
Minimum 8 maillons.
ZERO prose. ZERO phrase explicative. ZERO deviation du format pipe.
Si hadith Da'if : identifier le maillon defaillant avec son verdict Jarh exact.

EXEMPLE CANONIQUE — hadith des intentions :
Maillon 1 | Umar ibn al-Khattab al-Faruq | Sahabi | Adul_par_Ijma | 7e siecle
Maillon 2 | Alqamah ibn Waqqas al-Laythi | Tabi_i | Thiqah | 7e siecle
Maillon 3 | Muhammad ibn Ibrahim ibn al-Harith at-Taymi | Tabi_i | Thiqah | 8e siecle
Maillon 4 | Yahya ibn Sa'id al-Ansari | Muhaddith | Thiqah_Thabt | 8e siecle
Maillon 5 | Sufyan ibn 'Uyaynah al-Hilali | Muhaddith | Thiqah_Thabt | 8e siecle
Maillon 6 | Al-Imam Muhammad ibn Isma'il al-Bukhari | Compilateur | Thiqah_Thabt | 9e siecle
Maillon 7 | Al-Imam Muslim ibn al-Hajjaj al-Qushayri | Compilateur | Thiqah_Thabt | 9e siecle
Maillon 8 | Cheikh Muhammad Nasir ad-Din al-Albani | Verificateur | Muhaddith_al-Asr | 20e siecle
Maillon 9 | Cheikh Abd al-Aziz ibn Abd Allah ibn Baz | Verificateur | Mufti_General_KSA | 20e siecle
Maillon 10 | Cheikh Muhammad ibn Salih al-Uthaymin | Verificateur | Imam_Najd | 20e-21e siecle

CHAMP jarh_tadil :
Analyse nominative des rawis principaux de la chaine (minimum 3 rawis). \
Pour chaque rawi : \
<span style='color:#5dade2;font-weight:bold;'>NOM DU RAWI</span> : \
verdict Ibn Hajar al-Asqalani dans At-Taqrib (avec rang de ta'dil ou de jarh). \
Verdict complementaire d Al-Dhahabi si divergent. \
Si hadith Da'if : nommer l 'Illah precise avec le terme du Verrou 2. \
Separer chaque rawi par <br><br>. \
Utiliser EXCLUSIVEMENT la terminologie du Verrou 2.

CHAMP sanad_conditions :
Les 5 conditions du hadith Sahih selon Ibn as-Salah (Al-Muqaddimah). \
Pour chacune, analyse detaillee puis verdict REMPLIE ou DEFAILLANTE. \
Format :
<span style='color:#d4af37;font-weight:bold;'>1. ITTISAL AL-SANAD</span> (Continuite de la chaine) : [analyse]. <span style='color:#2ecc71;'>REMPLIE</span> ou <span style='color:#e74c3c;'>DEFAILLANTE — [raison avec terminologie Verrou 2]</span><br><br>
<span style='color:#d4af37;font-weight:bold;'>2. 'ADALAT AR-RUWAT</span> (Probite des transmetteurs) : [analyse].<br><br>
<span style='color:#d4af37;font-weight:bold;'>3. DABT AR-RUWAT</span> (Precision memorielle) : [analyse].<br><br>
<span style='color:#d4af37;font-weight:bold;'>4. 'ADAM ASH-SHUDHUDH</span> (Absence d anomalie) : [analyse].<br><br>
<span style='color:#d4af37;font-weight:bold;'>5. 'ADAM AL-'ILLAH</span> (Absence de defaut cache) : [analyse].

CHAMP avis_savants :
Minimum 4 paragraphes separes par <br><br>. \
Paragraphe 1 : <strong>Le Savant source (Dorar)</strong> — [Nom exact fourni] : \
  son verdict complet tel qu il figure dans [Source fournie]. \
  C est le paragraphe le plus important — ne jamais l omettre. \
Paragraphe 2 : <strong>Al-Imam Ahmad ibn Hanbal</strong> ou \
  <strong>Al-Imam Muhammad ibn Isma'il al-Bukhari</strong> : \
  verdict dans le Musnad ou At-Tarikh al-Kabir. \
Paragraphe 3 : <strong>Al-Hafidh Ibn Hajar al-Asqalani</strong> : \
  verdict dans Fath al-Bari, Bulugh al-Maram, ou At-Taqrib. \
Paragraphe 4 : <strong>Al-Imam al-Albani</strong> : \
  verdict complet avec numero SS ou SD. Raisonnement detaille. \
Si Da'if ou Mawdu' : ajouter un <span style='color:#e74c3c;font-weight:bold;'>AVERTISSEMENT</span> \
  citant la mise en garde des savants contre la citation de hadiths faibles.

CHAMP grille_albani :
Rapport d Al-Albani sur ce hadith. Minimum 4 elements separes par <br><br>. \
1. <span style='color:#f39c12;font-weight:bold;'>Al-Albani</span> : Verdict + numero exact (SS no.X = Silsilah Sahihah / SD no.X = Silsilah Da'ifah). \
2. Ouvrage principal ou Al-Albani a traite ce hadith. \
3. Methode : comment Al-Albani est parvenu a ce verdict (examen des rawis, shawahid, mutaba'at). \
4. Si divergence avec d autres savants : exposer la position d Al-Albani et ses arguments. \
Si le numero exact est inconnu : indiquer "numero non retrouve — consulter le Fihris".

CHAMP pertinence :
OUI si le hadith repond directement a la requete utilisateur. \
PARTIEL si le hadith est lie mais pas exactement. \
NON si le hadith est different du sujet recherche. \
UN SEUL MOT. Rien d autre.

════════════════════════════════════════════════════════════
PROTOCOLE DE SECURITE JSON — DERNIER VERROU
════════════════════════════════════════════════════════════
Avant de produire ta reponse, verifie mentalement :
1. Mon premier caractere est-il { ? → OBLIGATOIRE
2. Mon dernier caractere est-il } ? → OBLIGATOIRE
3. Tous mes guillemets doubles sont-ils correctement echappes dans les strings ? → OBLIGATOIRE
4. Les balises HTML utilisent-elles des guillemets simples ? → OBLIGATOIRE
5. Le champ isnad_chain contient-il au moins 8 maillons avec \\n entre eux ? → OBLIGATOIRE
6. Mon verdict dans grade_explique correspond-il au Grade Dorar fourni ? → OBLIGATOIRE
7. Les 8 champs sont-ils tous presents et non vides ? → OBLIGATOIRE
Si une seule de ces conditions n est pas remplie → recommencer.`;

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM_TRADUCTEUR v11 — Traducteur Salafi bilingue, Température 0
//
// FONDEMENTS DOCTRINAUX :
//   ● Lexique : Al-Nihayah fi Gharib al-Hadith (Ibn al-Athir, m.606H)
//     → Référence pour les termes rares du hadith prophétique
//   ● Sifat : Sharh Al-'Aqidah Al-Wasitiyyah (Ibn Taymiyyah, commenté par Al-Uthaymin)
//     → Ithbat strict : traduction littérale des attributs divins, zéro Ta'wil
//   ● Matn exact : Si la requête correspond à un hadith connu, retourner
//     le début exact du matn arabe tel qu'il figure dans les recueils
//
// RÈGLES DE SORTIE :
//   → Retourner UNIQUEMENT le texte arabe pour l'URL Dorar.net
//   → Maximum 12 mots arabes
//   → Zéro translittération, zéro explication, zéro ponctuation non-arabe
// ═══════════════════════════════════════════════════════════════════════════════
const SYSTEM_TRADUCTEUR = `\
Tu es un traducteur specialise en lexique prophétique et en terminologie islamique classique. \
Tu travailles avec deux references doctrinales absolues : \
(1) Al-Nihayah fi Gharib al-Hadith wal-Athar d Ibn al-Athir (m.606H) pour le lexique des termes rares, \
(2) Sharh Al-Aqidah Al-Wasitiyyah d Ibn Taymiyyah tel que commente par Cheikh Ibn Uthaymin \
pour la doctrine des Asma wa Sifat (noms et attributs divins — Ithbat strict, zero Ta wil).

TES TROIS MISSIONS :

MISSION 1 — MATN EXACT (priorite absolue) :
Si la requete correspond a un hadith prophétique connu, \
retourne les premiers mots exacts de ce matn arabe, \
tels qu ils figurent dans les recueils canoniques (Bukhari, Muslim, etc.). \
Exemples :
  "le paradis est sous les pieds des meres" → الجنة تحت أقدام الأمهات
  "les actes ne valent que par les intentions" → إنما الأعمال بالنيات
  "le licite est clair et l illicite est clair" → الحلال بيّن والحرام بيّن
  "le repentir est jusqu au dernier souffle" → إن الله يقبل توبة العبد
  "sois dans ce monde comme un etranger" → كن في الدنيا كأنك غريب
  "ne vous mettez pas en colere" → لا تغضب
  "un croyant n est pas pique deux fois" → لا يلدغ المؤمن من جحر واحد مرتين
  "la pudeur fait partie de la foi" → الحياء من الإيمان

MISSION 2 — TERME TECHNIQUE (si pas de matn exact connu) :
Si la requete est un theme islamique general, \
retourne le terme arabe classique selon Ibn al-Athir. \
Exemples :
  "bienfaisance envers les parents" → بر الوالدين
  "la priere de la nuit" → قيام الليل
  "l intercession" → الشفاعة
  "la descente de Dieu" → نزول الله (jamais "manifestation" — Ithbat strict)
  "la main de Dieu" → يد الله (jamais "puissance" — Ithbat strict)
  "Dieu s est établi sur le Trône" → استوى على العرش (jamais "dominant")

MISSION 3 — ARABE DIRECT (si la requete contient deja de l arabe) :
Si la requete contient des caracteres arabes, extrais les mots arabes principaux \
(maximum 6 mots) sans aucune modification.

REGLE ABSOLUE DE SORTIE :
Retourne UNIQUEMENT les mots arabes, sans aucun autre caractere. \
Zero translitteration. Zero explication. Zero ponctuation non-arabe. \
Maximum 12 mots arabes. Un seul resultat, jamais de liste. \
Si aucune correspondance : retourne le mot arabe le plus proche du sujet.`;

// ═══════════════════════════════════════════════════════════════════════════════
// _translateQueryToArabic — Traducteur IA Salafi, température 0
//
// AUDIT P1 : cette fonction retourne uniquement l'arabe pour l'URL Dorar
// AUDIT P3 : appel LLM indépendant, n'affecte pas le flux SSE principal
// ═══════════════════════════════════════════════════════════════════════════════
async function _translateQueryToArabic(query) {
  // Cas 1 : la requête est déjà en arabe → extraction directe, zéro LLM
  if (/[\u0600-\u06FF]/.test(query)) {
    const arWords = (query.match(/[\u0600-\u06FF\u0620-\u06EF\s]+/g) || [])
      .join(" ").replace(/\s+/g, " ").trim();
    const result = arWords.split(/\s+/).slice(0, 6).join(" ");
    console.log("TRADUCTEUR_AR_DIRECT:", result);
    return result || query.trim();
  }

  // Cas 2 : requête française/latine → appel LLM température 0
  try {
    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 80,
      temperature: 0,          // Déterministe — matn exact reproducible
      system: SYSTEM_TRADUCTEUR,
      messages: [{ role: "user", content: query.trim() }]
    });

    const raw = (resp.content[0]?.text || "").trim();

    // Nettoyage : ne garder que les caractères arabes + espaces
    // (protège contre un éventuel backtick ou translittération parasite)
    const arOnly = raw
      .replace(/[`'"*_#\[\]()]/g, "")           // strip markdown
      .replace(/[a-zA-Z\-]/g, " ")               // strip latin
      .replace(/[0-9]/g, "")                     // strip chiffres
      .replace(/\s+/g, " ")
      .trim();

    // Validation : doit contenir au moins 2 caractères arabes
    const hasArabic = /[\u0600-\u06FF]/.test(arOnly);
    if (!hasArabic || arOnly.length < 2) {
      // Fallback : 2 premiers mots de la requête pour tenter Dorar
      console.log("TRADUCTEUR_FALLBACK (pas d arabe dans la reponse):", raw);
      return query.trim().split(/\s+/).slice(0, 3).join(" ");
    }

    // Limiter à 12 mots arabes max
    const result = arOnly.split(/\s+/).filter(Boolean).slice(0, 12).join(" ");
    console.log("TRADUCTEUR_LLM [temp=0]:", query.substring(0, 60), "→", result);
    return result;

  } catch (err) {
    // Fallback réseau : 3 premiers mots de la requête
    console.log("TRADUCTEUR_ERR:", err.message);
    return query.trim().split(/\s+/).slice(0, 3).join(" ");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// extractJSON — INCASSABLE
// ⛔️ SANCTUAIRE AL-MIZÂN — NE JAMAIS MODIFIER
// ═══════════════════════════════════════════════════════════════════════════════
function extractJSON(text) {
  if (!text) return null;

  let t = text.replace(/```[a-z]*\n?/gi, "").trim();

  try { return JSON.parse(t); } catch (_) {}

  const mObj = t.match(/\{[\s\S]*\}/);
  if (mObj) { try { return JSON.parse(mObj[0]); } catch (_) {} }

  const mArr = t.match(/\[[\s\S]*\]/);
  if (mArr) { try { return JSON.parse(mArr[0]); } catch (_) {} }

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

  // Étape de réparation : guillemets doubles dans attributs HTML → simples
  try {
    const repaired = t
      .substring(start, lastComplete > start ? lastComplete + 1 : t.length)
      .replace(/style="([^"]*)"/g, "style='$1'");
    return JSON.parse(repaired);
  } catch (_) {}

  // ⛔️ FIN DU SANCTUAIRE
  console.log("EXTRACT_JSON_FAILED: impossible de recuperer le JSON");
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALEURS PAR DÉFAUT
// ═══════════════════════════════════════════════════════════════════════════════
const DEFAULTS = {
  french_text:
    "La traduction de ce texte n'a pas pu etre etablie par le systeme d'analyse. " +
    "Veuillez consulter un traducteur specialise en textes hadithiques classiques " +
    "ou vous referer a la source originale sur Dorar.net.",
  grade_explique:
    "Le verdict de ce hadith est celui fourni par Dorar.net. " +
    "Pour une analyse detaillee, consultez les ouvrages de Takhrij : " +
    "Silsilah Sahihah et Da'ifah du Cheikh Al-Albani (rahimahullah), " +
    "ou le Mustadrak d'Al-Hakim avec le Talkhis d'Al-Dhahabi.",
  isnad_chain: "",
  jarh_tadil:
    "L'analyse des transmetteurs de cette chaine n'a pas pu etre completee. " +
    "Referez-vous au Taqrib al-Tahdhib d'Ibn Hajar al-Asqalani " +
    "et au Mizan al-I'tidal d'Al-Dhahabi pour les verdicts sur les rawis.",
  sanad_conditions:
    "La verification des 5 conditions du hadith Sahih selon Ibn as-Salah (Al-Muqaddimah) " +
    "n'a pas pu etre menee a terme. Une etude approfondie du sanad original est necessaire.",
  avis_savants:
    "Les avis des savants n'ont pas pu etre collectes pour ce hadith. " +
    "Consultez : Fath al-Bari d'Ibn Hajar al-Asqalani, " +
    "Sharh Sahih Muslim d'Al-Nawawi, " +
    "et les travaux du Cheikh Al-Albani dans la Silsilah pour une analyse complete.",
  grille_albani:
    "Le rapport detaille d'Al-Albani n'a pas pu etre genere pour ce hadith. " +
    "Consultez directement : Silsilah al-Ahadith as-Sahihah, " +
    "Silsilah al-Ahadith ad-Da'ifah, Irwa' al-Ghalil, " +
    "Sahih al-Jami' et Da'if al-Jami' du Cheikh Al-Albani (rahimahullah).",
  pertinence: "NON"
};

// ═══════════════════════════════════════════════════════════════════════════════
// clean() — nettoyage général (espaces, caractères de contrôle)
// ═══════════════════════════════════════════════════════════════════════════════
function clean(s) {
  return (s || "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
}

// ═══════════════════════════════════════════════════════════════════════════════
// cleanIsnad — préserve les \n (séparateurs de maillons) — NE PAS MODIFIER
// ⛔️ SANCTUAIRE AL-MIZÂN — NE PAS TOUCHER
// ═══════════════════════════════════════════════════════════════════════════════
function cleanIsnad(s) {
  if (!s) return "";
  return s
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ═══════════════════════════════════════════════════════════════════════════════
// safeField — valide et nettoie chaque champ IA
// ═══════════════════════════════════════════════════════════════════════════════
function safeField(value, key) {
  if (key === "isnad_chain") {
    const v = cleanIsnad(value);
    return (v && v.length >= 5) ? v : "";
  }
  if (key === "pertinence") {
    const v = (value || "").trim().toUpperCase();
    if (v.startsWith("OUI"))     return "OUI";
    if (v.startsWith("PARTIEL")) return "PARTIEL";
    if (v.startsWith("NON"))     return "NON";
    return DEFAULTS.pertinence;
  }
  const v = clean(value);
  return (v && v.length >= 10) ? v : DEFAULTS[key];
}

// ═══════════════════════════════════════════════════════════════════════════════
// extractInfoValue — HTML Dorar
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
// parseHadiths — regex stricte class="hadith"
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

  const limit = Math.min(matns.length, 1);
  for (let i = 0; i < limit; i++) {
    const inf    = infos[i] || "";
    const grade  = extractInfoValue(inf, "خلاصة حكم المحدث");
    const savant = extractInfoValue(inf, "المحدث");
    const source = extractInfoValue(inf, "المصدر");
    const rawi   = extractInfoValue(inf, "الراوي");
    console.log("HADITH[" + i + "] GRADE:", grade || "(vide)", "| SAVANT:", savant || "(vide)");
    results.push({
      arabic_text: matns[i].substring(0, 1200),
      grade: grade || "غير محدد", savant, source, rawi,
      french_text: "", grade_explique: "", isnad_chain: "", jarh_tadil: "",
      sanad_conditions: "", avis_savants: "", grille_albani: "", pertinence: ""
    });
  }

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
// fetchWithTimeout
// ═══════════════════════════════════════════════════════════════════════════════
function fetchWithTimeout(url, options, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

// ═══════════════════════════════════════════════════════════════════════════════
// sseWrite — flush immédiat
// ═══════════════════════════════════════════════════════════════════════════════
function sseWrite(res, event, data) {
  const payload = "event: " + event + "\ndata: " + JSON.stringify(data) + "\n\n";
  res.write(payload);
  if (typeof res.flush === "function") res.flush();
}

// ═══════════════════════════════════════════════════════════════════════════════
// analyserUnHadith — 4 verrous + GRADE_INVERSION_DETECTEE
// ⛔️ SANCTUAIRE AL-MIZÂN — NE JAMAIS MODIFIER LA STRUCTURE DU STREAM
// ═══════════════════════════════════════════════════════════════════════════════
async function analyserUnHadith(r, idx, q) {
  const prompt =
    "DONNEES DORAR.NET (SOURCE AUTORITAIRE — RESPECTER ABSOLUMENT) :\n" +
    "  Matn arabe : " + r.arabic_text + "\n" +
    "  Grade Dorar : " + r.grade + "\n" +
    "  Savant source : " + (r.savant || "non precise") + "\n" +
    "  Livre source  : " + (r.source || "non precise") + "\n" +
    "  Rawi principal : " + (r.rawi  || "non precise") + "\n\n" +
    "REQUETE UTILISATEUR (contexte — ne pas repeter dans french_text) : " + q + "\n\n" +
    "RAPPEL VERROUS :\n" +
    "  V1 — grade_explique DOIT refleter le Grade Dorar ci-dessus.\n" +
    "  V3 — french_text : traduction complete, litterale, en francais academique.\n" +
    "  V4 — isnad_chain : minimum 8 maillons, format pipe, separes par \\n.\n" +
    "  V4 — Maillons 8+ : Al-Albani | Ibn Baz | Ibn Uthaymin (20e/21e siecle).\n" +
    "  V4 — Premier caractere = { | Dernier caractere = }\n";

  // ⛔️ SANCTUAIRE AL-MIZÂN : SÉCURITÉ SDK — NE PAS AJOUTER signal/AbortController
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
    console.log("HADITH[" + idx + "]_RAW_PREVIEW:", rawText.substring(0, 200));

    let parsed = extractJSON(rawText);
    if (Array.isArray(parsed)) parsed = parsed[0] || null;
    console.log("HADITH[" + idx + "]_PARSE:", parsed ? "OK" : "ECHEC");

    // ══════════════════════════════════════════════════════════════════════
    // ROUTAGE DÉTERMINISTE DES VERDICTS DORAR — v11 ENRICHI
    //
    // PROBLÈME CORRIGÉ : Dorar.net renvoie souvent des phrases complètes
    // (ex: "ليس لهذا الحديث أصل", "لا يعرف", "لا يصح") au lieu d'un mot
    // simple (ضعيف). Le garde-fou précédent ne matchait pas ces phrases
    // et renvoyait INCONNU, bloquant les verdicts légitimes.
    //
    // SOLUTION : Trois niveaux de regex déterministes qui catégorisent
    // mathématiquement TOUTE phrase Dorar, courte ou longue.
    //
    // TRIPLE BOUCLIER :
    //   Bouclier 1 — Rejet absolu / Inventé (Mawdu' / Batil)
    //   Bouclier 2 — Faiblesse sévère (Da'if Jiddan / Munkar / Matruk)
    //   Bouclier 3 — Faiblesse générale (Da'if / Majhul / لا يصح)
    //   Bouclier Fort — Sahih / Hasan (préserve les verdicts positifs)
    // ══════════════════════════════════════════════════════════════════════
    if (parsed && r.grade) {
      const g = r.grade; // Phrase brute Dorar (peut être longue)

      // ── Bouclier 1 : Rejet absolu → Mawdu' / Batil ──────────────────
      // Phrases Dorar connues : "موضوع", "باطل", "لا أصل له",
      // "ليس له أصل", "ليس لهذا الحديث أصل", "مكذوب"
      const RE_MAWDU = /موضوع|باطل|كذب|لا أصل له|ليس له أصل|ليس لهذا|مكذوب/;

      // ── Bouclier 2 : Faiblesse sévère → Da'if Jiddan / Munkar ───────
      // Phrases Dorar : "منكر", "ضعيف جداً", "ضعيف جدا", "واهٍ", "متروك"
      const RE_DAIF_JIDDAN = /منكر|ضعيف جد[اً]|ضعيف جداً|واهٍ|واه\b|متروك/;

      // ── Bouclier 3 : Faiblesse générale → Da'if ──────────────────────
      // Phrases Dorar : "ضعيف", "لا يصح", "لا يثبت", "مجهول", "لا يعرف",
      // "إسناده ضعيف", "في إسناده ضعف", "ضعّفه"
      const RE_DAIF = /ضعيف|لا يصح|لا يثبت|مجهول|لا يعرف|في إسناده|إسناده ضعيف|ضعّفه/;

      // ── Bouclier Fort : Sahih / Hasan (conserve le badge vert/orange)
      const RE_STRONG = /صحيح|حسن/;

      // ── Catégorisation déterministe du grade Dorar ───────────────────
      const dorarIsMawdu    = RE_MAWDU.test(g);
      const dorarIsDaifJid  = !dorarIsMawdu && RE_DAIF_JIDDAN.test(g);
      const dorarIsDaif     = !dorarIsMawdu && !dorarIsDaifJid && RE_DAIF.test(g);
      const dorarIsWeak     = dorarIsMawdu || dorarIsDaifJid || dorarIsDaif;
      const dorarIsStrong   = RE_STRONG.test(g);

      // ── Analyse de ce que l'IA a produit ─────────────────────────────
      const expl = (parsed.grade_explique || "").toLowerCase();
      const aiClaimsStrong = /\bsahih\b|\bhasan\b|#2ecc71|#f39c12/.test(expl);
      const aiClaimsWeak   = /\bda.if\b|mawdu|munkar|#e74c3c|#8e44ad/.test(expl);

      // ── APPLICATION DU TRIPLE BOUCLIER ───────────────────────────────

      // Cas A : Dorar = faible/rejet ET l'IA prétend que c'est Sahih/Hasan
      // → Inversion détectée → on corrige
      if (dorarIsWeak && aiClaimsStrong && !aiClaimsWeak) {
        const nature = dorarIsMawdu ? "Mawdu'/Batil" : dorarIsDaifJid ? "Da'if Jiddan/Munkar" : "Da'if";
        console.log("HADITH[" + idx + "]_GRADE_INVERSION_DETECTEE (" + nature + "→Sahih) — corrige");
        parsed.grade_explique = DEFAULTS.grade_explique;
      }

      // Cas B : Dorar = fort (Sahih/Hasan) ET l'IA prétend que c'est Da'if
      // → Inversion inverse → on corrige
      if (dorarIsStrong && aiClaimsWeak && !aiClaimsStrong) {
        console.log("HADITH[" + idx + "]_GRADE_INVERSION_DETECTEE (Sahih/Hasan→Da'if) — corrige");
        parsed.grade_explique = DEFAULTS.grade_explique;
      }

      // Cas C : Dorar = phrase complexe de faiblesse (ex: "لا يعرف")
      // ET l'IA n'a affiché NI Da'if NI Sahih (INCONNU silencieux)
      // → Forcer le badge rouge Da'if pour coller au verdict Dorar
      if (dorarIsWeak && !aiClaimsWeak && !aiClaimsStrong) {
        const couleur = dorarIsMawdu ? "#8e44ad" : "#e74c3c";
        const labelFr = dorarIsMawdu ? "MAWDU&#39; — FABRIQUE" :
                        dorarIsDaifJid ? "DA&#39;IF JIDDAN — TRÈS FAIBLE" :
                        "DA&#39;IF — FAIBLE";
        console.log("HADITH[" + idx + "]_GRADE_PHRASE_COMPLEXE_DETECTEE (" + r.grade.substring(0,40) + ") — badge force");
        // Injecter un grade_explique minimal mais correct
        parsed.grade_explique =
          "<span style='color:" + couleur + ";font-weight:bold;'>" + labelFr + "</span>" +
          " — " + (r.savant || "Muhaddith") +
          (r.source ? ", " + r.source : "") + ".<br>" +
          "Verdict Dorar.net : <em>" + r.grade + "</em>.<br>" +
          (parsed.grade_explique && parsed.grade_explique.length > 20
            ? parsed.grade_explique
            : DEFAULTS.grade_explique);
      }

      // Log de traçabilité
      console.log("HADITH[" + idx + "]_ROUTAGE —",
        "grade_raw:", g.substring(0, 50),
        "| isMawdu:", dorarIsMawdu,
        "| isDaifJid:", dorarIsDaifJid,
        "| isDaif:", dorarIsDaif,
        "| isStrong:", dorarIsStrong
      );
    }

    return parsed;
  } catch (e) {
    console.log("HADITH[" + idx + "]_ERR:", e.message);
    return null;
  }
  // ⛔️ FIN DU SANCTUAIRE
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL — SSE PROGRESSIF + FALLBACK JSON
// Headers anti-buffering Vercel
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
  const wantSSE = (req.headers.accept || "").includes("text/event-stream");

  if (wantSSE) {
    // ── HEADERS ANTI-BUFFERING VERCEL ─────────────────────────────────────
    res.setHeader("Content-Type",       "text/event-stream; charset=utf-8");
    res.setHeader("X-Accel-Buffering",  "no");
    res.setHeader("Cache-Control",      "no-cache, no-transform");
    res.setHeader("Connection",         "keep-alive");
    res.setHeader("Transfer-Encoding",  "chunked");
    if (typeof res.flushHeaders === "function") res.flushHeaders();
    sseWrite(res, "status", { step: "TRADUCTION", msg: "Traduction Salafi en cours..." });
  }

  try {
    // ── ÉTAPE 1 : TRADUCTION FR→AR via LLM Salafi (température 0) ────────
    const arabicQuery = await _translateQueryToArabic(q);
    console.log("ARABIC_QUERY:", arabicQuery);

    if (wantSSE) sseWrite(res, "status", { step: "DORAR", msg: "Interrogation Dorar.net..." });

    // ── ÉTAPE 2 : DORAR ───────────────────────────────────────────────────
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

    // ── ÉTAPE 3 : PARSE ───────────────────────────────────────────────────
    const results = parseHadiths(html);
    if (!results.length) {
      console.log("PARSE_EMPTY");
      if (wantSSE) { sseWrite(res, "done", []); res.end(); return; }
      return res.status(200).json([]);
    }

    if (wantSSE) {
      sseWrite(res, "dorar", results);
      sseWrite(res, "status", {
        step:  "TAKHRIJ",
        msg:   "Analyse Jarh wa Ta'dil — Isnad 7e→21e siecle...",
        count: results.length
      });
    }

    // ── ÉTAPE 4 : ANALYSE IA BILINGUE — PARALLÈLE + LIVRAISON PROGRESSIVE
    console.log("PARALLEL_CALL:", results.length, "hadiths");

    if (wantSSE) {
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
          sseWrite(res, "hadith", { index: i, data: r });
          console.log("SSE_HADITH[" + i + "] — isnad_chain len:", r.isnad_chain.length,
                      "| french_text len:", r.french_text.length);
          return r;
        })
      );
      await Promise.all(promises);
      sseWrite(res, "done", results);
      res.end();

    } else {
      const analysesArray = await Promise.all(
        results.map((r, i) => analyserUnHadith(r, i, q))
      );
      console.log("PARALLEL_DONE:", analysesArray.filter(Boolean).length, "/", results.length);
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
      console.log("SUCCESS:", results.length, "hadiths enrichis (bilingue AR+FR)");
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
