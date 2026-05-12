# CONSISTENCY_AUDIT.md — Session 4

---

## Standards festgelegt (nach dieser Session)

| Element | Standard | Enforcement |
|---------|----------|-------------|
| Primary Button | `var(--moss)` bg, `#fff` text, `border-radius: 8-9px`, min-height 36-40px | `Button` component |
| Secondary Button | `var(--panel)` bg, `var(--border)` border, `var(--text)` color | `Button` component (FIXED) |
| Danger Button | `var(--error)` bg, `#fff` text, `border-radius: 8px` | Manual inline |
| Ghost Button | transparent, `var(--meta)` color | `Button` component |
| Ochre CTA | `var(--ochre)` bg, `#1a1200` dark text (FIXED contrast) | Manual inline |
| Modal overlay | `rgba(0,0,0,0.5)` fixed inset, click-outside closes | ConnectGitHubModal pattern |
| Modal card | `var(--panel)` bg, `var(--border)` border, `border-radius: 14px`, `var(--shadow-lg)` | ConnectGitHubModal pattern |
| Settings card | `var(--panel)` bg, `var(--border)` border, `border-radius: 14px`, `padding: 28px 28px 24px` | CARD_STYLE pattern |
| Form input | `var(--panel)` bg, `var(--border)` border 1.5px, height 44-48px, moss focus | FIELD_STYLE pattern |
| Sidebar bg | `var(--subtle)` (FIXED from hardcoded `#F2EDE4`) | layout/Sidebar.tsx |
| Sidebar border | `var(--border)` (FIXED from hardcoded `#DDD7CC`) | layout/Sidebar.tsx |

---

## Inkonsistenzen behoben

| Was | Datei | Fix |
|-----|-------|-----|
| Integrations Page: Tailwind + `var(--goblin-*)` | `settings/integrations/page.tsx` | Inline styles, `var(--text)` etc. |
| Local Settings: kein SettingsLayout | `settings/local/page.tsx` | `SettingsLayout` wrapper hinzugefügt |
| Local Settings: `#fff`, `#e8e4dc` hardcoded | `settings/local/page.tsx` | `var(--panel)`, `var(--border)` |
| ConnectGitHubModal: Tailwind + `bg-white` | `connect-github-modal.tsx` | Komplett auf inline styles + `var(--panel)` |
| PushToGitHubModal: Tailwind + `bg-white` | `push-to-github-modal.tsx` | Komplett auf inline styles + `var(--panel)` |
| Button secondary: `background: 'white'` | `ui/button.tsx` | `var(--panel)` |
| Settings textarea: `background: '#fff'` | `settings/page.tsx` | `var(--panel)` |
| Settings email readonly: `background: '#f7f5f2'` | `settings/page.tsx` | `var(--subtle)` |
| Dashboard StarterCard: `background: '#fff'` | `dashboard/page.tsx` | `var(--panel)` |
| Landing mockup: `background: '#fff'` | `landing/hero.tsx` | `#F7F4ED` (cream) |
| Sidebar dark mode: hardcoded hex | `layout/Sidebar.tsx` | CSS variables |
| Send-to-Code button: white text on ochre | `CodeBlock.tsx` | `#1a1200` dark text |

---

## Noch offene Inkonsistenzen (OFFEN, non-critical)

| Was | Datei | Aufwand |
|-----|-------|---------|
| Zwei Sidebar-Implementierungen (`app-shell/sidebar.tsx` unused) | `/components` | Remove unused file |
| Zwei Header-Implementierungen (`app-shell/topbar.tsx` unused) | `/components` | Remove unused file |
| `app-shell/sidebar.tsx` hat "Neues Projekt" (DE) | Unused | N/A wenn gelöscht |
| `ChatMessages.tsx` EmptyState is dead code (never rendered) | `/workspace` | Remove dead component |

---

## Entscheidungen

- **Sprache:** Englisch als Haupt-Sprache der App-UI (nicht Deutsch)
- **Ochre-Text:** `#1a1200` auf ochre background (WCAG konform)
- **Modal-Schließen:** Click-outside-to-close Standard auf allen neuen Modals
- **CSS-Variablen:** `var(--panel)`, `var(--border)`, `var(--text)` überall, kein hardcoded `#fff` oder `white`
