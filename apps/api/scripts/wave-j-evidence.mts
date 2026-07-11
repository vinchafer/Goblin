/**
 * WAVE-J evidence: renders the Hilfe section (index + a full article), the
 * Feedback modal, and the Goblin Hilfe chat into ONE static HTML page using the
 * REAL design tokens + the REAL help corpus (@goblin/shared). A static harness is
 * used because a full Next build needs NEXT_PUBLIC_SUPABASE_* which isn't present
 * in this sandbox (same constraint noted in WAVE-I). The markup mirrors the actual
 * components' token usage so the render reflects real light/dark + 375px layout.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { HELP_ARTICLES, helpArticleBySlug } from '../../../packages/shared/src/help-content.ts';

const __dir = dirname(fileURLToPath(import.meta.url));
const tokens = readFileSync(join(__dir, '../../web/styles/design-tokens.css'), 'utf-8');

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const article = helpArticleBySlug('live-stellen')!;

const indexCards = HELP_ARTICLES.map((a) => `
  <a class="card" href="#">
    <span class="ico">${a.icon}</span>
    <span class="grow"><span class="t">${esc(a.title.de)}</span><span class="s">${esc(a.summary.de)}</span></span>
    <span class="chev">›</span>
  </a>`).join('');

const articleSections = article.sections.map((s) => `
  <section id="${s.anchor}">
    <h2>${esc(s.heading.de)}</h2>
    <p>${esc(s.body.de)}</p>
  </section>`).join('');

const html = `<!doctype html><html data-theme="light"><head><meta charset="utf-8">
<style>${tokens}</style>
<style>
  body { margin:0; background:var(--surface-page); font-family:var(--font-sans, system-ui); }
  .wrap { max-width:375px; margin:0 auto; padding:20px 16px 40px; }
  h1 { color:var(--text); font-size:28px; font-weight:700; margin:8px 0; letter-spacing:-.5px; }
  .lead { color:var(--meta); font-size:14px; margin:0 0 20px; }
  .card { display:flex; align-items:center; gap:12px; padding:13px 14px; min-height:56px; background:var(--panel,#fff); border:1px solid var(--border); border-radius:12px; text-decoration:none; margin-bottom:8px; }
  .card .ico { font-size:20px; } .card .grow { flex:1; } .card .t { display:block; font-size:15px; font-weight:600; color:var(--text); } .card .s { display:block; font-size:12px; color:var(--meta); margin-top:2px; } .card .chev { color:var(--meta); font-size:18px; }
  .divider { height:1px; background:var(--border); margin:28px 0; }
  section { margin-bottom:22px; } section h2 { font-size:17px; font-weight:600; color:var(--text); margin:0 0 6px; } section p { font-size:14px; line-height:1.7; color:var(--text-2,var(--meta)); margin:0; }
  .modal { background:var(--panel,#fff); border:1px solid var(--border); border-radius:16px; padding:16px; margin-top:8px; box-shadow:var(--shadow-2, 0 8px 30px rgba(0,0,0,.12)); }
  .chips { display:flex; gap:8px; margin-bottom:12px; } .chip { flex:1; min-height:44px; border-radius:10px; border:1px solid var(--border); background:var(--panel,#fff); color:var(--text); font-weight:600; font-size:14px; display:flex; align-items:center; justify-content:center; } .chip.active { background:var(--brand-green); color:#fff; border-color:var(--brand-green); }
  textarea { width:100%; box-sizing:border-box; padding:10px 12px; border:1.5px solid var(--border); border-radius:10px; font-size:14px; background:var(--panel,#fff); color:var(--text); min-height:70px; }
  .consent { font-size:11.5px; color:var(--meta); margin:10px 0 14px; }
  .btn { display:block; width:100%; text-align:center; min-height:44px; line-height:44px; border-radius:10px; background:var(--brand-green); color:#fff; font-weight:600; font-size:14px; text-decoration:none; }
  .chat { border:1px solid var(--border); border-radius:14px; overflow:hidden; margin-top:8px; }
  .chat .hdr { background:var(--brand-green); color:#fff; padding:12px 14px; font-weight:600; font-size:13px; }
  .chat .body { padding:12px; display:flex; flex-direction:column; gap:10px; background:var(--surface-page); }
  .bub { max-width:85%; padding:8px 12px; font-size:12.5px; line-height:1.6; }
  .bub.u { align-self:flex-end; background:var(--brand-green); color:#fff; border-radius:12px 12px 3px 12px; }
  .bub.a { align-self:flex-start; background:var(--panel,#fff); border:1px solid var(--border); color:var(--text); border-radius:12px 12px 12px 3px; }
  .lbl { font-size:11px; color:var(--meta); text-transform:uppercase; letter-spacing:.05em; margin:26px 0 8px; font-weight:700; }
</style></head>
<body><div class="wrap">
  <h1>Hilfe</h1>
  <p class="lead">Verständliche Anleitungen — und ein Hilfe-Agent, der sofort antwortet.</p>
  ${indexCards}

  <div class="divider"></div>
  <div class="lbl">Artikel · ${esc(article.title.de)}</div>
  <h1 style="font-size:24px">${article.icon} ${esc(article.title.de)}</h1>
  <p class="lead">${esc(article.summary.de)}</p>
  ${articleSections}

  <div class="divider"></div>
  <div class="lbl">Feedback</div>
  <div class="modal">
    <div class="chips"><div class="chip">Fehler</div><div class="chip active">Idee</div><div class="chip">Sonstiges</div></div>
    <textarea>Ein Dark-Mode-Umschalter direkt im Editor wäre super.</textarea>
    <p class="consent">Wir senden mit: aktuelle Seite, Projekt-ID, letzte Fehlermeldung — keine Chat-Inhalte.</p>
    <a class="btn" href="#">Feedback senden</a>
  </div>

  <div class="lbl">Goblin Hilfe</div>
  <div class="chat">
    <div class="hdr">Goblin Hilfe · Beta</div>
    <div class="body">
      <div class="bub u">Wie stelle ich meine Seite live?</div>
      <div class="bub a">Du verbindest zuerst dein Vercel-Konto mit einem selbst erstellten Token, fügst ihn unter Einstellungen → Konnektoren → Vercel ein, sicherst die Entwürfe und klickst „Live stellen“. Goblin prüft, ob die Seite und alle verlinkten Dateien erreichbar sind — erst dann steht „Live ✓“.<br><br>Siehe: Live stellen &amp; Vercel verbinden</div>
    </div>
  </div>
</div></body></html>`;

const outHtml = join(__dir, '../../../evidence/wave-j-support/hilfe-render.html');
writeFileSync(outHtml, html);
console.log('wrote', outHtml);
