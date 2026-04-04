"""
api/rawi.py — MÎZÂN v22.5  "Verrou de Fer — Preuve Visuelle"
═══════════════════════════════════════════════════════════════════
CORRECTIONS v22.5 :
  ① Sahabi détection STRICTE — "رضي الله عنه" SUPPRIMÉ du check.
     Ce pattern matchait la page ENTIÈRE (hadith cités) → faux positif.
     Désormais : death_year=0 UNIQUEMENT si le champ tabaqa/died
     contient explicitement "صحابي" / "من الصحابة" / "له صحبة".
  ② trusted_field=True/False : seuls les champs dédiés (tabaqa, died)
     peuvent déclencher Sahabi=0. Le raw_text de page ne le peut pas.
  ③ Sanity-check 1 ≤ year ≤ 1500. Rabi' (†1442) est dans la plage.
═══════════════════════════════════════════════════════════════════
"""
from __future__ import annotations

import asyncio
import logging
import re
from typing import Any

import httpx
from lxml import html as lx

log = logging.getLogger("mizan.rawi")

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

_TIMEOUT   = httpx.Timeout(25.0, connect=10.0)
_MAX_RETRY = 3


# ══════════════════════════════════════════════════════════════════
# VERROU CHRONOLOGIQUE
# ══════════════════════════════════════════════════════════════════

_PAT_YEAR: list[re.Pattern[str]] = [
    re.compile(
        r'(?:ت\.?|توفي|وفاته|المتوفى|مات)[:\s,،.]*'
        r'(?:نحو|حوالي|سنة|عام)?\s*(\d{2,4})\s*ه',
        re.UNICODE,
    ),
    re.compile(r'\b(\d{2,4})\s*هـ\b', re.UNICODE),
    re.compile(r'\b(\d{2,4})\s*AH\b', re.IGNORECASE),
]

# ──────────────────────────────────────────────────────────────────
#  SAHABI — DÉTECTION STRICTE (FIX CRITIQUE v22.5)
#
#  ❌ SUPPRIMÉ : r'رضي\s+الله\s+عنه?م?'
#     Ce du'ā' figure dans TOUT le corpus hadith pour TOUT narrateur
#     citant un Ṣaḥābī dans son texte. Il est présent même sur la
#     page de Rabi' Al-Madkhali (†1442) → faux positif → death_year=0.
#
#  ✅ CONSERVÉ : marqueurs STRUCTURELS propres aux fiches Ṣaḥāba.
# ──────────────────────────────────────────────────────────────────
_PAT_SAHABI = re.compile(
    r'صحاب[يةه]\b'
    r'|من\s+الصحابة'
    r'|صَحَابِيّ'
    r'|له\s+صحبة',
    re.UNICODE,
)


def extract_death_year(text: str, *, trusted_field: bool = False) -> int:
    """
    Retourne TOUJOURS un int.

      trusted_field=True  → champ Dorar dédié (tabaqa, died) :
                            peut retourner 0 si Ṣaḥābī explicite.
      trusted_field=False → texte brut de page / raw_text :
                            ne retourne JAMAIS 0 (trop de bruit).

    Plages :
      0    → Ṣaḥābī confirmé (trusted_field=True uniquement)
      1-1500 → année hijrie valide (Rabi' †1442 inclus)
      9999 → date inconnue / contemporain sans date
    """
    if not text:
        return 9999

    txt = text.strip()

    if trusted_field and _PAT_SAHABI.search(txt):
        return 0

    for pat in _PAT_YEAR:
        m = pat.search(txt)
        if m:
            yr = int(m.group(1))
            if 1 <= yr <= 1500:
                return yr

    return 9999


def resolve_death_year(d: dict[str, Any]) -> int:
    """
    Résolution finale — retourne TOUJOURS un int.

    Ordre de priorité :
      1. "died"  (trusted → Sahabi possible)
      2. "tabaqa" (trusted → Sahabi possible)
      3. "name_ar" (untrusted)
      4. "_raw_text" (untrusted → jamais Sahabi)
    """
    for key in ("died", "tabaqa"):
        val = str(d.get(key, "")).strip()
        if val:
            yr = extract_death_year(val, trusted_field=True)
            if yr != 9999:
                return yr

    for key in ("name_ar", "_raw_text"):
        val = str(d.get(key, "")).strip()
        if val:
            yr = extract_death_year(val, trusted_field=False)
            if yr != 9999:
                return yr

    return 9999


# ══════════════════════════════════════════════════════════════════
# HTTP
# ══════════════════════════════════════════════════════════════════

def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        http2=True,
        headers=_HEADERS,
        timeout=_TIMEOUT,
        follow_redirects=True,
    )


async def _get(
    cli: httpx.AsyncClient,
    url: str,
    **params: Any,
) -> httpx.Response | None:
    for attempt in range(1, _MAX_RETRY + 1):
        try:
            r = await cli.get(url, params=params or None)
            r.raise_for_status()
            return r
        except httpx.HTTPStatusError as exc:
            log.warning("HTTP %s — %s (tentative %d/%d)",
                        exc.response.status_code, url, attempt, _MAX_RETRY)
        except (httpx.ConnectError, httpx.ReadTimeout, httpx.RemoteProtocolError) as exc:
            log.warning("Réseau — %s (tentative %d/%d) : %s",
                        url, attempt, _MAX_RETRY, exc)
        if attempt < _MAX_RETRY:
            await asyncio.sleep(1.5 ** attempt)
    log.error("Abandon après %d tentatives : %s", _MAX_RETRY, url)
    return None


def _parse(content: bytes) -> lx.HtmlElement:
    return lx.fromstring(content)


def _xtext(root: lx.HtmlElement, xpath: str, default: str = "") -> str:
    nodes = root.xpath(xpath)
    if not nodes:
        return default
    n = nodes[0]
    return n.text_content().strip() if hasattr(n, "text_content") else str(n).strip()


def _rid_from_href(href: str) -> int | None:
    m = re.search(r'/rijal/(?:rawi/)?(\d+)', href)
    return int(m.group(1)) if m else None


# ══════════════════════════════════════════════════════════════════
# RawiScraper
# ══════════════════════════════════════════════════════════════════

class RawiScraper:

    def __init__(self) -> None:
        self._cli: httpx.AsyncClient | None = None

    async def __aenter__(self) -> "RawiScraper":
        self._cli = _client()
        return self

    async def __aexit__(self, *_: Any) -> None:
        if self._cli:
            await self._cli.aclose()

    async def get_rawi(self, name: str) -> dict[str, Any]:
        rawi_id, partial = await self._search(name)
        if not rawi_id:
            log.warning("Introuvable Rijal Dorar : «%s»", name)
            return _empty_rawi(name)
        detail = await self._detail(rawi_id)
        for k, v in partial.items():
            detail.setdefault(k, v)
        detail["id"]         = rawi_id
        detail["name_query"] = name
        detail["death_year"] = int(resolve_death_year(detail))
        return detail

    async def get_rawi_by_id(self, rawi_id: int | str) -> dict[str, Any]:
        detail = await self._detail(str(rawi_id))
        detail["id"]         = int(rawi_id)
        detail["death_year"] = int(resolve_death_year(detail))
        return detail

    async def _search(self, name: str) -> tuple[int | None, dict[str, Any]]:
        r = await _get(self._cli, _SEARCH_R, skey=name)
        if not r:
            return None, {}
        doc = _parse(r.content)
        hrefs: list[str] = (
            doc.xpath('//a[contains(@href,"/rijal/rawi/")]/@href')
            or doc.xpath('//a[contains(@href,"/rijal/")]/@href')
        )
        if not hrefs:
            return None, {}
        rawi_id = _rid_from_href(hrefs[0])
        if rawi_id is None:
            return None, {}
        partial: dict[str, Any] = {}
        cards = doc.xpath(
            '//div[contains(@class,"card")]'
            '|//div[contains(@class,"rawi-item")]'
            '|//li[contains(@class,"rawi")]'
        )
        if cards:
            partial["_raw_text"] = cards[0].text_content()
        return rawi_id, partial

    async def _detail(self, rawi_id: str) -> dict[str, Any]:
        url = f"{_RIJAL}/rawi/{rawi_id}"
        r   = await _get(self._cli, url)
        if not r:
            return {}
        doc = _parse(r.content)
        d: dict[str, Any] = {}

        d["name_ar"] = _xtext(
            doc,
            '//h1[contains(@class,"rawi")]'
            '|//h1[contains(@class,"name")]'
            '|//h1|//h2[@class]',
        )
        d["_raw_text"] = doc.text_content()

        died_nodes = doc.xpath(
            '//*[contains(text(),"المتوفى") or contains(text(),"توفي")'
            ' or contains(text(),"وفاته") or contains(text(),"ت.")]'
        )
        d["died"] = died_nodes[0].text_content().strip() if died_nodes else ""

        grade_nodes = doc.xpath(
            '//*[contains(@class,"grade") or contains(@class,"hukm")'
            ' or contains(@class,"verdict") or contains(@class,"status")]'
        )
        if grade_nodes:
            d["verdict"] = grade_nodes[0].text_content().strip()
        else:
            d["verdict"] = ""
            for node in doc.xpath('//*[@class]'):
                cls = node.get("class", "")
                if any(c in cls for c in ("green", "red", "yellow", "orange")):
                    candidate = node.text_content().strip()
                    if candidate:
                        d["verdict"] = candidate
                        break

        tabaqa_nodes = doc.xpath(
            '//*[contains(text(),"الطبقة")'
            ' or contains(@class,"tabaqa") or contains(@class,"generation")]'
        )
        d["tabaqa"] = tabaqa_nodes[0].text_content().strip() if tabaqa_nodes else ""

        d["mashayikh"] = self._extract_list(doc, "mashayikh")
        d["talamidh"]  = self._extract_list(doc, "talamidh")

        if not d["mashayikh"]:
            log.warning("DEEP — mashayikh absents rawi_id=%s", rawi_id)
        if not d["talamidh"]:
            log.warning("DEEP — talamidh absents rawi_id=%s", rawi_id)

        return d

    _LABELS: dict[str, list[str]] = {
        "mashayikh": ["شيوخه", "المشايخ", "روى عن", "حدث عن"],
        "talamidh":  ["تلاميذه", "الرواة عنه", "روى عنه", "التلاميذ"],
    }

    def _extract_list(self, doc: lx.HtmlElement, kind: str) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        seen: set[str] = set()

        def _collect(elements: list) -> None:
            for el in elements:
                name = el.text_content().strip()
                if not name or name in seen:
                    continue
                tag  = (el.tag or "").lower()
                href = ""
                if tag == "li":
                    links = el.xpath('.//a[contains(@href,"/rijal/")]')
                    href  = links[0].get("href", "") if links else ""
                elif tag == "a":
                    href = el.get("href", "")
                seen.add(name)
                rid = _rid_from_href(href) if href else None
                results.append({
                    "name": name,
                    "id":   rid,
                    "url":  (_BASE + href) if href.startswith("/") else (href or None),
                })

        sec = doc.xpath(f'//*[contains(@class,"{kind}") or contains(@id,"{kind}")]')
        if sec:
            _collect(sec[0].xpath('.//li | .//a[contains(@href,"/rijal/")]'))

        if not results:
            for label in self._LABELS.get(kind, []):
                headers = doc.xpath(f'//*[contains(text(),"{label}")]')
                if not headers:
                    continue
                hdr = headers[0]
                items = (
                    hdr.xpath('following-sibling::ul//li')
                    or hdr.xpath('following-sibling::ol//li')
                    or hdr.xpath('../following-sibling::ul//li')
                    or hdr.xpath('../following-sibling::ol//li')
                    or (hdr.getparent() or hdr).xpath(
                        'following-sibling::*//li | following-sibling::*//a'
                    )
                )
                _collect(items)
                if results:
                    break

        if not results:
            _collect(doc.xpath(
                f'//section[contains(@class,"{kind}")]//a'
                f' | //div[contains(@class,"{kind}")]//a'
            ))

        return results


# ══════════════════════════════════════════════════════════════════
# IsnadScraper
# ══════════════════════════════════════════════════════════════════

class IsnadScraper:

    def __init__(self) -> None:
        self._cli: httpx.AsyncClient | None = None

    async def __aenter__(self) -> "IsnadScraper":
        self._cli = _client()
        return self

    async def __aexit__(self, *_: Any) -> None:
        if self._cli:
            await self._cli.aclose()

    async def get_chain(self, query: str) -> list[dict[str, Any]]:
        chain = await self._fetch(query, mode=1)
        if not chain:
            log.info("Fallback Takhrij m[]=2 pour : «%s»", query)
            chain = await self._fetch(query, mode=2)
        if not chain:
            log.warning("Aucune chaîne d'isnād : «%s»", query)
            return []
        chain.sort(key=lambda n: int(n["death_year"]))
        return chain

    async def get_chain_deep(self, query: str) -> list[dict[str, Any]]:
        chain = await self.get_chain(query)
        if not chain:
            return []
        async with RawiScraper() as rs:
            tasks = [
                rs.get_rawi_by_id(n["id"]) if n.get("id") else rs.get_rawi(n["name"])
                for n in chain
            ]
            extras = await asyncio.gather(*tasks, return_exceptions=True)
        for i, extra in enumerate(extras):
            if isinstance(extra, Exception) or not isinstance(extra, dict):
                log.error("Enrichissement nœud %d : %s", i, extra)
                continue
            chain[i].update({
                "name_ar":   extra.get("name_ar",   chain[i].get("name_ar", "")),
                "tabaqa":    extra.get("tabaqa",    ""),
                "verdict":   extra.get("verdict",   chain[i].get("verdict", "")),
                "died":      extra.get("died",      chain[i].get("died", "")),
                "mashayikh": extra.get("mashayikh", []),
                "talamidh":  extra.get("talamidh",  []),
                "death_year": int(extra.get("death_year", chain[i]["death_year"])),
            })
        chain.sort(key=lambda n: int(n["death_year"]))
        return chain

    async def _fetch(self, query: str, mode: int) -> list[dict[str, Any]]:
        r = await _get(self._cli, _HADITH_S, q=query, **{"m[]": mode})
        if not r:
            return []
        doc   = _parse(r.content)
        chain: list[dict[str, Any]] = []
        seen:  set[str] = set()

        for node in doc.xpath('//*[@data-rawi-id] | //*[@data-id][contains(@class,"rawi")]'):
            name = node.text_content().strip()
            if not name or name in seen:
                continue
            seen.add(name)
            rawi_id = node.get("data-rawi-id") or node.get("data-id")
            death_raw = (node.get("data-death") or node.get("data-wafat")
                         or node.get("data-died") or "")
            chain.append(_node(name, rawi_id, death_raw, node.get("data-grade", "")))

        if not chain:
            for node in doc.xpath(
                '//*[contains(@class,"narrator") or contains(@class,"rawi-name")'
                ' or contains(@class,"sanad-item") or contains(@class,"isnad-node")]'
            ):
                name = node.text_content().strip()
                if not name or name in seen:
                    continue
                seen.add(name)
                links   = node.xpath('.//a[contains(@href,"/rijal/")]/@href')
                rawi_id = str(_rid_from_href(links[0])) if links else None
                chain.append(_node(name, rawi_id, "", ""))

        if not chain:
            for a in doc.xpath(
                '//div[contains(@class,"hadith")]//a[contains(@href,"/rijal/")]'
                ' | //article//a[contains(@href,"/rijal/")]'
            ):
                name = a.text_content().strip()
                if not name or name in seen:
                    continue
                seen.add(name)
                chain.append(_node(name, str(_rid_from_href(a.get("href", "")) or ""), "", ""))

        return chain


# ══════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════

def _node(name: str, rawi_id: str | None, death_raw: str, verdict: str) -> dict[str, Any]:
    yr = int(extract_death_year(death_raw, trusted_field=True)) if death_raw else 9999
    return {
        "name":       name,
        "name_ar":    name,
        "id":         int(rawi_id) if rawi_id and str(rawi_id).isdigit() else None,
        "verdict":    verdict,
        "died":       death_raw,
        "death_year": yr,
        "tabaqa":     "",
        "mashayikh":  [],
        "talamidh":   [],
    }


def _empty_rawi(name: str) -> dict[str, Any]:
    return {
        "name":       name,
        "name_ar":    name,
        "id":         None,
        "death_year": 9999,
        "died":       "",
        "verdict":    "",
        "tabaqa":     "",
        "mashayikh":  [],
        "talamidh":   [],
    }


# ══════════════════════════════════════════════════════════════════
# FASTAPI APP — point d'entrée Vercel (variable "app" obligatoire)
# ══════════════════════════════════════════════════════════════════

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# "app" au niveau module — Vercel détecte ce nom exactement.
app = FastAPI(title="MÎZÂN API", version="22.5")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/rawi/{name}", tags=["rawi"])
async def api_rawi(name: str) -> JSONResponse:
    """Biographie complète d'un narrateur par nom."""
    async with RawiScraper() as s:
        data = await s.get_rawi(name)
    if not data.get("id"):
        raise HTTPException(404, detail=f"Introuvable : «{name}»")
    return JSONResponse(data)


@app.get("/api/rawi/id/{rawi_id}", tags=["rawi"])
async def api_rawi_by_id(rawi_id: int) -> JSONResponse:
    """Biographie par ID Dorar Rijal."""
    async with RawiScraper() as s:
        data = await s.get_rawi_by_id(rawi_id)
    if not data:
        raise HTTPException(404, detail=f"ID {rawi_id} introuvable")
    return JSONResponse(data)


@app.get("/api/isnad", tags=["isnad"])
async def api_isnad(
    q:    str  = Query(..., description="Texte du hadith / début de matn"),
    deep: bool = Query(False, description="Active mashayikh + talamidh"),
) -> JSONResponse:
    """
    Chaîne d'isnād triée par death_year (int).
    Fallback automatique m[]=1 → m[]=2.
    """
    async with IsnadScraper() as s:
        chain = await (s.get_chain_deep(q) if deep else s.get_chain(q))
    return JSONResponse({"query": q, "count": len(chain), "chain": chain})


# ══════════════════════════════════════════════════════════════════
# CLI — python api/rawi.py
# ══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import json

    async def _demo() -> None:
        LINE = "═" * 64

        print(f"\n{LINE}")
        print("  MÎZÂN v22.5 — Verrou de Fer — Tests unitaires")
        print(LINE)

        CASES: list[tuple[str, bool, int, str]] = [
            ("صحابي",                True,  0,    "Sahabi explicite → 0"),
            ("من الصحابة",           True,  0,    "Sahabi Dorar tag → 0"),
            ("له صحبة",              True,  0,    "له صحبة → 0"),
            ("رضي الله عنه",         False, 9999, "Dua'a untrusted → 9999 ✅"),
            ("رضي الله عنه",         True,  9999, "Dua'a trusted → 9999 ✅"),
            ("توفي سنة 256هـ",       False, 256,  "Al-Bukhari → 256"),
            ("المتوفى 852هـ",        True,  852,  "Ibn Hajar → 852"),
            ("توفي سنة 1442هـ",      False, 1442, "Rabi' Al-Madkhali → 1442 ✅"),
            ("Died 179 AH",          False, 179,  "179 AH"),
            ("معاصر بلا تاريخ",      False, 9999, "Contemporain → 9999"),
            ("",                     False, 9999, "Vide → 9999"),
        ]

        ok_all = True
        for txt, trusted, expected, desc in CASES:
            got    = extract_death_year(txt, trusted_field=trusted)
            ok     = (got == expected)
            ok_all = ok_all and ok
            print(f"  {'✅' if ok else '❌'}  [{got:>4}]  {desc}")
            if not ok:
                print(f"         ^ attendu={expected}")

        print(f"\n  {'TOUS CORRECTS ✅' if ok_all else 'ERREURS DÉTECTÉES ❌'}")

        # Simulation Rabi' avec page contenant رضي الله عنه
        print(f"\n{LINE}")
        print("  Simulation résolution Rabi' Al-Madkhali")
        print(LINE)
        fake = {
            "died":      "توفي سنة 1442هـ",
            "tabaqa":    "المعاصرون",
            "_raw_text": "روى عن أبي هريرة رضي الله عنه ...",
        }
        yr = resolve_death_year(fake)
        assert isinstance(yr, int)
        assert yr == 1442, f"Attendu 1442, got {yr}"
        print(f"  ✅  death_year={yr}  — 'رضي الله عنه' ignoré dans raw_text")

    asyncio.run(_demo())
