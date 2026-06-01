# Sofia Audit — 2026-06-02

*Persona: Sofia, senior developer, Toronto, 10y Rails + React. Doesn't need Goblin; curious whether it's good enough to prototype side-projects without friction. Low tolerance for missing fundamentals; tests edge cases by reflex.*

## Senior-developer assessment (3 paragraphs)

The marketing is honest about scope — "Bring your own AI keys, push to GitHub, deploy to Vercel" — which I respect; it's not pretending to be a full IDE. The Code Tab is more thoughtful than I expected from a vibe-coding tool: genuine parallel sessions, a light/dark editor (CodeMirror 6, real syntax highlighting), and a deliberate two-step Save→Publish instead of auto-deploy. The new **undo/redo buttons work** — I typed, the Rückgängig button enabled, it reverted; Redo restored it; Ctrl+Z is wired too. That's a fundamental most "AI builders" skip, so points for shipping it. And there's now a **real file explorer** — tree, size/modified metadata, read-only syntax-highlighted preview, image preview, upload of arbitrary files, delete with confirm. That's a credible file surface, not a fake.

But I hit the wall every serious user will: **I can't actually generate code.** Prompting returns "Model not found in LiteLLM." So I cannot evaluate the one thing that matters most — multi-file generation quality, how it handles a 1000-line file, whether streaming survives large outputs, how it recovers from a malformed model response. The entire substance of "is this a good coding tool" is gated behind a model that isn't provisioned for my account. Everything I *can* test is the scaffolding; the actual coding engine is dark.

Where it shows its age as a prototype-grade tool: the mental model is still **single-file-centric** in the editor (the explorer is browse/preview, not an editing tree wired to the session), there's **no rename/move/folder ops** (the explorer "looks like" a real one but can't restructure a project), **no git affordances** in the UI (it claims "push to GitHub" but I see no status/branch/commit surface in the workspace), **no find/replace, no inline syntax-error diagnostics, no autocomplete**, and **no way to import an existing repo/codebase** to work on. Those are the things that decide whether I'd prototype here versus `npm create` locally.

## Edge cases I probed (and what happened)

- **Manual undo/redo:** ✅ works (button + keyboard). Solid.
- **Empty / brand-new session:** clean empty state, no crash.
- **File explorer delete:** ✅ confirm dialog → soft-delete → list refreshes. Good.
- **Upload arbitrary file (PNG):** ✅ accepted, image-previewed. Good — and it accepts non-code assets, which matters.
- **Deep folder nesting / large file (1000+ lines):** could not test — no model to generate them, and the explorer only had a single 3KB file.
- **AI generation / multi-file / streaming under load / malformed-output recovery:** ❌ blocked — "Model not found in LiteLLM."
- **Live diff during edit:** built (jsdiff + CM decorations) but unverifiable without a stream.
- **Kill-network / invalid-key error paths:** the one error I did see ("LiteLLM") is raw and developer-facing — fine for me, unusable for the target persona.

## What Sofia would tell Vincent to ship before claiming "Cloud-IDE for Vibe-Coders"
1. **A working model path, period.** I can't assess the IDE if the I can't run the I. (Same #1 as everyone.)
2. **Make the file tree editable + session-linked**, or stop calling it an explorer in a way that implies project management. Add rename/move at minimum.
3. **Surface the git story** you advertise — even a read-only "last pushed / branch" panel.
4. **Multi-file as a first-class concept** in the editor, not just the browse view.
5. Decide whether "IDE" is the claim. Right now it's an honest **"AI page-builder with a file browser"** — which is fine, but "Cloud-IDE" sets the Sofia bar, and at that bar the fundamentals (diagnostics, find/replace, import, git) aren't there yet.

## Verdict

**Good enough for prototyping side-projects?** Not yet for me — not because the craft is bad (undo/redo, the explorer, the editor, publish-on-purpose are all genuinely well-made) but because I couldn't run a single generation, and the parts I could inspect reveal a page-builder rather than an IDE. **It looks the part more than it has the substance** at the senior-dev tier — but the substance it *does* have (real undo history, real file ops, real deploy story) is above the bar for the vibe-coder audience it's actually aimed at. Fix the model, lower the "IDE" claim to match reality (or build up to it), and it's a credible prototyping tool for its real audience.
