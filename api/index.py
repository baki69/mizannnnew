"""
api/index.py — MÎZÂN v22.6  "Verrou de Fer — /api/search"
═══════════════════════════════════════════════════════════════════
AJOUTS v22.6 :
  ① /api/search  — route manquante corrigée (cause du 404 engine.js)
  ② HadithSearcher — scrape Dorar.net, retourne le format attendu
     par _mapHadithRaw() dans engine.js
  ③ SSE streaming — events: status / dorar / hadith / done / error
  ④ JSON fallback — retourné si SSE non supporté par le client
═══════════════════════════════════════════════════════════════════
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any, AsyncGenerator

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

_PAT_SAHABI = re.compile(
    r'صحاب[يةه]\b'
    r'|من\s+الصحابة'
    r'|صَحَابِيّ'
    r'|له\s+صحبة',
    re.UNICODE,
)


def extract_death_year(text: str, *, trusted_field: bool = False) -> int:
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
# NOUVEAU — HadithSearcher v22.6
# Scrape Dorar.net /hadith/search → format attendu par _mapHadithRaw()
# ══════════════════════════════════════════════════════════════════

class HadithSearcher:
    """
    Recherche des hadiths sur Dorar.net et retourne des dicts
    compatibles avec _mapHadithRaw() dans engine.js.

    Champs produits :
      arabic_text, savant, source, grade, french_text,
      grade_explique, jarh_tadil, isnad_chain, sanad_conditions,
      mutabaat, avis_savants, grille_albani, pertinence, rawi
    """

    def __init__(self) -> None:
        self._cli: httpx.AsyncClient | None = None

    async def __aenter__(self) -> "HadithSearcher":
        self._cli = _client()
        return self

    async def __aexit__(self, *_: Any) -> None:
        if self._cli:
            await self._cli.aclose()

    async def search(
        self, query: str, max_results: int = 5
    ) -> list[dict[str, Any]]:
        """Recherche et déduplique les hadiths correspondant à la requête."""
        results: list[dict[str, Any]] = []

        for mode in (1, 2):
            r = await _get(self._cli, _HADITH_S, q=query, **{"m[]": mode})
            if not r:
                continue
            parsed = self._parse_page(r.content, query)
            results.extend(parsed)
            if results:
                break

        # Déduplication par préfixe du texte arabe
        seen: set[str] = set()
        unique: list[dict[str, Any]] = []
        for h in results:
            key = h["arabic_text"][:80]
            if key not in seen and len(key) > 5:
                seen.add(key)
                unique.append(h)

        return unique[:max_results]

    # ── Parsing ────────────────────────────────────────────────────

    def _parse_page(self, content: bytes, query: str) -> list[dict[str, Any]]:
        doc = _parse(content)

        # Stratégie 1 — sélecteurs Dorar.net connus
        containers = doc.xpath(
            '//div[contains(@class,"hadith-info")]'
            '| //div[contains(@class,"hadith-hd-info")]'
            '| //div[contains(@class,"search-result")]'
            '| //article[contains(@class,"hadith")]'
            '| //div[contains(@class,"hadith-container")]'
        )

        # Stratégie 2 — blocs RTL de plus de 60 caractères
        if not containers:
            containers = doc.xpath(
                '//*[@dir="rtl" and string-length(normalize-space(.)) > 60]'
            )[:8]

        # Stratégie 3 — n'importe quel bloc avec du texte arabe dense
        if not containers:
            containers = [
                n for n in doc.xpath('//*[string-length(.) > 80]')
                if len(re.findall(r'[\u0600-\u06FF]', n.text_content())) > 20
            ][:6]

        results: list[dict[str, Any]] = []
        for node in containers[:6]:
            h = self._extract_hadith(node, query)
            if h:
                results.append(h)

        return results

    def _extract_hadith(self, node: Any, query: str) -> dict[str, Any] | None:
        """Extrait les données d'un nœud HTML représentant un hadith."""

        # ── Texte arabe ────────────────────────────────────────────
        ar_candidates = node.xpath(
            './/*[@dir="rtl"]'
            '| .//p[contains(@class,"hadith")]'
            '| .//div[contains(@class,"content")]'
            '| .//div[contains(@class,"text")]'
            '| .//span[contains(@class,"hadith")]'
        )
        raw_ar = (
            ar_candidates[0].text_content().strip()
            if ar_candidates
            else node.text_content().strip()
        )
        ar_text = re.sub(r'\s+', ' ', raw_ar)[:2000]

        # Filtrer les nœuds sans contenu arabe réel
        if len(re.findall(r'[\u0600-\u06FF]', ar_text)) < 15:
            return None

        # ── Grade ──────────────────────────────────────────────────
        grade_nodes = node.xpath(
            './/span[contains(@class,"grade")]'
            '| .//span[contains(@class,"label")]'
            '| .//span[contains(@class,"badge")]'
            '| .//div[contains(@class,"grade")]'
            '| .//span[contains(@class,"hukm")]'
        )
        grade = ""
        for gn in grade_nodes:
            g = gn.text_content().strip()
            if g and 2 < len(g) < 60:
                grade = g
                break

        # ── Savant / Muhaddith ─────────────────────────────────────
        savant = _xtext(
            node,
            './/a[contains(@href,"muhaddith")]'
            '| .//span[contains(@class,"muhaddith")]'
            '| .//span[contains(@class,"savant")]'
            '| .//a[contains(@class,"muhaddith")]',
        )

        # ── Source / Livre ─────────────────────────────────────────
        source = _xtext(
            node,
            './/a[contains(@href,"book")]'
            '| .//span[contains(@class,"source")]'
            '| .//span[contains(@class,"book")]'
            '| .//a[contains(@class,"book")]',
        )

        # ── Pertinence ─────────────────────────────────────────────
        q_words = [w for w in re.split(r'\s+', query) if len(w) > 2]
        hits = sum(1 for w in q_words if w in ar_text)
        if q_words and hits == len(q_words):
            pertinence = "OUI — Correspondance exacte"
        elif hits > 0:
            pertinence = f"PARTIEL — {hits}/{len(q_words)} termes trouvés"
        else:
            pertinence = "NON — Correspondance thématique Dorar"

        return {
            "arabic_text":      ar_text,
            "savant":           savant or "محدث",
            "source":           source or "مصدر",
            "grade":            grade,
            "grade_ar":         grade,
            "french_text":      "",
            "grade_explique":   grade,
            "jarh_tadil":       "",
            "isnad_chain":      "",
            "sanad_conditions": "",
            "mutabaat":         "",
            "avis_savants":     "",
            "grille_albani":    "",
            "pertinence":       pertinence,
            "rawi":             savant or "",
        }


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
# SSE GENERATOR — /api/search streaming progressif
# Events consommés par engine.js → _searchDorarTopic()
# ══════════════════════════════════════════════════════════════════

async def _search_sse_stream(query: str) -> AsyncGenerator[str, None]:
    """
    Génère des frames SSE pour la recherche hadith.
    Format : "event: NAME\\ndata: JSON\\n\\n"

    Séquence d'events attendue par engine.js :
      status(INITIALISATION) → status(DORAR) → dorar([hadiths])
      → status(TAKHRIJ) → status(RIJAL) → status(JARH)
      → hadith({index, data}) × N → status(HUKM) → done
    """

    def frame(event: str, data: Any) -> str:
        return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

    try:
        # ── Phase 0 : Initialisation ───────────────────────────────
        yield frame("status", {"step": "INITIALISATION"})
        await asyncio.sleep(0.04)

        # ── Phase 1 : Recherche Dorar.net ─────────────────────────
        yield frame("status", {"step": "DORAR"})

        async with HadithSearcher() as searcher:
            hadiths = await searcher.search(query, max_results=5)

        if not hadiths:
            yield frame("status", {"step": "HUKM"})
            yield frame("done", {"count": 0, "message": "Aucun résultat trouvé sur Dorar.net"})
            return

        # Envoi immédiat des résultats bruts (affichage skeleton engine.js)
        yield frame("dorar", hadiths)
        yield frame("status", {"step": "TAKHRIJ"})
        await asyncio.sleep(0.06)

        # ── Phase 2 : Enrichissement isnad (par hadith) ───────────
        for idx, hadith in enumerate(hadiths):
            yield frame("status", {"step": "RIJAL"})

            ar_snippet = hadith.get("arabic_text", "")[:200]
            if ar_snippet:
                try:
                    async with IsnadScraper() as sc:
                        chain = await sc.get_chain(ar_snippet)

                    if chain:
                        pipe_lines: list[str] = []
                        for j, node in enumerate(chain):
                            pipe_lines.append(
                                f"Maillon {j + 1} | "
                                f"{node['name']} | "
                                f"{node.get('tabaqa', '')} | "
                                f"{node.get('verdict', '')} | "
                                f"{node.get('died', '')}"
                            )
                        hadith["isnad_chain"] = "\n".join(pipe_lines)
                except Exception as exc:
                    log.warning("isnad enrichment failed idx=%d : %s", idx, exc)

            yield frame("status", {"step": "JARH"})
            await asyncio.sleep(0.04)

            # Livraison de l'hadith enrichi
            yield frame("hadith", {"index": idx, "data": hadith})

        # ── Phase 3 : Clôture ──────────────────────────────────────
        yield frame("status", {"step": "HUKM"})
        yield frame("done", {"count": len(hadiths)})

    except Exception as exc:
        log.error("_search_sse_stream fatal : %s", exc)
        yield frame("error", {"message": str(exc)})
        yield frame("done", {"count": 0})


# ══════════════════════════════════════════════════════════════════
# FASTAPI APP — point d'entrée Vercel (variable "app" obligatoire)
# ══════════════════════════════════════════════════════════════════

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

app = FastAPI(title="MÎZÂN API", version="22.6")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
    allow_credentials=False,
)


# ── OPTIONS pre-flight (CORS mobile Safari / Chrome) ──────────────
@app.options("/{full_path:path}")
async def options_handler(full_path: str) -> JSONResponse:
    return JSONResponse(
        content={},
        headers={
            "Access-Control-Allow-Origin":  "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Accept, Content-Type, Cache-Control",
        },
    )


# ── /api/rawi ──────────────────────────────────────────────────────
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


# ── /api/isnad ─────────────────────────────────────────────────────
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
# /api/search — ROUTE CRITIQUE (cause du 404 corrigée ici)
# Consommée par engine.js → MIZAN_SEARCH_IA + _searchDorarTopic()
#
# Dual-mode :
#   • Accept: text/event-stream → SSE (events progressifs)
#   • sinon               → JSON array (fallback engine.js)
# ══════════════════════════════════════════════════════════════════
@app.get("/api/search", tags=["search"])
async def api_search(
    request: Request,
    q: str = Query(..., min_length=1, description="Texte du hadith ou mot-clé"),
) -> StreamingResponse | JSONResponse:
    """
    Recherche un hadith sur Dorar.net.

    SSE events (Accept: text/event-stream) :
      status • dorar • hadith • done • error

    JSON fallback : tableau de hadiths (même format que SSE dorar).
    """
    q = q.strip()
    if not q:
        raise HTTPException(400, detail="Paramètre 'q' vide.")

    accept = request.headers.get("accept", "")

    if "text/event-stream" in accept:
        return StreamingResponse(
            _search_sse_stream(q),
            media_type="text/event-stream",
            headers={
                "Cache-Control":                "no-cache",
                "X-Accel-Buffering":            "no",
                "Connection":                   "keep-alive",
                "Access-Control-Allow-Origin":  "*",
                "Access-Control-Allow-Headers": "Accept, Cache-Control",
            },
        )

    # JSON fallback — engine.js le consomme via _renderTopicList()
    async with HadithSearcher() as searcher:
        hadiths = await searcher.search(q, max_results=5)
    return JSONResponse(hadiths)


# ══════════════════════════════════════════════════════════════════
# CLI — python api/index.py
# ══════════════════════════════════════════════════════════════════

if __name__ == "__main__":

    async def _demo() -> None:
        LINE = "═" * 64
        print(f"\n{LINE}")
        print("  MÎZÂN v22.6 — Tests extract_death_year")
        print(LINE)

        CASES: list[tuple[str, bool, int, str]] = [
            ("صحابي",              True,  0,    "Sahabi explicite → 0"),
            ("رضي الله عنه",       False, 9999, "Dua'a untrusted → 9999 ✅"),
            ("رضي الله عنه",       True,  9999, "Dua'a trusted → 9999 ✅"),
            ("توفي سنة 256هـ",     False, 256,  "Al-Bukhari → 256"),
            ("المتوفى 852هـ",      True,  852,  "Ibn Hajar → 852"),
            ("توفي سنة 1442هـ",    False, 1442, "Rabi' Al-Madkhali → 1442 ✅"),
            ("Died 179 AH",        False, 179,  "179 AH"),
            ("معاصر بلا تاريخ",    False, 9999, "Contemporain → 9999"),
            ("",                   False, 9999, "Vide → 9999"),
        ]

        ok_all = True
        for txt, trusted, expected, desc in CASES:
            got    = extract_death_year(txt, trusted_field=trusted)
            ok     = (got == expected)
            ok_all = ok_all and ok
            print(f"  {'✅' if ok else '❌'}  [{got:>4}]  {desc}")

        print(f"\n  {'TOUS CORRECTS ✅' if ok_all else 'ERREURS DÉTECTÉES ❌'}")

        # Test HadithSearcher
        print(f"\n{LINE}")
        print("  Test HadithSearcher — requête : 'الأعمال بالنيات'")
        print(LINE)
        async with HadithSearcher() as searcher:
            results = await searcher.search("الأعمال بالنيات", max_results=2)
        print(f"  Résultats : {len(results)}")
        for r in results:
            ar = r.get("arabic_text", "")[:80]
            print(f"  • [{r.get('grade', '?')}] {ar}…")

    asyncio.run(_demo())
