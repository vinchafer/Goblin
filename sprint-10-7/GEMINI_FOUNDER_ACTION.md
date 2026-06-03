# Gemini "spins forever" — Founder Action (Sprint 10.7-3)

## Symptom
Vincent added a Google/Gemini BYOK key, selected **Gemini 2.5 Pro**, sent a
chat. The reply never came — only the spinner + "Gemini 2.5 Pro" label. Groq
also failed earlier (separate add-key bug, fixed in 10.7-1/2).

## What 10.7-3 fixed in code
- **First-token watchdog** (`streamCompletionGuarded` in
  `apps/api/src/services/model-router.ts`): if no token arrives within 45s the
  upstream fetch is aborted and a clear German error is streamed to the client
  instead of an open-ended spinner.
- **chat.ts** (project chat route) now forwards `type:'error'` /
  `fallback_notice` to the client (previously dropped → silent hang).
- **chat-sessions.ts** now propagates client-abort into `streamCompletion`.

These guarantee the user always gets feedback. They do **not** make Gemini
itself work — that is upstream config.

## Root cause of the Gemini failure (upstream — needs founder)
The chat goes through the LiteLLM proxy when `LITELLM_BASE_URL` is set. The
model slug sent for the default Gemini pick is `gemini/gemini-2.5-pro`
(see `FREE_SLUG_TO_LITELLM` + `slugToProvider` in model-router.ts). If the
Railway LiteLLM proxy's `model_list` does not contain an entry that matches
`gemini/gemini-2.5-pro` (or the proxy has no Google credential / the BYOK key
is not being forwarded), LiteLLM stalls or 404s.

### To verify (founder, on Railway)
1. Railway → API service → Logs. Reproduce the chat. Look for the LiteLLM
   request line and the status/error it returns for the Gemini model.
2. Hit the proxy directly:
   ```
   curl -s $LITELLM_BASE_URL/v1/models -H "Authorization: Bearer $LITELLM_MASTER_KEY" | grep -i gemini
   ```
   Confirm whether `gemini/gemini-2.5-pro` (and `gemini/gemini-1.5-flash` for
   the free pool) are registered.

### Likely fixes (pick what matches the logs)
- **Slug mismatch**: register `gemini-2.5-pro` in the LiteLLM `model_list`
  with `litellm_params.model: gemini/gemini-2.5-pro`, or update Goblin's
  catalog/default to a slug the proxy already serves.
- **Missing default Google credential**: the free pool entry
  `free/gemini-flash` needs a `GEMINI_API_KEY` / `GOOGLE_API_KEY` env on the
  proxy. For BYOK, confirm the proxy forwards the per-request `api_key`.
- **Fastest unblock**: make **Groq** the recommended default (it works) and
  leave Gemini as a secondary pick until the proxy is verified.

## Status
Code-side: DONE (no more silent hang). Upstream Gemini routing: **founder
action required** per directive §9(d) — not fixable from app code.
