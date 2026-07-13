# SPEED & HAPTIK — DIAGNOSIS (Spike, change-nothing)

**Wave:** Speed & Haptik ("Weltklasse") · **Mode:** SPIKE-FIRST (measure & diagnose, then HALT for founder decisions) · **Branch:** `claude/speed-haptics-spike-mak70d` · **Date:** 2026-07-13 · **Session:** cloud (secretless).

Founder's verdict: *"die App ist gestabig und langsam — man klickt und es geht ewig bis sie reagiert. Ich will das auf eine Weltklasse-App erhöhen."* This is a **Feeling issue (F12/F13 Island Flow)**, not a feature gap. Three named symptoms are diagnosed below: **F-41** (buttons feel dead), **F-40** (a run disappears when you leave the browser), and **general latency** (TTFT + navigation).

> **Method (per `docs/GOBLIN_ARBEITSMETHODIK.md`):** *Diagnose vor Bau; Spike vor Bau bei Unbekanntem.* Nothing in the app was changed. Part 1 (findings) + Part 2 (decision table) below. **HALT** for founder decisions **D-S1…D-S8**. Part 3 (cheap-wins build) is **not** started — it runs only on an explicit founder "go" in this session.

> **Honest-Limitations up front (secretless sandbox):** This cloud session has **no prod DB, no VAPID keys, no provider keys, no device**. Every finding below is a **code-path diagnosis** with exact `file:line` refs — I could *read* the mechanism, I could **not** measure wall-clock ms, TTFT percentiles, or hold a phone to feel a tap. Numbers cited as "G-4" come from the prior wave's founder-run SQL, not from me. Where a claim depends on runtime behaviour I cannot observe (e.g. what a serverless host does to an in-flight function on client disconnect), it is flagged **UNVERIFIED** in place. See the full Honest-Limitations section at the end.

---

## Part A — Tap / interaction latency (F-41: "buttons feel dead")

### A.0 — The systemic root cause (one finding explains almost all offenders)

Every interactive control in the app is a **hand-rolled, inline-styled `<button>` whose only feedback is mouse-hover** (`onMouseEnter`/`onMouseLeave`). Hover does **nothing on touch**. There is **no pressed/`:active` state on any audited control**, so between finger-down and the handler's state change landing, **the screen does not change** — which is exactly what "feels dead" is.

Two supporting facts:

- **The two `:active` rules that exist are dead code.** `apps/web/app/globals.css:175` (`.btn-press:active { transform: scale(0.97) }`) and `apps/web/app/globals.css:261` (`.btn:active:not(:disabled) { transform: scale(0.97) }`) are **opt-in via className**. None of the audited controls use `.btn`/`.btn-press` — they are inline-styled or use `.gobl-btn` / `.gb-mobile-back`, none of which carry an `:active` rule. Grep confirms `active:`, `whileTap`, `aria-pressed` appear **nowhere** in the audited components.
- **The design-system `Button` itself has no pressed state.** `apps/web/components/ui/button.tsx:77-96` implements only hover (`translateY(-1px)` + background), `transition: 'all 0.15s'` (line 72), and **no** `onPointerDown`/`:active`/scale. The sheet buttons `SheetBackButton` / `SheetCloseButton` / `SheetCheckButton` (`apps/web/components/ui/BottomSheet.tsx:209-285`) are likewise inline `<button>`s with **zero** press feedback.
- **`touch-action: manipulation` is set nowhere.** The only `touchAction` in the codebase is `pan-y` on the sheet drag surface (`BottomSheet.tsx:141`). Minor extra double-tap-zoom hesitation risk on repeat taps — **not** the primary cause.
- **300ms tap delay is NOT the cause.** `apps/web/app/layout.tsx:19-21` sets `width: 'device-width', initialScale: 1` (pinch-zoom deliberately allowed for WCAG 1.4.4). That is sufficient to disable the legacy 300ms delay on all modern mobile browsers.
- **Some controls actively *remove* the one native cue.** `Sidebar.tsx:434-440` (mobile close) and `bottom-tab-bar.tsx:65` set `WebkitTapHighlightColor:'transparent'`, killing Android's native press highlight **without substituting anything**.

### A.1 — Per-offender classification

Classes: **(i)** missing optimistic/pressed state · **(ii)** blocking work on the main thread before any UI response · **(iii)** navigation re-render cost.

| # | Control | file:line | (i) no pressed | (ii) blocking before UI | (iii) nav re-render |
|---|---------|-----------|:--:|:--:|:--:|
| 1 | **Chat back (project ctx) — WORST OFFENDER** | `chat/standalone-chat.tsx:588-603` | ✅ | — | ✅ `router.push('/dashboard/project/…')` |
| 1b | Code mobile back | `code/SessionPane.tsx:823-830` | ✅ | — | — (cheap `setState`) |
| 1c | Sheet back / close | `ui/BottomSheet.tsx:235-258 / 209-232` | ✅ | — | — (cheap `pop`) |
| 2 | Sidebar rows / nav | `layout/Sidebar.tsx:307-321, 486-495, 151-155` | ✅ | — | ✅ `router.push` |
| 2b | Sidebar "+" new chat | `layout/Sidebar.tsx:588-606` | ✅ | ✅ `getSession` + `POST /api/chat-sessions` | ✅ |
| 2c | Bottom tab / header mode-tile | `app-shell/bottom-tab-bar.tsx:55-67`, `layout/Header.tsx:170-231` | ✅ | — | — (cheap `setActiveTab`) |
| 3 | Send | `chat/ChatInput.tsx:1017-1042` | ✅ | — (sync submit) | — |
| 4 | Model switch (header) | `app-shell/model-switcher.tsx:333-350, 395-408` | ✅ | — | — |
| 4b | Model pill (composer) | `chat/ChatInput.tsx:956-979` | ✅ | — (panel opens first) | — |
| 5 | Publish ("Live stellen") | `code/SessionPane.tsx:552-562` + `styles/dashboard-tokens.css:109-134` | ✅ | ✅ `await apiGet('/api/integrations/vercel')` before `setDeploying(true)` | — |

**Notes on the worst offender (#1).** `chat/standalone-chat.tsx:588-603`: the "← {projectName}" control is a plain inline `<button>` with **no** `:active`/scale/`onPointerDown`, and its handler is `router.push('/dashboard/project/${projectId}')` — a **full Next.js route navigation** that unmounts the chat and mounts a `force-dynamic` server route (RSC fetch + `DashboardShell` re-render). Nothing paints on press; the first visible change is the destination route committing (a cold RSC fetch can be hundreds of ms). It combines **(i) + (iii)** — the two worst classes stacked — which is why this specific button is the one the founder taps repeatedly.

**Notes on #5 (Publish).** `code/SessionPane.tsx:552-562`: after the confirm, `liveStellen` does `await apiGet('/api/integrations/vercel')` **before** `setDeploying(true)` / `setPublishStream(...)` (lines 561-562). Everything after 561 is correctly optimistic, but the gating pre-check leaves the button inert until that round-trip returns.

**Well-behaved controls** (no blocking, no nav — only missing pressed state): **Send** (`ChatInput.tsx:570-599`, synchronous), **model pill** (`openHub` sets `setHubOpen(true)` first, then fetches — `ChatInput.tsx:503-518`), **header model select** (`handleModelSelect` synchronous — `model-switcher.tsx:272-285`).

---

## Part B — Run persistence (F-40) — **the highest-value finding**

**Symptom:** an in-flight agent/chat run "disappears" when the browser backgrounds or the PWA is closed, and cannot be recovered. This breaks Island Flow literally (F13: *"describe from the beach, return to shipped"*).

### B.1 — The concrete architectural gap: **run execution is bound to the HTTP request signal**

The agent run is **client-driven**. It is not merely that the UI forgets — the **server actively stops the run when the client disconnects**:

- `apps/api/src/routes/code-sessions.ts:676` passes **`stopSignal: c.req.raw.signal`** straight into `runAgent(...)`. When the client tab backgrounds/closes (fetch aborted → the underlying request aborts), that signal fires and the orchestrator's stop check ends the loop. **The run dies with the tab.**
- The standalone/project chat stream is the same shape: `apps/api/src/routes/chat.ts:193-195` — `c.req.raw.signal` `abort` → `abortController.abort()` → the model stream is killed (checked at `chat.ts:211`).

So the run is **not** server-driven-with-reattach; it is a computation that lives and dies inside one HTTP request.

### B.2 — Where run state is persisted (partial, lifecycle-only)

- `agent_runs` **does** persist server-side, but only as a lifecycle envelope: `createAgentRun` inserts a row `status:'running'` at loop start (`services/agent/run-store.ts:57-80`), and `finalizeAgentRun` writes the outcome + step log **at loop end** (`run-store.ts:88-125`). It records tokens/outcome/step_log — **not** a live, resumable token stream.
- **UNVERIFIED (runtime-dependent):** if the run is aborted by a client disconnect, whether `finalizeAgentRun` runs at all depends on whether the serverless host lets the function finish after the client is gone. If the function is torn down on disconnect, the row is left **stuck at `status:'running'`** with no outcome. I cannot observe the host's disconnect behaviour from this sandbox.
- Standalone/project chat is worse for partial text: the assistant message is inserted **only on the `done` event** (`chat.ts:246-258`) or a fallback-after-generator-ends (`chat.ts:275-297`). A disconnect mid-stream drops out at `chat.ts:211` (`if (abortController.signal.aborted) break`) and **the accumulated partial `fullResponse` is best-effort at most** — again subject to the same teardown question.

### B.3 — Why a returning client cannot re-attach

- **No resume/re-attach endpoint exists.** The only recovery path is `GET /:sessionId/runs/:runId/report` (`code-sessions.ts:541-560`), which returns the **final persisted report card** — and `204` if `report` is null (i.e. the run was aborted before finalize). It gives no **live** progress and nothing at all for an aborted run.
- **The client never looks for an in-flight run on mount.** `apps/web/hooks/code/useCodeSessionDetail.ts:42-68` (`refresh`) fetches persisted files + messages only. There is **no** in-flight-run detection, **no** live SSE reconnect, **no** rehydration. `offline-banner.tsx:21` only listens for `'online'`; there is **no** `visibilitychange`/`pagehide` handling tied to a run.

### B.4 — The one partial mitigation that already exists (and its two gaps)

`code-sessions.ts:718` fires `notifyAgentRunFinished(...)` — the A-5 "dein Ping vom Strand" VAPID push — **only when the run reaches completion** (line 718, after `runAgent` returns normally). Two gaps: **(1)** an **aborted** run never reaches line 718, so a disconnect gets no push; **(2)** per the prior wave (`_sprint/wave-a/REPORT.md:34`), live VAPID delivery is **BLOCKED-pending-env** (no VAPID keys deployed), so even the completion push is not proven live.

### B.5 — Named gap, in one sentence

**Run execution is coupled to the request lifecycle (`stopSignal = c.req.raw.signal`), run state is persisted only as a start/end lifecycle envelope (no live event log), and there is no server-side continuation nor any client re-attach/resume path — so leaving the tab both stops the run and loses the view of it.**

---

## Part C — Perceived latency / TTFT

### C.1 — Client send path: the instant "thinking" state **does** exist (a positive finding)

All composers show an optimistic placeholder **before** any network call — the UI does *not* wait for the server to show life:

- `chat/standalone-chat.tsx:437-465`: the user bubble is pushed (451-453) and an empty assistant placeholder `{ id:"streaming", content:"" }` is set (459-465) **before** the `await` at 473.
- `workspace/chat-tab.tsx:142-172`: identical pattern (placeholder before `apiStream` at 176).
- `chat/Message.tsx:102-113`: when `id==="streaming" && content===""` it renders `<WorkingIndicator>` (bouncing dots) + `GoblinLogo state="thinking"` immediately.

**But there is no step-stream.** The server emits a `meta` event (routing info), yet the client uses it **only** to set the model label (`standalone-chat.tsx:479-483`), never as visible progress. During the multi-hundred-ms pre-model server work (C.3) the user sees only generic dots — no "Dateien werden gelesen…", "Route wird gewählt…". The step-stream that F2 ("Visible work") calls for is not wired to the pre-model window.

### C.2 — Streaming: genuine token-by-token, **except the agent path**

- **Chat is truly streamed.** Client: `apps/web/lib/api.ts:156-191` (`apiStream`) reads `res.body.getReader()` + `TextDecoder`, parses SSE `data:` lines, appends deltas incrementally. Server: Hono `streamSSE` writes each delta as it arrives (`chat.ts:226-235`, `chat-sessions.ts` mirror). Model layer yields per-chunk deltas (`services/model-router.ts:489-745`).
- **The agent path is buffered.** `services/agent/model-turn.ts:80-98` uses **non-streaming** `client.chat.completions.create(... ChatCompletionCreateParamsNonStreaming ...)`. The whole agent model turn is assembled server-side before the client sees the result of that turn. This matters specifically for Goblin Swift/Forge **agent** runs — the "thinking" period is longer and blank because there are no intra-turn tokens to show.

### C.3 — TTFT: ~8–12 sequential DB round-trips before the model is even contacted

For `POST /api/chat/stream` (`chat.ts`) and its twin `POST /api/chat-sessions/:id/stream`, everything below is **awaited sequentially before** the provider stream opens (`model-router.ts:647` stamps `requestStart` just before the provider call). None is parallelized:

1. body parse → 2. ownership `SELECT` → 3. idempotency dedupe `SELECT` → 4. **user-message `INSERT` (awaited, blocking)** → 5. history `SELECT` → 6. project `SELECT` → 7. **`loadProjectContextFiles` — reads file storage, the single heaviest step** (`chat.ts:157`) → 8. `loadProjectState` → 9. `loadUserPreferences` → 10. build system prompt (×2).

Then inside the model router: `resolveModel` → `resolveByokKey` (2 parallel queries **+ synchronous key decryption**), `applyHealthFallback`, and for goblin-hosted `getUserPlanAndLang` + `goblinWeightedUsage` (2 more queries), then finally the `meta` event, then — on the agent route — a **blocking `agent_runs` INSERT on the first-token path** (`code-sessions.ts:645-647`).

**Deferrable/parallelizable without changing correctness:** the auto-title `UPDATE` and the `agent_runs` `INSERT` are not needed before first token (candidates for fire-and-forget); the history + context + state + prefs loads (steps 5–9) are independent and could run under one `Promise.all`. The `loadProjectContextFiles` read is the heaviest and is the best single target. **UNVERIFIED:** I cannot measure the ms each step costs from here — the ordering/round-trip *count* is from code; the *magnitude* corroborates the prior wave's G-4 SQL (TTFT p50 ~1.3s / p90 ~3.3s) but I did not re-measure it.
Watchdogs (context, not causes): first-token deadline 45s (`model-router.ts:755`), provider timeout 120s (`model-router.ts:497`). DeepInfra prompt-cache hint exists on the **agent** path (`model-turn.ts:88-96`) but **not** on the streaming `streamCompletion` path.

### C.4 — Navigation: force-dynamic everywhere, almost no loading states

- **Every dashboard route is `force-dynamic` → no caching, full refetch per navigation.** `dashboard/chat/[sessionId]/page.tsx:5`, `dashboard/project/[id]/work/page.tsx:5`, `dashboard/project/[id]/page.tsx:12` (this one runs **5–6 uncached queries per visit** — a `Promise.all` of 4 at lines 63-89 **plus** a sequential `deployments` query at 102-107 that is *not* folded in).
- **Only 2 `loading.tsx` exist for 76 pages** (`app/loading.tsx`, `app/dashboard/loading.tsx`). Missing for every heavy dynamic segment: `chat/[sessionId]`, `project/[id]`, `project/[id]/work`, `project/[id]/files`, `projects/[id]`, `chats`. Worse, the nearest boundary — `dashboard/loading.tsx:9-27` — is a **project-list skeleton**, so navigating into a chat or editor shows the **wrong** skeleton.
- **Heavy client components re-hydrate on entry.** CodeMirror is `dynamic(ssr:false)` (`code/SessionPane.tsx:52-55`, `project/code-tab-classic.tsx:23`) → downloads + mounts client-side every time the code tab opens. Preview tab `dynamic(ssr:false)` with no `loading` fallback (`project/project-workspace.tsx:11-14`). `react-syntax-highlighter` (Prism + `oneDark`) imported **statically** in `project/file-viewer-modal.tsx:5-6`. Project-switch clears + refetches chat history full-screen (`workspace/chat-tab.tsx:64-71`, blocking `GoblinLoader` at 233-238).
- **One positive:** the chat session page SSRs `initialMessages` into `StandaloneChat` (`chat/[sessionId]/page.tsx:42-56`), so an existing thread paints its messages on first load; `activeTab` persists across nav (`project-workspace.tsx:39-45`).

---

## Part D — Cheap wins vs architecture (split, with effort/risk)

### D.1 — Cheap, safe, ship-now (the Part-3 tier — build only on founder "go")

| ID | Fix | Where | Effort | Risk |
|----|-----|-------|:------:|:----:|
| CW-1 | **Global press feedback** — one rule: `button:active:not(:disabled){transform:scale(.97)} ; button{touch-action:manipulation}` (respecting the existing `prefers-reduced-motion` block at `globals.css:177`). Gives *every* inline button instant press response in one file. | `app/globals.css` | XS (1 file) | Low |
| CW-2 | **Back button (worst offender): instant close, no fresh route** — swap `router.push('/dashboard/project/…')` for `router.back()` (or a cheap local view toggle) so the transition uses the cached history entry instead of a cold `force-dynamic` RSC fetch; + inherits CW-1 press state. | `chat/standalone-chat.tsx:588-603` | S | Low–Med (verify back-stack lands on the project, not off-app) |
| CW-3 | **Publish: optimistic before the pre-check** — move `setDeploying(true)`/`setPublishStream(...)` **above** the `await apiGet('/api/integrations/vercel')`. | `code/SessionPane.tsx:552-562` | XS | Low |
| CW-4 | **Sidebar "+" new chat: optimistic busy** — set a `busy`/"Öffne…" state before `getSession`+`POST` (mirror `ProjectChatLaunch` which already does this). | `layout/Sidebar.tsx:588-606` | XS | Low |
| CW-5 | **Route skeletons** — add per-segment `loading.tsx` (chat-thread skeleton, workspace skeleton, file-list skeleton) for the 6 missing dynamic routes so transitions show the *right* shape instead of the project-list skeleton. | `app/dashboard/**/loading.tsx` | S–M (additive, isolated) | Low |
| CW-6 | **Stop killing native feedback** — drop the bare `WebkitTapHighlightColor:'transparent'` (or pair it with CW-1) on `Sidebar.tsx:434-440` and `bottom-tab-bar.tsx:65`. | 2 files | XS | Low |

*Gray-zone (cheap-ish but touches the stream contract — recommend deferring out of the pure cheap tier):* surfacing the existing `meta` event + a lightweight "reading files… / routing…" status label during the pre-model window (C.1). Small code, but it changes what the stream promises the user — put it to the founder as **D-S6**.

### D.2 — Architectural (each its own authorized wave — **do NOT start here**)

| ID | Change | Effort | Risk | Ledger impact? |
|----|--------|:------:|:----:|:--------------:|
| ARCH-1 | **F-40 resumable / server-driven runs** — decouple execution from `c.req.raw.signal`; persist a live run event log; add a resumable SSE (Last-Event-ID) + client re-attach on mount. | L | High | Possibly (longer-lived server compute) |
| ARCH-2 | **F-40 background-continue + push on completion** — let the run finish server-side after disconnect and deliver the A-5 VAPID push (needs VAPID env, currently BLOCKED-pending-env). | M–L | Med–High | Yes (push infra / longer runs) |
| ARCH-3 | **Stream the agent path** — move `model-turn.ts` from non-streaming to streaming native-tools so agent turns show intra-turn tokens. | M | Med (agent protocol) | Low |
| ARCH-4 | **TTFT pipeline** — `Promise.all` the independent pre-model loads + fire-and-forget the auto-title `UPDATE` and `agent_runs` `INSERT`; add prompt-cache hint to `streamCompletion`. (A *safe subset* — parallelizing reads only — is arguably medium, not architectural; flagged **D-S7**.) | M | Med (ordering guarantees) | Low |
| ARCH-5 | **Navigation caching** — drop `force-dynamic` / add short-lived caching on hot routes; fold the `deployments` query into the existing `Promise.all`. | M | Med (stale-data correctness) | Low |

---

## Part 2 — DECISION TABLE (**HALT** — founder decides; I do not choose)

| ID | Decision | Class | Option A | Option B | Recommendation | Why |
|----|----------|-------|----------|----------|----------------|-----|
| **D-S1** | Ship the cheap-haptics tier **now**, this session? | cheap | Yes — build CW-1…CW-6 as isolated commits, PR, founder feels it on deploy | No — diagnosis only, cheap tier as its own next session | **A** | "Weltklasse" is a feeling; the honest gate is your thumb on the deployed pressed-states. CW-1 alone fixes the systemic "dead" feel in one file. |
| **D-S2** | Back button (worst offender) fix approach | cheap | `router.back()` (use cached history entry) | Local view-state toggle (no route change at all) | **A**, fall back to **B** if back-stack is unreliable | `router.back` is one-line and reuses the cached route; B is more code but guarantees zero RSC fetch. Founder picks the risk tradeoff. |
| **D-S3** | **F-40** — which resumable model? | arch | (a) server-persist run + rehydrate/re-attach on mount | (b) background-continue + VAPID push on completion | **C = both**, sequenced: (a) first (recoverable view), then (b) (ping from the beach) | (a) restores Island Flow's *view*; (b) restores its *promise*. (a) is the foundation (b) leans on. Highest-value wave — but **its own** wave, not this one. |
| **D-S4** | F-40 — does it block the cheap tier? | mixed | Ship cheap tier now, schedule ARCH-1/2 as the next wave | Hold everything until F-40 is designed | **A** | Cheap tier is independent of F-40 and gives immediate felt improvement; F-40 needs a design pass (event store, resumable SSE) that deserves its own spec. |
| **D-S5** | Stream the agent path (ARCH-3)? | arch | Yes — schedule as a wave | No — accept buffered agent turns for now | **defer** (founder call) | Real improvement to agent "thinking" feel, but changes the agent protocol; lower priority than F-40. |
| **D-S6** | Add a pre-model **step-stream** ("reading files… / routing…")? | gray | Yes — include in cheap tier | No — keep it out of the pure cheap tier | **B** for this session (keep cheap tier pure), revisit with ARCH | It touches the stream contract; cleaner as a small dedicated change than smuggled into the haptics commit. |
| **D-S7** | TTFT safe-subset (parallelize reads + defer 2 writes, ARCH-4 subset) now? | mixed | Yes — include as a careful commit | No — full TTFT work as its own wave | **B** | Even the "safe" reorder needs a regression proof that history/context still land correctly; better measured against the G-4 SQL in a dedicated wave. |
| **D-S8** | Navigation caching (ARCH-5)? | arch | Yes — schedule a wave | No — rely on CW-5 skeletons for now | **B** for this session | CW-5 skeletons remove the *perceived* stall cheaply; real caching has stale-data correctness risk and wants its own review. |

**I am HALTing here.** No Part-3 build has begun. On an explicit founder "go" (naming which of D-S1/D-S2/etc.), I ship **only** the authorized cheap-wins tier as isolated commits, each with a before/after evidence artifact (DOM/CSS proof for pressed states where a device render is impossible in-sandbox; interaction trace for the back-button route change).

---

## Honest-Limitations (mandatory)

1. **No measurement, only diagnosis.** Secretless cloud sandbox: no prod DB, no VAPID/provider keys, no device. I read code paths and counted round-trips; I did **not** measure TTFT ms, interaction-to-paint ms, or feel a tap. Every "feels dead"/"slow" claim is grounded in a mechanism (`file:line`), not a stopwatch.
2. **TTFT numbers are inherited, not re-measured.** The G-4 p50 ~1.3s / p90 ~3.3s figures are the prior wave's founder-run SQL (`_sprint/wave-a/REPORT.md`), not this session's. The code shows *why* it's slow (round-trip count, no parallelization); it does not tell me the per-step ms.
3. **Two runtime facts are UNVERIFIED** (flagged in place): (a) whether a serverless host lets an in-flight run's `finalizeAgentRun` complete after client disconnect, or tears it down leaving `agent_runs` stuck `running`; (b) whether the standalone-chat partial `fullResponse` is persisted on a mid-stream disconnect. Both depend on host behaviour I can't observe here.
4. **Pressed-state "gate" will be DOM/CSS, not visual, in-sandbox.** If Part 3 is authorized, I cannot screenshot a real finger-press in this environment. The deterministic gate is CSS/DOM proof that `button:active` resolves to a scale transform on every audited control; the *felt* gate is your thumb on the deploy.
5. **Branch discrepancy noted (state-first).** The prompt header names branch `spike-speed-haptics from master`; the session's designated branch is `claude/speed-haptics-spike-mak70d` (already checked out, cut from current `master` @ `516526e`). Per Gesetz 10 I follow the repo/session reality and use the designated branch. Flagging for the founder in case a different branch name was intended.
6. **Audit scope.** The five named offenders + their siblings were audited; there are ~137 raw `<button>` sites in `apps/web` — CW-1 (global `:active`) covers them all at once precisely *because* they share the inline-button pattern, but I did not hand-verify each of the 137.

## Founder action list

- **Decide D-S1…D-S8** above (especially D-S1: ship the cheap tier this session? and D-S3: F-40 model a/b/c).
- If you authorize the cheap tier, say **"go"** and name the CW-items (or "all cheap") — I build them as isolated commits with before/after artifacts, then PR + HALT.
- Confirm the branch name (`claude/speed-haptics-spike-mak70d` vs `spike-speed-haptics`).
- **No migrations, no new services, no spend** are proposed by this spike. ARCH-2 (F-40 push) would need VAPID env applied by you — not in scope here.
