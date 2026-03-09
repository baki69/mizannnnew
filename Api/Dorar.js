// /api/dorar.js — Vercel Serverless Function
// Proxy vers Dorar.net API
// Déploiement : pousser ce fichier sur GitHub + connecter à Vercel

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const q = (req.query.q || '').trim();
  if (!q) {
    return res.status(400).json({ error: 'Paramètre q manquant' });
  }

  const dorarUrl = 'https://dorar.net/dorar_api.json.php?skey=' + encodeURIComponent(q);

  try {
    const response = await fetch(dorarUrl, {
      headers: {
        'Accept':            'application/json, text/javascript, */*; q=0.01',
        'Accept-Language':   'ar,fr;q=0.9,en;q=0.8',
        'X-Requested-With':  'XMLHttpRequest',
        'Origin':            'https://dorar.net',
        'Referer':           'https://dorar.net/',
        'User-Agent':        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const text = await response.text();

    // Vérifier que c'est du JSON et pas du HTML
    if (text.trim().startsWith('<')) {
      return res.status(502).json({ error: 'Dorar a renvoyé du HTML — IP bloquée' });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: 'Réponse Dorar invalide' });
    }

    return res.status(200).json(data);

  } catch (err) {
    return res.status(502).json({ error: 'Dorar inaccessible : ' + err.message });
  }
        }
