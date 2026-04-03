/* ═══════════════════════════════════════════════════════════════════
   MÎZÂN v22.1 — mizan-tree-engine.js
   Remplace : isnad-tree.js (même API publique, zero changement HTML)
   MODULE   : Arbre de l'Isnad — Layout vertical doré
   API      : window.mzRenderIsnadTree(containerEl, chainArray)
              window.mzChainFromDorarData(dorarObj)
   Chaque nœud déclenche window._openRawiModal(name)
   chainArray = [
     { name:"Nom", role:"Sahabi|Tabi'i|…", verdict:"thiqah|daif|…", died:"150H" },
     …  (ordre : source → collecteur, du HAUT vers le BAS)
   ]
═══════════════════════════════════════════════════════════════════ */

console.log(
  '%c ✅ MÎZÂN v22.1 — mizan-tree-engine.js chargé',
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

    /* ── Keyframes ── */
    '@keyframes mzTrNodeIn{',
    '  from{opacity:0;transform:translateY(14px) scale(.97)}',
    '  to  {opacity:1;transform:translateY(0)    scale(1)}',
    '}',
    '@keyframes mzTrGlow{',
    '  0%,100%{box-shadow:0 0 0 1px rgba(212,175,55,.08),0 4px 20px rgba(0,0,0,.7)}',
    '  50%    {box-shadow:0 0 0 1px rgba(212,175,55,.18),0 0 24px rgba(212,175,55,.32),0 4px 28px rgba(0,0,0,.8)}',
    '}',
    '@keyframes mzTrConnIn{',
    '  from{opacity:0;transform:scaleY(0);transform-origin:top}',
    '  to  {opacity:1;transform:scaleY(1);transform-origin:top}',
    '}',
    '@keyframes mzTrBadgeIn{',
    '  from{opacity:0;transform:scale(.8)}',
    '  to  {opacity:1;transform:scale(1)}',
    '}',
    '@keyframes mzTrPulse{',
    '  0%,100%{opacity:.5}50%{opacity:1}',
    '}',

    /* ── Racine de l'arbre ── */
    '.mzTr-root{',
    '  display:flex;flex-direction:column;align-items:center;',
    '  gap:0;padding:28px 16px 36px;',
    '  font-family:Cinzel,Georgia,serif;',
    '  background:transparent;',
    '  width:100%;box-sizing:border-box;',
    '}',

    /* ── Étage (nœud + connecteur) ── */
    '.mzTr-stage{',
    '  display:flex;flex-direction:column;align-items:center;',
    '  width:100%;',
    '}',

    /* ── Nœud principal ── */
    '.mzTr-node{',
    '  position:relative;',
    '  display:flex;flex-direction:column;align-items:center;',
    '  cursor:pointer;user-select:none;',
    '  padding:12px 24px 11px;',
    '  min-width:190px;max-width:340px;width:auto;',
    '  background:linear-gradient(158deg,#0e0900 0%,#090600 55%,#0b0b11 100%);',
    '  border:1px solid rgba(212,175,55,.22);',
    '  border-radius:3px;',
    '  box-shadow:',
    '    0 0 0 1px rgba(212,175,55,.04),',
    '    0 5px 24px rgba(0,0,0,.75),',
    '    inset 0 1px 0 rgba(212,175,55,.06);',
    '  transition:border-color .22s,transform .18s;',
    '  animation:mzTrNodeIn .5s cubic-bezier(.16,1,.3,1) both;',
    '  text-align:center;',
    '}',

    /* Barre supérieure lumineuse */
    '.mzTr-node::before{',
    '  content:"";position:absolute;top:0;left:0;right:0;height:1.5px;',
    '  background:linear-gradient(',
    '    90deg,transparent,',
    '    rgba(212,175,55,.38) 25%,',
    '    rgba(212,175,55,.65) 50%,',
    '    rgba(212,175,55,.38) 75%,',
    '    transparent',
    '  );',
    '  border-radius:3px 3px 0 0;',
    '}',

    /* Hover */
    '.mzTr-node:hover{',
    '  border-color:rgba(212,175,55,.6);',
    '  transform:scale(1.035) translateY(-1px);',
    '  animation:mzTrGlow 2.2s ease-in-out infinite;',
    '}',
    '.mzTr-node:hover .mzTr-name{color:#fde68a;}',
    '.mzTr-node:hover .mzTr-click-hint{color:rgba(212,175,55,.7);}',

    /* Focus clavier */
    '.mzTr-node:focus-visible{',
    '  outline:none;',
    '  border-color:rgba(212,175,55,.75);',
    '  box-shadow:0 0 0 2px rgba(212,175,55,.28),0 5px 24px rgba(0,0,0,.75);',
    '}',

    /* ── Contenu du nœud ── */

    /* Numéro de génération (1er, 2e rang…) */
    '.mzTr-rank{',
    '  font-size:5px;letter-spacing:.5em;',
    '  color:rgba(212,175,55,.2);',
    '  margin-bottom:3px;text-transform:uppercase;',
    '}',

    /* Rôle / ṭabaqa */
    '.mzTr-role{',
    '  font-size:5.5px;letter-spacing:.38em;',
    '  color:rgba(212,175,55,.32);',
    '  margin-bottom:5px;text-transform:uppercase;',
    '}',

    /* Nom latin */
    '.mzTr-name{',
    '  font-size:11.5px;font-weight:700;letter-spacing:.055em;',
    '  color:rgba(224,204,148,.9);line-height:1.35;',
    '  transition:color .18s;',
    '}',

    /* Nom arabe */
    '.mzTr-name-ar{',
    '  font-family:"Scheherazade New","Amiri",serif;',
    '  font-size:15px;color:rgba(212,175,55,.44);',
    '  direction:rtl;margin-top:4px;line-height:1.5;',
    '}',

    /* Zone badges */
    '.mzTr-meta{',
    '  display:flex;gap:5px;justify-content:center;',
    '  flex-wrap:wrap;margin-top:7px;',
    '}',

    /* Badge générique */
    '.mzTr-badge{',
    '  font-size:5.5px;letter-spacing:.12em;font-weight:700;',
    '  padding:2.5px 7px;border-radius:2px;',
    '  animation:mzTrBadgeIn .35s ease both;',
    '}',

    /* Couleurs verdict */
    '.mzTr-badge-thiqah{background:rgba(34,197,94,.1); border:1px solid rgba(34,197,94,.28);color:#4ade80;}',
    '.mzTr-badge-sadouq{background:rgba(212,175,55,.09);border:1px solid rgba(212,175,55,.26);color:#d4af37;}',
    '.mzTr-badge-daif  {background:rgba(245,158,11,.09);border:1px solid rgba(245,158,11,.28);color:#fbbf24;}',
    '.mzTr-badge-munkar{background:rgba(239,68,68,.07); border:1px solid rgba(239,68,68,.26);color:#f87171;}',
    '.mzTr-badge-date  {background:rgba(96,165,250,.06);border:1px solid rgba(96,165,250,.2); color:#93c5fd;}',

    /* ── Connecteur entre nœuds ── */
    '.mzTr-connector{',
    '  position:relative;',
    '  width:2px;height:38px;flex-shrink:0;',
    '  background:linear-gradient(',
    '    180deg,',
    '    rgba(212,175,55,.55) 0%,',
    '    rgba(212,175,55,.15) 100%',
    '  );',
    '  animation:mzTrConnIn .4s ease both;',
    '}',

    /* Flèche bas */
    '.mzTr-connector::after{',
    '  content:"";',
    '  position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);',
    '  width:0;height:0;',
    '  border-left: 5px solid transparent;',
    '  border-right:5px solid transparent;',
    '  border-top: 6px solid rgba(212,175,55,.42);',
    '}',

    /* Point de départ du connecteur */
    '.mzTr-connector::before{',
    '  content:"";',
    '  position:absolute;top:-3px;left:50%;transform:translateX(-50%);',
    '  width:5px;height:5px;border-radius:50%;',
    '  background:rgba(212,175,55,.45);',
    '}',

    /* ── Nœud terminal (collecteur / muhaddith) ── */
    '.mzTr-node-terminal{',
    '  border-color:rgba(212,175,55,.48);',
    '  background:linear-gradient(158deg,#120c00 0%,#0d0800 55%,#0e0e18 100%);',
    '}',
    '.mzTr-node-terminal::before{',
    '  background:linear-gradient(',
    '    90deg,transparent,',
    '    rgba(212,175,55,.6) 20%,',
    '    #d4af37 50%,',
    '    rgba(212,175,55,.6) 80%,',
    '    transparent',
    '  );',
    '}',
    '.mzTr-node-terminal::after{',
    '  content:"";position:absolute;bottom:0;left:0;right:0;height:1px;',
    '  background:linear-gradient(90deg,transparent,rgba(212,175,55,.28),transparent);',
    '}',

    /* ── Indicateur cliquable ── */
    '.mzTr-click-hint{',
    '  position:absolute;top:5px;right:7px;',
    '  font-size:10px;color:rgba(212,175,55,.18);',
    '  transition:color .2s;pointer-events:none;',
    '  line-height:1;letter-spacing:.1em;',
    '}',

    /* ── Étiquette numérotée sur le connecteur ── */
    '.mzTr-conn-label{',
    '  position:absolute;left:8px;top:50%;transform:translateY(-50%);',
    '  font-family:Cinzel,serif;font-size:5px;letter-spacing:.3em;',
    '  color:rgba(212,175,55,.2);white-space:nowrap;pointer-events:none;',
    '}',

    /* ── État vide ── */
    '.mzTr-empty{',
    '  font-family:Cinzel,serif;font-size:7px;letter-spacing:.28em;',
    '  color:rgba(212,175,55,.18);padding:32px;text-align:center;',
    '  animation:mzTrPulse 2s ease-in-out infinite;',
    '}',

    /* ── Responsive ── */
    '@media(max-width:480px){',
    '  .mzTr-node{min-width:148px;max-width:100%;padding:10px 14px 9px;}',
    '  .mzTr-name{font-size:10.5px;}',
    '  .mzTr-name-ar{font-size:14px;}',
    '  .mzTr-connector{height:28px;}',
    '}',

  ].join('\n');
  document.head.appendChild(s);
})();

/* ════════════════════════════════════════════════════════════════
   2. HELPERS INTERNES
════════════════════════════════════════════════════════════════ */

/** Échappe HTML pour injection sécurisée */
function _mzTrEsc(str) {
  return String(str || '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

/**
 * Résout la classe CSS de badge selon le verdict.
 * Règle : seuls les rapporteurs classiques → couleurs verdict.
 * Les juges contemporains ne doivent jamais atteindre cette fonction
 * (ils ont été filtrés côté Python avant d'arriver dans chain).
 */
function _mzTrVerdictCls(v) {
  var s = (v || '').toLowerCase();
  if (/thiqah|imam|adil|thabt|hafidh|thiqa/.test(s)) return 'thiqah';
  if (/sadouq|saduq|siddiq|la.?bas/.test(s))          return 'sadouq';
  if (/da.?if|layyin|munkar|matruk|weak/.test(s))      return 'daif';
  if (/mawdu|kadhdhab|fabricat/.test(s))               return 'munkar';
  return 'thiqah'; // défaut conservateur
}

/**
 * Génère le rang ordinal d'une étape dans la chaîne.
 * Étape 0 = SOURCE (Sahâbi), dernière = COLLECTEUR.
 */
function _mzTrRankLabel(idx, total) {
  if (idx === 0)          return 'SOURCE · RĀWĪ 1';
  if (idx === total - 1)  return 'COLLECTEUR · RĀWĪ ' + total;
  return 'RĀWĪ ' + (idx + 1);
}

/* ════════════════════════════════════════════════════════════════
   3. RENDER PRINCIPAL
   Usage : window.mzRenderIsnadTree(containerEl, chainArray)
════════════════════════════════════════════════════════════════ */
window.mzRenderIsnadTree = function (containerEl, chain) {
  if (!containerEl) return;

  /* ── Chaîne vide ── */
  if (!chain || !chain.length) {
    containerEl.innerHTML =
      '<div class="mzTr-empty">'
      + 'SILSILAT AL-ISNĀD — AUCUNE DONNÉE'
      + '</div>';
    return;
  }

  var total = chain.length;
  var html  = '<div class="mzTr-root" role="list" aria-label="Chaîne de transmission">';

  chain.forEach(function (node, idx) {
    var name    = _mzTrEsc(node.name    || node.nom   || '');
    var nameAr  = _mzTrEsc(node.nameAr  || node.ar    || '');
    var role    = _mzTrEsc(node.role    || node.tabaqa || '');
    var verdict = String(node.verdict   || node.statut || 'thiqah');
    var died    = _mzTrEsc(node.died    || node.wafat  || '');
    var vClass  = _mzTrVerdictCls(verdict);
    var isLast  = (idx === total - 1);
    var delay   = (idx * 0.11).toFixed(2);
    var rawName = String(node.name || node.nom || '');
    var rankLbl = _mzTrRankLabel(idx, total);

    html += '<div class="mzTr-stage" role="listitem">';

    /* ── Nœud ── */
    html += '<div'
          + ' class="mzTr-node' + (isLast ? ' mzTr-node-terminal' : '') + '"'
          + ' style="animation-delay:' + delay + 's;"'
          + ' data-rawi="' + _mzTrEsc(rawName) + '"'
          + ' role="button"'
          + ' tabindex="0"'
          + ' aria-label="Biographie de ' + _mzTrEsc(rawName) + '"'
          + '>';

    /* Indicateur cliquable */
    html += '<span class="mzTr-click-hint" aria-hidden="true">•••</span>';

    /* Rang */
    html += '<div class="mzTr-rank">' + rankLbl + '</div>';

    /* Rôle / ṭabaqa */
    if (role) {
      html += '<div class="mzTr-role">' + role + '</div>';
    }

    /* Nom principal */
    if (name) {
      html += '<div class="mzTr-name">' + name + '</div>';
    }

    /* Nom arabe */
    if (nameAr) {
      html += '<div class="mzTr-name-ar">' + nameAr + '</div>';
    }

    /* Badges (verdict + date) */
    html += '<div class="mzTr-meta">';
    html += '<span class="mzTr-badge mzTr-badge-' + vClass + '"'
          + ' style="animation-delay:' + (parseFloat(delay) + 0.18).toFixed(2) + 's;">'
          + _mzTrEsc(verdict.toUpperCase())
          + '</span>';
    if (died) {
      html += '<span class="mzTr-badge mzTr-badge-date"'
            + ' style="animation-delay:' + (parseFloat(delay) + 0.24).toFixed(2) + 's;">†'
            + died + '</span>';
    }
    html += '</div>'; /* /mzTr-meta */

    html += '</div>'; /* /mzTr-node */

    /* ── Connecteur (sauf après le dernier nœud) ── */
    if (!isLast) {
      var connDelay = (idx * 0.11 + 0.08).toFixed(2);
      html += '<div class="mzTr-connector"'
            + ' style="animation-delay:' + connDelay + 's;"'
            + ' aria-hidden="true">'
            + '</div>';
    }

    html += '</div>'; /* /mzTr-stage */
  });

  html += '</div>'; /* /mzTr-root */
  containerEl.innerHTML = html;

  /* ── Délégation d'événements : clic + Enter ── */
  containerEl.addEventListener('click', function (e) {
    var node = e.target.closest('.mzTr-node');
    if (!node) return;
    _mzTrOpenModal(node);
  });

  containerEl.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var node = e.target.closest('.mzTr-node');
    if (!node) return;
    e.preventDefault();
    _mzTrOpenModal(node);
  });
};

function _mzTrOpenModal(nodeEl) {
  var rawName = nodeEl.getAttribute('data-rawi');
  if (rawName && typeof window._openRawiModal === 'function') {
    window._openRawiModal(rawName);
  }
}

/* ════════════════════════════════════════════════════════════════
   4. HELPER : construire la chain depuis un objet JSON Dorar
   Usage : window.mzChainFromDorarData(dorarHadithObj)
════════════════════════════════════════════════════════════════ */
window.mzChainFromDorarData = function (dorarObj) {
  if (!dorarObj) return [];
  var narrators = (
    dorarObj.narrators ||
    dorarObj.sanad     ||
    dorarObj.chain     ||
    dorarObj.isnad     ||
    []
  );
  return narrators.map(function (n) {
    return {
      name:    n.name    || n.nom     || n.ar_name  || '',
      nameAr:  n.ar_name || n.nom_ar  || '',
      role:    n.tabaqa  || n.role    || n.generation || '',
      verdict: n.grade   || n.hukm   || n.verdict   || 'thiqah',
      died:    n.death   || n.wafat  || n.died      || '',
    };
  });
};

/* ════════════════════════════════════════════════════════════════
   5. COMPATIBILITÉ — ancien nom window.mzOpenIsnadPanel
   (au cas où index.html appellerait encore l'ancien symbole)
════════════════════════════════════════════════════════════════ */
window.mzOpenIsnadPanel = window.mzOpenIsnadPanel || function (nom) {
  if (nom && typeof window._openRawiModal === 'function') {
    window._openRawiModal(nom);
  }
};

console.log(
  '%c ⚖️  mizan-tree-engine.js — window.mzRenderIsnadTree(el, chain) prêt',
  'color:#d4af37;font-size:10px;'
);
