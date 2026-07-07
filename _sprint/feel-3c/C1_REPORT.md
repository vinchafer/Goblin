# FEEL-3c C1 — JSON-protocol fallback hardening (report)

## What changed (commit `5e93df2`)
- `parseFallbackToolCall` now **rejects >1 `tool_call` fence in a turn** as malformed. Before, the
  first-match regex silently dropped the second fence — the deeper cause of the FEEL-3b W10
  protocol-mixing flake (a run losing a file). Two fences → `malformed`, one repair, then honest abort.
- Malformed outcomes carry the **exact violation** (`detail`): JSON syntax error text, or the zod
  issue path+message (`args: Expected object, received array`), or the fence-count message.
- `buildRepairInstruction(detail)` **quotes that violation verbatim** into the single repair reprompt,
  so the model corrects the specific mistake — the C1 requirement. Second failure → honest, jargon-free abort.

## Gate 1 — fixture suite (unit)
`apps/api/src/services/agent/protocol.test.ts` — **12/12 green**. Covers the three required malformed
classes plus happy paths and the repair contract:
- **prose+JSON mixed** — prose before a single fence resolves the call; prose + invalid-JSON fence → malformed (syntax detail).
- **two calls in one turn** — two fences → malformed (`"2 tool_call-Blöcke gefunden …"`), never silent drop.
- **wrong arg types** — `tool: 42` → malformed (names `tool`); `args: [1,2,3]` → malformed (names `args`); empty tool name → malformed.
- **repair** — `buildRepairInstruction(detail)` contains the detail verbatim + names `finish`; no-arg form == generic `REPAIR_INSTRUCTION`.

Full agent suite **59/59**, full API suite **437/437**, `tsc --noEmit` clean (api + web).

## Gate 2 — real-model end-to-end (harness, `c1_harness.mts`)
FEEL-3b gate-1 scenario ("Mini-Umfrage … sag mir wenn es live ist", explicit publish intent), real
endpoints, in-memory stub executor (no Supabase/Vercel — this is a **parser/loop** test), `publishGranted:true`.

| Model | Path | Iterations | Repairs | Heal | Outcome | Tools |
|---|---|---|---|---|---|---|
| **Goblin Forge** (Kimi-K2.6, DeepInfra) | native function calling | 5 | 0 | 0 | `published` | list→write→save→publish→finish |
| **Groq** (llama-3.3-70b) | strict JSON fallback (`supportsNativeTools:false`) | 4 | 0 | 0 | `published` | write→save→publish→finish |

Groq emitted exactly the intended shape every turn — one line of prose, then **one** fenced `tool_call`
block — which the hardened parser resolved cleanly (no multi-fence trip, no malformed, no repair). Raw
turns captured in the harness output. This is the empirical confirmation that the fallback protocol
survives a real non-native model.

## Eligible-list recommendation (founder decision — I report, don't decide)
- **From the parser's standpoint, Groq llama-3.3-70b is a viable candidate**: one clean, repair-free,
  fully-published run through the strict JSON fallback. No protocol changes were needed for it to work.
- **But this is one run, not a reliability guarantee.** Adding `groq/*` to `AGENT_ELIGIBLE_TIERS`
  (`config.ts:25`) is a product+cost+reliability call, not a parser call: Groq free-tier has a low TPM
  ceiling (one of the two keys in `.env.local` is already 401-dead), the agent system prompt is large,
  and BYOK-Groq billing/attribution differ from goblin-hosted. **Recommendation: keep the eligible list at
  `goblin/efficient` + `goblin/premium` for now**; if you want Groq as a BYOK agent option, gate a short
  multi-run reliability soak (10+ runs incl. an intent-absent and a broken-asset case) behind a flag first.

## Note
`.env.local` `GROQ_FREE_API_KEY` returns 401 (stale); `GROQ_FREE_API_KEY_2` is live. Harness prefers `_2`.
