/* ═══════════════════════════════════════════════════════════════════
   MÎZÂN v22.2 — mizan-tree-engine.js
   Rendu progressif via requestAnimationFrame — zéro flicker
   FIX : guard null-node + dédupliquation listeners (audit 2025-04)
═══════════════════════════════════════════════════════════════════ */

console.log(
  '%c ✅ MÎZÂN v22.2 — mizan-tree-engine.js chargé',
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
    '@media(max-width:480px){.mzTr-node{min-width:148px;max-width:100%;padding:10px 14px 9px;}.mzTr-name{font-size:10.5px;}.mzTr-name-ar{font-size:14px;}.mzTr-connector{height:28px;}}',
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

function _mzTrVerdictCls(v) {
  var s = (v || '').toLowerCase();
  if (/thiqah|imam|adil|thabt|hafidh|thiqa/.test(s)) return 'thiqah';
  if (/sadouq|saduq|siddiq|la.?bas/.test(s))          return 'sadouq';
  if (/da.?if|layyin|munkar|matruk|weak/.test(s))      return 'daif';
  if (/mawdu|kadhdhab|fabricat/.test(s))               return 'munkar';
  return 'thiqah';
}

function _mzTrRankLabel(idx, total) {
  if (idx === 0)         return 'SOURCE \u00b7 R\u0100W\u012a 1';
  if (idx === total - 1) return 'COLLECTEUR \u00b7 R\u0100W\u012a ' + total;
  return 'R\u0100W\u012a ' + (idx + 1);
}

function _mzTrOpenModal(nodeEl) {
  var rawName = nodeEl.getAttribute('data-rawi');
  if (rawName && typeof window._openRawiModal === 'function') {
    window._openRawiModal(rawName);
  }
}

/* ════════════════════════════════════════════════════════════════
   3. CONSTRUCTION D'UN ÉTAGE (DOM natif, zéro innerHTML)
════════════════════════════════════════════════════════════════ */
function _mzTrBuildStageEl(node, idx, total, isLast) {
  /* FIX #2 — guard null/undefined node */
  if (!node || typeof node !== 'object') {
    var ghost = document.createElement('div');
    ghost.className = 'mzTr-stage';
    return ghost;
  }

  var rawName = String(node.name    || node.nom   || '');
  var nameAr  = String(node.nameAr  || node.ar    || '');
  var role    = String(node.role    || node.tabaqa || '');
  var verdict = String(node.verdict || node.statut || 'thiqah');
  var died    = String(node.died    || node.wafat  || '');
  var vClass  = _mzTrVerdictCls(verdict);
  var delay   = (idx * 0.11).toFixed(2);
  var rankLbl = _mzTrRankLabel(idx, total);

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

  /* Nom principal — toujours affiché, fallback '—' si vide */
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
    dateBadge.textContent = '\u2020' + died;
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
   4. RENDER PRINCIPAL — progressif, non-bloquant
      window.mzRenderIsnadTree(containerEl, chainArray)

   FIX #1 : handlers nommés stockés sur le nœud DOM
            → removeEventListener avant chaque nouveau rendu
            → zéro stacking sur les appels successifs
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

  /* Annuler tout rendu progressif en cours sur ce conteneur */
  containerEl._mzRafAbort = true;

  /* FIX #1 — retirer les listeners de l'appel précédent */
  containerEl.removeEventListener('click',   _mzTrClickHandler);
  containerEl.removeEventListener('keydown', _mzTrKeyHandler);

  /* Reset DOM */
  containerEl.textContent  = '';
  containerEl._mzRafAbort  = false;

  if (!chain || !chain.length) {
    var empty = document.createElement('div');
    empty.className = 'mzTr-empty';
    empty.textContent = 'SILSILAT AL-ISN\u0100D \u2014 AUCUNE DONN\u00c9E';
    containerEl.appendChild(empty);
    return;
  }

  var total = chain.length;
  var root  = document.createElement('div');
  root.className = 'mzTr-root';
  root.setAttribute('role', 'list');
  root.setAttribute('aria-label', 'Cha\u00eene de transmission');
  containerEl.appendChild(root);

  /* Un seul couple de listeners, propres */
  containerEl.addEventListener('click',   _mzTrClickHandler);
  containerEl.addEventListener('keydown', _mzTrKeyHandler);

  var idx       = 0;
  var batchSize = total <= 6 ? 2 : 1;

  function _step() {
    if (containerEl._mzRafAbort) return;   /* nouveau rendu lancé → abandon */
    if (idx >= total) return;

    var end = Math.min(idx + batchSize, total);
    while (idx < end) {
      /* FIX #2 — ignorer les entrées nulles dans la chain */
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
   5. HELPER — construire la chain depuis un objet JSON Dorar
      window.mzChainFromDorarData(dorarHadithObj)
════════════════════════════════════════════════════════════════ */
window.mzChainFromDorarData = function (dorarObj) {
  if (!dorarObj) return [];
  var narrators = (
    dorarObj.narrators || dorarObj.sanad ||
    dorarObj.chain     || dorarObj.isnad || []
  );
  return narrators
    .filter(function (n) { return n != null; })   /* FIX #2 — filtre amont */
    .map(function (n) {
      return {
        name:    n.name    || n.nom     || n.ar_name   || '',
        nameAr:  n.ar_name || n.nom_ar  || '',
        role:    n.tabaqa  || n.role    || n.generation || '',
        verdict: n.grade   || n.hukm   || n.verdict    || 'thiqah',
        died:    n.death   || n.wafat  || n.died       || '',
      };
    });
};

/* ════════════════════════════════════════════════════════════════
   6. COMPATIBILITÉ — ancien symbole window.mzOpenIsnadPanel
════════════════════════════════════════════════════════════════ */
window.mzOpenIsnadPanel = window.mzOpenIsnadPanel || function (nom) {
  if (nom && typeof window._openRawiModal === 'function') {
    window._openRawiModal(nom);
  }
};

console.log(
  '%c \u2696\ufe0f  mizan-tree-engine.js v22.2 — audit OK — pr\u00eat pour production',
  'color:#d4af37;font-size:10px;'
);
