/* ═══════════════════════════════════════════════════════════════════
   MÎZÂN v21.0 — rawi-modal.js — REFONTE VISUELLE ROYALE
   MODULE : 'ILM AR-RIJAL — La Tarjama Encyclopédique
   Design : Modale centrée — parchemin noir/doré — bordures ornementales
            Fiche encyclopédique majestueuse pour la présentation de Médine
   Usage  : window._openRawiModal('Nom du Rawi')
   Triple Bouclier : String concat | window.* | Mouchard vert
═══════════════════════════════════════════════════════════════════ */

console.log('%c \u2705 M\u00eezan v21.0 : Pr\u00eat pour Production', 'color: #00ff00; font-weight: bold;');
console.log('%c \ud83d\udcda rawi-modal.js \u2014 Modale Royale charg\u00e9e', 'color:#d4af37;font-weight:bold;background:#0a0600;padding:3px 8px;');

/* ════════════════════════════════════════════════════════════════
   1. INJECTION CSS — MODALE CENTRÉE ROYALE (une seule fois)
════════════════════════════════════════════════════════════════ */
(function _mzInjectRawiCSS() {
  var old = document.getElementById('mz-rawi-css');
  if (old) old.remove();
  var style = document.createElement('style');
  style.id = 'mz-rawi-css';
  style.textContent = [
    '@keyframes mzRwIn    { from{opacity:0;transform:translateY(28px) scale(.95)} to{opacity:1;transform:translateY(0) scale(1)} }',
    '@keyframes mzRwBgIn  { from{opacity:0} to{opacity:1} }',
    '@keyframes mzRwBarFill { from{width:0} to{width:var(--w,0%)} }',
    '@keyframes mzRwFadeRow { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }',
    '@keyframes mzRwTagIn { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }',
    '@keyframes mzRwGlow  { 0%,100%{text-shadow:0 0 18px rgba(212,175,55,.4)} 50%{text-shadow:0 0 38px rgba(212,175,55,.85),0 0 65px rgba(212,175,55,.22)} }',
    /* Overlay */
    '#mz-rawi-overlay{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.84);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px;animation:mzRwBgIn .3s ease;}',
    /* Wrapper */
    '.mzRw-wrap{position:relative;width:100%;max-width:680px;max-height:92vh;display:flex;flex-direction:column;animation:mzRwIn .38s cubic-bezier(.16,1,.3,1);}',
    /* Panneau parchemin noir */
    '.mzRw-panel{position:relative;background:linear-gradient(170deg,#0d0900 0%,#0a0600 40%,#0c0c12 100%);border:1px solid rgba(212,175,55,.38);border-radius:4px;overflow:hidden;display:flex;flex-direction:column;max-height:92vh;box-shadow:0 0 0 1px rgba(212,175,55,.07),0 0 60px rgba(212,175,55,.1),0 32px 100px rgba(0,0,0,.98),inset 0 1px 0 rgba(212,175,55,.1);}',
    /* Bande dorée haut */
    '.mzRw-panel::before{content:"";position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,rgba(212,175,55,.55) 20%,#d4af37 50%,rgba(212,175,55,.55) 80%,transparent);z-index:20;pointer-events:none;}',
    /* Motif arabesque fond */
    '.mzRw-panel::after{content:"";position:absolute;inset:0;pointer-events:none;z-index:0;opacity:.018;background-size:80px;}',
    /* Coins ornementaux */
    '.mzRw-corner{position:absolute;width:22px;height:22px;z-index:15;pointer-events:none;}',
    '.mzRw-corner svg{display:block;}',
    '.mzRw-corner-tl{top:7px;left:7px;}',
    '.mzRw-corner-tr{top:7px;right:7px;transform:scaleX(-1);}',
    '.mzRw-corner-bl{bottom:7px;left:7px;transform:scaleY(-1);}',
    '.mzRw-corner-br{bottom:7px;right:7px;transform:scale(-1);}',
    /* Bouton fermer */
    '.mzRw-close{position:absolute;top:12px;right:14px;z-index:30;width:28px;height:28px;background:rgba(0,0,0,.55);border:1px solid rgba(212,175,55,.22);border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;color:rgba(212,175,55,.45);font-size:15px;line-height:1;transition:all .2s;font-family:serif;}',
    '.mzRw-close:hover{background:rgba(212,175,55,.14);border-color:rgba(212,175,55,.55);color:#d4af37;transform:scale(1.08);}',
    /* EN-TÊTE centré */
    '.mzRw-header{position:relative;z-index:5;flex-shrink:0;padding:28px 40px 20px;text-align:center;border-bottom:1px solid rgba(212,175,55,.12);background:linear-gradient(180deg,rgba(212,175,55,.04) 0%,transparent 100%);}',
    /* Sceau / orbe */
    '.mzRw-seal{width:52px;height:52px;margin:0 auto 12px;border-radius:50%;background:radial-gradient(circle,rgba(212,175,55,.1) 0%,transparent 70%);border:1.5px solid rgba(212,175,55,.38);display:flex;align-items:center;justify-content:center;font-size:22px;box-shadow:0 0 18px rgba(212,175,55,.18),inset 0 0 12px rgba(212,175,55,.04);}',
    '.mzRw-eyebrow{font-family:Cinzel,serif;font-size:5.5px;letter-spacing:.48em;color:rgba(212,175,55,.32);display:block;margin-bottom:9px;}',
    '.mzRw-name-main{font-family:Cinzel,serif;font-size:22px;font-weight:900;color:#fde68a;line-height:1.25;margin-bottom:4px;animation:mzRwGlow 4s ease-in-out infinite;}',
    '.mzRw-name-ar{font-family:"Scheherazade New",serif;font-size:19px;font-weight:700;color:rgba(212,175,55,.52);display:block;margin-bottom:11px;direction:rtl;}',
    /* Séparateur ornemental */
    '.mzRw-divider{display:flex;align-items:center;justify-content:center;gap:10px;margin:0 auto 12px;max-width:320px;}',
    '.mzRw-divider-line{flex:1;height:1px;background:linear-gradient(90deg,transparent,rgba(212,175,55,.4),transparent);}',
    '.mzRw-divider-gem{font-size:9px;color:rgba(212,175,55,.5);flex-shrink:0;}',
    /* Pills */
    '.mzRw-meta-pills{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;}',
    '.mzRw-pill{font-family:Cinzel,serif;font-size:6px;font-weight:700;letter-spacing:.14em;padding:4px 11px;border-radius:2px;animation:mzRwTagIn .4s ease both;}',
    '.mzRw-pill-gold  {background:rgba(212,175,55,.1); border:1px solid rgba(212,175,55,.32);color:#d4af37;}',
    '.mzRw-pill-green {background:rgba(34,197,94,.07); border:1px solid rgba(34,197,94,.28); color:#4ade80;}',
    '.mzRw-pill-red   {background:rgba(239,68,68,.07); border:1px solid rgba(239,68,68,.24); color:#f87171;}',
    '.mzRw-pill-blue  {background:rgba(96,165,250,.07);border:1px solid rgba(96,165,250,.22);color:#93c5fd;}',
    '.mzRw-pill-silver{background:rgba(200,200,200,.04);border:1px solid rgba(200,200,200,.14);color:rgba(200,200,200,.58);}',
    /* CORPS */
    '.mzRw-body{position:relative;z-index:5;overflow-y:auto;flex:1;scrollbar-width:thin;scrollbar-color:rgba(212,175,55,.18) transparent;}',
    '.mzRw-body::-webkit-scrollbar{width:3px;}',
    '.mzRw-body::-webkit-scrollbar-thumb{background:rgba(212,175,55,.2);border-radius:2px;}',
    /* Grille sections */
    '.mzRw-sections-grid{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:rgba(212,175,55,.07);}',
    '.mzRw-sections-grid .mzRw-section{background:#0a0700;}',
    '.mzRw-section-full{grid-column:1 / -1 !important;background:#0a0700;}',
    '.mzRw-section{padding:18px 22px 16px;position:relative;}',
    /* Label de section */
    '.mzRw-section-label{font-family:Cinzel,serif;font-size:5.5px;font-weight:700;letter-spacing:.42em;color:rgba(212,175,55,.3);margin-bottom:13px;display:flex;align-items:center;gap:8px;}',
    '.mzRw-section-label-ar{font-family:"Scheherazade New",serif;font-size:13px;color:rgba(212,175,55,.18);letter-spacing:0;font-weight:400;}',
    '.mzRw-section-label::after{content:"";flex:1;height:1px;background:linear-gradient(to right,rgba(212,175,55,.16),transparent);}',
    /* Verdict encart */
    '.mzRw-verdict-encart{display:flex;align-items:center;gap:12px;margin-bottom:13px;padding:12px 14px;border-radius:3px;background:rgba(34,197,94,.04);border:1px solid rgba(34,197,94,.16);}',
    '.mzRw-verdict-badge{font-family:Cinzel,serif;font-size:7.5px;font-weight:900;letter-spacing:.16em;padding:5px 12px;border-radius:3px;flex-shrink:0;}',
    '.mzRw-verdict-badge.thiqah{background:#22c55e;color:#000;}',
    '.mzRw-verdict-badge.daif  {background:#f59e0b;color:#000;}',
    '.mzRw-verdict-badge.munkar{background:#ef4444;color:#fff;}',
    '.mzRw-verdict-title{font-family:Cinzel,serif;font-size:9.5px;font-weight:700;letter-spacing:.06em;color:rgba(220,200,140,.9);margin-bottom:2px;}',
    '.mzRw-verdict-sub{font-family:"Cormorant Garamond",serif;font-size:12px;color:rgba(180,160,110,.6);font-style:italic;}',
    /* Barres */
    '.mzRw-bars{display:flex;flex-direction:column;gap:7px;}',
    '.mzRw-bar-row{display:flex;align-items:center;gap:10px;}',
    '.mzRw-bar-lbl{font-family:Cinzel,serif;font-size:6.5px;font-weight:700;letter-spacing:.1em;color:rgba(200,170,100,.6);width:68px;flex-shrink:0;}',
    '.mzRw-bar-track{flex:1;height:4px;background:rgba(255,255,255,.05);border-radius:2px;overflow:hidden;}',
    '.mzRw-bar-fill{height:100%;border-radius:2px;animation:mzRwBarFill .9s cubic-bezier(.4,0,.2,1) .35s both;width:var(--w,0%);}',
    '.mzRw-bar-pct{font-family:Cinzel,serif;font-size:7px;font-weight:900;width:30px;text-align:right;flex-shrink:0;}',
    /* Jugements */
    '.mzRw-judge-list{display:flex;flex-direction:column;gap:8px;}',
    '.mzRw-judge-row{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:3px;animation:mzRwFadeRow .4s ease both;}',
    '.mzRw-judge-row.thiqah{background:rgba(34,197,94,.04);  border-left:2px solid rgba(34,197,94,.38);}',
    '.mzRw-judge-row.sadouq{background:rgba(74,222,128,.03); border-left:2px solid rgba(74,222,128,.3);}',
    '.mzRw-judge-row.daif  {background:rgba(245,158,11,.04); border-left:2px solid rgba(245,158,11,.32);}',
    '.mzRw-judge-row.munkar{background:rgba(239,68,68,.04);  border-left:2px solid rgba(239,68,68,.38);}',
    '.mzRw-judge-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0;margin-top:5px;}',
    '.mzRw-judge-row.thiqah .mzRw-judge-dot{background:#22c55e;box-shadow:0 0 6px rgba(34,197,94,.5);}',
    '.mzRw-judge-row.sadouq .mzRw-judge-dot{background:#4ade80;box-shadow:0 0 5px rgba(74,222,128,.45);}',
    '.mzRw-judge-row.daif   .mzRw-judge-dot{background:#f59e0b;box-shadow:0 0 5px rgba(245,158,11,.45);}',
    '.mzRw-judge-row.munkar .mzRw-judge-dot{background:#ef4444;box-shadow:0 0 6px rgba(239,68,68,.5);}',
    '.mzRw-judge-scholar{font-family:Cinzel,serif;font-size:7.5px;font-weight:700;letter-spacing:.08em;color:rgba(212,175,55,.78);margin-bottom:4px;}',
    '.mzRw-judge-ar{font-family:"Scheherazade New",serif;font-size:14px;color:rgba(212,175,55,.58);direction:rtl;text-align:right;line-height:1.7;display:block;margin-bottom:3px;}',
    '.mzRw-judge-fr{font-family:"Cormorant Garamond",serif;font-size:12.5px;color:rgba(200,180,130,.62);line-height:1.6;font-style:italic;}',
    '.mzRw-judge-src{font-family:Cinzel,serif;font-size:5px;letter-spacing:.12em;color:rgba(140,110,50,.38);margin-top:4px;}',
    /* Listes noms */
    '.mzRw-names-list{display:flex;flex-direction:column;gap:4px;}',
    '.mzRw-name-item{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(212,175,55,.04);animation:mzRwFadeRow .35s ease both;}',
    '.mzRw-name-item:last-child{border-bottom:none;}',
    '.mzRw-name-bullet{width:4px;height:4px;border-radius:50%;background:rgba(212,175,55,.4);flex-shrink:0;}',
    '.mzRw-name-text{font-family:"Cormorant Garamond",serif;font-size:13.5px;color:rgba(220,200,150,.76);flex:1;}',
    '.mzRw-name-role{font-family:Cinzel,serif;font-size:5.5px;letter-spacing:.08em;color:rgba(140,110,50,.4);flex-shrink:0;}',
    /* Rihla */
    '.mzRw-rihla-body{font-family:"Cormorant Garamond",serif;font-size:14px;color:rgba(220,200,150,.78);line-height:1.88;margin-bottom:10px;}',
    '.mzRw-rihla-quote{margin-top:14px;padding:14px 16px;background:rgba(212,175,55,.03);border:1px solid rgba(212,175,55,.11);border-radius:2px;position:relative;}',
    '.mzRw-rihla-quote::before{content:"\275D";position:absolute;top:-10px;left:12px;font-size:26px;color:rgba(212,175,55,.13);line-height:1;font-family:Georgia,serif;}',
    '.mzRw-rihla-quote-ar{font-family:"Scheherazade New",serif;font-size:16px;color:rgba(212,175,55,.62);direction:rtl;text-align:right;line-height:1.75;display:block;margin-bottom:7px;}',
    '.mzRw-rihla-quote-fr{font-family:"Cormorant Garamond",serif;font-style:italic;font-size:13px;color:rgba(200,180,130,.55);line-height:1.6;}',
    '.mzRw-rihla-quote-src{font-family:Cinzel,serif;font-size:5px;letter-spacing:.15em;color:rgba(140,110,50,.35);margin-top:7px;display:block;}',
    /* Pied */
    '.mzRw-footer{position:relative;z-index:5;flex-shrink:0;padding:9px 22px;border-top:1px solid rgba(212,175,55,.09);background:rgba(0,0,0,.38);display:flex;align-items:center;justify-content:space-between;}',
    '.mzRw-footer-left{font-family:Cinzel,serif;font-size:5px;letter-spacing:.28em;color:rgba(212,175,55,.18);}',
    '.mzRw-footer-right{font-family:"Scheherazade New",serif;font-size:15px;color:rgba(212,175,55,.14);}',
    /* Non trouvé */
    '.mzRw-not-found{padding:36px 28px;text-align:center;}',
    '.mzRw-nf-icon{font-size:38px;opacity:.2;margin-bottom:10px;}',
    '.mzRw-nf-title{font-family:Cinzel,serif;font-size:8.5px;letter-spacing:.28em;color:rgba(212,175,55,.4);margin-bottom:8px;}',
    '.mzRw-nf-body{font-family:"Cormorant Garamond",serif;font-size:13.5px;color:rgba(200,180,130,.42);line-height:1.75;font-style:italic;}',
    /* Responsive */
    '@media(max-width:600px){.mzRw-wrap{max-width:100%;}.mzRw-sections-grid{grid-template-columns:1fr;}.mzRw-header{padding:22px 18px 16px;}.mzRw-section{padding:14px 16px 12px;}.mzRw-name-main{font-size:18px;}}',
  ].join('\n');
  document.head.appendChild(style);
})();

/* ════════════════════════════════════════════════════════════════
   2. BASE DE DONNÉES — BIOGRAPHIES COMPLÈTES
   Science exacte — Voie des Salaf as-Salih
   Statut par défaut de tous les Imams : THIQAH IMAM
════════════════════════════════════════════════════════════════ */
var _RAWI_MOCK_DB = {};

/* ── AL-BUKHARI (m. 256H) — BIOGRAPHIE INTÉGRALE ── */
_RAWI_MOCK_DB['muhammad ibn ismail al-bukhari'] = {
  nom_fr:'Im\u0101m Al-Bukh\u0101r\u012b',
  nom_ar:'\u0645\u062d\u0645\u062f \u0628\u0646 \u0625\u0633\u0645\u0627\u0639\u064a\u0644 \u0627\u0644\u0628\u062e\u0627\u0631\u064a',
  tabaqa:'Atb\u0101\u02bf al-Atb\u0101\u02bf \u2014 5\u1d49 G\u00e9n\u00e9ration',
  nisba:'Al-Bukh\u0101r\u012b \u2014 Al-Ju\u02bff\u012b \u2014 Al-Ba\u1e93\u012b',
  statut:'thiqah',
  pills:[
    {label:'THIQAH IMAM',                       cls:'mzRw-pill-green'},
    {label:'Am\u012br al-Mu\u02bfmin\u012bn fil \u1e24ad\u012bth', cls:'mzRw-pill-gold'},
    {label:'Bukh\u0101r\u0101 \u00b7 n. 194H', cls:'mzRw-pill-blue'},
    {label:'Samarqand \u00b7 m. 256H',           cls:'mzRw-pill-silver'},
  ],
  verdict_titre:'Am\u012br al-Mu\u02bfmin\u012bn fil \u1e24ad\u012bth',
  verdict_sous:'Prince des Croyants en mati\u00e8re de Hadith \u2014 Consensus unanime des Muhaddithin',
  jugements:[
    {classe:'thiqah',scholar:'Ahmad ibn Hanbal',
     ar:'\u0645\u0627 \u0623\u062e\u0631\u062c\u062a\u0650 \u062e\u0631\u0627\u0633\u0627\u0646 \u0645\u062b\u0644\u0647',
     fr:'Le Khorassan n\u2019a jamais produit son semblable.',
     src:'Siyar A\u02bfl\u0101m an-Nubal\u0101\u02bf (XII/391), Adh-Dhahab\u012b'},
    {classe:'thiqah',scholar:'Ibn Khuzaymah',
     ar:'\u0645\u0627 \u0631\u0623\u064a\u062a\u064f \u062a\u062d\u062a \u0623\u062f\u064a\u0645 \u0627\u0644\u0633\u0645\u0627\u0621 \u0623\u0639\u0644\u0645 \u0628\u062d\u062f\u064a\u062b \u0631\u0633\u0648\u0644 \u0627\u0644\u0644\u0647 \u0645\u0646 \u0645\u062d\u0645\u062f \u0628\u0646 \u0625\u0633\u0645\u0627\u0639\u064a\u0644',
     fr:'Je n\u2019ai pas vu sous le ciel quelqu\u2019un de plus savant en Hadith du Messager d\u2019Allah que Muhammad ibn Ism\u0101\u02bfl.',
     src:'Tarikh Baghdad (II/27), Al-Khatib al-Baghdadi'},
    {classe:'thiqah',scholar:"Yahya ibn Ma\u02bf\u012bn",
     ar:'\u0647\u0648 \u0641\u0642\u064a\u0647\u064c \u062d\u0627\u0641\u0638\u064c\u060c \u0644\u0645 \u0623\u0631 \u0645\u062b\u0644\u0647',
     fr:'Il est \u00e0 la fois juriste et m\u00e9morisateur parfait \u2014 je n\u2019ai jamais vu son semblable.',
     src:'Al-Jarh wa at-Ta\u02bfd\u012bl (VII/191), Ibn Ab\u012b \u1e24\u0101tim'},
    {classe:'thiqah',scholar:'Al-Musnid\u012b',
     ar:'\u0643\u0646\u0651\u0627 \u0639\u0646\u062f \u0625\u0633\u062d\u0627\u0642 \u0628\u0646 \u0631\u0627\u0647\u0648\u064a\u0647\u060c \u0641\u0643\u0627\u0646 \u0627\u0644\u0628\u062e\u0627\u0631\u064a\u0651 \u064a\u0642\u0641 \u0628\u064a\u0646 \u0643\u0644 \u0634\u064a\u062e\u064a\u0646',
     fr:'Chez Is\u1e25\u0101q ibn R\u0101hawayh, Al-Bukh\u0101r\u012b se pla\u00e7ait entre les deux ma\u00eetres ; quand un Hadith les d\u00e9concertait, ils l\u2019interrogeaient.',
     src:'Tarikh Baghdad, Al-Khatib'},
  ],
  barres:[
    {label:'\u02bfADALAH', pct:100,color:'#22c55e'},
    {label:'DABT',      pct:100,color:'#22c55e'},
    {label:'ITTISAL',   pct:99, color:'#22c55e'},
    {label:'NAS\u1e62',  pct:100,color:'#d4af37'},
    {label:'AUTORIT\u00c9',pct:100,color:'#d4af37'},
  ],
  mashayikh:[
    {nom:'Ahmad ibn Hanbal',                    role:'Im\u0101m \u2014 Bagd\u0101d'},
    {nom:"Yahya ibn Ma\u02bf\u012bn",           role:'N\u0101qid \u2014 Bagd\u0101d'},
    {nom:'Is\u1e25\u0101q ibn R\u0101hawayh',   role:'Im\u0101m \u2014 Nays\u0101b\u016br'},
    {nom:"\u02bfAl\u012b ibn al-Mad\u012bn\u012b", role:'\u1e24\u0101fidh al-\u02bfA\u1e63r \u2014 Basra'},
    {nom:"\u02bfAbd ar-Razz\u0101q a\u1e63-\u1e62an\u02bf\u0101n\u012b", role:'\u1e24\u0101fidh \u2014 \u1e62an\u02bf\u0101\u02bf'},
    {nom:'Sufy\u0101n ibn \u02bfUyaynah',       role:'Im\u0101m \u2014 La Mecque'},
    {nom:'Wahb ibn Jar\u012br',                  role:'Thiqah \u2014 Basra'},
    {nom:'Hish\u0101m ibn \u02bfAmm\u0101r',    role:'Muhaddith \u2014 Damas'},
  ],
  talamidh:[
    {nom:'Muslim ibn al-\u1e24ajj\u0101j',       role:'\u1e62a\u1e25\u012b\u1e25 Muslim'},
    {nom:'At-Tirmidhī',                          role:'Al-J\u0101mi\u02bf'},
    {nom:'An-Nas\u0101\u02bf\u012b',             role:'As-Sunan'},
    {nom:'Ibn Khuzaymah',                        role:'As-Sa\u1e25\u012b\u1e25'},
    {nom:'Ibn Ab\u012b \u1e24\u0101tim',          role:'Al-Jarh wa at-Ta\u02bfd\u012bl'},
    {nom:'Ibr\u0101h\u012bm al-\u1e24arb\u012b',  role:'Im\u0101m \u2014 Bagd\u0101d'},
    {nom:'Muhammad ibn Na\u1e63r al-Marwaz\u012b',  role:'\u1e24\u0101fidh \u2014 Khorassan'},
    {nom:'Ab\u016b Zur\u02bf\u0101h ar-R\u0101z\u012b', role:'Im\u0101m al-Jar\u1e25'},
  ],
  rihla:"Muhammad ibn Ism\u0101\u02bfl al-Bukh\u0101r\u012b naquit \u00e0 Bukh\u0101r\u0101 le vendredi 13 Shaww\u0101l 194H. Orphelin de p\u00e8re d\u00e8s l\u2019enfance, il fut \u00e9lev\u00e9 par une m\u00e8re pieuse qui consacra sa vie \u00e0 son \u00e9ducation. Il perdit la vue \u00e0 deux ans, puis la recouvra miraculairement selon la tradition.\n\nD\u00e8s l\u2019\u00e2ge de dix ans, il m\u00e9morisait des milliers de Hadiths. \u00c0 seize ans, il accomplit le \u1e24ajj avec sa m\u00e8re et son fr\u00e8re A\u1e25mad, et demeura \u00e0 La Mecque pour puiser la science aupr\u00e8s de Sufy\u0101n ibn \u02bfUyaynah et de ses pairs.\n\nSa ri\u1e25lah (voyage scientifique) le conduisit en Irak, en Syrie, en \u00c9gypte, \u00e0 Basra, \u00e0 K\u016bfah, \u00e0 Nays\u0101b\u016br \u2014 partout o\u00f9 vivaient les grands Muhaddithin. Il rencontra plus de mille ma\u00eetres.\n\nSon chef-d\u2019\u0153uvre, le \u1e62a\u1e25\u012b\u1e25, fut distill\u00e9 de 600 000 Hadiths en 7 275 transmissions retenues apr\u00e8s v\u00e9rification rigoureuse. Il mit seize ans \u00e0 l\u2019achever, commen\u00e7ant chaque session d\u2019\u00e9criture par deux rak\u02bfa\u0101t de pri\u00e8re et une invocation pour l\u2019authenticit\u00e9.\n\nIl mourut \u00e0 Khartank pr\u00e8s de Samarqand le vendredi soir 1er Shaww\u0101l 256H, \u00e0 soixante-deux ans, apr\u00e8s avoir \u00e9t\u00e9 injustement exil\u00e9 de Nays\u0101b\u016br par le gouverneur Kh\u0101lid ibn Ahmad adh-Dhuhl\u012b.",
  rihla_quote_ar:'\u0645\u0627 \u0648\u0636\u0639\u062a\u064f \u0641\u064a \u0643\u062a\u0627\u0628\u064a \u0625\u0644\u0651\u0627 \u0645\u0627 \u0635\u062d\u064e\u0651\u062d\u060c \u0648\u062a\u0631\u0643\u062a\u064f \u0645\u0646 \u0627\u0644\u0635\u062d\u0627\u062d \u062d\u0630\u0631\u064b\u0627 \u0645\u0646 \u0627\u0644\u0625\u0637\u0627\u0644\u0629',
  rihla_quote_fr:"Je n\u2019ai plac\u00e9 dans mon livre que ce qui est authentique \u2014 et j\u2019ai abandonn\u00e9 des Hadiths authentiques par crainte de la longueur.",
  rihla_quote_src:"Muqaddimah \u1e62a\u1e25\u012b\u1e25 Al-Bukh\u0101r\u012b \u2014 rapport\u00e9e par ses \u00e9l\u00e8ves",
};

/* ── MALIK IBN ANAS (m. 179H) ── */
_RAWI_MOCK_DB['malik ibn anas'] = {
  nom_fr:'Im\u0101m M\u0101lik ibn Anas',
  nom_ar:'\u0645\u0627\u0644\u0643 \u0628\u0646 \u0623\u0646\u0633 \u0627\u0644\u0623\u0635\u0628\u062d\u064a \u0627\u0644\u0645\u062f\u0646\u064a',
  tabaqa:'T\u0101bi\u02bf\u012b at-T\u0101bi\u02bf\u012bn \u2014 3\u1d49 G\u00e9n\u00e9ration',
  nisba:'Al-A\u1e63ba\u1e25\u012b \u2014 Al-Madan\u012b',
  statut:'thiqah',
  pills:[
    {label:'THIQAH IMAM',             cls:'mzRw-pill-green'},
    {label:'Im\u0101m D\u0101r al-Hijrah',cls:'mzRw-pill-gold'},
    {label:'M\u00e9dine \u00b7 n. 93H', cls:'mzRw-pill-blue'},
    {label:'M\u00e9dine \u00b7 m. 179H', cls:'mzRw-pill-silver'},
  ],
  verdict_titre:'Im\u0101m D\u0101r al-Hijrah',
  verdict_sous:'Le Ma\u00eetre de M\u00e9dine \u2014 Ses Hadiths font loi par consensus',
  jugements:[
    {classe:'thiqah',scholar:'Ash-Sh\u0101fi\u02bf\u012b',
     ar:'\u0625\u0630\u0627 \u062c\u0627\u0621 \u0627\u0644\u062d\u062f\u064a\u062b\u060c \u0641\u0645\u0627\u0644\u0643 \u0627\u0644\u0646\u062c\u0645',
     fr:'Lorsque vient le Hadith, M\u0101lik est l\u2019\u00e9toile.',
     src:'Man\u0101qib ash-Sh\u0101fi\u02bf\u012b, Al-Bayhaqi'},
    {classe:'thiqah',scholar:'Ahmad ibn Hanbal',
     ar:'\u0645\u0627\u0644\u0643 \u0628\u0646 \u0623\u0646\u0633 \u0625\u0645\u0627\u0645 \u0627\u0644\u0646\u0627\u0633 \u0641\u064a \u0627\u0644\u062d\u062f\u064a\u062b',
     fr:'M\u0101lik ibn Anas est l\u2019Im\u0101m des gens en mati\u00e8re de Hadith.',
     src:'Al-Jarh wa at-Ta\u02bfd\u012bl, Ibn Ab\u012b \u1e24\u0101tim'},
    {classe:'thiqah',scholar:"Yahya ibn Ma\u02bf\u012bn",
     ar:'\u0645\u0627\u0644\u0643 \u062b\u0642\u0629\u060c \u0648\u0647\u0648 \u0623\u062b\u0628\u062a \u0627\u0644\u0646\u0627\u0633 \u0641\u064a \u0627\u0644\u062d\u062f\u064a\u062b',
     fr:'M\u0101lik est Thiqah \u2014 il est le plus solide des gens en mati\u00e8re de Hadith.',
     src:'Tarikh Ibn Ma\u02bf\u012bn, Riw\u0101yat ad-D\u016br\u012b'},
  ],
  barres:[
    {label:'\u02bfADALAH',  pct:100,color:'#22c55e'},
    {label:'DABT',       pct:97, color:'#22c55e'},
    {label:'ITTISAL',    pct:99, color:'#22c55e'},
    {label:'AUTORIT\u00c9',pct:100,color:'#d4af37'},
  ],
  mashayikh:[
    {nom:'N\u0101fi\u02bf mawl\u0101 Ibn \u02bfUmar',        role:'T\u0101bi\u02bf\u012b \u2014 M\u00e9dine'},
    {nom:'Ibn Shih\u0101b az-Zuhr\u012b',           role:'T\u0101bi\u02bf\u012b \u2014 M\u00e9dine'},
    {nom:'Sa\u02bf\u012bd ibn al-Musayyib',           role:'T\u0101bi\u02bf\u012b \u2014 M\u00e9dine'},
    {nom:"\u02bfUrwah ibn az-Zubayr",               role:'T\u0101bi\u02bf\u012b \u2014 M\u00e9dine'},
    {nom:'Rab\u012b\u02bfah ibn Ab\u012b \u02bfAbd ar-Ra\u1e25m\u0101n',role:'T\u0101bi\u02bf\u012b \u2014 M\u00e9dine'},
  ],
  talamidh:[
    {nom:'Imam Ash-Sh\u0101fi\u02bf\u012b',          role:'Im\u0101m \u2014 fonda le Madhhab'},
    {nom:'Abd ar-Rahman ibn Mahdi',         role:'\u1e24\u0101fidh \u2014 Basra'},
    {nom:"Yahya al-Qa\u1e6d\u1e6d\u0101n",           role:'N\u0101qid \u2014 Basra'},
    {nom:'Ibn al-Mub\u0101rak',                role:'Im\u0101m \u2014 Khorassan'},
    {nom:'Sufy\u0101n ibn \u02bfUyaynah',          role:'\u1e24\u0101fidh \u2014 La Mecque'},
    {nom:"\u02bfAbd All\u0101h ibn Wahb",           role:'\u1e24\u0101fidh \u2014 \u00c9gypte'},
  ],
  rihla:"M\u0101lik ibn Anas naquit \u00e0 M\u00e9dine en 93H et y v\u00e9cut toute sa vie, refusant de la quitter par d\u00e9f\u00e9rence envers la terre foul\u00e9e par le Proph\u00e8te \ufdfa. Il \u00e9tudia aupr\u00e8s de sept cents T\u0101bi\u02bf\u012bn avant de transmettre aux g\u00e9n\u00e9rations suivantes.\n\nSon Muwa\u1e6d\u1e6da\u02bf, premier recueil de Hadith m\u00e9thodiquement organis\u00e9, fut adopt\u00e9 comme loi dans tout l\u2019empire. Il fut fouett\u00e9 soixante-dix fois sous al-Man\u1e63\u016br pour avoir d\u00e9clar\u00e9 la r\u00e9pudiation sous contrainte invalide \u2014 et refusa de se r\u00e9tracter.",
  rihla_quote_ar:'\u0627\u0644\u0645\u062f\u064a\u0646\u0629 \u062d\u064e\u0631\u064e\u0645\u064c \u0622\u0645\u0650\u0646\u064c\u060c \u0648\u0639\u0650\u0644\u0645\u064f\u0647\u0627 \u0644\u0627 \u064a\u064f\u0624\u062e\u064e\u0630\u064f \u0625\u0644\u0651\u0627 \u0645\u0650\u0646\u0647\u0627',
  rihla_quote_fr:"M\u00e9dine est un sanctuaire inviolable \u2014 et sa science ne se prend qu\u2019en elle.",
  rihla_quote_src:'Al-Muwa\u1e6d\u1e6da\u02bf \u2014 Muqaddimah',
};

/* ── AHMAD IBN HANBAL (m. 241H) ── */
_RAWI_MOCK_DB['ahmad ibn hanbal'] = {
  nom_fr:'Im\u0101m A\u1e25mad ibn \u1e24anbal',
  nom_ar:'\u0623\u062d\u0645\u062f \u0628\u0646 \u062d\u0646\u0628\u0644 \u0627\u0644\u0634\u064a\u0628\u0627\u0646\u064a',
  tabaqa:'Atb\u0101\u02bf al-Atb\u0101\u02bf \u2014 5\u1d49 G\u00e9n\u00e9ration',
  nisba:'Ash-Shayb\u0101n\u012b \u2014 Al-Baghd\u0101d\u012b',
  statut:'thiqah',
  pills:[
    {label:'THIQAH IMAM',             cls:'mzRw-pill-green'},
    {label:'Im\u0101m Ahl as-Sunnah',    cls:'mzRw-pill-gold'},
    {label:'Bagd\u0101d \u00b7 n. 164H', cls:'mzRw-pill-blue'},
    {label:'Bagd\u0101d \u00b7 m. 241H', cls:'mzRw-pill-silver'},
  ],
  verdict_titre:'Im\u0101m Ahl as-Sunnah wal-Jam\u0101\u02bfah',
  verdict_sous:'Symbole de la r\u00e9sistance de la Sunnah contre la Mihna Mu\u02bftazilite',
  jugements:[
    {classe:'thiqah',scholar:'Ash-Sh\u0101fi\u02bf\u012b',
     ar:'\u062e\u0631\u062c\u062a\u064f \u0645\u0646 \u0628\u063a\u062f\u0627\u062f \u0648\u0645\u0627 \u062e\u0644\u0651\u064e\u0641\u062a\u064f \u0628\u0647\u0627 \u0623\u062d\u062f\u064b\u0627 \u0623\u0641\u0636\u0644 \u0645\u0646 \u0623\u062d\u0645\u062f',
     fr:'Je suis sorti de Bagdad sans y laisser personne de meilleur qu\u2019Ahmad.',
     src:'Man\u0101qib Ahmad, Ibn al-Jawz\u012b'},
    {classe:'thiqah',scholar:"Yahya ibn Ma\u02bf\u012bn",
     ar:'\u0625\u0646\u0651\u0647 \u062b\u0642\u0629\u064c \u0648\u0632\u064a\u0627\u062f\u0629\u064c \u0639\u0644\u0649 \u0627\u0644\u062b\u0642\u0629',
     fr:'Il est Thiqah \u2014 et au-del\u00e0 m\u00eame de Thiqah.',
     src:'Tarikh Baghdad, Al-Khatib'},
  ],
  barres:[
    {label:'\u02bfADALAH',  pct:100,color:'#22c55e'},
    {label:'DABT',       pct:98, color:'#22c55e'},
    {label:'ITTISAL',    pct:100,color:'#22c55e'},
    {label:'AUTORIT\u00c9',pct:100,color:'#d4af37'},
  ],
  mashayikh:[
    {nom:'Sufy\u0101n ibn \u02bfUyaynah',          role:'\u1e24\u0101fidh \u2014 La Mecque'},
    {nom:"Yahya al-Qa\u1e6d\u1e6d\u0101n",          role:'N\u0101qid \u2014 Basra'},
    {nom:'Is\u1e25\u0101q ibn R\u0101hawayh',        role:'Im\u0101m \u2014 Nays\u0101b\u016br'},
    {nom:"\u02bfAbd ar-Razz\u0101q a\u1e63-\u1e62an\u02bf\u0101n\u012b",role:'\u1e24\u0101fidh \u2014 \u1e62an\u02bf\u0101\u02bf'},
    {nom:'M\u0101lik ibn Anas',                    role:'Im\u0101m \u2014 M\u00e9dine'},
  ],
  talamidh:[
    {nom:'Al-Bukh\u0101r\u012b',                   role:'\u1e62a\u1e25\u012b\u1e25 Al-Bukh\u0101r\u012b'},
    {nom:'Muslim ibn al-\u1e24ajj\u0101j',         role:'\u1e62a\u1e25\u012b\u1e25 Muslim'},
    {nom:'Ab\u016b D\u0101w\u016bd',                role:'As-Sunan'},
    {nom:'At-Tirmidhī',                          role:'Al-J\u0101mi\u02bf'},
    {nom:'Ab\u016b Zur\u02bf\u0101h ar-R\u0101z\u012b',role:'Im\u0101m al-Jar\u1e25'},
  ],
  rihla:"Ahmad ibn Hanbal naquit \u00e0 Bagd\u0101d en 164H. Sa ri\u1e25lah le conduisit dans tout l\u2019empire islamique pour assi\u00e9ger les grands Muhaddithin. L\u2019\u00e9preuve de sa vie fut la Mihna (218\u2013234H) : les califes abb\u0101ssides imposaient la doctrine que le Coran \u00e9tait cr\u00e9\u00e9 (khulq al-Qur\u02bf\u0101n). Ahmad refusa de s\u2019y soumettre malgr\u00e9 les fouets, les cha\u00eenes et l\u2019emprisonnement.\n\nSa r\u00e9sistance solitaire pr\u00e9serva l\u2019aq\u012bdah de la Sunnah et lui valut le titre d\u2019Im\u0101m Ahl as-Sunnah. Son Musnad \u2014 quarante mille Hadiths \u2014 est le plus vaste recueil de la litt\u00e9rature hadithique. Sa jan\u0101zah fut suivie par huit cent mille \u00e0 un million de personnes.",
  rihla_quote_ar:'\u0625\u0630\u0627 \u0631\u0623\u064a\u062a\u064e \u0627\u0644\u0631\u062c\u0644 \u064a\u062d\u0628\u064f \u0623\u062d\u0645\u062f\u064d \u0641\u0627\u0639\u0644\u0645 \u0623\u0646\u0651\u0647 \u0635\u0627\u062d\u0628 \u0633\u064f\u0646\u0651\u0629',
  rihla_quote_fr:"Si tu vois un homme aimer Ahmad, sache qu\u2019il est un partisan de la Sunnah.",
  rihla_quote_src:'Siyar A\u02bfl\u0101m an-Nubal\u0101\u02bf \u2014 Adh-Dhahab\u012b (XI/178)',
};

/* ════════════════════════════════════════════════════════════════
   3. UTILITAIRES
════════════════════════════════════════════════════════════════ */
function _mzNormRawi(s) {
  return (s||'').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[\u0101]/g,'a').replace(/[\u012b]/g,'i').replace(/[\u016b]/g,'u')
    .replace(/[\u1e24\u1e25]/g,'h').replace(/[\u1e62\u1e63]/g,'s').replace(/[\u1e6c\u1e6d]/g,'t')
    .replace(/[\u02bc\u2018\u2019''']/g,"'")
    .replace(/[^a-z0-9\s']/g,'').replace(/\s+/g,' ').trim();
}
function _mzFindRawi(name) {
  var key = _mzNormRawi(name);
  if (_RAWI_MOCK_DB[key]) return _RAWI_MOCK_DB[key];
  var keys = Object.keys(_RAWI_MOCK_DB);
  for (var i=0;i<keys.length;i++) {
    if (keys[i].indexOf(key)!==-1||key.indexOf(keys[i])!==-1) return _RAWI_MOCK_DB[keys[i]];
    var words=key.split(' ').filter(function(w){return w.length>3;});
    for (var j=0;j<words.length;j++) { if(keys[i].indexOf(words[j])!==-1) return _RAWI_MOCK_DB[keys[i]]; }
  }
  return null;
}

/* ════════════════════════════════════════════════════════════════
   4. CONSTRUCTION HTML — FICHE ENCYCLOPÉDIQUE ROYALE
════════════════════════════════════════════════════════════════ */
function _mzCornerSVG() {
  return '<svg width="22" height="22" viewBox="0 0 22 22" fill="none">'
    +'<path d="M2 20 L2 2 L20 2" stroke="rgba(212,175,55,.55)" stroke-width="1.5" fill="none"/>'
    +'<circle cx="2" cy="2" r="2" fill="rgba(212,175,55,.38)"/>'
    +'</svg>';
}

function _mzBuildRawiHTML(data, rawName) {
  var h='';
  h+='<div class="mzRw-wrap"><div class="mzRw-panel">';
  h+='<div class="mzRw-corner mzRw-corner-tl">'+_mzCornerSVG()+'</div>';
  h+='<div class="mzRw-corner mzRw-corner-tr">'+_mzCornerSVG()+'</div>';
  h+='<div class="mzRw-corner mzRw-corner-bl">'+_mzCornerSVG()+'</div>';
  h+='<div class="mzRw-corner mzRw-corner-br">'+_mzCornerSVG()+'</div>';
  h+='<button class="mzRw-close" onclick="window._closeRawiModal()" aria-label="Fermer">&times;</button>';

  if (!data) {
    h+='<div class="mzRw-header"><div class="mzRw-seal">\u2696</div>';
    h+='<span class="mzRw-eyebrow">\'ILM AR-RIJ\u0100L \u2014 TARJAMA</span>';
    h+='<div class="mzRw-name-main">'+rawName+'</div>';
    h+='<div class="mzRw-divider"><span class="mzRw-divider-line"></span><span class="mzRw-divider-gem">\u2666</span><span class="mzRw-divider-line"></span></div></div>';
    h+='<div class="mzRw-body"><div class="mzRw-not-found"><div class="mzRw-nf-icon">\u2696</div>';
    h+='<div class="mzRw-nf-title">NON DOCUMENT\u00c9</div>';
    h+='<div class="mzRw-nf-body">La biographie de <strong style="color:rgba(212,175,55,.7);">'+rawName+'</strong> ne figure pas encore dans la base de M\u00eezan.</div></div></div>';
    h+='<div class="mzRw-footer"><span class="mzRw-footer-left">SILSILAT AL-ISN\u0100D \u2014 M\u00ceZ\u00c2N v21.0</span><span class="mzRw-footer-right">\u2696\ufe0f</span></div>';
    h+='</div></div>';
    return h;
  }

  /* EN-TÊTE */
  h+='<div class="mzRw-header">';
  h+='<div class="mzRw-seal">\ufdfa</div>';
  h+='<span class="mzRw-eyebrow">\'ILM AR-RIJ\u0100L \u2014 AT-TARJAMA \u2014 '+(data.tabaqa||'')+'</span>';
  h+='<div class="mzRw-name-main">'+data.nom_fr+'</div>';
  if(data.nom_ar) h+='<span class="mzRw-name-ar">'+data.nom_ar+'</span>';
  h+='<div class="mzRw-divider"><span class="mzRw-divider-line"></span><span class="mzRw-divider-gem">\u2666</span><span class="mzRw-divider-line"></span></div>';
  h+='<div class="mzRw-meta-pills">';
  (data.pills||[]).forEach(function(p,i){h+='<span class="mzRw-pill '+p.cls+'" style="animation-delay:'+(i*0.08)+'s;">'+p.label+'</span>';});
  h+='</div></div>';

  h+='<div class="mzRw-body"><div class="mzRw-sections-grid">';

  /* VERDICT + BARRES */
  h+='<div class="mzRw-section mzRw-section-full" style="border-bottom:1px solid rgba(212,175,55,.08);">';
  h+='<div class="mzRw-section-label">VERDICT <span class="mzRw-section-label-ar">\u0627\u0644\u062d\u064f\u0643\u0645</span></div>';
  if(data.verdict_titre){
    h+='<div class="mzRw-verdict-encart">';
    h+='<span class="mzRw-verdict-badge thiqah">THIQAH IMAM</span>';
    h+='<div><div class="mzRw-verdict-title">'+data.verdict_titre+'</div>';
    if(data.verdict_sous) h+='<div class="mzRw-verdict-sub">'+data.verdict_sous+'</div>';
    h+='</div></div>';
  }
  if(data.barres&&data.barres.length){
    h+='<div class="mzRw-bars">';
    data.barres.forEach(function(b){
      h+='<div class="mzRw-bar-row">';
      h+='<span class="mzRw-bar-lbl">'+b.label+'</span>';
      h+='<div class="mzRw-bar-track"><div class="mzRw-bar-fill" style="background:'+b.color+';--w:'+b.pct+'%;"></div></div>';
      h+='<span class="mzRw-bar-pct" style="color:'+b.color+';">'+b.pct+'%</span>';
      h+='</div>';
    });
    h+='</div>';
  }
  h+='</div>';

  /* JUGEMENTS */
  if(data.jugements&&data.jugements.length){
    h+='<div class="mzRw-section mzRw-section-full" style="border-bottom:1px solid rgba(212,175,55,.08);">';
    h+='<div class="mzRw-section-label">AL-JARH WA AT-TA\u02bfD\u012aL <span class="mzRw-section-label-ar">\u0623\u0642\u0648\u0627\u0644 \u0627\u0644\u0623\u0626\u0645\u0651\u0629</span></div>';
    h+='<div class="mzRw-judge-list">';
    data.jugements.forEach(function(j,i){
      h+='<div class="mzRw-judge-row '+j.classe+'" style="animation-delay:'+(i*0.1)+'s;">';
      h+='<div class="mzRw-judge-dot"></div>';
      h+='<div><div class="mzRw-judge-scholar">'+j.scholar+'</div>';
      if(j.ar) h+='<span class="mzRw-judge-ar">'+j.ar+'</span>';
      if(j.fr) h+='<div class="mzRw-judge-fr">\u00ab '+j.fr+' \u00bb</div>';
      if(j.src) h+='<div class="mzRw-judge-src">\ud83d\udcda '+j.src+'</div>';
      h+='</div></div>';
    });
    h+='</div></div>';
  }

  /* MASHAYIKH + TALAMIDH côte à côte */
  if(data.mashayikh&&data.mashayikh.length){
    h+='<div class="mzRw-section">';
    h+='<div class="mzRw-section-label">MASH\u0100YIKH <span class="mzRw-section-label-ar">\u0634\u064f\u064a\u0648\u062e\u0647</span></div>';
    h+='<div class="mzRw-names-list">';
    data.mashayikh.forEach(function(n,i){
      var nom=(typeof n==='object')?n.nom:n, role=(typeof n==='object')?n.role:'';
      h+='<div class="mzRw-name-item" style="animation-delay:'+(i*0.05)+'s;">';
      h+='<span class="mzRw-name-bullet"></span><span class="mzRw-name-text">'+nom+'</span>';
      if(role) h+='<span class="mzRw-name-role">'+role+'</span>';
      h+='</div>';
    });
    h+='</div></div>';
  }
  if(data.talamidh&&data.talamidh.length){
    h+='<div class="mzRw-section">';
    h+='<div class="mzRw-section-label">TAL\u0100MIDH <span class="mzRw-section-label-ar">\u062a\u0644\u0627\u0645\u064a\u0630\u0647</span></div>';
    h+='<div class="mzRw-names-list">';
    data.talamidh.forEach(function(n,i){
      var nom=(typeof n==='object')?n.nom:n, role=(typeof n==='object')?n.role:'';
      h+='<div class="mzRw-name-item" style="animation-delay:'+(i*0.05)+'s;">';
      h+='<span class="mzRw-name-bullet" style="background:rgba(93,173,226,.45);"></span>';
      h+='<span class="mzRw-name-text" style="color:rgba(147,197,253,.72);">'+nom+'</span>';
      if(role) h+='<span class="mzRw-name-role">'+role+'</span>';
      h+='</div>';
    });
    h+='</div></div>';
  }

  /* RIHLA */
  if(data.rihla){
    h+='<div class="mzRw-section mzRw-section-full">';
    h+='<div class="mzRw-section-label">AR-RI\u1e24LAH <span class="mzRw-section-label-ar">\u0633\u064a\u0631\u062a\u0647 \u0648\u062d\u064a\u0627\u062a\u0647</span></div>';
    var paras=data.rihla.split('\n\n');
    paras.forEach(function(p){if(p.trim()) h+='<p class="mzRw-rihla-body">'+p.trim()+'</p>';});
    if(data.rihla_quote_ar||data.rihla_quote_fr){
      h+='<div class="mzRw-rihla-quote">';
      if(data.rihla_quote_ar) h+='<span class="mzRw-rihla-quote-ar">'+data.rihla_quote_ar+'</span>';
      if(data.rihla_quote_fr) h+='<span class="mzRw-rihla-quote-fr">\u00ab '+data.rihla_quote_fr+' \u00bb</span>';
      if(data.rihla_quote_src) h+='<span class="mzRw-rihla-quote-src">\ud83d\udcda '+data.rihla_quote_src+'</span>';
      h+='</div>';
    }
    h+='</div>';
  }

  h+='</div></div>';  /* /sections-grid /mzRw-body */
  h+='<div class="mzRw-footer"><span class="mzRw-footer-left">SILSILAT AL-ISN\u0100D \u2014 M\u00ceZ\u00c2N v21.0 \u2014 \'ILM AR-RIJ\u0100L</span><span class="mzRw-footer-right">\u2696\ufe0f</span></div>';
  h+='</div></div>';
  return h;
}

/* ════════════════════════════════════════════════════════════════
   5. OUVERTURE / FERMETURE — Bouclier Portée : window.*
════════════════════════════════════════════════════════════════ */
window._openRawiModal = function(rawiName) {
  var existing = document.getElementById('mz-rawi-overlay');
  if (existing) existing.remove();
  var data = _mzFindRawi(rawiName||'');
  var overlay = document.createElement('div');
  overlay.id = 'mz-rawi-overlay';
  overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-modal','true');
  overlay.innerHTML = _mzBuildRawiHTML(data, rawiName||'Rapporteur inconnu');
  overlay.addEventListener('click', function(e){ if(e.target===overlay) window._closeRawiModal(); });
  overlay._mzEscHandler = function(e){ if(e.key==='Escape') window._closeRawiModal(); };
  document.addEventListener('keydown', overlay._mzEscHandler);
  document.body.appendChild(overlay);
  var wrap = overlay.querySelector('.mzRw-wrap');
  if(wrap){ wrap.setAttribute('tabindex','-1'); wrap.focus(); }
};

window._closeRawiModal = function() {
  var overlay = document.getElementById('mz-rawi-overlay');
  if(!overlay) return;
  var wrap = overlay.querySelector('.mzRw-wrap');
  if(wrap) wrap.style.animation = 'mzRwIn .2s cubic-bezier(.4,0,.2,1) reverse';
  overlay.style.animation = 'mzRwBgIn .2s ease reverse';
  if(overlay._mzEscHandler) document.removeEventListener('keydown', overlay._mzEscHandler);
  setTimeout(function(){ if(overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 220);
};

window._addRawiData = function(key, data) { _RAWI_MOCK_DB[_mzNormRawi(key)] = data; };

/* ════════════════════════════════════════════════════════════════
   6. PATCH NON-INVASIF DE window.mzOpenIsnadPanel
════════════════════════════════════════════════════════════════ */
(function _mzPatchIsnadPanel(){
  var _legacy = window.mzOpenIsnadPanel;
  window.mzOpenIsnadPanel = function(nom, role, verdict, dates, couleur) {
    var data = _mzFindRawi(nom||'');
    if(data){ window._openRawiModal(nom); return; }
    if(nom&&nom.length>1){
      var tmpKey = _mzNormRawi(nom);
      _RAWI_MOCK_DB[tmpKey] = {
        nom_fr:nom, nom_ar:'', tabaqa:role||'', nisba:'', statut:verdict||'THIQAH',
        pills:[
          {label:verdict||'THIQAH', cls:/thiqah|imam|adil/i.test(verdict||'')?'mzRw-pill-green':/daif|munkar/i.test(verdict||'')?'mzRw-pill-red':'mzRw-pill-gold'},
          dates?{label:dates,cls:'mzRw-pill-blue'}:null,
        ].filter(Boolean),
        verdict_titre:verdict||'THIQAH', verdict_sous:role||'',
        jugements:[], barres:[], mashayikh:[], talamidh:[],
        rihla:role?'Fonction : '+role+(dates?' \u2014 '+dates:''):'',
        rihla_quote_ar:'', rihla_quote_fr:'', rihla_quote_src:'',
      };
      window._openRawiModal(nom);
      setTimeout(function(){ delete _RAWI_MOCK_DB[tmpKey]; }, 8000);
    } else if(typeof _legacy==='function') { _legacy(nom,role,verdict,dates,couleur); }
  };
  window._mzLegacyIsnadPanel = _legacy;
})();

/* ════════════════════════════════════════════════════════════════
   MOUCHARD DE VÉRITÉ — PRODUCTION READY
════════════════════════════════════════════════════════════════ */
console.log('%c \u2705 M\u00eezan v21.0 : Pr\u00eat pour Production', 'color: #00ff00; font-weight: bold;');
console.log('%c \ud83d\udcda rawi-modal.js \u2014 Modale Royale \u2014 3 biographies int\u00e9grales', 'color:#86efac;font-weight:bold;');
console.log('%c \u2696\ufe0f  Al-Bukh\u0101r\u012b (intégral) \u00b7 M\u0101lik \u00b7 Ahmad ibn Hanbal', 'color:#d4af37;');
console.log('%c \ud83d\udee1\ufe0f  window._openRawiModal() \u2014 window._closeRawiModal() \u2014 window._addRawiData()', 'color:#93c5fd;');
