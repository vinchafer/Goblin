# Mic contrast on the dashboard hero composer

Surface: `rgba(244,236,216,.05)` over `--ink-deep` #0F2B1E = **#1a3527**.
Values read from `apps/web/styles/design-tokens.css`, ratios by `lib/contrast.ts` (WCAG 2.1).

| Element | Token | Threshold | Before | Ratio | After | Ratio | Verdict |
|---|---|---|---|---|---|---|---|
| idle mic | `--text-2` | icon (1.4.11) ≥ 3:1 | `#3F3A2C` | **1.17:1** | `#D8CBA8` | **8.23:1** | was FAILING → passes |
| recording mic | `--rust` | icon (1.4.11) ≥ 3:1 | `#B0432A` | **2.33:1** | `#E89080` | **5.52:1** | was FAILING → passes |
| dictation label | `--meta` | text (AA body) ≥ 4.5:1 | `#5F5640` | **1.83:1** | `#D8CBA8` | **8.23:1** | was FAILING → passes |

Guarded by `styles/dark-contrast.test.ts` § "dark islands in the light cascade",
which goes red if the scoped block is removed.
