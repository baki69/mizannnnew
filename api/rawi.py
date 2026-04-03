# ═══════════════════════════════════════════════════════════════════
#  MÎZÂN v22.1 — api/rawi.py — Vercel Serverless
#  RÈGLE FONDAMENTALE :
#    • RAPPORTEURS  → chaîne isnad  (décédés, transmetteurs classiques)
#    • JUGES        → section verdict (évaluateurs, toutes époques)
#  Zéro contamination : aucun savant contemporain dans l'arbre
#  Route : GET /api/rawi?name=<nom>
# ═══════════════════════════════════════════════════════════════════

from http.server import BaseHTTPRequestHandler
import json, re, urllib.parse, urllib.request

try:
    from bs4 import BeautifulSoup
    BS4_OK = True
except ImportError:
    BS4_OK = False

# ────────────────────────────────────────────────────────────────────
#  CONSTANTES
# ────────────────────────────────────────────────────────────────────
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
TIMEOUT = 10

# ────────────────────────────────────────────────────────────────────
#  BLACKLIST CONTEMPORAINS
#  Règle : ces noms désignent des JUGES (muhaddithoûn modernes ou
#  tardo-médiévaux) qui évaluent les chaînes mais n'en font PAS partie.
#  Ils sont admis dans la section "Jugements" mais jamais dans l'arbre.
# ────────────────────────────────────────────────────────────────────
_CONTEMPORARY = re.compile(
    # ── Modernes (XXe–XXIe s.) ──────────────────────────────────────
    r'الألباني|الألبانى'                      # Muhammad Nasir al-Din al-Albani
    r'|ابن باز|ابن بار'                       # Abd al-Aziz ibn Baz
    r'|ابن عثيمين|ابن عُثيمين'               # Muhammad ibn Uthaymin
    r'|الوادعي|مقبل(?:\s+بن\s+هادي)?'        # Muqbil al-Wadi'i
    r'|الأرناؤوط|ارناووط|شعيب\s+الأرنا'      # Shu'ayb al-Arna'ut
    r'|أحمد\s+شاكر|أحمد\s+محمد\s+شاكر'      # Ahmad Muhammad Shakir
    r'|عبد\s+القادر\s+الأرناؤوط'
    r'|حسين\s+سليم\s+أسد'
    r'|ماهر\s+الفحل'
    r'|طارق\s+عوض\s+الله'
    r'|بشار\s+عواد'
    r'|الدارقطني\s+المعاصر'                  # éviter confusion avec l'imam classique
    r'|محمد\s+عوامه'
    r'|عمر\s+فلاته'
    r'|نور\s+الدين\s+عتر'
    r'|الشيخ\s+الألباني'

    # ── Tardo-médiévaux (évaluateurs, pas transmetteurs) ────────────
    r'|السيوطي(?:\s+في)?|السيوطى'            # al-Suyuti (911H) — critique, pas transmetteur ici
    r'|ابن\s+حجر\s+الهيتمي|الهيتمي'         # Ibn Hajar al-Haytami (974H) — fiqh, pas rijal isnad
    r'|البوصيري'                              # al-Busiri (840H)
    r'|الزيلعي'                               # al-Zayla'i (762H) — takhrijiste
    r'|ابن\s+الملقن'                          # Ibn al-Mulaqqin (804H)
    r'|العراقي(?:\s+في)?'                     # al-Iraqi (806H) — alfiyya/tahrij
    r'|ابن\s+الجوزي\s+في\s+الموضوعات'        # seulement dans contexte mawdu'
    r'|ابن\s+عراق'                            # Ibn Arraq (963H)
    r'|الذهبي\s+في\s+التلخيص'                # Dhahabi comme juge de Ibn Hajar (pas transmetteur)

    # ── Termes génériques contemporains ─────────────────────────────
    r'|al-silsila|silsilat\s+al-[sd]'
    r'|albani|bin\s?baz|uthaymeen|ibn\s?uthaymeen'
    r'|arna.?ut|shu.?ayb'
    r'|al-wadi.?i|muqbil'
    r'|ahmad\s+shakir|ahmed\s+shaker',
    re.IGNORECASE | re.UNICODE
)

# ────────────────────────────────────────────────────────────────────
#  SEUIL CHRONOLOGIQUE
#  Un rapporteur classique dans un isnad canonique est décédé avant ~380H.
#  Si on détecte une date de décès > 400H, on l'exclut de la chaîne.
# ────────────────────────────────────────────────────────────────────
_DEATH_YEAR_RE = re.compile(r'(\d{3,4})\s*[هH]', re.IGNORECASE)
_DEATH_CUTOFF  = 400  # hijri

def _is_too_late(text):
    """Retourne True si la date de décès détectée dépasse le seuil."""
    m = _DEATH_YEAR_RE.search(text or '')
    if m:
        return int(m.group(1)) > _DEATH_CUTOFF
    return False

def _is_contemporary(name):
    """Blacklist nommée OU mort trop tardive."""
    return bool(_CONTEMPORARY.search(name or '')) or _is_too_late(name)

# ────────────────────────────────────────────────────────────────────
#  SÉLECTEURS ISNAD — ordre de priorité (du plus spécifique au fallback)
#  On cible UNIQUEMENT la zone sanad/isnad, jamais sharh/tahrij/matn
# ────────────────────────────────────────────────────────────────────
_ISNAD_SELECTORS = [
    # Sélecteurs sémantiques stricts
    "div.hadith-isnad",
    "div.isnad",
    "div.sanad",
    "span.sanad",
    "p.sanad",
    # Attributs data (structure moderne Dorar)
    "div[data-type='isnad']",
    "div[data-type='sanad']",
    "span[data-type='narrator']",
    # Classes partielles
    "div[class*='isnad']",
    "div[class*='sanad']",
    "span[class*='isnad']",
    # IDs
    "div[id*='isnad']",
    "div[id*='sanad']",
    # Blocs hadith (fallback : on prend le premier enfant = le sanad)
    "div.hadith-item > div:first-child",
    "div.hadith-container > p:first-child",
    "article.hadith > div:first-child",
]
_ISNAD_SEL = ", ".join(_ISNAD_SELECTORS)

# ────────────────────────────────────────────────────────────────────
#  VERDICT — classification étendue
# ────────────────────────────────────────────────────────────────────
_VERDICT_MAP = [
    # THIQAH — fiable, solide
    (
        r'ثق[ةه]|إمام|ثبت|حافظ|متقن|ضابط|عدل\s+ضابط|مأمون|'
        r'حجة|ركن|عمدة|لا\s+غبار|وثقه\s+الجمهور|وثقوه|'
        r'من\s+كبار|من\s+أثبت|من\s+أوثق|من\s+أحفظ',
        'THIQAH', 'thiqah', 95
    ),
    # SADOUQ — véridique mais pas parfait
    (
        r'صدوق|لا\s+بأس\s+به|صالح\s+الحديث|مستقيم\s+الحديث|'
        r'وسط|ليس\s+به\s+بأس|محله\s+الصدق|صدوق\s+يهم|'
        r'صدوق\s+يخطئ|حسن\s+الحديث',
        'SADOUQ', 'sadouq', 72
    ),
    # DA'IF — faible
    (
        r'ضعيف|ليّن|ليَّن|ليين|مجهول|منكر\s+الحديث|متروك|واهٍ|'
        r'ضعّفه|ضعفوه|فيه\s+ضعف|ضعيف\s+جداً|لا\s+يُحتج|'
        r'لا\s+يُعتبر|مضطرب|سيء\s+الحفظ|كثير\s+الخطأ|'
        r'رديء\s+الحفظ|اضطرب|واه|منكر',
        "DA'IF", 'daif', 28
    ),
    # MAWDU' — forgé / rejeté
    (
        r'موضوع|كذاب|كذّاب|وضّاع|دجّال|ساقط|متهم\s+بالكذب|'
        r'يضع\s+الحديث|يكذب|لا\s+يكتب\s+حديثه|هالك|'
        r'ذاهب\s+الحديث|تركوه',
        "MAWDU'", 'munkar', 5
    ),
]

def _classify(text):
    """Retourne (label, css_class, score_fiabilité)."""
    t = text or ''
    for pat, lbl, cls, score in _VERDICT_MAP:
        if re.search(pat, t):
            return lbl, cls, score
    return 'THIQAH', 'thiqah', 68

# ────────────────────────────────────────────────────────────────────
#  HTTP HELPERS
# ────────────────────────────────────────────────────────────────────
def _get(url, params=None):
    if params:
        url += "?" + urllib.parse.urlencode(params, quote_via=urllib.parse.quote)
    req = urllib.request.Request(url, headers={
        "User-Agent":      UA,
        "Accept":          "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ar,fr;q=0.8,en;q=0.5",
        "Referer":         "https://www.dorar.net/",
        "Connection":      "keep-alive",
    })
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return r.read().decode("utf-8", errors="replace")

def _get_json(url, params=None):
    if params:
        url += "?" + urllib.parse.urlencode(params, quote_via=urllib.parse.quote)
    req = urllib.request.Request(url, headers={
        "User-Agent":       UA,
        "Accept":           "application/json",
        "X-Requested-With": "XMLHttpRequest",
        "Referer":          "https://www.dorar.net/",
    })
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return json.loads(r.read().decode("utf-8", errors="replace"))

# ────────────────────────────────────────────────────────────────────
#  NORMALISATION ARABE
#  Supprime diacritiques et harmonise les graphies pour la comparaison
# ────────────────────────────────────────────────────────────────────
def _norm(s):
    s = re.sub(r'[\u064b-\u065f\u0670\u0671]', '', s or '')  # diacritiques
    s = re.sub(r'[أإآٱا]',  'ا', s)
    s = re.sub(r'[ةه]',     'ه', s)
    s = re.sub(r'[يىئ]',    'ي', s)
    s = re.sub(r'[ؤو]',     'و', s)
    s = re.sub(r'\s+', ' ', s)
    return s.strip()

def _first(*args):
    for a in args:
        if a:
            return a
    return ''

def _clean(text):
    """Nettoyage léger d'un texte extrait du HTML."""
    return re.sub(r'\s+', ' ', (text or '').strip())

# ════════════════════════════════════════════════════════════════════
#  SOURCE A — Page dédiée /rijal/<id>
#  Extraction directe depuis la fiche du narrateur sur Dorar
# ════════════════════════════════════════════════════════════════════
def _fetch_narrator_page(name_q):
    """
    1. Recherche /rijal/search?q=<name>
    2. Suit le premier lien /rijal/<id> dont le nom correspond
    3. Extrait : nom_ar, tabaqa, wafat, mashayikh, talamidh, jugements
    """
    if not BS4_OK:
        return None
    try:
        html = _get("https://www.dorar.net/rijal/search", {"q": name_q})
        soup = BeautifulSoup(html, "html.parser")

        # ── Trouver le lien /rijal/<id> le plus pertinent ────────────
        narrator_link = None
        qnorm = _norm(name_q)

        for a in soup.select("a[href*='/rijal/']"):
            href = a.get("href", "")
            if not re.search(r'/rijal/\d+', href):
                continue
            txt = _norm(a.get_text(strip=True))
            # Correspondance des 4 premiers caractères normalisés
            if qnorm[:4] and qnorm[:4] in txt:
                narrator_link = href
                break

        # Fallback : premier lien rijal numéroté
        if not narrator_link:
            for a in soup.select("a[href*='/rijal/']"):
                if re.search(r'/rijal/\d+', a.get("href", "")):
                    narrator_link = a["href"]
                    break

        if not narrator_link:
            return None
        if narrator_link.startswith("/"):
            narrator_link = "https://www.dorar.net" + narrator_link

        html2 = _get(narrator_link)
        soup2 = BeautifulSoup(html2, "html.parser")
        out   = {}

        # ── Nom arabe ────────────────────────────────────────────────
        for sel in [
            "h1.narrator-name", ".narrator-full-name", "h1.rawi-name",
            "h1", ".narrator-title", "h2.narrator-name", "h2"
        ]:
            el = soup2.select_one(sel)
            if el:
                t = _clean(el.get_text())
                if t and len(t) > 3:
                    out["nom_ar"] = t
                    break

        # ── Métadonnées tableau (tabaqa, wafat, nasab…) ──────────────
        for row in soup2.select("table tr, div.narrator-meta div.row, dl dt"):
            cells = row.select("td") or row.select("dd")
            if len(cells) >= 2:
                lbl = _clean(cells[0].get_text())
                val = _clean(cells[1].get_text())
            elif row.name == 'dt':
                lbl = _clean(row.get_text())
                dd  = row.find_next_sibling('dd')
                val = _clean(dd.get_text()) if dd else ''
            else:
                continue
            if re.search(r'طبق|الطبقه|الطبقة', lbl):
                out["tabaqa"] = val
            if re.search(r'وف[اى]|توف|المتوف|سنة\s+الوفاة', lbl):
                out["wafat"] = val
            if re.search(r'الكنية', lbl):
                out["kunya"] = val
            if re.search(r'النسب|البلد|الوطن', lbl):
                out["nasab"] = val

        # ── Mashayikh (shuyukh) — ISNAD uniquement ───────────────────
        mash, mash_seen = [], set()
        shuyukh_selectors = [
            "div.shuyukh a[href*='/rijal/']",
            "div#shuyukh a[href*='/rijal/']",
            "ul.shuyukh a",
            "div[id*='shuyukh'] a[href*='/rijal/']",
            "div[class*='shuyukh'] a[href*='/rijal/']",
            "section.mashayikh a[href*='/rijal/']",
            "div.narrator-shuyukh a",
            # Fallback générique : tout lien vers un narrateur dans une div shuyukh
            "div:has(> h3:contains('شيوخه')) a[href*='/rijal/']",
        ]
        for sel in shuyukh_selectors:
            try:
                found = soup2.select(sel)
            except Exception:
                continue
            for a in found[:30]:
                n = _clean(a.get_text())
                k = _norm(n)
                if n and len(n) > 2 and k not in mash_seen and not _is_contemporary(n):
                    mash_seen.add(k)
                    mash.append(n)
            if mash:
                break  # on s'arrête au premier sélecteur productif
        out["mashayikh"] = mash[:18]

        # ── Talamidh (disciples) ─────────────────────────────────────
        tala, tala_seen = [], set()
        talamidh_selectors = [
            "div.talamidh a[href*='/rijal/']",
            "div#talamidh a[href*='/rijal/']",
            "ul.talamidh a",
            "div[id*='talamidh'] a[href*='/rijal/']",
            "div[class*='talamidh'] a[href*='/rijal/']",
            "section.talamidh a[href*='/rijal/']",
            "div.narrator-talamidh a",
            "div:has(> h3:contains('تلاميذه')) a[href*='/rijal/']",
        ]
        for sel in talamidh_selectors:
            try:
                found = soup2.select(sel)
            except Exception:
                continue
            for a in found[:30]:
                n = _clean(a.get_text())
                k = _norm(n)
                if n and len(n) > 2 and k not in tala_seen and not _is_contemporary(n):
                    tala_seen.add(k)
                    tala.append(n)
            if tala:
                break
        out["talamidh"] = tala[:18]

        # ── Jarh wa Ta'dil — jugements des imams classiques ──────────
        jugements = []
        jarh_selectors = [
            "div.jarh-tadil",
            "div.aqwal-ulama",
            "div.narrator-judgments",
            "div[class*='jarh']",
            "div[class*='tadil']",
            "div[class*='aqwal']",
            "div[id*='jarh']",
            "div[id*='aqwal']",
            "table.aqwal",
            "div.aqwal",
        ]
        for sel in jarh_selectors:
            block = soup2.select_one(sel)
            if not block:
                continue
            rows = block.select("tr, li, div.item, div.qawl-item, div.judgment-row")
            if not rows:
                # fallback : paires (strong/b + p)
                for strong in block.select("strong, b")[:15]:
                    s   = _clean(strong.get_text())
                    p   = strong.find_next_sibling(["p", "span", "div"])
                    txt = _clean(p.get_text()) if p else ""
                    src_el = block.select_one(".source, cite, small")
                    src = _clean(src_el.get_text()) if src_el else ""
                    if _is_contemporary(s):
                        continue
                    if s or txt:
                        jugements.append({
                            "scholar": s, "ar": txt, "fr": "", "src": src, "classe": ""
                        })
            else:
                for row in rows[:18]:
                    s_el   = row.select_one("td:first-child, .scholar-name, strong, b, .imam-name")
                    t_el   = row.select_one("td:last-child, .qawl-text, p, .judgment-text")
                    src_el = row.select_one(".source, cite, small, .book-ref")
                    s   = _clean(s_el.get_text())   if s_el   else ""
                    t   = _clean(t_el.get_text())   if t_el   else ""
                    src = _clean(src_el.get_text()) if src_el else ""
                    if _is_contemporary(s):
                        continue
                    if s or t:
                        jugements.append({
                            "scholar": s, "ar": t, "fr": "", "src": src, "classe": ""
                        })
            if jugements:
                break

        out["jugements"] = jugements[:14]
        return out

    except Exception:
        return None

# ════════════════════════════════════════════════════════════════════
#  SOURCE B — Extraction depuis les chaînes isnad de hadiths
#  Sélecteurs STRICTS : on isole la zone sanad avant tout traitement.
#  Les blocs sharh, tahrij, matn, commentaire sont IGNORÉS.
# ════════════════════════════════════════════════════════════════════
def _fetch_from_isnad_chains(name_q):
    """
    Cherche les hadiths où name_q apparaît comme narrateur,
    puis extrait ses shuyukh (avant) et talamidh (après) dans la chaîne.
    """
    if not BS4_OK:
        return None

    result = {
        "nom_ar":        "",
        "mashayikh":     [],
        "talamidh":      [],
        "jugements_raw": [],
        "tabaqa":        "",
    }
    mash_seen = set()
    tala_seen = set()

    try:
        # Page 1 + page 2 pour plus de résultats
        for page in [1, 2]:
            html = _get("https://www.dorar.net/hadith/search", {
                "q":    name_q,
                "t":    "narrator",
                "page": page,
            })
            soup = BeautifulSoup(html, "html.parser")

            # ── Isoler UNIQUEMENT les conteneurs isnad ───────────────
            isnad_blocks = []
            for sel in _ISNAD_SELECTORS:
                try:
                    blocks = soup.select(sel)
                    isnad_blocks.extend(blocks)
                except Exception:
                    continue

            # Dédupliquer les blocs (même objet référencé plusieurs fois)
            seen_ids = set()
            unique_blocks = []
            for b in isnad_blocks:
                bid = id(b)
                if bid not in seen_ids:
                    seen_ids.add(bid)
                    unique_blocks.append(b)
            isnad_blocks = unique_blocks

            # Fallback : si aucun sélecteur isnad ne fonctionne,
            # prendre le premier enfant textuel de chaque bloc hadith
            if not isnad_blocks:
                for block in soup.select(
                    "div.hadith-item, div.hadith-container, "
                    "article.hadith, div.result-item"
                )[:20]:
                    first = block.find(["div", "p", "span"])
                    if first:
                        isnad_blocks.append(first)

            qnorm = _norm(name_q)

            for block in isnad_blocks[:30]:
                # ── Narrateurs du bloc via liens /rijal/ ou data-attrs ─
                narrator_els = block.select(
                    "a[href*='/rijal/'], "
                    "span[data-narrator-id], "
                    "span[data-narrator], "
                    "span.narrator-in-isnad, "
                    "a[class*='narrator'], "
                    "span[class*='narrator']"
                )
                # Fallback : tous les <a> qui pointent vers /rijal/
                if not narrator_els:
                    narrator_els = [
                        a for a in block.select("a")
                        if "/rijal/" in a.get("href", "")
                    ]

                for i, el in enumerate(narrator_els):
                    n    = _clean(el.get_text())
                    nk   = _norm(n)

                    if not n or len(n) < 3 or _is_contemporary(n):
                        continue

                    # Est-ce notre narrateur recherché ?
                    is_match = (
                        (qnorm[:5] and qnorm[:5] in nk) or
                        (nk[:5]   and nk[:5]   in qnorm)
                    )

                    if is_match:
                        # Mémoriser le nom arabe
                        if not result["nom_ar"] and len(n) > 4:
                            result["nom_ar"] = n

                        # Shaykh = narrateur AVANT dans la chaîne
                        if i > 0:
                            prev = _clean(narrator_els[i - 1].get_text())
                            pk   = _norm(prev)
                            if (prev and len(prev) > 2
                                    and not _is_contemporary(prev)
                                    and pk not in mash_seen):
                                mash_seen.add(pk)
                                result["mashayikh"].append(prev)

                        # Talmidh = narrateur APRÈS dans la chaîne
                        if i < len(narrator_els) - 1:
                            nxt = _clean(narrator_els[i + 1].get_text())
                            nk2 = _norm(nxt)
                            if (nxt and len(nxt) > 2
                                    and not _is_contemporary(nxt)
                                    and nk2 not in tala_seen):
                                tala_seen.add(nk2)
                                result["talamidh"].append(nxt)

                    # Grade via data-attributes (toujours utile)
                    grade = (
                        el.get("data-grade") or
                        el.get("data-hukm")  or
                        el.get("data-verdict") or
                        el.get("title", "")
                    )
                    if grade and len(grade) > 2 and not _is_contemporary(grade):
                        result["jugements_raw"].append(_clean(grade))

                # Arrêt anticipé si on a suffisamment de données
                if len(result["mashayikh"]) >= 15 and len(result["talamidh"]) >= 15:
                    break

            if len(result["mashayikh"]) >= 10 and len(result["talamidh"]) >= 10:
                break  # pas besoin de la page 2

    except Exception:
        pass

    return result

# ════════════════════════════════════════════════════════════════════
#  SOURCE C — JSON interne /rijal/search (API Dorar non documentée)
# ════════════════════════════════════════════════════════════════════
def _fetch_rijal_json(name_q):
    """
    Appelle l'endpoint JSON de Dorar pour récupérer les métadonnées
    brutes (grade, death_year, bio…) sans scraping HTML.
    """
    try:
        data = _get_json(
            "https://www.dorar.net/rijal/search",
            {"q": name_q, "page": 1}
        )
        items = (
            data.get("data") or
            data.get("results") or
            data.get("narrators") or
            (data if isinstance(data, list) else [])
        )
        qnorm = _norm(name_q)
        for item in items[:8]:
            nf = _first(
                item.get("name"), item.get("full_name"),
                item.get("narrator_name"), item.get("ar_name"),
                item.get("nom")
            )
            if nf and qnorm[:4] in _norm(nf):
                return item
        # Fallback : premier résultat si aucune correspondance stricte
        if items:
            return items[0]
    except Exception:
        pass
    return None

# ════════════════════════════════════════════════════════════════════
#  ASSEMBLAGE — Fusion des 3 sources en une réponse JSON unifiée
# ════════════════════════════════════════════════════════════════════
_TITRE_MAP = {
    "THIQAH": (
        "Narrator of high reliability — Thiqah",
        "Accepted without reservation in the six canonical collections"
    ),
    "SADOUQ": (
        "Truthful narrator — Sadouq",
        "Generally accepted — minor reservations occasionally noted"
    ),
    "DA'IF": (
        "Weak narrator — Da'if",
        "Transmitted with caution — independent corroboration required"
    ),
    "MAWDU'": (
        "Severely criticized — Matruk / Kadhdhab",
        "Narrations rejected by scholarly consensus — not used as evidence"
    ),
}

_TABAQA_EN = {
    'الصحابة':          'Ṣaḥāba',
    'كبار التابعين':    'Senior Tābi'ūn',
    'التابعين':         'Tābi'ūn',
    'تابعو التابعين':   'Tābi' al-Tābi'ūn',
    'أتباع التابعين':   'Tābi' al-Tābi'ūn',
    'الطبقة الوسطى':    'Middle Generation',
    'المتأخرون':        'Later Narrators',
}

def _tabaqa_label(raw):
    """Ajoute un label latin à la ṭabaqa si disponible."""
    if not raw:
        return raw
    for ar, en in _TABAQA_EN.items():
        if ar in raw:
            return raw + " — " + en
    return raw

def _merge_lists(a, b):
    """Fusionne deux listes en dédupliquant et en excluant les contemporains."""
    seen, out = set(), []
    for n in (a or []) + (b or []):
        item = str(n.get("nom", n) if isinstance(n, dict) else n)
        k    = _norm(item)
        if k and k not in seen and not _is_contemporary(item):
            seen.add(k)
            out.append(item)
    return out

def _build_response(name_q, pd, id_, rj):
    pd  = pd  or {}
    id_ = id_ or {}
    rj  = rj  or {}

    # ── Squelette de la réponse ──────────────────────────────────────
    r = {
        "found":         True,
        "nom_fr":        name_q,
        "nom_ar":        _first(
                             pd.get("nom_ar"),
                             id_.get("nom_ar"),
                             rj.get("name") or rj.get("full_name") or rj.get("ar_name"),
                             name_q
                         ),
        "kunya":         pd.get("kunya", ""),
        "nasab":         pd.get("nasab", ""),
        "tabaqa":        _tabaqa_label(_first(
                             pd.get("tabaqa"),
                             id_.get("tabaqa"),
                             rj.get("generation") or rj.get("tabaqa")
                         )),
        "statut":        "THIQAH",
        "pills":         [],
        "verdict_titre": "",
        "verdict_sous":  "",
        "barres":        [],
        "jugements":     [],
        "mashayikh":     [],
        "talamidh":      [],
        "rihla":         "",
        "rihla_quote_ar":  "",
        "rihla_quote_fr":  "",
        "rihla_quote_src": "",
    }

    # ── Jugements ────────────────────────────────────────────────────
    jugements = list(pd.get("jugements") or [])
    if not jugements:
        for raw in (id_.get("jugements_raw") or [])[:12]:
            if raw and len(raw) > 2:
                jugements.append({
                    "scholar": "",
                    "ar":      raw,
                    "fr":      "",
                    "src":     "",
                    "classe":  "",
                })

    # Classifier chaque jugement individuellement
    for j in jugements:
        if not j.get("classe"):
            _, jcls, _ = _classify(
                (j.get("ar") or "") + " " + (j.get("scholar") or "")
            )
            j["classe"] = jcls

    # Verdict global = analyse de TOUS les textes combinés
    all_text  = " ".join(
        (j.get("ar") or "") + " " + (j.get("scholar") or "")
        for j in jugements
    )
    rj_grade  = _first(
        rj.get("grade"), rj.get("status"),
        rj.get("verdict"), rj.get("hukm"), rj.get("rank")
    )
    v_lbl, v_cls, v_score = _classify(all_text + " " + (rj_grade or ""))
    r["statut"]   = v_lbl
    r["jugements"] = jugements[:14]

    # ── Mashayikh / Talamidh ─────────────────────────────────────────
    r["mashayikh"] = _merge_lists(pd.get("mashayikh"), id_.get("mashayikh"))[:18]
    r["talamidh"]  = _merge_lists(pd.get("talamidh"),  id_.get("talamidh"))[:18]

    # ── Rihla (notice biographique textuelle) ────────────────────────
    wafat = _first(
        pd.get("wafat"),
        rj.get("death_year") or rj.get("wafat") or rj.get("died")
    )
    parts = []
    if r["nom_ar"] and _norm(r["nom_ar"]) != _norm(name_q):
        parts.append("الاسم الكامل : " + r["nom_ar"])
    if r["kunya"]:
        parts.append("الكنية : " + r["kunya"])
    if r["nasab"]:
        parts.append("النسب / البلد : " + r["nasab"])
    if r["tabaqa"]:
        parts.append("الطبقة : " + r["tabaqa"])
    if wafat:
        parts.append("الوفاة : " + wafat)
    if rj.get("bio"):
        parts.append(rj["bio"])
    r["rihla"] = "\n\n".join(parts)

    # Citation tirée du premier jugement solide
    for j in jugements:
        if j.get("ar") and len(j["ar"]) > 12:
            r["rihla_quote_ar"]  = j["ar"]
            r["rihla_quote_src"] = j.get("src", "")
            break

    # ── Pills (badges d'en-tête) ─────────────────────────────────────
    pcls = {
        "THIQAH": "mzRw-pill-green",
        "SADOUQ": "mzRw-pill-gold",
        "DA'IF":  "mzRw-pill-red",
        "MAWDU'": "mzRw-pill-red",
    }.get(v_lbl, "mzRw-pill-silver")

    pills = [{"label": v_lbl, "cls": pcls}]
    if r["tabaqa"]:
        pills.append({"label": r["tabaqa"].split(" — ")[0], "cls": "mzRw-pill-blue"})
    if wafat:
        pills.append({"label": wafat, "cls": "mzRw-pill-silver"})
    if r["mashayikh"]:
        pills.append({"label": str(len(r["mashayikh"])) + " SHUYUKH",  "cls": "mzRw-pill-gold"})
    if r["talamidh"]:
        pills.append({"label": str(len(r["talamidh"]))  + " TALAMIDH", "cls": "mzRw-pill-gold"})
    r["pills"] = pills

    # ── Verdict texte ────────────────────────────────────────────────
    titre, sous = _TITRE_MAP.get(v_lbl, (
        "Narrator documented in the Rijal corpus",
        "Consult the classical biographical dictionaries for details"
    ))
    r["verdict_titre"] = titre
    r["verdict_sous"]  = sous

    # ── Barres de scores ─────────────────────────────────────────────
    mash_pct  = min(100, len(r["mashayikh"]) * 6)
    tala_pct  = min(100, len(r["talamidh"])  * 5)
    judge_pct = min(100, len(r["jugements"]) * 10)
    bar_col   = (
        "#22c55e" if v_score >= 80 else
        "#f59e0b" if v_score >= 50 else
        "#ef4444"
    )
    r["barres"] = [
        {"label": "RELIABILITY", "pct": v_score,   "color": bar_col},
        {"label": "MASHAYIKH",   "pct": mash_pct,  "color": "#d4af37"},
        {"label": "TALAMIDH",    "pct": tala_pct,  "color": "#93c5fd"},
        {"label": "JARH REFS",   "pct": judge_pct, "color": "#a78bfa"},
    ]

    return r

# ════════════════════════════════════════════════════════════════════
#  HANDLER VERCEL — Route GET /api/rawi?name=<nom>
# ════════════════════════════════════════════════════════════════════
class handler(BaseHTTPRequestHandler):

    def log_message(self, fmt, *a):
        pass  # Silence les logs HTTP natifs

    def _json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type",   "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control",  "public, max-age=3600, stale-while-revalidate=86400")
        self.send_header("Access-Control-Allow-Origin",  "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin",  "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept")
        self.end_headers()

    def do_GET(self):
        try:
            parsed = urllib.parse.urlparse(self.path)
            params = urllib.parse.parse_qs(parsed.query)
            name_q = (params.get("name") or [""])[0].strip()

            if not name_q:
                self._json({"found": False, "error": "missing ?name= parameter"}, 400)
                return

            # ── Appels parallèles aux 3 sources (séquentiels ici) ────
            pd, id_, rj = None, None, None
            try:
                pd  = _fetch_narrator_page(name_q)
            except Exception:
                pass
            try:
                rj  = _fetch_rijal_json(name_q)
            except Exception:
                pass
            try:
                id_ = _fetch_from_isnad_chains(name_q)
            except Exception:
                pass

            # ── Vérifier qu'on a au moins quelque chose ───────────────
            def _has_data(d):
                return bool(d and any(v for v in d.values() if v))

            if not _has_data(pd) and not rj and not _has_data(id_):
                self._json({"found": False, "name": name_q})
                return

            self._json(_build_response(name_q, pd, id_, rj))

        except Exception as e:
            self._json({"found": False, "error": str(e)}, 500)
