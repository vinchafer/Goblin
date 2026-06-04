# Sprint 10.9 — Architecture Correction (verbatim founder + reviewer framing)

> Saved before any work, per Sprint 10.9 §3.

## [FROM VINCENT]

"Inference läuft aktuell DIREKT über die Provider, NICHT über einen
separaten LiteLLM-Proxy. Der Gemini-Prefix-Bug wurde in der Prod-DB
gefixt, nicht in einer Proxy-Config. streamCompletionGuarded spricht
direkt mit den Provider-APIs. Es gibt keine LiteLLM-Proxy-Instance
auf Railway. Sehr wahrscheinlich ist die LiteLLM-Library gar nicht
als npm-Dep installiert — Goblin nutzt nur LiteLLM-STYLE-Abstraktion
(OpenAI-kompatibles Schema mit Provider-Adapter-Pattern). LiteLLM
bleibt als Provider-Abstraktion — nur der separate Proxy existiert
nicht. Diese Unterscheidung muss klar bleiben."

## [SLUG NUANCE FROM VINCENT]

"Manche Provider geben im /models-Endpoint nicht den Slug zurück den
ihre Chat-API erwartet (OpenAI listet gpt-4o, akzeptiert aber auch
Aliase). Speichere in discovered_models EXAKT was /models zurückgibt
UND teste beim ersten Routing dass der Slug funktioniert. Bei
Routing-Fehler: log + circuit-breaker."

---

## Verification result (Phase 0 gate, 2026-06-04)

Vincent's framing is **confirmed** with one nuance: a LiteLLM proxy
*instance* IS deployed at `litellm-production-6ba8.up.railway.app`
(referenced only in `.env.local`), but it is an **empty, unconfigured,
unhealthy shell** — it has no `model_list`, cannot route any model,
and `/model/info` returns 500 *"LLM Model List not loaded in."* It is
therefore functionally non-existent. Real inference runs direct via
the Anthropic / OpenAI SDKs. See `PHASE_0_GATE.md` for evidence.
