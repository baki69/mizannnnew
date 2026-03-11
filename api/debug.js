module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  try {
    const r = await fetch(
      "https://www.dorar.net/hadith/search?q=" + encodeURIComponent("الصبر"),
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "text/html,application/xhtml+xml",
          Referer: "https://www.dorar.net/",
        },
        signal: AbortSignal.timeout(10000),
      }
    );
    const html = await r.text();
    res.status(200).json({ status: r.status, length: html.length, html: html.substring(0, 500) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
