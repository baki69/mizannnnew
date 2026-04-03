/* ═══════════════════════════════════════════════════════════════════
   MÎZÂN v22.3 — mizan-tree-engine.js
   Rendu progressif via requestAnimationFrame — zéro flicker

   CORRECTIONS v22.3 (Audit Croisé 2025-04) :
     FIX-1 · nameAr  : ajoute n.name_ar dans la lookup (mismatch Python)
     FIX-2 · mashayikh/talamidh : propagés depuis mzChainFromDorarData
     FIX-3 · Modal   : registre _mzNodeRegistry + _openRawiModal intégré
     FIX-4 · Verdict : regex arabes ajoutées dans _mzTrVerdictCls
     FIX-5 · Tri JS  : garde-fou death_year dans mzRenderIsnadTree
═══════════════════════════════════════════════════════════════════ */

console.log(
  '%c ✅ MÎZÂN v22.3 — mizan-tree-engine.js chargé',
  'color:#d4af37;font-weight:bold;font-size:11px;'
);

/* ════════════════════════════════════════════════════════════════
   1. CSS — injection unique, idempotente
════════════════════════════════════════════════════════════════ */
(function _mzInjectTreeCSS() {
  var old = document.getElementById('mz-tree-css');
  if (old) old.remove();
  var s = document.createElement('style');
  s.id = 'mz-tree-css';
  s.textContent = [
    '@keyframes mzTrNodeIn{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}',
    '@keyframes mzTrGlow{0%,100%{box-shadow:0 0 0 1px rgba(212,175,55,.08),0 4px 20px rgba(0,0,0,.7)}50%{box-shadow:0 0 0 1px rgba(212,175,55,.18),0 0 24px rgba(212,175,55,.32),0 4px 28px rgba(0,0,0,.8)}}',
    '@keyframes mzTrConnIn{from{opacity:0;transform:scaleY(0);transform-origin:top}to{opacity:1;transform:scaleY(1);transform-origin:top}}',
    '@keyframes mzTrBadgeIn{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}',
    '@keyframes mzTrPulse{0%,100%{opacity:.5}50%{opacity:1}}',
    '@keyframes mzModalIn{from{opacity:0;transform:translateY(18px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}',
    '@keyframes mzOverlayIn{from{opacity:0}to{opacity:1}}',

    '.mzTr-root{display:flex;flex-direction:column;align-items:center;gap:0;padding:28px 16px 36px;font-family:Cinzel,Georgia,serif;background:transparent;width:100%;box-sizing:border-box;}',
    '.mzTr-stage{display:flex;flex-direction:column;align-items:center;width:100%;}',
    '.mzTr-node{position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer;user-select:none;padding:12px 24px 11px;min-width:190px;max-width:340px;width:auto;background:linear-gradient(158deg,#0e0900 0%,#090600 55%,#0b0b11 100%);border:1px solid rgba(212,175,55,.22);border-radius:3px;box-shadow:0 0 0 1px rgba(212,175,55,.04),0 5px 24px rgba(0,0,0,.75),inset 0 1px 0 rgba(212,175,55,.06);transition:border-color .22s,transform .18s;animation:mzTrNodeIn .5s cubic-bezier(.16,1,.3,1) both;text-align:center;}',
    '.mzTr-node::before{content:"";position:absolute;top:0;left:0;right:0;height:1.5px;background:linear-gradient(90deg,transparent,rgba(212,175,55,.38) 25%,rgba(212,175,55,.65) 50%,rgba(212,175,55,.38) 75%,transparent);border-radius:3px 3px 0 0;}',
    '.mzTr-node:hover{border-color:rgba(212,175,55,.6);transform:scale(1.035) translateY(-1px);animation:mzTrGlow 2.2s ease-in-out infinite;}',
    '.mzTr-node:hover .mzTr-name{color:#fde68a;}',
    '.mzTr-node:hover .mzTr-click-hint{color:rgba(212,175,55,.7);}',
    '.mzTr-node:focus-visible{outline:none;border-color:rgba(212,175,55,.75);box-shadow:0 0 0 2px rgba(212,175,55,.28),0 5px 24px rgba(0,0,0,.75);}',
    '.mzTr-rank{font-size:5px;letter-spacing:.5em;color:rgba(212,175,55,.2);margin-bottom:3px;text-transform:uppercase;}',
    '.mzTr-role{font-size:5.5px;letter-spacing:.38em;color:rgba(212,175,55,.32);margin-bottom:5px;text-transform:uppercase;}',
    '.mzTr-name{font-size:11.5px;font-weight:700;letter-spacing:.055em;color:rgba(224,204,148,.9);line-height:1.35;transition:color .18s;}',
    '.mzTr-name-ar{font-family:"Scheherazade New","Amiri",serif;font-size:15px;color:rgba(212,175,55,.44);direction:rtl;margin-top:4px;line-height:1.5;}',
    '.mzTr-meta{display:flex;gap:5px;justify-content:center;flex-wrap:wrap;margin-top:7px;}',
    '.mzTr-badge{font-size:5.5px;letter-spacing:.12em;font-weight:700;padding:2.5px 7px;border-radius:2px;animation:mzTrBadgeIn .35s ease both;}',
    '.mzTr-badge-thiqah{background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.28);color:#4ade80;}',
    '.mzTr-badge-sadouq{background:rgba(212,175,55,.09);border:1px solid rgba(212,175,55,.26);color:#d4af37;}',
    '.mzTr-badge-daif{background:rgba(245,158,11,.09);border:1px solid rgba(245,158,11,.28);color:#fbbf24;}',
    '.mzTr-badge-munkar{background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.26);color:#f87171;}',
    '.mzTr-badge-date{background:rgba(96,165,250,.06);border:1px solid rgba(96,165,250,.2);color:#93c5fd;}',
    '.mzTr-connector{position:relative;width:2px;height:38px;flex-shrink:0;background:linear-gradient(180deg,rgba(212,175,55,.55) 0%,rgba(212,175,55,.15) 100%);animation:mzTrConnIn .4s ease both;}',
    '.mzTr-connector::after{content:"";position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid rgba(212,175,55,.42);}',
    '.mzTr-connector::before{content:"";position:absolute;top:-3px;left:50%;transform:translateX(-50%);width:5px;height:5px;border-radius:50%;background:rgba(212,175,55,.45);}',
    '.mzTr-node-terminal{border-color:rgba(212,175,55,.48);background:linear-gradient(158deg,#120c00 0%,#0d0800 55%,#0e0e18 100%);}',
    '.mzTr-node-terminal::before{background:linear-gradient(90deg,transparent,rgba(212,175,55,.6) 20%,#d4af37 50%,rgba(212,175,55,.6) 80%,transparent);}',
    '.mzTr-node-terminal::after{content:"";position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(212,175,55,.28),transparent);}',
    '.mzTr-click-hint{position:absolute;top:5px;right:7px;font-size:10px;color:rgba(212,175,55,.18);transition:color .2s;pointer-events:none;line-height:1;letter-spacing:.1em;}',
    '.mzTr-empty{font-family:Cinzel,serif;font-size:7px;letter-spacing:.28em;color:rgba(212,175,55,.18);padding:32px;text-align:center;animation:mzTrPulse 2s ease-in-out infinite;}',

    /* ── Modal ── */
    '.mzModal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.72);backdrop-filter:blur(3px);z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px;animation:mzOverlayIn .2s ease both;}',
    '.mzModal{position:relative;width:100%;max-width:520px;max-height:82vh;overflow-y:auto;background:linear-gradient(160deg,#0e0900 0%,#080500 60%,#0a0a14 100%);border:1px solid rgba(212,175,55,.32);border-radius:4px;box-shadow:0 0 0 1px rgba(212,175,55,.08),0 24px 64px rgba(0,0,0,.9);padding:28px 28px 24px;animation:mzModalIn .3s cubic-bezier(.16,1,.3,1) both;font-family:Cinzel,Georgia,serif;}',
    '.mzModal::before{content:"";position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,rgba(212,175,55,.5) 25%,#d4af37 50%,rgba(212,175,55,.5) 75%,transparent);}',
    '.mzModal-close{position:absolute;top:12px;right:14px;background:none;border:none;color:rgba(212,175,55,.4);font-size:18px;cursor:pointer;line-height:1;padding:4px 8px;border-radius:2px;transition:color .18s;}',
    '.mzModal-close:hover{color:rgba(212,175,55,.9);}',
    '.mzModal-name{font-size:14px;font-weight:700;color:rgba(224,204,148,.95);letter-spacing:.06em;margin-bottom:4px;}',
    '.mzModal-name-ar{font-family:"Scheherazade New","Amiri",serif;font-size:18px;color:rgba(212,175,55,.6);direction:rtl;margin-bottom:12px;line-height:1.6;}',
    '.mzModal-badges{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px;}',
    '.mzModal-section{margin-top:16px;}',
    '.mzModal-section-title{font-size:5.5px;letter-spacing:.45em;color:rgba(212,175,55,.35);text-transform:uppercase;margin-bottom:8px;padding-bottom:5px;border-bottom:1px solid rgba(212,175,55,.1);}',
    '.mzModal-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px;}',
    '.mzModal-list-item{font-size:10px;color:rgba(200,180,120,.8);padding:5px 10px;border-radius:2px;border:1px solid rgba(212,175,55,.08);background:rgba(212,175,55,.03);display:flex;align-items:center;gap:8px;direction:rtl;}',
    '.mzModal-list-item::before{content:"·";color:rgba(212,175,55,.4);flex-shrink:0;}',
    '.mzModal-list-item a{color:rgba(212,175,55,.6);text-decoration:none;font-size:9px;margin-right:auto;}',
    '.mzModal-list-item a:hover{color:rgba(212,175,55,1);}',
    '.mzModal-empty{font-size:9px;color:rgba(212,175,55,.2);letter-spacing:.2em;padding:8px 0;}',
    '.mzModal-year{font-size:9px;color:rgba(147,197,253,.7);margin-top:8px;letter-spacing:.1em;}',

    '@media(max-width:480px){.mzTr-node{min-width:148px;max-width:100%;padding:10px 14px 9px;}.mzTr-name{font-size:10.5px;}.mzTr-name-ar{font-size:14px;}.mzTr-connector{height:28px;}.mzModal{padding:20px 16px 18px;}}',
  ].join('\n');
  document.head.appendChild(s);
})();

/* ════════════════════════════════════════════════════════════════
   2. HELPERS
════════════════════════════════════════════════════════════════ */
function _mzTrEsc(str) {
  return String(str || '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

/*
 * FIX-4 — Verdict : regex arabes ajoutées.
 * v22.2 ne testait que l'alphabet latin → "ثقة حافظ" tombait toujours
 * dans le fallback 'thiqah' par coïncidence (inoffensif mais incorrect).
 * "ضعيف" et "موضوع" n'étaient jamais colorés en daif/munkar.
 */
function _mzTrVerdictCls(v) {
  var s = (v || '').toLowerCase();
  /* Latin */
  if (/thiqah|imam|adil|thabt|hafidh|thiqa/.test(s))  return 'thiqah';
  if (/sadouq|saduq|siddiq|la.?bas/.test(s))           return 'sadouq';
  if (/da.?if|layyin|matruk|weak/.test(s))             return 'daif';
  if (/mawdu|kadhdhab|fabricat/.test(s))               return 'munkar';
  /* Arabe — FIX-4 */
  if (/ثقة|إمام|حافظ|عدل|ثبت/.test(v))               return 'thiqah';
  if (/صدوق|لا بأس|محله الصدق/.test(v))              return 'sadouq';
  if (/ضعيف|لين|متروك|منكر الحديث/.test(v))          return 'daif';
  if (/موضوع|كذاب|وضّاع/.test(v))                    return 'munkar';
  return 'thiqah';
}

function _mzTrRankLabel(idx, total) {
  if (idx === 0)         return 'SOURCE \u00b7 R\u0100W\u012a 1';
  if (idx === total - 1) return 'COLLECTEUR \u00b7 R\u0100W\u012a ' + total;
  return 'R\u0100W\u012a ' + (idx + 1);
}

/* ════════════════════════════════════════════════════════════════
   3. REGISTRE DES NŒUDS — FIX-3
   Chaque nœud construit est stocké ici par son nom (clé).
   _mzTrOpenModal récupère l'objet complet (avec mashayikh, talamidh)
   sans avoir à re-fetch l'API.
════════════════════════════════════════════════════════════════ */
var _mzNodeRegistry = new Map();  /* nom → objet nœud complet */

function _mzTrOpenModal(nodeEl) {
  var rawName = nodeEl.getAttribute('data-rawi');
  if (!rawName) return;

  /* FIX-3 : récupérer l'objet complet depuis le registre */
  var nodeData = _mzNodeRegistry.get(rawName) || { name: rawName };

  if (typeof window._openRawiModal === 'function') {
    /* Compatibilité : si un handler externe existe, on le passe l'objet entier */
    window._openRawiModal(rawName, nodeData);
  } else {
    /* Handler intégré — FIX-3 : affiche le modal avec mashayikh/talamidh */
    _mzShowBuiltinModal(nodeData);
  }
}

/* ════════════════════════════════════════════════════════════════
   3b. MODAL INTÉGRÉ — FIX-3
   Affiche les données complètes du rawi (mashayikh + talamidh).
   Remplace l'appel mort à window._openRawiModal inexistant.
════════════════════════════════════════════════════════════════ */
function _mzShowBuiltinModal(node) {
  /* Fermer un éventuel modal précédent */
  var prev = document.getElementById('mz-modal-overlay');
  if (prev) prev.remove();

  var overlay = document.createElement('div');
  overlay.className = 'mzModal-overlay';
  overlay.id = 'mz-modal-overlay';

  var modal = document.createElement('div');
  modal.className = 'mzModal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Biographie du narrateur');

  /* Bouton fermeture */
  var closeBtn = document.createElement('button');
  closeBtn.className = 'mzModal-close';
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', 'Fermer');
  closeBtn.addEventListener('click', function () { overlay.remove(); });
  modal.appendChild(closeBtn);

  /* Nom latin / translittéré */
  var nameEl = document.createElement('div');
  nameEl.className = 'mzModal-name';
  nameEl.textContent = node.name || '—';
  modal.appendChild(nameEl);

  /* Nom arabe */
  if (node.nameAr) {
    var nameArEl = document.createElement('div');
    nameArEl.className = 'mzModal-name-ar';
    nameArEl.textContent = node.nameAr;
    modal.appendChild(nameArEl);
  }

  /* Badges : verdict + date */
  var badges = document.createElement('div');
  badges.className = 'mzModal-badges';

  if (node.verdict) {
    var vBadge = document.createElement('span');
    vBadge.className = 'mzTr-badge mzTr-badge-' + _mzTrVerdictCls(node.verdict);
    vBadge.textContent = node.verdict.toUpperCase();
    badges.appendChild(vBadge);
  }

  /* FIX-5 : afficher death_year (int) si died est absent */
  var diedLabel = node.died || (
    node.death_year && node.death_year !== 9999 && node.death_year !== 0
      ? '\u2020' + node.death_year + 'هـ'
      : node.death_year === 0 ? 'ṢAḤĀBA' : ''
  );
  if (diedLabel) {
    var dateBadge = document.createElement('span');
    dateBadge.className = 'mzTr-badge mzTr-badge-date';
    dateBadge.textContent = diedLabel;
    badges.appendChild(dateBadge);
  }
  modal.appendChild(badges);

  /* Ṭabaqa */
  if (node.role) {
    var tabaqaEl = document.createElement('div');
    tabaqaEl.className = 'mzModal-year';
    tabaqaEl.textContent = node.role;
    modal.appendChild(tabaqaEl);
  }

  /* Section Mashayikh */
  modal.appendChild(
    _mzBuildModalSection('MASHĀYIKH — MAÎTRES', node.mashayikh)
  );

  /* Section Talamidh */
  modal.appendChild(
    _mzBuildModalSection('TALĀMIDH — ÉLÈVES', node.talamidh)
  );

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  /* Fermeture sur clic hors modal */
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) overlay.remove();
  });

  /* Fermeture sur Escape */
  function _onEsc(e) {
    if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', _onEsc); }
  }
  document.addEventListener('keydown', _onEsc);

  /* Focus trap minimal */
  closeBtn.focus();
}

function _mzBuildModalSection(title, list) {
  var section = document.createElement('div');
  section.className = 'mzModal-section';

  var titleEl = document.createElement('div');
  titleEl.className = 'mzModal-section-title';
  titleEl.textContent = title;
  section.appendChild(titleEl);

  var arr = Array.isArray(list) ? list : [];

  if (!arr.length) {
    var empty = document.createElement('div');
    empty.className = 'mzModal-empty';
    empty.textContent = 'DONNÉES INDISPONIBLES';
    section.appendChild(empty);
    return section;
  }

  var ul = document.createElement('ul');
  ul.className = 'mzModal-list';

  arr.forEach(function (item) {
    var li = document.createElement('li');
    li.className = 'mzModal-list-item';

    var itemName = document.createTextNode(item.name || '—');
    li.appendChild(itemName);

    if (item.url) {
      var link = document.createElement('a');
      link.href = item.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = '↗ Dorar';
      li.appendChild(link);
    }

    ul.appendChild(li);
  });

  section.appendChild(ul);
  return section;
}

/* ════════════════════════════════════════════════════════════════
   4. CONSTRUCTION D'UN ÉTAGE (DOM natif, zéro innerHTML)
════════════════════════════════════════════════════════════════ */
function _mzTrBuildStageEl(node, idx, total, isLast) {
  /* Guard null/undefined node */
  if (!node || typeof node !== 'object') {
    var ghost = document.createElement('div');
    ghost.className = 'mzTr-stage';
    return ghost;
  }

  var rawName = String(node.name    || node.nom   || '');
  /*
   * FIX-1 — nameAr : ajoute node.name_ar (champ Python) en priorité.
   * v22.2 cherchait node.nameAr || node.ar → jamais trouvé car Python
   * produit name_ar. Le nom arabe était systématiquement absent des cards.
   */
  var nameAr  = String(node.nameAr  || node.name_ar || node.ar || '');
  var role    = String(node.role    || node.tabaqa  || '');
  var verdict = String(node.verdict || node.statut  || 'thiqah');

  /*
   * FIX-5 — died : fallback sur death_year (int) si le champ texte est vide.
   * Python peut produire died="" mais death_year=852.
   */
  var died = String(node.died || node.wafat || '');
  if (!died && node.death_year && node.death_year !== 9999) {
    died = node.death_year === 0
      ? 'ṢAḤĀBA'
      : '\u2020' + node.death_year + 'هـ';
  }

  var vClass  = _mzTrVerdictCls(verdict);
  var delay   = (idx * 0.11).toFixed(2);
  var rankLbl = _mzTrRankLabel(idx, total);

  /* FIX-3 — enregistrer l'objet complet dans le registre par nom */
  if (rawName) {
    _mzNodeRegistry.set(rawName, {
      name:       rawName,
      nameAr:     nameAr,
      role:       role,
      verdict:    verdict,
      died:       died,
      death_year: typeof node.death_year === 'number' ? node.death_year : 9999,
      /* FIX-2 — conserver mashayikh/talamidh dans le registre */
      mashayikh:  Array.isArray(node.mashayikh) ? node.mashayikh : [],
      talamidh:   Array.isArray(node.talamidh)  ? node.talamidh  : [],
    });
  }

  var stage = document.createElement('div');
  stage.className = 'mzTr-stage';
  stage.setAttribute('role', 'listitem');

  var card = document.createElement('div');
  card.className = 'mzTr-node' + (isLast ? ' mzTr-node-terminal' : '');
  card.style.animationDelay = delay + 's';
  card.setAttribute('data-rawi', rawName);
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', 'Biographie de ' + _mzTrEsc(rawName || 'inconnu'));

  var hint = document.createElement('span');
  hint.className = 'mzTr-click-hint';
  hint.setAttribute('aria-hidden', 'true');
  hint.textContent = '\u2022\u2022\u2022';
  card.appendChild(hint);

  var rankEl = document.createElement('div');
  rankEl.className = 'mzTr-rank';
  rankEl.textContent = rankLbl;
  card.appendChild(rankEl);

  if (role) {
    var roleEl = document.createElement('div');
    roleEl.className = 'mzTr-role';
    roleEl.textContent = role;
    card.appendChild(roleEl);
  }

  var nameEl = document.createElement('div');
  nameEl.className = 'mzTr-name';
  nameEl.textContent = rawName || '\u2014';
  card.appendChild(nameEl);

  if (nameAr) {
    var nameArEl = document.createElement('div');
    nameArEl.className = 'mzTr-name-ar';
    nameArEl.textContent = nameAr;
    card.appendChild(nameArEl);
  }

  var meta = document.createElement('div');
  meta.className = 'mzTr-meta';

  if (verdict) {
    var vBadge = document.createElement('span');
    vBadge.className = 'mzTr-badge mzTr-badge-' + vClass;
    vBadge.style.animationDelay = (parseFloat(delay) + 0.18).toFixed(2) + 's';
    vBadge.textContent = verdict.toUpperCase();
    meta.appendChild(vBadge);
  }

  if (died) {
    var dateBadge = document.createElement('span');
    dateBadge.className = 'mzTr-badge mzTr-badge-date';
    dateBadge.style.animationDelay = (parseFloat(delay) + 0.24).toFixed(2) + 's';
    dateBadge.textContent = died.startsWith('\u2020') ? died : '\u2020' + died;
    meta.appendChild(dateBadge);
  }

  card.appendChild(meta);
  stage.appendChild(card);

  if (!isLast) {
    var conn = document.createElement('div');
    conn.className = 'mzTr-connector';
    conn.style.animationDelay = (idx * 0.11 + 0.08).toFixed(2) + 's';
    conn.setAttribute('aria-hidden', 'true');
    stage.appendChild(conn);
  }

  return stage;
}

/* ════════════════════════════════════════════════════════════════
   5. RENDER PRINCIPAL — progressif, non-bloquant
      window.mzRenderIsnadTree(containerEl, chainArray)
════════════════════════════════════════════════════════════════ */
function _mzTrClickHandler(e) {
  var node = e.target.closest('.mzTr-node');
  if (node) _mzTrOpenModal(node);
}
function _mzTrKeyHandler(e) {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  var node = e.target.closest('.mzTr-node');
  if (node) { e.preventDefault(); _mzTrOpenModal(node); }
}

window.mzRenderIsnadTree = function (containerEl, chain) {
  if (!containerEl) return;

  containerEl._mzRafAbort = true;
  containerEl.removeEventListener('click',   _mzTrClickHandler);
  containerEl.removeEventListener('keydown', _mzTrKeyHandler);
  containerEl.textContent = '';
  containerEl._mzRafAbort = false;

  /* Vider le registre pour ce nouveau rendu */
  _mzNodeRegistry.clear();

  if (!chain || !chain.length) {
    var empty = document.createElement('div');
    empty.className = 'mzTr-empty';
    empty.textContent = 'SILSILAT AL-ISN\u0100D \u2014 AUCUNE DONN\u00c9E';
    containerEl.appendChild(empty);
    return;
  }

  /*
   * FIX-5 — Garde-fou tri JS par death_year.
   * Python trie côté serveur (source de vérité).
   * Si mzRenderIsnadTree est appelé directement avec des nœuds non triés
   * (ex. depuis un cache local), on garantit l'ordre chronologique ici.
   * Condition : tous les nœuds doivent avoir death_year numérique.
   */
  var hasYears = chain.every(function (n) {
    return n != null && typeof n.death_year === 'number';
  });
  if (hasYears) {
    chain = chain.slice().sort(function (a, b) {
      return a.death_year - b.death_year;
    });
  }

  var total = chain.length;
  var root  = document.createElement('div');
  root.className = 'mzTr-root';
  root.setAttribute('role', 'list');
  root.setAttribute('aria-label', 'Cha\u00eene de transmission');
  containerEl.appendChild(root);

  containerEl.addEventListener('click',   _mzTrClickHandler);
  containerEl.addEventListener('keydown', _mzTrKeyHandler);

  var idx       = 0;
  var batchSize = total <= 6 ? 2 : 1;

  function _step() {
    if (containerEl._mzRafAbort) return;
    if (idx >= total) return;

    var end = Math.min(idx + batchSize, total);
    while (idx < end) {
      if (chain[idx] != null) {
        root.appendChild(
          _mzTrBuildStageEl(chain[idx], idx, total, idx === total - 1)
        );
      }
      idx++;
    }

    if (idx < total) requestAnimationFrame(_step);
  }

  requestAnimationFrame(_step);
};

/* ════════════════════════════════════════════════════════════════
   6. HELPER — construire la chain depuis un objet JSON Dorar
      window.mzChainFromDorarData(dorarHadithObj)
════════════════════════════════════════════════════════════════ */
window.mzChainFromDorarData = function (dorarObj) {
  if (!dorarObj) return [];
  var narrators = (
    dorarObj.narrators || dorarObj.sanad ||
    dorarObj.chain     || dorarObj.isnad || []
  );
  return narrators
    .filter(function (n) { return n != null; })
    .map(function (n) {
      return {
        name:    n.name    || n.nom      || n.ar_name  || '',
        /*
         * FIX-1 — nameAr : n.name_ar ajouté en tête de chaîne.
         * Python produit name_ar (snake_case). L'ancienne lookup
         * n.ar_name || n.nom_ar ne le trouvait jamais.
         */
        nameAr:  n.name_ar || n.nameAr   || n.ar_name  || n.nom_ar || '',
        role:    n.tabaqa  || n.role     || n.generation || '',
        verdict: n.grade   || n.hukm    || n.verdict    || 'thiqah',
        died:    n.death   || n.wafat   || n.died       || '',
        /*
         * FIX-5 — death_year : propagé depuis le JSON Python.
         * Verrou Chronologique : cast en Number, fallback 9999.
         * Sans ce champ, le garde-fou sort de mzRenderIsnadTree est inopérant.
         */
        death_year: typeof n.death_year === 'number'
          ? n.death_year
          : (Number(n.death_year) || 9999),
        /*
         * FIX-2 — mashayikh / talamidh : propagés depuis le JSON Python.
         * En v22.2, ces champs étaient silencieusement supprimés dans le .map()
         * et n'atteignaient jamais le modal.
         */
        mashayikh: Array.isArray(n.mashayikh) ? n.mashayikh : [],
        talamidh:  Array.isArray(n.talamidh)  ? n.talamidh  : [],
      };
    });
};

/* ════════════════════════════════════════════════════════════════
   7. COMPATIBILITÉ — ancien symbole window.mzOpenIsnadPanel
════════════════════════════════════════════════════════════════ */
window.mzOpenIsnadPanel = window.mzOpenIsnadPanel || function (nom) {
  var nodeData = _mzNodeRegistry.get(nom);
  if (nodeData) {
    _mzShowBuiltinModal(nodeData);
  } else if (typeof window._openRawiModal === 'function') {
    window._openRawiModal(nom, {});
  }
};

console.log(
  '%c \u2696\ufe0f  mizan-tree-engine.js v22.3 — Audit Croisé OK — pr\u00eat pour production',
  'color:#d4af37;font-size:10px;'
);
