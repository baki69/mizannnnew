"""
api/index.py - MIZAN v22.9
Traduction hybride : Google Translate async (httpx) + Glossaire islamique légifèré
Verdicts Hadith protégés, scraping blindé, flux SSE complet avec debug et french_text
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import unicodedata
from typing import Any, AsyncGenerator

import httpx
from anthropic import AsyncAnthropic
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from lxml import html as lx

log = logging.getLogger("mizan.rawi")
logging.basicConfig(level=logging.INFO)

# =====================================================================
# CONSTANTES RÉSEAU
# =====================================================================

_BASE     = "https://dorar.net"
_RIJAL    = f"{_BASE}/rijal"
_SEARCH_R = f"{_RIJAL}/search"
_HADITH_S = f"{_BASE}/hadith/search"

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept":          "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ar,fr;q=0.9,en;q=0.8",
    "Referer":         _BASE,
}

_TIMEOUT    = httpx.Timeout(25.0, connect=10.0)
_GT_TIMEOUT = httpx.Timeout(8.0,  connect=5.0)
_MAX_RETRY  = 3

CORS_HEADERS: dict[str, str] = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, Content-Type, Cache-Control",
}

# =====================================================================
# GLOSSAIRES ISLAMIQUES LÉGIFÈRÉS
# =====================================================================

_HUKM_AR_FR: dict[str, str] = {
    "صحيح":                  "Authentique (Sahîh)",
    "صحيح لغيره":            "Authentique par ses témoins (Sahîh li-ghayrih)",
    "حسن":                   "Bon (Hasan)",
    "حسن لغيره":             "Bon par ses témoins (Hasan li-ghayrih)",
    "حسن صحيح":              "Bon et Authentique (Hasan Sahîh)",
    "ضعيف":                  "Faible (Da'îf)",
    "ضعيف جداً":             "Très faible (Da'îf Jiddan)",
    "ضعيف جدا":              "Très faible (Da'îf Jiddan)",
    "موضوع":                 "Inventé (Mawdû')",
    "منكر":                  "Répréhensible (Munkar)",
    "شاذ":                   "Marginal (Shâdh)",
    "معلول":                 "Défectueux (Ma'lûl)",
    "مرسل":                  "Interrompu après le Successeur (Mursal)",
    "منقطع":                 "Interrompu (Munqati')",
    "معضل":                  "Doublement interrompu (Mu'dal)",
    "مدلس":                  "Avec dissimulation (Mudallis)",
    "مضطرب":                 "Confus (Mudtarib)",
    "مقلوب":                 "Inversé (Maqlûb)",
    "مدرج":                  "Interpolé (Mudraj)",
    "متواتر":                "Massif et ininterrompu (Mutawâtir)",
    "آحاد":                  "Rapporté par peu (Âhâd)",
    "مشهور":                 "Connu (Mashhûr)",
    "عزيز":                  "Rare (Azîz)",
    "غريب":                  "Étrange (Gharîb)",
    "إسناده صحيح":           "Chaîne authentique (Isnâduh Sahîh)",
    "إسناده حسن":            "Chaîne bonne (Isnâduh Hasan)",
    "إسناده ضعيف":           "Chaîne faible (Isnâduh Da'îf)",
    "رجاله ثقات":            "Ses transmetteurs sont fiables (Rijâluh Thiqât)",
    "لا أصل له":             "Sans fondement (Lâ Asla Lah)",
    "باطل":                  "Nul et non avenu (Bâtil)",
    "مكذوب":                 "Mensonger (Makdhûb)",
}

_GLOSSAIRE_AR_FR: dict[str, str] = {
    **_HUKM_AR_FR,
    "صلاة":     "Salât (prière)",
    "الصلاة":   "la Salât (prière)",
    "زكاة":     "Zakât",
    "الزكاة":   "la Zakât",
    "صوم":      "Sawm (jeûne)",
    "رمضان":    "Ramadân",
    "حج":       "Hajj",
    "عمرة":     "Umrah",
    "توحيد":    "Tawhîd (monothéisme)",
    "إيمان":    "Îmân (foi)",
    "عقيدة":    "Aqîdah (croyance)",
    "منهج":     "Manhaj (méthode)",
    "سنة":      "Sunnah",
    "السنة":    "la Sunnah",
    "حديث":     "Hadîth",
    "الحديث":   "le Hadîth",
    "شريعة":    "Sharî'ah",
    "فقه":      "Fiqh (jurisprudence islamique)",
    "فتوى":     "Fatwâ",
    "إجماع":    "Ijmâ' (consensus)",
    "قياس":     "Qiyâs (analogie)",
    "اجتهاد":   "Ijtihâd",
    "تفسير":    "Tafsîr (exégèse coranique)",
    "إسناد":    "Isnâd (chaîne de transmission)",
    "سند":      "Sanad (chaîne)",
    "متن":      "Matn (texte du hadîth)",
    "رجال":     "Rijâl (transmetteurs)",
    "جرح وتعديل": "Jarh wa Ta'dîl (critique des transmetteurs)",
    "ثقة":      "Thiqah (fiable)",
    "مجهول":    "Inconnu (Majhûl)",
    "متروك":    "Abandonné (Matrûk)",
    "كذاب":     "Menteur (Kaddhâb)",
    "طبقة":     "Tabaqah (génération)",
    "صحابي":    "Sahâbî (Compagnon)",
    "صحابة":    "Sahâbah (Compagnons)",
    "تابعي":    "Tâbi'î (Successeur)",
    "تابعون":   "Tâbi'ûn (Successeurs)",
    "جنة":      "Jannah (paradis)",
    "الجنة":    "la Jannah (paradis)",
    "نار":      "Nâr (feu de l'enfer)",
    "النار":    "le Nâr (feu de l'enfer)",
    "جهنم":     "Jahannam (géhenne)",
    "الآخرة":   "al-Âkhirah (l'au-delà)",
    "الله":     "Allah",
    "رب":       "Rabb (Seigneur)",
    "وضوء":     "Wudû (ablutions)",
    "سجود":     "Sujûd (prosternation)",
    "أذان":     "Adhân (appel à la prière)",
    "ذكر":      "Dhikr (rappel d'Allah)",
    "دعاء":     "Du'â (supplication)",
}

# =====================================================================
# FASTAPI APP
# =====================================================================

app = FastAPI(title="Mîzân API v22.9")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["Accept", "Content-Type", "Cache-Control"],
)

# =====================================================================
# UTILITAIRES TRADUCTION
# =====================================================================

def _patch_glossaire(text: str) -> str:
    """Applique le glossaire islamique sur un texte traduit."""
    if not text:
        return text
    for ar, fr in _GLOSSAIRE_AR_FR.items():
        text = text.replace(ar, fr)
    return text


def _protect_hukm(grade_ar: str) -> str:
    """Retourne la traduction légifèrée du verdict — jamais de traduction profane."""
    if not grade_ar:
        return ""
    grade_stripped = grade_ar.strip()
    # Correspondance exacte d'abord
    if grade_stripped in _HUKM_AR_FR:
        return _HUKM_AR_FR[grade_stripped]
    # Correspondance partielle
    for ar, fr in _HUKM_AR_FR.items():
        if ar in grade_stripped:
            return fr
    return grade_stripped


async def _google_translate(text: str, target: str = "fr") -> str:
    """Traduction Google Translate async — timeout 8s."""
    if not text or not text.strip():
        return ""
    try:
        url = "https://translate.googleapis.com/translate_a/single"
        params = {
            "client": "gtx",
            "sl":     "ar",
            "tl":     target,
            "dt":     "t",
            "q":      text[:2000],
        }
        async with httpx.AsyncClient(timeout=_GT_TIMEOUT) as client:
            r = await client.get(url, params=params)
            if r.status_code == 200:
                data = r.json()
                parts = []
                for block in data[0]:
                    if block and block[0]:
                        parts.append(str(block[0]))
                raw = " ".join(parts)
                return _patch_glossaire(raw)
    except Exception as e:
        log.warning(f"[GT] Erreur traduction: {e}")
    return ""


# =====================================================================
# SCRAPING DORAR.NET
# =====================================================================

async def _scrape_dorar(query: str) -> list[dict]:
    """Scrape Dorar.net et retourne une liste de hadiths bruts."""
    results = []
    try:
        params = {"q": query, "x": "0", "y": "0"}
        headers = {**_HEADERS, "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8"}
        async with httpx.AsyncClient(timeout=_TIMEOUT, follow_redirects=True) as client:
            r = await client.get(_HADITH_S, params=params, headers=headers)
            if r.status_code != 200:
                log.warning(f"[Dorar] HTTP {r.status_code}")
                return []
            tree = lx.fromstring(r.text)

            cards = tree.cssselect(".hadith-card") or tree.cssselect(".result-item") or []
            if not cards:
                # Fallback sélecteurs alternatifs
                cards = tree.cssselect("div[class*='hadith']") or []

            for card in cards[:5]:
                try:
                    # Texte arabe
                    ar_el = card.cssselect(".hadith-text, .matn, p") 
                    ar = ar_el[0].text_content().strip() if ar_el else ""

                    # Savant / Mohaddith
                    savant_el = card.cssselect(".hadith-info .scholar, .mohaddith, .savant")
                    savant = savant_el[0].text_content().strip() if savant_el else "—"

                    # Source
                    source_el = card.cssselect(".source, .book, .kitab")
                    source = source_el[0].text_content().strip() if source_el else "—"

                    # Grade arabe brut
                    grade_el = card.cssselect(".grade, .hukm, .verdict, span[class*='grade']")
                    grade_ar = grade_el[0].text_content().strip() if grade_el else ""

                    # Rawi
                    rawi_el = card.cssselect(".rawi, .narrator")
                    rawi = rawi_el[0].text_content().strip() if rawi_el else "—"

                    if ar and len(ar) > 10:
                        results.append({
                            "arabic_text": ar,
                            "savant":      savant,
                            "source":      source,
                            "grade":       grade_ar,
                            "rawi":        rawi,
                        })
                except Exception as e:
                    log.warning(f"[Dorar] Parse card error: {e}")
                    continue

    except Exception as e:
        log.error(f"[Dorar] Scrape error: {e}")

    return results


# =====================================================================
# ENRICHISSEMENT VIA CLAUDE API
# =====================================================================

_SYSTEM_ENRICHISSEMENT = """Tu es Al-Mîzân, moteur d'analyse de Hadith selon le Manhaj Salafi.
Tu analyses les hadiths selon la science du Jarh wa Ta'dîl.

RÈGLES ABSOLUES :
1. Les verdicts (Sahîh, Da'îf, Hasan, Mawdû', etc.) ne doivent JAMAIS être traduits librement.
2. Utilise toujours la terminologie islamique exacte avec sa translittération.
3. Réponds UNIQUEMENT en JSON valide, sans markdown, sans backticks.

Format de réponse JSON strict :
{
  "french_text": "traduction française du matn",
  "grade_explique": "explication du verdict en français avec sources",
  "jarh_tadil": "analyse de la chaîne de transmission",
  "isnad_chain": "chaîne pipe-séparée: Maillon 1|Nom|Titre|Verdict|Siècle",
  "sanad_conditions": "analyse des 5 conditions d'authenticité",
  "mutabaat": "voies de renfort (shawahid/mutaba'at)",
  "avis_savants": "avis des savants contemporains",
  "grille_albani": "verdict d'Al-Albani si disponible",
  "pertinence": "OUI/PARTIEL/NON — explication courte"
}"""


async def _enrich_hadith_claude(
    hadith: dict,
    query: str,
    idx: int,
) -> dict:
    """Enrichit un hadith via l'API Claude avec streaming."""
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        log.warning("[Claude] ANTHROPIC_API_KEY manquante")
        return hadith

    client = AsyncAnthropic(api_key=api_key)
    ar_text = hadith.get("arabic_text", "")
    grade_ar = hadith.get("grade", "")
    savant = hadith.get("savant", "")
    source = hadith.get("source", "")

    prompt = f"""Analyse ce hadith selon le Manhaj Salafi :

Texte arabe : {ar_text}
Savant / Mohaddith : {savant}
Source : {source}
Grade arabe (Hukm) : {grade_ar}
Requête originale : {query}

Fournis l'analyse complète en JSON."""

    try:
        enriched = dict(hadith)
        full_response = ""

        async with client.messages.stream(
            model="claude-sonnet-4-20250514",
            max_tokens=1500,
            system=_SYSTEM_ENRICHISSEMENT,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            async for text in stream.text_stream:
                full_response += text

        # Parse JSON
        clean = full_response.strip()
        clean = re.sub(r"^```json\s*", "", clean)
        clean = re.sub(r"```$", "", clean)
        clean = clean.strip()

        data = json.loads(clean)

        # Protection des verdicts — jamais de traduction profane
        if grade_ar:
            data["grade_protege"] = _protect_hukm(grade_ar)

        enriched.update(data)
        return enriched

    except json.JSONDecodeError as e:
        log.warning(f"[Claude] JSON parse error idx={idx}: {e}")
        # Fallback traduction Google
        fr = await _google_translate(ar_text)
        hadith["french_text"] = fr
        if grade_ar:
            hadith["grade_explique"] = _protect_hukm(grade_ar)
        return hadith
    except Exception as e:
        log.error(f"[Claude] Erreur enrichissement idx={idx}: {e}")
        return hadith


# =====================================================================
# GÉNÉRATEUR SSE
# =====================================================================

async def _sse_event(event: str, data: Any) -> str:
    """Formate un événement SSE."""
    payload = json.dumps(data, ensure_ascii=False)
    return f"event: {event}\ndata: {payload}\n\n"


async def _search_generator(query: str) -> AsyncGenerator[str, None]:
    """Générateur principal du flux SSE."""

    # ── STEP 0 : Initialisation ──
    yield await _sse_event("status", {"step": "INITIALISATION"})
    await asyncio.sleep(0.05)

    # ── STEP 1 : Scraping Dorar ──
    yield await _sse_event("status", {"step": "DORAR"})
    hadiths_raw = await _scrape_dorar(query)

    # Fallback si Dorar ne retourne rien
    if not hadiths_raw:
        log.info(f"[Dorar] Aucun résultat pour: {query}")
        # Traduction Google du query comme fallback
        fr_query = await _google_translate(query)
        yield await _sse_event("dorar", [])
        yield await _sse_event("status", {"step": "TAKHRIJ"})

        # Enrichissement direct via Claude sans résultat Dorar
        fake_hadith = {
            "arabic_text": query if _is_arabic(query) else "",
            "savant": "—",
            "source": "—",
            "grade": "",
            "rawi": "—",
            "french_text": fr_query,
        }
        enriched = await _enrich_hadith_claude(fake_hadith, query, 0)
        yield await _sse_event("hadith", {"index": 0, "data": enriched})
        yield await _sse_event("done", [enriched])
        return

    # ── STEP 2 : Envoi des hadiths bruts ──
    yield await _sse_event("status", {"step": "TAKHRIJ"})
    yield await _sse_event("dorar", hadiths_raw)

    # ── STEP 3 : Enrichissement hadith par hadith ──
    yield await _sse_event("status", {"step": "RIJAL"})
    enriched_list = []

    for idx, hadith in enumerate(hadiths_raw):
        yield await _sse_event("status", {"step": "JARH"})

        # Chunk intermédiaire (typewriter effect)
        ar_preview = hadith.get("arabic_text", "")[:80]
        yield await _sse_event("chunk", {"index": idx, "delta": f"Analyse en cours — {ar_preview}…"})

        # Enrichissement complet
        enriched = await _enrich_hadith_claude(hadith, query, idx)

        # Protection verdict HUKM — règle absolue
        grade_ar = hadith.get("grade", "")
        if grade_ar and "grade_explique" not in enriched:
            enriched["grade_explique"] = _protect_hukm(grade_ar)

        # Traduction Google fallback si pas de french_text
        if not enriched.get("french_text") and hadith.get("arabic_text"):
            enriched["french_text"] = await _google_translate(hadith["arabic_text"])

        enriched_list.append(enriched)

        yield await _sse_event("status", {"step": "HUKM"})
        yield await _sse_event("hadith", {"index": idx, "data": enriched})
        await asyncio.sleep(0.1)

    # ── STEP 4 : Done ──
    yield await _sse_event("done", enriched_list)


def _is_arabic(text: str) -> bool:
    """Détecte si le texte contient principalement de l'arabe."""
    arabic_chars = sum(1 for c in text if "\u0600" <= c <= "\u06ff")
    return arabic_chars > len(text) * 0.3


# =====================================================================
# ROUTES FASTAPI
# =====================================================================

@app.get("/api/search")
async def search(request: Request, q: str = ""):
    """Endpoint principal — flux SSE de recherche et analyse de hadith."""
    if not q or not q.strip():
        return {"error": "Paramètre q requis"}

    accept = request.headers.get("accept", "")

    if "text/event-stream" in accept:
        return StreamingResponse(
            _search_generator(q.strip()),
            media_type="text/event-stream",
            headers={
                **CORS_HEADERS,
                "Cache-Control":  "no-cache",
                "X-Accel-Buffering": "no",
            },
        )
    else:
        # Fallback JSON — collecte tous les événements
        results = []
        async for chunk in _search_generator(q.strip()):
            if chunk.startswith("event: hadith"):
                lines = chunk.strip().split("\n")
                for line in lines:
                    if line.startswith("data:"):
                        try:
                            data = json.loads(line[5:].strip())
                            if data.get("data"):
                                results.append(data["data"])
                        except Exception:
                            pass
        return results


@app.get("/api/health")
async def health():
    """Health check."""
    return {"status": "ok", "version": "22.9"}


@app.options("/api/{path:path}")
async def options_handler():
    """CORS preflight."""
    from fastapi.responses import Response
    return Response(headers=CORS_HEADERS)


# =====================================================================
# HANDLER VERCEL (WSGI/ASGI)
# =====================================================================

handler = app
