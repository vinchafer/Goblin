# MODEL LICENSES — Goblin-hosted & bundled models

**Purpose:** register the licenses of the models Goblin hosts/bundles under white-label
tier names, quote the exact obligations, and record the founder's licensing decision.
**Analyzed 2026-07-05 (FEEL-2 merge prep, L2). License texts fetched verbatim from the
official Moonshot AI / DeepSeek Hugging Face repositories on 2026-07-05 — re-verify on any
model version bump (the tier → model mapping and the license both move with the weights).**

Goblin does not train these models; it consumes their inference via **DeepInfra** (weights
hosted by the provider — Goblin calls the wholesale API). The public tier name never exposes
the wholesale model (two-level truth, HR-6).

---

## Register

| Goblin tier | Underlying model | License | Modification clause |
|---|---|---|---|
| **Goblin Swift** (efficient) | DeepSeek V3.2 | **MIT** | none (standard MIT) |
| **Goblin Forge** (premium) | Kimi K2.6 (Moonshot AI) | **Modified MIT** | attribution required above a scale threshold — quoted below |

**L2/L3 provider models are user-wired (BYOK) and out of scope** — the user brings their own
key and accepts that provider's terms directly; Goblin hosts nothing for them.

---

## Goblin Swift — DeepSeek V3.2 (MIT)

- **Source:** <https://huggingface.co/deepseek-ai/DeepSeek-V3.2/blob/main/LICENSE> (retrieved 2026-07-05).
- **License:** standard **MIT**. Header verbatim: `Copyright (c) 2023 DeepSeek`.
- **Obligations:** the standard MIT requirements only — include the copyright notice and
  permission text in distributions. **No** copyleft, **no** attribution-on-UI clause, **no**
  field-of-use or rebranding restriction. White-labeling as "Goblin Swift" is unrestricted.

---

## Goblin Forge — Kimi K2.6 (Modified MIT)

- **Source:** <https://huggingface.co/moonshotai/Kimi-K2.6/blob/main/LICENSE> (retrieved 2026-07-05).
- **License:** **MIT with a single added modification.** Below the thresholds it functions as
  standard MIT (commercial use, modification, redistribution, sublicensing, no royalties).
- **Modification clause — quoted verbatim from the LICENSE file:**

  > Our only modification part is that, if the Software (or any derivative works thereof) is
  > used for any of your commercial products or services that have more than 100 million
  > monthly active users, or more than 20 million US dollars (or equivalent in other
  > currencies) in monthly revenue, you shall prominently display "Kimi K2.6" on the user
  > interface of such product or service.

- **Exact thresholds (verbatim from the clause):** **> 100 million monthly active users**
  **OR** **> 20 million US dollars in monthly revenue**. The obligation is **attribution only**
  ("prominently display 'Kimi K2.6' on the user interface"). The text contains **no** restriction
  on rebranding, white-labeling, or commercial hosting.

---

## Founder decision (2026-07-05)

Analyzed 2026-07-05. **Founder decision: white-label as Goblin Forge stands; no attribution
shown.** Kimi K2.6's only non-MIT obligation is to prominently display "Kimi K2.6" on the UI —
and that obligation activates **only** for a commercial product with **more than 100 million
monthly active users OR more than 20 million US dollars in monthly revenue** (exact thresholds
from the clause above). Goblin is orders of magnitude below both. The clause imposes **no**
restriction on rebranding or white-labeling, so serving the model under the "Goblin Forge" tier
name is permitted today. **Re-check trigger: 1M users** (a safety margin two orders of magnitude
under the 100M-MAU threshold — revisit the attribution obligation well before it can bind).
Weights are hosted by **DeepInfra**; Goblin consumes inference via the API.

DeepSeek V3.2 (Goblin Swift) is plain MIT — no attribution obligation at any scale.
