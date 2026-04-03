# ═══════════════════════════════════════════════════════════════════
#  MÎZÂN v22.4 — api/rawi.py — Vercel Serverless
#
#  PATCH AUDIT ÉLITE (v22.3 → v22.4) :
#   FIX-1  _merge_lists préserve {nom, wafat, death_year} → JSON riche
#   FIX-2  Détection HTTP 429 + Retry-After + error payload structuré
#   FIX-3  Parser lxml explicite + max_connections=4 (anti-ban Dorar)
#   FIX-4  _norm() strip honorifiques → zéro doublon chronologique
#
#  VERROU 1 — CHRONOLOGIQUE  : death_year extrait + tri list.sort()
#  VERROU 2 — PROFONDEUR     : fallback Takhrij automatique (m[]=2)
#  VERROU 3 — VITESSE        : httpx.AsyncClient + asyncio.gather()
#  Route : GET /api/rawi?name=<nom>
# ═══════════════════════════════════════════════════════════════════

from http.server import BaseHTTPRequestHandler
import asyncio, json, re, urllib.parse

try:
    import httpx
    HTTPX_OK = True
except ImportError:
    HTTPX_OK = False

try:
    from bs4 import BeautifulSoup
    BS4_OK = True
except ImportError:
    BS4_OK = False

# ── FIX-3 : parser explicite ─────────────────────────────────────────
try:
    import lxml  # noqa: F401
    _BS_PARSER = 'lxml'
except ImportError:
    _BS_PARSER = 'html.parser'   # graceful fallback

# ────────────────────────────────────────────────────────────────────
#  CONSTANTES
# ────────────────────────────────────────────────────────────────────
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
TIMEOUT   = 8.0
BASE      = "https://www.dorar.net"

HDRS_HTML = {
    "User-Agent":      UA,
    "Accept":          "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ar,fr;q=0.8,en;q=0.5",
    "Referer":         BASE + "/",
    "Connection":      "keep-alive",
}
HDRS_JSON = {
    "User-Agent":       UA,
    "Accept":           "application/json",
    "X-Requested-With": "XMLHttpRequest",
    "Referer":          BASE + "/",
}

# ────────────────────────────────────────────────────────────────────
#  VERROU 1 — CHRONOLOGIQUE : extraction death_year
# ────────────────────────────────────────────────────────────────────
_DEATH_RE     = re.compile(
    r'(?:ت|توفي|وفاته?|مات|سنة|عام|نحو|بعد|قبل)\s*:?\s*(\d{2,4})\s*[هhH]?',
    re.IGNORECASE | re.UNICODE,
)
_BARE_YEAR_RE = re.compile(r'\b(\d{3,4})\s*[هhH]\b', re.IGNORECASE)

def _extract_death_year(text):
    """
    → int hijri, 0 pour Sahabi, 9999 si inconnu (tri en dernier).
    Gère 'Inconnu', champs vides, None sans lever d'exception.
    """
    t = str(text or '')
    if not t or t in ('None', 'Inconnu', 'unknown', '-', '—'):
        return 9999
    if re.search(r'صحاب[يى]|ابن\s+صحاب', t):
        return 0
    m = _DEATH_RE.search(t)
    if m:
        yr = int(m.group(1))
        return yr if yr < 2000 else 9999   # exclure années grégoriennes parasites
    m = _BARE_YEAR_RE.search(t)
    if m:
        yr = int(m.group(1))
        return yr if yr < 2000 else 9999
    return 9999

def _sort_narrators(narrators):
    """Tri chronologique stable. Opère sur listes de dicts {nom, death_year}."""
    def _key(n):
        if isinstance(n, dict):
            combined = ' '.join(filter(None, [
                str(n.get('wafat',  '') or ''),
                str(n.get('died',   '') or ''),
                str(n.get('death_year', '') or ''),
                str(n.get('tabaqa', '') or ''),
                str(n.get('nom',    '') or ''),
            ]))
        else:
            combined = str(n)
        dy = n.get('death_year', None) if isinstance(n, dict) else None
        return dy if (dy is not None and dy != 9999) else _extract_death_year(combined)
    narrators.sort(key=_key)
    return narrators

# ────────────────────────────────────────────────────────────────────
#  FIX-4 — NORMALISATION avec strip honorifiques
#  Supprime les formules de bénédiction courantes AVANT la comparaison
#  → "أبو هريرة رضي الله عنه" == "أبو هريرة" pour la déduplication
# ────────────────────────────────────────────────────────────────────
_HONORIFICS_RE = re.compile(
    r'\s*(?:'
    r'رضي\s+الله\s+عن(?:هما|هم|هن|ها|ه)|'    # longest-first → évite ه absorbant هما
    r'رحمه\s+الله(?:\s+تعالى)?|'
    r'حفظه\s+الله(?:\s+تعالى)?|'
    r'رحمها\s+الله|'
    r'عليه\s+(?:ال)?سلام|'
    r'صلى\s+الله\s+عليه\s+وسلم|'
    r'ﷺ|'
    r'عليه\s+الصلاة\s+والسلام|'
    r'أبو\s+عبد\s+الله\s+(?=\b)'   # kunya générique isolée en fin
    r')',
    re.UNICODE,
)

def _norm(s):
    """
    FIX-4 : strip honorifiques + normalisation graphèmes arabes.
    Utilisé UNIQUEMENT pour la comparaison/déduplication, jamais pour l'affichage.
    """
    s = str(s or '')
    # 1. Supprimer les formules de bénédiction
    s = _HONORIFICS_RE.sub('', s)
    # 2. Supprimer diacritiques
    s = re.sub(r'[\u064b-\u065f\u0670\u0671]', '', s)
    # 3. Harmoniser graphèmes
    s = re.sub(r'[أإآٱا]', 'ا', s)
    s = re.sub(r'[ةه]',    'ه', s)
    s = re.sub(r'[يىئ]',   'ي', s)
    s = re.sub(r'[ؤو]',    'و', s)
    return re.sub(r'\s+', ' ', s).strip()

# ────────────────────────────────────────────────────────────────────
#  CLASSIFICATION VERDICT
# ────────────────────────────────────────────────────────────────────
_VERDICT_MAP = [
    (
        r'ثق[ةه]|إمام|ثبت|حافظ|متقن|ضابط|عدل\s+ضابط|مأمون|'
        r'حجة|ركن|عمدة|لا\s+غبار|وثقه\s+الجمهور|وثقوه|'
        r'من\s+كبار|من\s+أثبت|من\s+أوثق|من\s+أحفظ',
        'THIQAH', 'thiqah', 95,
    ),
    (
        r'صدوق|لا\s+بأس\s+به|صالح\s+الحديث|مستقيم\s+الحديث|'
        r'وسط|ليس\s+به\s+بأس|محله\s+الصدق|صدوق\s+يهم|'
        r'صدوق\s+يخطئ|حسن\s+الحديث',
        'SADOUQ', 'sadouq', 72,
    ),
    (
        r'ضعيف|ليّن|ليَّن|ليين|مجهول|منكر\s+الحديث|متروك|واهٍ|'
        r'ضعّفه|ضعفوه|فيه\s+ضعف|ضعيف\s+جداً|لا\s+يُحتج|'
        r'لا\s+يُعتبر|مضطرب|سيء\s+الحفظ|كثير\s+الخطأ|'
        r'رديء\s+الحفظ|اضطرب|واه|منكر',
        "DA'IF", 'daif', 28,
    ),
    (
        r'موضوع|كذاب|كذّاب|وضّاع|دجّال|ساقط|متهم\s+بالكذب|'
        r'يضع\s+الحديث|يكذب|لا\s+يكتب\s+حديثه|هالك|'
        r'ذاهب\s+الحديث|تركوه',
        "MAWDU'", 'munkar', 5,
    ),
]

def _classify(text):
    t = text or ''
    for pat, lbl, cls, score in _VERDICT_MAP:
        if re.search(pat, t):
            return lbl, cls, score
    return 'THIQAH', 'thiqah', 68

# ────────────────────────────────────────────────────────────────────
#  HELPERS GÉNÉRAUX
# ────────────────────────────────────────────────────────────────────
def _first(*args):
    return next((a for a in args if a), '')

def _clean(text):
    return re.sub(r'\s+', ' ', (text or '').strip())

def _has_data(d):
    return bool(d and any(v for v in d.values() if v))

# ────────────────────────────────────────────────────────────────────
#  FIX-1 — _merge_lists préserve les dicts {nom, wafat, death_year}
#  FIX-4 — déduplication via _norm() (strip honorifiques inclus)
# ────────────────────────────────────────────────────────────────────
def _merge_narrator_lists(a, b):
    """
    FIX-1 : conserve les dicts {nom, wafat, death_year} au lieu de caster en str.
    FIX-4 : clé de dédup = _norm() avec strip honorifiques.
    Retourne une liste de dicts homogène.
    """
    seen, out = set(), []
    for n in (a or []) + (b or []):
        if isinstance(n, dict):
            nom  = str(n.get('nom', '') or '')
            wafat  = str(n.get('wafat', '')  or '')
            dy   = n.get('death_year', 9999)
            obj  = {'nom': nom, 'wafat': wafat, 'death_year': dy}
        else:
            nom  = str(n)
            wafat  = ''
            dy   = _extract_death_year(nom)
            obj  = {'nom': nom, 'wafat': wafat, 'death_year': dy}
        k = _norm(nom)                # FIX-4 : honorifiques strippés ici
        if k and k not in seen:
            seen.add(k)
            out.append(obj)
    return out

_TABAQA_EN = {
    'الصحابة':        'Ṣaḥāba',
    'كبار التابعين':  "Senior Tābi'ūn",
    'التابعين':       "Tābi'ūn",
    'تابعو التابعين': "Tābi' al-Tābi'ūn",
    'أتباع التابعين': "Tābi' al-Tābi'ūn",
    'الطبقة الوسطى':  'Middle Generation',
    'المتأخرون':      'Later Narrators',
}

def _tabaqa_label(raw):
    if not raw:
        return raw
    for ar, en in _TABAQA_EN.items():
        if ar in raw:
            return raw + ' — ' + en
    return raw

_TITRE_MAP = {
    'THIQAH': (
        'Narrator of high reliability — Thiqah',
        'Accepted without reservation in the six canonical collections',
    ),
    'SADOUQ': (
        'Truthful narrator — Sadouq',
        'Generally accepted — minor reservations occasionally noted',
    ),
    "DA'IF": (
        'Weak narrator — Daʿīf',
        'Transmitted with caution — independent corroboration required',
    ),
    "MAWDU'": (
        'Severely criticized — Matrūk / Kadhdhāb',
        'Narrations rejected by scholarly consensus — not used as evidence',
    ),
}

# ────────────────────────────────────────────────────────────────────
#  SÉLECTEURS ISNAD
# ────────────────────────────────────────────────────────────────────
_ISNAD_SELECTORS = [
    "div.hadith-isnad", "div.isnad", "div.sanad", "span.sanad", "p.sanad",
    "div[data-type='isnad']", "div[data-type='sanad']",
    "span[data-type='narrator']",
    "div[class*='isnad']", "div[class*='sanad']", "span[class*='isnad']",
    "div[id*='isnad']", "div[id*='sanad']",
    "div.hadith-item > div:first-child",
    "div.hadith-container > p:first-child",
    "article.hadith > div:first-child",
]

# ════════════════════════════════════════════════════════════════════
#  FIX-2 — GESTION 429 / RATE LIMIT PROACTIVE
#  Payloads d'erreur structurés → le frontend peut agir en conséquence
# ════════════════════════════════════════════════════════════════════
class _RateLimitError(Exception):
    """Levée quand Dorar retourne 429 ou 503 avec Retry-After."""
    def __init__(self, retry_after=None):
        self.retry_after = retry_after or 30
        super().__init__(f"Rate limited — retry after {self.retry_after}s")

def _check_rate_limit(response):
    """
    FIX-2 : inspecte le status et les headers httpx.Response.
    Lève _RateLimitError si détecté.
    """
    if response.status_code in (429, 503):
        retry_after = response.headers.get('Retry-After', '30')
        try:
            retry_after = int(retry_after)
        except ValueError:
            retry_after = 30
        raise _RateLimitError(retry_after)

# ════════════════════════════════════════════════════════════════════
#  VERROU 3 — VITESSE : helpers httpx async
# ════════════════════════════════════════════════════════════════════
async def _aget(client, url, params=None):
    r = await client.get(url, params=params)
    _check_rate_limit(r)    # FIX-2
    r.raise_for_status()
    return r.text

async def _aget_json(client, url, params=None):
    r = await client.get(url, params=params, headers=HDRS_JSON)
    _check_rate_limit(r)    # FIX-2
    r.raise_for_status()
    return r.json()

# ════════════════════════════════════════════════════════════════════
#  SOURCE A — Fiche dédiée /rijal/<id>
# ════════════════════════════════════════════════════════════════════
async def _fetch_narrator_page(client, name_q):
    if not BS4_OK:
        return None
    try:
        html  = await _aget(client, BASE + '/rijal/search', {'q': name_q})
        # FIX-3 : parser lxml explicite
        soup  = BeautifulSoup(html, _BS_PARSER)
        qnorm = _norm(name_q)

        narrator_link = None
        for a in soup.select("a[href*='/rijal/']"):
            href = a.get('href', '')
            if not re.search(r'/rijal/\d+', href):
                continue
            txt = _norm(a.get_text(strip=True))
            if qnorm[:4] and qnorm[:4] in txt:
                narrator_link = href
                break
        if not narrator_link:
            for a in soup.select("a[href*='/rijal/']"):
                if re.search(r'/rijal/\d+', a.get('href', '')):
                    narrator_link = a['href']
                    break
        if not narrator_link:
            return None
        if narrator_link.startswith('/'):
            narrator_link = BASE + narrator_link

        html2 = await _aget(client, narrator_link)
        soup2 = BeautifulSoup(html2, _BS_PARSER)   # FIX-3
        out   = {'death_year': 9999}

        for sel in ['h1.narrator-name', '.narrator-full-name', 'h1.rawi-name',
                    'h1', '.narrator-title', 'h2.narrator-name', 'h2']:
            el = soup2.select_one(sel)
            if el:
                t = _clean(el.get_text())
                if t and len(t) > 3:
                    out['nom_ar'] = t
                    break

        for row in soup2.select('table tr, div.narrator-meta div.row, dl dt'):
            cells = row.select('td') or row.select('dd')
            if len(cells) >= 2:
                lbl = _clean(cells[0].get_text())
                val = _clean(cells[1].get_text())
            elif row.name == 'dt':
                lbl = _clean(row.get_text())
                dd  = row.find_next_sibling('dd')
                val = _clean(dd.get_text()) if dd else ''
            else:
                continue
            if re.search(r'طبق|الطبق[ةه]', lbl):
                out['tabaqa'] = val
            if re.search(r'وف[اى]|توف|المتوف|سنة\s+الوفاة', lbl):
                out['wafat']      = val
                out['death_year'] = _extract_death_year(val)   # VERROU 1
            if re.search(r'الكنية', lbl):
                out['kunya'] = val
            if re.search(r'النسب|البلد|الوطن', lbl):
                out['nasab'] = val

        if out.get('death_year', 9999) == 9999:
            out['death_year'] = _extract_death_year(out.get('nom_ar', ''))

        # ── Mashayikh ────────────────────────────────────────────────
        mash = []
        mash_seen = set()
        for sel in [
            "div.shuyukh a[href*='/rijal/']", "div#shuyukh a[href*='/rijal/']",
            "ul.shuyukh a", "div[id*='shuyukh'] a[href*='/rijal/']",
            "div[class*='shuyukh'] a[href*='/rijal/']",
            "section.mashayikh a[href*='/rijal/']", "div.narrator-shuyukh a",
        ]:
            try:
                found = soup2.select(sel)
            except Exception:
                continue
            for a in found[:35]:
                n  = _clean(a.get_text())
                k  = _norm(n)           # FIX-4 via _norm
                if n and len(n) > 2 and k not in mash_seen:
                    mash_seen.add(k)
                    dy = _extract_death_year(a.get('title', '') + ' ' + n)
                    mash.append({'nom': n, 'wafat': '', 'death_year': dy})
            if mash:
                break
        _sort_narrators(mash)           # VERROU 1
        out['mashayikh'] = mash[:25]

        # ── Talamidh ─────────────────────────────────────────────────
        tala = []
        tala_seen = set()
        for sel in [
            "div.talamidh a[href*='/rijal/']", "div#talamidh a[href*='/rijal/']",
            "ul.talamidh a", "div[id*='talamidh'] a[href*='/rijal/']",
            "div[class*='talamidh'] a[href*='/rijal/']",
            "section.talamidh a[href*='/rijal/']", "div.narrator-talamidh a",
        ]:
            try:
                found = soup2.select(sel)
            except Exception:
                continue
            for a in found[:35]:
                n  = _clean(a.get_text())
                k  = _norm(n)
                if n and len(n) > 2 and k not in tala_seen:
                    tala_seen.add(k)
                    dy = _extract_death_year(a.get('title', '') + ' ' + n)
                    tala.append({'nom': n, 'wafat': '', 'death_year': dy})
            if tala:
                break
        _sort_narrators(tala)
        out['talamidh'] = tala[:25]

        # ── Jarh wa Ta'dil ────────────────────────────────────────────
        jugements = []
        for sel in [
            'div.jarh-tadil', 'div.aqwal-ulama', 'div.narrator-judgments',
            "div[class*='jarh']", "div[class*='tadil']", "div[class*='aqwal']",
            "div[id*='jarh']", "div[id*='aqwal']", 'table.aqwal', 'div.aqwal',
        ]:
            block = soup2.select_one(sel)
            if not block:
                continue
            rows = block.select('tr, li, div.item, div.qawl-item, div.judgment-row')
            if not rows:
                for strong in block.select('strong, b')[:15]:
                    s      = _clean(strong.get_text())
                    p      = strong.find_next_sibling(['p', 'span', 'div'])
                    txt    = _clean(p.get_text()) if p else ''
                    src_el = block.select_one('.source, cite, small')
                    src    = _clean(src_el.get_text()) if src_el else ''
                    if s or txt:
                        jugements.append({
                            'scholar': s, 'ar': txt, 'fr': '', 'src': src, 'classe': '',
                        })
            else:
                for row in rows[:20]:
                    s_el   = row.select_one('td:first-child, .scholar-name, strong, b, .imam-name')
                    t_el   = row.select_one('td:last-child, .qawl-text, p, .judgment-text')
                    src_el = row.select_one('.source, cite, small, .book-ref')
                    s   = _clean(s_el.get_text())   if s_el   else ''
                    t   = _clean(t_el.get_text())   if t_el   else ''
                    src = _clean(src_el.get_text()) if src_el else ''
                    if s or t:
                        jugements.append({
                            'scholar': s, 'ar': t, 'fr': '', 'src': src, 'classe': '',
                        })
            if jugements:
                break

        out['jugements'] = jugements[:18]
        return out

    except _RateLimitError:
        raise   # remonter pour être capturée par l'orchestrateur
    except Exception:
        return None

# ════════════════════════════════════════════════════════════════════
#  SOURCE B — Chaînes isnad — VERROU 2 : fallback Takhrij intégré
# ════════════════════════════════════════════════════════════════════
async def _fetch_hadith_search(client, name_q, mode='narrator'):
    if mode == 'narrator':
        p1 = {'q': name_q, 't': 'narrator', 'page': 1}
        p2 = {'q': name_q, 't': 'narrator', 'page': 2}
    else:
        # VERROU 2 — Takhrij (m[]=2)
        p1 = {'q': name_q, 'm[]': '2', 'page': 1}
        p2 = {'q': name_q, 'm[]': '2', 'page': 2}

    pages = await asyncio.gather(
        _aget(client, BASE + '/hadith/search', p1),
        _aget(client, BASE + '/hadith/search', p2),
        return_exceptions=True,
    )
    # FIX-2 : si une page lève _RateLimitError, la propager
    for p in pages:
        if isinstance(p, _RateLimitError):
            raise p
    return [p for p in pages if isinstance(p, str) and p]

async def _parse_isnad_pages(pages, name_q):
    result    = {
        'nom_ar': '', 'mashayikh': [], 'talamidh': [],
        'jugements_raw': [], 'tabaqa': '', 'death_year': 9999,
    }
    mash_seen = set()
    tala_seen = set()
    qnorm     = _norm(name_q)

    for html in pages:
        if not html:
            continue
        soup = BeautifulSoup(html, _BS_PARSER)  # FIX-3

        isnad_blocks = []
        seen_ids     = set()
        for sel in _ISNAD_SELECTORS:
            try:
                for b in soup.select(sel):
                    if id(b) not in seen_ids:
                        seen_ids.add(id(b))
                        isnad_blocks.append(b)
            except Exception:
                continue
        if not isnad_blocks:
            for block in soup.select(
                'div.hadith-item, div.hadith-container, '
                'article.hadith, div.result-item'
            )[:20]:
                first = block.find(['div', 'p', 'span'])
                if first:
                    isnad_blocks.append(first)

        for block in isnad_blocks[:40]:
            narrator_els = block.select(
                "a[href*='/rijal/'], span[data-narrator-id], "
                "span[data-narrator], span.narrator-in-isnad, "
                "a[class*='narrator'], span[class*='narrator']"
            )
            if not narrator_els:
                narrator_els = [
                    a for a in block.select('a')
                    if '/rijal/' in a.get('href', '')
                ]

            for i, el in enumerate(narrator_els):
                n  = _clean(el.get_text())
                nk = _norm(n)               # FIX-4 : honorifiques strippés
                if not n or len(n) < 3:
                    continue

                title_attr = el.get('title', '') or el.get('data-info', '')
                dy = _extract_death_year(title_attr + ' ' + n)

                is_match = (
                    (qnorm[:5] and qnorm[:5] in nk) or
                    (nk[:5]    and nk[:5]    in qnorm)
                )

                if is_match:
                    if not result['nom_ar'] and len(n) > 4:
                        result['nom_ar'] = n
                    if dy < result['death_year']:
                        result['death_year'] = dy

                    if i > 0:
                        prev   = _clean(narrator_els[i - 1].get_text())
                        pk     = _norm(prev)
                        p_attr = narrator_els[i - 1].get('title', '')
                        p_dy   = _extract_death_year(p_attr + ' ' + prev)
                        if prev and len(prev) > 2 and pk not in mash_seen:
                            mash_seen.add(pk)
                            result['mashayikh'].append({
                                'nom': prev, 'wafat': '', 'death_year': p_dy,
                            })

                    if i < len(narrator_els) - 1:
                        nxt    = _clean(narrator_els[i + 1].get_text())
                        nk2    = _norm(nxt)
                        n_attr = narrator_els[i + 1].get('title', '')
                        n_dy   = _extract_death_year(n_attr + ' ' + nxt)
                        if nxt and len(nxt) > 2 and nk2 not in tala_seen:
                            tala_seen.add(nk2)
                            result['talamidh'].append({
                                'nom': nxt, 'wafat': '', 'death_year': n_dy,
                            })

                grade = (
                    el.get('data-grade') or el.get('data-hukm') or
                    el.get('data-verdict') or el.get('title', '')
                )
                if grade and len(grade) > 2:
                    result['jugements_raw'].append(_clean(grade))

            if (len(result['mashayikh']) >= 20 and
                    len(result['talamidh']) >= 20):
                break

    # VERROU 1 : tri avant renvoi — dicts conservés
    _sort_narrators(result['mashayikh'])
    _sort_narrators(result['talamidh'])
    result['mashayikh'] = result['mashayikh'][:25]
    result['talamidh']  = result['talamidh'][:25]
    return result

async def _fetch_from_isnad_chains(client, name_q):
    """VERROU 2 : mode narrator → fallback Takhrij automatique."""
    try:
        pages = await _fetch_hadith_search(client, name_q, mode='narrator')
        if pages:
            result = await _parse_isnad_pages(pages, name_q)
            if (result.get('nom_ar') or result.get('mashayikh') or
                    result.get('talamidh')):
                return result
    except _RateLimitError:
        raise

    # VERROU 2 — Takhrij
    try:
        pages_tkh = await _fetch_hadith_search(client, name_q, mode='takhrij')
        if pages_tkh:
            return await _parse_isnad_pages(pages_tkh, name_q)
    except _RateLimitError:
        raise

    return None

# ════════════════════════════════════════════════════════════════════
#  SOURCE C — JSON /rijal/search
# ════════════════════════════════════════════════════════════════════
async def _fetch_rijal_json(client, name_q):
    try:
        data  = await _aget_json(
            client, BASE + '/rijal/search', {'q': name_q, 'page': 1}
        )
        items = (
            data.get('data') or data.get('results') or
            data.get('narrators') or (data if isinstance(data, list) else [])
        )
        qnorm = _norm(name_q)
        for item in items[:8]:
            nf = _first(
                item.get('name'), item.get('full_name'),
                item.get('narrator_name'), item.get('ar_name'), item.get('nom'),
            )
            if nf and qnorm[:4] in _norm(nf):
                raw_death = _first(
                    str(item.get('death_year', '')),
                    str(item.get('wafat', '')),
                    str(item.get('died', '')),
                )
                item['_death_year_parsed'] = _extract_death_year(raw_death)
                return item
        return items[0] if items else None
    except _RateLimitError:
        raise
    except Exception:
        return None

# ════════════════════════════════════════════════════════════════════
#  ASSEMBLAGE — fusion + FIX-1 : payload riche {nom, wafat, death_year}
# ════════════════════════════════════════════════════════════════════
def _build_response(name_q, pd, id_, rj):
    pd  = pd  or {}
    id_ = id_ or {}
    rj  = rj  or {}

    r = {
        'found':           True,
        'nom_fr':          name_q,
        'nom_ar':          _first(
                               pd.get('nom_ar'), id_.get('nom_ar'),
                               rj.get('name') or rj.get('full_name') or rj.get('ar_name'),
                               name_q,
                           ),
        'kunya':           pd.get('kunya', ''),
        'nasab':           pd.get('nasab', ''),
        'tabaqa':          _tabaqa_label(_first(
                               pd.get('tabaqa'), id_.get('tabaqa'),
                               rj.get('generation') or rj.get('tabaqa'),
                           )),
        'statut':          'THIQAH',
        'pills':           [],
        'verdict_titre':   '',
        'verdict_sous':    '',
        'barres':          [],
        'jugements':       [],
        'mashayikh':       [],
        'talamidh':        [],
        'rihla':           '',
        'rihla_quote_ar':  '',
        'rihla_quote_fr':  '',
        'rihla_quote_src': '',
    }

    # ── Jugements ────────────────────────────────────────────────────
    jugements = list(pd.get('jugements') or [])
    if not jugements:
        for raw in (id_.get('jugements_raw') or [])[:14]:
            if raw and len(raw) > 2:
                jugements.append({
                    'scholar': '', 'ar': raw, 'fr': '', 'src': '', 'classe': '',
                })
    for j in jugements:
        if not j.get('classe'):
            _, jcls, _ = _classify(
                (j.get('ar') or '') + ' ' + (j.get('scholar') or '')
            )
            j['classe'] = jcls

    all_text  = ' '.join(
        (j.get('ar', '')) + ' ' + (j.get('scholar', '')) for j in jugements
    )
    rj_grade  = _first(
        rj.get('grade'), rj.get('status'), rj.get('verdict'),
        rj.get('hukm'), rj.get('rank'),
    )
    v_lbl, _, v_score = _classify(all_text + ' ' + (rj_grade or ''))
    r['statut']    = v_lbl
    r['jugements'] = jugements[:18]

    # ── FIX-1 : fusion avec _merge_narrator_lists (dicts préservés) ──
    merged_mash = _merge_narrator_lists(
        pd.get('mashayikh') or [], id_.get('mashayikh') or []
    )
    merged_tala = _merge_narrator_lists(
        pd.get('talamidh') or [],  id_.get('talamidh') or []
    )

    # VERROU 1 : tri chronologique sur la liste fusionnée
    _sort_narrators(merged_mash)
    _sort_narrators(merged_tala)

    # FIX-1 : envoyer des dicts {nom, wafat} au JS (rawi-modal.js
    # supporte déjà typeof n === 'object' → n.nom, n.role)
    r['mashayikh'] = merged_mash[:25]
    r['talamidh']  = merged_tala[:25]

    # ── Wafat ─────────────────────────────────────────────────────────
    wafat = _first(
        pd.get('wafat'),
        rj.get('death_year') or rj.get('wafat') or rj.get('died'),
    )

    # ── Rihla ─────────────────────────────────────────────────────────
    parts = []
    if r['nom_ar'] and _norm(r['nom_ar']) != _norm(name_q):
        parts.append('الاسم الكامل : ' + r['nom_ar'])
    if r['kunya']:   parts.append('الكنية : '        + r['kunya'])
    if r['nasab']:   parts.append('النسب / البلد : ' + r['nasab'])
    if r['tabaqa']:  parts.append('الطبقة : '        + r['tabaqa'])
    if wafat:        parts.append('الوفاة : '         + wafat)
    if rj.get('bio'): parts.append(rj['bio'])
    r['rihla'] = '\n\n'.join(parts)

    for j in jugements:
        if j.get('ar') and len(j['ar']) > 12:
            r['rihla_quote_ar']  = j['ar']
            r['rihla_quote_src'] = j.get('src', '')
            break

    # ── Pills ─────────────────────────────────────────────────────────
    pcls = {
        'THIQAH': 'mzRw-pill-green', 'SADOUQ': 'mzRw-pill-gold',
        "DA'IF":  'mzRw-pill-red',   "MAWDU'": 'mzRw-pill-red',
    }.get(v_lbl, 'mzRw-pill-silver')
    pills = [{'label': v_lbl, 'cls': pcls}]
    if r['tabaqa']:
        pills.append({'label': r['tabaqa'].split(' — ')[0], 'cls': 'mzRw-pill-blue'})
    if wafat:
        pills.append({'label': wafat, 'cls': 'mzRw-pill-silver'})
    if r['mashayikh']:
        pills.append({'label': str(len(r['mashayikh'])) + ' SHUYUKH',  'cls': 'mzRw-pill-gold'})
    if r['talamidh']:
        pills.append({'label': str(len(r['talamidh']))  + ' TALAMIDH', 'cls': 'mzRw-pill-gold'})
    r['pills'] = pills

    titre, sous = _TITRE_MAP.get(v_lbl, (
        'Narrator documented in the Rijal corpus',
        'Consult the classical biographical dictionaries for details',
    ))
    r['verdict_titre'] = titre
    r['verdict_sous']  = sous

    bar_col = '#22c55e' if v_score >= 80 else '#f59e0b' if v_score >= 50 else '#ef4444'
    r['barres'] = [
        {'label': 'RELIABILITY', 'pct': v_score,                           'color': bar_col},
        {'label': 'MASHAYIKH',   'pct': min(100, len(r['mashayikh']) * 4), 'color': '#d4af37'},
        {'label': 'TALAMIDH',    'pct': min(100, len(r['talamidh'])  * 4), 'color': '#93c5fd'},
        {'label': 'JARH REFS',   'pct': min(100, len(r['jugements']) * 8), 'color': '#a78bfa'},
    ]

    return r

# ════════════════════════════════════════════════════════════════════
#  ORCHESTRATEUR ASYNC — FIX-2 intégré + FIX-3 connexions limitées
# ════════════════════════════════════════════════════════════════════
async def _main_async(name_q):
    async with httpx.AsyncClient(
        headers=HDRS_HTML,
        timeout=TIMEOUT,
        follow_redirects=True,
        # FIX-3 : max 4 connexions simultanées → évite ban Dorar (was 10)
        limits=httpx.Limits(
            max_connections=4,
            max_keepalive_connections=2,
        ),
    ) as client:
        try:
            results = await asyncio.gather(
                _fetch_narrator_page(client, name_q),      # Source A
                _fetch_from_isnad_chains(client, name_q),  # Source B + VERROU 2
                _fetch_rijal_json(client, name_q),         # Source C
                return_exceptions=True,
            )
        except _RateLimitError as rle:
            # FIX-2 : payload structuré pour le frontend
            return {
                'found':       False,
                'rate_limited': True,
                'retry_after':  rle.retry_after,
                'error':        f'Dorar.net rate limit — réessayez dans {rle.retry_after}s',
            }

        # FIX-2 : vérifier si une source individuelle a été rate-limitée
        rate_err = next(
            (r for r in results if isinstance(r, _RateLimitError)), None
        )
        if rate_err:
            return {
                'found':        False,
                'rate_limited': True,
                'retry_after':  rate_err.retry_after,
                'error':        f'Dorar.net rate limit — réessayez dans {rate_err.retry_after}s',
            }

        pd, id_, rj = [
            r if not isinstance(r, Exception) else None
            for r in results
        ]

        if not _has_data(pd) and not _has_data(id_) and not rj:
            return {'found': False, 'name': name_q}

        return _build_response(name_q, pd, id_, rj)

# ════════════════════════════════════════════════════════════════════
#  HANDLER VERCEL — Route GET /api/rawi?name=<nom>
# ════════════════════════════════════════════════════════════════════
class handler(BaseHTTPRequestHandler):

    def log_message(self, fmt, *a):
        pass

    def _json(self, data, status=200):
        body = json.dumps(
            data, ensure_ascii=False, separators=(',', ':')
        ).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type',   'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control',  'public, max-age=3600, stale-while-revalidate=86400')
        self.send_header('Access-Control-Allow-Origin',  '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin',  '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Accept')
        self.end_headers()

    def do_GET(self):
        try:
            parsed = urllib.parse.urlparse(self.path)
            params = urllib.parse.parse_qs(parsed.query)
            name_q = (params.get('name') or [''])[0].strip()

            if not name_q:
                self._json({'found': False, 'error': 'missing ?name= parameter'}, 400)
                return

            result = asyncio.run(_main_async(name_q))

            # FIX-2 : HTTP 429 propre vers le client si rate limited
            status = 429 if result.get('rate_limited') else 200
            self._json(result, status)

        except Exception as e:
            self._json({'found': False, 'error': str(e)}, 500)
