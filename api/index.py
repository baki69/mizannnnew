"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  MÎZÂN AS-SUNNAH — api/index.py — Version 24.0                              ║
║  « Silsila al-Kâmila » — Extraction Chirurgicale de l'Isnâd                 ║
║                                                                              ║
║  ARCHITECTURE :                                                              ║
║    • Zéro hallucination : données manquantes = "Non spécifié dans la source" ║
║    • Dictionnaire _HUKM_AR_FR verrouillé (36 grades)                        ║
║    • XPath ultra-précis sur HTML Dorar.net (9 sélecteurs en cascade)        ║
║    • Flux SSE : INIT → TRADUCTION → DORAR → SANAD → HUKM → ENVOI           ║
║    • httpx asynchrone — aucun blocage possible                               ║
║    • Groupement des verdicts par Mohaddith (évite les contradictions)        ║
║    • Référence Takhrîj complète : Source + Volume + Page + Numéro           ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import unicodedata
from http.server import BaseHTTPRequestHandler
from typing import Any, AsyncGenerator
from urllib.parse import urlparse, parse_qs

import httpx
from lxml import html as lxml_html
from pydantic import BaseModel

# ─────────────────────────────────────────────────────────────────────────────
#  MODÈLE PYDANTIC — VALIDATION NŒUD SILSILA
# ─────────────────────────────────────────────────────────────────────────────

class SilsilaNode(BaseModel):
    rank: int = 0
    name_ar: str
    fr_name: str = ""
    role: str = "narrator"
    rawi_id: str | None = None
    rawi_url: str = ""
    century: str = ""
    death_year: int = 9999
    verified: bool = False


class HadithEnrichment(BaseModel):
    """
    Enrichissement textuel produit SOUS CONTRAINTE « Zéro Hallucination ».

    Chaque champ est soit :
      • une chaîne vide (absence honnête — Dorar ne contient pas l'info)
      • une chaîne renseignée (présence attestée, citation obligatoire)

    Règle d'or : aucun champ n'est jamais inventé par Claude.
    Source : .clauderules R8 (Protection Zones Al-Albani) + R21 (Test de
    Restauration Nulle) + demande utilisateur Action 2 (Amâna Médine).
    """
    grille_albani: str      = ""   # Verdict(s) d'Al-Albânî présents dans all_verdicts
    shurut_sihhah: str      = ""   # 5 conditions du Sahîh — déduites DÉTERMINISTEMENT
    gharib: str             = ""   # Vocabulaire des mots rares — Claude strict
    sabab_wurud: str        = ""   # Circonstance de narration — Claude strict (très rare)
    fawaid: str             = ""   # Leçons pratiques — Claude strict


# ─────────────────────────────────────────────────────────────────────────────
#  LOGGING
# ─────────────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="[Mîzân v24 %(levelname)s] %(message)s",
)
log = logging.getLogger("mizan_v24")

# ─────────────────────────────────────────────────────────────────────────────
#  CONSTANTES
# ─────────────────────────────────────────────────────────────────────────────
VERSION         = "24.1"
DORAR_API_URL   = "https://dorar.net/dorar_api.json"
DORAR_BASE      = "https://dorar.net"
ANTHROPIC_URL   = "https://api.anthropic.com/v1/messages"
ANTHROPIC_MODEL = "claude-3-5-sonnet-latest"
MAX_RESULTS     = 5
TIMEOUT_DORAR   = 18.0
TIMEOUT_DETAIL  = 10.0
TIMEOUT_CLAUDE  = 12.0

# Constante de données manquantes — affiché à la place d'un champ vide
MISSING = "Non spécifié dans la source"


# ─────────────────────────────────────────────────────────────────────────────
#  █  DICTIONNAIRE HUKM — VERROUILLÉ — ZÉRO TRADUCTION EXTERNE
#
#  Sources doctrinales :
#    • Taysîr Mustalah al-Hadîth (Dr. Mahmûd al-Tahhân)
#    • Al-Bâ'ith al-Hathîth (Ahmad Shâkir sur Ibn Kathîr)
#    • Minhaj al-Naqd (Dr. Nûr al-Dîn 'Itr)
#    • An-Nukat 'alâ Ibn al-Salâh (Ibn Hajar al-'Asqalânî)
#
#  RÈGLE ABSOLUE : Si l'arabe dit "صحيح لغيره", afficher UNIQUEMENT
#  "Authentique par accumulation (Sahîh li-ghayrihi)". Rien d'autre.
# ─────────────────────────────────────────────────────────────────────────────
_HUKM_AR_FR: dict[str, dict[str, Any]] = {

    # ══ GRADES SAHIH ══════════════════════════════════════════════════════
    "صحيح": {
        "fr": "Authentique (Sahîh)",
        "level": "sahih",
        "color": "#22c55e",
        "definition": (
            "Hadith dont la chaîne est continue de bout en bout, transmis par des "
            "narrateurs intègres ('adl) et précis (dâbit), sans anomalie (shudh) "
            "ni défaut caché ('illah)."
        ),
    },
    "صحيح لغيره": {
        "fr": "Authentique par accumulation (Sahîh li-ghayrihi)",
        "level": "sahih",
        "color": "#16a34a",
        "definition": (
            "Hadith hasan dont la multiplicité des voies de transmission (turuq) "
            "compense les légères faiblesses et élève son degré au rang du Sahîh."
        ),
    },
    "صحيح الإسناد": {
        "fr": "Chaîne authentique (Sahîh al-Isnâd)",
        "level": "sahih",
        "color": "#22c55e",
        "definition": (
            "Le muhaddith certifie l'authenticité de la chaîne uniquement, "
            "sans se prononcer explicitement sur le matn."
        ),
    },
    "إسناده صحيح": {
        "fr": "Sa chaîne est authentique (Isnâduhu Sahîh)",
        "level": "sahih",
        "color": "#22c55e",
        "definition": "Formulation équivalente à Sahîh al-Isnâd.",
    },
    "رجاله ثقات": {
        "fr": "Ses narrateurs sont fiables (Rijâluhu Thiqât)",
        "level": "sahih",
        "color": "#22c55e",
        "definition": (
            "Chaque narrateur de la chaîne a été classifié comme thiqah "
            "(fiable et précis) par les imams du Jarh wa at-Ta'dîl."
        ),
    },

    # ══ GRADES HASAN ══════════════════════════════════════════════════════
    "حسن": {
        "fr": "Bon (Hasan)",
        "level": "hasan",
        "color": "#84cc16",
        "definition": (
            "Hadith dont tous les narrateurs sont connus et intègres, sans atteindre "
            "le degré de précision absolue du Sahîh, et dont la chaîne est continue."
        ),
    },
    "حسن لغيره": {
        "fr": "Bon par accumulation (Hasan li-ghayrihi)",
        "level": "hasan",
        "color": "#65a30d",
        "definition": (
            "Hadith faible dont la multiplicité des voies compense la faiblesse "
            "et l'élève au degré du Hasan."
        ),
    },
    "حسن صحيح": {
        "fr": "Bon et authentique (Hasan Sahîh)",
        "level": "hasan",
        "color": "#4ade80",
        "definition": (
            "Formulation d'At-Tirmidhî indiquant soit que le hadith possède deux "
            "voies (l'une Hasan, l'autre Sahîh), soit que les savants divergent "
            "entre Hasan et Sahîh."
        ),
    },
    "حسن الإسناد": {
        "fr": "Chaîne bonne (Hasan al-Isnâd)",
        "level": "hasan",
        "color": "#84cc16",
        "definition": "Le muhaddith certifie la bonté de la chaîne uniquement.",
    },
    "إسناده حسن": {
        "fr": "Sa chaîne est bonne (Isnâduhu Hasan)",
        "level": "hasan",
        "color": "#84cc16",
        "definition": "Formulation équivalente à Hasan al-Isnâd.",
    },
    "مقبول": {
        "fr": "Acceptable (Maqbûl)",
        "level": "hasan",
        "color": "#a3e635",
        "definition": (
            "Terme technique d'Ibn Hajar désignant un narrateur dont le hadith "
            "est accepté en l'absence de contradicteur."
        ),
    },

    # ══ GRADES DA'IF ══════════════════════════════════════════════════════
    "ضعيف": {
        "fr": "Faible (Da'îf)",
        "level": "daif",
        "color": "#f59e0b",
        "definition": (
            "Hadith n'atteignant pas le degré du Hasan, en raison d'une coupure "
            "dans la chaîne, d'un narrateur défaillant dans son intégrité ou sa précision."
        ),
    },
    "ضعيف جداً": {
        "fr": "Très faible (Da'îf Jiddan)",
        "level": "daif",
        "color": "#d97706",
        "definition": (
            "Hadith dont la faiblesse est sévère : narrateur accusé de mensonge, "
            "de fabrication, ou chaîne comportant plusieurs défauts graves simultanés."
        ),
    },
    "ضعيف جدا": {
        "fr": "Très faible (Da'îf Jiddan)",
        "level": "daif",
        "color": "#d97706",
        "definition": "Variante orthographique de Da'îf Jiddan — même définition.",
    },
    "ضعيف الإسناد": {
        "fr": "Chaîne faible (Da'îf al-Isnâd)",
        "level": "daif",
        "color": "#f59e0b",
        "definition": (
            "Le muhaddith juge uniquement la chaîne faible, "
            "sans se prononcer sur le fond du matn."
        ),
    },
    "إسناده ضعيف": {
        "fr": "Sa chaîne est faible (Isnâduhu Da'îf)",
        "level": "daif",
        "color": "#f59e0b",
        "definition": "Formulation équivalente à Da'îf al-Isnâd.",
    },
    "لين": {
        "fr": "Légèrement faible (Layyin)",
        "level": "daif",
        "color": "#fbbf24",
        "definition": (
            "Narrateur d'une intégrité acceptable mais dont la précision mémorielle "
            "est légèrement insuffisante. Son hadith peut servir de renfort."
        ),
    },
    "لين الحديث": {
        "fr": "Légèrement faible dans la narration (Layyin al-Hadîth)",
        "level": "daif",
        "color": "#fbbf24",
        "definition": (
            "Le narrateur commet quelques erreurs ; son hadith est retenu "
            "uniquement à titre complémentaire (shâhid ou mutâbi')."
        ),
    },
    "فيه ضعف": {
        "fr": "Comporte une faiblesse (Fîhi Da'f)",
        "level": "daif",
        "color": "#f59e0b",
        "definition": (
            "Le hadith présente une faiblesse identifiée mais non rédhibitoire ; "
            "il peut être cité à titre d'information."
        ),
    },
    "فيه مقال": {
        "fr": "Sujet à discussion (Fîhi Maqâl)",
        "level": "daif",
        "color": "#f59e0b",
        "definition": (
            "Les savants divergent sur l'acceptabilité du narrateur ou de la chaîne ; "
            "la prudence s'impose."
        ),
    },

    # ══ GRADES DÉFECTUEUX ═════════════════════════════════════════════════
    "منكر": {
        "fr": "Répréhensible (Munkar)",
        "level": "rejected",
        "color": "#ef4444",
        "definition": (
            "Hadith transmis par un narrateur faible en contradiction directe avec "
            "un narrateur fiable. Terme de rejet formel dans la terminologie hadith."
        ),
    },
    "شاذ": {
        "fr": "Anomal / Déviant (Shâdhdh)",
        "level": "rejected",
        "color": "#f87171",
        "definition": (
            "Hadith dont un narrateur fiable contredit ce que rapportent d'autres "
            "narrateurs plus fiables ou plus nombreux."
        ),
    },
    "معلول": {
        "fr": "Défectueux caché (Ma'lûl)",
        "level": "rejected",
        "color": "#dc2626",
        "definition": (
            "Hadith présentant un défaut caché ('illah) décelable uniquement par "
            "les experts du hadith, malgré une apparence extérieure de solidité."
        ),
    },
    "معل": {
        "fr": "Défectueux (Mu'all)",
        "level": "rejected",
        "color": "#dc2626",
        "definition": "Variante de Ma'lûl — même définition.",
    },
    "مضطرب": {
        "fr": "Perturbé / Contradictoire (Mudtarib)",
        "level": "rejected",
        "color": "#f87171",
        "definition": (
            "Hadith rapporté de manières contradictoires (dans la chaîne ou le texte) "
            "sans qu'il soit possible de déterminer la version correcte."
        ),
    },
    "مدرج": {
        "fr": "Interpolé (Mudraj)",
        "level": "rejected",
        "color": "#fca5a5",
        "definition": (
            "Hadith dont le texte a été mélangé avec des paroles d'un narrateur "
            "sans séparation apparente."
        ),
    },
    "مدلس": {
        "fr": "Objet de talbîs / Dissimulé (Mudallis)",
        "level": "rejected",
        "color": "#fb7185",
        "definition": (
            "Le narrateur dissimule un défaut dans la chaîne ou présente une "
            "transmission directe fictive (tadlîs al-isnâd)."
        ),
    },
    "مرسل": {
        "fr": "Interrompu côté Successeur (Mursal)",
        "level": "rejected",
        "color": "#f97316",
        "definition": (
            "Un Successeur (tâbi'î) cite directement le Prophète ﷺ sans mentionner "
            "le Compagnon intermédiaire."
        ),
    },
    "منقطع": {
        "fr": "Coupé (Munqati')",
        "level": "rejected",
        "color": "#fb923c",
        "definition": (
            "La chaîne comporte une coupure en un ou plusieurs endroits, "
            "hors le cas du Mursal."
        ),
    },
    "معضل": {
        "fr": "Doublement interrompu (Mu'dal)",
        "level": "rejected",
        "color": "#f87171",
        "definition": (
            "La chaîne comporte deux maillons consécutifs manquants ou plus."
        ),
    },
    "معلق": {
        "fr": "Suspendu / Début de chaîne omis (Mu'allaq)",
        "level": "rejected",
        "color": "#fca5a5",
        "definition": (
            "Un ou plusieurs narrateurs du début de la chaîne ont été omis "
            "par le compilateur."
        ),
    },
    "مقطوع": {
        "fr": "Arrêté au Successeur (Maqtû')",
        "level": "mawquf",
        "color": "#94a3b8",
        "definition": (
            "Paroles ou actes d'un Successeur (tâbi'î), non attribués au Prophète ﷺ."
        ),
    },
    "موقوف": {
        "fr": "Arrêté au Compagnon (Mawqûf)",
        "level": "mawquf",
        "color": "#94a3b8",
        "definition": (
            "Paroles ou actes d'un Compagnon (sahâbî), non attribués au Prophète ﷺ."
        ),
    },

    # ══ GRADES FORGÉS ═════════════════════════════════════════════════════
    "موضوع": {
        "fr": "Forgé / Inventé (Mawdû')",
        "level": "mawdu",
        "color": "#7f1d1d",
        "definition": (
            "Hadith fabriqué et faussement attribué au Prophète ﷺ. "
            "Sa propagation est strictement interdite sauf pour mettre en garde."
        ),
    },
    "باطل": {
        "fr": "Nul et non avenu (Bâtil)",
        "level": "mawdu",
        "color": "#991b1b",
        "definition": (
            "Hadith dont le contenu ou la chaîne est manifestement faux, "
            "sans aucune base dans la Sunnah."
        ),
    },
    "لا أصل له": {
        "fr": "Sans fondement (Lâ Asl Lahu)",
        "level": "mawdu",
        "color": "#7f1d1d",
        "definition": (
            "Verdict des muhaddithîn indiquant qu'aucune chaîne valide "
            "ne rattache ce texte au Prophète ﷺ."
        ),
    },
    "لا يصح": {
        "fr": "Non authentifié (Lâ Yasihh)",
        "level": "mawdu",
        "color": "#991b1b",
        "definition": "Verdict catégorique d'invalidité, plus sévère que Da'îf.",
    },
    "لا يثبت": {
        "fr": "Non établi (Lâ Yathbut)",
        "level": "mawdu",
        "color": "#7f1d1d",
        "definition": (
            "Le hadith n'est pas prouvé selon les critères reconnus "
            "de la science du hadith."
        ),
    },
    "مكذوب": {
        "fr": "Mensonge attribué (Makdhûb)",
        "level": "mawdu",
        "color": "#991b1b",
        "definition": (
            "Hadith attribué mensongèrement au Prophète ﷺ, "
            "par un narrateur menteur ou un fabricateur."
        ),
    },
}


# ─────────────────────────────────────────────────────────────────────────────
#  TRANSLITTÉRATIONS CANONIQUES
# ─────────────────────────────────────────────────────────────────────────────
_TRANSLITT: dict[str, str] = {
    "أبو هريرة":        "Abû Hurayra (رضي الله عنه)",
    "عائشة":            "ʿÂ'isha bint Abî Bakr (رضي الله عنها)",
    "ابن عمر":          "Ibn ʿUmar (رضي الله عنهما)",
    "عبد الله بن عمر":  "ʿAbdallâh ibn ʿUmar (رضي الله عنهما)",
    "ابن عباس":         "Ibn ʿAbbâs (رضي الله عنهما)",
    "عبد الله بن عباس": "ʿAbdallâh ibn ʿAbbâs (رضي الله عنهما)",
    "أنس بن مالك":      "Anas ibn Mâlik (رضي الله عنه)",
    "أنس":              "Anas ibn Mâlik (رضي الله عنه)",
    "جابر":             "Jâbir ibn ʿAbdallâh (رضي الله عنهما)",
    "جابر بن عبد الله": "Jâbir ibn ʿAbdallâh (رضي الله عنهما)",
    "أبو سعيد الخدري":  "Abû Saʿîd al-Khudrî (رضي الله عنه)",
    "أبو موسى":         "Abû Mûsâ al-Ash'arî (رضي الله عنه)",
    "معاذ بن جبل":      "Muʿâdh ibn Jabal (رضي الله عنه)",
    "عمر بن الخطاب":    "ʿUmar ibn al-Khattâb (رضي الله عنه)",
    "علي بن أبي طالب":  "ʿAlî ibn Abî Tâlib (رضي الله عنه)",
    "عثمان بن عفان":    "ʿUthmân ibn ʿAffân (رضي الله عنه)",
    "أبو بكر الصديق":   "Abû Bakr as-Siddîq (رضي الله عنه)",
    "البخاري":          "Al-Bukhârî رحمه الله (m. 256H)",
    "مسلم":             "Muslim ibn al-Hajjâj رحمه الله (m. 261H)",
    "الترمذي":          "At-Tirmidhî رحمه الله (m. 279H)",
    "أبو داود":         "Abû Dâwûd رحمه الله (m. 275H)",
    "النسائي":          "An-Nasâ'î رحمه الله (m. 303H)",
    "ابن ماجه":         "Ibn Mâja رحمه الله (m. 273H)",
    "أحمد":             "Ahmad ibn Hanbal رحمه الله (m. 241H)",
    "الحاكم":           "Al-Hâkim رحمه الله (m. 405H)",
    "الطبراني":         "At-Tabarânî رحمه الله (m. 360H)",
    "البيهقي":          "Al-Bayhaqî رحمه الله (m. 458H)",
    "الدارقطني":        "Ad-Dâraqutnî رحمه الله (m. 385H)",
    "ابن حبان":         "Ibn Hibbân رحمه الله (m. 354H)",
    "ابن خزيمة":        "Ibn Khuzayma رحمه الله (m. 311H)",
    "الدارمي":          "Ad-Dârimî رحمه الله (m. 255H)",
    "الألباني":         "Cheikh Al-Albânî رحمه الله (m. 1420H)",
    "ابن باز":          "Cheikh Ibn Bâz رحمه الله (m. 1420H)",
    "ابن حجر":          "Ibn Hajar al-ʿAsqalânî رحمه الله (m. 852H)",
    "الذهبي":           "Adh-Dhahabî رحمه الله (m. 748H)",
    "النووي":           "An-Nawawî رحمه الله (m. 676H)",
    "ابن كثير":         "Ibn Kathîr رحمه الله (m. 774H)",
    "السيوطي":          "As-Suyûtî رحمه الله (m. 911H)",
    "ابن الجوزي":       "Ibn al-Jawzî رحمه الله (m. 597H)",
    "العراقي":          "Al-ʿIrâqî رحمه الله (m. 806H)",
    "ابن تيمية":        "Ibn Taymiyya رحمه الله (m. 728H)",
    "ابن القيم":        "Ibn al-Qayyim رحمه الله (m. 751H)",
    "الوادعي":          "Cheikh Al-Wâdi'î رحمه الله (m. 1422H)",
    "أبو يعلى":         "Abû Ya'lâ رحمه الله (m. 307H)",
    "البزار":           "Al-Bazzâr رحمه الله (m. 292H)",
}

# ─────────────────────────────────────────────────────────────────────────────
#  BASE DES SAHABAS CONNUS (pour rôle dans la silsila)
# ─────────────────────────────────────────────────────────────────────────────
_SAHABAS: set[str] = {
    "أبو هريرة", "عائشة", "ابن عمر", "عبد الله بن عمر",
    "ابن عباس", "عبد الله بن عباس", "أنس بن مالك", "أنس",
    "جابر", "جابر بن عبد الله", "أبو سعيد الخدري", "أبو سعيد",
    "أبو موسى الأشعري", "أبو موسى", "معاذ بن جبل", "معاذ",
    "عمر بن الخطاب", "عمر", "علي بن أبي طالب", "علي",
    "عثمان بن عفان", "عثمان", "أبو بكر الصديق", "أبو بكر",
    "عبد الله بن عمرو", "سهل بن سعد", "البراء بن عازب",
    "النعمان بن بشير", "واثلة بن الأسقع", "أبو أمامة",
    "معاوية بن أبي سفيان", "معاوية", "سلمان الفارسي",
    "أبو ذر الغفاري", "أبو ذر", "بلال بن رباح", "بلال",
    "عبد الله بن مسعود", "ابن مسعود", "أبو الدرداء",
    "ثوبان", "رافع بن خديج", "حذيفة بن اليمان", "حذيفة",
    "أبو أيوب الأنصاري", "زيد بن ثابت", "أبو قتادة",
    "المقداد بن الأسود", "عمرو بن العاص", "خالد بن الوليد",
    "عبادة بن الصامت", "أبو هريرة الدوسي",
}

# ─────────────────────────────────────────────────────────────────────────────
#  ① UTILITAIRES — Normalisation et nettoyage
# ─────────────────────────────────────────────────────────────────────────────

def _strip_tashkil(text: str) -> str:
    """Supprime les diacritiques arabes (U+0610–U+061A, U+064B–U+065F, U+0670)."""
    return re.sub(r"[\u0610-\u061a\u064b-\u065f\u0670]", "", text)


def _normalize_ar(text: str) -> str:
    """Normalisation canonique : NFC + alif unifié + tashkil + espaces."""
    if not text:
        return ""
    text = unicodedata.normalize("NFC", text)
    text = _strip_tashkil(text)
    text = re.sub(r"[أإآ]", "ا", text)
    text = re.sub(r"[ىي]", "ي", text)
    return re.sub(r"\s+", " ", text).strip()


def _clean_text(raw: str) -> str:
    """Supprime balises HTML et normalise les espaces."""
    if not raw:
        return ""
    raw = re.sub(r"<[^>]+>", " ", raw)
    return re.sub(r"\s+", " ", raw).strip()


def _clean_name(raw: str) -> str:
    """Nettoie un nom de narrateur extrait du DOM."""
    if not raw:
        return ""
    raw = _clean_text(raw)
    # Supprimer les formules de transmission en tête
    raw = re.sub(
        r"^(عن|حدثنا|حدّثنا|أخبرنا|أخبرني|أنبأنا|أنبأني|قال|روى|سمعت|ثنا|نا)\s+",
        "", raw.strip()
    )
    # Supprimer les caractères parasites
    raw = re.sub(r"[\[\](){}\\/|0-9،,;]", "", raw)
    return re.sub(r"\s+", " ", raw).strip()


# Regex compilée une seule fois — supprime titres honorifiques et formules
# post-nom parasites dans les entrées de silsila/isnad.
_ISNAD_TITLE_RE = re.compile(
    r"""
    # ── Titres honorifiques pré-nom ──────────────────────────────────────
    \b(
        الإمام|الامام|الشيخ|الشّيخ|الحافظ|الحافظ|العلامة|العلامه|
        المحدث|المحدّث|الحجة|الثقة|الثّقة|الفقيه|القاضي|الحاكم|
        الخطيب|السيد|الأستاذ|الدكتور|سيدنا|مولانا|شيخنا|حافظنا
    )\s+
    |
    # ── Formules post-nom (bénédictions / métadonnées) ──────────────────
    \s*[–\-—]\s*.*$               # tiret suivi de métadonnées
    |
    \s*[،,]\s*\d+\s*[هـه]?\s*$   # numéro de décès en fin
    |
    \s*\(.*?\)                    # parenthèses entières
    |
    \s*(رحمه الله|رحمه الله تعالى|رضي الله عنه|رضي الله عنها|
        صلى الله عليه وسلم|عليه السلام|حفظه الله|وفقه الله|
        نفعنا الله به|أمد الله في عمره|المتوفى|ت\.)
    """,
    re.VERBOSE | re.UNICODE,
)


def _clean_isnad_name(raw: str) -> str:
    """
    Nettoie un nom dans la silsila/isnad :
      1. Applique _clean_name (formules de transmission, caractères parasites)
      2. Supprime les titres honorifiques (الإمام, الشيخ, الحافظ…)
      3. Supprime les formules post-nom (رحمه الله, رضي الله عنه…)
      4. Supprime les métadonnées entre parenthèses et après tiret

    Conserve UNIQUEMENT le nom propre canonique du narrateur.
    """
    name = _clean_name(raw)
    if not name:
        return ""
    name = _ISNAD_TITLE_RE.sub("", name)
    return re.sub(r"\s+", " ", name).strip()


def _is_arabic(text: str) -> bool:
    """True si le texte est majoritairement arabe (> 30 %)."""
    if not text:
        return False
    ar = sum(1 for c in text if "\u0600" <= c <= "\u06FF")
    return ar > len(text.strip()) * 0.3


def _extract_rijal_id(href: str) -> str | None:
    """Extrait l'ID Dorar d'un narrateur depuis son URL /rijal/ID."""
    if not href:
        return None
    m = re.search(r"/rijal/([^/?#\s]+)", href)
    return m.group(1) if m else None


def _transliterate(ar_name: str) -> str:
    """Translittère un nom arabe selon le dictionnaire canonique."""
    if not ar_name:
        return ""
    norm = _normalize_ar(ar_name)
    for ar_key, fr_val in _TRANSLITT.items():
        norm_key = _normalize_ar(ar_key)
        if norm_key == norm or norm_key in norm or norm in norm_key:
            return fr_val
    return ar_name


def _is_sahabi(name: str) -> bool:
    """Vérifie si un nom correspond à un Sahabi de la base connue."""
    if not name:
        return False
    norm = _normalize_ar(name)
    for s in _SAHABAS:
        norm_s = _normalize_ar(s)
        if norm_s == norm or norm_s in norm or norm in norm_s:
            return True
    return False


def _infer_century(name: str) -> str:
    """Infère le siècle hégirien depuis le nom du muhaddith."""
    _MAP: dict[str, str] = {
        "مالك": "2H", "الأوزاعي": "2H", "سفيان الثوري": "2H",
        "شعبة": "2H", "ابن المبارك": "2H",
        "البخاري": "3H", "مسلم": "3H", "أبو داود": "3H",
        "الترمذي": "3H", "النسائي": "3H", "ابن ماجه": "3H",
        "أحمد": "3H", "ابن حنبل": "3H", "الدارمي": "3H",
        "الطبراني": "4H", "ابن خزيمة": "4H", "الحاكم": "4H",
        "أبو يعلى": "4H", "البزار": "4H", "الدارقطني": "4H",
        "ابن حبان": "4H", "البيهقي": "5H", "الخطيب البغدادي": "5H",
        "ابن الجوزي": "6H", "النووي": "7H", "الذهبي": "8H",
        "ابن كثير": "8H", "العراقي": "8H", "ابن حجر": "9H",
        "السيوطي": "9H", "ابن تيمية": "8H", "ابن القيم": "8H",
        "الألباني": "14H", "ابن باز": "14H", "ابن عثيمين": "14H",
        "الوادعي": "14H", "مقبل": "14H",
    }
    norm = _normalize_ar(name)
    for key, century in _MAP.items():
        if _normalize_ar(key) in norm:
            return century
    return MISSING


_CENTURY_TO_YEAR: dict[str, int] = {
    "1H": 100, "2H": 200, "3H": 300, "4H": 400, "5H": 500,
    "6H": 600, "7H": 700, "8H": 800, "9H": 900,
    "10H": 1000, "11H": 1100, "12H": 1200, "13H": 1300, "14H": 1400,
}


def _century_to_death_year(century: str) -> int:
    """Convertit un siècle hégirien (ex: '3H') en entier approximatif (ex: 300)."""
    return _CENTURY_TO_YEAR.get(century, 9999)


# ─────────────────────────────────────────────────────────────────────────────
#  ② APPLICATION DU HUKM — DICTIONNAIRE VERROUILLÉ
# ─────────────────────────────────────────────────────────────────────────────

def _apply_hukm(hukm_raw: str) -> dict[str, Any]:
    """
    Applique le dictionnaire _HUKM_AR_FR au grade brut.

    Priorité de correspondance :
      1. Exact normalisé
      2. Clé contenue dans le texte brut
      3. Clé normalisée contenue dans le texte normalisé
      4. Fallback : texte conservé, level=unknown

    JAMAIS de donnée manquante dans le résultat — MISSING si vide.
    """
    if not hukm_raw or not hukm_raw.strip():
        return {
            "ar": MISSING, "fr": MISSING,
            "level": "unknown", "color": "#6b7280",
            "definition": MISSING, "raw": "",
        }

    cleaned = hukm_raw.strip()
    norm_in = _normalize_ar(cleaned)

    for ar_key, data in _HUKM_AR_FR.items():
        if _normalize_ar(ar_key) == norm_in:
            return {**data, "ar": cleaned, "raw": cleaned}

    for ar_key, data in _HUKM_AR_FR.items():
        if ar_key in cleaned:
            return {**data, "ar": cleaned, "raw": cleaned}

    for ar_key, data in _HUKM_AR_FR.items():
        if _normalize_ar(ar_key) in norm_in:
            return {**data, "ar": cleaned, "raw": cleaned}

    return {
        "ar": cleaned,
        "fr": f"Grade non répertorié : {cleaned}",
        "level": "unknown",
        "color": "#6b7280",
        "definition": MISSING,
        "raw": cleaned,
    }


# ─────────────────────────────────────────────────────────────────────────────
#  ②.5  HIÉRARCHIE D'AUTORITÉ DES SOURCES — ANTI-DÉGRADATION SAHÎHAYN
#
#  Mission : corriger l'erreur grave d'Amâna où des hadiths rapportés par
#  Bukhârî ou Muslim étaient tagués Da'îf à cause d'un doublon (même matn)
#  provenant d'un recueil secondaire mal gradé sur Dorar. Le moteur doit
#  TOUJOURS privilégier la source la plus haute dans la hiérarchie classique
#  des muhaddithîn.
# ─────────────────────────────────────────────────────────────────────────────

def _get_authority_score(mohaddith: str, source: str) -> int:
    """
    Calcule le score d'autorité d'une source de hadith selon la hiérarchie
    classique des muhaddithîn.

    BARÈME DE FER — Règle de non-dégradation :
      • 100 : Al-Bukhârî / Muslim (Sahîhayn)    → Verdict forcé « صحيح »
      •  90 : Muwatta' Mâlik                    → Conserve verdict Dorar
      •  80 : Sunan (Abû Dâwûd, Tirmidhî, Nasâ'î, Ibn Mâja) + Musnad Ahmad
      •  70 : Cheikh Al-Albânî                  — Autorité moderne
      •   0 : Source inconnue ou non listée

    Règle d'inspection : les champs `mohaddith` ET `source` sont tous deux
    scannés — Dorar distribue parfois le nom du compilateur dans l'un ou
    l'autre selon le bloc HTML rendu.

    Ordre des vérifications : du plus spécifique (titre de livre complet)
    au plus générique (nom seul), pour éviter les faux positifs.
    """
    blob = f"{mohaddith or ''} {source or ''}"
    norm = _normalize_ar(blob)

    # ── 100 — Sahîhayn ───────────────────────────────────────────────────
    # Titres complets d'abord, puis nom court ; "صحيح مسلم" avant "مسلم"
    # pour éviter toute collision avec d'autres noms portant la racine.
    for key in (
        "صحيح البخاري", "الجامع الصحيح", "بخاري",
        "صحيح مسلم", "مسلم",
    ):
        if _normalize_ar(key) in norm:
            return 100

    # ── 90 — Muwatta' Mâlik ──────────────────────────────────────────────
    # "موطأ" et "موطأ مالك" d'abord ; "مالك بن أنس" ensuite ; "مالك" en
    # dernier (plus générique mais acceptable dans le champ mohaddith).
    for key in ("موطا مالك", "موطا", "مالك بن انس", "مالك"):
        if _normalize_ar(key) in norm:
            return 90

    # ── 80 — Sunan + Musnad Ahmad ─────────────────────────────────────────
    # "مسند أحمد" et "ابن حنبل" avant "أحمد" seul pour plus de précision.
    for key in (
        "مسند احمد", "ابن حنبل",
        "ابو داود", "ترمذي", "نسائي", "ابن ماجه",
        "احمد",
    ):
        if _normalize_ar(key) in norm:
            return 80

    # ── 70 — Al-Albânî ───────────────────────────────────────────────────
    # _normalize_ar unifie alif + ya → toutes variantes orthographiques
    # (الألباني / الألبانى / الالباني) convergent vers "الالباني".
    if _normalize_ar("الالباني") in norm:
        return 70

    return 0


def _dedupe_hadiths_by_authority(
    hadiths: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Déduplication STRICTE par matn arabe (normalisé) — BARÈME DE FER.

    Pour un même texte arabe (ou quasi-identique), on ne conserve QUE le
    hadith ayant le plus haut score d'autorité via `_get_authority_score`.
    Cela empêche qu'un hadith de Bukhârî/Muslim soit éliminé ou dégradé à
    cause d'un doublon issu d'un recueil secondaire mal gradé sur Dorar.

    Règle de fusion des verdicts :
      • Quel que soit le "gagnant" (score max), les `all_verdicts` des deux
        doublons sont FUSIONNÉS pour ne perdre aucun avis savant.
      • Le `detail_url` du perdant est conservé comme fallback si le gagnant
        n'en possède pas.

    L'ordre d'apparition relatif est préservé pour les matns uniques.
    La quasi-identité est obtenue via `_normalize_ar` (NFC + tashkîl +
    alif/yâ unifiés) tronqué à 220 caractères : absorbe les micro-variations
    de ponctuation et de longueur.
    """
    best: dict[str, dict[str, Any]] = {}
    order: list[str] = []

    for h in hadiths:
        ar_text = h.get("ar_text", "") or ""
        key = _normalize_ar(ar_text)[:220]
        if not key:
            # Matn absent → on garde le hadith sous une clé unique
            key = f"__no_matn__{len(order)}"

        score = _get_authority_score(
            h.get("mohaddith", ""),
            h.get("source", ""),
        )

        if key not in best:
            best[key] = {**h, "_authority_score": score}
            order.append(key)
            continue

        existing      = best[key]
        existing_score = existing.get("_authority_score", 0)

        # Fusion des verdicts : on cumule toujours les avis savants des deux
        # doublons pour ne jamais perdre une opinion doctrinale.
        merged_verdicts: list[dict[str, Any]] = list(
            existing.get("all_verdicts") or []
        ) + list(h.get("all_verdicts") or [])

        if score > existing_score:
            log.info(
                f"[DEDUP] Matn dupliqué — remplacement "
                f"(score {existing_score} → {score}) — "
                f"source retenue : {h.get('source', '?')} / "
                f"source écartée : {existing.get('source', '?')}"
            )
            # Gagnant = nouvelle entrée (score plus élevé)
            best[key] = {
                **h,
                "_authority_score": score,
                "all_verdicts":     merged_verdicts,
                # Conserver le detail_url du perdant si le gagnant n'en a pas
                "detail_url": (
                    h.get("detail_url")
                    or existing.get("detail_url")
                    or ""
                ),
            }
        else:
            log.info(
                f"[DEDUP] Matn dupliqué — conservation "
                f"(score {existing_score} ≥ {score}) — "
                f"source écartée : {h.get('source', '?')}"
            )
            # Gagnant = entrée existante ; on enrichit juste ses verdicts
            best[key] = {
                **existing,
                "all_verdicts": merged_verdicts,
                "detail_url": (
                    existing.get("detail_url")
                    or h.get("detail_url")
                    or ""
                ),
            }

    return [best[k] for k in order]


def _apply_authority_override(
    hadith: dict[str, Any],
    hukm: dict[str, Any],
) -> dict[str, Any]:
    """
    RÈGLE DE FER (Amâna Médine) : si le score d'autorité d'une source atteint
    100 (Bukhârî ou Muslim), on force le verdict à « صحيح » / « Sahih »,
    PEU IMPORTE ce que la chaîne de traitement ou Dorar a pu remonter.

    Cette règle écrase tout verdict contradictoire hérité d'un doublon ou
    d'un parsing partiel. Elle ne s'applique PAS aux scores < 100 — le
    dictionnaire Hukm verrouillé conserve alors sa préséance.
    """
    score = _get_authority_score(
        hadith.get("mohaddith", ""),
        hadith.get("source", ""),
    )
    if score < 100:
        return hukm

    log.info(
        f"[AUTHORITY=100] Override Sahîh forcé — "
        f"source : {hadith.get('source', '?')} — "
        f"ancien hukm : {hukm.get('ar', '?')}"
    )

    sahih_ref = _HUKM_AR_FR.get("صحيح", {})
    return {
        **hukm,
        "ar":         "صحيح",
        "fr":         "Sahih",
        "level":      "sahih",
        "color":      sahih_ref.get("color", "#22c55e"),
        "definition": sahih_ref.get("definition", hukm.get("definition", MISSING)),
        "raw":        hukm.get("raw", "") or "صحيح",
    }


def _group_verdicts_by_mohaddith(
    verdicts: list[dict[str, Any]]
) -> dict[str, dict[str, Any]]:
    """
    Groupe les verdicts par Mohaddith pour éviter les contradictions visuelles.
    Un même muhaddith ne peut avoir qu'un seul verdict affiché.
    """
    grouped: dict[str, dict[str, Any]] = {}
    for v in verdicts:
        mohaddith_ar = v.get("mohaddith", "")
        key = _transliterate(mohaddith_ar) or mohaddith_ar or MISSING
        if key not in grouped:
            grouped[key] = {
                "ar_name": mohaddith_ar or MISSING,
                "fr_name": key,
                "hukm_ar": v.get("ar", MISSING),
                "hukm_fr": v.get("fr", MISSING),
                "level":   v.get("level", "unknown"),
                "color":   v.get("color", "#6b7280"),
            }
    return grouped


def _extract_albani_from_verdicts(verdicts: list[dict[str, Any]]) -> str:
    """
    Parcourt all_verdicts et retourne UNIQUEMENT les verdicts attribués
    à Shaykh Nâsir ad-Dîn al-Albânî, s'ils existent dans la réponse Dorar.

    PROTOCOLE ZÉRO HALLUCINATION :
      • Lecture seule du champ all_verdicts déjà scrapé.
      • Aucune invention, aucun appel IA.
      • Si Al-Albânî n'est pas présent → chaîne vide.
        Le fallback frontend « CONSULTER AL-ALBANI » (Rule 8) prend le relais.
    """
    lines: list[str] = []

    for v in verdicts:
        moh_ar = (v.get("mohaddith") or "")
        # Variantes orthographiques arabes courantes du nom
        if any(
            k in moh_ar
            for k in ("الألباني", "الألبانى", "الالباني", "الألبانِي")
        ):
            ar = (v.get("ar") or "").strip()
            fr = (v.get("fr") or "").strip()
            chunk: list[str] = []
            if ar:
                chunk.append(f"**Verdict arabe** : {ar}")
            if fr:
                chunk.append(f"**Traduction** : {fr}")
            if chunk:
                lines.append(" — ".join(chunk))

    if not lines:
        return ""

    return (
        "**GRILLE AL-ALBĀNĪ — Analyse selon Shaykh Nâsir ad-Dîn al-Albânî**\n\n"
        + "\n\n".join(lines)
    )


# ─────────────────────────────────────────────────────────────────────────────
#  ③ PARSING HTML DORAR — XPATH ULTRA-PRÉCIS
# ─────────────────────────────────────────────────────────────────────────────

def _parse_dorar_html(raw_html: str) -> list[dict[str, Any]]:
    """
    Parse le HTML de l'API Dorar.net avec XPath précis.

    Structure HTML réelle de Dorar (auditée sur le DOM en production) :
    ──────────────────────────────────────────────────────────────────
    • Les hadiths sont séparés par ' --- ' dans le JSON
    • Chaque bloc :
        div.hadith            → Matn arabe (excluant div.hadith-info)
        span.info-subtitle    → Labels : الراوي / المحدث / المصدر / الصفحة / الحكم
        a[href*=/rijal/]      → Liens narrateurs (silsila)
        a[href*=/hadith/]     → Lien page de détail (scraping silsila complète)
    ──────────────────────────────────────────────────────────────────
    """
    results: list[dict[str, Any]] = []
    if not raw_html or not raw_html.strip():
        return results

    blocks = re.split(r"\s*---\s*", raw_html)
    log.info(f"Dorar HTML → {len(blocks)} blocs bruts")

    for i, block_str in enumerate(blocks):
        block_str = block_str.strip()
        if not block_str or len(block_str) < 25:
            continue

        try:
            tree = lxml_html.fromstring(
                f"<div class='mz-wrapper'>{block_str}</div>"
            )
        except Exception as exc:
            log.warning(f"Bloc {i} : lxml échoué — {exc}")
            continue

        h: dict[str, Any] = {
            "ar_text":       "",
            "rawi":          "",
            "rawi_id":       None,
            "rawi_url":      "",
            "mohaddith":     "",
            "mohaddith_id":  None,
            "mohaddith_url": "",
            "source":        "",
            "source_url":    "",
            "volume":        MISSING,
            "page":          MISSING,
            "hadith_number": MISSING,
            "hukm_raw":      "",
            "hukm":          {},
            "detail_url":    None,
            "rijal_links":   [],
            "all_verdicts":  [],
        }

        # ── MATN — texte arabe ──────────────────────────────────────────
        for el in tree.xpath('.//div[contains(@class,"hadith")]'):
            if "hadith-info" in el.get("class", ""):
                continue
            text = el.text_content().strip()
            if text and len(text) > 15 and _is_arabic(text[:80]):
                h["ar_text"] = text
                break

        # Fallback sur paragraphes / divs arabes
        if not h["ar_text"]:
            for el in tree.xpath('.//p | .//div'):
                txt = el.text_content().strip()
                if len(txt) > 30 and _is_arabic(txt[:60]):
                    h["ar_text"] = txt[:1200]
                    break

        # ── MÉTADONNÉES via span.info-subtitle ─────────────────────────
        for label_el in tree.xpath('.//span[@class="info-subtitle"]'):
            label = label_el.text_content().strip()
            parent = label_el.getparent()
            if parent is None:
                continue

            parent_text = _clean_text(
                parent.text_content().replace(label, "", 1)
            )
            rij_links = parent.xpath('.//a[contains(@href,"/rijal/")]')
            src_links  = parent.xpath('.//a')

            if "الراوي" in label:
                h["rawi"] = _clean_name(parent_text)
                if rij_links:
                    href = rij_links[0].get("href", "")
                    h["rawi_id"] = _extract_rijal_id(href)
                    h["rawi_url"] = DORAR_BASE + href if href.startswith("/") else href
                    h["rijal_links"].append({
                        "name":    _clean_name(rij_links[0].text_content()),
                        "id":      h["rawi_id"],
                        "url":     h["rawi_url"],
                        "role":    "sahabi" if _is_sahabi(h["rawi"]) else "rawi",
                        "fr_name": _transliterate(h["rawi"]),
                    })

            elif "المحدث" in label:
                h["mohaddith"] = _clean_name(parent_text)
                if rij_links:
                    href = rij_links[0].get("href", "")
                    h["mohaddith_id"] = _extract_rijal_id(href)
                    h["mohaddith_url"] = DORAR_BASE + href if href.startswith("/") else href
                    h["rijal_links"].append({
                        "name":    _clean_name(rij_links[0].text_content()),
                        "id":      h["mohaddith_id"],
                        "url":     h["mohaddith_url"],
                        "role":    "mohaddith",
                        "fr_name": _transliterate(h["mohaddith"]),
                    })

            elif "المصدر" in label:
                h["source"] = _clean_name(parent_text)
                if src_links:
                    href = src_links[0].get("href", "")
                    h["source_url"] = DORAR_BASE + href if href.startswith("/") else href

            elif "الصفحة" in label or "الرقم" in label:
                raw_page = parent_text.strip()
                # Extraction Volume / Page / Numéro depuis la chaîne brute
                # Patterns : "3/45" ou "ص45" ou "رقم : 1234" ou "ح 567"
                vol_page_m = re.search(r"(\d+)\s*/\s*(\d+)", raw_page)
                num_m      = re.search(r"(?:رقم|ح|حديث)\s*:?\s*(\d+)", raw_page)
                page_m     = re.search(r"(?:ص|صفحة)\s*:?\s*(\d+)", raw_page)

                if vol_page_m:
                    h["volume"] = f"Vol. {vol_page_m.group(1)}"
                    h["page"]   = f"P. {vol_page_m.group(2)}"
                elif raw_page:
                    h["page"] = raw_page

                if num_m:
                    h["hadith_number"] = f"N° {num_m.group(1)}"
                if page_m and h["page"] == MISSING:
                    h["page"] = f"P. {page_m.group(1)}"

            elif "خلاصة حكم" in label or ("الحكم" in label and "خلاصة" in label):
                h["hukm_raw"] = parent_text.strip()
                hukm = _apply_hukm(parent_text.strip())
                h["hukm"] = hukm
                h["all_verdicts"].append({
                    "mohaddith": h.get("mohaddith", ""),
                    **hukm,
                })

        # ── URL page de détail ──────────────────────────────────────────
        for link in tree.xpath('.//a[contains(@href,"/hadith/")]'):
            href = link.get("href", "")
            if href:
                h["detail_url"] = DORAR_BASE + href if href.startswith("/") else href
                break

        # ── Validation minimale ─────────────────────────────────────────
        if h["ar_text"] or h["rawi"] or h["hukm_raw"]:
            results.append(h)

    log.info(f"Hadiths parsés : {len(results)}")
    return results


# ─────────────────────────────────────────────────────────────────────────────
#  ④ EXTRACTION SILSILA — SCRAPING PROFOND PAGE DE DÉTAIL
# ─────────────────────────────────────────────────────────────────────────────

# Sélecteurs XPath par ordre de précision décroissante
_SANAD_XPATHS: list[str] = [
    './/div[contains(@class,"sanad")]//a[contains(@href,"/rijal/")]',
    './/div[contains(@class,"isnad")]//a[contains(@href,"/rijal/")]',
    './/div[@id="sanad"]//a[contains(@href,"/rijal/")]',
    './/div[@id="isnad"]//a[contains(@href,"/rijal/")]',
    './/section[contains(@class,"sanad")]//a[contains(@href,"/rijal/")]',
    './/p[contains(@class,"sanad")]//a[contains(@href,"/rijal/")]',
    './/span[contains(@class,"sanad")]//a[contains(@href,"/rijal/")]',
    './/div[contains(@class,"hadith-body")]//a[contains(@href,"/rijal/")]',
    # Fallback global hors blocs de navigation
    (
        './/div[not(contains(@class,"navbar")) '
        'and not(contains(@class,"nav-")) '
        'and not(contains(@class,"menu")) '
        'and not(contains(@class,"footer")) '
        'and not(contains(@class,"header"))]'
        '//a[contains(@href,"/rijal/")]'
    ),
]


async def _fetch_silsila_from_detail(
    client: httpx.AsyncClient,
    detail_url: str,
) -> list[dict[str, Any]]:
    """
    Scrape la page de détail Dorar pour extraire la silsila complète.

    Essaie les 9 sélecteurs XPath par ordre de précision.
    Déduplique par ID Dorar puis par nom normalisé.
    Retourne [] si la page est inaccessible ou sans données.
    """
    chain: list[dict[str, Any]] = []
    if not detail_url:
        return chain

    try:
        resp = await client.get(
            detail_url,
            headers={"User-Agent": "Mozilla/5.0 (AlMizan/24.0; Islamic Science Research)"},
            timeout=TIMEOUT_DETAIL,
            follow_redirects=True,
        )
        if resp.status_code != 200:
            log.warning(f"Détail HTTP {resp.status_code} — {detail_url}")
            return chain

        tree = lxml_html.fromstring(resp.text)
        narrator_links: list[Any] = []

        for selector in _SANAD_XPATHS:
            try:
                links = tree.xpath(selector)
                if links:
                    log.info(f"Silsila via XPath ({len(links)} liens) : {selector[:55]}…")
                    narrator_links = links
                    break
            except Exception:
                continue

        if not narrator_links:
            log.warning(f"Aucun lien /rijal/ dans : {detail_url}")
            return chain

        seen_ids:   set[str] = set()
        seen_norms: set[str] = set()

        for link in narrator_links:
            href  = link.get("href", "")
            rid   = _extract_rijal_id(href)
            name  = _clean_isnad_name(link.text_content())

            if not name or len(name) < 2:
                continue

            norm = _normalize_ar(name)
            if rid and rid in seen_ids:
                continue
            if norm in seen_norms:
                continue

            if rid:
                seen_ids.add(rid)
            seen_norms.add(norm)

            _c = _infer_century(name)
            chain.append(SilsilaNode(
                name_ar=name,
                fr_name=_transliterate(name),
                role="sahabi" if _is_sahabi(name) else "narrator",
                rawi_id=rid,
                rawi_url=DORAR_BASE + href if href.startswith("/") else href,
                century=_c,
                death_year=_century_to_death_year(_c),
                verified=True,
            ).model_dump())

        log.info(f"Silsila extraite : {len(chain)} nœuds depuis {detail_url}")

    except httpx.TimeoutException:
        log.warning(f"Timeout scraping détail : {detail_url}")
    except Exception as exc:
        log.warning(f"Erreur scraping silsila : {exc}")

    return chain


# ─────────────────────────────────────────────────────────────────────────────
#  ⑤ RECONSTRUCTION SILSILA — ORDRE PROPHÉTIQUE
# ─────────────────────────────────────────────────────────────────────────────

def _build_silsila(
    hadith: dict[str, Any],
    detail_chain: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """
    Reconstruit la silsila dans l'ordre chronologique :
    Prophète ﷺ → Sahabi → Tâbi'î → … → Muhaddith compilateur.

    Priorité :
      ① detail_chain  : scraping direct de la page Dorar (source la plus fiable)
      ② Inférence     : depuis rawi + mohaddith + générations intermédiaires

    RÈGLE ABSOLUE : Le Prophète ﷺ est TOUJOURS le Nœud 1.
    Les nœuds inférés (non scrappés) sont marqués verified=False.
    """
    chain: list[dict[str, Any]] = []

    # ── Nœud 1 : LE PROPHÈTE ﷺ ─────────────────────────────────────────
    chain.append(SilsilaNode(
        rank=1,
        name_ar="النَّبِيُّ مُحَمَّد ﷺ",
        fr_name="Le Prophète Muhammad ﷺ",
        role="prophet",
        rawi_id=None,
        rawi_url="",
        century="1H",
        death_year=_century_to_death_year("1H"),
        verified=True,
    ).model_dump())

    # ── CAS 1 : chaîne extraite par scraping ───────────────────────────
    if detail_chain and len(detail_chain) >= 1:
        for rank_offset, node in enumerate(detail_chain, start=2):
            _c = node.get("century") or MISSING
            chain.append(SilsilaNode(
                rank=rank_offset,
                name_ar=node.get("name_ar") or MISSING,
                fr_name=node.get("fr_name") or _transliterate(node.get("name_ar", "")),
                role=node.get("role", "narrator"),
                rawi_id=node.get("rawi_id"),
                rawi_url=node.get("rawi_url", ""),
                century=_c,
                death_year=node.get("death_year", _century_to_death_year(_c)),
                verified=True,
            ).model_dump())
        log.info(f"Silsila (scraping) : {len(chain)} nœuds")
        return _dedup_chain(chain)

    # ── CAS 2 : inférence depuis rawi + mohaddith ───────────────────────
    rawi_name  = hadith.get("rawi", "")
    mohadd_name = hadith.get("mohaddith", "")

    if rawi_name:
        rawi_role = "sahabi" if _is_sahabi(rawi_name) else "narrator"
        _rc = "1H" if rawi_role == "sahabi" else "2H"
        chain.append(SilsilaNode(
            rank=2,
            name_ar=rawi_name,
            fr_name=_transliterate(rawi_name),
            role=rawi_role,
            rawi_id=hadith.get("rawi_id"),
            rawi_url=hadith.get("rawi_url", ""),
            century=_rc,
            death_year=_century_to_death_year(_rc),
            verified=True,
        ).model_dump())

        if rawi_role == "sahabi":
            # Tâbi'î toujours présent entre Sahabi et compilateur 3H+
            chain.append(SilsilaNode(
                rank=3,
                name_ar="تَابِعِيّ",
                fr_name="Tâbi'î — Génération des Successeurs (2H)",
                role="tabii",
                rawi_id=None,
                rawi_url="",
                century="2H",
                death_year=_century_to_death_year("2H"),
                verified=False,  # nœud INFÉRÉ
            ).model_dump())

            century_mohadd = _infer_century(mohadd_name)
            if century_mohadd not in ("1H", "2H") or century_mohadd == MISSING:
                chain.append(SilsilaNode(
                    rank=4,
                    name_ar="تَابِعُ التَّابِعِيّ",
                    fr_name="Tâbi' al-Tâbi'în — 2ème génération des Successeurs (3H)",
                    role="ttt",
                    rawi_id=None,
                    rawi_url="",
                    century="3H",
                    death_year=_century_to_death_year("3H"),
                    verified=False,  # nœud INFÉRÉ
                ).model_dump())

    if mohadd_name:
        _mc = _infer_century(mohadd_name)
        chain.append(SilsilaNode(
            rank=len(chain) + 1,
            name_ar=mohadd_name,
            fr_name=_transliterate(mohadd_name),
            role="muhaddith",
            rawi_id=hadith.get("mohaddith_id"),
            rawi_url=hadith.get("mohaddith_url", ""),
            century=_mc,
            death_year=_century_to_death_year(_mc),
            verified=True,
        ).model_dump())

    log.info(f"Silsila (inférée) : {len(chain)} nœuds")
    return _dedup_chain(chain)


def _dedup_chain(chain: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Déduplique les nœuds et renuméroter les rangs proprement."""
    seen:   set[str] = set()
    result: list[dict[str, Any]] = []

    for node in chain:
        key = _normalize_ar(node.get("name_ar", ""))
        role_key = f"__role__{node.get('role', '')}_{node.get('century', '')}"
        eff_key  = key if key else role_key

        if eff_key not in seen:
            seen.add(eff_key)
            result.append(node)

    for i, node in enumerate(result, start=1):
        node["rank"] = i

    return result


def _silsila_is_valid(chain: list[dict[str, Any]]) -> bool:
    """Valide si la silsila contient au moins 2 nœuds vérifiés."""
    return len(chain) >= 2 and sum(1 for n in chain if n.get("verified")) >= 2


def _derive_shurut_sihhah_from_silsila(
    silsila: list[dict[str, Any]],
    jarh_grouped: dict[str, dict[str, Any]],
    hukm_level: str,
    hukm_raw: str,
) -> str:
    """
    Déduit l'état des 5 conditions classiques du Sahîh (Ibn as-Salah,
    Muqaddima) UNIQUEMENT à partir des données déjà scrapées par Dorar
    et du dictionnaire Hukm verrouillé.

    Les 5 conditions canoniques :
      1. Ittisâl as-Sanad    — Continuité ininterrompue de la chaîne
      2. 'Adâlat ar-Ruwât    — Intégrité morale des rapporteurs
      3. Dabt ar-Ruwât       — Précision mémorielle des rapporteurs
      4. 'Adam ash-Shudhûdh  — Absence d'anomalie (contradiction de sens)
      5. 'Adam al-'Illah     — Absence de défaut caché

    PROTOCOLE ZÉRO HALLUCINATION :
      • Aucun appel IA, aucune supposition.
      • Si Dorar ne fournit aucun indicateur → « NON INDIQUÉE PAR LA SOURCE ».
      • « ÉTABLIE » seulement si la preuve est directe (hukm sahih/hasan
        + absence de marqueur négatif).
      • « ABSENTE » seulement si Dorar mentionne explicitement le défaut.

    Retourne un bloc markdown consommable par _mzMd côté frontend.
    """
    raw = hukm_raw or ""

    # ── Condition 1 : Ittisâl as-Sanad (continuité) ───────────────────
    n_verified = sum(1 for n in silsila if n.get("verified"))
    if n_verified >= 3:
        c1_state = "ÉTABLIE"
        c1_note  = f"silsila scrapée ({n_verified} nœuds vérifiés)"
    elif n_verified >= 2:
        c1_state = "PARTIELLE"
        c1_note  = f"chaîne minimale ({n_verified} nœuds vérifiés)"
    else:
        c1_state = "NON INDIQUÉE PAR LA SOURCE"
        c1_note  = "silsila insuffisante dans Dorar"

    # ── Condition 2 : 'Adâlat ar-Ruwât (intégrité morale) ─────────────
    jarh_neg_re = re.compile(
        r"كذاب|متروك|وضاع|متهم|kadhdhab|matruk|wadd|muttaham",
        re.IGNORECASE,
    )
    if jarh_neg_re.search(raw):
        c2_state = "ABSENTE"
        c2_note  = "rapporteur désigné menteur/abandonné dans hukm_raw"
    elif hukm_level in ("sahih", "hasan"):
        c2_state = "ÉTABLIE"
        c2_note  = "hukm global sahih/hasan — rapporteurs réputés intègres"
    else:
        c2_state = "NON INDIQUÉE PAR LA SOURCE"
        c2_note  = "intégrité non attestée explicitement par Dorar"

    # ── Condition 3 : Dabt ar-Ruwât (précision mémorielle) ────────────
    dabt_neg_re = re.compile(
        r"ضعيف|سيء\s*الحفظ|مختلط|لين|layyin|da'?if|sayyi'|mukhtalit",
        re.IGNORECASE,
    )
    if dabt_neg_re.search(raw):
        c3_state = "ABSENTE"
        c3_note  = "précision mémorielle explicitement contestée"
    elif hukm_level in ("sahih", "hasan"):
        c3_state = "ÉTABLIE"
        c3_note  = "hukm global sahih/hasan — précision reconnue"
    else:
        c3_state = "NON INDIQUÉE PAR LA SOURCE"
        c3_note  = "précision non attestée explicitement par Dorar"

    # ── Condition 4 : 'Adam ash-Shudhûdh (absence d'anomalie) ─────────
    if re.search(r"شاذ|منكر|shadh|munkar", raw, re.IGNORECASE):
        c4_state = "ABSENTE"
        c4_note  = "hadith marqué shâdh ou munkar"
    else:
        c4_state = "NON INDIQUÉE PAR LA SOURCE"
        c4_note  = "Dorar n'indique ni shudhûdh ni son absence"

    # ── Condition 5 : 'Adam al-'Illah (absence de défaut caché) ───────
    if re.search(r"معلول|معل\b|ma'?lul|mu'?allal", raw, re.IGNORECASE):
        c5_state = "ABSENTE"
        c5_note  = "hadith marqué mu'allal"
    else:
        c5_state = "NON INDIQUÉE PAR LA SOURCE"
        c5_note  = "Dorar n'indique aucune 'illah"

    return (
        f"**1. Ittisâl as-Sanad** (Continuité) : {c1_state} — {c1_note}\n\n"
        f"**2. 'Adâlat ar-Ruwât** (Intégrité) : {c2_state} — {c2_note}\n\n"
        f"**3. Dabt ar-Ruwât** (Précision) : {c3_state} — {c3_note}\n\n"
        f"**4. 'Adam ash-Shudhûdh** (Absence d'anomalie) : {c4_state} — {c4_note}\n\n"
        f"**5. 'Adam al-'Illah** (Absence de défaut caché) : {c5_state} — {c5_note}"
    )


# ─────────────────────────────────────────────────────────────────────────────
#  ⑥ TRADUCTION FR→AR VIA CLAUDE HAIKU
# ─────────────────────────────────────────────────────────────────────────────

async def _translate_query_fr_to_ar(
    client: httpx.AsyncClient,
    query_fr: str,
    api_key: str,
) -> str:
    """Traduit la requête de recherche française en arabe classique."""
    if not api_key:
        log.warning("ANTHROPIC_API_KEY manquante — traduction ignorée")
        return query_fr

    prompt = (
        "Tu es un traducteur spécialisé en arabe classique (fusha) pour la "
        "recherche de hadiths dans la base de données Dorar.net. "
        "Traduis UNIQUEMENT la requête ci-dessous en mots arabes adaptés à une "
        "recherche hadith. "
        "Retourne UNIQUEMENT les mots arabes, sans explication ni ponctuation.\n\n"
        f"Requête : {query_fr}"
    )

    try:
        resp = await client.post(
            ANTHROPIC_URL,
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": ANTHROPIC_MODEL,
                "max_tokens": 150,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=TIMEOUT_CLAUDE,
        )
        if resp.status_code == 200:
            translated = (
                resp.json().get("content", [{}])[0].get("text", "").strip()
            )
            log.info(f"Traduction : «{query_fr}» → «{translated}»")
            return translated or query_fr
    except Exception as exc:
        log.warning(f"Erreur traduction : {exc}")

    return query_fr


async def _translate_matn_ar_to_fr(
    client: httpx.AsyncClient,
    ar_text: str,
    api_key: str,
    hukm_fr: str,
) -> str:
    """
    Traduit le matn arabe en français académique.
    Le glossaire protégé est injecté dans le prompt pour
    préserver les termes de 'Aqîdah intacts.
    """
    if not api_key or not ar_text:
        return MISSING

    glossaire_protege = (
        "TERMES PROTÉGÉS — À conserver tels quels avec translittération :\n"
        "• استوى على العرش → 'S'est établi sur le Trône' (Istawâ 'alâ al-'Arsh)\n"
        "• نزول / ينزل → 'Descente / Il descend' (An-Nuzûl / Yanzil)\n"
        "• يد الله → 'La Main d'Allah' (Yad Allâh)\n"
        "• وجه الله → 'Le Visage d'Allah' (Wajh Allâh)\n"
        "• ساق → 'Le Tibia' (As-Sâq)\n"
        "• صراط → 'Le Pont' (As-Sirât)\n"
        "• جنة → 'Le Paradis' (Al-Janna)\n"
        "• نار → 'L'Enfer' (An-Nâr)\n"
        "• شفاعة → 'L'Intercession' (Ash-Shafâ'a)\n"
    )

    prompt = (
        "Tu es un traducteur islamique académique spécialisé dans la science du hadith. "
        "Traduis ce hadith arabe en français classique et rigoureux. "
        "RÈGLES ABSOLUES :\n"
        "1. Ne modifie JAMAIS le sens théologique du texte.\n"
        "2. Place les termes arabes importants entre parenthèses après leur traduction.\n"
        "3. N'utilise JAMAIS 'pouvoir', 'autorité' ou 'présence' pour les Attributs d'Allah.\n"
        f"{glossaire_protege}\n"
        f"Grade de ce hadith selon les muhaddithîn : {hukm_fr}\n\n"
        f"Texte arabe :\n{ar_text}\n\n"
        "Traduction française :"
    )

    try:
        resp = await client.post(
            ANTHROPIC_URL,
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": ANTHROPIC_MODEL,
                "max_tokens": 600,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=TIMEOUT_CLAUDE,
        )
        if resp.status_code == 200:
            result = (
                resp.json().get("content", [{}])[0].get("text", "").strip()
            )
            return result or MISSING
    except Exception as exc:
        log.warning(f"Erreur traduction matn : {exc}")

    return MISSING


async def _enrich_via_claude(
    client: httpx.AsyncClient,
    ar_text: str,
    hukm_fr: str,
    savant: str,
    source: str,
    api_key: str,
) -> dict[str, str]:
    """
    Enrichissement textuel d'un hadith via Claude Haiku 4.5 SOUS CONTRAINTE
    « Zéro Hallucination » — Protocole Amâna Médine (Action 2).

    Champs demandés :
      • gharib       → vocabulaire des mots rares du matn
      • sabab_wurud  → circonstance de narration SI attestée (très rare)
      • fawaid       → leçons pratiques concrètes

    Garanties anti-hallucination :
      1. temperature = 0.0 (déterminisme maximal)
      2. Prompt explicite : « vide par défaut, remplit seulement si cité »
      3. Extraction JSON stricte, fallback {} si parse échoue
      4. Toute exception → retour silencieux {"": "", "": "", "": ""}
         (Option Silencieuse validée Q3)
      5. Aucune clé ne peut être None — toujours str (compatible Pydantic)

    Retourne un dict à 3 clés str ; les valeurs peuvent être vides.
    """
    blank = {"gharib": "", "sabab_wurud": "", "fawaid": ""}

    if not api_key or not ar_text:
        return blank

    prompt = (
        "Tu es un savant du hadith travaillant pour Mîzân as-Sunnah, "
        "projet de science du hadith présenté à Médine.\n\n"
        "╔══════════════════════════════════════════════════════════════════╗\n"
        "║   PROTOCOLE AMÂNA — VERROU ABSOLU ZÉRO HALLUCINATION            ║\n"
        "╠══════════════════════════════════════════════════════════════════╣\n"
        "║  SOURCES AUTORISÉES — DEUX OUVRAGES UNIQUEMENT :                ║\n"
        "║    ① Fath al-Bârî  (ابن حجر العسقلاني)                         ║\n"
        "║    ② An-Nihâyah fî Gharîb al-Hadîth  (ابن الأثير)              ║\n"
        "║  RÈGLES ABSOLUES :                                               ║\n"
        "║  • Remplir un champ UNIQUEMENT si l'information est explicitement║\n"
        "║    attestée dans l'un de ces deux ouvrages.                      ║\n"
        "║  • Dans le DOUTE : chaîne vide \"\" — TOUJOURS.                  ║\n"
        "║  • NE JAMAIS deviner, extrapoler ou reformuler un champ.         ║\n"
        "║  • Mots interdits : « probablement », « sans doute »,           ║\n"
        "║    « peut-être », « il semble », « on peut dire ».              ║\n"
        "║  • Aucun texte hors du JSON (pas de markdown, pas de commentaire)║\n"
        "║  • Chaque valeur absente ou incertaine = chaîne vide \"\"         ║\n"
        "╚══════════════════════════════════════════════════════════════════╝\n\n"
        f"Hadith arabe :\n{ar_text}\n\n"
        f"Grade selon les muhaddithîn : {hukm_fr or 'non spécifié'}\n"
        f"Rapporté par : {savant or 'non spécifié'}\n"
        f"Source : {source or 'non spécifiée'}\n\n"
        "Retourne EXACTEMENT ce JSON (rien avant, rien après) :\n"
        '{\n'
        '  "gharib": "Explication des mots rares selon An-Nihâyah d\'Ibn al-Athîr — 1 à 3 mots MAX, format «mot : explication» séparés par «;». Chaîne vide \"\" si aucun mot rare ou si An-Nihâyah ne le mentionne pas.",\n'
        '  "sabab_wurud": "Circonstance de narration UNIQUEMENT si Ibn Hajar la cite dans Fath al-Bârî. Chaîne vide \"\" sinon — ce champ est \"\" dans 95% des cas.",\n'
        '  "fawaid": "1 à 3 leçons pratiques issues de Fath al-Bârî, format puces «• leçon». Chaîne vide \"\" si Fath al-Bârî n\'en mentionne pas pour ce hadith."\n'
        '}'
    )

    try:
        resp = await client.post(
            ANTHROPIC_URL,
            headers={
                "x-api-key":         api_key,
                "anthropic-version": "2023-06-01",
                "content-type":      "application/json",
            },
            json={
                "model":       ANTHROPIC_MODEL,
                "max_tokens":  600,
                "temperature": 0.0,  # Verrou déterministe
                "messages":    [{"role": "user", "content": prompt}],
            },
            timeout=TIMEOUT_CLAUDE,
        )
    except Exception as exc:
        log.warning(f"Erreur enrich Claude (réseau) : {exc}")
        return blank

    if resp.status_code != 200:
        log.warning(f"Erreur enrich Claude HTTP {resp.status_code}")
        return blank

    try:
        raw = (
            resp.json().get("content", [{}])[0].get("text", "") or ""
        ).strip()
    except Exception as exc:
        log.warning(f"Erreur enrich Claude (parse body) : {exc}")
        return blank

    # Extraction JSON robuste : Claude peut entourer de ```json … ```
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        log.warning("Enrich Claude : aucun objet JSON trouvé dans la réponse")
        return blank

    try:
        data = json.loads(match.group(0))
    except Exception as exc:
        log.warning(f"Erreur enrich Claude (json.loads) : {exc}")
        return blank

    if not isinstance(data, dict):
        return blank

    # Normalisation stricte : toutes les valeurs deviennent des str
    return {
        "gharib":      (data.get("gharib")      or "").strip() if isinstance(data.get("gharib"),      str) else "",
        "sabab_wurud": (data.get("sabab_wurud") or "").strip() if isinstance(data.get("sabab_wurud"), str) else "",
        "fawaid":      (data.get("fawaid")      or "").strip() if isinstance(data.get("fawaid"),      str) else "",
    }


# ─────────────────────────────────────────────────────────────────────────────
#  ⑦ CONSTRUCTION DU TAKHRÎJ (RÉFÉRENCE PHYSIQUE COMPLÈTE)
# ─────────────────────────────────────────────────────────────────────────────

def _build_takhrij(hadith: dict[str, Any]) -> dict[str, str]:
    """
    Construit la référence Takhrîj complète.
    Un savant doit pouvoir ouvrir le livre physique grâce à ces données.

    Champs retournés :
      source         → Nom du recueil en arabe
      source_url     → Lien Dorar vers le recueil
      volume         → Volume (ex: "Vol. 3") ou MISSING
      page           → Page (ex: "P. 45") ou MISSING
      hadith_number  → Numéro (ex: "N° 1234") ou MISSING
      full_ref       → Référence complète textuelle assemblée
      detail_url     → Lien vers la page de détail Dorar
    """
    source        = hadith.get("source", "") or MISSING
    source_url    = hadith.get("source_url", "") or ""
    volume        = hadith.get("volume", MISSING) or MISSING
    page          = hadith.get("page", MISSING) or MISSING
    hadith_number = hadith.get("hadith_number", MISSING) or MISSING
    detail_url    = hadith.get("detail_url", "") or ""

    parts: list[str] = []
    if source != MISSING:
        parts.append(source)
    if volume != MISSING:
        parts.append(volume)
    if page != MISSING:
        parts.append(page)
    if hadith_number != MISSING:
        parts.append(hadith_number)

    return {
        "source":        source,
        "source_url":    source_url,
        "volume":        volume,
        "page":          page,
        "hadith_number": hadith_number,
        "full_ref":      " — ".join(parts) if parts else MISSING,
        "detail_url":    detail_url,
    }


# ─────────────────────────────────────────────────────────────────────────────
#  ⑧ MOTEUR PRINCIPAL — PIPELINE TAKHRÎJ
# ─────────────────────────────────────────────────────────────────────────────

async def _run_takhrij(query: str) -> dict[str, Any]:
    """
    Pipeline complet du Takhrîj v24.0.

    Ordre d'exécution :
      INIT       → Validation requête
      TRADUCTION → FR→AR via Claude Haiku si requête non arabe
      DORAR      → Appel API officielle Dorar.net
      PARSING    → lxml XPath sur HTML brut
      SANAD      → Scraping page de détail (silsila complète)
      HUKM       → Application dictionnaire verrouillé + groupement
      TRADUCTION → Matn AR→FR via Claude Haiku
      ENVOI      → Résultat JSON structuré complet
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")

    async with httpx.AsyncClient(
        timeout=httpx.Timeout(30.0, connect=6.0),
        headers={"User-Agent": "Mozilla/5.0 (AlMizan/24.0; Hadith Science)"},
        follow_redirects=True,
    ) as client:

        query_original = query.strip()
        query_ar = query_original

        # ── TRADUCTION FR→AR ──────────────────────────────────────────────
        if not _is_arabic(query_ar):
            query_ar = await _translate_query_fr_to_ar(client, query_ar, api_key)

        if not query_ar:
            return _error("Requête vide après normalisation")

        log.info(f"Recherche Dorar : «{query_ar}»")

        # ── APPEL API DORAR ───────────────────────────────────────────────
        try:
            resp = await client.get(
                DORAR_API_URL,
                params={"skey": query_ar, "type": "1"},
                timeout=TIMEOUT_DORAR,
            )
        except httpx.TimeoutException:
            return _error("Dorar.net : délai dépassé — réessayez dans quelques instants")
        except httpx.ConnectError as e:
            return _error(f"Connexion Dorar.net impossible : {e}")
        except Exception as e:
            return _error(f"Erreur réseau : {e}")

        if resp.status_code != 200:
            return _error(f"Dorar.net a retourné HTTP {resp.status_code}")

        # ── PARSING JSON ──────────────────────────────────────────────────
        try:
            dorar_data = resp.json()
        except Exception:
            return _error("Réponse Dorar non-JSON — structure inattendue")

        raw_html = dorar_data.get("ahadith", {}).get("result", "")
        if not raw_html or not raw_html.strip():
            return {
                "status":     "not_found",
                "message":    "Aucun hadith trouvé dans la base Dorar pour cette requête.",
                "query_ar":   query_ar,
                "query_orig": query_original,
                "results":    [],
                "total":      0,
                "version":    VERSION,
            }

        # ── PARSING HTML ──────────────────────────────────────────────────
        hadiths_bruts = _parse_dorar_html(raw_html)
        if not hadiths_bruts:
            return _error("Aucun hadith extrait — structure HTML Dorar inattendue")

        # ── DÉDUPLICATION PAR AUTORITÉ (anti-dégradation Sahîhayn) ───────
        hadiths_bruts = _dedupe_hadiths_by_authority(hadiths_bruts)

        # ── ENRICHISSEMENT DE CHAQUE HADITH ──────────────────────────────
        results: list[dict[str, Any]] = []

        for hadith in hadiths_bruts[:MAX_RESULTS]:

            # Silsila (scraping page de détail en priorité)
            detail_chain: list[dict[str, Any]] = []
            if hadith.get("detail_url"):
                detail_chain = await _fetch_silsila_from_detail(
                    client, hadith["detail_url"]
                )

            silsila = _build_silsila(hadith, detail_chain or None)
            hukm    = hadith.get("hukm") or _apply_hukm(hadith.get("hukm_raw", ""))
            # RÈGLE DE FER : score 100 (Bukhârî/Muslim) → Sahîh forcé
            hukm    = _apply_authority_override(hadith, hukm)
            grouped = _group_verdicts_by_mohaddith(hadith.get("all_verdicts", []))
            takhrij = _build_takhrij(hadith)

            # ── Zones déterministes (zéro IA, lecture seule Dorar) ──
            grille_albani_txt = _extract_albani_from_verdicts(
                hadith.get("all_verdicts", [])
            )
            shurut_sihhah_txt = _derive_shurut_sihhah_from_silsila(
                silsila,
                grouped,
                hukm.get("level", "unknown"),
                hadith.get("hukm_raw", ""),
            )

            # ── Traduction matn + enrichissement Claude EN PARALLÈLE ──
            matn_fr, enrich = await asyncio.gather(
                _translate_matn_ar_to_fr(
                    client,
                    hadith.get("ar_text", ""),
                    api_key,
                    hukm.get("fr", ""),
                ),
                _enrich_via_claude(
                    client,
                    hadith.get("ar_text", ""),
                    hukm.get("fr", ""),
                    hadith.get("mohaddith", ""),
                    hadith.get("source", ""),
                    api_key,
                ),
            )

            results.append({
                # ── Clé 1 : Matn ─────────────────────────────────────────
                "matn": {
                    "ar": hadith.get("ar_text", "") or MISSING,
                    "fr": matn_fr,
                },
                # ── Clé 2 : Silsila / Isnad ──────────────────────────────
                "silsila": {
                    "nodes":        silsila,
                    "total":        len(silsila),
                    "is_valid":     _silsila_is_valid(silsila),
                    "has_inferred": any(not n.get("verified") for n in silsila),
                    "source":       "dorar_detail" if detail_chain else "inference",
                },
                # ── Clé 3 : Hukm / Verdict ───────────────────────────────
                "hukm": {
                    "ar":           hukm.get("ar", MISSING),
                    "fr":           hukm.get("fr", MISSING),
                    "level":        hukm.get("level", "unknown"),
                    "color":        hukm.get("color", "#6b7280"),
                    "definition":   hukm.get("definition", MISSING),
                    "raw":          hukm.get("raw", "") or "",
                    "by_mohaddith": grouped,
                },
                # ── Clé 4 : Takhrîj ──────────────────────────────────────
                "takhrij": takhrij,
                # ── Clé 5 : Enrichissement (Amâna — "" si absent) ────────
                "enrichment": {
                    "grille_albani":    grille_albani_txt    or "",
                    "sanad_conditions": shurut_sihhah_txt    or "",
                    "gharib":           enrich.get("gharib",      ""),
                    "sabab_wurud":      enrich.get("sabab_wurud", ""),
                    "fawaid":           enrich.get("fawaid",      ""),
                },
                # ── Clé 6 : Métadonnées sources ───────────────────────────
                "metadata": {
                    "rawi": {
                        "ar":      hadith.get("rawi", "") or MISSING,
                        "fr":      _transliterate(hadith.get("rawi", "")) or MISSING,
                        "id":      hadith.get("rawi_id") or MISSING,
                        "url":     hadith.get("rawi_url", "") or "",
                        "role":    "sahabi" if _is_sahabi(hadith.get("rawi", "")) else "narrator",
                    },
                    "mohaddith": {
                        "ar":      hadith.get("mohaddith", "") or MISSING,
                        "fr":      _transliterate(hadith.get("mohaddith", "")) or MISSING,
                        "id":      hadith.get("mohaddith_id") or MISSING,
                        "url":     hadith.get("mohaddith_url", "") or "",
                        "century": _infer_century(hadith.get("mohaddith", "")),
                    },
                    "source": {
                        "ar":  hadith.get("source", "") or MISSING,
                        "url": hadith.get("source_url", "") or "",
                    },
                    # ── Barème de Fer : score d'autorité (miroir backend) ─
                    "authority_score": hadith.get("_authority_score", 0),
                },
            })

        return {
            "status":     "success",
            "query_ar":   query_ar,
            "query_orig": query_original,
            "results":    results,
            "total":      len(results),
            "version":    VERSION,
        }


def _error(msg: str, query_ar: str = "", query_orig: str = "") -> dict[str, Any]:
    """Construit une réponse d'erreur standardisée — 6 clés conteneur garanties."""
    log.error(f"[Mîzân v24] {msg}")
    return {
        "status":     "error",
        "message":    msg,
        "query_ar":   query_ar,
        "query_orig": query_orig,
        "results":    [],
        "total":      0,
        "version":    VERSION,
    }


# ─────────────────────────────────────────────────────────────────────────────
#  ⑨ GÉNÉRATEUR SSE — FLUX TEMPS RÉEL
#  Ordre des événements : INITIALISATION → TRADUCTION → DORAR →
#                         SANAD → HUKM → ENVOI
# ─────────────────────────────────────────────────────────────────────────────

def _sse(event: str, data: Any) -> str:
    """Formate un événement SSE."""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


async def _stream_takhrij(query: str) -> AsyncGenerator[str, None]:
    """Générateur SSE : pipeline complet avec signalement de chaque étape."""

    yield _sse("status", {"step": "INITIALISATION", "message": "Ouverture des registres"})
    await asyncio.sleep(0)

    api_key        = os.environ.get("ANTHROPIC_API_KEY", "")
    query_original = query.strip()
    query_ar       = query_original

    async with httpx.AsyncClient(
        timeout=httpx.Timeout(30.0, connect=6.0),
        headers={"User-Agent": "Mozilla/5.0 (AlMizan/24.0)"},
        follow_redirects=True,
    ) as client:

        # TRADUCTION ───────────────────────────────────────────────────────
        if not _is_arabic(query_ar):
            yield _sse("status", {
                "step":    "TRADUCTION",
                "message": f"Traduction de «{query_ar}» en arabe classique",
            })
            query_ar = await _translate_query_fr_to_ar(client, query_ar, api_key)

        # DORAR ────────────────────────────────────────────────────────────
        yield _sse("status", {
            "step":    "DORAR",
            "message": f"Recherche Dorar.net : {query_ar}",
        })

        try:
            resp = await client.get(
                DORAR_API_URL,
                params={"skey": query_ar, "type": "1"},
                timeout=TIMEOUT_DORAR,
            )
        except Exception as exc:
            yield _sse("error", {"message": f"Erreur Dorar : {exc}"})
            yield _sse("done", [])
            return

        if resp.status_code != 200:
            yield _sse("error", {"message": f"Dorar HTTP {resp.status_code}"})
            yield _sse("done", [])
            return

        try:
            dorar_data = resp.json()
        except Exception:
            yield _sse("error", {"message": "Réponse Dorar non-JSON"})
            yield _sse("done", [])
            return

        raw_html = dorar_data.get("ahadith", {}).get("result", "")
        if not raw_html:
            yield _sse("done", [])
            return

        hadiths_bruts = _parse_dorar_html(raw_html)
        if not hadiths_bruts:
            yield _sse("done", [])
            return

        # ── DÉDUPLICATION PAR AUTORITÉ (anti-dégradation Sahîhayn) ───────
        hadiths_bruts = _dedupe_hadiths_by_authority(hadiths_bruts)

        # Envoi immédiat des données brutes pour affichage instantané
        yield _sse("dorar", [
            {
                "arabic_text": h.get("ar_text", ""),
                "savant":      h.get("mohaddith", ""),
                "source":      h.get("source", ""),
                "grade":       h.get("hukm_raw", ""),
                "rawi":        h.get("rawi", ""),
            }
            for h in hadiths_bruts[:MAX_RESULTS]
        ])

        # SANAD + HUKM + ENRICHISSEMENT ────────────────────────────────────
        for idx, hadith in enumerate(hadiths_bruts[:MAX_RESULTS]):

            yield _sse("status", {
                "step":    "SANAD",
                "message": (
                    f"Extraction silsila hadith {idx + 1}/"
                    f"{min(len(hadiths_bruts), MAX_RESULTS)}"
                ),
            })

            detail_chain: list[dict[str, Any]] = []
            if hadith.get("detail_url"):
                detail_chain = await _fetch_silsila_from_detail(
                    client, hadith["detail_url"]
                )

            silsila = _build_silsila(hadith, detail_chain or None)

            yield _sse("status", {
                "step":    "HUKM",
                "message": f"Application du dictionnaire Hukm — hadith {idx + 1}",
            })

            hukm    = hadith.get("hukm") or _apply_hukm(hadith.get("hukm_raw", ""))
            # RÈGLE DE FER : score 100 (Bukhârî/Muslim) → Sahîh forcé
            hukm    = _apply_authority_override(hadith, hukm)
            grouped = _group_verdicts_by_mohaddith(hadith.get("all_verdicts", []))
            takhrij = _build_takhrij(hadith)

            # ── Zones déterministes (zéro IA, lecture seule Dorar) ──
            grille_albani_txt = _extract_albani_from_verdicts(
                hadith.get("all_verdicts", [])
            )
            shurut_sihhah_txt = _derive_shurut_sihhah_from_silsila(
                silsila,
                grouped,
                hukm.get("level", "unknown"),
                hadith.get("hukm_raw", ""),
            )

            # ── Traduction matn + enrichissement Claude EN PARALLÈLE ──
            #    Option Silencieuse : toute erreur → chaînes vides, pas de
            #    propagation au frontend, pas de badge UI.
            matn_fr, enrich = await asyncio.gather(
                _translate_matn_ar_to_fr(
                    client,
                    hadith.get("ar_text", ""),
                    api_key,
                    hukm.get("fr", ""),
                ),
                _enrich_via_claude(
                    client,
                    hadith.get("ar_text", ""),
                    hukm.get("fr", ""),
                    hadith.get("mohaddith", ""),
                    hadith.get("source", ""),
                    api_key,
                ),
            )

            yield _sse("hadith", {
                "index": idx,
                "data": {
                    # ── Zone 1 : Matn ───────────────────────────────────
                    "arabic_text":    hadith.get("ar_text", "") or MISSING,
                    "french_text":    matn_fr,
                    # ── Zone 2 : Métadonnées sources ────────────────────
                    "savant":         hadith.get("mohaddith", "") or MISSING,
                    "source":         hadith.get("source", "") or MISSING,
                    "rawi":           hadith.get("rawi", "") or MISSING,
                    # ── Zone 3 : Hukm / Verdict ─────────────────────────
                    "grade_ar":       hukm.get("ar", MISSING),
                    "grade_fr":       hukm.get("fr", MISSING),
                    "grade_level":    hukm.get("level", "unknown"),
                    "grade_color":    hukm.get("color", "#6b7280"),
                    "grade_def":      hukm.get("definition", MISSING),
                    "grade_by_mohadd": grouped,
                    # ── Zone 4 : Silsila / Isnad ─────────────────────────
                    "silsila":        silsila,
                    "silsila_nodes":  len(silsila),
                    "silsila_valid":  _silsila_is_valid(silsila),
                    # ── Zone 5 : Takhrîj ─────────────────────────────────
                    "takhrij":        takhrij,
                    # ── Zone 6 : Score d'autorité (Barème de Fer) ────────
                    "_authority_score": hadith.get("_authority_score", 0),
                    # ── Zones 7-12 : Enrichissement (Amâna — "" si absent) ─
                    "grille_albani":    grille_albani_txt    or "",
                    "sanad_conditions": shurut_sihhah_txt    or "",
                    "gharib":           enrich.get("gharib",      ""),
                    "sabab_wurud":      enrich.get("sabab_wurud", ""),
                    "fawaid":           enrich.get("fawaid",      ""),
                },
            })

        yield _sse("status", {
            "step": "HUKM", "message": "Pipeline terminé — résultats prêts"
        })
        yield _sse("done", {"total": min(len(hadiths_bruts), MAX_RESULTS)})


# ─────────────────────────────────────────────────────────────────────────────
#  ⑩ HANDLER VERCEL — BaseHTTPRequestHandler
# ─────────────────────────────────────────────────────────────────────────────

class handler(BaseHTTPRequestHandler):
    """
    Handler HTTP Vercel — Mîzân as-Sunnah v24.0.

    Routes :
      GET  /api/health        → Statut + statistiques du lexique
      GET  /api/search?q=...  → Flux SSE temps réel (Accept: text/event-stream)
                                ou JSON classique (fallback)
      POST /api/              → Takhrîj complet JSON {"query": "..."}
      OPTIONS *               → CORS preflight (204)
    """

    _CORS: dict[str, str] = {
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
        "Access-Control-Max-Age":       "86400",
    }

    def _json(self, data: dict[str, Any], status: int = 200) -> None:
        body = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        for k, v in self._CORS.items():
            self.send_header(k, v)
        self.send_header("Content-Type",    "application/json; charset=utf-8")
        self.send_header("Content-Length",  str(len(body)))
        self.send_header("X-Mizan-Version", VERSION)
        self.end_headers()
        self.wfile.write(body)

    def _sse_headers(self) -> None:
        self.send_response(200)
        for k, v in self._CORS.items():
            self.send_header(k, v)
        self.send_header("Content-Type",      "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control",     "no-cache")
        self.send_header("X-Accel-Buffering", "no")
        self.send_header("X-Mizan-Version",   VERSION)
        self.end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        for k, v in self._CORS.items():
            self.send_header(k, v)
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path   = parsed.path.rstrip("/")
        params = parse_qs(parsed.query)

        # ── Health check ─────────────────────────────────────────────────
        if path.endswith("health"):
            self._json({
                "status":       "ok",
                "version":      VERSION,
                "service":      "Mîzân as-Sunnah — Moteur de Takhrîj",
                "hukm_grades":  len(_HUKM_AR_FR),
                "translitt_db": len(_TRANSLITT),
                "sahabas_db":   len(_SAHABAS),
                "xpath_selectors": len(_SANAD_XPATHS),
                "pipeline":     [
                    "INITIALISATION", "TRADUCTION",
                    "DORAR", "SANAD", "HUKM", "ENVOI",
                ],
            })
            return

        # ── Recherche SSE ou JSON ─────────────────────────────────────────
        if path.endswith("search") and params.get("q"):
            query = params["q"][0].strip()
            if not query:
                self._json({"error": "Paramètre q vide"}, status=400)
                return

            accept = self.headers.get("Accept", "")

            if "text/event-stream" in accept:
                self._sse_headers()

                async def _run_sse() -> None:
                    async for chunk in _stream_takhrij(query):
                        try:
                            self.wfile.write(chunk.encode("utf-8"))
                            self.wfile.flush()
                        except BrokenPipeError:
                            break

                try:
                    asyncio.run(_run_sse())
                except Exception as exc:
                    log.exception(f"Erreur SSE : {exc}")
            else:
                try:
                    result = asyncio.run(_run_takhrij(query))
                    self._json(result)
                except Exception as exc:
                    log.exception("Erreur pipeline GET JSON")
                    self._json(_error(f"Erreur interne : {exc}"), status=500)
            return

        self._json({"error": "Route inconnue", "version": VERSION}, status=404)

    def log_message(self, fmt: str, *args: Any) -> None:
        log.info(fmt % args)
