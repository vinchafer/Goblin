# Convention Pass — Session 9D Comparison Document

Documents the conventions Goblin adopts from Claude Mobile + ChatGPT Mobile, distinct from copies.

| Pattern | Claude | ChatGPT | Goblin (9D) |
|---|---|---|---|
| Settings Container | Bottom-Sheet, hell | Bottom-Sheet, dark | Bottom-Sheet, hell auf Cream |
| Settings Groups | 3 | 5–6 | 5 (Konto/Goblin/Design/App/Hilfe) + Profil-Card |
| Toggle Active Color | Blau (iOS) | Grün (iOS) | Moss-Green #2D4A2B |
| Toggle Size | 51×31px iOS | 51×31px iOS | 51×31px iOS — IOSToggle.tsx |
| Empty Chat | Greeting + Composer | Suggestion-Rows + Composer | Greeting + 3 Suggestion-Rows + Composer |
| Greeting time-based | Nein | Nein | Ja (Morgen/Tag/Nachmittag/Abend) |
| Composer Plus | klein Popover | Bottom-Sheet | klein Popover (Claude-Style) |
| Long-Press auf Chat | nicht im Set | Context-Card mit Submenu | Bottom-Sheet mit 6 ContextActions |
| Filter | Pills horizontal scrollable | (kein direkter Vergleich) | Pills horizontal scrollable — FilterPills.tsx |
| Avatar Mobile | (nicht im Set) | Bottom-Sheet | Bottom-Sheet (responsive — auch Desktop) |
| Ochre-FAB | nicht prominent | nicht im Set | Goblin-eigenständig (bleibt) |
| Sheet Stack-Nav | Push/Pop animiert | Push/Pop animiert | SheetStack context API |

## Tokens (additiv zu existing globals.css)

Neu in 9D-0:
`--moss-green-soft`, `--moss-green-border`, `--ochre-soft`, `--rust`, `--rust-soft`,
`--border-hairline`, `--border-subtle`, `--border-strong`, `--toggle-off`,
`--surface-overlay`, `--text-meta`, `--shadow-sheet`, `--shadow-popover`,
`--shadow-fab`, `--shadow-card`, `--radius-sheet`.

Existing tokens (`--moss`, `--panel`, `--cream`, `--text`, `--meta`, `--ochre`, `--font-ui`, `--font-brand`)
werden weiterverwendet — keine Doppel-Vokabular-Migration nötig.

Reference-Screenshots: `docs/Reference Screenshots/Mobile/{Claude,ChatGPT}/`.
