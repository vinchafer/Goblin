#!/usr/bin/env python3
"""Generator for built_XX.html snapshots. Inlines shared CSS into every file."""
import os, pathlib

ROOT = pathlib.Path(__file__).parent
OUT = ROOT / "built"
OUT.mkdir(exist_ok=True)

SHARED_CSS = (OUT / "_shared.css").read_text(encoding="utf-8")

def page(num, title, body, extra_css=""):
    html = f"""<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>Built — Screen {num} · {title}</title>
<style>
{SHARED_CSS}
{extra_css}
</style>
</head>
<body>
<div class="exp-page">
  <h1 class="exp-title">Built screen {num} — {title}</h1>
  <p class="exp-sub">Faithful snapshot of the live React/Next.js render · 2 viewports</p>
  <div class="viewports">
    <section class="viewport viewport-desktop">
      <div class="vp-label">Desktop · 1280 × 860</div>
      <div class="vp-frame"><div class="gobl-dash">{body}</div></div>
    </section>
    <section class="viewport viewport-mobile">
      <div class="vp-label">Mobil · 390 × 844 — Hamburger + BottomTabBar</div>
      <div class="vp-frame"><div class="gobl-dash">{body}</div></div>
    </section>
  </div>
</div>
</body>
</html>
"""
    (OUT / f"built_{num}.html").write_text(html, encoding="utf-8")
    print(f"wrote built_{num}.html")

# ─── icons ────────────────────────────────────────────────────────────────
SVG_CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
SVG_CODE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>'
SVG_PREVIEW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'
SVG_HAM = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>'
SVG_PLUS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'

def header(project_name=None, active_tab="chat", has_project=False, has_preview=False):
    crumb = f'<div class="shell-breadcrumb"><span class="slash">/</span><div class="crumb">{project_name}</div></div>' if project_name else ''
    def pill(tid, label, icon, dot=False):
        disabled = (tid == 'code' and not has_project) or (tid == 'preview' and not has_preview)
        klass = 'tab-pill'
        if active_tab == tid: klass += ' active'
        if disabled: klass += ' disabled'
        dot_html = '<span style="position:absolute;top:2px;right:2px;width:6px;height:6px;border-radius:50%;background:var(--ochre);"></span>' if dot else ''
        return f'<button class="{klass}">{icon}<span class="label">{label}</span>{dot_html}</button>'
    pills = pill('chat','Chat',SVG_CHAT) + pill('code','Code',SVG_CODE) + pill('preview','Preview',SVG_PREVIEW)
    return f'''
<header class="shell-header">
  <button class="hamburger" aria-label="Menu">{SVG_HAM}</button>
  <div class="shell-logo">Goblin<span class="dot">.</span></div>
  {crumb}
  <div class="shell-spacer"></div>
  <div class="tab-pills" role="tablist">{pills}</div>
  <button class="shell-plus" aria-label="Plus">{SVG_PLUS}</button>
  <div class="shell-localcloud">
    <span>Routing</span>
    <span class="lc-pill">Cloud</span>
  </div>
  <div class="shell-avatar">VH</div>
</header>
'''

def sidebar(active_project_id=None):
    projects = [
        ("p1", "Newsletter-Tool",     "#D4A737", "vor 2 std"),
        ("p2", "Booking Page",        "#6db97b", "vor 1 tag"),
        ("p3", "Internal Dashboard",  "#3A6B8A", "vor 3 tagen"),
        ("p4", "Stripe Sandbox",      "#7A4A8A", "vor 5 tagen"),
    ]
    rows = ""
    for pid, name, color, ago in projects:
        klass = 'sb-row' + (' active' if pid == active_project_id else '')
        rows += f'<div class="{klass}"><span class="sb-dot" style="background:{color}"></span>{name}<span class="sb-meta">{ago}</span></div>'
    chats = [
        ("Magic-Link-Login für Next.js", "vor 12 min"),
        ("Stripe webhook signing", "vor 4 std"),
        ("Tailwind dark-mode toggle", "gestern"),
    ]
    chat_rows = ""
    for title, ago in chats:
        chat_rows += f'<div class="sb-row"><span style="font-size:13px;opacity:.78">💬</span>{title}<span class="sb-meta">{ago}</span></div>'
    return f'''
<aside class="sidebar">
  <button class="sb-newbtn">+ Neues Projekt</button>
  <div class="sb-head">Projekte · 4</div>
  {rows}
  <div class="sb-divider"></div>
  <div class="sb-head">Letzte Chats</div>
  {chat_rows}
  <div class="sb-divider"></div>
  <div class="sb-head">Hilfe</div>
  <div class="sb-row"><span style="opacity:.6">⚙</span>Einstellungen</div>
  <div class="sb-row"><span style="opacity:.6">?</span>Tastenkürzel</div>
  <div class="sb-usage">
    <div style="display:flex;justify-content:space-between;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.10em;text-transform:uppercase;color:var(--meta)"><span>Build · Verbrauch</span><span>142/200</span></div>
    <div class="bar"><span style="width:71%"></span></div>
    <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--meta);letter-spacing:.06em">RESET IN 8 TAGEN</div>
  </div>
</aside>
'''

def bottom_bar(active="chat", has_project=False, has_preview=False):
    def b(tid, label, icon):
        klass = ''
        if active == tid: klass = 'active'
        elif (tid == 'code' and not has_project) or (tid == 'preview' and not has_preview):
            klass = 'disabled'
        return f'<button class="{klass}">{icon}<span>{label}</span></button>'
    return f'<nav class="bottom-bar">{b("chat","Chat",SVG_CHAT)}{b("code","Code",SVG_CODE)}{b("preview","Preview",SVG_PREVIEW)}</nav>'

def shell(content, project_name=None, active_tab="chat", active_project_id=None,
          has_project=False, has_preview=False):
    return f'''
<div class="shell">
  {header(project_name, active_tab, has_project, has_preview)}
  <div class="shell-body">
    {sidebar(active_project_id)}
    <main class="main">{content}</main>
  </div>
  {bottom_bar(active_tab, has_project, has_preview)}
</div>
'''

# ─── Screen 03 — Dashboard Home ──────────────────────────────────────────
UPDATES = [
    ('NEU', 'gold',  'Claude Sonnet 4.6 verfügbar', 'Goblin nutzt dein eigenes Anthropic-Konto automatisch.', 'MAI 22'),
    ('NEU', 'gold',  'BYOK-Streaming stabilisiert', 'Anthropic, OpenAI und Groq streamen wieder ohne Abbrüche.', 'MAI 20'),
    ('UPDATE', 'plain', 'Send to Code auf dem Handy', 'Code aus dem Chat in den Editor schieben — funktioniert auch unterwegs.', 'APR 14'),
    ('SICHERHEIT', 'warn', 'CORS und Stream-Abbrüche gehärtet', 'Stabilität und Abbruch-Verhalten in allen Routen verbessert.', 'APR 08'),
]
QUICK_PROMPTS = [
    'Eine Landingpage mit Anmeldeformular',
    'Eine Aufgabenliste, die meine Einträge merkt',
    'Eine Seite, auf der Leute Termine buchen können',
    'Magic-Link-Login für meine Next.js-App',
]
PROJECTS = [
    {"name": "Newsletter-Tool", "desc": "Newsletter mit Stripe-Bezahlung und Magic-Link-Login.", "color": "#D4A737", "status": "shipping", "label": "SHIPPING", "ago": "VOR 2 STD",  "slug": "NEWSLETTER"},
    {"name": "Booking Page",    "desc": "Eine Seite, auf der Kunden 30-Minuten-Slots buchen können.", "color": "#6db97b", "status": "live",    "label": "LIVE",    "ago": "VOR 1 TAG",  "slug": "BOOKING"},
    {"name": "Internal Dashboard","desc": "Admin-Übersicht über Vertragskunden und offene Tickets.", "color": "#3A6B8A", "status": "draft",   "label": "DRAFT",    "ago": "VOR 3 TAGEN","slug": "INTERNAL"},
    {"name": "Stripe Sandbox",  "desc": "Test-Bezahlflow mit Webhook-Empfänger und Idempotenz.", "color": "#7A4A8A", "status": "idle",    "label": "AKTIV",    "ago": "VOR 1 WOCHE","slug": "STRIPE"},
]

def screen_03():
    quick_chips = "".join(
        f'<button style="background:transparent;color:rgba(244,236,216,.62);border:1px solid rgba(244,236,216,.14);border-radius:999px;padding:6px 12px;font-size:12.5px;font-weight:500;cursor:pointer;font-family:Manrope,sans-serif">{q}</button>'
        for q in QUICK_PROMPTS
    )
    proj_cards = ""
    for p in PROJECTS:
        dot_color = {'shipping':'#D4A737','live':'#6db97b','draft':'#7A4A8A','idle':'#D4A737'}[p['status']]
        proj_cards += f'''
        <div class="gobl-panel" style="padding:18px;display:flex;flex-direction:column;gap:8px;min-height:132px;cursor:pointer">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <span style="display:flex;align-items:center;gap:8px;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.14em;color:var(--ink-3);text-transform:uppercase">
              <span style="width:7px;height:7px;border-radius:50%;background:{dot_color}"></span>
              {p["label"]}
            </span>
            <span style="color:var(--ink-3);font-size:14px">→</span>
          </div>
          <h3 style="font-family:Manrope,sans-serif;font-weight:600;font-size:17px;letter-spacing:-0.016em;color:var(--ink-1);line-height:1.25;margin:4px 0 0">{p["name"]}</h3>
          <p style="font-size:13.5px;color:var(--ink-2);line-height:1.45;margin:0">{p["desc"]}</p>
          <div style="margin-top:auto;font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--ink-3);letter-spacing:.06em;display:flex;justify-content:space-between;padding-top:12px;border-top:1px solid var(--line)">
            <span>{p["slug"]}</span><span>{p["ago"]}</span>
          </div>
        </div>'''
    proj_cards += '''
        <button style="background:transparent;border:1px dashed var(--line-strong);border-radius:14px;min-height:132px;display:flex;align-items:center;justify-content:center;color:var(--ink-3);font-family:Manrope,sans-serif;font-weight:600;font-size:14px;cursor:pointer;gap:8px">+ Neues Projekt</button>'''

    updates_html = ""
    for i,(tag,tone,title,desc,date) in enumerate(UPDATES):
        last = (i == len(UPDATES)-1)
        tag_cls = 'gobl-tag gold' if tone=='gold' else ('gobl-tag warn' if tone=='warn' else 'gobl-tag')
        bb = '' if last else 'border-bottom:1px solid var(--line);'
        updates_html += f'''
        <div style="padding:16px 18px;{bb}display:flex;align-items:flex-start;gap:14px">
          <span class="{tag_cls}" style="margin-top:2px;flex-shrink:0">{tag}</span>
          <div style="flex:1;min-width:0">
            <h4 style="font-family:Manrope,sans-serif;font-weight:600;font-size:14.5px;color:var(--ink-1);margin:0 0 3px;letter-spacing:-0.012em">{title}</h4>
            <p style="font-size:13.5px;color:var(--ink-2);line-height:1.5;margin:0">{desc}</p>
          </div>
          <span style="font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--ink-3);letter-spacing:.08em;flex-shrink:0;margin-top:2px">{date}</span>
        </div>'''

    content = f'''
<div style="height:100%;overflow-y:auto;background:var(--d-surface)">
  <div style="max-width:1140px;margin:0 auto;padding:40px 32px 80px">

    <section style="background:var(--d-surface-darkest);color:var(--bone);border-radius:14px;padding:28px 28px 22px;margin-bottom:36px;border:1px solid rgba(244,236,216,.12);position:relative;overflow:hidden">
      <div class="gobl-eyebrow" style="color:rgba(244,236,216,.62);margin-bottom:14px">
        <span class="tick"></span>
        <span style="color:var(--bone);font-weight:600">VINCENT</span>
        Hallo
      </div>
      <h1 style="font-family:Manrope,sans-serif;font-weight:600;font-size:40px;letter-spacing:-0.028em;line-height:1.1;color:var(--bone);margin-bottom:18px">
        Sag Goblin, was du <span class="gobl-serif">bauen willst.</span>
      </h1>
      <div style="background:rgba(244,236,216,.05);border:1px solid rgba(244,236,216,.16);border-radius:14px;padding:14px 14px 10px 18px;display:flex;flex-direction:column;gap:12px">
        <div style="color:rgba(244,236,216,.42);font-size:16px;line-height:1.5;min-height:40px;font-family:Manrope,sans-serif">Eine Landingpage mit Stripe-Bezahlung in Next.js…</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;border-top:1px solid rgba(244,236,216,.10);padding-top:10px">
          <span style="font-family:'JetBrains Mono',monospace;font-size:10.5px;letter-spacing:.10em;text-transform:uppercase;color:rgba(244,236,216,.62)">⏎ SENDEN · ⇧⏎ NEUE ZEILE</span>
          <button style="background:rgba(244,236,216,.20);color:var(--green);border-radius:999px;padding:8px 16px;border:none;font-family:Manrope,sans-serif;font-weight:600;font-size:13px;cursor:not-allowed">Senden →</button>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">{quick_chips}</div>
    </section>

    <section style="margin-bottom:48px">
      <div class="gobl-section-title" style="margin-top:0">
        <h2>Deine Projekte</h2>
        <span class="label">4 AKTIV</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px">
        {proj_cards}
      </div>
    </section>

    <section>
      <div class="gobl-section-title">
        <h2>Was ist neu</h2>
        <a>Alle Updates →</a>
      </div>
      <div class="gobl-panel" style="overflow:hidden">{updates_html}</div>
    </section>

  </div>
</div>
'''
    return shell(content, active_tab=None, has_project=False)

# ─── Screen 04 — New Project ─────────────────────────────────────────────
def screen_04():
    content = '''
<div style="height:100%;overflow-y:auto;background:var(--d-surface)">
  <div style="max-width:760px;margin:0 auto;padding:40px 32px 80px">
    <a style="display:inline-flex;align-items:center;gap:6px;font-family:'JetBrains Mono',monospace;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3);margin-bottom:28px;text-decoration:none">← Zurück zum Dashboard</a>
    <div class="gobl-eyebrow" style="margin-bottom:14px">
      <span class="tick"></span><span class="num">/NEU</span>Projekt anlegen
    </div>
    <h1 style="font-family:Manrope,sans-serif;font-weight:600;font-size:56px;letter-spacing:-0.034em;line-height:1.06;color:var(--ink-1);margin:0 0 12px">
      Nenn deine <span class="gobl-serif">Werkstatt.</span>
    </h1>
    <p style="font-size:17px;color:var(--ink-2);max-width:52ch;margin:0 0 40px;line-height:1.5">
      Den Namen wählst du. Goblin schlägt einen Tech-Stack vor — kannst du jederzeit ändern. Alles andere ist optional.
    </p>
    <form class="gobl-panel" style="padding:28px">
      <div style="margin-bottom:22px">
        <label class="gobl-field-label">Name <span style="color:var(--danger)">*</span></label>
        <input class="gobl-input" value="Newsletter-Tool">
      </div>
      <div style="margin-bottom:22px">
        <label class="gobl-field-label">Was willst du bauen?</label>
        <textarea class="gobl-textarea" rows="3">Ein Newsletter mit Stripe-Bezahlung und Magic-Link-Login.</textarea>
      </div>
      <div style="margin-bottom:22px">
        <label class="gobl-field-label">Tech-Stack</label>
        <div class="gobl-panel" style="padding:14px;background:var(--d-surface);display:flex;align-items:center;gap:14px">
          <div style="flex:1;min-width:0">
            <div style="font-family:Manrope,sans-serif;font-weight:600;font-size:14px;color:var(--ink-1);margin-bottom:2px">Empfehlung: Next.js</div>
            <div style="font-size:12.5px;color:var(--ink-3);line-height:1.45">Beste Wahl für Web-Apps mit Auth, API und schneller Vercel-Deploy.</div>
          </div>
          <button type="button" class="gobl-btn ghost sm">Ändern</button>
        </div>
      </div>
      <div style="margin-bottom:22px">
        <label class="gobl-field-label">Vorhandenen Kontext mitgeben — optional</label>
        <div style="border:1px dashed var(--line-strong);border-radius:10px;padding:14px 16px;background:var(--d-surface);font-size:12.5px;color:var(--ink-3);margin-bottom:8px">
          Ziehe eine Datei hierher (max 200 KB) oder füge unten eine vergangene Konversation ein.
        </div>
        <textarea class="gobl-textarea" rows="4" placeholder="Hier eine alte Goblin/ChatGPT/Claude-Konversation oder Notizen einfügen…" style="min-height:80px"></textarea>
      </div>
      <div style="margin-bottom:22px;display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <label class="gobl-field-label">Farbe — optional</label>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button type="button" style="width:26px;height:26px;border-radius:50%;background:#2f6a47;border:none;cursor:pointer;box-shadow:0 0 0 2px var(--ink-1),0 0 0 4px var(--d-surface)"></button>
            <button type="button" style="width:26px;height:26px;border-radius:50%;background:#D4A737;border:none;cursor:pointer"></button>
            <button type="button" style="width:26px;height:26px;border-radius:50%;background:#7A4A8A;border:none;cursor:pointer"></button>
            <button type="button" style="width:26px;height:26px;border-radius:50%;background:#3A6B8A;border:none;cursor:pointer"></button>
            <button type="button" style="width:26px;height:26px;border-radius:50%;background:#a04230;border:none;cursor:pointer"></button>
            <button type="button" style="width:26px;height:26px;border-radius:50%;background:#4A7A7A;border:none;cursor:pointer"></button>
          </div>
        </div>
        <div>
          <label class="gobl-field-label">Label — optional</label>
          <input class="gobl-input" placeholder="z. B. Kundenarbeit">
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:24px;padding-top:20px;border-top:1px solid var(--line)">
        <span style="font-family:'JetBrains Mono',monospace;font-size:10.5px;letter-spacing:.10em;text-transform:uppercase;color:var(--ink-3)">Senden ⌘ + ↵</span>
        <button type="button" class="gobl-btn primary lg">Projekt anlegen →</button>
      </div>
    </form>
  </div>
</div>
'''
    return shell(content, active_tab=None, has_project=False)

# ─── Screen 05 — Chat Empty ──────────────────────────────────────────────
def screen_05():
    suggestions = [
        ('🌐','Eine Landingpage mit Anmeldeformular'),
        ('✓', 'Eine Aufgabenliste, die meine Einträge merkt'),
        ('📅','Eine Seite, auf der Leute Termine buchen können'),
        ('🔑','Magic-Link-Login für meine Next.js-App'),
    ]
    sug_html = ""
    for ic, t in suggestions:
        sug_html += f'<button style="display:flex;align-items:center;gap:12px;text-align:left;background:var(--d-surface-elev);border:1px solid var(--line);border-radius:10px;padding:13px 14px;font-size:14px;color:var(--ink-1);font-family:Manrope,sans-serif;cursor:pointer"><span style="width:18px;display:inline-flex;align-items:center;justify-content:center;color:var(--ink-3)">{ic}</span><span style="flex:1">{t}</span><span style="color:var(--ink-3);font-size:14px">→</span></button>'
    content = f'''
<div style="display:flex;flex-direction:column;height:100%;background:var(--cream)">
  <div style="flex:1;overflow-y:auto;padding:20px 16px;display:flex;flex-direction:column;gap:16px">
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:56px 24px">
      <div style="width:56px;height:56px;margin-bottom:20px;color:var(--green);display:flex;align-items:center;justify-content:center;font-size:42px">👺</div>
      <h1 style="font-family:Manrope,sans-serif;font-weight:600;font-size:42px;letter-spacing:-0.032em;line-height:1.06;color:var(--ink-1);text-align:center;margin:0 0 10px;max-width:22ch">
        Hallo, Vincent. <span class="gobl-serif">Was bauen wir?</span>
      </h1>
      <p style="font-size:16px;color:var(--ink-2);text-align:center;max-width:50ch;margin:0 0 32px;line-height:1.5">
        Beschreib in einem Satz, was du bauen willst — Goblin schreibt den Code, zeigt dir die Dateien und veröffentlicht alles auf Klick.
      </p>
      <div style="display:flex;flex-direction:column;gap:8px;width:100%;max-width:520px">{sug_html}</div>
    </div>
  </div>
  <div style="border-top:1px solid var(--div);background:var(--cream);padding:14px 16px">
    <div style="display:flex;align-items:flex-end;gap:8px;background:#fff;border:1px solid var(--div);border-radius:14px;padding:10px 12px">
      <button style="background:none;border:none;color:var(--meta);font-size:18px;cursor:pointer">+</button>
      <div style="flex:1;color:var(--meta);font-size:14px;padding:8px 0;font-family:'DM Sans',sans-serif">Frag Goblin etwas…</div>
      <span style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.10em;color:var(--meta);text-transform:uppercase;background:rgba(15,43,30,.06);border-radius:999px;padding:4px 8px">🟠 Sonnet 4.6</span>
      <button style="background:var(--moss);color:var(--ochre);border:none;border-radius:8px;width:34px;height:34px;cursor:pointer;font-weight:700">↑</button>
    </div>
  </div>
</div>
'''
    return shell(content, active_tab='chat', has_project=False)

# ─── Screen 06 — Chat Active ─────────────────────────────────────────────
def screen_06():
    msgs = [
        ('user', 'Eine Landingpage mit Anmeldeformular, Stripe-Bezahlung und Magic-Link-Login.'),
        ('asst', 'Klar — ich skizziere dir eine Next.js-App-Router-Struktur mit zwei Routen (<code class="ic">/</code> und <code class="ic">/login</code>), Stripe Checkout über eine Server Action, und Magic-Link-Login per Supabase Auth.'),
        ('user', 'Zeig mir die Server Action für Stripe Checkout.'),
        ('asst', '''Hier die <code class="ic">app/actions/checkout.ts</code> — minimal, mit Idempotenz-Key und Redirect:'''),
    ]
    msg_html = ""
    for role, txt in msgs:
        is_user = (role == 'user')
        align = 'row-reverse' if is_user else 'row'
        avatar_bg = '#6B6B6B' if is_user else 'var(--moss)'
        avatar_fg = '#fff' if is_user else 'var(--ochre)'
        bubble_bg = 'var(--moss)' if is_user else 'var(--panel)'
        bubble_fg = '#fff' if is_user else 'var(--text)'
        radius = '12px 4px 12px 12px' if is_user else '4px 12px 12px 12px'
        border = 'none' if is_user else '1px solid var(--div)'
        letter = 'U' if is_user else 'G'
        msg_html += f'''
        <div style="display:flex;gap:10px;align-items:flex-start;flex-direction:{align}">
          <div style="width:28px;height:28px;border-radius:50%;flex-shrink:0;background:{avatar_bg};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:{avatar_fg};margin-top:2px">{letter}</div>
          <div style="flex:1;min-width:0;max-width:82%">
            <div style="background:{bubble_bg};color:{bubble_fg};border-radius:{radius};padding:10px 14px;border:{border};font-size:14px;line-height:1.6;font-family:'DM Sans',sans-serif">{txt}</div>
          </div>
        </div>'''
    # Code block under last
    code_block = '''
        <div style="display:flex;gap:10px;align-items:flex-start">
          <div style="width:28px;height:28px;border-radius:50%;flex-shrink:0;background:var(--moss);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--ochre);margin-top:2px"></div>
          <div style="flex:1;min-width:0;max-width:82%">
            <div style="margin:0;border-radius:10px;overflow:hidden;border:1px solid #2a2a2a">
              <div style="background:#1e1e1e;display:flex;align-items:center;padding:6px 12px;gap:8px">
                <span style="font-size:11px;color:#9C9589;font-family:'JetBrains Mono',monospace;flex:1">app/actions/checkout.ts</span>
                <button style="background:none;border:none;color:#9C9589;font-size:11px;cursor:pointer">Copy</button>
              </div>
              <div style="background:#111;padding:14px 16px;overflow-x:auto">
                <pre style="margin:0;font-family:'JetBrains Mono',monospace;font-size:13px;color:#e8e8e8;line-height:1.6"><code>'use server';
import { stripe } from '@/lib/stripe';
import { redirect } from 'next/navigation';

export async function checkout(formData: FormData) {
  const email = String(formData.get('email'));
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    customer_email: email,
    success_url: '/welcome?cs={CHECKOUT_SESSION_ID}',
    cancel_url: '/',
  });
  redirect(session.url!);
}</code></pre>
              </div>
            </div>
            <div style="margin-top:4px;font-size:11px;color:var(--meta);font-family:'DM Sans',sans-serif">sonnet-4-6 · byok</div>
          </div>
        </div>
'''
    content = f'''
<div style="display:flex;flex-direction:column;height:100%;background:var(--cream)">
  <div style="flex:1;overflow-y:auto;padding:20px 16px;display:flex;flex-direction:column;gap:16px">
    {msg_html}
    {code_block}
  </div>
  <div style="border-top:1px solid var(--div);background:var(--cream);padding:14px 16px;position:relative">
    <div style="position:absolute;right:24px;bottom:calc(100% + 6px)">
      <button style="width:32px;height:32px;border-radius:8px;background:var(--subtle);border:1px solid var(--div);color:var(--moss);font-family:'JetBrains Mono',monospace;font-weight:600;font-size:11px">&lt;/&gt;</button>
    </div>
    <div style="display:flex;align-items:flex-end;gap:8px;background:#fff;border:1px solid var(--div);border-radius:14px;padding:10px 12px">
      <button style="background:none;border:none;color:var(--meta);font-size:18px;cursor:pointer">+</button>
      <div style="flex:1;color:var(--text);font-size:14px;padding:8px 0;font-family:'DM Sans',sans-serif">Wie wäre es mit Resend für die Magic-Link-Mail?</div>
      <span style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.10em;color:var(--meta);text-transform:uppercase;background:rgba(15,43,30,.06);border-radius:999px;padding:4px 8px">🟠 Sonnet 4.6</span>
      <button style="background:var(--moss);color:var(--ochre);border:none;border-radius:8px;width:34px;height:34px;cursor:pointer;font-weight:700">↑</button>
    </div>
  </div>
</div>
'''
    return shell(content, active_tab='chat', has_project=False)

# ─── Screen 08 — Project Detail ──────────────────────────────────────────
def screen_08():
    deploys = [
        ('Add Stripe webhook idempotency', 'sonnet-4-6', 'ok',       'vor 2 std',   '24s'),
        ('Magic-link login route',         'sonnet-4-6', 'ok',       'vor 6 std',   '19s'),
        ('Fix env var leak in build',      'sonnet-4-6', 'failed',   'vor 1 tag',   '12s'),
        ('Initial deploy',                 'sonnet-4-6', 'ok',       'vor 3 tagen', '38s'),
    ]
    deploy_html = ""
    for i,(msg,model,st,ago,dur) in enumerate(deploys):
        last = (i == len(deploys)-1)
        dot = 'var(--danger)' if st == 'failed' else '#6db97b'
        bb = '' if last else 'border-bottom:1px solid var(--line);'
        deploy_html += f'''
        <div style="display:flex;align-items:center;gap:14px;padding:12px 18px;{bb}">
          <span style="width:8px;height:8px;border-radius:50%;background:{dot};flex-shrink:0"></span>
          <div style="flex:1;min-width:0">
            <div style="font-family:Manrope,sans-serif;font-weight:600;font-size:13.5px;color:var(--ink-1);margin-bottom:2px">{msg}</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--ink-3);letter-spacing:.04em;text-transform:uppercase">{model} · {st.upper()}</div>
          </div>
          <span style="font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--ink-3);letter-spacing:.04em;text-transform:uppercase">{ago} · {dur}</span>
        </div>'''
    messages = [
        ('user', 'Mach den Stripe-Webhook idempotent — wir kriegen Duplikate.'),
        ('asst', 'Klar — füge ich einen `event.id`-Check gegen die `webhook_events`-Tabelle hinzu. [Code-Block]'),
        ('user', 'Sieht gut aus. Deploy.'),
        ('asst', 'Läuft — build passed in 24s. Live unter newsletter-tool.vercel.app.'),
    ]
    msg_html = ""
    for i,(role,txt) in enumerate(messages):
        last = (i == len(messages)-1)
        bb = '' if last else 'border-bottom:1px solid var(--line);'
        bg = 'var(--ink-1)' if role=='user' else 'var(--green)'
        fg = 'var(--bone)' if role=='user' else 'var(--gold)'
        who = 'Du' if role=='user' else 'Goblin'
        letter = 'D' if role=='user' else 'G'
        msg_html += f'''
        <div style="display:flex;gap:12px;padding:12px 18px;{bb}">
          <div style="width:24px;height:24px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:{bg};color:{fg};font-family:Manrope,sans-serif;font-weight:700;font-size:10px">{letter}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;color:var(--ink-1);line-height:1.45"><b>{who}:</b> {txt}</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--ink-3);margin-top:3px;letter-spacing:.04em">vor {i*2+1} std</div>
          </div>
        </div>'''
    content = f'''
<div style="height:100%;overflow-y:auto;background:var(--d-surface)">
  <div style="max-width:1140px;margin:0 auto">
    <header style="padding:36px 32px 24px;border-bottom:1px solid var(--line)">
      <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:24px;flex-wrap:wrap">
        <div style="flex:1;min-width:280px">
          <div class="gobl-eyebrow" style="margin-bottom:12px">
            <span class="tick"></span>
            <span class="num">PROJEKT · NEWSLETTER-TOOL</span>
            SHIPPING
          </div>
          <h1 style="font-family:Manrope,sans-serif;font-weight:600;font-size:52px;letter-spacing:-0.032em;line-height:1.06;color:var(--ink-1);margin:0 0 10px">Newsletter-Tool</h1>
          <p style="font-size:15.5px;color:var(--ink-2);max-width:60ch;line-height:1.5;margin:0">Ein Newsletter mit Stripe-Bezahlung und Magic-Link-Login.</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <a class="gobl-btn primary lg">Chat öffnen →</a>
          <a class="gobl-btn secondary lg">Code öffnen</a>
          <a class="gobl-btn ghost lg">Secrets</a>
        </div>
      </div>
    </header>
    <div style="padding:28px 32px 80px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:24px;padding:12px 16px;background:var(--d-surface-elev);border:1px solid var(--line);border-radius:10px;flex-wrap:wrap">
        <span style="font-family:'JetBrains Mono',monospace;font-size:11.5px;letter-spacing:.08em;color:var(--ink-3);text-transform:uppercase">4 DEPLOYS · ZULETZT AKTIV vor 2 std</span>
        <a style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.10em;text-transform:uppercase;color:var(--ink-2);text-decoration:none">Verbrauch ansehen →</a>
      </div>
      <div style="display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:24px">
        <div class="gobl-panel" style="overflow:hidden;align-self:start">
          <div style="padding:14px 18px;border-bottom:1px solid var(--line)">
            <h2 style="font-family:Manrope,sans-serif;font-weight:600;font-size:15px;letter-spacing:-0.014em;color:var(--ink-1);margin:0">Letzte Deploys</h2>
          </div>
          {deploy_html}
        </div>
        <div style="display:flex;flex-direction:column;gap:16px">
          <div class="gobl-panel" style="overflow:hidden">
            <div style="padding:14px 18px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between">
              <h2 style="font-family:Manrope,sans-serif;font-weight:600;font-size:15px;color:var(--ink-1);margin:0">Aktivität</h2>
              <a style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3);text-decoration:none">CHAT ÖFFNEN →</a>
            </div>
            {msg_html}
          </div>
          <div class="gobl-panel" style="overflow:hidden">
            <div style="padding:14px 18px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between">
              <h2 style="font-family:Manrope,sans-serif;font-weight:600;font-size:15px;color:var(--ink-1);margin:0">Dateien</h2>
              <a style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3);text-decoration:none">EDITOR ÖFFNEN →</a>
            </div>
            <div style="padding:16px 18px;font-size:13px;color:var(--ink-3);line-height:1.5">Vollständiger Dateibaum lebt im Editor. Tippe oben rechts „Editor öffnen“.</div>
          </div>
          <div class="gobl-panel" style="overflow:hidden">
            <div style="padding:14px 18px;border-bottom:1px solid var(--line)">
              <h2 style="font-family:Manrope,sans-serif;font-weight:600;font-size:15px;color:var(--ink-1);margin:0">URLs</h2>
            </div>
            <div style="padding:12px 18px;display:flex;flex-direction:column;gap:6px">
              <a style="display:inline-flex;align-items:center;gap:8px;background:var(--ok-soft);border:1px solid rgba(47,106,71,.30);color:var(--ok);border-radius:999px;padding:7px 14px;font-family:'JetBrains Mono',monospace;font-size:11.5px;text-decoration:none;width:fit-content">🌐 newsletter-tool.vercel.app · LIVE</a>
              <a style="display:inline-flex;align-items:center;gap:8px;background:var(--d-surface-elev);border:1px solid var(--line);color:var(--ink-1);border-radius:999px;padding:7px 14px;font-family:'JetBrains Mono',monospace;font-size:11.5px;text-decoration:none;width:fit-content">⌨ vincent/newsletter-tool</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
'''
    return shell(content, project_name="Newsletter-Tool", active_tab=None,
                 active_project_id='p1', has_project=True, has_preview=True)

# ─── Screen 09 — Secrets ─────────────────────────────────────────────────
def screen_09():
    secrets = [
        ('STRIPE_SECRET_KEY',       '· sk_live_••••••42', '14.05.2026'),
        ('STRIPE_WEBHOOK_SECRET',   '· whsec_••••••a9',   '14.05.2026'),
        ('DATABASE_URL',            '· postgres://••••', '12.05.2026'),
        ('RESEND_API_KEY',          '· re_••••••3f',      '08.05.2026'),
        ('SUPABASE_SERVICE_ROLE',   '· eyJh••••••8c',     '02.05.2026'),
    ]
    rows = ""
    for i,(name,hint,date) in enumerate(secrets):
        last = (i == len(secrets)-1)
        bb = '' if last else 'border-bottom:1px solid var(--line);'
        rows += f'''
        <div style="{bb}">
          <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr) 110px 80px;gap:14px;align-items:center;padding:14px 20px">
            <span style="font-family:'JetBrains Mono',monospace;font-size:12.5px;color:var(--ink-1);font-weight:500;letter-spacing:.02em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{name}</span>
            <span style="font-family:'JetBrains Mono',monospace;font-size:12.5px;color:var(--ink-3);display:flex;align-items:center;gap:6px;min-width:0;overflow:hidden"><span>•••••••••••• {hint}</span></span>
            <span style="font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--ink-3);letter-spacing:.06em;text-transform:uppercase">{date}</span>
            <div style="display:flex;gap:4px;justify-content:flex-end">
              <button style="background:transparent;border:none;cursor:pointer;color:var(--ink-3);padding:4px">👁</button>
              <button style="background:transparent;border:none;cursor:pointer;color:var(--ink-3);padding:4px">🗑</button>
            </div>
          </div>
          <div style="padding:0 20px 12px">
            <button style="background:transparent;border:none;cursor:pointer;font-family:'JetBrains Mono',monospace;font-size:10.5px;letter-spacing:.10em;text-transform:uppercase;color:var(--ink-3);padding:4px 0">+ Wo bekomme ich den?</button>
          </div>
        </div>'''
    content = f'''
<div style="height:100%;overflow-y:auto;background:var(--d-surface)">
  <div style="max-width:1100px;margin:0 auto;padding:32px 32px 80px">
    <a style="display:inline-flex;align-items:center;gap:6px;font-family:'JetBrains Mono',monospace;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3);margin-bottom:22px;text-decoration:none">← Zurück zum Projekt</a>
    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:12px;flex-wrap:wrap">
      <div>
        <div class="gobl-eyebrow" style="margin-bottom:12px">
          <span class="tick"></span><span class="num">/SECRETS · PRODUCTION</span>Verschlüsselt gespeichert
        </div>
        <h1 style="font-family:Manrope,sans-serif;font-weight:600;font-size:48px;letter-spacing:-0.030em;line-height:1.06;color:var(--ink-1);margin:0 0 12px">
          Projekt-<span class="gobl-serif">Secrets.</span>
        </h1>
      </div>
      <div style="display:flex;gap:4px;background:var(--d-surface-elev);border:1px solid var(--line);border-radius:999px;padding:4px">
        <button style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;letter-spacing:.12em;padding:7px 14px;border-radius:999px;border:none;cursor:pointer;background:var(--green);color:var(--bone);text-transform:uppercase">PRODUCTION</button>
        <button style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;letter-spacing:.12em;padding:7px 14px;border-radius:999px;border:none;cursor:pointer;background:transparent;color:var(--ink-3);text-transform:uppercase">STAGING</button>
        <button style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;letter-spacing:.12em;padding:7px 14px;border-radius:999px;border:none;cursor:pointer;background:transparent;color:var(--ink-3);text-transform:uppercase">DEVELOPMENT</button>
      </div>
    </div>
    <p style="font-size:16px;color:var(--ink-2);max-width:64ch;margin:0 0 24px;line-height:1.5">
      Secrets sind Passwörter, die deine App braucht, um mit anderen Diensten zu sprechen (z. B. Stripe oder deine Datenbank). Goblin speichert sie verschlüsselt — sie tauchen nie im Chat auf, nicht in Logs, und Goblin selbst kann sie nicht lesen.
      <em style="color:var(--ink-3);font-style:normal;display:block;margin-top:6px;font-size:13.5px">Hinweis: Die automatische Einspeisung in Deploys ist noch nicht aktiv — speichern, ansehen und löschen funktioniert bereits.</em>
    </p>
    <div style="background:var(--accent-soft);border:1px solid var(--accent-rule);border-radius:10px;padding:14px 18px;display:flex;align-items:center;gap:14px;margin-bottom:24px;flex-wrap:wrap">
      <span style="color:var(--accent);font-size:20px">🛡</span>
      <div style="flex:1;min-width:200px">
        <div style="font-family:Manrope,sans-serif;font-weight:600;font-size:14px;color:var(--ink-1);margin-bottom:2px">Bestätige, dass du es bist</div>
        <div style="font-size:12.5px;color:var(--ink-2);line-height:1.45">Werte einzusehen braucht eine frische Anmeldung — Schutz gegen geöffnete Browser-Sessions.</div>
      </div>
      <button class="gobl-btn gold sm">Bestätigen</button>
    </div>
    <div style="background:var(--d-surface-elev);border:1px solid var(--line);border-radius:14px;overflow:hidden">
      <div style="padding:10px 20px;background:var(--d-surface-2);border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between">
        <span style="font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-3);font-weight:600">5 SECRETS · PRODUCTION</span>
        <button class="gobl-btn primary sm">+ Hinzufügen</button>
      </div>
      {rows}
    </div>
  </div>
</div>
'''
    return shell(content, project_name="Newsletter-Tool", active_tab=None,
                 active_project_id='p1', has_project=True, has_preview=True)

# ─── Screen 10 — Usage ──────────────────────────────────────────────────
def screen_10():
    # Approximated bar chart — 30 bars
    bars = ""
    import math
    for i in range(30):
        weekday = (i+1) % 7
        weight = 0.55 if weekday in (0,6) else 1.0
        avg = 18
        v = max(0, round(avg * weight * (0.8 + 0.2*math.sin(i))))
        h = max(4, round((v/24)*160))
        weekend = weekday in (0,6)
        op = '0.4' if weekend else '1'
        bars += f'<div style="background:var(--green);border-radius:2px 2px 0 0;height:{h}px;opacity:{op}"></div>'

    projects_split = [
        ("Newsletter-Tool",     'var(--green)',    240, 95),
        ("Booking Page",        'var(--accent-bright)', 120, 48),
        ("Internal Dashboard",  '#6db97b',          60, 24),
        ("Stripe Sandbox",      '#3A6B8A',          30, 12),
    ]
    proj_rows = ""
    for i,(name,col,pct,cnt) in enumerate(projects_split):
        last = (i == len(projects_split)-1)
        bb = '' if last else 'border-bottom:1px solid var(--line);'
        proj_rows += f'''
        <a style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) 90px;gap:12px;align-items:center;padding:10px 18px;{bb}text-decoration:none;color:inherit;font-size:13px">
          <span style="display:flex;align-items:center;gap:8px;color:var(--ink-1);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><span style="width:7px;height:7px;border-radius:50%;background:{col};flex-shrink:0"></span>{name}</span>
          <span style="background:var(--d-surface-2);height:4px;border-radius:2px;overflow:hidden;position:relative"><span style="display:block;height:100%;background:var(--green);width:{pct}%"></span></span>
          <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--ink-3);text-align:right">{cnt} REQ</span>
        </a>'''

    models_split = [
        ('anthropic/claude-sonnet-4-6', 62, 110),
        ('openai/gpt-4o-mini',          21, 38),
        ('groq/llama-3.3-70b',          12, 22),
        ('google/gemini-2.0-flash',      5,  9),
    ]
    model_rows = ""
    colors = ['var(--green)', 'var(--accent-bright)', '#6db97b', '#3A6B8A']
    for i,(m,pct,cnt) in enumerate(models_split):
        last = (i == len(models_split)-1)
        bb = '' if last else 'border-bottom:1px solid var(--line);'
        model_rows += f'''
        <div style="display:flex;align-items:center;gap:10px;padding:7px 0;{bb}font-size:13px">
          <span style="width:10px;height:10px;border-radius:2px;background:{colors[i]}"></span>
          <span style="color:var(--ink-1);flex:1;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{m}</span>
          <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--ink-3)">{pct}% · {cnt}</span>
        </div>'''

    content = f'''
<div style="height:100%;overflow-y:auto;background:var(--d-surface)">
  <div style="max-width:1240px;margin:0 auto;padding:32px 32px 80px">
    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:32px;padding-bottom:18px;border-bottom:1px solid var(--line);flex-wrap:wrap">
      <div>
        <div class="gobl-eyebrow" style="margin-bottom:12px">
          <span class="tick"></span><span class="num">/VERBRAUCH</span>Letzte 30 TAGE
        </div>
        <h1 style="font-family:Manrope,sans-serif;font-weight:600;font-size:48px;letter-spacing:-0.030em;line-height:1.06;color:var(--ink-1);margin:0">
          Verbrauch <span class="gobl-serif">auf einen Blick.</span>
        </h1>
      </div>
      <div style="display:flex;gap:4px;background:var(--d-surface-elev);border:1px solid var(--line);border-radius:999px;padding:4px">
        <button style="font-family:'JetBrains Mono',monospace;font-size:10.5px;font-weight:600;letter-spacing:.12em;padding:6px 12px;border-radius:999px;border:none;cursor:pointer;text-transform:uppercase;background:transparent;color:var(--ink-3)">7D</button>
        <button style="font-family:'JetBrains Mono',monospace;font-size:10.5px;font-weight:600;letter-spacing:.12em;padding:6px 12px;border-radius:999px;border:none;cursor:pointer;text-transform:uppercase;background:var(--green);color:var(--bone)">30D</button>
        <button style="font-family:'JetBrains Mono',monospace;font-size:10.5px;font-weight:600;letter-spacing:.12em;padding:6px 12px;border-radius:999px;border:none;cursor:pointer;text-transform:uppercase;background:transparent;color:var(--ink-3)">90D</button>
      </div>
    </div>
    <div class="gobl-panel" style="padding:22px 24px;margin-bottom:28px">
      <p style="font-family:Manrope,sans-serif;font-weight:600;font-size:22px;letter-spacing:-0.018em;color:var(--ink-1);margin:0 0 8px;line-height:1.3">
        Du hast 142 von 200 Anfragen verbraucht — gut im Plan. Setzt sich in 8 Tagen zurück.
      </p>
      <p style="font-family:'JetBrains Mono',monospace;font-size:11.5px;letter-spacing:.10em;color:var(--ink-3);margin:0;text-transform:uppercase">
        BYOK · 96 ANFRAGEN ÜBER DEINE KEYS · 46 ÜBER FREE-TIER
      </p>
    </div>
    <div class="gobl-panel" style="overflow:hidden;margin-bottom:18px">
      <div style="padding:14px 18px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between">
        <h2 style="font-family:Manrope,sans-serif;font-weight:600;font-size:15px;color:var(--ink-1);margin:0">Anfragen pro Tag</h2>
        <span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--ink-3);letter-spacing:.14em;text-transform:uppercase">30 TAGE · BYOK + FREE</span>
      </div>
      <div style="padding:20px 18px">
        <div style="display:grid;grid-template-columns:repeat(30,1fr);gap:4px;align-items:end;height:160px;padding:0 4px">
          {bars}
        </div>
        <div style="display:flex;gap:16px;margin-top:14px;flex-wrap:wrap">
          <span style="display:inline-flex;align-items:center;gap:6px;font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--ink-3);letter-spacing:.06em;text-transform:uppercase"><span style="width:9px;height:9px;border-radius:2px;background:var(--green)"></span>BYOK</span>
          <span style="display:inline-flex;align-items:center;gap:6px;font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--ink-3);letter-spacing:.06em;text-transform:uppercase"><span style="width:9px;height:9px;border-radius:2px;background:var(--accent-bright)"></span>FREE-TIER</span>
          <span style="display:inline-flex;align-items:center;gap:6px;font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--ink-3);letter-spacing:.06em;text-transform:uppercase"><span style="width:9px;height:9px;border-radius:2px;background:var(--d-surface-3)"></span>WOCHENENDE</span>
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:18px">
      <div class="gobl-panel" style="overflow:hidden">
        <div style="padding:14px 18px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between">
          <h2 style="font-family:Manrope,sans-serif;font-weight:600;font-size:15px;color:var(--ink-1);margin:0">Pro Projekt</h2>
          <span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--ink-3);letter-spacing:.14em;text-transform:uppercase">ANFRAGEN · 30 TAGE</span>
        </div>
        {proj_rows}
      </div>
      <div class="gobl-panel" style="overflow:hidden">
        <div style="padding:14px 18px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between">
          <h2 style="font-family:Manrope,sans-serif;font-weight:600;font-size:15px;color:var(--ink-1);margin:0">Modelle</h2>
          <span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--ink-3);letter-spacing:.14em;text-transform:uppercase">ANTEIL</span>
        </div>
        <div style="padding:14px 18px">
          {model_rows}
        </div>
      </div>
    </div>
  </div>
</div>
'''
    return shell(content, active_tab=None, has_project=False)

# ─── Screen 11 — Upgrade ─────────────────────────────────────────────────
def screen_11():
    plans = [
        ('build', 'Build', 9,  '200', 'FÜR DEN START',
         'Lern Goblin kennen. 200 Anfragen pro Monat, BYOK auf allen Providern.',
         ['200 AI-Anfragen / Monat', '3 Projekte', 'BYOK — alle Provider', 'Send to Code', '5 GB Cloud-Storage'],
         False, True),
        ('pro', 'Pro', 19, '800', 'FÜR REGELMÄSSIGE BUILDER',
         'Vier Mal so viele Anfragen, Auto-Fallback wenn ein Key streikt.',
         ['800 AI-Anfragen / Monat', '50 Projekte', 'BYOK · Request-Cache', '20 GB Cloud-Storage', 'GitHub + Vercel Auto-Deploy', 'Auto-Fallback-Routing'],
         False, False),
        ('power', 'Power', 39, '3.000', 'WENN DU MEHR ANFRAGEN BRAUCHST',
         'Mehr Durchsatz für Power-Builder. Priority-Routing, Unlimited Projekte.',
         ['3.000 AI-Anfragen / Monat', 'Unlimitierte Projekte', 'BYOK · Priority-Routing', '100 GB Cloud-Storage', 'Erweiterte Modell-Auswahl', 'Beta-Features 30 Tage früher'],
         True, False),
    ]
    cards = ""
    for pid, name, price, reqs, meta, pitch, feats, featured, current in plans:
        bg = 'var(--d-surface-deep)' if featured else 'var(--d-surface-elev)'
        fg = 'var(--bone)' if featured else 'var(--ink-1)'
        sub = 'rgba(244,236,216,.62)' if featured else 'var(--ink-3)'
        border = 'var(--green)' if featured else 'var(--line)'
        rule = 'rgba(244,236,216,.14)' if featured else 'var(--line)'
        check_color = 'var(--gold)' if featured else 'var(--accent)'
        pitch_color = 'rgba(244,236,216,.78)' if featured else 'var(--ink-2)'
        current_badge = '<span style="position:absolute;top:-10px;left:24px;font-family:\'JetBrains Mono\',monospace;font-size:10px;letter-spacing:.16em;padding:4px 9px;border-radius:4px;background:var(--accent-bright);color:var(--green);font-weight:600">DEIN PLAN</span>' if current else ''
        outline = 'box-shadow:0 0 0 2px var(--accent-rule);' if current else ''
        feat_html = "".join(f'<li style="display:flex;align-items:flex-start;gap:9px;font-size:13.5px;line-height:1.45;color:{fg}"><span style="color:{check_color};flex-shrink:0;margin-top:2px">✓</span><span>{f}</span></li>' for f in feats)
        if current:
            btn = f'<button disabled style="width:100%;padding:12px 0;background:var(--green);color:var(--bone);border:none;border-radius:10px;font-family:Manrope,sans-serif;font-weight:600;font-size:14px;cursor:not-allowed;opacity:0.85">Dein aktueller Plan</button>'
        else:
            cls = 'gobl-btn gold' if featured else 'gobl-btn primary'
            btn = f'<button class="{cls}" style="width:100%;justify-content:center;padding:12px 0">{name} wählen →</button>'
        cards += f'''
        <div style="background:{bg};color:{fg};border:1px solid {border};border-radius:14px;padding:28px;display:flex;flex-direction:column;gap:18px;position:relative;{outline}">
          {current_badge}
          <div>
            <h3 style="font-family:Manrope,sans-serif;font-weight:600;font-size:24px;letter-spacing:-0.024em;color:{fg};margin:0">{name}</h3>
            <span style="font-family:'JetBrains Mono',monospace;font-size:10.5px;letter-spacing:.10em;text-transform:uppercase;color:{sub};display:block;margin-top:6px">{meta}</span>
          </div>
          <div style="display:flex;align-items:baseline;gap:8px;padding:8px 0;border-top:1px solid {rule};border-bottom:1px solid {rule}">
            <span style="font-family:Manrope,sans-serif;font-weight:600;font-size:48px;letter-spacing:-0.036em;color:{fg};line-height:1">${price}</span>
            <span style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.10em;text-transform:uppercase;color:{sub}">/ MONAT</span>
          </div>
          <p style="font-size:13.5px;line-height:1.45;margin:0;color:{pitch_color}">{pitch}</p>
          <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:9px">{feat_html}</ul>
          <div style="margin-top:auto">{btn}</div>
        </div>'''
    content = f'''
<div style="height:100%;overflow-y:auto;background:var(--d-surface)">
  <div style="max-width:1140px;margin:0 auto;padding:48px 32px 80px">
    <header style="text-align:center;margin-bottom:40px">
      <div class="gobl-eyebrow" style="justify-content:center;margin-bottom:18px">
        <span class="tick"></span><span class="num">DEIN PLAN · BUILD</span>
      </div>
      <h1 style="font-family:Manrope,sans-serif;font-weight:600;font-size:56px;letter-spacing:-0.034em;line-height:1.04;color:var(--ink-1);margin:0 auto 14px;max-width:16ch">
        Mehr bauen, <span class="gobl-serif">weniger ausgeben.</span>
      </h1>
      <p style="font-size:16.5px;color:var(--ink-2);max-width:56ch;margin:0 auto;line-height:1.5">Drei Pläne. BYOK auf jedem. Jederzeit kündbar.</p>
    </header>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px;margin-bottom:32px">
      {cards}
    </div>
    <div style="text-align:center;margin-bottom:12px">
      <button class="gobl-btn ghost sm">Alle Features vergleichen →</button>
    </div>
    <div style="display:flex;justify-content:center;gap:24px;flex-wrap:wrap;margin-top:24px;padding-top:24px;border-top:1px solid var(--line)">
      <span style="font-family:'JetBrains Mono',monospace;font-size:10.5px;letter-spacing:.10em;text-transform:uppercase;color:var(--ink-3);display:inline-flex;align-items:center;gap:7px"><span style="color:var(--accent)">✓</span>JEDERZEIT KÜNDBAR</span>
      <span style="font-family:'JetBrains Mono',monospace;font-size:10.5px;letter-spacing:.10em;text-transform:uppercase;color:var(--ink-3);display:inline-flex;align-items:center;gap:7px"><span style="color:var(--accent)">✓</span>BYOK AUF JEDEM TIER</span>
      <span style="font-family:'JetBrains Mono',monospace;font-size:10.5px;letter-spacing:.10em;text-transform:uppercase;color:var(--ink-3);display:inline-flex;align-items:center;gap:7px"><span style="color:var(--accent)">✓</span>STRIPE · KEIN LOCK-IN</span>
    </div>
  </div>
</div>
'''
    return shell(content, active_tab=None, has_project=False)

# ─── Build all ───────────────────────────────────────────────────────────
page('03', 'Dashboard Home',  screen_03())
page('04', 'New Project',     screen_04())
page('05', 'Chat — Empty',    screen_05())
page('06', 'Chat — Active',   screen_06())
page('08', 'Project Detail',  screen_08())
page('09', 'Secrets',         screen_09())
page('10', 'Usage',           screen_10())
page('11', 'Upgrade',         screen_11())

print("done.")
