# Builds static HTML snapshots of the 19 Tailwind-activation-affected screens.
# Each file: two iframes (desktop 1280x860, mobile 390x844) so Tailwind md:
# breakpoints resolve per-frame. CSS = real design-tokens.css + the compiled
# Tailwind chunk (post-activation utilities + @theme :root vars) + fonts.
# Read-only export: nothing in the app source is modified.

import os, glob, html, re

HERE = os.path.dirname(os.path.abspath(__file__))
WEB  = os.path.normpath(os.path.join(HERE, "..", "..", "apps", "web"))

tokens = open(os.path.join(WEB, "styles", "design-tokens.css"), encoding="utf-8").read()

# Find the compiled chunk that holds utilities + theme vars + globals.
chunk = None
for f in glob.glob(os.path.join(WEB, ".next", "static", "**", "*.css"), recursive=True):
    t = open(f, encoding="utf-8").read()
    if ".flex{" in t and "--color-brand-gold:" in t and "body{" in t:
        chunk = t; chunk_name = os.path.basename(f); break
assert chunk, "compiled Tailwind chunk not found — run a production build first"

FONTS = ("@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800"
         "&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600&display=swap');")

# design-tokens FIRST, compiled chunk LAST (so @theme :root values win on any name clash).
INNER_CSS = FONTS + "\n" + tokens + "\n" + chunk + "\n" + (
    "html,body{height:100%;}"
    "body{margin:0;-webkit-font-smoothing:antialiased;}"
    "*{scrollbar-width:thin;}"
)

def doc(body, bg="var(--paper)"):
    return ("<!doctype html><html lang='en'><head><meta charset='utf-8'>"
            "<meta name='viewport' content='width=device-width,initial-scale=1'>"
            f"<style>{INNER_CSS}\nbody.screen{{background:{bg};}}</style></head>"
            f"<body class='screen'>{body}</body></html>")

def page(title, sub, covers, inner_html, bg="var(--paper)"):
    src = html.escape(doc(inner_html, bg), quote=True)
    covers_li = "".join(f"<li>{html.escape(c)}</li>" for c in covers)
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>TW · {html.escape(title)}</title>
{FONTS_TAG}
<style>
*{{box-sizing:border-box}} html,body{{margin:0;padding:0}}
body{{background:#ece3c8;font-family:'Manrope',system-ui,sans-serif;color:#0F2B1E;padding:24px 18px 80px}}
.exp-page{{max-width:1760px;margin:0 auto}}
.exp-title{{font-weight:700;font-size:22px;letter-spacing:-0.02em;margin:0 0 4px;color:#0F2B1E}}
.exp-sub{{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#5c6f64;margin:0 0 6px}}
.exp-covers{{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:#5c6f64;margin:0 0 22px;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:6px 16px}}
.exp-covers li::before{{content:'▪ ';color:#B89535}}
.viewports{{display:flex;flex-wrap:wrap;gap:30px;align-items:flex-start}}
.viewport{{display:flex;flex-direction:column;gap:8px}}
.vp-label{{font-family:'JetBrains Mono',monospace;font-size:10.5px;letter-spacing:0.16em;text-transform:uppercase;color:#5c6f64}}
.vp-frame{{border:1px solid rgba(15,43,30,.16);border-radius:12px;box-shadow:0 24px 60px -28px rgba(15,43,30,.40);overflow:hidden;background:#F4ECD8}}
.vp-frame iframe{{border:0;display:block;background:var(--paper,#FBF7EC)}}
.viewport-desktop iframe{{width:1280px;height:860px}}
.viewport-mobile  iframe{{width:390px;height:844px}}
</style></head>
<body>
<div class="exp-page">
<h1 class="exp-title">{html.escape(title)}</h1>
<p class="exp-sub">{html.escape(sub)} · post-activation snapshot</p>
<ul class="exp-covers">{covers_li}</ul>
<div class="viewports">
  <div class="viewport viewport-desktop"><div class="vp-label">Desktop · 1280 × 860</div><div class="vp-frame"><iframe srcdoc="{src}"></iframe></div></div>
  <div class="viewport viewport-mobile"><div class="vp-label">Mobile · 390 × 844</div><div class="vp-frame"><iframe srcdoc="{src}"></iframe></div></div>
</div>
</div>
</body></html>"""

FONTS_TAG = ("<link rel='preconnect' href='https://fonts.googleapis.com'>"
             "<link href='https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800"
             "&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600&display=swap' rel='stylesheet'>")

# ───────────────────────── reusable context pieces ─────────────────────────

PROJECTS = [("Goblin Landing", "#D4A737", "2h ago", True),
            ("API Gateway",    "#3D6D55", "5h ago", False),
            ("Portfolio v2",   "#A07726", "1d ago", False),
            ("Stripe Checkout","#5E8973", "3d ago", False)]

def projects_list():
    rows = ""
    for name, color, t, active in PROJECTS:
        bg = "rgba(201,147,58,0.1)" if active else "transparent"
        bd = "1px solid rgba(201,147,58,0.2)" if active else "1px solid transparent"
        nc = "var(--brand-gold)" if active else "var(--ink-2)"
        rows += (f'<button class="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left" '
                 f'style="background:{bg};border:{bd}">'
                 f'<span style="width:10px;height:10px;border-radius:50%;background:{color};flex-shrink:0;display:inline-block"></span>'
                 f'<div class="flex-1 min-w-0">'
                 f'<div class="text-xs font-medium truncate" style="color:{nc};font-family:var(--font-sans)">{name}</div>'
                 f'<div class="text-[10px]" style="color:var(--ink-3);font-family:var(--font-sans)">{t}</div>'
                 f'</div></button>')
    return (
      '<div class="flex-1 flex flex-col overflow-hidden">'
        '<div class="p-3">'
          '<button class="w-full flex items-center justify-center gap-2 h-8 rounded-lg text-sm font-medium text-white" '
          'style="background:var(--brand-green);font-family:var(--font-sans)">＋ New Project</button>'
        '</div>'
        '<div class="px-3 pb-1"><span class="text-[10px] font-medium uppercase tracking-widest" '
        'style="color:var(--ink-3);font-family:var(--font-sans)">Projects</span></div>'
        f'<div class="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">{rows}</div>'
      '</div>')

def build_status(building=True):
    if building:
        body = ('<div class="space-y-2">'
                  '<div class="flex items-center gap-2">'
                    '<span style="width:16px;height:16px;border-radius:5px;background:var(--brand-gold);display:inline-block;flex-shrink:0"></span>'
                    '<span class="text-xs truncate" style="color:var(--ink-2);font-family:var(--font-jetbrains-mono),monospace">Generating app/page.tsx</span>'
                  '</div>'
                  '<div class="h-1 rounded-full" style="background:var(--rule-soft)">'
                    '<div class="h-full rounded-full transition-all duration-300" style="width:64%;background:var(--brand-gold)"></div>'
                  '</div>'
                '</div>')
    else:
        body = '<span class="text-xs" style="color:var(--ink-3);font-family:var(--font-sans)">No active builds</span>'
    return (f'<div class="px-3 py-3 border-t" style="border-color:var(--rule-soft)">'
            f'<span class="text-[10px] font-medium uppercase tracking-widest mb-2 block" '
            f'style="color:var(--ink-3);font-family:var(--font-sans)">Build</span>{body}</div>')

def sidebar(building=True):
    return ('<aside style="width:248px;flex-shrink:0;display:flex;flex-direction:column;'
            'background:var(--surface-1);border-right:1px solid var(--rule-soft)">'
              '<div style="padding:14px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--rule-soft)">'
                '<div style="width:30px;height:30px;border-radius:8px;background:var(--brand-green);display:flex;'
                'align-items:center;justify-content:center;color:#fff;font-weight:700">G</div>'
                '<span style="font-weight:700;color:var(--ink-1)">Goblin</span>'
              '</div>'
              f'{projects_list()}{build_status(building)}'
            '</aside>')

def app_shell(main_inner, building=True):
    return (f'<div style="display:flex;height:100%;background:var(--surface-1)">'
            f'{sidebar(building)}'
            f'<main style="flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden">{main_inner}</main>'
            f'</div>')

def settings_shell(active, main_inner):
    nav = [("Profile","profile"),("Billing","billing"),("API Keys","keys"),
           ("Integrations","integrations"),("Notifications","notifications")]
    items = ""
    for label, key in nav:
        on = key == active
        items += (f'<div style="padding:8px 12px;border-radius:8px;font-size:13px;font-weight:{600 if on else 500};'
                  f'color:{"var(--brand-green)" if on else "var(--ink-3)"};'
                  f'background:{"var(--surface-2)" if on else "transparent"};margin-bottom:2px">{label}</div>')
    return (f'<div style="display:flex;height:100%;background:var(--surface-1)">'
            f'<aside style="width:220px;flex-shrink:0;padding:20px 12px;border-right:1px solid var(--rule-soft)">'
            f'<div style="font-weight:700;color:var(--ink-1);margin:0 12px 16px">Settings</div>{items}</aside>'
            f'<main style="flex:1;min-width:0;overflow-y:auto;padding:36px 40px">{main_inner}</main></div>')

# ───────────────────────── screens ─────────────────────────

def legal_inner():
    secs = [("1. Acceptance","By accessing or using Goblin, you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use our service."),
            ("2. Usage Rights","Goblin grants you a personal, non-exclusive, non-transferable license to use the service for your own projects. You retain all rights to the code you create."),
            ("3. User Responsibilities","You are responsible for your account security. You agree not to use Goblin for illegal purposes, spam, or malicious activities."),
            ("4. Payments & Cancellation","Subscriptions are billed monthly. You may cancel at any time. Cancellations take effect at the end of your current billing period. No partial refunds."),
            ("5. Limitation of Liability","Goblin is provided \"as is\". We are not liable for any damages arising from your use of the service."),
            ("6. Changes","We reserve the right to modify these terms at any time. We will notify users of significant changes via email.")]
    s = "".join(f'<section class="mb-8"><h2 class="text-xl font-semibold mb-4" style="color:var(--ink-1)">{t}</h2>'
                f'<p class="mb-3" style="color:var(--ink-3)">{b}</p></section>' for t,b in secs)
    return ('<main class="max-w-3xl mx-auto py-16 px-4">'
            '<nav class="mb-8"><a class="text-sm" style="color:var(--brand-green);text-decoration:none">← Back</a></nav>'
            '<h1 class="text-3xl font-bold mb-8" style="color:var(--brand-green)">Terms of Service</h1>'
            f'{s}<p class="text-sm" style="color:var(--ink-3)">Last updated: April 2026</p></main>')

def usage_display():
    return ('<div class="mb-8">'
            '<div class="flex justify-between mb-2">'
              '<div class="text-sm" style="color:var(--ink-1)"><span class="font-semibold">142</span> / 200 requests used this month</div>'
              '<div class="text-sm" style="color:var(--ink-3)">Resets on Jun 25</div>'
            '</div>'
            '<div class="h-3 rounded-full overflow-hidden" style="background:var(--surface-3)">'
              '<div class="h-full transition-all duration-500 rounded-full" style="width:71%;background:var(--brand-green)"></div>'
            '</div></div>')

PLANS = [("Build",9,["200 monthly requests","10 projects","BYOK — all AI providers","5 GB cloud storage","GitHub push integration","Community support"]),
         ("Pro",19,["800 monthly requests","50 projects","BYOK — all AI providers","20 GB cloud storage","GitHub push integration","Priority support"]),
         ("Power",39,["3,000 monthly requests","Unlimited projects","BYOK — all AI providers","100 GB cloud storage","GitHub push integration","Priority support","Beta features access"])]

def pricing_cards(current="Build"):
    cards = ""
    for name, price, feats in PLANS:
        is_current = name == current
        badge = ('<div class="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-semibold text-white" '
                 'style="background:var(--brand-gold);font-family:var(--font-sans)">Current Plan</div>') if is_current else ""
        lis = "".join('<li class="flex items-start gap-2.5">'
                      '<span class="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5" style="background:var(--brand-green)">'
                      '<span style="color:#fff;font-size:9px;line-height:1">✓</span></span>'
                      f'<span class="text-sm" style="color:var(--ink-1);font-family:var(--font-sans)">{f}</span></li>' for f in feats)
        if is_current:
            btn = ('<button disabled class="w-full py-3 rounded-xl text-sm font-medium opacity-50 border" '
                   'style="border-color:var(--rule-soft);color:var(--ink-3);font-family:var(--font-sans)">Current Plan</button>')
        else:
            btn = ('<button class="w-full py-3 rounded-xl text-sm font-medium transition-colors" '
                   'style="background:transparent;color:var(--brand-green);border:1px solid var(--brand-green);font-family:var(--font-sans)">Upgrade</button>')
        cards += (f'<div class="relative rounded-2xl p-6 flex flex-col" style="border:1px solid var(--rule-soft);background:#fff">'
                  f'{badge}'
                  f'<h3 class="font-display font-bold text-xl mb-1" style="color:var(--ink-2)">{name}</h3>'
                  f'<div class="mb-5"><span class="font-display font-bold text-4xl" style="color:var(--ink-2)">${price}</span>'
                  f'<span class="text-sm ml-1" style="color:var(--ink-3);font-family:var(--font-sans)">/month</span></div>'
                  f'<ul class="space-y-2.5 mb-8 flex-1">{lis}</ul>{btn}</div>')
    return f'<div class="grid grid-cols-1 md:grid-cols-3 gap-6">{cards}</div>'

def billing_inner():
    return ('<div class="max-w-4xl">'
            '<h1 style="font-family:var(--font-sans);font-size:22px;font-weight:700;color:var(--brand-green);margin-bottom:6px;letter-spacing:-0.3px">Billing &amp; Plan</h1>'
            '<p style="font-size:13px;color:var(--meta);margin-bottom:28px;font-family:var(--font-sans)">Manage your subscription, usage, and payment methods.</p>'
            f'{usage_display()}'
            '<div class="mb-8 p-4 rounded-lg flex items-center justify-between" style="background:var(--surface-3)">'
              '<div style="color:var(--ink-1)"><span class="font-medium">Subscribed</span> to Build plan</div>'
              '<button class="px-4 py-2 rounded-lg text-sm font-medium" style="background:var(--ink-1);color:white">Manage Subscription</button>'
            '</div>'
            f'{pricing_cards("Build")}</div>')

def billing_success_inner():
    return ('<div class="min-h-[60vh] flex items-center justify-center" style="min-height:100%">'
            '<div class="text-center max-w-md">'
              '<div class="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style="background:rgba(74,124,59,0.1)">'
                '<span style="color:var(--success);font-size:38px;line-height:1">✓</span></div>'
              '<h1 class="text-2xl font-semibold mb-3" style="color:var(--ink-1)">Subscription activated!</h1>'
              '<p class="mb-6" style="color:var(--ink-3)">Your goblin just got stronger. Redirecting you back to billing settings…</p>'
            '</div></div>')

def integrations_inner():
    connected = ('<div class="flex items-center gap-3">'
                 '<span class="text-sm" style="color:var(--brand-green)">✓ Connected as @octocat</span>'
                 '<button class="px-4 py-2 rounded-lg text-sm font-medium" style="background:var(--surface-3);color:var(--danger)">Disconnect</button>'
                 '</div>')
    not_conn = ('<button class="px-4 py-2 rounded-lg text-sm font-medium text-white" style="background:var(--ink-1)">Connect GitHub</button>')
    def card(title, desc, ctrl):
        return (f'<div style="background:#fff;border:1px solid var(--rule-soft);border-radius:14px;padding:20px 22px;'
                f'display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:14px">'
                f'<div><div style="font-weight:600;color:var(--ink-1);margin-bottom:3px">{title}</div>'
                f'<div style="font-size:13px;color:var(--ink-3)">{desc}</div></div><div>{ctrl}</div></div>')
    return ('<div class="max-w-4xl">'
            '<h1 style="font-family:var(--font-sans);font-size:22px;font-weight:700;color:var(--brand-green);margin-bottom:6px">Integrations</h1>'
            '<p style="font-size:13px;color:var(--meta);margin-bottom:28px">Connect external services. The GitHub control below is the activated component.</p>'
            + card("GitHub — connected state","Push generated projects straight to a repo.", connected)
            + card("GitHub — disconnected state","Same component, not-connected branch.", not_conn)
            + '</div>')

def provider_row(name, emoji, connected, last4=None, expanded=False):
    if connected:
        action = ('<button class="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors">Remove</button>')
        status = (f'<div class="w-2 h-2 rounded-full bg-green-500"></div>'
                  f'<span class="text-sm text-green-600">Connected · ···· {last4}</span>')
    else:
        action = ('<button class="px-4 py-2 text-sm font-medium text-brand-gold border border-brand-gold hover:bg-brand-gold/5 rounded-lg transition-colors">Connect</button>')
        status = ('<div class="w-2 h-2 rounded-full bg-gray-300"></div>'
                  '<span class="text-sm text-gray-500">Not connected</span>')
    panel = ""
    if expanded:
        panel = (
          '<div class="border-t border-gray-200 p-4 bg-gray-50"><div class="max-w-md">'
            f'<h4 class="font-medium text-ink-1 mb-3">Paste your {name} API key</h4>'
            '<div class="mb-4"><div class="relative">'
              '<input type="password" value="sk-ant-xxxxxxxxxxxxxxxxxxxx" '
              'class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold/20 focus:border-brand-gold pr-24" />'
              '<button type="button" class="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-600 hover:text-gray-800">Show</button>'
            '</div>'
            '<div class="mt-2 flex items-center justify-between">'
              '<a class="text-sm text-brand-gold hover:text-brand-gold/80 flex items-center" style="text-decoration:none">Get your key →</a>'
              '<span class="text-xs text-gray-500">28/100</span></div></div>'
            '<div class="flex space-x-3">'
              '<button class="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors flex-1">Cancel</button>'
              '<button class="px-4 py-2 text-sm font-medium text-white bg-brand-gold hover:bg-brand-gold/90 rounded-lg transition-colors flex-1">Save key</button>'
            '</div>'
            '<div class="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">'
              f'<p class="text-xs text-blue-700">Your API key is encrypted with AES-256-GCM before storage. We\'ll validate it with a test request to {name}.</p></div>'
          '</div></div>')
    return ('<div class="bg-white rounded-xl border border-gray-200 overflow-hidden" style="margin-bottom:14px">'
            '<div class="p-4"><div class="flex items-center justify-between">'
              '<div class="flex items-center space-x-3">'
                f'<div class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xl">{emoji}</div>'
                '<div><div class="flex items-center space-x-2">'
                  f'<h3 class="font-semibold text-ink-1">{name}</h3>{status}</div>'
                  f'<p class="text-sm text-gray-600 mt-1">Bring your own {name} API key.</p></div>'
              '</div>'
              f'<div>{action}</div>'
            '</div></div>'
            f'{panel}</div>')

def provider_row_inner():
    rows = (provider_row("Anthropic","🅰️",True,"a1b2")
            + provider_row("OpenAI","🤖",False,expanded=True)   # expanded: Save-key (brand-gold) visible — the fixed regression
            + provider_row("Google","🔵",False)
            + provider_row("Groq","⚡",True,"9z8y"))
    return ('<div class="max-w-4xl" style="max-width:760px">'
            '<h1 style="font-family:var(--font-sans);font-size:22px;font-weight:700;color:var(--brand-green);margin-bottom:6px">API Keys</h1>'
            '<p style="font-size:13px;color:var(--meta);margin-bottom:28px">provider-row — the fixed regression. The expanded OpenAI row shows the <b>brand-gold</b> “Save key” button (was invisible white-on-white before the fix).</p>'
            f'{rows}</div>')

PROVIDERS4 = ["Anthropic","OpenAI","Google","Groq","Mistral","DeepSeek","xAI","Together"]
def add_key_modal_overlay():
    chips = ""
    for i,p in enumerate(PROVIDERS4):
        sel = i == 0
        chips += (f'<button type="button" class="py-1.5 px-2 rounded-lg text-xs font-medium transition-colors" '
                  f'style="background:{"rgba(45,74,43,0.1)" if sel else "var(--surface-3)"};'
                  f'color:{"var(--brand-green)" if sel else "var(--ink-3)"};'
                  f'border:{"1px solid rgba(45,74,43,0.3)" if sel else "1px solid transparent"}">{p}</button>')
    return (
      '<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">'
        '<div class="bg-white rounded-xl shadow-2xl max-w-md w-full m-4">'
          '<div class="p-5 border-b flex items-center justify-between" style="border-color:var(--surface-3)">'
            '<h2 class="text-lg font-semibold" style="color:var(--ink-1)">Connect Anthropic</h2>'
            '<button class="p-1 rounded hover:bg-gray-100" style="color:var(--ink-3)">✕</button></div>'
          '<form class="p-5 space-y-4">'
            '<div><label class="block text-sm font-medium mb-2" style="color:var(--ink-1)">Provider</label>'
            f'<div class="grid grid-cols-4 gap-1.5">{chips}</div></div>'
            '<div><label class="block text-sm font-medium mb-2" style="color:var(--ink-1)">Label</label>'
            '<input type="text" value="My Anthropic key" class="w-full px-3 py-2 rounded-lg border" style="border-color:var(--surface-3)" /></div>'
            '<div><label class="block text-sm font-medium mb-2" style="color:var(--ink-1)">API Key</label>'
              '<div class="relative"><input type="password" value="sk-ant-xxxxxxxxxxxx" '
              'class="w-full px-3 py-2 pr-10 rounded-lg border font-mono text-sm" style="border-color:var(--surface-3)" />'
              '<button type="button" class="absolute right-3 top-1/2 -translate-y-1/2" style="color:var(--ink-3)">👁</button></div>'
              '<div class="flex items-start gap-2 mt-3 text-xs" style="color:var(--ink-3)">'
                '<span class="shrink-0 mt-0.5" style="color:var(--danger)">⚠</span>'
                '<p>Your key is encrypted at rest. It\'s used only to call anthropic\'s API on your behalf. Never share this key publicly.</p></div>'
              '<div class="mt-2 text-xs"><span style="color:var(--ink-3)">Don\'t have a key? Get one at </span>'
              '<a class="inline-flex items-center gap-1 font-medium hover:underline" style="color:var(--brand-green);text-decoration:none">Anthropic Console ↗</a></div>'
            '</div>'
            '<div class="flex gap-2 pt-2">'
              '<button type="button" class="flex-1 py-3 rounded-lg font-medium" style="border:1px solid var(--surface-3);color:var(--ink-1)">Cancel</button>'
              '<button type="submit" class="flex-1 py-3 rounded-lg flex items-center justify-center gap-2 font-medium" style="background:var(--brand-gold);color:var(--ink-2);font-weight:600">Connect →</button>'
            '</div>'
          '</form></div></div>')

def add_key_inner():
    # settings keys page behind the modal
    base = ('<div class="max-w-4xl" style="max-width:760px;filter:saturate(.96)">'
            '<h1 style="font-family:var(--font-sans);font-size:22px;font-weight:700;color:var(--brand-green);margin-bottom:6px">API Keys</h1>'
            '<p style="font-size:13px;color:var(--meta);margin-bottom:28px">add-key-modal open over the keys page.</p>'
            + provider_row("Anthropic","🅰️",False)
            + provider_row("OpenAI","🤖",True,"c3d4")
            + '</div>')
    return settings_shell("keys", base) + add_key_modal_overlay()

def code_block():
    return ('<div style="margin:10px 0;border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);box-shadow:0 2px 8px rgba(0,0,0,0.15)">'
            '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:var(--code-bg)">'
              '<span style="font-size:11px;font-weight:600;color:var(--code-fg);font-family:JetBrains Mono,monospace;letter-spacing:0.05em;opacity:.8">tsx</span>'
              '<span style="font-size:11px;color:rgba(255,255,255,0.45)">Copy</span></div>'
            '<div style="overflow-x:auto;background:var(--code-root);color:#cdd6c4;font-family:JetBrains Mono,monospace;font-size:13px;line-height:1.6;padding:12px 14px;white-space:pre">'
            'export function Toggle() {\n  const [on, setOn] = useState(false);\n  return &lt;button onClick={() =&gt; setOn(!on)}&gt;{on ? \"🌙\" : \"☀️\"}&lt;/button&gt;;\n}</div>'
            '<div style="background:var(--code-root-2);padding:6px 10px;display:flex;justify-content:flex-end">'
              '<span style="padding:5px 12px;border-radius:6px;font-size:11px;font-weight:600;background:var(--brand-gold);color:#1a1000">↗ Send to Code</span></div>'
            '</div>')

def assistant_row(with_code=False, with_generate=False):
    content = ('<p class="text-sm leading-relaxed mb-3 last:mb-0" style="color:var(--ink-1)">'
               'Sure — here\'s a dark-mode toggle. It uses <code class="px-1.5 py-0.5 rounded text-sm" '
               'style="background:rgba(212,169,74,0.15)">useState</code> for local state.</p>')
    if with_code:
        content += code_block()
    if with_generate:
        content += ('<button class="mt-3 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2" '
                    'style="background:var(--brand-gold);color:white">🔨 Generate Project</button>')
    return ('<div style="display:flex;gap:12px;margin-bottom:16px;justify-content:flex-start">'
              '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex-shrink:0">'
                '<div style="width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--brand-green)">'
                '<span style="font-size:14px;font-weight:700;color:#fff">G</span></div>'
                '<span style="font-size:9px;color:#6b6560;white-space:nowrap;max-width:64px;overflow:hidden;text-overflow:ellipsis">via claude-3 · BYOK</span></div>'
              f'<div style="max-width:85%;padding:12px 16px;border-radius:16px 16px 16px 4px;background:var(--white);border:1px solid var(--rule-soft);color:var(--text);font-size:14px;line-height:1.5">{content}</div>'
            '</div>')

def user_row(text):
    return ('<div style="display:flex;gap:12px;margin-bottom:16px;justify-content:flex-end">'
              f'<div style="max-width:75%;padding:12px 16px;border-radius:16px 16px 4px 16px;background:var(--brand-green);color:rgba(255,255,255,0.92);font-size:14px;line-height:1.5">{text}</div>'
              '<div style="width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--brand-gold);flex-shrink:0">'
              '<span style="font-size:14px;font-weight:700;color:#fff">U</span></div>'
            '</div>')

def chat_input(value="Add a dark mode toggle"):
    return ('<div class="mt-4">'
              '<div class="relative rounded-xl border shadow-sm" style="background:white;border-color:var(--surface-3)">'
                f'<textarea class="w-full px-12 py-3 bg-transparent resize-none focus:outline-none text-base" style="color:var(--ink-1);min-height:56px">{value}</textarea>'
                '<button class="absolute left-2 bottom-2 w-10 h-10 rounded-lg flex items-center justify-center" style="color:var(--ink-3);background:none;border:none">🎤</button>'
                '<button class="absolute right-2 bottom-2 w-10 h-10 rounded-lg flex items-center justify-center" style="background:var(--brand-green);border:none;color:#fff">➤</button>'
              '</div>'
              '<p class="text-xs text-center mt-2" style="color:var(--ink-3)">Enter to send · Shift+Enter for new line</p>'
            '</div>')

def chat_header():
    return ('<div style="padding:14px 24px;border-bottom:1px solid var(--rule-soft);display:flex;align-items:center;justify-content:space-between">'
            '<div style="font-weight:600;color:var(--ink-1)">Goblin Landing</div>'
            '<div style="font-size:12px;color:var(--ink-3);font-family:var(--font-sans)">Chat</div></div>')

def chat_main(messages_html, toast=""):
    return (f'{chat_header()}'
            '<div style="flex:1;display:flex;flex-direction:column;overflow:hidden;padding:18px 24px 16px;position:relative">'
              f'<div class="flex-1 overflow-y-auto space-y-4 pb-6">{messages_html}</div>'
              f'{chat_input()}{toast}'
            '</div>')

def chat_input_inner():
    msgs = assistant_row() + user_row("Build me a landing page with a pricing section")
    return app_shell(chat_main(msgs))

def generation_progress_toast():
    return ('<div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-96 rounded-xl shadow-xl border p-4" style="background:white;border-color:var(--surface-3)">'
              '<div class="flex items-center gap-3 mb-3">'
                '<span style="width:20px;height:20px;display:inline-block;color:var(--brand-green)">◴</span>'
                '<span class="font-medium" style="color:var(--ink-1)">Generating app/components/Hero.tsx</span></div>'
              '<div class="h-2 rounded-full overflow-hidden" style="background:var(--surface-3)">'
                '<div class="h-full rounded-full transition-all duration-300" style="width:48%;background:var(--brand-green)"></div></div>'
            '</div>')

def chat_messages_inner():
    msgs = (user_row("Build me a dark mode toggle component")
            + assistant_row(with_code=True)
            + user_row("Now generate the whole project")
            + assistant_row(with_generate=True))
    # toast is fixed → fills the iframe viewport (the frame)
    return app_shell(chat_main(msgs, toast=generation_progress_toast()))

def project_main(modal=""):
    tree = ('<div style="width:240px;flex-shrink:0;border-right:1px solid var(--rule-soft);background:var(--surface-1);padding:12px;font-size:13px;color:var(--ink-2)">'
            '<div style="font-weight:600;margin-bottom:8px;color:var(--ink-1)">Files</div>'
            '<div style="padding:4px 6px">📁 app/</div>'
            '<div style="padding:4px 6px 4px 20px;color:var(--brand-gold)">📄 page.tsx</div>'
            '<div style="padding:4px 6px 4px 20px">📄 layout.tsx</div>'
            '<div style="padding:4px 6px">📁 components/</div>'
            '<div style="padding:4px 6px 4px 20px">📄 Hero.tsx</div></div>')
    toolbar = ('<div style="padding:12px 18px;border-bottom:1px solid var(--rule-soft);display:flex;align-items:center;justify-content:space-between">'
               '<div style="font-weight:600;color:var(--ink-1)">Goblin Landing</div>'
               '<div style="display:flex;gap:10px;align-items:center">'
                 '<button class="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2" style="background:var(--ink-1);color:white">⎇ Push to GitHub</button>'
               '</div></div>')
    editor = ('<div style="flex:1;background:var(--code-root);color:#cdd6c4;font-family:JetBrains Mono,monospace;font-size:13px;line-height:1.7;padding:18px;white-space:pre;overflow:auto">'
              'export default function Page() {\n  return (\n    &lt;main&gt;\n      &lt;Hero /&gt;\n      &lt;Pricing /&gt;\n    &lt;/main&gt;\n  );\n}</div>')
    return (f'<div style="display:flex;flex-direction:column;height:100%;position:relative">{toolbar}'
            f'<div style="flex:1;display:flex;overflow:hidden">{tree}{editor}</div>{modal}</div>')

def file_viewer_modal_overlay():
    return (
      '<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60">'
        '<div class="bg-white rounded-xl shadow-2xl max-w-4xl w-full m-4 max-h-[80vh] flex flex-col">'
          '<div class="p-4 border-b flex items-center justify-between" style="border-color:var(--surface-3)">'
            '<span class="font-medium" style="color:var(--ink-1)">app/components/Hero.tsx</span>'
            '<div class="flex items-center gap-2">'
              '<button class="p-2 rounded hover:bg-gray-100 flex items-center gap-1 text-sm" style="color:var(--ink-3)">⧉ Copy</button>'
              '<button class="p-2 rounded hover:bg-gray-100" style="color:var(--ink-3)">✕</button></div></div>'
          '<div class="flex-1 overflow-auto" style="background:var(--code-root);color:#cdd6c4;font-family:JetBrains Mono,monospace;font-size:13px;line-height:1.7;padding:18px;white-space:pre">'
          'export function Hero() {\n  return (\n    &lt;section className=\"hero\"&gt;\n      &lt;h1&gt;Build anywhere&lt;/h1&gt;\n      &lt;p&gt;Ship from any device.&lt;/p&gt;\n    &lt;/section&gt;\n  );\n}</div>'
        '</div></div>')

def file_viewer_inner():
    return app_shell(project_main(modal=file_viewer_modal_overlay()))

def push_github_inner():
    # project context; show enabled + disabled variants in the toolbar area
    extra = ('<div style="padding:16px 18px;display:flex;gap:12px;align-items:center;border-bottom:1px solid var(--rule-soft);background:var(--surface-1)">'
             '<span style="font-size:12px;color:var(--ink-3)">push-to-github-button states:</span>'
             '<button class="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2" style="background:var(--ink-1);color:white">⎇ Push to GitHub</button>'
             '<button class="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2" style="background:var(--ink-1);color:white;opacity:.5">⎇ Connect GitHub first</button>'
             '</div>')
    inner = project_main()
    inner = inner.replace('<div style="flex:1;display:flex;overflow:hidden">', extra + '<div style="flex:1;display:flex;overflow:hidden">', 1)
    return app_shell(inner)

def sidebar_inner():
    main = ('<div style="flex:1;padding:40px;display:flex;flex-direction:column;gap:14px">'
            '<div style="font-family:var(--font-sans);font-size:24px;font-weight:700;color:var(--brand-green)">Dashboard</div>'
            '<div style="font-size:13px;color:var(--ink-3)">app-shell sidebar — projects-list (top) + build-status (bottom, building state) are the activated components.</div>'
            '<div style="margin-top:8px;height:120px;border:1px dashed var(--rule);border-radius:12px;display:flex;align-items:center;justify-content:center;color:var(--ink-4)">main content</div></div>')
    return app_shell(main, building=True)

# ───────────────────────── write files ─────────────────────────

SCREENS = [
 ("tw_legal.html","Legal pages","(legal)/terms · privacy · imprint",
   ["app/(legal)/terms/page.tsx","app/(legal)/privacy/page.tsx","app/(legal)/imprint/page.tsx (shared pattern)"],
   legal_inner(), "var(--paper)"),
 ("tw_billing.html","Billing & Plan","dashboard/settings/billing",
   ["app/dashboard/settings/billing/page.tsx","components/billing/usage-display.tsx","components/billing/pricing-cards.tsx"],
   settings_shell("billing", billing_inner()), "var(--surface-1)"),
 ("tw_billing_success.html","Subscription activated","dashboard/settings/billing/success",
   ["app/dashboard/settings/billing/success/page.tsx"],
   app_shell(f'<div style="flex:1;overflow:auto">{billing_success_inner()}</div>'), "var(--surface-1)"),
 ("tw_integrations.html","Integrations · GitHub connect","dashboard/settings/integrations",
   ["app/dashboard/settings/integrations/github-connect-button.tsx"],
   settings_shell("integrations", integrations_inner()), "var(--surface-1)"),
 ("tw_provider_row.html","API Keys · provider-row (fixed regression)","dashboard/settings/keys",
   ["components/settings/provider-row.tsx"],
   settings_shell("keys", provider_row_inner()), "var(--surface-1)"),
 ("tw_add_key_modal.html","Add API key modal","dashboard/settings/keys",
   ["components/settings/add-key-modal.tsx"],
   add_key_inner(), "var(--surface-1)"),
 ("tw_sidebar.html","App-shell sidebar","projects-list + build-status",
   ["components/app-shell/projects-list.tsx","components/app-shell/build-status.tsx"],
   sidebar_inner(), "var(--surface-1)"),
 ("tw_chat_input.html","Chat · input bar","dashboard/project chat",
   ["components/chat/chat-input.tsx"],
   chat_input_inner(), "var(--surface-1)"),
 ("tw_chat_messages.html","Chat · messages + progress","dashboard/project chat",
   ["components/chat/message-list.tsx","components/chat/message-content.tsx","components/chat/generate-button.tsx","components/chat/generation-progress.tsx"],
   chat_messages_inner(), "var(--surface-1)"),
 ("tw_file_viewer_modal.html","Project · file viewer modal","dashboard/project",
   ["components/project/file-viewer-modal.tsx"],
   file_viewer_inner(), "var(--surface-1)"),
 ("tw_push_github_button.html","Project · push to GitHub button","dashboard/project",
   ["components/project/push-to-github-button.tsx"],
   push_github_inner(), "var(--surface-1)"),
]

written = []
for fname, title, sub, covers, inner, bg in SCREENS:
    out = os.path.join(HERE, fname)
    open(out, "w", encoding="utf-8").write(page(title, sub, covers, inner, bg))
    written.append(out)

print("compiled chunk used:", chunk_name)
print("files written:", len(written))
for w in written: print(" ", w)
