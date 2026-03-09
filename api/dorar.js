export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  const q = req.query.q;
  if (!q) { res.status(400).json({ error: 'Missing q' }); return; }
  try {
    const r = await fetch(
      `https://dorar.net/hadith/search?q=${encodeURIComponent(q)}&ajax=1`,
      { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://dorar.net/' } }
    );
    const data = await r.json();
    res.status(200).json(data);
  } catch(e) { res.status(500).json({ error: e.message }); }
}
