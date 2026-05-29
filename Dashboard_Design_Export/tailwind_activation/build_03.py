# Builds built_03_post_foundation.html — the dashboard home (app/dashboard/page.tsx)
# with its real shell (Header + Sidebar), post-foundation. Two iframes
# (desktop 1280x860, mobile 390x844) so media-query layouts resolve per frame.
# CSS = real design-tokens.css + dashboard-tokens.css + the compiled Tailwind
# chunk, inlined. Faithful render — nothing fixed or idealised. Read-only.

import os, glob, html

HERE = os.path.dirname(os.path.abspath(__file__))
WEB  = os.path.normpath(os.path.join(HERE, "..", "..", "apps", "web"))

design  = open(os.path.join(WEB, "styles", "design-tokens.css"), encoding="utf-8").read()
dash    = open(os.path.join(WEB, "styles", "dashboard-tokens.css"), encoding="utf-8").read()

chunk = None
for f in glob.glob(os.path.join(WEB, ".next", "static", "**", "*.css"), recursive=True):
    t = open(f, encoding="utf-8").read()
    if ".flex{" in t and "--color-brand-gold:" in t and "body{" in t:
        chunk = t; chunk_name = os.path.basename(f); break
assert chunk, "compiled chunk not found — run a production build first"

FONTS = ("@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800"
         "&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600&display=swap');")
FONTS_TAG = ("<link rel='preconnect' href='https://fonts.googleapis.com'>"
             "<link href='https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800"
             "&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600&display=swap' rel='stylesheet'>")

INNER_CSS = FONTS + "\n" + design + "\n" + dash + "\n" + chunk + "\n" + (
    "html,body{height:100%;margin:0}"
    "*{-webkit-font-smoothing:antialiased}"
)

# ─── data ───
DISPLAY = "Vincent"
INIT = "V"
PROJECTS = [
    ("Goblin Landing", "var(--gold)", "active",  "goblin-landing", "Landingpage mit Stripe-Bezahlung.", "2h"),
    ("API Gateway",    "#6db97b",     "live",    "api-gateway",    "Hono API mit BYOK-Routing.",        "5h"),
    ("Portfolio v2",   "#7A4A8A",     "draft",   None,             "Persönliches Portfolio, Dark Mode.", "1d"),
    ("Stripe Checkout","#3A6B8A",     "active",  "stripe-checkout","Checkout-Flow + Webhooks.",         "3d"),
]
STATUS = {"active":("AKTIV","var(--gold)"),"live":("LIVE","#6db97b"),"draft":("DRAFT","#7A4A8A"),"shipping":("SHIPPING","var(--gold)")}
UPDATES = [
    ("NEU","gold","Claude Sonnet 4.6 verfügbar","Goblin nutzt dein eigenes Anthropic-Konto automatisch.","MAI 22"),
    ("NEU","gold","BYOK-Streaming stabilisiert","Anthropic, OpenAI und Groq streamen wieder ohne Abbrüche.","MAI 20"),
    ("UPDATE","plain","Send to Code auf dem Handy","Code aus dem Chat in den Editor schieben — auch unterwegs.","APR 14"),
    ("SICHERHEIT","warn","CORS und Stream-Abbrüche gehärtet","Stabilität und Abbruch-Verhalten in allen Routen verbessert.","APR 08"),
]
QUICK = ["Eine Landingpage mit Anmeldeformular","Eine Aufgabenliste, die meine Einträge merkt",
         "Eine Seite, auf der Leute Termine buchen können","Magic-Link-Login für meine Next.js-App"]
RECENT = [("Landingpage Hilfe","2h"),("Stripe Setup","5h"),("Dark mode toggle","1d")]

def header():
    tabs = ""
    for tid,label,active,disabled in [("chat","Chat",True,False),("code","Code",False,True),("preview","Preview",False,True)]:
        bg = "var(--surface-1, #fff)" if active else "transparent"
        col = "var(--brand-header)" if active else "rgba(244,236,216,0.78)"
        icon = {"chat":'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
                "code":'<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
                "preview":'<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'}[tid]
        tabs += (f'<button role="tab" style="display:flex;align-items:center;gap:5px;padding:6px 10px;border-radius:7px;'
                 f'background:{bg};color:{col};font-weight:{600 if active else 500};font-size:13px;'
                 f'font-family:var(--font-dash-display),Manrope,sans-serif;border:none;'
                 f'box-shadow:{"0 1px 2px rgba(0,0,0,0.18)" if active else "none"};opacity:{0.5 if disabled else 1};min-height:30px">'
                 f'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{icon}</svg>'
                 f'<span class="goblin-tab-label">{label}</span></button>')
    return (
      '<header style="height:56px;background:var(--brand-header);display:flex;align-items:center;padding:0 12px;gap:8px;'
      'flex-shrink:0;border-bottom:1px solid rgba(244,236,216,.12);position:relative;z-index:50">'
        '<button class="goblin-hamburger" aria-label="Open menu" style="background:none;border:none;color:rgba(255,255,255,0.85);'
        'cursor:pointer;padding:0;border-radius:6px;width:40px;height:40px;display:none;align-items:center;justify-content:center;flex-shrink:0">'
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">'
          '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>'
        '<button style="font-family:var(--font-dash-display),Manrope,sans-serif;font-size:20px;color:var(--gold);font-weight:700;'
        'letter-spacing:-0.5px;background:none;border:none;cursor:pointer;padding:6px 4px;flex-shrink:0">Goblin<span style="opacity:.6">.</span></button>'
        '<div style="flex:1;min-width:8px"></div>'
        f'<div class="goblin-tab-pills" role="tablist" style="display:flex;gap:2px;padding:3px;background:rgba(0,0,0,0.18);border-radius:10px;flex-shrink:0">{tabs}</div>'
        # plus FAB
        '<div style="position:relative;flex-shrink:0"><button aria-label="Create new" style="width:36px;height:36px;border-radius:50%;'
        'background:transparent;color:rgba(255,255,255,0.9);border:1px solid rgba(255,255,255,0.35);cursor:pointer;'
        'display:flex;align-items:center;justify-content:center">'
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">'
          '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button></div>'
        # local/cloud switch
        '<div style="position:relative;display:flex;align-items:center">'
          '<div style="display:flex;align-items:center;background:rgba(0,0,0,0.25);border-radius:6px;padding:2px;border:1px solid rgba(255,255,255,0.1)">'
            '<button style="padding:3px 9px;border-radius:4px;border:none;font-size:11px;font-weight:600;'
            'font-family:var(--font-dash-display),Manrope,sans-serif;letter-spacing:0.5px;background:transparent;color:rgba(255,255,255,0.2);opacity:.6">LOCAL</button>'
            '<button style="padding:3px 9px;border-radius:4px;border:none;font-size:11px;font-weight:600;'
            'font-family:var(--font-dash-display),Manrope,sans-serif;letter-spacing:0.5px;background:rgba(212,169,74,0.2);color:var(--brand-gold)">CLOUD</button>'
          '</div></div>'
        # avatar
        f'<button aria-label="Konto-Menü" style="width:32px;height:32px;border-radius:50%;background:var(--gold-700);color:#2a1f0f;'
        f'border:none;font-size:13px;font-weight:700;font-family:var(--font-dash-display),Manrope,sans-serif;cursor:pointer;flex-shrink:0">{INIT}</button>'
      '</header>')

def sidebar_project_rows(small=False):
    out = ""
    for i,(name,color,st,repo,desc,t) in enumerate(PROJECTS):
        active = i == 0
        if small:
            out += (f'<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;margin-bottom:2px;min-height:44px;'
                    f'background:{"rgba(212,169,74,0.13)" if active else "transparent"}">'
                    f'<div style="width:10px;height:10px;border-radius:50%;background:{color};flex-shrink:0"></div>'
                    f'<span style="font-size:15px;font-weight:{600 if active else 400};color:{"var(--brand-green)" if active else "var(--text)"};'
                    f'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-sans)">{name}</span>'
                    f'<span style="font-size:11px;color:var(--text-faint);flex-shrink:0">{t}</span></div>')
        else:
            out += (f'<div style="display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:7px;margin-bottom:1px;'
                    f'background:{"rgba(212,169,74,0.13)" if active else "transparent"};'
                    f'border:1px solid {"rgba(212,169,74,0.25)" if active else "transparent"}">'
                    f'<div style="width:8px;height:8px;border-radius:50%;background:{color};flex-shrink:0"></div>'
                    f'<span style="font-size:13px;font-weight:{600 if active else 400};color:{"var(--brand-green)" if active else "var(--text)"};'
                    f'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-sans)">{name}</span>'
                    f'<span style="font-size:10px;color:var(--text-faint);flex-shrink:0">{t}</span></div>')
    return out

def recent_rows():
    out = ""
    for name,t in RECENT:
        out += (f'<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;margin-bottom:1px;cursor:pointer">'
                f'<span style="font-size:13px;color:var(--text);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-sans)">{name}</span>'
                f'<span style="font-size:10px;color:var(--text-faint);flex-shrink:0">{t}</span></div>')
    return out

def sidebar_usage():
    return ('<a style="display:block;text-decoration:none;margin:0 12px 8px;padding:10px 12px;border-radius:8px;'
            'background:rgba(15,43,30,0.05);border:1px solid var(--line);font-family:var(--font-dash-display),Manrope,sans-serif;color:var(--ink-1)">'
            '<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:7px">'
              '<span style="font-size:12px;font-weight:600;color:var(--ink-2)">Verbrauch</span>'
              '<span style="font-family:JetBrains Mono,monospace;font-size:12px;font-weight:600;color:var(--ink-1)">71&nbsp;%</span></div>'
            '<div style="height:4px;border-radius:2px;overflow:hidden;background:rgba(15,43,30,0.10)">'
              '<div style="height:100%;width:71%;background:var(--green,#0F2B1E)"></div></div>'
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:7px;font-size:10.5px;color:var(--ink-3)">'
              '<span style="text-transform:capitalize">Build</span><span>Reset in 8 Tagen</span></div></a>')

def plus_btn(sz=22):
    return (f'<button style="background:var(--brand-header);border:none;cursor:pointer;padding:0;border-radius:7px;color:var(--bone,#F4ECD8);'
            f'display:flex;align-items:center;justify-content:center;width:{sz}px;height:{sz}px;box-shadow:0 1px 2px rgba(0,0,0,0.08)">'
            f'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">'
            f'<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>')

def gear():
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'

def sidebar_desktop():
    return (
      '<aside class="goblin-sidebar-desktop" style="width:260px;min-width:260px;background:var(--subtle);border-right:1px solid var(--border);'
      'display:flex;flex-direction:column;height:100%;overflow:hidden;position:relative;z-index:40;flex-shrink:0">'
        # logo + user row
        '<div style="height:56px;display:flex;align-items:center;padding:0 16px;border-bottom:1px solid var(--border);flex-shrink:0;gap:10px">'
          '<div style="font-family:var(--font-sans);font-size:17px;color:var(--brand-green);font-weight:700;letter-spacing:-0.3px">Goblin<span style="opacity:.45">.</span></div>'
          '<div style="flex:1"></div>'
          f'<div style="font-size:11px;color:#8C857A;font-family:var(--font-sans);max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{DISPLAY}</div>'
          '<button style="width:24px;height:24px;border-radius:6px;background:transparent;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer;color:#8C857A;flex-shrink:0">'
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg></button>'
        '</div>'
        # projects
        '<div style="flex:1;overflow-y:auto;min-height:0;padding-top:8px">'
          '<div style="padding:4px 12px 6px 16px;display:flex;align-items:center;justify-content:space-between">'
            '<span style="font-size:10px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:var(--text-faint);font-family:var(--font-dash-display),Manrope,sans-serif">Projekte</span>'
            f'{plus_btn(22)}</div>'
          f'<div style="padding:0 8px 8px">{sidebar_project_rows(False)}</div>'
          # recent chats
          '<div style="border-top:1px solid var(--border);padding:8px 0 0">'
            '<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 12px 6px 16px">'
              '<span style="font-size:10px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:var(--text-faint);font-family:var(--font-dash-display),Manrope,sans-serif">Chats</span>'
              f'{plus_btn(22)}</div>'
            f'<div style="padding:0 8px 8px">{recent_rows()}</div></div>'
        '</div>'
        # usage
        f'{sidebar_usage()}'
        # user pill
        '<div style="padding:10px 12px;border-top:1px solid var(--border);flex-shrink:0">'
          '<button style="display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;border-radius:24px;background:var(--panel,#fff);'
          'border:1px solid var(--border);cursor:pointer;min-height:40px;font-family:var(--font-sans)">'
            f'<span style="width:28px;height:28px;border-radius:50%;background:var(--brand-green);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0">{INIT}</span>'
            f'<span style="font-size:13px;font-weight:500;color:var(--text);flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{DISPLAY}</span>'
            f'{gear()}</button></div>'
      '</aside>')

def sidebar_mobile():
    # drawer, closed (translateX -100%). present in DOM, off-screen.
    return (
      '<aside class="goblin-sidebar-mobile" style="position:fixed;top:0;bottom:0;left:0;width:85vw;max-width:320px;background:var(--subtle);'
      'border-right:1px solid var(--border);display:flex;flex-direction:column;z-index:40;transform:translateX(-100%);overflow-y:auto">'
        '<div style="display:flex;align-items:center;padding:24px 20px 16px;flex-shrink:0">'
          '<div style="font-family:var(--font-sans);font-size:28px;color:var(--brand-green);font-weight:400;letter-spacing:-0.5px">Goblin</div>'
          '<div style="flex:1"></div>'
          '<button style="background:rgba(0,0,0,0.04);border:none;font-size:18px;color:#8C857A;display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:18px">×</button></div>'
        '<div style="flex-shrink:0;padding-top:4px">'
          '<div style="padding:12px 12px 8px 20px;display:flex;align-items:center;justify-content:space-between">'
            '<span style="font-size:11px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:var(--text-faint);font-family:var(--font-dash-display),Manrope,sans-serif">Projekte</span>'
            f'{plus_btn(28)}</div>'
          f'<div style="padding:0 12px 8px">{sidebar_project_rows(True)}</div></div>'
        f'<div style="flex:1;overflow-y:auto;min-height:0"></div>{sidebar_usage()}'
        '<div style="padding:12px 16px;border-top:1px solid var(--border);flex-shrink:0">'
          '<button style="display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;border-radius:24px;background:var(--panel,#fff);border:1px solid var(--border);min-height:44px;font-family:var(--font-sans)">'
            f'<span style="width:32px;height:32px;border-radius:50%;background:var(--brand-green);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px">{INIT}</span>'
            f'<span style="font-size:14px;font-weight:500;color:var(--text);flex:1;text-align:left">{DISPLAY}</span></button></div>'
      '</aside>')

def hero_composer():
    return (
      '<div style="padding:0;background:transparent;flex-shrink:0"><div style="position:relative">'
        '<div style="display:flex;flex-direction:column;border:1px solid rgba(244,236,216,.16);border-radius:14px;background:rgba(244,236,216,.05)">'
          '<textarea rows="2" placeholder="Eine Landingpage mit Stripe-Bezahlung in Next.js…" '
          'style="resize:none;border:none;background:transparent;outline:none;font-size:16px;color:var(--bone);'
          'font-family:var(--font-dash-display),Manrope,sans-serif;line-height:24px;padding:12px 14px 6px;width:100%;box-sizing:border-box"></textarea>'
          '<div style="display:flex;align-items:center;padding:4px 8px 8px;gap:6px">'
            '<button style="width:28px;height:28px;border-radius:50%;border:1px solid rgba(244,236,216,.20);background:transparent;cursor:pointer;'
            'display:flex;align-items:center;justify-content:center;color:rgba(244,236,216,.72);flex-shrink:0">'
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>'
            '<button style="display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;background:none;border:1px solid rgba(244,236,216,.20);'
            'cursor:pointer;font-size:11px;font-weight:500;color:rgba(244,236,216,.72);font-family:var(--font-dash-display),Manrope,sans-serif;max-width:160px">'
              '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Gemini Flash</span>'
              '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" style="opacity:.6"><polyline points="6 9 12 15 18 9"/></svg></button>'
            '<span style="flex:1;font-size:11px;color:rgba(244,236,216,.5);font-family:var(--font-dash-display),Manrope,sans-serif;padding-left:2px">⇧↵ new line</span>'
            '<button style="width:32px;height:32px;border-radius:50%;border:none;background:transparent;display:flex;align-items:center;justify-content:center;color:var(--text-2)">'
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'
              '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg></button>'
            '<button aria-label="Senden" style="width:32px;height:32px;border-radius:8px;background:rgba(244,236,216,.20);border:none;cursor:not-allowed;'
            'display:flex;align-items:center;justify-content:center;color:rgba(244,236,216,.45);flex-shrink:0">'
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg></button>'
          '</div>'
        '</div></div></div>')

def quick_chips():
    chips = "".join(f'<button style="background:transparent;color:rgba(244,236,216,.62);border:1px solid rgba(244,236,216,.14);'
                    f'border-radius:999px;padding:6px 12px;font-size:12.5px;font-weight:500;cursor:pointer;'
                    f'font-family:var(--font-dash-display),Manrope,sans-serif">{q}</button>' for q in QUICK)
    return f'<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">{chips}</div>'

def proj_grid():
    cards = ""
    for i,(name,color,st,repo,desc,t) in enumerate(PROJECTS):
        lbl,scol = STATUS[st]
        cards += (
          f'<a class="gobl-panel" style="padding:14px;display:flex;flex-direction:column;gap:6px;min-height:92px;text-decoration:none;color:inherit">'
            f'<div style="display:flex;align-items:center;justify-content:space-between">'
              f'<span style="display:flex;align-items:center;gap:7px;font-family:JetBrains Mono,monospace;font-size:9.5px;letter-spacing:0.14em;color:var(--ink-3);text-transform:uppercase">'
                f'<span style="width:6px;height:6px;border-radius:50%;background:{scol}"></span>{lbl}</span>'
              f'<span style="color:var(--ink-3);font-size:13px">→</span></div>'
            f'<h3 style="font-family:var(--font-dash-display),Manrope,sans-serif;font-weight:600;font-size:15px;letter-spacing:-0.014em;color:var(--ink-1);line-height:1.25;margin:2px 0 0">{name}</h3>'
            f'<p style="font-size:12.5px;color:var(--ink-2);line-height:1.4;margin:0;overflow:hidden">{desc}</p>'
            f'<div style="margin-top:auto;font-family:JetBrains Mono,monospace;font-size:10px;color:var(--ink-3);letter-spacing:0.06em;display:flex;justify-content:space-between;padding-top:9px;border-top:1px solid var(--line)">'
              f'<span>{(repo.split("/")[-1].upper() if repo else "PROJEKT")}</span><span>VOR {t.upper()}</span></div>'
          f'</a>')
    cards += ('<button style="background:transparent;border:1px dashed var(--line-strong);border-radius:var(--radius-lg);min-height:92px;'
              'display:flex;align-items:center;justify-content:center;color:var(--ink-3);font-family:var(--font-dash-display),Manrope,sans-serif;'
              'font-weight:600;font-size:13.5px;cursor:pointer;gap:8px">+ Neues Projekt</button>')
    return f'<div class="gobl-proj-grid">{cards}</div>'

def proj_list():
    rows = ""
    for i,(name,color,st,repo,desc,t) in enumerate(PROJECTS):
        lbl,scol = STATUS[st]
        last = i == len(PROJECTS)-1
        rows += (f'<a style="display:flex;align-items:center;gap:10px;padding:12px 14px;min-height:48px;'
                 f'border-bottom:{"none" if last else "1px solid var(--line)"};text-decoration:none;color:inherit">'
                 f'<span style="width:8px;height:8px;border-radius:50%;background:{scol};flex-shrink:0"></span>'
                 f'<span style="flex:1;min-width:0;font-family:var(--font-dash-display),Manrope,sans-serif;font-weight:600;font-size:14.5px;color:var(--ink-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{name}</span>'
                 f'<span style="flex-shrink:0;font-family:JetBrains Mono,monospace;font-size:10px;color:var(--ink-3);letter-spacing:0.06em">VOR {t.upper()}</span></a>')
    rows += ('<button style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:12px 14px;min-height:48px;'
             'background:transparent;border:none;border-top:1px solid var(--line);cursor:pointer;color:var(--ink-2);'
             'font-family:var(--font-dash-display),Manrope,sans-serif;font-weight:600;font-size:14px">+ Neues Projekt</button>')
    return f'<div class="gobl-proj-list gobl-panel" style="overflow:hidden">{rows}</div>'

def whats_new():
    rows = ""
    for i,(tag,tone,title,desc,date) in enumerate(UPDATES):
        last = i == len(UPDATES)-1
        tagcls = "gobl-tag gold" if tone=="gold" else ("gobl-tag warn" if tone=="warn" else "gobl-tag")
        rows += (f'<div style="padding:16px 18px;border-bottom:{"none" if last else "1px solid var(--line)"};display:flex;align-items:flex-start;gap:14px">'
                 f'<span class="{tagcls}" style="margin-top:2px;flex-shrink:0">{tag}</span>'
                 f'<div style="flex:1;min-width:0">'
                   f'<h4 style="font-family:var(--font-dash-display),Manrope,sans-serif;font-weight:600;font-size:14.5px;color:var(--ink-1);margin:0 0 3px;letter-spacing:-0.012em">{title}</h4>'
                   f'<p style="font-size:13.5px;color:var(--ink-2);line-height:1.5;margin:0">{desc}</p></div>'
                 f'<span style="font-family:JetBrains Mono,monospace;font-size:10.5px;color:var(--ink-3);letter-spacing:0.08em;flex-shrink:0;margin-top:2px">{date}</span></div>')
    return (f'<section><div class="gobl-section-title"><h2>Was ist neu</h2><a href="#">Alle Updates →</a></div>'
            f'<div class="gobl-panel" style="overflow:hidden">{rows}</div></section>')

PAGE_STYLE = ("<style>.gobl-proj-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}"
              ".gobl-proj-list{display:none}"
              "@media (max-width:480px){.gobl-dash-home{padding:20px 16px 64px !important}"
              ".gobl-proj-grid{display:none}.gobl-proj-list{display:block}"
              ".gobl-hero{padding:18px 16px 16px !important}.gobl-hero-title{font-size:24px !important;margin-bottom:14px !important}}"
              "@media (max-width:768px){.goblin-hamburger{display:flex !important}.goblin-tab-label{display:none !important}}"
              "@media (min-width:769px){.goblin-sidebar-mobile{display:none !important}}"
              "@media (max-width:768px){.goblin-sidebar-desktop{display:none !important}}</style>")

def dashboard_home():
    return (
      '<div style="height:100%;overflow-y:auto;background:var(--d-surface)">'
      f'{PAGE_STYLE}'
      '<div class="gobl-dash-home" style="max-width:1140px;margin:0 auto;padding:40px 32px 80px">'
        # hero
        '<section class="gobl-hero" style="background:var(--d-surface-darkest);color:var(--bone);border-radius:var(--radius-lg);'
        'padding:28px 28px 22px;margin-bottom:36px;border:1px solid rgba(244,236,216,.12);position:relative;overflow:hidden">'
          '<div class="gobl-eyebrow" style="color:rgba(244,236,216,.62);margin-bottom:14px">'
          f'<span class="tick"></span><span style="color:var(--bone);font-weight:600">{DISPLAY.upper()}</span> Hallo</div>'
          '<h1 class="gobl-hero-title" style="font-family:var(--font-dash-display),Manrope,sans-serif;font-weight:600;'
          'font-size:clamp(28px,3.2vw,40px);letter-spacing:-0.028em;line-height:1.1;color:var(--bone);margin-bottom:18px">'
          'Sag Goblin, was du <span class="gobl-serif">bauen willst.</span></h1>'
          f'{hero_composer()}{quick_chips()}'
        '</section>'
        # projects
        '<section style="margin-bottom:48px">'
          '<div class="gobl-section-title" style="margin-top:0"><h2>Deine Projekte</h2><span class="label">4 AKTIV</span></div>'
          f'{proj_grid()}{proj_list()}'
        '</section>'
        f'{whats_new()}'
      '</div></div>')

def shell():
    return (
      '<div class="gobl-dash" style="height:100%">'
        '<div style="display:flex;flex-direction:column;height:100dvh;background:var(--paper);overflow:hidden">'
          f'{header()}'
          '<div style="display:flex;flex:1;overflow:hidden;position:relative">'
            f'{sidebar_desktop()}{sidebar_mobile()}'
            f'<main style="flex:1;overflow:auto">{dashboard_home()}</main>'
          '</div>'
        '</div>'
      '</div>')

def inner_doc():
    return ("<!doctype html><html lang='de'><head><meta charset='utf-8'>"
            "<meta name='viewport' content='width=device-width,initial-scale=1'>"
            f"<style>{INNER_CSS}</style></head><body>{shell()}</body></html>")

def outer():
    src = html.escape(inner_doc(), quote=True)
    return f"""<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>built_03 · Dashboard Home — post-foundation</title>
{FONTS_TAG}
<style>
*{{box-sizing:border-box}} html,body{{margin:0;padding:0}}
body{{background:#ece3c8;font-family:'Manrope',system-ui,sans-serif;color:#0F2B1E;padding:24px 18px 80px}}
.exp-page{{max-width:1760px;margin:0 auto}}
.exp-title{{font-weight:700;font-size:22px;letter-spacing:-0.02em;margin:0 0 4px}}
.exp-sub{{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#5c6f64;margin:0 0 6px}}
.exp-note{{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:#7a5a12;margin:0 0 22px;max-width:1100px;line-height:1.6}}
.viewports{{display:flex;flex-wrap:wrap;gap:30px;align-items:flex-start}}
.viewport{{display:flex;flex-direction:column;gap:8px}}
.vp-label{{font-family:'JetBrains Mono',monospace;font-size:10.5px;letter-spacing:0.16em;text-transform:uppercase;color:#5c6f64}}
.vp-frame{{border:1px solid rgba(15,43,30,.16);border-radius:12px;box-shadow:0 24px 60px -28px rgba(15,43,30,.40);overflow:hidden;background:#F4ECD8}}
.vp-frame iframe{{border:0;display:block}}
.viewport-desktop iframe{{width:1280px;height:860px}}
.viewport-mobile  iframe{{width:390px;height:844px}}
</style></head>
<body><div class="exp-page">
<h1 class="exp-title">Screen 03 — Dashboard Home</h1>
<p class="exp-sub">app/dashboard/page.tsx + Header + Sidebar · post-foundation snapshot</p>
<p class="exp-note">Faithful render: real compiled CSS + tokens inlined, nothing fixed. NOTE: the current shell renders no bottom tab bar — mobile navigation is hamburger → left drawer (shown closed/off-screen here). Trial banner omitted (non-trial state).</p>
<div class="viewports">
  <div class="viewport viewport-desktop"><div class="vp-label">Desktop · 1280 × 860</div><div class="vp-frame"><iframe srcdoc="{src}"></iframe></div></div>
  <div class="viewport viewport-mobile"><div class="vp-label">Mobile · 390 × 844</div><div class="vp-frame"><iframe srcdoc="{src}"></iframe></div></div>
</div></div></body></html>"""

out = os.path.join(HERE, "built_03_post_foundation.html")
open(out, "w", encoding="utf-8").write(outer())
print("chunk:", chunk_name)
print("written:", out)
