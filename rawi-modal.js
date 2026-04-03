/* ═══════════════════════════════════════════════════════════════════
   MÎZÂN v22.1 — rawi-modal.js
   MODULE  : Modale Biographique des Rawis
   API     : window._openRawiModal(name)  →  fetch /api/rawi?name=…
             window._closeRawiModal()
   Design  : Centrage position:fixed garanti | Loader doré | Or / Noir
   Sécurité: _mzEsc() sur toute donnée externe | Zéro innerHTML brut
═══════════════════════════════════════════════════════════════════ */

console.log(
  '%c ✅ MÎZÂN v22.1 — rawi-modal.js chargé',
  'color:#00e676;font-weight:bold;font-size:11px;'
);

/* ════════════════════════════════════════════════════════════════
   1. CSS — injection unique, idempotente
════════════════════════════════════════════════════════════════ */
(function _mzInjectModalCSS() {
  var old = document.getElementById('mz-rawi-css');
  if (old) old.remove();
  var s = document.createElement('style');
  s.id = 'mz-rawi-css';
  s.textContent = [

    /* ── Keyframes ── */
    '@keyframes mzRwIn    {from{opacity:0;transform:translate(-50%,-50%) translateY(26px) scale(.95)}to{opacity:1;transform:translate(-50%,-50%) translateY(0) scale(1)}}',
    '@keyframes mzRwOut   {from{opacity:1;transform:translate(-50%,-50%) translateY(0) scale(1)}to{opacity:0;transform:translate(-50%,-50%) translateY(16px) scale(.96)}}',
    '@keyframes mzRwBgIn  {from{opacity:0}to{opacity:1}}',
    '@keyframes mzRwBgOut {from{opacity:1}to{opacity:0}}',
    '@keyframes mzRwBarFill{from{width:0}to{width:var(--w,0%)}}',
    '@keyframes mzRwFadeRow{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:translateX(0)}}',
    '@keyframes mzRwTagIn  {from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}',
    '@keyframes mzRwGlow   {0%,100%{text-shadow:0 0 18px rgba(212,175,55,.35)}50%{text-shadow:0 0 36px rgba(212,175,55,.8),0 0 64px rgba(212,175,55,.2)}}',
    '@keyframes mzRwSpin   {to{transform:rotate(360deg)}}',
    '@keyframes mzRwPulse  {0%,100%{opacity:.4}50%{opacity:1}}',
    '@keyframes mzRwShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}',

    /* ── Overlay fond plein écran ── */
    '#mz-rawi-overlay{',
    '  position:fixed;inset:0;z-index:99999;',
    '  background:rgba(0,0,0,.88);',
    '  backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);',
    '  animation:mzRwBgIn .28s ease;',
    '}',
    '#mz-rawi-overlay.mz-closing{animation:mzRwBgOut .22s ease forwards;}',

    /* ── Wrapper : centrage fixed absolu ── */
    '.mzRw-wrap{',
    '  position:fixed;',
    '  top:50%;left:50%;',
    '  transform:translate(-50%,-50%);',
    '  width:calc(100vw - 32px);',
    '  max-width:720px;',
    '  max-height:92vh;',
    '  display:flex;flex-direction:column;',
    '  z-index:100000;',
    '  animation:mzRwIn .38s cubic-bezier(.16,1,.3,1) forwards;',
    '}',
    '.mzRw-wrap.mz-closing{animation:mzRwOut .22s cubic-bezier(.4,0,.2,1) forwards;}',

    /* ── Panel : parchemin doré ── */
    '.mzRw-panel{',
    '  position:relative;',
    '  background:linear-gradient(168deg,#0e0900 0%,#0a0600 42%,#0c0c13 100%);',
    '  border:1px solid rgba(212,175,55,.32);',
    '  border-radius:4px;',
    '  overflow:hidden;',
    '  display:flex;flex-direction:column;',
    '  max-height:92vh;',
    '  box-shadow:',
    '    0 0 0 1px rgba(212,175,55,.06),',
    '    0 0 60px rgba(212,175,55,.1),',
    '    0 32px 100px rgba(0,0,0,.98),',
    '    inset 0 1px 0 rgba(212,175,55,.09);',
    '}',

    /* Liseré doré supérieur */
    '.mzRw-panel::before{',
    '  content:"";position:absolute;top:0;left:0;right:0;height:2px;z-index:20;pointer-events:none;',
    '  background:linear-gradient(90deg,transparent,rgba(212,175,55,.5) 18%,#d4af37 50%,rgba(212,175,55,.5) 82%,transparent);',
    '}',

    /* Grain de texture subtil */
    '.mzRw-panel::after{',
    '  content:"";position:absolute;inset:0;pointer-events:none;z-index:0;',
    '  opacity:.015;',
    '  background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'4\' height=\'4\'%3E%3Ccircle cx=\'1\' cy=\'1\' r=\'.6\' fill=\'%23d4af37\'/%3E%3C/svg%3E");',
    '}',

    /* ── Coins ornementaux ── */
    '.mzRw-corner{position:absolute;width:24px;height:24px;z-index:15;pointer-events:none;}',
    '.mzRw-corner svg{display:block;}',
    '.mzRw-corner-tl{top:8px;left:8px;}',
    '.mzRw-corner-tr{top:8px;right:8px;transform:scaleX(-1);}',
    '.mzRw-corner-bl{bottom:8px;left:8px;transform:scaleY(-1);}',
    '.mzRw-corner-br{bottom:8px;right:8px;transform:scale(-1);}',

    /* ── Bouton fermer ── */
    '.mzRw-close{',
    '  position:absolute;top:12px;right:14px;z-index:30;',
    '  width:28px;height:28px;',
    '  background:rgba(0,0,0,.55);',
    '  border:1px solid rgba(212,175,55,.2);',
    '  border-radius:50%;cursor:pointer;',
    '  display:flex;align-items:center;justify-content:center;',
    '  color:rgba(212,175,55,.4);font-size:16px;line-height:1;',
    '  transition:all .2s;font-family:serif;',
    '}',
    '.mzRw-close:hover{background:rgba(212,175,55,.12);border-color:rgba(212,175,55,.5);color:#d4af37;transform:scale(1.1);}',

    /* ── Loader doré ── */
    '.mzRw-loader{',
    '  position:relative;z-index:5;',
    '  flex:1;min-height:200px;',
    '  display:flex;flex-direction:column;',
    '  align-items:center;justify-content:center;',
    '  padding:60px 28px;gap:24px;',
    '}',
    '.mzRw-loader-ring{',
    '  width:54px;height:54px;flex-shrink:0;',
    '  border:2.5px solid rgba(212,175,55,.12);',
    '  border-top-color:#d4af37;',
    '  border-right-color:rgba(212,175,55,.5);',
    '  border-radius:50%;',
    '  animation:mzRwSpin .85s linear infinite;',
    '}',
    '.mzRw-loader-txt{',
    '  font-family:Cinzel,serif;font-size:6px;letter-spacing:.45em;',
    '  color:rgba(212,175,55,.42);',
    '  animation:mzRwPulse 1.6s ease-in-out infinite;',
    '  text-align:center;',
    '}',
    '.mzRw-loader-sub{',
    '  font-family:"Cormorant Garamond",Georgia,serif;font-size:11.5px;',
    '  color:rgba(212,175,55,.2);font-style:italic;text-align:center;',
    '}',

    /* ── En-tête ── */
    '.mzRw-header{',
    '  position:relative;z-index:5;flex-shrink:0;',
    '  padding:28px 44px 20px;text-align:center;',
    '  border-bottom:1px solid rgba(212,175,55,.1);',
    '  background:linear-gradient(180deg,rgba(212,175,55,.035) 0%,transparent 100%);',
    '}',

    /* Médaillon */
    '.mzRw-seal{',
    '  width:54px;height:54px;margin:0 auto 14px;',
    '  border-radius:50%;',
    '  background:radial-gradient(circle,rgba(212,175,55,.1) 0%,transparent 70%);',
    '  border:1.5px solid rgba(212,175,55,.35);',
    '  display:flex;align-items:center;justify-content:center;',
    '  font-size:24px;',
    '  box-shadow:0 0 20px rgba(212,175,55,.14),inset 0 0 12px rgba(212,175,55,.04);',
    '}',

    '.mzRw-eyebrow{',
    '  font-family:Cinzel,serif;font-size:5.5px;letter-spacing:.48em;',
    '  color:rgba(212,175,55,.28);display:block;margin-bottom:10px;',
    '}',

    '.mzRw-name-main{',
    '  font-family:Cinzel,serif;font-size:22px;font-weight:900;',
    '  color:#fde68a;line-height:1.25;margin-bottom:5px;',
    '  animation:mzRwGlow 4s ease-in-out infinite;',
    '}',

    '.mzRw-name-ar{',
    '  font-family:"Scheherazade New","Amiri",serif;',
    '  font-size:20px;font-weight:700;',
    '  color:rgba(212,175,55,.48);',
    '  display:block;margin-bottom:12px;direction:rtl;',
    '}',

    /* Séparateur ornemental */
    '.mzRw-divider{',
    '  display:flex;align-items:center;justify-content:center;',
    '  gap:10px;margin:0 auto 13px;max-width:340px;',
    '}',
    '.mzRw-divider-line{flex:1;height:1px;background:linear-gradient(90deg,transparent,rgba(212,175,55,.4),transparent);}',
    '.mzRw-divider-gem{font-size:9px;color:rgba(212,175,55,.5);flex-shrink:0;}',

    /* ── Pills ── */
    '.mzRw-meta-pills{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;}',
    '.mzRw-pill{',
    '  font-family:Cinzel,serif;font-size:6px;font-weight:700;letter-spacing:.14em;',
    '  padding:4px 11px;border-radius:2px;',
    '  animation:mzRwTagIn .4s ease both;',
    '}',
    '.mzRw-pill-gold  {background:rgba(212,175,55,.1); border:1px solid rgba(212,175,55,.3); color:#d4af37;}',
    '.mzRw-pill-green {background:rgba(34,197,94,.07); border:1px solid rgba(34,197,94,.26); color:#4ade80;}',
    '.mzRw-pill-red   {background:rgba(239,68,68,.07); border:1px solid rgba(239,68,68,.22); color:#f87171;}',
    '.mzRw-pill-blue  {background:rgba(96,165,250,.06);border:1px solid rgba(96,165,250,.2); color:#93c5fd;}',
    '.mzRw-pill-silver{background:rgba(200,200,200,.04);border:1px solid rgba(200,200,200,.12);color:rgba(200,200,200,.55);}',

    /* ── Corps scrollable ── */
    '.mzRw-body{',
    '  position:relative;z-index:5;overflow-y:auto;flex:1;',
    '  scrollbar-width:thin;scrollbar-color:rgba(212,175,55,.15) transparent;',
    '}',
    '.mzRw-body::-webkit-scrollbar{width:3px;}',
    '.mzRw-body::-webkit-scrollbar-thumb{background:rgba(212,175,55,.18);border-radius:2px;}',

    /* ── Grille sections ── */
    '.mzRw-sections-grid{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:rgba(212,175,55,.06);}',
    '.mzRw-sections-grid .mzRw-section{background:#0a0700;}',
    '.mzRw-section-full{grid-column:1 / -1 !important;background:#0a0700;}',
    '.mzRw-section{padding:18px 22px 16px;position:relative;}',

    /* Titre de section */
    '.mzRw-section-label{',
    '  font-family:Cinzel,serif;font-size:5.5px;font-weight:700;letter-spacing:.42em;',
    '  color:rgba(212,175,55,.28);margin-bottom:14px;',
    '  display:flex;align-items:center;gap:8px;',
    '}',
    '.mzRw-section-label-ar{',
    '  font-family:"Scheherazade New","Amiri",serif;',
    '  font-size:13px;color:rgba(212,175,55,.16);letter-spacing:0;font-weight:400;',
    '}',
    '.mzRw-section-label::after{',
    '  content:"";flex:1;height:1px;',
    '  background:linear-gradient(to right,rgba(212,175,55,.14),transparent);',
    '}',

    /* ── Encart verdict ── */
    '.mzRw-verdict-encart{',
    '  display:flex;align-items:center;gap:13px;',
    '  margin-bottom:14px;padding:13px 15px;border-radius:3px;',
    '}',
    '.mzRw-verdict-encart.thiqah{background:rgba(34,197,94,.04); border:1px solid rgba(34,197,94,.14);}',
    '.mzRw-verdict-encart.sadouq{background:rgba(74,222,128,.03);border:1px solid rgba(74,222,128,.16);}',
    '.mzRw-verdict-encart.daif  {background:rgba(245,158,11,.04);border:1px solid rgba(245,158,11,.2);}',
    '.mzRw-verdict-encart.munkar{background:rgba(239,68,68,.04); border:1px solid rgba(239,68,68,.2);}',

    '.mzRw-verdict-badge{',
    '  font-family:Cinzel,serif;font-size:7.5px;font-weight:900;letter-spacing:.16em;',
    '  padding:5px 12px;border-radius:3px;flex-shrink:0;',
    '}',
    '.mzRw-verdict-badge.thiqah{background:#22c55e;color:#000;}',
    '.mzRw-verdict-badge.sadouq{background:#4ade80;color:#000;}',
    '.mzRw-verdict-badge.daif  {background:#f59e0b;color:#000;}',
    '.mzRw-verdict-badge.munkar{background:#ef4444;color:#fff;}',

    '.mzRw-verdict-title{',
    '  font-family:Cinzel,serif;font-size:9.5px;font-weight:700;letter-spacing:.05em;',
    '  color:rgba(220,200,140,.88);margin-bottom:3px;',
    '}',
    '.mzRw-verdict-sub{',
    '  font-family:"Cormorant Garamond",Georgia,serif;',
    '  font-size:12.5px;color:rgba(180,160,110,.55);font-style:italic;',
    '}',

    /* ── Barres de scores ── */
    '.mzRw-bars{display:flex;flex-direction:column;gap:8px;}',
    '.mzRw-bar-row{display:flex;align-items:center;gap:10px;}',
    '.mzRw-bar-lbl{',
    '  font-family:Cinzel,serif;font-size:6.5px;font-weight:700;letter-spacing:.1em;',
    '  color:rgba(200,170,100,.55);width:70px;flex-shrink:0;',
    '}',
    '.mzRw-bar-track{flex:1;height:4px;background:rgba(255,255,255,.05);border-radius:2px;overflow:hidden;}',
    '.mzRw-bar-fill{',
    '  height:100%;border-radius:2px;',
    '  animation:mzRwBarFill .95s cubic-bezier(.4,0,.2,1) .4s both;',
    '  width:var(--w,0%);',
    '}',
    '.mzRw-bar-pct{',
    '  font-family:Cinzel,serif;font-size:7px;font-weight:900;',
    '  width:30px;text-align:right;flex-shrink:0;',
    '}',

    /* ── Jugements (Jarh wa Ta'dil) ── */
    '.mzRw-judge-list{display:flex;flex-direction:column;gap:8px;}',
    '.mzRw-judge-row{',
    '  display:flex;align-items:flex-start;gap:10px;',
    '  padding:10px 12px;border-radius:3px;',
    '  animation:mzRwFadeRow .42s ease both;',
    '}',
    '.mzRw-judge-row.thiqah{background:rgba(34,197,94,.04); border-left:2px solid rgba(34,197,94,.35);}',
    '.mzRw-judge-row.sadouq{background:rgba(74,222,128,.03);border-left:2px solid rgba(74,222,128,.28);}',
    '.mzRw-judge-row.daif  {background:rgba(245,158,11,.04);border-left:2px solid rgba(245,158,11,.3);}',
    '.mzRw-judge-row.munkar{background:rgba(239,68,68,.04); border-left:2px solid rgba(239,68,68,.35);}',

    '.mzRw-judge-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0;margin-top:5px;}',
    '.mzRw-judge-row.thiqah .mzRw-judge-dot{background:#22c55e;box-shadow:0 0 6px rgba(34,197,94,.5);}',
    '.mzRw-judge-row.sadouq .mzRw-judge-dot{background:#4ade80;box-shadow:0 0 5px rgba(74,222,128,.45);}',
    '.mzRw-judge-row.daif   .mzRw-judge-dot{background:#f59e0b;box-shadow:0 0 5px rgba(245,158,11,.45);}',
    '.mzRw-judge-row.munkar .mzRw-judge-dot{background:#ef4444;box-shadow:0 0 6px rgba(239,68,68,.5);}',

    '.mzRw-judge-scholar{',
    '  font-family:Cinzel,serif;font-size:7.5px;font-weight:700;letter-spacing:.08em;',
    '  color:rgba(212,175,55,.75);margin-bottom:4px;',
    '}',
    '.mzRw-judge-ar{',
    '  font-family:"Scheherazade New","Amiri",serif;',
    '  font-size:14.5px;color:rgba(212,175,55,.55);',
    '  direction:rtl;text-align:right;line-height:1.75;',
    '  display:block;margin-bottom:3px;',
    '}',
    '.mzRw-judge-fr{',
    '  font-family:"Cormorant Garamond",Georgia,serif;',
    '  font-size:12.5px;color:rgba(200,180,130,.58);',
    '  line-height:1.6;font-style:italic;',
    '}',
    '.mzRw-judge-src{',
    '  font-family:Cinzel,serif;font-size:5px;letter-spacing:.12em;',
    '  color:rgba(140,110,50,.35);margin-top:4px;',
    '}',

    /* ── Listes de noms (Mashayikh / Talamidh) ── */
    '.mzRw-names-list{display:flex;flex-direction:column;gap:3px;}',
    '.mzRw-name-item{',
    '  display:flex;align-items:center;gap:9px;',
    '  padding:6px 0;',
    '  border-bottom:1px solid rgba(212,175,55,.04);',
    '  animation:mzRwFadeRow .35s ease both;',
    '}',
    '.mzRw-name-item:last-child{border-bottom:none;}',
    '.mzRw-name-bullet{width:4px;height:4px;border-radius:50%;background:rgba(212,175,55,.38);flex-shrink:0;}',
    '.mzRw-name-text{',
    '  font-family:"Cormorant Garamond",Georgia,serif;',
    '  font-size:14px;color:rgba(222,202,154,.75);flex:1;',
    '}',
    '.mzRw-name-role{',
    '  font-family:Cinzel,serif;font-size:5.5px;letter-spacing:.08em;',
    '  color:rgba(140,110,50,.38);flex-shrink:0;',
    '}',

    /* ── Rihla (notice biographique) ── */
    '.mzRw-rihla-body{',
    '  font-family:"Cormorant Garamond",Georgia,serif;',
    '  font-size:14px;color:rgba(222,202,154,.76);',
    '  line-height:1.88;margin-bottom:10px;',
    '}',
    '.mzRw-rihla-quote{',
    '  margin-top:15px;padding:14px 17px;',
    '  background:rgba(212,175,55,.03);',
    '  border:1px solid rgba(212,175,55,.1);',
    '  border-radius:2px;position:relative;',
    '}',
    '.mzRw-rihla-quote::before{',
    '  content:"\u275D";position:absolute;top:-10px;left:12px;',
    '  font-size:28px;color:rgba(212,175,55,.11);',
    '  line-height:1;font-family:Georgia,serif;',
    '}',
    '.mzRw-rihla-quote-ar{',
    '  font-family:"Scheherazade New","Amiri",serif;',
    '  font-size:16px;color:rgba(212,175,55,.6);',
    '  direction:rtl;text-align:right;line-height:1.75;',
    '  display:block;margin-bottom:8px;',
    '}',
    '.mzRw-rihla-quote-fr{',
    '  font-family:"Cormorant Garamond",Georgia,serif;',
    '  font-style:italic;font-size:13px;',
    '  color:rgba(200,180,130,.52);line-height:1.6;',
    '}',
    '.mzRw-rihla-quote-src{',
    '  font-family:Cinzel,serif;font-size:5px;letter-spacing:.15em;',
    '  color:rgba(140,110,50,.32);margin-top:7px;display:block;',
    '}',

    /* ── État erreur ── */
    '.mzRw-error{padding:40px 28px;text-align:center;}',
    '.mzRw-error-icon{font-size:40px;opacity:.2;margin-bottom:12px;}',
    '.mzRw-error-title{font-family:Cinzel,serif;font-size:8.5px;letter-spacing:.28em;color:rgba(239,68,68,.48);margin-bottom:9px;}',
    '.mzRw-error-body{font-family:"Cormorant Garamond",Georgia,serif;font-size:13.5px;color:rgba(200,180,130,.4);line-height:1.75;font-style:italic;}',
    '.mzRw-error-retry{',
    '  margin-top:18px;font-family:Cinzel,serif;font-size:6px;letter-spacing:.22em;',
    '  color:rgba(212,175,55,.36);cursor:pointer;',
    '  border:1px solid rgba(212,175,55,.16);',
    '  padding:7px 16px;border-radius:2px;background:transparent;',
    '  transition:all .2s;',
    '}',
    '.mzRw-error-retry:hover{color:#d4af37;border-color:rgba(212,175,55,.42);background:rgba(212,175,55,.05);}',

    /* ── État non trouvé ── */
    '.mzRw-not-found{padding:40px 28px;text-align:center;}',
    '.mzRw-nf-icon{font-size:40px;opacity:.18;margin-bottom:12px;}',
    '.mzRw-nf-title{font-family:Cinzel,serif;font-size:8.5px;letter-spacing:.28em;color:rgba(212,175,55,.36);margin-bottom:9px;}',
    '.mzRw-nf-body{font-family:"Cormorant Garamond",Georgia,serif;font-size:13.5px;color:rgba(200,180,130,.4);line-height:1.75;font-style:italic;}',

    /* ── Pied de modale ── */
    '.mzRw-footer{',
    '  position:relative;z-index:5;flex-shrink:0;',
    '  padding:9px 22px;',
    '  border-top:1px solid rgba(212,175,55,.08);',
    '  background:rgba(0,0,0,.4);',
    '  display:flex;align-items:center;justify-content:space-between;',
    '}',
    '.mzRw-footer-left{font-family:Cinzel,serif;font-size:5px;letter-spacing:.28em;color:rgba(212,175,55,.16);}',
    '.mzRw-footer-right{font-family:"Scheherazade New","Amiri",serif;font-size:15px;color:rgba(212,175,55,.12);}',

    /* ── Responsive ── */
    '@media(max-width:600px){',
    '  .mzRw-wrap{width:calc(100vw - 16px);}',
    '  .mzRw-sections-grid{grid-template-columns:1fr;}',
    '  .mzRw-header{padding:20px 18px 14px;}',
    '  .mzRw-section{padding:13px 14px 11px;}',
    '  .mzRw-name-main{font-size:18px;}',
    '  .mzRw-seal{width:46px;height:46px;font-size:20px;}',
    '}',

  ].join('\n');
  document.head.appendChild(s);
})();

/* ════════════════════════════════════════════════════════════════
   2. HELPERS
════════════════════════════════════════════════════════════════ */

/** Échappe tout string avant injection HTML */
function _mzEsc(str) {
  return String(str || '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

/** SVG coin ornemental */
function _mzCornerSVG() {
  return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none">'
    + '<path d="M2 22 L2 2 L22 2" stroke="rgba(212,175,55,.5)" stroke-width="1.5" fill="none" stroke-linecap="round"/>'
    + '<circle cx="2" cy="2" r="2.2" fill="rgba(212,175,55,.35)"/>'
    + '</svg>';
}

/** Résout la classe CSS de verdict */
function _mzVerdictClass(statut) {
  var s = (statut || '').toLowerCase();
  if (/thiqah|imam|adil|thabt|hafidh|thiqa/.test(s)) return 'thiqah';
  if (/sadouq|saduq|siddiq|la.?bas/.test(s))          return 'sadouq';
  if (/da.?if|layyin|munkar|matruk|weak/.test(s))      return 'daif';
  if (/mawdu|kadhdhab|fabricat/.test(s))               return 'munkar';
  return 'thiqah';
}

/** Classe CSS d'une pill selon son label */
function _mzPillCls(label) {
  var l = (label || '').toLowerCase();
  if (/thiqah|imam|adil|hafidh/.test(l)) return 'mzRw-pill-green';
  if (/da.?if|munkar|mawdu/.test(l))     return 'mzRw-pill-red';
  if (/sadouq|saduq/.test(l))            return 'mzRw-pill-gold';
  if (/\d{2,4}h/.test(l))               return 'mzRw-pill-blue';
  return 'mzRw-pill-silver';
}

/* ════════════════════════════════════════════════════════════════
   3. SQUELETTE HTML (loader immédiat, avant fetch)
════════════════════════════════════════════════════════════════ */
function _mzSkeletonHTML(rawName) {
  var h = '';
  h += '<div class="mzRw-wrap"><div class="mzRw-panel">';

  /* Coins */
  h += '<div class="mzRw-corner mzRw-corner-tl">' + _mzCornerSVG() + '</div>';
  h += '<div class="mzRw-corner mzRw-corner-tr">' + _mzCornerSVG() + '</div>';
  h += '<div class="mzRw-corner mzRw-corner-bl">' + _mzCornerSVG() + '</div>';
  h += '<div class="mzRw-corner mzRw-corner-br">' + _mzCornerSVG() + '</div>';

  /* Bouton fermer */
  h += '<button class="mzRw-close" id="mzRw-close-btn" aria-label="Fermer la modale">&times;</button>';

  /* En-tête visible pendant le chargement */
  h += '<div class="mzRw-header">';
  h += '<div class="mzRw-seal">\ufdfa</div>';
  h += '<span class="mzRw-eyebrow">\'ILM AR-RIJ\u0100L \u2014 AT-TARJAMA</span>';
  h += '<div class="mzRw-name-main">' + _mzEsc(rawName) + '</div>';
  h += '<div class="mzRw-divider">'
     + '<span class="mzRw-divider-line"></span>'
     + '<span class="mzRw-divider-gem">\u2666</span>'
     + '<span class="mzRw-divider-line"></span>'
     + '</div>';
  h += '</div>'; /* /mzRw-header */

  /* Zone contenu — loader doré */
  h += '<div class="mzRw-body" id="mzRw-content-zone">';
  h += '<div class="mzRw-loader">';
  h += '<div class="mzRw-loader-ring"></div>';
  h += '<div class="mzRw-loader-txt">RECHERCHE EN COURS</div>';
  h += '<div class="mzRw-loader-sub">Interrogation de Dorar.net \u2014 Filtrage Isnad\u2026</div>';
  h += '</div>';
  h += '</div>'; /* /mzRw-body */

  /* Pied */
  h += '<div class="mzRw-footer">'
     + '<span class="mzRw-footer-left">SILSILAT AL-ISN\u0100D \u2014 M\u00ceZ\u00c2N v22.1 \u2014 \'ILM AR-RIJ\u0100L</span>'
     + '<span class="mzRw-footer-right">\u2696\ufe0f</span>'
     + '</div>';

  h += '</div></div>'; /* /mzRw-panel /mzRw-wrap */
  return h;
}

/* ════════════════════════════════════════════════════════════════
   4. CONSTRUCTION DU CONTENU depuis les données /api/rawi
════════════════════════════════════════════════════════════════ */
function _mzBuildContent(data) {
  var h      = '';
  var vClass = _mzVerdictClass(data.statut || '');

  h += '<div class="mzRw-sections-grid">';

  /* ── SECTION : Verdict + Barres ── */
  h += '<div class="mzRw-section mzRw-section-full" style="border-bottom:1px solid rgba(212,175,55,.07);">';
  h += '<div class="mzRw-section-label">'
     + 'VERDICT'
     + ' <span class="mzRw-section-label-ar">\u0627\u0644\u062d\u064f\u0643\u0645</span>'
     + '</div>';

  if (data.verdict_titre) {
    h += '<div class="mzRw-verdict-encart ' + vClass + '">';
    h += '<span class="mzRw-verdict-badge ' + vClass + '">'
       + _mzEsc((data.statut || 'THIQAH').toUpperCase())
       + '</span>';
    h += '<div>';
    h += '<div class="mzRw-verdict-title">' + _mzEsc(data.verdict_titre) + '</div>';
    if (data.verdict_sous) {
      h += '<div class="mzRw-verdict-sub">' + _mzEsc(data.verdict_sous) + '</div>';
    }
    h += '</div>';
    h += '</div>'; /* /mzRw-verdict-encart */
  }

  if (data.barres && data.barres.length) {
    h += '<div class="mzRw-bars">';
    data.barres.forEach(function (b) {
      var pct = Math.min(100, Math.max(0, +b.pct || 0));
      var col = b.color || (pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444');
      h += '<div class="mzRw-bar-row">';
      h += '<span class="mzRw-bar-lbl">' + _mzEsc(b.label) + '</span>';
      h += '<div class="mzRw-bar-track">'
         + '<div class="mzRw-bar-fill" style="background:' + col + ';--w:' + pct + '%;"></div>'
         + '</div>';
      h += '<span class="mzRw-bar-pct" style="color:' + col + ';">' + pct + '%</span>';
      h += '</div>';
    });
    h += '</div>'; /* /mzRw-bars */
  }
  h += '</div>'; /* /section Verdict */

  /* ── SECTION : Jarh wa Ta'dil ── */
  if (data.jugements && data.jugements.length) {
    h += '<div class="mzRw-section mzRw-section-full" style="border-bottom:1px solid rgba(212,175,55,.07);">';
    h += '<div class="mzRw-section-label">'
       + 'AL-JAR\u1e24 WA AT-TA\u02bfD\u012aL'
       + ' <span class="mzRw-section-label-ar">\u0623\u0642\u0648\u0627\u0644 \u0627\u0644\u0623\u0626\u0645\u0651\u0629</span>'
       + '</div>';
    h += '<div class="mzRw-judge-list">';

    data.jugements.forEach(function (j, i) {
      var jc = _mzVerdictClass(j.classe || j.verdict || '');
      h += '<div class="mzRw-judge-row ' + jc + '" style="animation-delay:' + (i * 0.08) + 's;">';
      h += '<div class="mzRw-judge-dot"></div>';
      h += '<div style="flex:1;">';
      if (j.scholar) {
        h += '<div class="mzRw-judge-scholar">' + _mzEsc(j.scholar) + '</div>';
      }
      if (j.ar) {
        h += '<span class="mzRw-judge-ar">' + _mzEsc(j.ar) + '</span>';
      }
      if (j.fr) {
        h += '<div class="mzRw-judge-fr">\u00ab ' + _mzEsc(j.fr) + ' \u00bb</div>';
      }
      if (j.src) {
        h += '<div class="mzRw-judge-src">\ud83d\udcda ' + _mzEsc(j.src) + '</div>';
      }
      h += '</div>';
      h += '</div>'; /* /mzRw-judge-row */
    });

    h += '</div>'; /* /mzRw-judge-list */
    h += '</div>'; /* /section Jarh */
  }

  /* ── SECTION : Mashayikh ── */
  if (data.mashayikh && data.mashayikh.length) {
    h += '<div class="mzRw-section">';
    h += '<div class="mzRw-section-label">'
       + 'MASH\u0100YIKH'
       + ' <span class="mzRw-section-label-ar">\u0634\u064f\u064a\u0648\u062e\u0647</span>'
       + '</div>';
    h += '<div class="mzRw-names-list">';
    data.mashayikh.forEach(function (n, i) {
      var nom  = typeof n === 'object' ? (n.nom  || '') : String(n);
      var role = typeof n === 'object' ? (n.role || '') : '';
      h += '<div class="mzRw-name-item" style="animation-delay:' + (i * 0.045) + 's;">';
      h += '<span class="mzRw-name-bullet"></span>';
      h += '<span class="mzRw-name-text">' + _mzEsc(nom) + '</span>';
      if (role) h += '<span class="mzRw-name-role">' + _mzEsc(role) + '</span>';
      h += '</div>';
    });
    h += '</div>';
    h += '</div>'; /* /section Mashayikh */
  }

  /* ── SECTION : Talamidh ── */
  if (data.talamidh && data.talamidh.length) {
    h += '<div class="mzRw-section">';
    h += '<div class="mzRw-section-label">'
       + 'TAL\u0100MIDH'
       + ' <span class="mzRw-section-label-ar">\u062a\u0644\u0627\u0645\u064a\u0630\u0647</span>'
       + '</div>';
    h += '<div class="mzRw-names-list">';
    data.talamidh.forEach(function (n, i) {
      var nom  = typeof n === 'object' ? (n.nom  || '') : String(n);
      var role = typeof n === 'object' ? (n.role || '') : '';
      h += '<div class="mzRw-name-item" style="animation-delay:' + (i * 0.045) + 's;">';
      h += '<span class="mzRw-name-bullet" style="background:rgba(93,173,226,.42);"></span>';
      h += '<span class="mzRw-name-text" style="color:rgba(147,197,253,.7);">' + _mzEsc(nom) + '</span>';
      if (role) h += '<span class="mzRw-name-role">' + _mzEsc(role) + '</span>';
      h += '</div>';
    });
    h += '</div>';
    h += '</div>'; /* /section Talamidh */
  }

  /* ── SECTION : Rihla ── */
  if (data.rihla) {
    h += '<div class="mzRw-section mzRw-section-full">';
    h += '<div class="mzRw-section-label">'
       + 'AR-RI\u1e24LAH'
       + ' <span class="mzRw-section-label-ar">\u0633\u064a\u0631\u062a\u0647 \u0648\u062d\u064a\u0627\u062a\u0647</span>'
       + '</div>';
    data.rihla.split('\n\n').forEach(function (p) {
      if (p.trim()) {
        h += '<p class="mzRw-rihla-body">' + _mzEsc(p.trim()) + '</p>';
      }
    });
    if (data.rihla_quote_ar || data.rihla_quote_fr) {
      h += '<div class="mzRw-rihla-quote">';
      if (data.rihla_quote_ar) {
        h += '<span class="mzRw-rihla-quote-ar">' + _mzEsc(data.rihla_quote_ar) + '</span>';
      }
      if (data.rihla_quote_fr) {
        h += '<span class="mzRw-rihla-quote-fr">\u00ab ' + _mzEsc(data.rihla_quote_fr) + ' \u00bb</span>';
      }
      if (data.rihla_quote_src) {
        h += '<span class="mzRw-rihla-quote-src">\ud83d\udcda ' + _mzEsc(data.rihla_quote_src) + '</span>';
      }
      h += '</div>';
    }
    h += '</div>'; /* /section Rihla */
  }

  h += '</div>'; /* /mzRw-sections-grid */
  return h;
}

/* ════════════════════════════════════════════════════════════════
   5. MISE À JOUR DE L'EN-TÊTE après réception des données API
════════════════════════════════════════════════════════════════ */
function _mzUpdateHeader(overlay, data) {
  var header = overlay.querySelector('.mzRw-header');
  if (!header) return;

  var pills = '';
  (data.pills || []).forEach(function (p, i) {
    var cls = p.cls || _mzPillCls(p.label || '');
    pills += '<span class="mzRw-pill ' + cls + '"'
           + ' style="animation-delay:' + (i * 0.07) + 's;">'
           + _mzEsc(p.label)
           + '</span>';
  });

  var h = '';
  h += '<div class="mzRw-seal">\ufdfa</div>';
  h += '<span class="mzRw-eyebrow">'
     + '\'ILM AR-RIJ\u0100L \u2014 AT-TARJAMA'
     + (data.tabaqa ? ' \u2014 ' + _mzEsc(data.tabaqa) : '')
     + '</span>';
  h += '<div class="mzRw-name-main">' + _mzEsc(data.nom_fr || '') + '</div>';
  if (data.nom_ar) {
    h += '<span class="mzRw-name-ar">' + _mzEsc(data.nom_ar) + '</span>';
  }
  h += '<div class="mzRw-divider">'
     + '<span class="mzRw-divider-line"></span>'
     + '<span class="mzRw-divider-gem">\u2666</span>'
     + '<span class="mzRw-divider-line"></span>'
     + '</div>';
  if (pills) {
    h += '<div class="mzRw-meta-pills">' + pills + '</div>';
  }

  header.innerHTML = h;
}

/* ════════════════════════════════════════════════════════════════
   6. FETCH /api/rawi
════════════════════════════════════════════════════════════════ */
function _mzFetchRawi(name, overlay) {
  var zone = document.getElementById('mzRw-content-zone');
  if (!zone) return;

  fetch('/api/rawi?name=' + encodeURIComponent(name), {
    method:      'GET',
    headers:     { 'Accept': 'application/json' },
    credentials: 'same-origin',
  })
  .then(function (res) {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  })
  .then(function (data) {
    /* Vérifier que la modale est toujours ouverte */
    if (!document.getElementById('mz-rawi-overlay')) return;

    if (!data || data.found === false) {
      zone.innerHTML =
        '<div class="mzRw-not-found">'
        + '<div class="mzRw-nf-icon">\u2696</div>'
        + '<div class="mzRw-nf-title">NON DOCUMENT\u00c9</div>'
        + '<div class="mzRw-nf-body">La biographie de '
        + '<strong style="color:rgba(212,175,55,.65);">' + _mzEsc(name) + '</strong>'
        + ' ne figure pas dans la base de dorar.net.</div>'
        + '</div>';
      return;
    }

    _mzUpdateHeader(overlay, data);
    zone.innerHTML = _mzBuildContent(data);
  })
  .catch(function (err) {
    console.error('[Mîzân] /api/rawi error:', err);
    if (!document.getElementById('mz-rawi-overlay')) return;

    zone.innerHTML =
      '<div class="mzRw-error">'
      + '<div class="mzRw-error-icon">\u26a0\ufe0f</div>'
      + '<div class="mzRw-error-title">ERREUR DE CONNEXION</div>'
      + '<div class="mzRw-error-body">'
      + 'Impossible de joindre <code>/api/rawi</code>.<br>'
      + _mzEsc(String(err.message || err))
      + '</div>'
      + '<button class="mzRw-error-retry" id="mzRw-retry-btn">R\u00c9ESSAYER</button>'
      + '</div>';

    var btn = document.getElementById('mzRw-retry-btn');
    if (btn) {
      btn.addEventListener('click', function () {
        zone.innerHTML =
          '<div class="mzRw-loader">'
          + '<div class="mzRw-loader-ring"></div>'
          + '<div class="mzRw-loader-txt">RECHERCHE EN COURS</div>'
          + '<div class="mzRw-loader-sub">Nouvelle tentative\u2026</div>'
          + '</div>';
        _mzFetchRawi(name, overlay);
      });
    }
  });
}

/* ════════════════════════════════════════════════════════════════
   7. OUVERTURE — window._openRawiModal(name)
════════════════════════════════════════════════════════════════ */
window._openRawiModal = function (rawiName) {
  /* Fermer toute modale existante sans animation */
  var existing = document.getElementById('mz-rawi-overlay');
  if (existing) {
    if (existing._mzEscHandler) {
      document.removeEventListener('keydown', existing._mzEscHandler);
    }
    existing.remove();
  }

  var name = (String(rawiName || '').trim()) || 'Rapporteur inconnu';

  /* Créer l'overlay */
  var overlay = document.createElement('div');
  overlay.id  = 'mz-rawi-overlay';
  overlay.setAttribute('role',       'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Biographie de ' + name);
  overlay.innerHTML = _mzSkeletonHTML(name);

  /* Clic sur le fond = fermer */
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) window._closeRawiModal();
  });

  /* Echap = fermer */
  overlay._mzEscHandler = function (e) {
    if (e.key === 'Escape') window._closeRawiModal();
  };
  document.addEventListener('keydown', overlay._mzEscHandler);

  document.body.appendChild(overlay);

  /* Bouton × */
  var closeBtn = document.getElementById('mzRw-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      window._closeRawiModal();
    });
  }

  /* Focus piégé dans la modale */
  var wrap = overlay.querySelector('.mzRw-wrap');
  if (wrap) {
    wrap.setAttribute('tabindex', '-1');
    wrap.focus();
  }

  /* Lancer le fetch */
  _mzFetchRawi(name, overlay);
};

/* ════════════════════════════════════════════════════════════════
   8. FERMETURE — window._closeRawiModal()
════════════════════════════════════════════════════════════════ */
window._closeRawiModal = function () {
  var overlay = document.getElementById('mz-rawi-overlay');
  if (!overlay) return;

  var wrap = overlay.querySelector('.mzRw-wrap');
  if (wrap) wrap.classList.add('mz-closing');
  overlay.classList.add('mz-closing');

  if (overlay._mzEscHandler) {
    document.removeEventListener('keydown', overlay._mzEscHandler);
  }

  setTimeout(function () {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }, 240);
};

/* ════════════════════════════════════════════════════════════════
   9. PATCH de compatibilité — window.mzOpenIsnadPanel
   (appels éventuels depuis des versions antérieures de index.html)
════════════════════════════════════════════════════════════════ */
(function _mzPatchLegacy() {
  var _legacy = window.mzOpenIsnadPanel;
  window.mzOpenIsnadPanel = function (nom, role, verdict, dates, couleur) {
    if (nom && nom.length > 1) {
      window._openRawiModal(nom);
    } else if (typeof _legacy === 'function') {
      _legacy(nom, role, verdict, dates, couleur);
    }
  };
  window._mzLegacyIsnadPanel = _legacy;
})();

console.log(
  '%c 🛡️  rawi-modal.js — window._openRawiModal(name) → /api/rawi prêt',
  'color:#93c5fd;font-size:10px;'
);
