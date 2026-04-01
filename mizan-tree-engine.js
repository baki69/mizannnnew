/* ═══════════════════════════════════════════════════════════════════════
   MIZAN v21.0 — MODULE ISNAD : ARBRE ROYAL DE LA TRANSMISSION
   Fichier : mizan-tree-engine.js
   Role    : Rendu SVG integral de la Silsilat al-Isnad — 14 siecles
   Design  : Clonage pixel-perfect de 35153.jpg — Arbre Royal Organique
             Deux Piliers au sommet · Colonne centrale · Branches Bezier
             Tronc en chaines dorees tressees · Noeuds octogonaux
   Contenu : 8 Rangs — Tous les savants sur 14 siecles
             De Al-Bukhari / Ahmad ibn Hanbal jusqu'a Rabi' / Fawzan
   Bouclier: Triple Secured — Zero backtick HTML — String concat pure
   Science : Voie des Salaf Salih — Bin Baz, Al-Albani, Ibn Uthaymin
             Rabi' Al-Madkhali, Muqbil, Al-Fawzan, Al-Najmi, Zayd
   ═══════════════════════════════════════════════════════════════════════ */

console.log('%c \u2705 M\u00eezan v21.0 \u2014 MODULE ISNAD : Arbre Royal charg\u00e9 (14 si\u00e8cles)', 'color:#00ff00;font-weight:bold;background:#000;padding:4px 8px;');

/* ══════════════════════════════════════════════════════════════════
   1. FONCTIONS UTILITAIRES GLOBALES
   ══════════════════════════════════════════════════════════════════ */

function parseSiecle(siecleStr) {
  if (!siecleStr || typeof siecleStr !== 'string') return null;
  var s = siecleStr.toLowerCase().replace(/\s+/g, ' ').trim();
  var numMatch = s.match(/(\d+)/);
  var numRaw = numMatch ? parseInt(numMatch[1], 10) : 5;
  var couche = 3;
  if (numRaw <= 1)   couche = 1;
  else if (numRaw <= 3)  couche = 2;
  else if (numRaw <= 7)  couche = 3;
  else if (numRaw <= 10) couche = 4;
  else couche = 5;
  if (/proph|nabi|sahab/i.test(s)) couche = 1;
  if (/tabi/i.test(s))             couche = 2;
  if (/contemp|moderne|actuel/i.test(s)) couche = 5;
  return { couche: couche, numRaw: numRaw };
}

function nodeVis(titre, verdict, idx, total) {
  var t = ((titre || '') + ' ' + (verdict || '')).toLowerCase();
  var nameC = '#d4af37';
  var dotC  = 'rgba(212,175,55,1)';
  if (/thiqah|imam|hujjah/i.test(t))         { nameC = '#86efac'; dotC = '#22c55e'; }
  else if (/adil|sadouq|maqbul/i.test(t))    { nameC = '#86efac'; dotC = '#22c55e'; }
  else if (/mudallis|matruk|modal/i.test(t)) { nameC = '#fca5a5'; dotC = '#ef4444'; }
  else if (/munkar|kadhdhab|muttaham/i.test(t)) { nameC = '#fca5a5'; dotC = '#dc2626'; }
  else if (/layyin|da.if/i.test(t))          { nameC = '#fde68a'; dotC = '#f59e0b'; }
  if (idx === 0 && total > 2) { nameC = '#fde68a'; dotC = '#d4af37'; }
  return { nameC: nameC, dotC: dotC };
}

/* ══════════════════════════════════════════════════════════════════
   2. PANNEAU DETAIL AU CLIC SUR UNE CAPSULE
   ══════════════════════════════════════════════════════════════════ */
window.mzOpenIsnadPanel = function(nom, role, verdict, dates, couleur) {
  var existing = document.getElementById('mz-isnad-panel-overlay');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'mz-isnad-panel-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;animation:mzPanelFadeIn .3s ease;';

  var panel = document.createElement('div');
  var col = couleur || '#d4af37';
  panel.style.cssText = 'background:linear-gradient(160deg,#0d0a02,#111827);border:1.5px solid ' + col + '55;border-radius:18px;padding:0;max-width:380px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.9),0 0 40px ' + col + '18;position:relative;overflow:hidden;animation:mzPanelSlideUp .35s ease;';

  /* Ligne lumineuse en haut */
  var topLine = document.createElement('div');
  topLine.style.cssText = 'position:absolute;top:0;left:50%;transform:translateX(-50%);width:180px;height:1px;background:linear-gradient(90deg,transparent,' + col + '80,transparent);pointer-events:none;';
  panel.appendChild(topLine);

  /* Motif arabesque */
  var pattern = document.createElement('div');
  pattern.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:.04;background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'80\' height=\'80\'%3E%3Cpath d=\'M40 5L48 28 72 28 53 43 60 66 40 51 20 66 27 43 8 28 32 28Z\' fill=\'none\' stroke=\'%23d4af37\' stroke-width=\'1\'/%3E%3C/svg%3E");background-size:80px;';
  panel.appendChild(pattern);

  /* Bouton fermer */
  var closeBtn = document.createElement('button');
  closeBtn.innerHTML = '&times;';
  closeBtn.style.cssText = 'position:absolute;top:12px;right:16px;background:none;border:none;color:rgba(212,175,55,.4);font-size:22px;cursor:pointer;z-index:2;line-height:1;transition:color .2s;';
  closeBtn.onmouseenter = function() { this.style.color = 'rgba(212,175,55,.9)'; };
  closeBtn.onmouseleave = function() { this.style.color = 'rgba(212,175,55,.4)'; };
  closeBtn.onclick = function() { overlay.remove(); };
  panel.appendChild(closeBtn);

  /* Contenu */
  var content = document.createElement('div');
  content.style.cssText = 'position:relative;z-index:1;padding:28px 24px 26px;';

  /* Eyebrow */
  var eyebrow = document.createElement('p');
  eyebrow.style.cssText = 'font-family:Cinzel,serif;font-size:5.5px;letter-spacing:.42em;color:rgba(212,175,55,.32);margin-bottom:14px;';
  eyebrow.textContent = 'SILSILAT AL-ISN\u0100D \u2014 FICHE DU R\u0100W\u012a';
  content.appendChild(eyebrow);

  /* Nom */
  var nomEl = document.createElement('h2');
  nomEl.style.cssText = 'font-family:Cinzel,serif;font-size:17px;font-weight:900;color:' + col + ';line-height:1.3;margin-bottom:6px;text-shadow:0 0 20px ' + col + '44;';
  nomEl.textContent = (nom || '').replace(/\n/g, ' ');
  content.appendChild(nomEl);

  /* Dates */
  if (dates) {
    var datesEl = document.createElement('p');
    datesEl.style.cssText = 'font-family:Cormorant Garamond,serif;font-size:13px;font-style:italic;color:rgba(212,175,55,.52);margin-bottom:12px;';
    datesEl.textContent = '(' + dates + ')';
    content.appendChild(datesEl);
  }

  /* Role */
  if (role) {
    var roleEl = document.createElement('p');
    roleEl.style.cssText = 'font-family:Cormorant Garamond,serif;font-size:13.5px;color:rgba(200,180,130,.68);line-height:1.65;margin-bottom:16px;';
    roleEl.textContent = (role || '').replace(/\n/g, ' — ');
    content.appendChild(roleEl);
  }

  /* Verdict badge */
  if (verdict) {
    var vl = verdict.toLowerCase();
    var vBg, vCol;
    if      (/thiqah|imam|hujjah/i.test(vl))   { vBg = 'rgba(34,197,94,.1)';   vCol = '#22c55e'; }
    else if (/adil|sadouq/i.test(vl))           { vBg = 'rgba(34,197,94,.08)';  vCol = '#4ade80'; }
    else if (/mudallis|matruk/i.test(vl))       { vBg = 'rgba(239,68,68,.1)';   vCol = '#ef4444'; }
    else if (/munkar|kadhdhab/i.test(vl))       { vBg = 'rgba(220,38,38,.12)';  vCol = '#dc2626'; }
    else                                         { vBg = 'rgba(212,175,55,.08)'; vCol = '#d4af37'; }

    var vEl = document.createElement('span');
    vEl.style.cssText = 'display:inline-block;padding:5px 18px;border-radius:5px;background:' + vBg + ';border:1px solid ' + vCol + '44;font-family:Cinzel,serif;font-size:8px;font-weight:900;letter-spacing:.22em;color:' + vCol + ';';
    vEl.textContent = verdict.toUpperCase();
    content.appendChild(vEl);
  }

  /* Citation Al-Khatib */
  var sep = document.createElement('div');
  sep.style.cssText = 'margin-top:18px;padding-top:14px;border-top:1px solid rgba(212,175,55,.1);';
  var sepText = document.createElement('p');
  sepText.style.cssText = 'font-family:Cormorant Garamond,serif;font-size:11.5px;font-style:italic;color:rgba(200,180,130,.32);line-height:1.6;';
  sepText.textContent = '\u00ab Le Jarh document\u00e9 pr\u00e9vaut sur le Ta\u2019d\u012bl. \u00bb \u2014 Al-Khatib al-Baghdadi \u2014 M\u00e9thodologie des Salaf';
  sep.appendChild(sepText);
  content.appendChild(sep);

  panel.appendChild(content);
  overlay.appendChild(panel);
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);

  if (!document.getElementById('mzPanelAnimCSS')) {
    var st = document.createElement('style');
    st.id = 'mzPanelAnimCSS';
    st.textContent = '@keyframes mzPanelFadeIn{from{opacity:0}to{opacity:1}}@keyframes mzPanelSlideUp{from{opacity:0;transform:translateY(22px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}';
    document.head.appendChild(st);
  }
};

/* ══════════════════════════════════════════════════════════════════
   3. INJECTION CSS ARBRE (une seule fois)
   ══════════════════════════════════════════════════════════════════ */
function _mzInjectArbreCSS() {
  if (document.getElementById('mzArbre-css-v21')) return;
  var sc = document.createElement('style');
  sc.id = 'mzArbre-css-v21';
  sc.textContent = [
    /* Animations de base */
    '@keyframes mzAr-chainAnim{from{background-position:0 0}to{background-position:0 40px}}',
    '@keyframes mzAr-nodeIn{from{opacity:0;transform:translateY(-14px) scale(.88)}to{opacity:1;transform:translateY(0) scale(1)}}',
    '@keyframes mzAr-orbPulse{0%,100%{box-shadow:0 0 0 8px rgba(212,175,55,.06),0 0 60px rgba(255,220,80,.6),0 0 120px rgba(212,175,55,.35)}50%{box-shadow:0 0 0 10px rgba(212,175,55,.1),0 0 90px rgba(255,230,100,.9),0 0 180px rgba(212,175,55,.55)}}',
    '@keyframes mzAr-glow{0%,100%{text-shadow:0 0 14px rgba(212,175,55,.5)}50%{text-shadow:0 0 32px rgba(255,215,0,.9),0 0 60px rgba(212,175,55,.45)}}',
    '@keyframes mzAr-sealPulse{0%,100%{box-shadow:0 0 30px rgba(212,175,55,.5),0 0 70px rgba(212,175,55,.18),inset 0 0 20px rgba(212,175,55,.08)}50%{box-shadow:0 0 50px rgba(212,175,55,.7),0 0 100px rgba(212,175,55,.3),inset 0 0 30px rgba(212,175,55,.14)}}',
    '@keyframes mzAr-linkTravel{from{left:0;opacity:0}20%{opacity:1}80%{opacity:1}to{left:100%;opacity:0}}',
    '@keyframes mzAr-pillarIn{from{opacity:0;transform:translateY(-18px) scale(.85)}to{opacity:1;transform:translateY(0) scale(1)}}',
    /* Conteneur principal */
    '.mzAr{position:relative;width:100%;background:radial-gradient(ellipse at 50% 0%,rgba(212,175,55,.09) 0%,transparent 62%),linear-gradient(180deg,#080500 0%,#0a0700 60%,#050300 100%);overflow:hidden;padding:0 6px 56px;display:flex;flex-direction:column;align-items:center;}',
    /* SVG tronc */
    '.mzAr-trunk{position:absolute;left:50%;transform:translateX(-50%);top:0;width:72px;z-index:1;pointer-events:none;overflow:visible;}',
    /* Titre */
    '.mzAr-title{font-family:Cinzel,serif;font-size:5.5px;letter-spacing:.4em;color:rgba(212,175,55,.28);margin-bottom:18px;padding-top:18px;z-index:10;position:relative;text-align:center;}',
    /* Orbe Prophète */
    '.mzAr-prophet{display:flex;flex-direction:column;align-items:center;z-index:10;position:relative;margin-bottom:0;}',
    '.mzAr-orb{width:110px;height:110px;border-radius:50%;background:radial-gradient(circle at 38% 32%,rgba(255,235,100,.28),rgba(212,175,55,.09) 55%,transparent 72%);border:3px solid rgba(255,220,80,.88);display:flex;align-items:center;justify-content:center;font-size:44px;box-shadow:0 0 0 8px rgba(212,175,55,.06),0 0 0 16px rgba(212,175,55,.03),0 0 60px rgba(255,220,80,.65),0 0 120px rgba(212,175,55,.38);animation:mzAr-orbPulse 3.5s ease-in-out infinite;position:relative;}',
    '.mzAr-orb::before{content:"";position:absolute;inset:-10px;border-radius:50%;border:1px solid rgba(212,175,55,.18);animation:mzAr-orbPulse 3.5s ease-in-out infinite reverse;}',
    '.mzAr-orb::after{content:"";position:absolute;inset:-20px;border-radius:50%;border:1px solid rgba(212,175,55,.07);}',
    '.mzAr-pname{font-family:"Scheherazade New",serif;font-size:23px;font-weight:700;color:#d4af37;margin:10px 0 2px;text-align:center;text-shadow:0 0 20px rgba(255,215,0,.7),0 0 40px rgba(212,175,55,.35);animation:mzAr-glow 3s ease-in-out infinite;}',
    '.mzAr-psub{font-family:Cinzel,serif;font-size:8.5px;font-weight:700;color:rgba(255,215,0,.65);letter-spacing:.12em;text-align:center;}',
    '.mzAr-pmeta{font-family:Cinzel,serif;font-size:5px;letter-spacing:.22em;color:rgba(212,175,55,.28);text-align:center;margin-top:3px;}',
    /* Connecteur chaîne */
    '.mzAr-link{display:flex;flex-direction:column;align-items:center;z-index:10;position:relative;margin:0;}',
    '.mzAr-link-pipe{width:6px;background:repeating-linear-gradient(180deg,rgba(212,175,55,.9) 0px,rgba(180,140,30,.5) 8px,rgba(212,175,55,.9) 16px);background-size:100% 40px;animation:mzAr-chainAnim 1.8s linear infinite;border-radius:3px;box-shadow:0 0 8px rgba(212,175,55,.25);}',
    '.mzAr-link-badge{font-family:Cinzel,serif;font-size:5px;font-weight:700;letter-spacing:.14em;color:rgba(212,175,55,.42);padding:2px 10px;border:1px solid rgba(212,175,55,.12);border-radius:10px;background:rgba(8,5,0,.94);z-index:10;display:block;text-align:center;white-space:nowrap;margin:5px 0;}',
    /* ROW standard */
    '.mzAr-row{display:flex;align-items:center;justify-content:center;width:100%;max-width:390px;margin:0 auto;z-index:10;position:relative;gap:0;}',
    /* ROW deux piliers — côte à côte */
    '.mzAr-row-pillars{display:flex;align-items:flex-start;justify-content:center;width:100%;max-width:390px;margin:0 auto;z-index:10;position:relative;gap:14px;}',
    /* Colonnes latérales */
    '.mzAr-col{flex:0 0 auto;display:flex;flex-direction:column;gap:7px;width:102px;}',
    '.mzAr-col-c{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;}',
    /* CARD CENTRALE — Octogone doré */
    '.mzAr-crd{display:flex;flex-direction:column;align-items:center;cursor:pointer;width:130px;padding:13px 10px 12px;background:linear-gradient(145deg,rgba(22,16,4,.97),rgba(12,8,0,.99));border:1.5px solid rgba(212,175,55,.48);border-radius:4px 4px 14px 14px;clip-path:polygon(8% 0%,92% 0%,100% 9%,100% 91%,92% 100%,8% 100%,0% 91%,0% 9%);text-align:center;animation:mzAr-nodeIn .6s ease both;box-shadow:0 6px 28px rgba(0,0,0,.8),0 0 0 1px rgba(212,175,55,.09),inset 0 1px 0 rgba(212,175,55,.12);transition:all .28s cubic-bezier(.4,0,.2,1);position:relative;}',
    '.mzAr-crd::before{content:"";position:absolute;inset:0;background:linear-gradient(160deg,rgba(255,255,255,.06) 0%,transparent 55%);pointer-events:none;clip-path:inherit;}',
    '.mzAr-crd:hover{transform:scale(1.06) translateY(-3px);z-index:20;box-shadow:0 10px 40px rgba(0,0,0,.9),0 0 25px rgba(212,175,55,.2);}',
    '.mzAr-crd:active{transform:scale(.97);}',
    /* CARD PILIER — plus grande */
    '.mzAr-pillar{display:flex;flex-direction:column;align-items:center;cursor:pointer;width:148px;padding:18px 12px 16px;background:linear-gradient(145deg,rgba(22,16,4,.98),rgba(10,6,0,1));border:2px solid rgba(212,175,55,.65);border-radius:4px 4px 18px 18px;clip-path:polygon(7% 0%,93% 0%,100% 8%,100% 92%,93% 100%,7% 100%,0% 92%,0% 8%);text-align:center;animation:mzAr-pillarIn .7s ease both;box-shadow:0 8px 36px rgba(0,0,0,.85),0 0 0 1px rgba(212,175,55,.14),0 0 30px rgba(212,175,55,.08),inset 0 1px 0 rgba(212,175,55,.18);transition:all .3s cubic-bezier(.4,0,.2,1);position:relative;}',
    '.mzAr-pillar::before{content:"";position:absolute;inset:0;background:linear-gradient(160deg,rgba(255,255,255,.08) 0%,transparent 55%);pointer-events:none;clip-path:inherit;}',
    '.mzAr-pillar:hover{transform:scale(1.05) translateY(-4px);z-index:20;box-shadow:0 12px 48px rgba(0,0,0,.95),0 0 35px rgba(212,175,55,.25);}',
    '.mzAr-pillar:active{transform:scale(.97);}',
    /* CARD MINI */
    '.mzAr-mini{display:flex;flex-direction:column;align-items:center;cursor:pointer;width:100%;padding:9px 7px 8px;background:rgba(14,10,2,.97);border:1px solid rgba(212,175,55,.22);border-radius:3px 3px 10px 10px;clip-path:polygon(7% 0%,93% 0%,100% 9%,100% 91%,93% 100%,7% 100%,0% 91%,0% 9%);text-align:center;animation:mzAr-nodeIn .55s ease both;transition:all .25s;box-shadow:0 3px 16px rgba(0,0,0,.7);}',
    '.mzAr-mini:hover{transform:scale(1.06) translateY(-2px);z-index:20;}',
    '.mzAr-mini:active{transform:scale(.96);}',
    /* Textes nœuds */
    '.mzAr-name{font-family:Cinzel,serif;font-size:7.5px;font-weight:900;letter-spacing:.06em;line-height:1.3;margin-bottom:2px;white-space:pre-line;}',
    '.mzAr-name-pillar{font-family:Cinzel,serif;font-size:8.5px;font-weight:900;letter-spacing:.06em;line-height:1.3;margin-bottom:3px;white-space:pre-line;}',
    '.mzAr-name-mini{font-size:6.5px;font-weight:700;letter-spacing:.05em;}',
    '.mzAr-dates{font-family:"Cormorant Garamond",serif;font-size:9px;font-style:italic;color:rgba(212,175,55,.5);margin-bottom:2px;}',
    '.mzAr-dates-pillar{font-family:"Cormorant Garamond",serif;font-size:10px;font-style:italic;color:rgba(212,175,55,.55);margin-bottom:3px;}',
    '.mzAr-role{font-family:"Cormorant Garamond",serif;font-size:8px;font-style:italic;color:rgba(200,180,130,.5);line-height:1.4;margin-bottom:4px;white-space:pre-line;}',
    '.mzAr-role-pillar{font-family:"Cormorant Garamond",serif;font-size:9px;font-style:italic;color:rgba(200,180,130,.55);line-height:1.4;margin-bottom:5px;white-space:pre-line;}',
    /* BADGES VERDICT */
    '.mzAr-badge{font-family:Cinzel,serif;font-size:7px;font-weight:900;padding:3px 12px;border-radius:4px;display:inline-block;letter-spacing:.15em;margin-top:5px;}',
    '.mzAr-badge-pillar{font-family:Cinzel,serif;font-size:7.5px;font-weight:900;padding:4px 16px;border-radius:4px;display:inline-block;letter-spacing:.15em;margin-top:6px;}',
    '.mzAr-badge-mini{font-size:6px;padding:2px 8px;margin-top:4px;}',
    '.mzAr-v-thiqah{background:#22c55e;color:#000;}',
    '.mzAr-v-adil{background:#22c55e;color:#000;}',
    '.mzAr-v-mudallis{background:#ef4444;color:#fff;}',
    '.mzAr-v-munkar{background:#dc2626;color:#fff;}',
    '.mzAr-v-sadouq{background:#f59e0b;color:#000;}',
    '.mzAr-v-layyin{background:#f97316;color:#fff;}',
    '.mzAr-v-default{background:rgba(212,175,55,.15);color:#d4af37;border:1px solid rgba(212,175,55,.35);}',
    /* Séparateur entre rangs */
    '.mzAr-sep-link{width:2px;height:20px;background:rgba(212,175,55,.35);margin:0 auto;}',
    /* SVG Branches */
    '.mzAr-branch{flex-shrink:0;overflow:visible;z-index:5;position:relative;}',
    /* Couche label */
    '.mzAr-layer-lbl{font-family:Cinzel,serif;font-size:5.5px;font-weight:700;letter-spacing:.15em;white-space:nowrap;padding:3px 10px;border-radius:5px;}',
    /* Racines */
    '.mzAr-roots{width:100%;max-width:340px;height:48px;z-index:10;position:relative;margin-top:10px;}',
    /* Pied */
    '.mzAr-foot{font-family:Cinzel,serif;font-size:5px;letter-spacing:.22em;color:rgba(212,175,55,.14);text-align:center;margin-top:16px;padding-top:12px;border-top:1px solid rgba(212,175,55,.05);width:100%;z-index:10;position:relative;}',
    /* Séparateur de rang */
    '.mzAr-rank-sep{display:flex;align-items:center;gap:8px;width:100%;max-width:390px;margin:12px auto 8px;z-index:10;position:relative;}',
    '.mzAr-rank-line{flex:1;height:1px;background:linear-gradient(to right,transparent,rgba(212,175,55,.15),transparent);}',
    '.mzAr-rank-label{font-family:Cinzel,serif;font-size:5px;letter-spacing:.25em;color:rgba(212,175,55,.22);white-space:nowrap;}',
  ].join('');
  document.head.appendChild(sc);
}

/* ══════════════════════════════════════════════════════════════════
   4. FALLBACK
   ══════════════════════════════════════════════════════════════════ */
function _mzIsnadFallback(msg) {
  var d = document.createElement('div');
  d.id = 'mz-isnad-container';
  d.style.cssText = 'min-height:40px;padding:14px 18px;text-align:center;';
  var p1 = document.createElement('p');
  p1.style.cssText = 'font-family:Cinzel,serif;font-size:6.5px;letter-spacing:.25em;color:rgba(201,168,76,.35);margin-bottom:8px;';
  p1.textContent = 'ZONE 2 \u2014 SILSILAT AL-ISN\u0100D';
  var p2 = document.createElement('p');
  p2.style.cssText = 'font-family:"Cormorant Garamond",serif;font-style:italic;font-size:13px;color:rgba(201,168,76,.35);line-height:1.7;';
  p2.textContent = msg || 'Cha\u00eene de transmission en cours d\u2019analyse\u2026';
  d.appendChild(p1); d.appendChild(p2);
  return d.outerHTML;
}

/* ══════════════════════════════════════════════════════════════════
   5. DONNÉES CANONIQUES — 8 RANGS — 14 SIÈCLES
   Science exacte — Voie des Salaf as-Salih
   ══════════════════════════════════════════════════════════════════ */
var _LIGNEE_CANONIQUE = [

  /* ════ RANG 1 — LES DEUX PILIERS FONDATEURS ════
     Disposition : PILIER GAUCHE | PILIER DROIT (côte à côte)
     Aucune colonne latérale à ce rang — juste les deux Imams */
  {
    type: 'piliers',
    cta_bas: 'ont transmis aux',
    rang_label: 'Ir SI\u00c8CLE \u2014 LES DEUX PILIERS',
    gauche: {
      n: 'MUHAMMAD IBN ISMAIL\nAL-BUKHARI',
      d: 'm. 256H \u2014 Bukhara',
      r: 'Imam, Mouhaddith, Fakih\nSahih Al-Bukhari',
      v: 'THIQAH',
      nc: '#fde68a',
      bc: 'rgba(253,230,138,.09)',
      bd: 'rgba(253,230,138,.65)',
      note: 'Am\u012br al-Mu\u2019min\u012bn fil Hadith'
    },
    droite: {
      n: 'AHMAD IBN\nHANBAL',
      d: 'm. 241H \u2014 Bagdad',
      r: 'Imam, Mouhaddith, Fakih\nImam Ahl as-Sunnah',
      v: 'THIQAH',
      nc: '#fde68a',
      bc: 'rgba(253,230,138,.09)',
      bd: 'rgba(253,230,138,.65)',
      note: 'Imam al-\u2018Alam \u2014 Mihna de 28 mois'
    }
  },

  /* ════ RANG 2 — LES FONDATEURS DES MADHHAB ════ */
  {
    type: 'standard',
    cta_bas: 'ont transmis aux',
    rang_label: 'IIe SI\u00c8CLE \u2014 FONDATEURS',
    lft: [
      { n:'IMAM\nMUSLIM', d:'m. 261H', r:'Mouhaddith\nSahih Muslim', v:'THIQAH', nc:'#86efac' }
    ],
    ctr: {
      n: 'IMAM MALIK\nIBN ANAS',
      d: 'm. 179H \u2014 M\u00e9dine',
      r: 'Imam D\u0101r al-Hijrah\nAl-Muwatta\u02bc',
      v: 'THIQAH',
      nc: '#d4af37',
      bc: 'rgba(212,175,55,.08)',
      bd: 'rgba(212,175,55,.52)'
    },
    ctr2: {
      n: 'IMAM\nASH-SHAFI\u02bcI',
      d: 'm. 204H \u2014 Bagdad',
      r: 'Moujaddid, Fakih\nUsul al-Fiqh',
      v: 'THIQAH',
      nc: '#d4af37',
      bc: 'rgba(212,175,55,.08)',
      bd: 'rgba(212,175,55,.52)'
    },
    rgt: [
      { n:'ABU DAWUD\nAS-SIJISTANI', d:'m. 275H', r:'Mouhaddith\nAs-Sunan', v:'THIQAH', nc:'#86efac' }
    ]
  },

  /* ════ RANG 3 — LES HAFIDH CLASSIQUES ════ */
  {
    type: 'standard',
    cta_bas: 'ont transmis aux',
    rang_label: 'Ve\u2014VIIe SI\u00c8CLE \u2014 HAFIDH',
    lft: [
      { n:'AT-TIRMIDHI', d:'m. 279H', r:'Mouhaddith\nAl-Jami\u02bc as-Sahih', v:'THIQAH', nc:'#86efac' },
      { n:'AN-NASAI', d:'m. 303H', r:'Mouhaddith\nAs-Sunan', v:'THIQAH', nc:'#86efac' }
    ],
    ctr: {
      n: 'AL-NAWAWI',
      d: 'm. 676H \u2014 Naplouse',
      r: 'Imam, Hafidh\nMouhaddith, Fakih',
      v: 'ADIL',
      nc: '#d4af37',
      bc: 'rgba(212,175,55,.08)',
      bd: 'rgba(212,175,55,.48)'
    },
    ctr2: {
      n: 'IBN HAJAR\nAL-ASQALANI',
      d: 'm. 852H \u2014 Le Caire',
      r: 'Hafidh, Mouhaddith\nFath al-Bari',
      v: 'THIQAH',
      nc: '#d4af37',
      bc: 'rgba(212,175,55,.08)',
      bd: 'rgba(212,175,55,.48)'
    },
    rgt: [
      { n:'IBN MAJAH', d:'m. 273H', r:'Mouhaddith\nAs-Sunan', v:'THIQAH', nc:'#86efac' },
      { n:'AD-DARAQUTNI', d:'m. 385H', r:'Mouhaddith\nAs-Sunan', v:'THIQAH', nc:'#86efac' }
    ]
  },

  /* ════ RANG 4 — LES REVIVIFICATEURS DU MANHAJ ════ */
  {
    type: 'standard',
    cta_bas: 'ont transmis aux',
    rang_label: 'VIIe\u2014VIIIe SI\u00c8CLE \u2014 MANHAJ',
    lft: [
      { n:'IBN AS-SALAH', d:'m. 643H', r:'Mouhaddith\nMuqaddimah', v:'THIQAH', nc:'#86efac' },
      { n:'AL-BAYHAQI', d:'m. 458H', r:'Mouhaddith\nAs-Sunan al-Kubra', v:'THIQAH', nc:'#86efac' }
    ],
    ctr: {
      n: 'IBN TAYMIYYAH',
      d: 'm. 728H \u2014 Damas',
      r: 'Shaykh al-Islam\nMoujaddid, Fakih',
      v: 'THIQAH',
      nc: '#d4af37',
      bc: 'rgba(212,175,55,.08)',
      bd: 'rgba(212,175,55,.48)'
    },
    ctr2: {
      n: 'IBN AL-QAYYIM',
      d: 'm. 751H \u2014 Damas',
      r: 'Fakih, Mouhaddith\nI\u2019l\u0101m al-Muwaqqii\u012bn',
      v: 'THIQAH',
      nc: '#d4af37',
      bc: 'rgba(212,175,55,.08)',
      bd: 'rgba(212,175,55,.48)'
    },
    rgt: [
      { n:'ADH-DHAHABI', d:'m. 748H', r:'Hafidh, Critique\nMizan al-Itidal', v:'THIQAH', nc:'#86efac' },
      { n:'IBN KATHIR', d:'m. 774H', r:'Hafidh, Moufassir\nAl-Bidayah', v:'THIQAH', nc:'#86efac' }
    ]
  },

  /* ════ RANG 5 — LES SAVANTS DE LA TRANSITION ════ */
  {
    type: 'standard',
    cta_bas: 'ont transmis aux',
    rang_label: 'XIe\u2014XIIe SI\u00c8CLE \u2014 TRANSITION',
    lft: [
      { n:'IBN RAJAB\nAL-HANBALI', d:'m. 795H', r:'Hafidh, Fakih\nJami al-Ulum', v:'THIQAH', nc:'#86efac' }
    ],
    ctr: {
      n: 'MUHAMMAD IBN\nABDEL-WAHHAB',
      d: 'm. 1206H \u2014 N\u0101jd',
      r: 'Moujaddid\nKit\u0101b at-Tawh\u012bd',
      v: 'THIQAH',
      nc: '#d4af37',
      bc: 'rgba(212,175,55,.08)',
      bd: 'rgba(212,175,55,.48)'
    },
    ctr2: {
      n: 'AS-SAN\u02bcANI',
      d: 'm. 1182H \u2014 Y\u00e9men',
      r: 'Mouhaddith, Fakih\nSubul as-Sal\u0101m',
      v: 'THIQAH',
      nc: '#d4af37',
      bc: 'rgba(212,175,55,.08)',
      bd: 'rgba(212,175,55,.48)'
    },
    rgt: [
      { n:'ASH-SHAWKANI', d:'m. 1250H', r:'Moujaddid\nNayl al-Awtar', v:'THIQAH', nc:'#86efac' }
    ]
  },

  /* ════ RANG 6 — LA TRIADE CONTEMPORAINE ════ */
  {
    type: 'triade',
    cta_bas: 'ont transmis aux',
    rang_label: 'XVe SI\u00c8CLE \u2014 LA TRIADE',
    lft: [
      { n:'AHMAD\nAN-NAJMI', d:'m. 1429H', r:'Mouhaddith\nAd\u012bl', v:'THIQAH', nc:'#86efac' }
    ],
    ctr_gauche: {
      n: 'CHEIKH\nBIN BAZ',
      d: 'm. 1420H \u2014 Riyad',
      r: 'Mufti, Imam\nMoujaddid du si\u00e8cle',
      v: 'THIQAH',
      nc: '#fde68a',
      bc: 'rgba(253,230,138,.08)',
      bd: 'rgba(253,230,138,.52)'
    },
    ctr_centre: {
      n: 'CHEIKH\nAL-ALBANI',
      d: 'm. 1420H \u2014 Damas',
      r: 'Mouhaddith al-Asr\nAs-Silsilah',
      v: 'THIQAH',
      nc: '#fde68a',
      bc: 'rgba(253,230,138,.08)',
      bd: 'rgba(253,230,138,.52)'
    },
    ctr_droite: {
      n: 'CHEIKH IBN\n\u02bcUTHAYMIN',
      d: 'm. 1421H \u2014 Unayzah',
      r: 'Fakih, Moufassir\nSharh al-Mumti\u02bc',
      v: 'THIQAH',
      nc: '#fde68a',
      bc: 'rgba(253,230,138,.08)',
      bd: 'rgba(253,230,138,.52)'
    },
    rgt: [
      { n:'MUQBIL IBN HADI\nAL-WADI\u02bcI', d:'m. 1422H', r:'Mouhaddith\nY\u00e9men', v:'THIQAH', nc:'#86efac' }
    ]
  },

  /* ════ RANG 7 — LES GARDIENS DU JARH WA TA'DIL ════ */
  {
    type: 'standard',
    cta_bas: 'ont transmis aux',
    rang_label: 'XVe SI\u00c8CLE \u2014 JARH WA TA\u02bcDIL',
    lft: [
      { n:'AHMAD AN-NAJMI', d:'m. 1429H', r:'Fakih\nAd\u012bl', v:'THIQAH', nc:'#86efac' }
    ],
    ctr: {
      n: 'RAB\u012b\u02bc IBN H\u0100DI\nAL-MADKHALI',
      d: 'n. 1351H \u2014 Djazane',
      r: 'Mouhaddith, Ad\u012bl\nH\u0101mil Liwa\u2019 al-Jarh',
      v: 'THIQAH',
      nc: '#86efac',
      bc: 'rgba(34,197,94,.09)',
      bd: 'rgba(34,197,94,.48)'
    },
    ctr2: {
      n: 'SALEH IBN\nFAWZAN',
      d: 'n. 1354H \u2014 Al-Qassim',
      r: 'Fakih, Mufti\nKib\u0101r al-Ulama',
      v: 'THIQAH',
      nc: '#86efac',
      bc: 'rgba(34,197,94,.09)',
      bd: 'rgba(34,197,94,.48)'
    },
    rgt: [
      { n:'UBAID\nAL-JABIRI', d:'n. 1357H', r:'Fakih\nAd\u012bl', v:'THIQAH', nc:'#86efac' }
    ]
  },

  /* ════ RANG 8 — LES RACINES — LES PILIERS CONTEMPORAINS ════ */
  {
    type: 'piliers',
    cta_bas: '',
    rang_label: 'XVe SI\u00c8CLE \u2014 RACINES CONTEMPORAINES',
    gauche: {
      n: 'ZAYD IBN\nHADI AL-MADKHALI',
      d: 'm. 1435H \u2014 N\u0101jran',
      r: 'Fakih, Mouhaddith\nAd\u012bl',
      v: 'THIQAH',
      nc: '#86efac',
      bc: 'rgba(34,197,94,.08)',
      bd: 'rgba(34,197,94,.48)',
      note: '\u00c9l\u00e8ve de Cheikh Ibn Baz'
    },
    droite: {
      n: 'UBAID IBN\nABDALLAH AL-JABIRI',
      d: 'n. 1357H \u2014 M\u00e9dine',
      r: 'Fakih, Mouhaddith\nAd\u012bl',
      v: 'THIQAH',
      nc: '#86efac',
      bc: 'rgba(34,197,94,.08)',
      bd: 'rgba(34,197,94,.48)',
      note: 'Parmi les Kibar al-Ulama actuels'
    }
  }
];

/* ══════════════════════════════════════════════════════════════════
   6. _mzIsnadFromPipe v21.0 — ARBRE ROYAL PIXEL-PERFECT
   ══════════════════════════════════════════════════════════════════ */
function _mzIsnadFromPipe(isnadChain, grade) {

  /* GARDE — accepte chain vide, on utilise les données canoniques */
  if (typeof isnadChain !== 'string') {
    try { isnadChain = String(isnadChain || ''); } catch(_) { isnadChain = ''; }
  }

  if (!window._mzArbre_v21_loaded) {
    console.log('%c \u2705 M\u00eezan v21.0 : Arbre Royal — 8 rangs, 14 si\u00e8cles', 'color:#d4af37;font-weight:bold;background:#0a0600;padding:3px 8px;');
    window._mzArbre_v21_loaded = true;
  }

  _mzInjectArbreCSS();

  /* ── Parse dynamique si données backend présentes ── */
  var dynNodes = [];
  if (isnadChain && isnadChain.length > 10) {
    var rawP = isnadChain.replace(/\\n/g, '\n').replace(/\s*[\u2014\u2013]\s*/g, ' | ');
    var linesP = rawP.indexOf('\n') !== -1 ? rawP.split('\n') : rawP.split(/(?=Maillon\s+\d)/i);
    linesP = linesP.map(function(l) { return typeof l === 'string' ? l.trim() : ''; }).filter(function(l) { return l.length > 2; });
    var seenK = {};
    for (var pi = 0; pi < linesP.length; pi++) {
      try {
        var pts = linesP[pi].split('|');
        var nm  = (pts[1] || '').trim();
        if (!nm || nm.length < 2) continue;
        var ky  = nm.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, '');
        if (seenK[ky]) continue;
        seenK[ky] = true;
        var vis = nodeVis((pts[2] || ''), (pts[3] || ''), pi, linesP.length);
        dynNodes.push({ nom: nm, nc: vis.nameC, bd: vis.dotC + '55', bc: vis.dotC + '11', v: (pts[3] || '').trim(), r: (pts[2] || '').trim(), d: (pts[4] || '').trim() });
      } catch(_) {}
    }
    /* Injecter les nœuds dynamiques dans la lignée canonique */
    if (dynNodes.length >= 2) {
      for (var di = 0; di < Math.min(dynNodes.length, _LIGNEE_CANONIQUE.length); di++) {
        var dn = dynNodes[di];
        var rg = _LIGNEE_CANONIQUE[di];
        if (rg.type === 'piliers' && rg.gauche) {
          rg.gauche.n  = dn.nom; rg.gauche.nc = dn.nc;
          rg.gauche.bd = dn.bd;  rg.gauche.bc = dn.bc;
          rg.gauche.v  = dn.v || rg.gauche.v;
        } else if (rg.ctr) {
          rg.ctr.n  = dn.nom; rg.ctr.nc = dn.nc;
          rg.ctr.bd = dn.bd;  rg.ctr.bc = dn.bc;
          rg.ctr.v  = dn.v || rg.ctr.v;
        }
      }
    }
  }

  /* ── Helpers d'échappement ── */
  function _esc(s) {
    return (s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, ' ');
  }

  /* ── Badge CSS class selon verdict ── */
  function _bc(v, suffix) {
    var vl = (v || '').toLowerCase();
    var sfx = suffix || '';
    if (/thiqah|imam|hujjah/i.test(vl))    return 'mzAr-badge' + sfx + ' mzAr-v-thiqah';
    if (/adil|sadouq|maqbul/i.test(vl))    return 'mzAr-badge' + sfx + ' mzAr-v-adil';
    if (/mudallis|matruk|modal/i.test(vl)) return 'mzAr-badge' + sfx + ' mzAr-v-mudallis';
    if (/munkar|kadhdhab/i.test(vl))       return 'mzAr-badge' + sfx + ' mzAr-v-munkar';
    if (/layyin|da.if/i.test(vl))          return 'mzAr-badge' + sfx + ' mzAr-v-layyin';
    if (/sadouq/i.test(vl))               return 'mzAr-badge' + sfx + ' mzAr-v-sadouq';
    return 'mzAr-badge' + sfx + ' mzAr-v-default';
  }

  /* ── Render : PILIER (grande carte) ── */
  function _renderPilier(d, delay, idx) {
    var dlStr = delay.toFixed(2) + 's';
    var bdCol = d.bd || 'rgba(212,175,55,.65)';
    var bgCol = d.bc || 'rgba(22,16,4,.98)';
    var h = '<div class="mzAr-col-c">';
    h += '<div class="mzAr-pillar" style="animation-delay:' + dlStr + ';border-color:' + bdCol + ';background:linear-gradient(145deg,' + bgCol + ',rgba(8,5,0,1));" onclick="window.mzOpenIsnadPanel(\'' + _esc(d.n) + '\',\'' + _esc(d.r || '') + '\',\'' + _esc(d.v || '') + '\',\'' + _esc(d.d || '') + '\',\'' + (d.nc || '#d4af37') + '\')">';
    h += '<p class="mzAr-name-pillar" style="color:' + (d.nc || '#e8d490') + ';">' + d.n.replace(/\n/g, '<br>') + '</p>';
    if (d.d)    h += '<p class="mzAr-dates-pillar">(' + d.d + ')</p>';
    if (d.r)    h += '<p class="mzAr-role-pillar">' + d.r.replace(/\n/g, '<br>') + '</p>';
    h += '<span class="' + _bc(d.v, '-pillar') + '">' + (d.v || '\u2014') + '</span>';
    if (d.note) h += '<p style="font-family:Cinzel,serif;font-size:5.5px;letter-spacing:.1em;color:rgba(212,175,55,.3);margin-top:6px;">' + d.note + '</p>';
    h += '</div></div>';
    return h;
  }

  /* ── Render : CARTE CENTRALE ── */
  function _renderCtr(d, delay) {
    var dlStr = delay.toFixed(2) + 's';
    var bdCol = d.bd || 'rgba(212,175,55,.48)';
    var bgCol = d.bc ? 'linear-gradient(145deg,' + d.bc + ',rgba(12,8,0,.99))' : 'linear-gradient(145deg,rgba(22,16,4,.97),rgba(12,8,0,.99))';
    var h = '<div class="mzAr-col-c">';
    h += '<div class="mzAr-crd" style="animation-delay:' + dlStr + ';border-color:' + bdCol + ';background:' + bgCol + ';" onclick="window.mzOpenIsnadPanel(\'' + _esc(d.n) + '\',\'' + _esc(d.r || '') + '\',\'' + _esc(d.v || '') + '\',\'' + _esc(d.d || '') + '\',\'' + (d.nc || '#d4af37') + '\')">';
    h += '<p class="mzAr-name" style="color:' + (d.nc || '#e8d490') + ';">' + d.n.replace(/\n/g, '<br>') + '</p>';
    if (d.d) h += '<p class="mzAr-dates">(' + d.d + ')</p>';
    if (d.r) h += '<p class="mzAr-role">' + d.r.replace(/\n/g, '<br>') + '</p>';
    h += '<span class="' + _bc(d.v) + '">' + (d.v || '\u2014') + '</span>';
    h += '</div></div>';
    return h;
  }

  /* ── Render : MINI CARD ── */
  function _renderMini(d, delay) {
    var col = d.nc || '#d4af37';
    var h = '<div class="mzAr-mini" style="animation-delay:' + delay.toFixed(2) + 's;border-color:' + col + '33;" onclick="window.mzOpenIsnadPanel(\'' + _esc(d.n) + '\',\'' + _esc(d.r || '') + '\',\'' + _esc(d.v || '') + '\',\'' + _esc(d.d || '') + '\',\'' + col + '\')">';
    h += '<p class="mzAr-name mzAr-name-mini" style="color:' + col + ';">' + d.n.replace(/\n/g, '<br>') + '</p>';
    if (d.d) h += '<p class="mzAr-dates" style="font-size:7.5px;">(' + d.d + ')</p>';
    if (d.r) h += '<p class="mzAr-role" style="font-size:7px;">' + d.r.replace(/\n/g, '<br>') + '</p>';
    h += '<span class="' + _bc(d.v) + ' mzAr-badge-mini">' + (d.v || '\u2014') + '</span>';
    h += '</div>';
    return h;
  }

  /* ── SVG Branche Bézier GAUCHE ── */
  function _svgBL() {
    var uid = 'bl' + Math.floor(Math.random() * 99999);
    return '<svg class="mzAr-branch" width="30" height="60" viewBox="0 0 30 60" style="flex-shrink:0;">'
      + '<defs><linearGradient id="' + uid + '" x1="1" y1="0" x2="0" y2="0"><stop offset="0%" stop-color="rgba(212,175,55,.6)"/><stop offset="100%" stop-color="rgba(212,175,55,.06)"/></linearGradient></defs>'
      + '<path d="M30,30 C22,30 12,22 3,12" stroke="url(#' + uid + ')" stroke-width="2.2" fill="none" stroke-linecap="round"/>'
      + '<path d="M30,30 C22,30 12,38 3,48" stroke="url(#' + uid + ')" stroke-width="1.1" fill="none" stroke-linecap="round" opacity=".35"/>'
      + '</svg>';
  }

  /* ── SVG Branche Bézier DROITE ── */
  function _svgBR() {
    var uid = 'br' + Math.floor(Math.random() * 99999);
    return '<svg class="mzAr-branch" width="30" height="60" viewBox="0 0 30 60" style="flex-shrink:0;">'
      + '<defs><linearGradient id="' + uid + '" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="rgba(212,175,55,.6)"/><stop offset="100%" stop-color="rgba(212,175,55,.06)"/></linearGradient></defs>'
      + '<path d="M0,30 C8,30 18,22 27,12" stroke="url(#' + uid + ')" stroke-width="2.2" fill="none" stroke-linecap="round"/>'
      + '<path d="M0,30 C8,30 18,38 27,48" stroke="url(#' + uid + ')" stroke-width="1.1" fill="none" stroke-linecap="round" opacity=".35"/>'
      + '</svg>';
  }

  /* ── SVG TRONC TRESSÉ EN CHAÎNES ── */
  function _svgTronc(totalRangs) {
    var totalH = 160 + totalRangs * 160 + 80;
    var s = '<svg class="mzAr-trunk" height="' + totalH + '" viewBox="0 0 72 ' + totalH + '" style="top:0;height:' + totalH + 'px;">';

    /* Defs — dégradés + filtre lueur */
    s += '<defs>';
    s += '<linearGradient id="mzTrk21a" x1="0" y1="0" x2="0" y2="1">'
      + '<stop offset="0%" stop-color="rgba(255,220,80,.82)"/>'
      + '<stop offset="35%" stop-color="rgba(200,160,40,.5)"/>'
      + '<stop offset="70%" stop-color="rgba(180,140,30,.4)"/>'
      + '<stop offset="100%" stop-color="rgba(212,175,55,.72)"/>'
      + '</linearGradient>';
    s += '<filter id="mzTrkGlw21"><feGaussianBlur stdDeviation="2.8" result="b"/>'
      + '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
    s += '</defs>';

    var y0 = 145, y1 = totalH - 20;
    var segLen = (y1 - y0) / 6;

    /* Brin central — ondulation sinueuse */
    var centralPath = 'M36,' + y0;
    for (var cs = 0; cs < 6; cs++) {
      var cy = y0 + cs * segLen;
      var cx1 = cs % 2 === 0 ? 22 : 50;
      var cx2 = cs % 2 === 0 ? 50 : 22;
      centralPath += ' C' + cx1 + ',' + (cy + segLen * 0.35) + ' ' + cx2 + ',' + (cy + segLen * 0.65) + ' 36,' + (cy + segLen);
    }
    s += '<path d="' + centralPath + '" stroke="url(#mzTrk21a)" stroke-width="8" fill="none" stroke-linecap="round" filter="url(#mzTrkGlw21)" opacity=".88"/>';

    /* Brin gauche tressé */
    var leftPath = 'M28,' + y0;
    for (var ls = 0; ls < 6; ls++) {
      var ly = y0 + ls * segLen;
      var lx1 = ls % 2 === 0 ? 12 : 36;
      var lx2 = ls % 2 === 0 ? 32 : 16;
      var lend = ls % 2 === 0 ? 20 : 34;
      leftPath += ' C' + lx1 + ',' + (ly + segLen * 0.33) + ' ' + lx2 + ',' + (ly + segLen * 0.66) + ' ' + lend + ',' + (ly + segLen);
    }
    s += '<path d="' + leftPath + '" stroke="rgba(190,150,35,.52)" stroke-width="4" fill="none" stroke-linecap="round" opacity=".72"/>';

    /* Brin droit tressé */
    var rightPath = 'M44,' + y0;
    for (var rs = 0; rs < 6; rs++) {
      var ry = y0 + rs * segLen;
      var rx1 = rs % 2 === 0 ? 60 : 36;
      var rx2 = rs % 2 === 0 ? 40 : 56;
      var rend = rs % 2 === 0 ? 52 : 38;
      rightPath += ' C' + rx1 + ',' + (ry + segLen * 0.33) + ' ' + rx2 + ',' + (ry + segLen * 0.66) + ' ' + rend + ',' + (ry + segLen);
    }
    s += '<path d="' + rightPath + '" stroke="rgba(160,120,20,.46)" stroke-width="3.5" fill="none" stroke-linecap="round" opacity=".66"/>';

    /* Maillons de chaîne — ovales dorés */
    var chainY = y0 + 38;
    while (chainY < y1 - 15) {
      s += '<ellipse cx="36" cy="' + chainY + '" rx="6" ry="3.2" stroke="rgba(212,175,55,.55)" stroke-width="1.4" fill="none"/>';
      chainY += 28;
    }

    s += '</svg>';
    return s;
  }

  /* ── SVG RACINES ORGANIQUES ── */
  function _svgRacines() {
    return '<svg class="mzAr-roots" viewBox="0 0 340 52" preserveAspectRatio="xMidYMid meet">'
      + '<path d="M170 2 C148 14,112 30,72 48" stroke="rgba(212,175,55,.24)" stroke-width="3" fill="none" stroke-linecap="round"/>'
      + '<path d="M170 2 C156 16,143 32,136 52" stroke="rgba(212,175,55,.2)" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
      + '<path d="M170 2 C170 16,170 32,170 52" stroke="rgba(212,175,55,.34)" stroke-width="3.5" fill="none" stroke-linecap="round"/>'
      + '<path d="M170 2 C184 16,197 32,204 52" stroke="rgba(212,175,55,.2)" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
      + '<path d="M170 2 C192 14,228 30,268 48" stroke="rgba(212,175,55,.24)" stroke-width="3" fill="none" stroke-linecap="round"/>'
      + '<path d="M170 2 C136 18,92 36,56 52" stroke="rgba(212,175,55,.14)" stroke-width="1.8" fill="none" stroke-linecap="round"/>'
      + '<path d="M170 2 C204 18,248 36,284 52" stroke="rgba(212,175,55,.14)" stroke-width="1.8" fill="none" stroke-linecap="round"/>'
      + '</svg>';
  }

  /* ════════════════════════════════════════════
     ASSEMBLAGE HTML FINAL
  ════════════════════════════════════════════ */
  try {
    var h = '';
    var delay = 0;

    h += '<div id="mz-isnad-container" class="mzAr">';

    /* Tronc tressé en fond */
    h += _svgTronc(_LIGNEE_CANONIQUE.length);

    /* Titre doré */
    h += '<p class="mzAr-title">SILSILAT AL-ISN\u0100D \u2014 CHA\u00ceNE DOR\u00c9E ININTERROMPUE DE 14 SI\u00c8CLES</p>';

    /* ═══ ORBE PROPHÉTIQUE ﷺ — Sceau de Bagdad ═══ */
    h += '<div class="mzAr-prophet">';
    /* SVG Sceau octogonal */
    h += '<svg width="100" height="100" viewBox="0 0 100 100" style="filter:drop-shadow(0 0 22px rgba(255,215,0,.55));margin-bottom:5px;">';
    h += '<defs>';
    h += '<radialGradient id="sealGr21" cx="50%" cy="40%" r="55%"><stop offset="0%" stop-color="rgba(255,240,150,.45)"/><stop offset="60%" stop-color="rgba(212,175,55,.18)"/><stop offset="100%" stop-color="transparent"/></radialGradient>';
    h += '<linearGradient id="sealSt21" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ffd700"/><stop offset="50%" stop-color="#d4af37"/><stop offset="100%" stop-color="#b8860b"/></linearGradient>';
    h += '</defs>';
    h += '<circle cx="50" cy="50" r="44" fill="url(#sealGr21)" stroke="url(#sealSt21)" stroke-width="2.8"/>';
    h += '<circle cx="50" cy="50" r="38" fill="none" stroke="rgba(212,175,55,.32)" stroke-width=".9"/>';
    h += '<polygon points="50,14 58,38 83,38 63,53 70,77 50,62 30,77 37,53 17,38 42,38" fill="none" stroke="rgba(255,215,0,.48)" stroke-width="1.3" stroke-linejoin="round"/>';
    h += '<text x="50" y="56" text-anchor="middle" dominant-baseline="central" font-family="Scheherazade New,serif" font-size="30" fill="#d4af37">\uFDFA</text>';
    h += '</svg>';
    h += '<p class="mzAr-pname">\u0627\u0644\u0646\u0628\u064a \u0645\u062d\u0645\u062f \uFDFA</p>';
    h += '<p class="mzAr-psub">LE PROPH\u00c8TE MOHAMED \uFDFA</p>';
    h += '<p class="mzAr-pmeta">SOURCE DE LA R\u00c9V\u00c9LATION \u2014 MISSION INFAILLIBLE</p>';
    h += '</div>';

    /* ═══ RENDU DES 8 RANGS ═══ */
    _LIGNEE_CANONIQUE.forEach(function(rang, ri) {
      delay += 0.1;

      /* Séparateur de rang */
      h += '<div class="mzAr-rank-sep"><div class="mzAr-rank-line"></div><span class="mzAr-rank-label">' + rang.rang_label + '</span><div class="mzAr-rank-line"></div></div>';

      /* Connecteur descendant depuis dessus */
      h += '<div class="mzAr-link"><div class="mzAr-link-pipe" style="height:18px;"></div>'
        + '<span class="mzAr-link-badge">'
        + (ri === 0 ? 'a transmis \u00e0' : (_LIGNEE_CANONIQUE[ri - 1].cta_bas || 'ont transmis aux'))
        + '</span><div class="mzAr-link-pipe" style="height:10px;"></div></div>';

      /* ─── TYPE PILIERS : deux grandes cartes côte à côte ─── */
      if (rang.type === 'piliers') {
        h += '<div class="mzAr-row-pillars">';
        h += _renderPilier(rang.gauche, delay, 0);
        /* Ligne verticale de séparation SVG */
        h += '<svg width="20" height="80" viewBox="0 0 20 80" style="flex-shrink:0;align-self:center;">'
          + '<line x1="10" y1="0" x2="10" y2="80" stroke="rgba(212,175,55,.28)" stroke-width="1.5" stroke-dasharray="5,4"/>'
          + '</svg>';
        h += _renderPilier(rang.droite, delay + 0.08, 1);
        h += '</div>';
      }

      /* ─── TYPE TRIADE : trois cartes centrales ─── */
      else if (rang.type === 'triade') {
        h += '<div class="mzAr-row" style="gap:8px;">';
        /* Colonne mini gauche */
        h += '<div class="mzAr-col">';
        (rang.lft || []).forEach(function(d, li) {
          h += _renderMini(d, delay + li * 0.06);
        });
        h += '</div>';
        h += _svgBL();
        /* Trois cartes centrales */
        h += '<div style="display:flex;flex-direction:column;align-items:center;gap:6px;z-index:10;">';
        h += _renderCtr(rang.ctr_gauche, delay + 0.04);
        h += _renderCtr(rang.ctr_centre, delay + 0.08);
        h += _renderCtr(rang.ctr_droite, delay + 0.12);
        h += '</div>';
        h += _svgBR();
        /* Colonne mini droite */
        h += '<div class="mzAr-col">';
        (rang.rgt || []).forEach(function(d, ri2) {
          h += _renderMini(d, delay + ri2 * 0.06 + 0.05);
        });
        h += '</div>';
        h += '</div>';
      }

      /* ─── TYPE STANDARD : mini | branche | ctr(+ctr2) | branche | mini ─── */
      else {
        h += '<div class="mzAr-row">';
        /* Colonne mini gauche */
        h += '<div class="mzAr-col">';
        (rang.lft || []).forEach(function(d, li) {
          h += _renderMini(d, delay + li * 0.06);
        });
        h += '</div>';
        h += _svgBL();
        /* Cartes centrales (une ou deux) */
        if (rang.ctr && rang.ctr2) {
          h += '<div style="display:flex;flex-direction:column;align-items:center;gap:7px;z-index:10;">';
          h += _renderCtr(rang.ctr, delay + 0.04);
          h += _renderCtr(rang.ctr2, delay + 0.09);
          h += '</div>';
        } else if (rang.ctr) {
          h += _renderCtr(rang.ctr, delay + 0.06);
        } else {
          h += '<div style="width:130px;"></div>';
        }
        h += _svgBR();
        /* Colonne mini droite */
        h += '<div class="mzAr-col">';
        (rang.rgt || []).forEach(function(d, ri2) {
          h += _renderMini(d, delay + ri2 * 0.06 + 0.05);
        });
        h += '</div>';
        h += '</div>';
      }

      delay += 0.09;
    });

    /* ═══ RACINES ORGANIQUES ═══ */
    h += _svgRacines();

    /* ═══ PIED DE PAGE ═══ */
    h += '<p class="mzAr-foot">SILSILAT AL-ISN\u0100D \u2014 CHA\u00ceNE DOR\u00c9E ININTERROMPUE DE 14 SI\u00c8CLES \u2014 \u00c9DIFICE ROYAL DE LA TRANSMISSION</p>';
    h += '<p style="font-family:Cinzel,serif;font-size:5px;letter-spacing:.22em;color:rgba(212,175,55,.1);text-align:center;margin-top:6px;z-index:10;position:relative;">14 SI\u00c8CLES DE PR\u00c9SERVATION \u2014 D\u00c9FENSE DE LA SUNNAH</p>';

    h += '</div>'; /* /mzAr */

    return h;

  } catch (err) {
    console.error('%c \ud83d\udd34 v21.0 _mzIsnadFromPipe CRASH', 'color:#ff0000;font-weight:bold;', err);
    return _mzIsnadFallback('\u26a0 Erreur de rendu : ' + err.message);
  }
}

/* ══════════════════════════════════════════════════════════════════
   7. mzAfficherArbreCanonique — FALLBACK AUTONOME
   Appelée depuis engine.js quand Dorar.net renvoie zéro résultat.
   Injecte l'arbre complet dans result-box SANS dépendance externe.
   ══════════════════════════════════════════════════════════════════ */
window.mzAfficherArbreCanonique = function(query) {
  console.log('%c \u2705 M\u00eezan v21.0 : mzAfficherArbreCanonique — FALLBACK ACTIVÉ', 'color:#d4af37;font-weight:bold;background:#0a0600;padding:4px 10px;');

  _mzInjectArbreCSS();

  var box = document.getElementById('result-box');
  if (!box) { console.error('[Mîzân] result-box introuvable'); return; }

  /* ── Bannière "Non indexé dans Dorar" ── */
  var bannerHtml = '<div style="padding:18px 20px 14px;text-align:center;background:rgba(10,6,0,.95);border-bottom:1px solid rgba(212,175,55,.12);">'
    + '<p style="font-family:Cinzel,serif;font-size:8px;font-weight:700;letter-spacing:.28em;color:rgba(212,175,55,.55);margin-bottom:6px;">NON INDEX\u00c9 DANS DORAR.NET</p>'
    + '<p style="font-family:\"Cormorant Garamond\",serif;font-size:13px;font-style:italic;color:rgba(220,200,140,.45);line-height:1.7;max-width:320px;margin:0 auto 12px;">'
    + 'Ce texte ne figure pas dans la base de Dorar.net. L\u2019Arbre Royal de la Transmission s\u2019affiche ci-dessous : la cha\u00eene doc\u00ecd de 14 si\u00e8cles de Science Islamique.</p>'
    + '<div style="display:inline-flex;gap:8px;flex-wrap:wrap;justify-content:center;">'
    + '<a href="https://dorar.net" target="_blank" style="display:inline-flex;align-items:center;gap:5px;padding:7px 14px;background:rgba(212,175,55,.06);border:1px solid rgba(212,175,55,.22);border-radius:8px;text-decoration:none;font-family:Cinzel,serif;font-size:6px;letter-spacing:.1em;color:#c9a84c;">🔍 DORAR.NET</a>'
    + '<a href="https://www.alalbany.net/" target="_blank" style="display:inline-flex;align-items:center;gap:5px;padding:7px 14px;background:rgba(212,175,55,.06);border:1px solid rgba(212,175,55,.22);border-radius:8px;text-decoration:none;font-family:Cinzel,serif;font-size:6px;letter-spacing:.1em;color:#c9a84c;">📚 AL-ALBANI</a>'
    + '<a href="https://binbaz.org.sa/" target="_blank" style="display:inline-flex;align-items:center;gap:5px;padding:7px 14px;background:rgba(212,175,55,.06);border:1px solid rgba(212,175,55,.22);border-radius:8px;text-decoration:none;font-family:Cinzel,serif;font-size:6px;letter-spacing:.1em;color:#c9a84c;">🛡️ IBN BAZ</a>'
    + '</div>'
    + '</div>';

  /* ── Générer l'arbre SVG complet via _mzIsnadFromPipe ── */
  var arbreHtml = _mzIsnadFromPipe('', 'INCONNU');

  /* ── Wrapper principal ── */
  var wrapperHtml = '<div class="mz-card" style="padding:0;overflow:hidden;animation:argCardIn .5s ease both;">'
    + bannerHtml
    + '<div style="border-top:1px solid rgba(212,175,55,.14);background:linear-gradient(180deg,rgba(10,6,0,.98),rgba(8,4,0,1));">'
    + arbreHtml
    + '</div>'
    + '<div style="padding:14px 18px;background:rgba(8,4,0,.98);border-top:1px solid rgba(212,175,55,.06);">'
    + '<p style="font-family:Cinzel,serif;font-size:5.5px;letter-spacing:.2em;color:rgba(212,175,55,.18);text-align:center;">'
    + 'SILSILAT AL-ISN\u0100D \u2014 CHA\u00ceNE DOR\u00c9E ININTERROMPUE \u2014 14 SI\u00c8CLES DE PR\u00c9SERVATION</p>'
    + '</div>'
    + '</div>';

  box.innerHTML = wrapperHtml;
  box.classList.add('active');

  /* Fermer la barre de chargement */
  var lb = document.getElementById('loading-box');
  if (lb) { lb.classList.remove('active'); lb.style.cssText = ''; }
  var fill = document.getElementById('progress-fill');
  var dia  = document.getElementById('progress-diamond');
  if (fill) fill.style.width = '100%';
  if (dia)  dia.style.left  = 'calc(100% - 4px)';
  document.querySelectorAll('#steps-list .step-item').forEach(function(el) {
    el.classList.remove('current'); el.classList.add('done');
  });
};

/* ══════════════════════════════════════════════════════════════════
   8. EXPOSITION GLOBALE — Triple Bouclier : Scope
   ══════════════════════════════════════════════════════════════════ */
window._mzIsnadFromPipe   = _mzIsnadFromPipe;
window._mzIsnadFallback   = _mzIsnadFallback;
window._mzInjectArbreCSS  = _mzInjectArbreCSS;
window.parseSiecle        = parseSiecle;
window.nodeVis            = nodeVis;

/* Compatibilité avec l'ancienne signature _mzProphetSeal */
window._mzProphetSeal = function() {
  return '<div style="display:flex;flex-direction:column;align-items:center;margin-bottom:8px;z-index:10;position:relative;">'
    + '<p style="font-family:Cinzel,serif;font-size:5.5px;letter-spacing:.35em;color:rgba(212,175,55,.28);margin-bottom:6px;">ZONE 2 \u2014 SILSILAT AL-ISN\u0100D</p>'
    + '</div>';
};

/* ══════════════════════════════════════════════════════════════════
   MOUCHARD DE VÉRITÉ — Démarrage réussi
   Triple Bouclier : Syntaxe ✓ · Portée ✓ · Science ✓
   window.mzAfficherArbreCanonique ✓ — Fallback autonome actif
   ══════════════════════════════════════════════════════════════════ */
console.log('%c \u2705 M\u00eezan v21.0 : Pr\u00eat pour Production', 'color: #00ff00; font-weight: bold;');
console.log('%c \ud83d\udcda 8 Rangs \u00b7 14 Si\u00e8cles \u00b7 Tous les Savants Int\u00e9gr\u00e9s', 'color:#86efac;font-weight:bold;');
console.log('%c \u2705 window.mzAfficherArbreCanonique — Fallback Autonome Pr\u00eat', 'color:#d4af37;font-weight:bold;');
console.log('%c \u2696\ufe0f Rang 1: Al-Bukhari + Ahmad ibn Hanbal (Piliers)', 'color:#fde68a;');
console.log('%c \u2696\ufe0f Rang 2: Imam Malik + Imam Ash-Shafi\u02bci', 'color:#d4af37;');
console.log('%c \u2696\ufe0f Rang 3: Al-Nawawi + Ibn Hajar Al-Asqalani', 'color:#d4af37;');
console.log('%c \u2696\ufe0f Rang 4: Ibn Taymiyyah + Ibn al-Qayyim', 'color:#d4af37;');
console.log('%c \u2696\ufe0f Rang 5: Muhammad ibn Abdel-Wahhab + As-San\u02bcani', 'color:#d4af37;');
console.log('%c \u2696\ufe0f Rang 6: La Triade — Bin Baz + Al-Albani + Ibn \u02bcUthaymin', 'color:#fde68a;');
console.log('%c \u2696\ufe0f Rang 7: Rabi\u02bc Al-Madkhali + Al-Fawzan', 'color:#86efac;');
console.log('%c \u2696\ufe0f Rang 8: Zayd Al-Madkhali + Ubaid Al-Jabiri', 'color:#86efac;');
