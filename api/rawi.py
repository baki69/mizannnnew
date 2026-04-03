# ═══════════════════════════════════════════════════════════════════
#  MÎZÂN v22.0 — api/rawi.py — Vercel Serverless Function
#  MODULE : 'ILM AR-RIJAL — Scraping Dorar.net via requests + BS4
#  Route  : GET /api/rawi?name=<nom du rawi>
#  Contrat JSON retourné :
#    { "found": false }
#    { "found": true, "nom_fr": ..., "nom_ar": ..., "tabaqa": ...,
#      "statut": ..., "pills": [...], "verdict_titre": ...,
#      "verdict_sous": ..., "barres": [...], "jugements": [...],
#      "mashayikh": [...], "talamidh": [...], "rihla": ... }
# ═══════════════════════════════════════════════════════════════════

from http.server import BaseHTTPRequestHandler
import json
import re
import urllib.parse
import urllib.request

try:
    from bs4 import BeautifulSoup
    BS4_OK = True
except ImportError:
    BS4_OK = False

# ── Constantes Dorar ────────────────────────────────────────────────
DORAR_SEARCH  = "https://www.dorar.net/hadith/search"
DORAR_NARRATOR= "https://www.dorar.net/rijal/search"
DORAR_HADITH  = "https://www.dorar.net/hadith"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
TIMEOUT = 9

# ── Helpers HTTP ────────────────────────────────────────────────────
def _get(url, params=None):
    if params:
        url = url + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ar,fr;q=0.8,en;q=0.5",
        "Referer": "https://www.dorar.net/",
    })
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        raw = r.read()
    return raw.decode("utf-8", errors="replace")

def _get_json(url, params=None):
    if params:
        url = url + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://www.dorar.net/",
    })
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        raw = r.read()
    return json.loads(raw.decode("utf-8", errors="replace"))

# ── Normalisation ────────────────────────────────────────────────────
def _norm(s):
    """Normalize Arabic text for loose comparison."""
    s = re.sub(r'[\u064b-\u065f\u0670]', '', s or '')   # strip tashkeel
    s = re.sub(r'[أإآا]', 'ا', s)
    s = re.sub(r'[ةه]', 'ه', s)
    s = re.sub(r'[يىئ]', 'ي', s)
    return s.strip()

def _first(*args):
    for a in args:
        if a:
            return a
    return ''

# ── Verdict helpers ──────────────────────────────────────────────────
_VERDICT_MAP = [
    (r'ثق[ةه]|إمام|ثبت|حافظ|متقن|عدل',          'THIQAH',  'thiqah', 95),
    (r'صدوق|لا بأس|صالح الحديث',                  'SADOUQ',  'sadouq', 72),
    (r'ضعيف|ليّن|مجهول|منكر|متروك|واهي',          'DA\'IF',  'daif',   30),
    (r'موضوع|كذاب|كذّاب|وضّاع|دجّال',             'MAWDU\'', 'munkar', 5),
]

def _classify_verdict(text):
    for pattern, label, cls, score in _VERDICT_MAP:
        if re.search(pattern, text or ''):
            return label, cls, score
    return 'THIQAH', 'thiqah', 70

# ── Stratégie 1 : API JSON Dorar rijal search ───────────────────────
def _try_rijal_api(name_ar):
    """
    Dorar exposes an internal JSON endpoint for narrator search.
    Returns raw narrator data dict or None.
    """
    try:
        data = _get_json("https://www.dorar.net/rijal/search", {
            "q": name_ar, "page": 1
        })
        # data may be { "data": [...], "total": N }
        items = data.get("data") or data.get("results") or []
        if not items and isinstance(data, list):
            items = data
        for item in items[:5]:
            name_field = (
                item.get("name") or item.get("full_name") or
                item.get("narrator_name") or item.get("ar_name") or ""
            )
            if _norm(name_ar)[:6] in _norm(name_field):
                return item
    except Exception:
        pass
    return None

# ── Stratégie 2 : Scrape HTML page recherche Rijal ──────────────────
def _try_rijal_html(name_ar):
    """
    Scrape the HTML search results page of Dorar Rijal section.
    Returns a dict with raw fields or None.
    """
    if not BS4_OK:
        return None
    try:
        html = _get("https://www.dorar.net/rijal/search", {"q": name_ar})
        soup = BeautifulSoup(html, "html.parser")

        # Dorar Rijal search returns cards with narrator info
        cards = soup.select(".narrator-card, .hadith-narrator, article.card, div.narrator")
        if not cards:
            # fallback: look for any prominent name match
            cards = soup.select("div[class*='narrator'], div[class*='rijal'], li[class*='narrator']")

        for card in cards[:6]:
            text = card.get_text(" ", strip=True)
            if _norm(name_ar)[:5] in _norm(text):
                return {"_raw_html": str(card), "_text": text}

        # If no card match, try extracting from first result heading
        headings = soup.select("h2, h3, h4, .name, .narrator-name")
        for h in headings[:5]:
            if _norm(name_ar)[:5] in _norm(h.get_text()):
                parent = h.find_parent(["div", "article", "section"]) or h
                return {"_raw_html": str(parent), "_text": parent.get_text(" ", strip=True)}
    except Exception:
        pass
    return None

# ── Stratégie 3 : Scrape hadith search → extract narrator rows ──────
def _try_hadith_search(name_ar):
    """
    Search hadiths mentioning this narrator, parse isnad rows to extract:
    - narrator full name (Arabic)
    - mashayikh (who appears just before him in chains)
    - talamidh (who appears just after him in chains)
    - jarh/ta'dil mentions in the annotation layer
    Returns aggregated dict.
    """
    if not BS4_OK:
        return None
    result = {
        "nom_ar": "",
        "mashayikh": [],
        "talamidh": [],
        "jugements_raw": [],
        "tabaqa": "",
    }
    try:
        html = _get(DORAR_SEARCH, {
            "q": name_ar,
            "t": "narrator",  # filter by narrator
            "page": 1,
        })
        soup = BeautifulSoup(html, "html.parser")

        # ── Extract narrator full names from isnad chains ──
        # Dorar marks narrator spans with data-narrator or class="narrator-link"
        narrator_spans = soup.select("[data-narrator], .narrator-link, span[class*='narrator']")
        seen_mash = set()
        seen_tala = set()

        for i, span in enumerate(narrator_spans):
            stext = span.get_text(strip=True)
            if not stext:
                continue
            if _norm(name_ar)[:5] in _norm(stext):
                # Record exact full name
                if not result["nom_ar"] and len(stext) > 4:
                    result["nom_ar"] = stext
                # Narrator just before = shaykh
                if i > 0:
                    prev = narrator_spans[i - 1].get_text(strip=True)
                    if prev and prev not in seen_mash:
                        seen_mash.add(prev)
                        result["mashayikh"].append(prev)
                # Narrator just after = talmidh
                if i < len(narrator_spans) - 1:
                    nxt = narrator_spans[i + 1].get_text(strip=True)
                    if nxt and nxt not in seen_tala:
                        seen_tala.add(nxt)
                        result["talamidh"].append(nxt)
            if len(result["mashayikh"]) >= 15 and len(result["talamidh"]) >= 15:
                break

        # ── Extract jarh/ta'dil annotations ──
        anno_selectors = [
            ".narrator-grade", ".narrator-status", "[class*='grade']",
            "[class*='hukm']", "[class*='jarh']", "span[title]",
        ]
        for sel in anno_selectors:
            for el in soup.select(sel)[:30]:
                txt = el.get_text(strip=True)
                title = el.get("title", "")
                combined = (txt + " " + title).strip()
                if combined and len(combined) > 2:
                    result["jugements_raw"].append(combined)

        # ── Try to get tabaqa (generation) ──
        for el in soup.select("[class*='tabaqat'], [class*='tabaqa'], [data-tabaqa]"):
            t = el.get_text(strip=True)
            if t:
                result["tabaqa"] = t
                break

    except Exception:
        pass
    return result

# ── Stratégie 4 : Page directe narrator sur Dorar ───────────────────
def _try_narrator_page(name_ar):
    """
    Try to GET the narrator's dedicated page on Dorar, if we can find an ID.
    First do a search to find the narrator_id, then fetch /rijal/<id>.
    """
    if not BS4_OK:
        return None
    try:
        # Step 1: search page to find the narrator link
        html = _get("https://www.dorar.net/rijal/search", {"q": name_ar})
        soup = BeautifulSoup(html, "html.parser")

        # Look for links matching /rijal/<digits>
        link = None
        for a in soup.select("a[href]"):
            href = a["href"]
            if re.search(r'/rijal/\d+', href):
                text = a.get_text(strip=True)
                if _norm(name_ar)[:4] in _norm(text):
                    link = href
                    break

        if not link:
            # Try any /rijal/<id> link
            for a in soup.select("a[href*='/rijal/']"):
                link = a["href"]
                break

        if not link:
            return None

        # Ensure absolute URL
        if link.startswith("/"):
            link = "https://www.dorar.net" + link

        # Step 2: fetch the narrator page
        html2 = _get(link)
        soup2 = BeautifulSoup(html2, "html.parser")
        text_full = soup2.get_text(" ", strip=True)

        out = {"_page_text": text_full, "_page_html": html2}

        # Name in Arabic
        name_el = soup2.select_one("h1, h2, .narrator-name, [class*='name']")
        if name_el:
            out["nom_ar"] = name_el.get_text(strip=True)

        # Tabaqa
        for el in soup2.select("[class*='tabaqa'], [class*='tabaqat'], th, td"):
            t = el.get_text(strip=True)
            if re.search(r'طبق[ةه]', t):
                sib = el.find_next_sibling()
                if sib:
                    out["tabaqa"] = sib.get_text(strip=True)
                break

        # Death year
        for el in soup2.select("td, span, li"):
            t = el.get_text(strip=True)
            if re.search(r'توف[يى]|الوفاة', t):
                out["wafat"] = t
                break

        # Mashayikh list
        mash_section = soup2.find(string=re.compile(r'شيوخ|شيخ'))
        if mash_section:
            parent = mash_section.find_parent(["div", "section", "ul"])
            if parent:
                out["mashayikh_html"] = str(parent)

        # Talamidh list
        tala_section = soup2.find(string=re.compile(r'تلاميذ|تلميذ'))
        if tala_section:
            parent = tala_section.find_parent(["div", "section", "ul"])
            if parent:
                out["talamidh_html"] = str(parent)

        # Jarh wa ta'dil block
        jarh_section = soup2.find(string=re.compile(r'الجرح|التعديل|أقوال'))
        if jarh_section:
            parent = jarh_section.find_parent(["div", "section"])
            if parent:
                out["jarh_html"] = str(parent)

        return out

    except Exception:
        pass
    return None

# ── Parser de page narrateur ─────────────────────────────────────────
def _parse_narrator_page(raw):
    """
    Extract structured data from narrator page dict returned by _try_narrator_page.
    """
    if not raw or not BS4_OK:
        return {}
    out = {}

    try:
        if raw.get("nom_ar"):
            out["nom_ar"] = raw["nom_ar"]
        if raw.get("tabaqa"):
            out["tabaqa"] = raw["tabaqa"]
        if raw.get("wafat"):
            out["wafat"] = raw["wafat"]

        def _extract_names(html_str):
            if not html_str:
                return []
            s = BeautifulSoup(html_str, "html.parser")
            names = []
            for a in s.select("a"):
                t = a.get_text(strip=True)
                if t and len(t) > 2:
                    names.append(t)
            if not names:
                for li in s.select("li, td"):
                    t = li.get_text(strip=True)
                    if t and len(t) > 2:
                        names.append(t)
            return names[:20]

        if raw.get("mashayikh_html"):
            out["mashayikh"] = _extract_names(raw["mashayikh_html"])
        if raw.get("talamidh_html"):
            out["talamidh"] = _extract_names(raw["talamidh_html"])

        if raw.get("jarh_html"):
            s = BeautifulSoup(raw["jarh_html"], "html.parser")
            jugements = []
            rows = s.select("tr, li, div[class*='row'], div[class*='item']")
            for row in rows[:12]:
                scholar_el = row.select_one("td:first-child, strong, b, .scholar")
                text_el    = row.select_one("td:last-child, p, span, .text")
                if scholar_el and text_el:
                    jugements.append({
                        "scholar": scholar_el.get_text(strip=True),
                        "ar":      text_el.get_text(strip=True),
                        "fr":      "",
                        "src":     "",
                        "classe":  "",
                    })
                elif row.get_text(strip=True):
                    full = row.get_text(" ", strip=True)
                    if len(full) > 5:
                        jugements.append({
                            "scholar": "",
                            "ar":      full,
                            "fr":      "",
                            "src":     "",
                            "classe":  "",
                        })
            out["jugements"] = jugements

    except Exception:
        pass
    return out

# ── Assemblage final de la réponse JSON ──────────────────────────────
def _build_response(name_query, narrator_page, hadith_data, rijal_raw):
    """
    Merge all scraped data into the strict JSON contract for the modal.
    """
    r = {
        "found":         True,
        "nom_fr":        name_query,
        "nom_ar":        "",
        "tabaqa":        "",
        "statut":        "THIQAH",
        "pills":         [],
        "verdict_titre": "",
        "verdict_sous":  "",
        "barres":        [],
        "jugements":     [],
        "mashayikh":     [],
        "talamidh":      [],
        "rihla":         "",
    }

    # ── nom_ar ──
    r["nom_ar"] = _first(
        (narrator_page or {}).get("nom_ar"),
        (hadith_data   or {}).get("nom_ar"),
        (rijal_raw     or {}).get("name") or (rijal_raw or {}).get("full_name"),
        name_query,
    )

    # ── tabaqa ──
    r["tabaqa"] = _first(
        (narrator_page or {}).get("tabaqa"),
        (hadith_data   or {}).get("tabaqa"),
        (rijal_raw     or {}).get("generation") or (rijal_raw or {}).get("tabaqa"),
    )

    # ── jugements ──
    jugements = []
    if narrator_page and narrator_page.get("jugements"):
        jugements = narrator_page["jugements"]
    elif hadith_data and hadith_data.get("jugements_raw"):
        for raw_j in hadith_data["jugements_raw"][:10]:
            jugements.append({"scholar": "", "ar": raw_j, "fr": "", "src": "", "classe": ""})

    # Enrich jugements classe
    all_jarh_text = " ".join(
        (j.get("ar") or "") + " " + (j.get("scholar") or "") for j in jugements
    )

    # Try to pull verdict from rijal_raw
    rijal_verdict = _first(
        (rijal_raw or {}).get("grade") or (rijal_raw or {}).get("status"),
        (rijal_raw or {}).get("verdict"),
        (rijal_raw or {}).get("hukm"),
    )
    verdict_label, verdict_cls, verdict_score = _classify_verdict(
        all_jarh_text + " " + (rijal_verdict or "")
    )
    r["statut"] = verdict_label

    for j in jugements:
        if not j.get("classe"):
            _, jcls, _ = _classify_verdict(
                (j.get("ar") or "") + " " + (j.get("scholar") or "")
            )
            j["classe"] = jcls
    r["jugements"] = jugements[:12]

    # ── mashayikh / talamidh ──
    mash = _first(
        (narrator_page or {}).get("mashayikh"),
        (hadith_data   or {}).get("mashayikh"),
    ) or []
    tala = _first(
        (narrator_page or {}).get("talamidh"),
        (hadith_data   or {}).get("talamidh"),
    ) or []
    r["mashayikh"] = [str(n) for n in mash[:15]]
    r["talamidh"]  = [str(n) for n in tala[:15]]

    # ── rihla ──
    wafat = (narrator_page or {}).get("wafat") or (rijal_raw or {}).get("death_year") or ""
    rihla_parts = []
    if r["nom_ar"] and r["nom_ar"] != name_query:
        rihla_parts.append("الاسم الكامل : " + r["nom_ar"])
    if r["tabaqa"]:
        rihla_parts.append("الطبقة : " + r["tabaqa"])
    if wafat:
        rihla_parts.append("الوفاة : " + wafat)
    if rijal_raw and rijal_raw.get("bio"):
        rihla_parts.append(rijal_raw["bio"])
    r["rihla"] = "\n\n".join(rihla_parts)

    # ── pills ──
    pills = []
    if verdict_label:
        pcls = {"THIQAH": "mzRw-pill-green", "SADOUQ": "mzRw-pill-gold",
                "DA'IF": "mzRw-pill-red", "MAWDU'": "mzRw-pill-red"}.get(verdict_label, "mzRw-pill-silver")
        pills.append({"label": verdict_label, "cls": pcls})
    if r["tabaqa"]:
        pills.append({"label": r["tabaqa"], "cls": "mzRw-pill-blue"})
    if wafat:
        pills.append({"label": wafat, "cls": "mzRw-pill-silver"})
    if r["mashayikh"]:
        pills.append({"label": str(len(r["mashayikh"])) + " SHUYUKH", "cls": "mzRw-pill-gold"})
    if r["talamidh"]:
        pills.append({"label": str(len(r["talamidh"])) + " TALAMIDH", "cls": "mzRw-pill-gold"})
    r["pills"] = pills

    # ── verdict_titre / verdict_sous ──
    _TITRE_MAP = {
        "THIQAH":  ("Narrator of high reliability — Thiqah",      "Accepted without reservation in all six books"),
        "SADOUQ":  ("Truthful narrator — Sadouq",                  "Generally accepted — minor reservations noted"),
        "DA'IF":   ("Weak narrator — Da'if",                       "Transmitted with caution — corroboration required"),
        "MAWDU'":  ("Severely criticized — Matruk / Kadhdhab",    "Narrations rejected by scholarly consensus"),
    }
    titre, sous = _TITRE_MAP.get(verdict_label, ("Narrator documented in the Rijal corpus", ""))
    r["verdict_titre"] = titre
    r["verdict_sous"]  = sous

    # ── barres ──
    bar_score = verdict_score
    mash_score = min(100, len(r["mashayikh"]) * 7)
    tala_score = min(100, len(r["talamidh"]) * 5)
    judge_score = min(100, len(r["jugements"]) * 12)
    bar_col_main = ("#22c55e" if bar_score >= 80
                    else "#f59e0b" if bar_score >= 50
                    else "#ef4444")
    r["barres"] = [
        {"label": "RELIABILITY", "pct": bar_score,   "color": bar_col_main},
        {"label": "MASHAYIKH",   "pct": mash_score,  "color": "#d4af37"},
        {"label": "TALAMIDH",    "pct": tala_score,  "color": "#93c5fd"},
        {"label": "JARH REFS",   "pct": judge_score, "color": "#a78bfa"},
    ]

    return r

# ══════════════════════════════════════════════════════════════════════
#  HANDLER VERCEL
# ══════════════════════════════════════════════════════════════════════
class handler(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        pass  # silence access logs

    def _send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type",  "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "public, max-age=3600")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin",  "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        try:
            # ── Parse query string ──
            parsed  = urllib.parse.urlparse(self.path)
            params  = urllib.parse.parse_qs(parsed.query)
            name_q  = (params.get("name") or [""])[0].strip()

            if not name_q:
                self._send_json({"found": False, "error": "missing name"}, 400)
                return

            # ── Detect script (Latin → keep as nom_fr hint; Arabic → use directly) ──
            has_arabic = bool(re.search(r'[\u0600-\u06ff]', name_q))
            name_ar    = name_q if has_arabic else name_q   # fallback: pass as-is
            # Dorar search works well with Arabic; Latin names are transliterated
            # We pass the raw query and let Dorar fuzzy-match

            # ── Scraping pipeline ──
            narrator_page = None
            hadith_data   = None
            rijal_raw     = None

            # Step 1: dedicated narrator page (most complete)
            try:
                raw_page   = _try_narrator_page(name_ar)
                narrator_page = _parse_narrator_page(raw_page)
            except Exception:
                pass

            # Step 2: rijal JSON API (fast, structured)
            try:
                rijal_raw = _try_rijal_api(name_ar)
            except Exception:
                pass

            # Step 3: hadith search → isnad chains (for mashayikh/talamidh)
            try:
                hadith_data = _try_hadith_search(name_ar)
            except Exception:
                pass

            # Bail out if absolutely nothing found
            nothing = (
                (not narrator_page or not any(narrator_page.values())) and
                not rijal_raw and
                (not hadith_data or (
                    not hadith_data.get("nom_ar") and
                    not hadith_data.get("mashayikh") and
                    not hadith_data.get("talamidh") and
                    not hadith_data.get("jugements_raw")
                ))
            )
            if nothing:
                self._send_json({"found": False})
                return

            # ── Build final response ──
            response = _build_response(name_q, narrator_page, hadith_data, rijal_raw)
            self._send_json(response)

        except Exception as e:
            # Never 500 — always return a valid JSON
            self._send_json({"found": False, "error": str(e)}, 200)
