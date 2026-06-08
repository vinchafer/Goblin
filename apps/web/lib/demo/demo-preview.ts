// Static preview HTML for the demo Preview view. Passed to PreviewTab as a
// `data:text/html` URL (DEMO_PREVIEW_URL) so the real preview chrome renders it
// inline — no remote deploy needed. The portfolio page matches the demo project.

export const DEMO_PREVIEW_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Portfolio</title>
<style>
  :root { --ink:#0f2b1e; --bone:#f7f4ec; --gold:#c9a227; }
  * { box-sizing: border-box; margin: 0; }
  body { font-family: -apple-system, system-ui, sans-serif; color: var(--ink); background: var(--bone); }
  nav { display:flex; align-items:center; justify-content:space-between; padding:18px 32px; border-bottom:1px solid rgba(15,43,30,.08); }
  nav .brand { font-weight:700; letter-spacing:-0.01em; }
  nav .links a { margin-left:22px; text-decoration:none; color:var(--ink); font-size:14px; opacity:.8; }
  header { padding:96px 32px; max-width:880px; margin:0 auto; text-align:center; }
  header h1 { font-size:clamp(32px,6vw,60px); line-height:1.05; letter-spacing:-0.03em; }
  header p { margin-top:20px; font-size:18px; opacity:.7; line-height:1.6; }
  .cta { display:inline-block; margin-top:32px; background:var(--ink); color:#fff; padding:13px 26px; border-radius:10px; text-decoration:none; font-weight:600; font-size:15px; }
  .grid { max-width:880px; margin:32px auto 96px; padding:0 32px; display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:18px; }
  .card { background:#fff; border:1px solid rgba(15,43,30,.08); border-radius:14px; padding:24px; }
  .card h3 { font-size:17px; margin-bottom:8px; }
  .card p { font-size:14px; opacity:.7; line-height:1.55; }
</style>
</head>
<body>
  <nav>
    <span class="brand">Alex Rivera</span>
    <span class="links"><a href="#">Work</a><a href="#">About</a><a href="#">Contact</a></span>
  </nav>
  <header>
    <h1>Designer &amp; front-end engineer building calm, fast interfaces.</h1>
    <p>I help early-stage teams ship product surfaces that feel inevitable — from first sketch to shipped pixels.</p>
    <a class="cta" href="#">See selected work →</a>
  </header>
  <section class="grid">
    <div class="card"><h3>Ledger</h3><p>A personal-finance dashboard with a focus on legibility.</p></div>
    <div class="card"><h3>Atlas</h3><p>Maps tooling for a logistics startup, end to end.</p></div>
    <div class="card"><h3>Verse</h3><p>A writing app that gets out of the way.</p></div>
  </section>
</body>
</html>`;

export const DEMO_PREVIEW_URL = `data:text/html;charset=utf-8,${encodeURIComponent(DEMO_PREVIEW_HTML)}`;

// Pretty URL shown in the preview toolbar's URL bar instead of the long data: URI.
export const DEMO_PREVIEW_DISPLAY_URL = "portfolio.vercel.app";
