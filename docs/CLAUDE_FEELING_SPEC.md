# CLAUDE_FEELING_SPEC v1.0
**Goblin benchmark — what "it feels like working with Claude + Claude Code" actually consists of**
*Authored by Steven, 2026-07-01. This is the Soll. Every gap is measured against this document.*

---

## 0. How to use this document

Each item has four fields:

- **Definition** — what the behavior is, precisely.
- **Why it carries the feeling** — the psychological mechanism. This is what separates "feature exists" from "feeling exists".
- **Observable test** — what a walker must capture to evaluate it. Evidence, not opinion.
- **Anchor** — what full presence (10) and full absence (0) look like, so grading is honest.

Grading happens **after** the walk, by Steven, against captured evidence only. The walker (CC) records observations, never verdicts.

**One meta-rule up front:** the feeling is not the sum of features. It is the impression that *a single competent mind is working on your problem in front of you*. Items F1–F3 are the load-bearing core; if they fail, F4–F14 cannot compensate.

---

## F1 — One mind, one thread (single-agent continuity)

**Definition:** The entity you talk to is the entity that acts. There is no handoff to a "second brain" that lacks the conversation's context. Discussing, deciding, coding, building, and revising all happen in one continuous thread with one continuous memory of what was said.

**Why it carries the feeling:** Claude Code feels like a collaborator because you never re-explain. The moment a user must transfer context manually (tap a button, watch a second AI re-interpret the payload, possibly re-ask questions), the illusion of a mind collapses into the reality of a pipeline. This is the deepest structural difference between "chat + code tool" and "agent".

**Observable test:** After a chat discussion establishing constraints ("use localStorage, no backend, German UI labels"), trigger the code path. Capture whether the executing side honors constraints *that were never in the sent payload itself* — i.e., whether context travels or only the payload travels. Then, in a later revision, reference an earlier decision by allusion only ("wie besprochen ohne Backend") and capture the result.

**Anchor:** 10 = constraints from turn 3 of the chat silently honored by the build in turn 9, referenced correctly in a revision at turn 15. 0 = code side re-asks or violates something the chat side already settled.

---

## F2 — Visible work (the agent narrates its hands)

**Definition:** While acting, the agent shows *what it is doing right now* as discrete, truthful steps: "Reading `src/App.tsx`" → "Editing `components/Header.tsx`" → "Running build" → "Build failed, reading error" → "Fixing import". Steps appear as they happen, are collapsible, and correspond to real operations.

**Why it carries the feeling:** A progress bar says "wait". A step log says "watch me work". The user's mental model shifts from *vending machine* to *colleague at the keyboard*. This is the single highest-leverage UX element in Claude Code — and it must be truthful; fake steps ("Analyzing…", "Optimizing…") read as theater within days and destroy trust permanently.

**Observable test:** During project generation and during a revision, capture the full sequence of intermediate states between "user sends" and "result appears". Screenshot every distinct state. Note whether states name real files/operations or generic verbs.

**Anchor:** 10 = live, truthful, file-level step stream, collapsible, with per-step outcomes. 0 = spinner or static "Building…" until the result drops fully formed.

---

## F3 — Time to first sign of life

**Definition:** Within ~1–2 seconds of sending, *something honest* happens: streaming begins, or the thinking indicator appears, or the first tool step is announced. Long total durations are acceptable; dead air is not.

**Why it carries the feeling:** Perceived intelligence correlates with responsiveness of *acknowledgment*, not speed of *completion*. Claude can think for 90 seconds and feel fast because the thinking is visible from second one.

**Observable test:** Timestamped capture (screen recording or rapid screenshots) of: send → first visible change, for (a) plain chat, (b) Send to Code, (c) build trigger, (d) revision. Record TTFT and time-to-first-step for each.

**Anchor:** 10 = <2s to first honest signal in all four paths. 0 = >8s of static UI anywhere in the core loop.

---

## F4 — Plan before power (proportional deliberation)

**Definition:** For non-trivial tasks, the agent first states a short plan ("I'll do X, Y, Z — Z because of your constraint C") and then executes. For trivial tasks it just acts. The proportionality is the point: it deliberates when deliberation adds value.

**Why it carries the feeling:** A plan proves comprehension before commitment. It also gives the user a steering moment ("actually, skip Y") that makes them feel in command of the agent rather than downstream of it. Claude Code's plan mode is beloved precisely because it converts anxiety ("what will it do?") into agency.

**Observable test:** Issue one trivial request ("change the header text") and one complex request ("add user accounts with magic-link auth"). Capture whether the responses differ in deliberation structure, and whether a stated plan is then actually followed.

**Anchor:** 10 = complex task yields plan → confirmation moment or clear announcement → faithful execution; trivial task yields immediate action. 0 = both handled identically (either both blind-execute or both bureaucratically over-plan).

---

## F5 — Diffs, not dumps

**Definition:** Changes are presented as *changes*: per-file diffs or an accurate change summary ("modified 3 files: added `deleteHabit()` in `store.ts`, wired button in `HabitRow.tsx`, updated styles"). Never a silent full-file replacement the user must eyeball-compare.

**Why it carries the feeling:** Diffs are how a collaborator says "here is exactly what I touched, nothing else". They enable trust-but-verify at a glance. Full-file dumps force the user back into the reviewer-of-everything role that Goblin exists to abolish.

**Observable test:** After a revision, capture what the UI shows about *what changed*. Is there a diff view, a change list, or nothing? Can the user tell which files were touched without opening all of them?

**Anchor:** 10 = per-change diff or precise change manifest, one tap away. 0 = files silently mutate; user discovers changes by accident.

---

## F6 — Interruptible and steerable mid-flight

**Definition:** A visible stop control exists during generation and during agent runs. Stopping is graceful (partial work preserved and acknowledged, not corrupted). A follow-up message mid-run redirects the agent ("stop, use blue instead") and it incorporates the steer.

**Why it carries the feeling:** Being able to interrupt is what makes it a *conversation*. An unstoppable run is a batch job; the user is reduced to a spectator. Claude Code users press Escape constantly — it's part of the rhythm of collaboration.

**Observable test:** During a long generation, attempt to stop. Capture: does a stop control exist, what happens to partial output, can the next message reference the interrupted work. During a build/agent run, attempt the same.

**Anchor:** 10 = stop exists everywhere, partial state survives coherently, redirect works. 0 = no stop control; user waits out every run, wrong or not.

---

## F7 — Error recovery as narrative (the self-healing loop)

**Definition:** When something fails (build error, bad import, failing test), the agent *says so, shows the evidence, and tries again* — visibly: "Build failed: `Cannot find module './utils'`. The import path is wrong, fixing." → fix → re-run → "Build green." Failures are part of the story, not hidden or terminal.

**Why it carries the feeling:** Watching an agent hit an error and recover is the strongest possible proof of competence — stronger than never erring, because the user *sees judgment operating*. Conversely, a raw error dump handed to a non-technical user ("Module not found — hier ist der Stack Trace") is the exact moment "Max aus Berlin" churns.

**Observable test:** Provoke a failure (request something likely to produce a build error, or introduce one). Capture the full arc: how the failure is surfaced, in what language, whether an automatic retry loop runs, whether it resolves, and what the user had to do (target: nothing).

**Anchor:** 10 = autonomous detect → explain → fix → verify loop, narrated in human terms. 0 = raw stack trace as final answer, user must diagnose.

---

## F8 — Context continuity across sessions

**Definition:** Close the browser, come back tomorrow, open the project: the conversation is there, and the agent still *knows* — the decisions, the state, what was last built, what's unresolved. "Wo waren wir?" gets a correct answer.

**Why it carries the feeling:** Memory is the difference between a colleague and a call center. It's also Goblin's own promise — the persistent project as endowment driver — taken to its logical end: the *relationship* persists, not just the files.

**Observable test:** Full session: build something, note two specific decisions. Log out, clear session, log back in. Ask "what did we decide about X?" and "what's the current state of the project?". Capture answers verbatim.

**Anchor:** 10 = accurate recall of decisions and state, unprompted awareness of last build status. 0 = every session starts cold; history is scrollback, not memory.

---

## F9 — Grounded honesty (verify, don't assert)

**Definition:** The agent does not claim what it hasn't checked. "Done, the dark mode works" is only said after the build ran and, ideally, the result was verified. Uncertainty is stated as uncertainty. Ratings and status reports are calibrated, not flattering.

**Why it carries the feeling:** One confidently false "fertig ✅" costs more trust than ten honest "das hat noch einen Fehler". Daily Claude users can feel the difference between asserted and verified within a session. (House rule resonance: this is the product-level version of our no-false-greens principle.)

**Observable test:** After a revision, capture whether the success message appears before or after an actual build/verification ran. Ask the chat "does feature X work?" for a feature that is broken or absent; capture whether it checks or bluffs.

**Anchor:** 10 = claims are downstream of verification; "I haven't tested this" appears when true. 0 = optimistic assertions decoupled from reality.

---

## F10 — Extended thinking as a visible, chooseable mode

**Definition:** For hard problems, the user can invoke deeper reasoning ("denk länger nach") — and the deeper thinking is *visible* as such (a thinking phase, distinct from the answer), then pays off in answer quality.

**Why it carries the feeling:** Visible deliberation is intelligence made legible. It also gives the user a throttle: quick answer vs. deep answer, their call. Absence is acceptable in v1 *if* the failure mode is graceful (see F14).

**Observable test:** Ask the chat model to "think hard / think step by step about the architecture before answering". Capture what the UI does — any thinking affordance, any mode, or plain streaming.

**Anchor:** 10 = explicit extended-thinking mode with visible reasoning phase. 0 = no mode, no visible difference, and the request is silently ignored.

---

## F11 — Reach beyond the box (web research mid-task)

**Definition:** The agent can look things up — current library versions, an API's docs, a design reference — inside the flow, shows that it's searching, and cites what it found.

**Why it carries the feeling:** An agent that says "let me check the current Tailwind v4 syntax" and does so feels *alive in the world*. One that confidently emits 2024 knowledge feels like a snapshot. Known gap in Goblin today; the spec point exists so the walk documents the current failure mode precisely.

**Observable test:** Ask for something requiring current information ("use the latest stable version of X and tell me which that is"). Capture the response: search attempt, honest "I can't browse", or confident stale answer.

**Anchor:** 10 = visible search step, sourced answer. 0 = confident stale/fabricated answer with no caveat (worse than absence).

---

## F12 — Conversational register (a colleague, not a console)

**Definition:** Chat answers sound like Claude: direct, warm, proportionate. Short question → short answer. It asks *one* clarifying question when the request is genuinely ambiguous, instead of guessing big or interrogating. No wall-of-bullets for a yes/no. Errors and limits are explained in the user's language (German UI → German explanations).

**Why it carries the feeling:** Register is the most imitable and most neglected layer. Users can't name it, but they feel "this sounds like a tool" vs. "this sounds like someone". For Max aus Berlin, a German-language error explanation is the difference between annoyed and abandoned.

**Observable test:** Send: a one-line question, an ambiguous request ("mach das Design besser"), and a frustrated message ("das funktioniert schon wieder nicht"). Capture all three responses verbatim.

**Anchor:** 10 = proportionate, human, one good clarifying question on the ambiguous case, de-escalating and concrete on the frustrated case. 0 = uniform template responses regardless of input register.

---

## F13 — Autonomy arc (send one message, come back to done-with-proof)

**Definition:** A multi-step request ("add a settings page with dark mode toggle, persist the choice, and make sure the build passes") completes end-to-end from a single message: plan → edits → build → verify → report with evidence (what changed, build status, how to see it). The Island Flow *is* this item on a phone.

**Why it carries the feeling:** This is the promise: describe from the beach, return to shipped. Every additional required tap between intent and verified result is a leak in the core narrative. Note the tension with F4/F6: autonomy must remain interruptible and plan-transparent — Claude Code resolves this with announce-then-act, not ask-permission-per-step.

**Observable test:** Send exactly one such compound message. Count every user interaction required until a verified, viewable result exists. Capture the final report's content.

**Anchor:** 10 = one message → verified deploy → evidence-backed report; zero forced intermediate taps (optional steering taps don't count against). 0 = user must shepherd each stage manually (send → send to code → trigger build → check preview → discover errors themselves).

---

## F14 — Graceful edges (the absent feature fails like Claude would)

**Definition:** When the user asks for something Goblin can't do yet (web search, image understanding, voice, extended thinking), the response is honest, specific, and redirecting: "Ich kann aktuell nicht im Web suchen. Wenn du mir die Doku-Passage einfügst, arbeite ich damit." Never a silent ignore, never a fake attempt, never a generic error.

**Why it carries the feeling:** Products earn trust at their edges. Claude's refusals and limitations are part of why it feels honest. A mock-up feels like a mock-up precisely when you touch a wall and it's painted on.

**Observable test:** Probe three known-absent capabilities. Capture each response verbatim.

**Anchor:** 10 = honest, specific, helpful redirection in the user's language. 0 = silent ignore or hallucinated compliance.

---

## Appendix A — Grading sheet (filled by Steven post-walk)

| ID | Item | Weight | Score /10 | Evidence refs |
|---|---|---|---|---|
| F1 | One mind, one thread | 3× | | |
| F2 | Visible work | 3× | | |
| F3 | First sign of life | 2× | | |
| F4 | Plan before power | 2× | | |
| F5 | Diffs, not dumps | 2× | | |
| F6 | Interruptible | 2× | | |
| F7 | Error recovery narrative | 3× | | |
| F8 | Session continuity | 2× | | |
| F9 | Grounded honesty | 2× | | |
| F10 | Extended thinking | 1× | | |
| F11 | Web research | 1× | | |
| F12 | Conversational register | 2× | | |
| F13 | Autonomy arc | 3× | | |
| F14 | Graceful edges | 1× | | |

Weights encode feeling-impact. F1/F2/F7/F13 are the identity of the product; F10/F11/F14 are Phase-4 capabilities whose *absence* is tolerable but whose *failure mode* is graded now.

## Appendix B — Explicit non-goals of this spec

- Visual design quality (already strong; covered by GOBLIN_DESIGN_SYSTEM.md).
- Model output quality per se (Swift/Forge capability is a routing/economics question, not a feeling question — a weaker model with F1–F9 intact feels better than a frontier model behind a vending-machine UI).
- Pricing, onboarding, landing (separate tracks).
