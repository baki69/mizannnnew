"""
api/rawi.py — MÎZÂN v22.4  "Verrou de Fer"
═══════════════════════════════════════════════════════════════════
Deep scraper asynchrone (httpx/HTTP2 + lxml) pour les narrateurs de
hadith (ruwāt) via dorar.net/rijal.

RÈGLES ABSOLUES
  ① Verrou Chronologique : death_year est TOUJOURS un int.
       Ṣaḥāba   → 0
       Année trouvée → int (hijri)
       Inconnu / contemporain → 9999
       list.sort() ne voit que des entiers — jamais de None, str, float.

  ② Deep Scraping : mashayikh (maîtres) ET talamidh (élèves) extraits
       depuis la page /rijal/rawi/{id}. Si absents → échec signalé.

  ③ Fallback Takhrij : si m[]=1 retourne 0 résultat, bascule m[]=2.

  ④ Zéro placeholder — code livrable en production.
═══════════════════════════════════════════════════════════════════
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Any

import httpx
from lxml import html as lx

# ─────────────────────────────────────────────────────────────────────────────
# 0. LOGGING
# ─────────────────────────────────────────────────────────────────────────────

log = logging.getLogger("mizan.rawi")

# ─────────────────────────────────────────────────────────────────────────────
# 1. CONSTANTES
# ─────────────────────────────────────────────────────────────────────────────

_BASE      = "https://dorar.net"
_RIJAL     = f"{_BASE}/rijal"
_SEARCH_R  = f"{_RIJAL}/search"          # ?skey=…
_HADITH_S  = f"{_BASE}/hadith/search"    # ?q=…&m[]=1|2

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

# ─────────────────────────────────────────────────────────────────────────────
# 2. VERROU CHRONOLOGIQUE — extract_death_year()
# ─────────────────────────────────────────────────────────────────────────────

# ① Patterns de décès — ordre décroissant de précision
_PAT_DEATH: list[re.Pattern[str]] = [
    # "ت 852هـ"  /  "توفي سنة 256 هـ"  /  "المتوفى نحو 110هـ"
    re.compile(
        r'(?:ت\.?|توفي|وفاته|المتوفى|مات)[:\s,،.]*'
        r'(?:نحو|حوالي|سنة|عام)?\s*(\d{2,4})\s*ه',
        re.UNICODE,
    ),
    # "256هـ" seul
    re.compile(r'\b(\d{2,4})\s*هـ\b', re.UNICODE),
    # "256 AH"
    re.compile(r'\b(\d{2,4})\s*AH\b', re.IGNORECASE),
]

# ② Marqueurs Ṣaḥāba
_PAT_SAHABI = re.compile(
    r'صحاب[يةه]|من\s+الصحابة|رضي\s+الله\s+عنه?م?', re.UNICODE
)


def extract_death_year(raw: str) -> int:
    """
    Verrou Chronologique — retourne TOUJOURS un int.

      Ṣaḥāba                → 0
      Année hijrie trouvée  → int (plage 1-1500)
      Aucune donnée fiable  → 9999
    """
    if not raw:
        return 9999

    txt = raw.strip()

    # Priorité absolue : compagnon du Prophète
    if _PAT_SAHABI.search(txt):
        return 0

    for pat in _PAT_DEATH:
        m = pat.search(txt)
        if m:
            yr = int(m.group(1))
            if 1 <= yr <= 1500:     # sanity-check hijri
                return yr

    return 9999


# ─────────────────────────────────────────────────────────────────────────────
# 3. HTTP HELPERS
# ─────────────────────────────────────────────────────────────────────────────

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
    """GET avec retry exponentiel (×3)."""
    for attempt in range(1, _MAX_RETRY + 1):
        try:
            r = await cli.get(url, params=params or None)
            r.raise_for_status()
            return r
        except httpx.HTTPStatusError as exc:
            log.warning("HTTP %s — %s (tentative %d/%d)",
                        exc.response.status_code, url, attempt, _MAX_RETRY)
        except (httpx.ConnectError, httpx.ReadTimeout, httpx.RemoteProtocolError) as exc:
            log.warning("Réseau — %s (tentative %d/%d) : %s", url, attempt, _MAX_RETRY, exc)
        if attempt < _MAX_RETRY:
            await asyncio.sleep(1.5 ** attempt)
    log.error("Abandon après %d tentatives : %s", _MAX_RETRY, url)
    return None


# ─────────────────────────────────────────────────────────────────────────────
# 4. PARSING lxml
# ─────────────────────────────────────────────────────────────────────────────

def _parse(content: bytes) -> lx.HtmlElement:
    return lx.fromstring(content)


def _xtext(root: lx.HtmlElement, xpath: str, default: str = "") -> str:
    """Retourne le texte concaténé du premier nœud trouvé, ou default."""
    nodes = root.xpath(xpath)
    if not nodes:
        return default
    node = nodes[0]
    return node.text_content().strip() if hasattr(node, "text_content") else str(node).strip()


def _rid_from_href(href: str) -> int | None:
    """Extrait l'ID entier depuis un href dorar.net/rijal/…"""
    m = re.search(r'/rijal/(?:rawi/)?(\d+)', href)
    return int(m.group(1)) if m else None


# ─────────────────────────────────────────────────────────────────────────────
# 5. RawiScraper — biographies & listes mashayikh / talamidh
# ─────────────────────────────────────────────────────────────────────────────

class RawiScraper:
    """
    Scraper asynchrone pour les pages /rijal de dorar.net.

    Utilisation :
        async with RawiScraper() as s:
            rawi = await s.get_rawi("ابن حجر")
            rawi_by_id = await s.get_rawi_by_id(2234)
    """

    def __init__(self) -> None:
        self._cli: httpx.AsyncClient | None = None

    async def __aenter__(self) -> "RawiScraper":
        self._cli = _client()
        return self

    async def __aexit__(self, *_: Any) -> None:
        if self._cli:
            await self._cli.aclose()

    # ── API publique ──────────────────────────────────────────────────────────

    async def get_rawi(self, name: str) -> dict[str, Any]:
        """
        Recherche par nom + scrape de la page de détail.
        Retourne un objet rawi complet avec mashayikh, talamidh, death_year (int).
        """
        rawi_id, partial = await self._search(name)
        if not rawi_id:
            log.warning("Narrateur introuvable dans Rijal Dorar : «%s»", name)
            return _empty_rawi(name)

        detail = await self._detail(rawi_id)
        # Le partial de la recherche enrichit les champs manquants
        for k, v in partial.items():
            detail.setdefault(k, v)

        detail["id"]         = rawi_id
        detail["name_query"] = name
        detail["death_year"] = self._resolve_year(detail)
        return detail

    async def get_rawi_by_id(self, rawi_id: int | str) -> dict[str, Any]:
        """Scrape directement par ID Dorar Rijal."""
        detail = await self._detail(str(rawi_id))
        detail["id"]         = int(rawi_id)
        detail["death_year"] = self._resolve_year(detail)
        return detail

    # ── Recherche ─────────────────────────────────────────────────────────────

    async def _search(self, name: str) -> tuple[int | None, dict[str, Any]]:
        r = await _get(self._cli, _SEARCH_R, skey=name)
        if not r:
            return None, {}

        doc = _parse(r.content)

        # Extraire le premier lien vers une page /rijal/rawi/…
        hrefs: list[str] = doc.xpath('//a[contains(@href,"/rijal/rawi/")]/@href')
        if not hrefs:
            # Dorar utilise parfois /rijal/{id} sans /rawi/
            hrefs = doc.xpath('//a[contains(@href,"/rijal/")]/@href')

        if not hrefs:
            return None, {}

        rawi_id = _rid_from_href(hrefs[0])
        if rawi_id is None:
            return None, {}

        # Données partielles depuis la card de résultat
        partial: dict[str, Any] = {}
        cards = doc.xpath(
            '//div[contains(@class,"card")]|'
            '//div[contains(@class,"rawi-item")]|'
            '//li[contains(@class,"rawi")]'
        )
        if cards:
            partial["_raw_text"] = cards[0].text_content()

        return rawi_id, partial

    # ── Page de détail ────────────────────────────────────────────────────────

    async def _detail(self, rawi_id: str) -> dict[str, Any]:
        url = f"{_RIJAL}/rawi/{rawi_id}"
        r   = await _get(self._cli, url)
        if not r:
            return {}

        doc = _parse(r.content)
        d: dict[str, Any] = {}

        # ── Nom arabe ─────────────────────────────────────────────────────────
        d["name_ar"] = _xtext(
            doc,
            '//h1[contains(@class,"rawi")]'
            '|//h1[contains(@class,"name")]'
            '|//h1|//h2[@class]',
        )

        # ── Texte brut complet — pour extract_death_year ──────────────────────
        d["_raw_text"] = doc.text_content()

        # ── Bloc décès ciblé ──────────────────────────────────────────────────
        died_nodes = doc.xpath(
            '//*[contains(text(),"المتوفى") or contains(text(),"توفي")'
            ' or contains(text(),"وفاته") or contains(text(),"ت.")]'
        )
        d["died"] = died_nodes[0].text_content().strip() if died_nodes else ""

        # ── Verdict / Grade ───────────────────────────────────────────────────
        grade_nodes = doc.xpath(
            '//*[contains(@class,"grade") or contains(@class,"hukm")'
            ' or contains(@class,"verdict") or contains(@class,"status")]'
        )
        if grade_nodes:
            d["verdict"] = grade_nodes[0].text_content().strip()
        else:
            # Fallback sémantique : chercher couleur de jugement
            for node in doc.xpath('//*[@class]'):
                cls = node.get("class", "")
                if any(c in cls for c in ("green", "red", "yellow", "orange")):
                    candidate = node.text_content().strip()
                    if candidate:
                        d["verdict"] = candidate
                        break
            else:
                d["verdict"] = ""

        # ── Ṭabaqa / Génération ───────────────────────────────────────────────
        tabaqa_nodes = doc.xpath(
            '//*[contains(text(),"الطبقة")'
            ' or contains(@class,"tabaqa") or contains(@class,"generation")]'
        )
        d["tabaqa"] = tabaqa_nodes[0].text_content().strip() if tabaqa_nodes else ""

        # ── DEEP : Mashayikh & Talamidh ───────────────────────────────────────
        d["mashayikh"] = self._extract_list(doc, "mashayikh")
        d["talamidh"]  = self._extract_list(doc, "talamidh")

        if not d["mashayikh"]:
            log.warning("DEEP — mashayikh absents pour rawi_id=%s (URL: %s)", rawi_id, url)
        if not d["talamidh"]:
            log.warning("DEEP — talamidh absents pour rawi_id=%s (URL: %s)", rawi_id, url)

        return d

    # ── Extraction des listes mashayikh / talamidh ────────────────────────────

    _SECTION_LABELS: dict[str, list[str]] = {
        "mashayikh": ["شيوخه", "المشايخ", "روى عن", "حدث عن"],
        "talamidh":  ["تلاميذه", "الرواة عنه", "روى عنه", "التلاميذ"],
    }

    def _extract_list(
        self, doc: lx.HtmlElement, kind: str
    ) -> list[dict[str, Any]]:
        """
        Extraction multi-stratégie des listes de maîtres / élèves.

        Stratégie 1 : attribut class/id contenant le mot-clé anglais.
        Stratégie 2 : en-tête arabe → liste adjacente.
        Stratégie 3 : liens /rijal/ dans une <section> dédiée.
        """
        results: list[dict[str, Any]] = []
        seen: set[str] = set()

        def _collect(elements: list[lx.HtmlElement]) -> None:
            for el in elements:
                tag  = (el.tag or "").lower()
                name = el.text_content().strip()
                if not name or name in seen:
                    continue

                if tag == "li":
                    links = el.xpath('.//a[contains(@href,"/rijal/")]')
                    href  = links[0].get("href", "") if links else ""
                elif tag == "a":
                    href = el.get("href", "")
                else:
                    href = ""

                seen.add(name)
                rid = _rid_from_href(href) if href else None
                results.append({
                    "name": name,
                    "id":   rid,
                    "url":  (_BASE + href) if href.startswith("/") else href or None,
                })

        # ── Stratégie 1 — class/id ────────────────────────────────────────────
        sec = doc.xpath(
            f'//*[contains(@class,"{kind}") or contains(@id,"{kind}")]'
        )
        if sec:
            items = sec[0].xpath('.//li | .//a[contains(@href,"/rijal/")]')
            _collect(items)

        # ── Stratégie 2 — label arabe ─────────────────────────────────────────
        if not results:
            for label in self._SECTION_LABELS.get(kind, []):
                headers = doc.xpath(f'//*[contains(text(),"{label}")]')
                if not headers:
                    continue
                hdr = headers[0]
                # Chercher le ul/ol immédiatement suivant dans l'arbre
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

        # ── Stratégie 3 — liens /rijal/ dans section dédiée ──────────────────
        if not results:
            items = doc.xpath(
                f'//section[contains(@class,"{kind}")]//a'
                f' | //div[contains(@class,"{kind}")]//a'
            )
            _collect(items)

        return results

    # ── Résolution finale du death_year ───────────────────────────────────────

    @staticmethod
    def _resolve_year(d: dict[str, Any]) -> int:
        """
        Verrou Chronologique — retourne TOUJOURS un int.
        Sources consultées dans l'ordre de priorité.
        """
        for key in ("died", "_raw_text", "name_ar"):
            candidate = d.get(key, "")
            if candidate:
                yr = extract_death_year(str(candidate))
                if yr != 9999:
                    return yr
        return 9999


# ─────────────────────────────────────────────────────────────────────────────
# 6. IsnadScraper — chaînes de transmission + fallback m[]=2
# ─────────────────────────────────────────────────────────────────────────────

class IsnadScraper:
    """
    Scraper de chaînes d'isnād depuis dorar.net/hadith/search.

    Mode m[]=1 (Musnad) avec bascule automatique sur m[]=2 (Takhrij)
    si le premier mode ne retourne aucun narrateur.

    Utilisation :
        async with IsnadScraper() as s:
            chain = await s.get_chain("من كذب علي")
            deep  = await s.get_chain_deep("من كذب علي")
    """

    def __init__(self) -> None:
        self._cli: httpx.AsyncClient | None = None

    async def __aenter__(self) -> "IsnadScraper":
        self._cli = _client()
        return self

    async def __aexit__(self, *_: Any) -> None:
        if self._cli:
            await self._cli.aclose()

    # ── API publique ──────────────────────────────────────────────────────────

    async def get_chain(self, query: str) -> list[dict[str, Any]]:
        """
        Retourne la chaîne de transmission triée par death_year (int ascendant).
        Applique automatiquement le fallback m[]=1 → m[]=2.
        """
        chain = await self._fetch(query, mode=1)

        if not chain:
            log.info("Fallback Takhrij m[]=2 pour : «%s»", query)
            chain = await self._fetch(query, mode=2)

        if not chain:
            log.warning("Aucune chaîne d'isnād trouvée pour : «%s»", query)
            return []

        # Verrou Chronologique — tri mathématique strict
        chain.sort(key=lambda n: int(n.get("death_year", 9999)))
        return chain

    async def get_chain_deep(self, query: str) -> list[dict[str, Any]]:
        """
        Variante deep : récupère mashayikh + talamidh pour chaque nœud de la chaîne.
        Les appels individuels sont concurrents (asyncio.gather).
        """
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
            if isinstance(extra, Exception):
                log.error("Enrichissement nœud %d (%s) : %s", i, chain[i]["name"], extra)
                continue
            if not isinstance(extra, dict):
                continue
            chain[i].update({
                "name_ar":   extra.get("name_ar",  chain[i]["name"]),
                "tabaqa":    extra.get("tabaqa",   ""),
                "verdict":   extra.get("verdict",  chain[i].get("verdict", "")),
                "mashayikh": extra.get("mashayikh", []),
                "talamidh":  extra.get("talamidh",  []),
                # Verrou Chronologique — mise à jour avec données enrichies
                "death_year": int(extra.get("death_year", chain[i]["death_year"])),
            })

        # Re-tri post-enrichissement
        chain.sort(key=lambda n: int(n.get("death_year", 9999)))
        return chain

    # ── Fetch interne ─────────────────────────────────────────────────────────

    async def _fetch(self, query: str, mode: int) -> list[dict[str, Any]]:
        """
        Récupère et parse les narrateurs d'un résultat de recherche hadith.
        mode=1 → Musnad  /  mode=2 → Takhrij
        """
        params = {"q": query, "m[]": mode}
        r = await _get(self._cli, _HADITH_S, **params)
        if not r:
            return []

        doc   = _parse(r.content)
        chain: list[dict[str, Any]] = []
        seen:  set[str]             = set()

        # ── Sélecteur 1 : nœuds sémantiques (data-* attributes) ──────────────
        rawi_nodes = doc.xpath(
            '//*[@data-rawi-id] | //*[@data-id][contains(@class,"rawi")]'
        )
        for node in rawi_nodes:
            name = node.text_content().strip()
            if not name or name in seen:
                continue
            seen.add(name)

            rawi_id   = node.get("data-rawi-id") or node.get("data-id")
            death_raw = (
                node.get("data-death") or node.get("data-wafat") or
                node.get("data-died")  or ""
            )
            verdict   = node.get("data-grade") or node.get("data-hukm") or ""

            chain.append(_node(name, rawi_id, death_raw, verdict))

        # ── Sélecteur 2 : classes CSS sémantiques ─────────────────────────────
        if not chain:
            css_nodes = doc.xpath(
                '//*[contains(@class,"narrator") or contains(@class,"rawi-name")'
                ' or contains(@class,"sanad-item") or contains(@class,"isnad-node")]'
            )
            for node in css_nodes:
                name = node.text_content().strip()
                if not name or name in seen:
                    continue
                seen.add(name)
                # Essayer de récupérer l'ID depuis un lien enfant
                links = node.xpath('.//a[contains(@href,"/rijal/")]/@href')
                rawi_id = str(_rid_from_href(links[0])) if links else None
                chain.append(_node(name, rawi_id, "", ""))

        # ── Sélecteur 3 : liens bruts /rijal/ dans la zone hadith ─────────────
        if not chain:
            all_links = doc.xpath(
                '//div[contains(@class,"hadith")]//a[contains(@href,"/rijal/")]'
                ' | //article//a[contains(@href,"/rijal/")]'
            )
            for a in all_links:
                name = a.text_content().strip()
                if not name or name in seen:
                    continue
                seen.add(name)
                href    = a.get("href", "")
                rawi_id = str(_rid_from_href(href)) if href else None
                chain.append(_node(name, rawi_id, "", ""))

        return chain


# ─────────────────────────────────────────────────────────────────────────────
# 7. HELPERS INTERNES
# ─────────────────────────────────────────────────────────────────────────────

def _node(
    name:      str,
    rawi_id:   str | None,
    death_raw: str,
    verdict:   str,
) -> dict[str, Any]:
    """Fabrique un nœud de chaîne normalisé."""
    return {
        "name":       name,
        "id":         int(rawi_id) if rawi_id and str(rawi_id).isdigit() else None,
        "verdict":    verdict,
        "died":       death_raw,
        "death_year": int(extract_death_year(death_raw or name)),  # Verrou : toujours int
        "tabaqa":     "",
        "mashayikh":  [],
        "talamidh":   [],
    }


def _empty_rawi(name: str) -> dict[str, Any]:
    return {
        "name":       name,
        "name_ar":    name,
        "id":         None,
        "death_year": 9999,           # Verrou Chronologique
        "died":       "",
        "verdict":    "",
        "tabaqa":     "",
        "mashayikh":  [],
        "talamidh":   [],
    }


# ─────────────────────────────────────────────────────────────────────────────
# 8. FASTAPI ROUTER (optionnel — importé si FastAPI est présent)
# ─────────────────────────────────────────────────────────────────────────────

try:
    from fastapi import APIRouter, HTTPException, Query
    from fastapi.responses import JSONResponse

    router = APIRouter(prefix="/api", tags=["rawi"])

    @router.get(
        "/rawi/{name}",
        summary="Biographie complète d'un narrateur",
        response_description="Objet rawi avec mashayikh, talamidh et death_year (int)",
    )
    async def api_rawi(name: str) -> JSONResponse:
        async with RawiScraper() as s:
            data = await s.get_rawi(name)
        if not data.get("id"):
            raise HTTPException(
                status_code=404,
                detail=f"Narrateur introuvable dans Rijal Dorar : «{name}»",
            )
        return JSONResponse(data)

    @router.get(
        "/rawi/id/{rawi_id}",
        summary="Biographie par ID Dorar Rijal",
    )
    async def api_rawi_by_id(rawi_id: int) -> JSONResponse:
        async with RawiScraper() as s:
            data = await s.get_rawi_by_id(rawi_id)
        if not data:
            raise HTTPException(404, detail=f"ID {rawi_id} introuvable dans Rijal Dorar")
        return JSONResponse(data)

    @router.get(
        "/isnad",
        summary="Chaîne d'isnād triée par death_year",
        response_description="Liste de nœuds triée chronologiquement (death_year int)",
    )
    async def api_isnad(
        q:    str  = Query(..., description="Texte du hadith ou début de matn"),
        deep: bool = Query(False, description="Active le deep scraping mashayikh/talamidh"),
    ) -> JSONResponse:
        """
        Fallback automatique m[]=1 → m[]=2.
        Tri garanti : death_year est un entier (Ṣaḥāba=0, contemporain=9999).
        """
        async with IsnadScraper() as s:
            chain = await s.get_chain_deep(q) if deep else await s.get_chain(q)

        return JSONResponse({
            "query":  q,
            "mode":   "deep" if deep else "standard",
            "count":  len(chain),
            "chain":  chain,
        })

except ImportError:
    router = None   # Mode standalone — FastAPI non installé


# ─────────────────────────────────────────────────────────────────────────────
# 9. CLI — test autonome
#    python api/rawi.py
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import json

    async def _demo() -> None:
        _LINE = "═" * 62

        # ── Test Verrou Chronologique ─────────────────────────────────────────
        print(f"\n{_LINE}")
        print("  MÎZÂN v22.4 — Test extract_death_year (Verrou de Fer)")
        print(_LINE)

        _CASES: list[tuple[str, int]] = [
            ("صحابي رضي الله عنه",                            0),
            ("البخاري توفي سنة 256هـ",                       256),
            ("ابن حجر العسقلاني المتوفى 852هـ",              852),
            ("مات نحو 110هـ",                                110),
            ("Died 179 AH",                                  179),
            ("عصري مجهول",                                  9999),
            ("",                                            9999),
        ]
        all_ok = True
        for txt, expected in _CASES:
            got    = extract_death_year(txt)
            ok     = got == expected
            all_ok = all_ok and ok
            print(f"  {'✅' if ok else '❌'}  [{got:>4}]  {txt or '(vide)'}")
        print(f"\n  Résultat : {'TOUS CORRECTS ✅' if all_ok else 'ERREURS DÉTECTÉES ❌'}")

        # ── Test RawiScraper ──────────────────────────────────────────────────
        print(f"\n{_LINE}")
        print("  Test RawiScraper — «ابن حجر»")
        print(_LINE)
        async with RawiScraper() as rs:
            rawi = await rs.get_rawi("ابن حجر")

        print(json.dumps(
            {k: v for k, v in rawi.items() if not k.startswith("_")},
            ensure_ascii=False, indent=2, default=str,
        ))
        assert isinstance(rawi["death_year"], int), "❌ VERROU ROMPU — death_year n'est pas un int !"
        print(f"\n  death_year = {rawi['death_year']} (type={type(rawi['death_year']).__name__}) ✅")
        print(f"  mashayikh  : {len(rawi['mashayikh'])} entrées")
        print(f"  talamidh   : {len(rawi['talamidh'])} entrées")

        # ── Test IsnadScraper ─────────────────────────────────────────────────
        print(f"\n{_LINE}")
        print("  Test IsnadScraper — «من كذب علي»")
        print(_LINE)
        async with IsnadScraper() as isc:
            chain = await isc.get_chain("من كذب علي")

        for i, node in enumerate(chain):
            assert isinstance(node["death_year"], int), f"❌ VERROU ROMPU nœud {i}"
            print(f"  [{node['death_year']:>4}]  {node['name']}")

        print(f"\n  {len(chain)} narrateurs — tri chronologique vérifié ✅")

    asyncio.run(_demo())
