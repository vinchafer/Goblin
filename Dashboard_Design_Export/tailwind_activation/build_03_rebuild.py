# Builds built_03_rebuild.html — dashboard home after the SCREEN_03 rebuild
# (unified --t-* type scale, decluttered header, mobile bottom tab bar,
# LocalCloudSwitch relocated into the account menu, send button per §A5.1).
# Two iframes (desktop 1280x860, mobile 390x844). Real design-tokens.css +
# dashboard-tokens.css + compiled Tailwind chunk inlined. Read-only export.

import os, glob, html

HERE = os.path.dirname(os.path.abspath(__file__))
WEB  = os.path.normpath(os.path.join(HERE, "..", "..", "apps", "web"))

design = open(os.path.join(WEB, "styles", "design-tokens.css"), encoding="utf-8").read()
dash   = open(os.path.join(WEB, "styles", "dashboard-tokens.css"), encoding="utf-8").read()

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
INNER_CSS = FONTS + "\n" + design + "\n" + dash + "\n" + chunk + "\nhtml,body{height:100%;margin:0}*{-webkit-font-smoothing:antialiased}"

DISPLAY, INIT, EMAIL, PLAN = "Vincent", "V", "vinc.hafner@gmail.com", "Build"
PROJECTS = [
    ("Goblin Landing", "var(--gold)", "active",  "goblin-landing", "Landingpage mit Stripe-Bezahlung.", "2h"),
    ("API Gateway",    "#6db97b",     "live",    "api-gateway",    "Hono API mit BYOK-Routing.",        "5h"),
    ("Portfolio v2",   "#7A4A8A",     "draft",   None,             "Persönliches Portfolio, Dark Mode.", "1d"),
    ("Stripe Checkout","#3A6B8A",     "active",  "stripe-checkout","Checkout-Flow + Webhooks.",         "3d"),
]
STATUS = {"active":("AKTIV","var(--gold)"),"live":("LIVE","#6db97b"),"draft":("DRAFT","#7A4A8A")}
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
                 f'background:{bg};color:{col};font-weight:{600 if active else 500};font-size:var(--t-small-fs);'
                 f'font-family:var(--font-dash-display),Manrope,sans-serif;border:none;'
                 f'box-shadow:{"0 1px 2px rgba(0,0,0,0.18)" if active else "none"};opacity:{0.5 if disabled else 1};min-height:30px">'
                 f'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{icon}</svg>'
                 f'<span class="goblin-tab-label">{label}</span></button>')
    return (
      '<header class="goblin-header" style="background:var(--brand-header);display:flex;align-items:center;padding:0 12px;gap:8px;'
      'flex-shrink:0;border-bottom:1px solid rgba(247,247,236,0.10);position:relative;z-index:50">'
        '<button class="goblin-hamburger" aria-label="Open menu" style="background:none;border:none;color:rgba(255,255,255,0.85);'
        'cursor:pointer;padding:0;border-radius:6px;width:40px;height:40px;display:none;align-items:center;justify-content:center;flex-shrink:0">'
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">'
          '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>'
        '<button style="font-family:var(--font-dash-display),Manrope,sans-serif;font-size:var(--t-h3-fs);color:var(--gold);font-weight:700;'
        'letter-spacing:-0.5px;background:none;border:none;cursor:pointer;padding:6px 4px;flex-shrink:0">Goblin<span style="opacity:.6">.</span></button>'
        '<div style="flex:1;min-width:8px"></div>'
        f'<div class="goblin-tab-pills" role="tablist" style="display:flex;gap:2px;padding:3px;background:rgba(0,0,0,0.18);border-radius:10px;flex-shrink:0">{tabs}</div>'
        '<div style="position:relative;flex-shrink:0"><button aria-label="Create new" style="width:36px;height:36px;border-radius:50%;'
        'background:transparent;color:rgba(255,255,255,0.9);border:1px solid rgba(255,255,255,0.35);cursor:pointer;'
        'display:flex;align-items:center;justify-content:center">'
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">'
          '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button></div>'
        # NOTE: LocalCloudSwitch removed from header (relocated to account menu, §TASK 2).
        f'<button aria-label="Konto-Menü" style="width:32px;height:32px;border-radius:50%;background:var(--gold-700);color:#2a1f0f;'
        f'border:none;font-size:var(--t-small-fs);font-weight:700;font-family:var(--font-dash-display),Manrope,sans-serif;cursor:pointer;flex-shrink:0">{INIT}</button>'
      '</header>')

def account_menu():
    # Relocated LocalCloudSwitch lives here now. Rendered OPEN in the desktop
    # frame (hidden ≤768 where it would be a bottom sheet) so the placement is judgeable.
    def row(label):
        return (f'<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;cursor:pointer">'
                f'<span style="width:18px;height:18px;color:var(--ink-3)">⚙</span>'
                f'<span style="font-size:var(--t-small-fs);color:var(--text)">{label}</span></div>')
    switch = ('<div style="display:flex;align-items:center;background:rgba(0,0,0,0.25);border-radius:6px;padding:2px;border:1px solid rgba(255,255,255,0.1)">'
              '<button style="padding:3px 9px;border-radius:4px;border:none;font-size:var(--t-eyebrow-fs);font-weight:600;'
              'font-family:var(--font-dash-display),Manrope,sans-serif;letter-spacing:0.5px;background:transparent;color:rgba(255,255,255,0.3)">LOCAL</button>'
              '<button style="padding:3px 9px;border-radius:4px;border:none;font-size:var(--t-eyebrow-fs);font-weight:600;'
              'font-family:var(--font-dash-display),Manrope,sans-serif;letter-spacing:0.5px;background:rgba(212,169,74,0.2);color:var(--brand-gold)">CLOUD</button></div>')
    return (
      '<div class="goblin-acct-menu" style="position:absolute;top:64px;right:14px;width:300px;background:var(--surface-0);'
      'border:1px solid var(--rule-soft);border-radius:14px;box-shadow:0 24px 60px -28px rgba(15,43,30,.45);z-index:200;padding:14px 14px 12px">'
        '<div style="display:flex;align-items:center;gap:12px;padding:4px 4px 14px;border-bottom:1px solid var(--rule-soft);margin-bottom:10px">'
          f'<span style="width:44px;height:44px;border-radius:50%;background:var(--brand-green);color:#fff;display:flex;align-items:center;justify-content:center;font-size:var(--t-h4-fs);font-weight:600">{INIT}</span>'
          '<div style="flex:1;min-width:0">'
            f'<div style="font-size:var(--t-small-fs);font-weight:600;color:var(--text)">{DISPLAY}</div>'
            f'<div style="font-size:var(--t-caption-fs);color:var(--text-meta);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{EMAIL}</div></div>'
          f'<span style="padding:4px 10px;border-radius:12px;background:var(--subtle);font-size:var(--t-caption-fs);font-weight:600;color:var(--meta)">{PLAN}</span>'
        '</div>'
        + row("Einstellungen") + row("Plan upgraden") + row("Hilfe") +
        # the relocated Routing / Local-Cloud row
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;margin-top:6px;'
        'border-top:1px solid var(--rule-soft)">'
          '<div><div style="font-size:var(--t-small-fs);font-weight:500;color:var(--text)">Routing</div>'
          '<div style="font-size:var(--t-caption-fs);color:var(--text-meta)">Wo deine Prompts laufen</div></div>'
          f'<div style="background:var(--brand-green);border-radius:8px;padding:4px;flex-shrink:0">{switch}</div></div>'
        '<div style="margin-top:6px;border-top:1px solid var(--rule-soft);padding-top:6px">'
          '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;cursor:pointer">'
          '<span style="width:18px;height:18px;color:var(--danger)">⎋</span>'
          '<span style="font-size:var(--t-small-fs);color:var(--danger)">Abmelden</span></div></div>'
        '<div style="font-family:JetBrains Mono,monospace;font-size:var(--t-eyebrow-fs);color:var(--ink-3);text-align:center;margin-top:6px;opacity:.8">'
        'LocalCloudSwitch — relocated here (§TASK 2)</div>'
      '</div>')

def proj_rows_sidebar(small=False):
    out = ""
    nm = "var(--t-small-fs)"; ts = "var(--t-eyebrow-fs)"
    for i,(name,color,st,repo,desc,t) in enumerate(PROJECTS):
        active = i == 0
        pad = "10px 12px" if small else "7px 8px"
        mh = "min-height:44px;" if small else ""
        out += (f'<div style="display:flex;align-items:center;gap:{10 if small else 8}px;padding:{pad};border-radius:{8 if small else 7}px;margin-bottom:{2 if small else 1}px;{mh}'
                f'background:{"rgba(212,169,74,0.13)" if active else "transparent"};border:1px solid {"rgba(212,169,74,0.25)" if (active and not small) else "transparent"}">'
                f'<div style="width:{10 if small else 8}px;height:{10 if small else 8}px;border-radius:50%;background:{color};flex-shrink:0"></div>'
                f'<span style="font-size:{nm};font-weight:{600 if active else 400};color:{"var(--brand-green)" if active else "var(--text)"};'
                f'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-sans)">{name}</span>'
                f'<span style="font-size:{ts};color:var(--text-faint);flex-shrink:0">{t}</span></div>')
    return out

def recent_rows():
    return "".join(
        f'<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;margin-bottom:1px">'
        f'<span style="font-size:var(--t-small-fs);color:var(--text);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-sans)">{name}</span>'
        f'<span style="font-size:var(--t-eyebrow-fs);color:var(--text-faint);flex-shrink:0">{t}</span></div>' for name,t in RECENT)

def sidebar_usage():
    return ('<a style="display:block;text-decoration:none;margin:0 12px 8px;padding:10px 12px;border-radius:8px;'
            'background:rgba(15,43,30,0.05);border:1px solid var(--line);font-family:var(--font-dash-display),Manrope,sans-serif;color:var(--ink-1)">'
            '<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:7px">'
              '<span style="font-size:var(--t-caption-fs);font-weight:600;color:var(--ink-2)">Verbrauch</span>'
              '<span style="font-family:JetBrains Mono,monospace;font-size:var(--t-mono-fs);font-weight:600;color:var(--ink-1)">71&nbsp;%</span></div>'
            '<div style="height:4px;border-radius:2px;overflow:hidden;background:rgba(15,43,30,0.10)">'
              '<div style="height:100%;width:71%;background:var(--green,#0F2B1E)"></div></div>'
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:7px;font-size:var(--t-caption-fs);color:var(--ink-3)">'
              '<span style="text-transform:capitalize">Build</span><span>Reset in 8 Tagen</span></div></a>')

def plus_btn(sz=22):
    return (f'<button style="background:var(--brand-header);border:none;cursor:pointer;padding:0;border-radius:7px;color:var(--bone,#F4ECD8);'
            f'display:flex;align-items:center;justify-content:center;width:{sz}px;height:{sz}px;box-shadow:0 1px 2px rgba(0,0,0,0.08)">'
            f'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">'
            f'<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>')

def sec_label(txt):
    return (f'<span style="font-size:var(--t-eyebrow-fs);font-weight:600;letter-spacing:1.2px;text-transform:uppercase;'
            f'color:var(--text-faint);font-family:var(--font-dash-display),Manrope,sans-serif">{txt}</span>')

def sidebar_desktop():
    return (
      '<aside class="goblin-sidebar-desktop" style="width:260px;min-width:260px;background:var(--subtle);border-right:1px solid var(--border);'
      'display:flex;flex-direction:column;height:100%;overflow:hidden;position:relative;z-index:40;flex-shrink:0">'
        '<div style="height:60px;display:flex;align-items:center;padding:0 16px;border-bottom:1px solid var(--border);flex-shrink:0;gap:10px">'
          '<div style="font-family:var(--font-sans);font-size:var(--t-h4-fs);color:var(--brand-green);font-weight:700;letter-spacing:-0.3px">Goblin<span style="opacity:.45">.</span></div>'
          '<div style="flex:1"></div>'
          f'<div style="font-size:var(--t-caption-fs);color:#8C857A;font-family:var(--font-sans);max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{DISPLAY}</div>'
          '<button style="width:24px;height:24px;border-radius:6px;background:transparent;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer;color:#8C857A;flex-shrink:0">'
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg></button></div>'
        '<div style="flex:1;overflow-y:auto;min-height:0;padding-top:8px">'
          f'<div style="padding:4px 12px 6px 16px;display:flex;align-items:center;justify-content:space-between">{sec_label("Projekte")}{plus_btn(22)}</div>'
          f'<div style="padding:0 8px 8px">{proj_rows_sidebar(False)}</div>'
          '<div style="border-top:1px solid var(--border);padding:8px 0 0">'
            f'<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 12px 6px 16px">{sec_label("Chats")}{plus_btn(22)}</div>'
            f'<div style="padding:0 8px 8px">{recent_rows()}</div></div>'
        '</div>'
        f'{sidebar_usage()}'
        '<div style="padding:10px 12px;border-top:1px solid var(--border);flex-shrink:0">'
          '<button style="display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;border-radius:24px;background:var(--panel,#fff);'
          'border:1px solid var(--border);cursor:pointer;min-height:40px;font-family:var(--font-sans)">'
            f'<span style="width:28px;height:28px;border-radius:50%;background:var(--brand-green);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:var(--t-small-fs);flex-shrink:0">{INIT}</span>'
            f'<span style="font-size:var(--t-small-fs);font-weight:500;color:var(--text);flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{DISPLAY}</span>'
            '<span style="color:var(--text-faint);font-size:var(--t-small-fs)">⚙</span></button></div>'
      '</aside>')

def sidebar_mobile():
    return (
      '<aside class="goblin-sidebar-mobile" style="position:fixed;top:0;bottom:0;left:0;width:85vw;max-width:320px;background:var(--subtle);'
      'border-right:1px solid var(--border);display:flex;flex-direction:column;z-index:40;transform:translateX(-100%);overflow-y:auto">'
        '<div style="display:flex;align-items:center;padding:24px 20px 16px;flex-shrink:0">'
          '<div style="font-family:var(--font-sans);font-size:var(--t-h1-fs);color:var(--brand-green);font-weight:400;letter-spacing:-0.5px">Goblin</div>'
          '<div style="flex:1"></div>'
          '<button style="background:rgba(0,0,0,0.04);border:none;font-size:var(--t-h4-fs);color:#8C857A;display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:18px">×</button></div>'
        f'<div style="flex-shrink:0;padding-top:4px"><div style="padding:12px 12px 8px 20px;display:flex;align-items:center;justify-content:space-between">{sec_label("Projekte")}{plus_btn(28)}</div>'
        f'<div style="padding:0 12px 8px">{proj_rows_sidebar(True)}</div></div>'
        f'<div style="flex:1;overflow-y:auto;min-height:0"></div>{sidebar_usage()}'
      '</aside>')

def app_shell(main_inner):
    return (f'<div style="display:flex;height:100%;background:var(--surface-1)">{sidebar_desktop()}{sidebar_mobile()}'
            f'<main style="flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden">{main_inner}</main></div>')

def hero_composer():
    return (
      '<div style="padding:0;background:transparent;flex-shrink:0"><div style="position:relative">'
        '<div style="display:flex;flex-direction:column;border:1px solid var(--rule-strong);border-radius:14px;background:var(--green-800)">'
          '<textarea rows="2" placeholder="Eine Landingpage mit Stripe-Bezahlung in Next.js…" '
          'style="resize:none;border:none;background:transparent;outline:none;font-size:var(--t-body-fs);color:var(--bone);'
          'font-family:var(--font-dash-display),Manrope,sans-serif;line-height:24px;padding:12px 14px 6px;width:100%;box-sizing:border-box"></textarea>'
          '<div style="display:flex;align-items:center;padding:4px 8px 8px;gap:6px">'
            '<button style="width:28px;height:28px;border-radius:50%;border:1px solid rgba(244,236,216,.20);background:transparent;cursor:pointer;'
            'display:flex;align-items:center;justify-content:center;color:rgba(244,236,216,.72);flex-shrink:0">'
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>'
            '<button style="display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;background:none;border:1px solid rgba(244,236,216,.20);'
            'cursor:pointer;font-size:var(--t-caption-fs);font-weight:500;color:rgba(244,236,216,.72);font-family:var(--font-dash-display),Manrope,sans-serif;max-width:160px">'
              '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Gemini Flash</span>'
              '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" style="opacity:.6"><polyline points="6 9 12 15 18 9"/></svg></button>'
            '<span style="flex:1;font-size:var(--t-caption-fs);color:rgba(244,236,216,.5);font-family:var(--font-dash-display),Manrope,sans-serif;padding-left:2px">⇧↵ new line</span>'
            '<button style="width:32px;height:32px;border-radius:50%;border:none;background:transparent;display:flex;align-items:center;justify-content:center;color:rgba(244,236,216,.72)">'
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'
              '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg></button>'
            # send button — idle/empty: muted surface (§A5.1). Active would be --brand-gold / --ink-deep.
            '<button aria-label="Senden" style="width:32px;height:32px;border-radius:8px;background:rgba(244,236,216,.16);border:none;cursor:not-allowed;'
            'display:flex;align-items:center;justify-content:center;color:rgba(244,236,216,.45);flex-shrink:0">'
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg></button>'
          '</div></div></div></div>')

def quick_chips():
    chips = "".join(f'<button style="background:transparent;color:rgba(244,236,216,.62);border:1px solid rgba(244,236,216,.14);'
                    f'border-radius:999px;padding:6px 12px;font-size:var(--t-caption-fs);font-weight:500;cursor:pointer;'
                    f'font-family:var(--font-dash-display),Manrope,sans-serif">{q}</button>' for q in QUICK)
    return f'<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">{chips}</div>'

def proj_grid():
    cards = ""
    for i,(name,color,st,repo,desc,t) in enumerate(PROJECTS):
        lbl,scol = STATUS[st]
        cards += (
          f'<a class="gobl-panel" style="padding:14px;display:flex;flex-direction:column;gap:6px;min-height:92px;text-decoration:none;color:inherit">'
            f'<div style="display:flex;align-items:center;justify-content:space-between">'
              f'<span style="display:flex;align-items:center;gap:7px;font-family:JetBrains Mono,monospace;font-size:var(--t-eyebrow-fs);letter-spacing:var(--t-eyebrow-ls);color:var(--ink-3);text-transform:uppercase">'
                f'<span style="width:6px;height:6px;border-radius:50%;background:{scol}"></span>{lbl}</span>'
              f'<span style="color:var(--ink-3);font-size:var(--t-mono-fs)">→</span></div>'
            f'<h3 style="font-family:var(--font-dash-display),Manrope,sans-serif;font-weight:600;font-size:var(--t-h4-fs);letter-spacing:-0.014em;color:var(--ink-1);line-height:var(--t-h4-lh);margin:2px 0 0">{name}</h3>'
            f'<p style="font-size:var(--t-caption-fs);color:var(--ink-2);line-height:1.4;margin:0;overflow:hidden">{desc}</p>'
            f'<div style="margin-top:auto;font-family:JetBrains Mono,monospace;font-size:var(--t-eyebrow-fs);color:var(--ink-3);letter-spacing:0.06em;display:flex;justify-content:space-between;padding-top:9px;border-top:1px solid var(--line)">'
              f'<span>{(repo.split("/")[-1].upper() if repo else "PROJEKT")}</span><span>VOR {t.upper()}</span></div></a>')
    cards += ('<button style="background:transparent;border:1px dashed var(--line-strong);border-radius:var(--radius-lg);min-height:92px;'
              'display:flex;align-items:center;justify-content:center;color:var(--ink-3);font-family:var(--font-dash-display),Manrope,sans-serif;'
              'font-weight:600;font-size:var(--t-button-fs);cursor:pointer;gap:8px">+ Neues Projekt</button>')
    return f'<div class="gobl-proj-grid">{cards}</div>'

def proj_list():
    rows = ""
    for i,(name,color,st,repo,desc,t) in enumerate(PROJECTS):
        lbl,scol = STATUS[st]; last = i == len(PROJECTS)-1
        rows += (f'<a style="display:flex;align-items:center;gap:10px;padding:12px 14px;min-height:48px;'
                 f'border-bottom:{"none" if last else "1px solid var(--line)"};text-decoration:none;color:inherit">'
                 f'<span style="width:8px;height:8px;border-radius:50%;background:{scol};flex-shrink:0"></span>'
                 f'<span style="flex:1;min-width:0;font-family:var(--font-dash-display),Manrope,sans-serif;font-weight:600;font-size:var(--t-small-fs);color:var(--ink-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{name}</span>'
                 f'<span style="flex-shrink:0;font-family:JetBrains Mono,monospace;font-size:var(--t-eyebrow-fs);color:var(--ink-3);letter-spacing:0.06em">VOR {t.upper()}</span></a>')
    rows += ('<button style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:12px 14px;min-height:48px;'
             'background:transparent;border:none;border-top:1px solid var(--line);cursor:pointer;color:var(--ink-2);'
             'font-family:var(--font-dash-display),Manrope,sans-serif;font-weight:600;font-size:var(--t-small-fs)">+ Neues Projekt</button>')
    return f'<div class="gobl-proj-list gobl-panel" style="overflow:hidden">{rows}</div>'

def whats_new():
    rows = ""
    for i,(tag,tone,title,desc,date) in enumerate(UPDATES):
        last = i == len(UPDATES)-1
        tagcls = "gobl-tag gold" if tone=="gold" else ("gobl-tag warn" if tone=="warn" else "gobl-tag")
        rows += (f'<div style="padding:16px 18px;border-bottom:{"none" if last else "1px solid var(--line)"};display:flex;align-items:flex-start;gap:14px">'
                 f'<span class="{tagcls}" style="margin-top:2px;flex-shrink:0">{tag}</span>'
                 f'<div style="flex:1;min-width:0">'
                   f'<h4 style="font-family:var(--font-dash-display),Manrope,sans-serif;font-weight:600;font-size:var(--t-small-fs);color:var(--ink-1);margin:0 0 3px;letter-spacing:-0.012em">{title}</h4>'
                   f'<p style="font-size:var(--t-small-fs);color:var(--ink-2);line-height:1.5;margin:0">{desc}</p></div>'
                 f'<span style="font-family:JetBrains Mono,monospace;font-size:var(--t-eyebrow-fs);color:var(--ink-3);letter-spacing:0.08em;flex-shrink:0;margin-top:2px">{date}</span></div>')
    return (f'<section><div class="gobl-section-title"><h2>Was ist neu</h2><a href="/help">Alle Updates →</a></div>'
            f'<div class="gobl-panel" style="overflow:hidden">{rows}</div></section>')

def bottom_tab_bar():
    tabs = ""
    for tid,label,active,disabled in [("chat","Chat",True,False),("code","Code",False,True),("preview","Preview",False,True)]:
        icon = {"chat":'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
                "code":'<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
                "preview":'<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'}[tid]
        col = "var(--brand-green)" if active else "var(--meta)"
        ind = '<span style="position:absolute;top:6px;left:50%;transform:translateX(-50%);width:20px;height:2px;border-radius:1px;background:var(--brand-green)"></span>' if active else ""
        tabs += (f'<button style="flex:1;background:none;border:none;cursor:{"default" if disabled else "pointer"};display:flex;flex-direction:column;'
                 f'align-items:center;justify-content:center;gap:3px;font-size:var(--t-caption-fs);font-weight:600;font-family:var(--font-sans);'
                 f'color:{col};position:relative;min-height:56px;padding:6px 0;opacity:{0.45 if disabled else 1}">'
                 f'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{icon}</svg>'
                 f'<span style="line-height:1">{label}</span>{ind}</button>')
    return (f'<nav class="goblin-bottom-bar" style="height:56px;background:var(--white);border-top:1px solid var(--div);display:flex;z-index:50;flex-shrink:0">{tabs}</nav>')

PAGE_STYLE = ("<style>.gobl-proj-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}"
              ".gobl-proj-list{display:none}.goblin-bottom-bar{display:none}.goblin-acct-menu{display:block}"
              "@media (max-width:480px){.gobl-dash-home{padding:20px 16px 64px !important}"
              ".gobl-proj-grid{display:none}.gobl-proj-list{display:block}"
              ".gobl-hero{padding:18px 16px 16px !important}.gobl-hero-title{margin-bottom:14px !important}}"
              "@media (max-width:768px){.goblin-hamburger{display:flex !important}.goblin-tab-pills{display:none !important}"
              ".goblin-sidebar-desktop{display:none !important}.goblin-bottom-bar{display:flex !important}.goblin-acct-menu{display:none !important}}"
              "@media (min-width:769px){.goblin-sidebar-mobile{display:none !important}}</style>")

def dashboard_home():
    return (
      '<div style="height:100%;overflow-y:auto;background:var(--d-surface)">'
      f'{PAGE_STYLE}'
      '<div class="gobl-dash-home" style="max-width:1140px;margin:0 auto;padding:40px 32px 80px">'
        '<section class="gobl-hero" style="background:var(--d-surface-darkest);color:var(--bone);border-radius:var(--radius-lg);'
        'padding:28px 28px 22px;margin-bottom:36px;border:1px solid rgba(244,236,216,.12);position:relative;overflow:hidden">'
          '<div class="gobl-eyebrow" style="color:rgba(244,236,216,.62);margin-bottom:14px">'
          f'<span class="tick"></span><span style="color:var(--bone);font-weight:600">{DISPLAY.upper()}</span> Hallo</div>'
          '<h1 class="gobl-hero-title" style="font-family:var(--font-dash-display),Manrope,sans-serif;font-weight:600;'
          'font-size:var(--t-h1-fs);letter-spacing:var(--t-h1-ls);line-height:var(--t-h1-lh);color:var(--bone);margin-bottom:18px">'
          'Sag Goblin, was du <span class="gobl-serif">bauen willst.</span></h1>'
          f'{hero_composer()}{quick_chips()}'
        '</section>'
        '<section style="margin-bottom:48px">'
          '<div class="gobl-section-title" style="margin-top:0"><h2>Deine Projekte</h2><span class="label">4 AKTIV</span></div>'
          f'{proj_grid()}{proj_list()}'
        '</section>'
        f'{whats_new()}'
      '</div></div>')

def shell():
    return (
      '<div class="gobl-dash" style="height:100%">'
        '<div style="display:flex;flex-direction:column;height:100dvh;background:var(--paper);overflow:hidden;position:relative">'
          f'{header()}'
          '<div style="display:flex;flex:1;overflow:hidden;position:relative">'
            f'{sidebar_desktop()}{sidebar_mobile()}'
            f'<main style="flex:1;overflow:auto">{dashboard_home()}</main>'
          '</div>'
          f'{bottom_tab_bar()}'
          f'{account_menu()}'
        '</div>'
      '</div>')

def inner_doc():
    return ("<!doctype html><html lang='de'><head><meta charset='utf-8'>"
            "<meta name='viewport' content='width=device-width,initial-scale=1'>"
            f"<style>{INNER_CSS}</style></head><body>{shell()}</body></html>")

def outer():
    src = html.escape(inner_doc(), quote=True)
    return f"""<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>built_03_rebuild · Dashboard Home</title>
{FONTS_TAG}
<style>
*{{box-sizing:border-box}} html,body{{margin:0;padding:0}}
body{{background:#ece3c8;font-family:'Manrope',system-ui,sans-serif;color:#0F2B1E;padding:24px 18px 80px}}
.exp-page{{max-width:1760px;margin:0 auto}}
.exp-title{{font-weight:700;font-size:22px;letter-spacing:-0.02em;margin:0 0 4px}}
.exp-sub{{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#5c6f64;margin:0 0 6px}}
.exp-note{{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:#7a5a12;margin:0 0 22px;max-width:1120px;line-height:1.6}}
.viewports{{display:flex;flex-wrap:wrap;gap:30px;align-items:flex-start}}
.viewport{{display:flex;flex-direction:column;gap:8px}}
.vp-label{{font-family:'JetBrains Mono',monospace;font-size:10.5px;letter-spacing:0.16em;text-transform:uppercase;color:#5c6f64}}
.vp-frame{{border:1px solid rgba(15,43,30,.16);border-radius:12px;box-shadow:0 24px 60px -28px rgba(15,43,30,.40);overflow:hidden;background:#F4ECD8}}
.vp-frame iframe{{border:0;display:block}}
.viewport-desktop iframe{{width:1280px;height:860px}}
.viewport-mobile  iframe{{width:390px;height:844px}}
</style></head>
<body><div class="exp-page">
<h1 class="exp-title">Screen 03 — Dashboard Home (rebuild)</h1>
<p class="exp-sub">app/dashboard/page.tsx + Header + Sidebar · post-rebuild</p>
<p class="exp-note">Unified --t-* type scale · header decluttered (LocalCloudSwitch relocated to the account menu — shown open, top-right, desktop frame) · mobile shows the Chat/Code/Preview bottom tab bar and a header without the tab pills · send button idle = muted surface (active would be gold). Real tokens + compiled CSS inlined; nothing idealised.</p>
<div class="viewports">
  <div class="viewport viewport-desktop"><div class="vp-label">Desktop · 1280 × 860</div><div class="vp-frame"><iframe srcdoc="{src}"></iframe></div></div>
  <div class="viewport viewport-mobile"><div class="vp-label">Mobile · 390 × 844</div><div class="vp-frame"><iframe srcdoc="{src}"></iframe></div></div>
</div></div></body></html>"""

out = os.path.join(HERE, "built_03_rebuild.html")
open(out, "w", encoding="utf-8").write(outer())
print("chunk:", chunk_name); print("written:", out)
