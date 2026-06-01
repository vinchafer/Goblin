# Sofia Audit — v2 (2026-06-02)

**Re-audit after the model fix.** Persona: Sofia, senior full-stack dev, Toronto, 9 years, lives in Cursor/VS Code + a real terminal. Already-logged-in on the test account (vinc.hafner3), which has a working **Groq Llama 3.3 70B** key. This time the streaming works, so I can finally judge the *IDE claim* instead of staring at an error.

> **What changed since v1:** In v1 I couldn't run a single generation, so my whole audit was "I can't evaluate the engine." Now I can. The engine is real and the Code Tab is more serious than I expected. My v1 fundamentals-gap list, however, is almost entirely intact — working AI doesn't add git, multi-file editing, or find/replace.

---

## Senior-dev assessment (with working AI)

The Code Tab is not a toy. It's a **multi-session agent workspace**: tabs across the top ("Session 2", a second session pinned to `groq/llama-3.3-70b-versatile`, "+ Neue Session"), a left agent/transcript pane, a right CodeMirror editor showing the file with an **"Entwurf" (draft)** badge, a model picker with eight+ providers (Groq, OpenAI, Anthropic Opus 4.5, Mistral, DeepSeek V3/R1, Grok 3, Gemini), and a **Save ("Sichern") → Publish ("Veröffentlichen")** gate at the bottom. Parallel sessions on different models is a legitimately good idea and I haven't seen it packaged this cleanly elsewhere. The draft-before-save model (AI output lands as a *draft* you explicitly accept) is the right default for anyone who's been burned by an agent overwriting good code.

I asked it to build a newsletter signup page on Groq. It worked: the agent streamed a narration, then valid, well-formed HTML appeared in the editor — `<!DOCTYPE html>`, proper meta/viewport, a centered card, semantic-ish structure, inline CSS. For a one-shot prototype off a 70B model that's a fair result; it's Cursor-tier *output* for trivial scope. The latency was acceptable. I could copy, discard, or keep the draft. As a **prototyping surface for single artifacts**, this is now genuinely usable — I could throw a landing page or a component together from my phone and ship it, which is the actual pitch and it lands.

But the moment I push on it as an *IDE*, the floor shows through. It is still a **single-file, single-artifact** mental model wearing IDE chrome. There is no git surface anywhere — no branch, no status, no last-commit, no push state — despite "Push to GitHub" on the landing page. ⌘K opens a **project/chat quick-switcher**, not a developer command palette (no go-to-file, no run-command, no symbol search). The file explorer (separate `/files` route) is still browse/preview/upload/download — not wired to the editing session, no rename/move/folder ops. No find/replace, no multi-cursor exposed, no inline diagnostics, no autocomplete beyond CodeMirror defaults, no repo import. So I can *create* a thing, but I can't *restructure a codebase*, and I can't bring my existing one in.

---

## Edge cases probed

| Probe | Result |
|---|---|
| Core generation (Groq) | ✅ Works — clean valid HTML, draft state, copy/keep/discard |
| Code quality on a real prompt | ✅ Reasonable for scope; valid, semantic-ish, inline-styled |
| Multi-session / parallel models | ✅ Real — tabs, per-session model binding |
| Draft → Save → Publish gate | ✅ Present and sensible (draft-before-accept) |
| ⌘K command palette | 🟠 Exists but is **navigation only** (project/chat switcher), not a dev palette |
| Multi-file generation (HTML+CSS+JS) | ⚠️ Not verified to split into multiple files; the loop is single-file-centric (`index.html`). Treat as **unconfirmed / likely single-file** |
| Mid-stream cancellation | ⚠️ Not verified present |
| Live diff during streaming (Sprint 8 5.6) | ⚠️ Could not positively confirm the decoration rendering on this run; draft replaced editor content. Needs a targeted re-test |
| Undo/redo after AI gen (Sprint 8 5.5) | ⚠️ Buttons exist (Sprint 8); not re-exercised post-gen this run |
| Git surface | 🔴 Absent (gap persists from v1) |
| Repo import | 🔴 Absent (gap persists) |
| File explorer restructure (rename/move) | 🔴 Absent (gap persists) |

*(Honest note: I prioritized confirming the core loop now works over exhaustively re-probing every Sprint-8 feature. The ⚠️ rows are "not confirmed this run," not "confirmed broken.")*

---

## What's resolved by the model fix vs what persists

- **Resolved:** the engine. I can now actually generate, evaluate output quality, and use the draft/save/publish flow. That moves the Code Tab from "unjudgeable" to "usable prototyping surface."
- **Persists (all v1 dev-fundamentals):** no git, single-file model, no find/replace, no inline diagnostics, no autocomplete, no repo import, browse-only explorer, "command palette" that isn't one.

## The honesty issue (still the core tension)

The landing says "**cloud workshop**" (honest, Max-aligned) but the Code Tab presents as an **IDE** (tabs, editor, command palette, file tree) and the marketing says "**push to GitHub**." That invites my bar, and at my bar it's an *AI artifact builder with IDE chrome*, not a Cloud IDE. Either build the fundamentals (git read-surface, multi-file, find/replace, repo import) or stop dressing it as an IDE. You can't show me a command-palette affordance and a file tree and then not let me go-to-file or see my branch.

---

## Verdict

**Is it good enough for prototyping now that I can run code?** For **greenfield single-artifact prototyping from anywhere, including my phone — yes.** That's a real, defensible use and it works today. For **iterating on a real multi-file codebase or importing my existing repo — no, not yet**, and the gap is fundamentals, not polish.

The encouraging part: the architecture (multi-session, per-session model, draft-gate, cloud files) is a *foundation you can build the fundamentals onto*, not a dead end. If Goblin wants me, the path is clear and finite: git read-surface → multi-file in one session → find/replace + multi-cursor (CodeMirror 6 already supports both) → repo import. None of that is exotic.

**One sentence to the founder:** The engine is real and the multi-session shell is better than I expected — now decide if you're an IDE or an artifact builder, because right now you're selling the first and shipping the second.
