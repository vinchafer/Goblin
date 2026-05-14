# Goblin Design System

Single source of truth for colors, typography, spacing, and component primitives.

---

## Color Tokens (CSS Variables)

All colors defined in `apps/web/app/globals.css`. Dark-mode overrides via `[data-theme="dark"]` and `@media (prefers-color-scheme: dark)`.

### Brand Colors

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--moss` | `#2D4A2B` | `#3A5E38` | Primary actions, headings, borders |
| `--moss-2` | `#3A5E38` | `#4A7848` | Hover on primary buttons |
| `--moss-3` | `#1E3220` | `#2A4A28` | Deep moss accent |
| `--moss-dark` | `#1A2E18` | `#1A2E18` | Dark panels (topbar dropdown, code bg) — always dark |
| `--moss-border-dark` | `#2D5229` | `#2D5229` | Border on dark panels — always dark |
| `--ochre` | `#D4A94A` | `#E8BF6A` | Accent, CTAs, active underlines |
| `--ochre-2` | `#E8BF6A` | `#F0CF8A` | Hover on ochre |
| `--ochre-dark` | `#C9933A` | `#F0CF8A` | Avatar button bg |
| `--bark` | `#3A2E1F` | `#E8D5B0` | Text on dark surfaces |
| `--bark-dark` | `#2A1F0F` | `#2A1F0F` | Text on ochre backgrounds — always dark |

### Surface Colors

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--cream` | `#F7F4ED` | `#1A1E18` | Page background |
| `--subtle` | `#F0EBE0` | `#1E2420` | Subtle backgrounds, disabled states |
| `--div` | `#EDE8DC` | `#2D3D2B` | Dividers, card borders |
| `--white` | `#FFFFFF` | `#1E2420` | Panel/card backgrounds |
| `--panel` | `#FFFFFF` | `#1E2420` | Same as white, semantic alias |
| `--surface` | `#F7F4ED` | `#1A1E18` | Same as cream, semantic alias |
| `--border` | `#DDD7CC` | `#3D5A3B` | Input borders, row separators |

### Text Colors

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--text` | `#2A2A2A` | `#E8F0E6` | Primary body text |
| `--text-2` | `#4A4A4A` | `#C8D8C6` | Secondary text |
| `--meta` | `#6B6B6B` | `#8AAA85` | Metadata, labels, placeholders |
| `--disabled` | `#ABABAB` | `#4A5A49` | Disabled state |
| `--text-faint` | `#9C9589` | `#6A8A67` | Very subtle text |

### Status Colors

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--success` / `--good` | `#4A7C3B` | `#5AAC4B` | Success states |
| `--error` / `--danger` | `#B85C3C` | `#E87060` | Error states, delete actions |
| `--warning` | `#D4A94A` | `#E8BF6A` | Warnings (same as ochre) |

### Code Editor Colors

| Token | Value | Usage |
|---|---|---|
| `--code-bg` | `#1E2A1C` / `#111A0F` | Editor background |
| `--code-fg` | `#8AAA85` / `#A8D5A2` | Editor default text |
| `--code-root` | `#141A12` / `#0A0F09` | Deepest editor bg |

---

## Typography

Fonts loaded via `next/font/google` in `apps/web/app/layout.tsx`.

| Variable | Font | Usage |
|---|---|---|
| `--font-brand` | Fraunces (serif) | Headlines, logo, section titles |
| `--font-ui` | DM Sans | All UI text, labels, buttons |
| `--font-code` | JetBrains Mono | Code, keys, technical strings |

### Scale (CSS class shortcuts)

- `.font-fraunces` — Fraunces serif
- `.font-mono` — JetBrains Mono

---

## Spacing Scale

| Token | Value | Tailwind equiv |
|---|---|---|
| `--space-1` | 4px | `p-1` |
| `--space-2` | 8px | `p-2` |
| `--space-3` | 12px | `p-3` |
| `--space-4` | 16px | `p-4` |
| `--space-5` | 20px | `p-5` |
| `--space-6` | 24px | `p-6` |
| `--space-8` | 32px | `p-8` |
| `--space-10` | 40px | `p-10` |
| `--space-12` | 48px | `p-12` |

---

## Border Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | 6px | Small badges, tight elements |
| `--radius-md` | 8px | Buttons, inputs |
| `--radius-lg` | 12px | Cards |
| `--radius-xl` | 16px | Modals, large cards |
| `--radius-2xl` | 20px | Full-screen panels |

---

## Shadows

| Token | Usage |
|---|---|
| `--shadow-sm` | Subtle card lift |
| `--shadow-md` | Dropdown, elevated cards |
| `--shadow-lg` | Modals, full-screen overlays |
| `--shadow-ochre` | Ochre-tinted action buttons |

---

## Icon System

Icons from `@phosphor-icons/react`. Import via `<Icon>` wrapper:

```tsx
import { Icon } from '@/components/ui/icon';

<Icon name="Code" weight="bold" size={20} />
```

Weight default: `bold`. Available: `thin | light | regular | bold | fill | duotone`.

---

## Component Primitives (CSS classes)

### Buttons

```html
<button class="btn btn-primary">Save</button>
<button class="btn btn-ochre">Upgrade</button>
<button class="btn btn-ghost">Cancel</button>
<button class="btn btn-danger">Delete</button>

<!-- Sizes -->
<button class="btn btn-primary btn-sm">Small</button>
<button class="btn btn-primary btn-lg">Large</button>
```

### Cards

```html
<div class="card">...</div>
<div class="card card-sm">...</div>
```

### Form Fields

```html
<label class="field-label">API Key</label>
<div class="field-group">
  <input class="input-field" type="text" />
</div>
<textarea class="textarea-field"></textarea>
```

### Sidebar Items

```html
<a class="sidebar-item active" href="...">Settings</a>
<a class="sidebar-item" href="...">Billing</a>
```

### Badges

```html
<span class="badge badge-green">Active</span>
<span class="badge badge-ochre">Pro</span>
<span class="badge badge-gray">Soon</span>
```

### Status Dots

```html
<span class="status-dot green"></span>
<span class="status-dot ochre"></span>
<span class="status-dot red"></span>
<span class="status-dot gray"></span>
```

### Section Headers

```html
<h2 class="section-title">API Keys</h2>
<p class="section-desc">Connect your provider keys to enable AI features.</p>
```

---

## Layout Constants

| Token | Value |
|---|---|
| `--topbar-height` | 48px |
| `--sidebar-width` | 240px |

---

## Animation Utilities

| Class | Effect |
|---|---|
| `.fade-in` | Fade + slide up (0.2s) |
| `.animate-slide-in-left` | Slide from left (0.22s) |
| `.animate-modal-in` | Scale + fade modal (0.15s) |
| `.animate-overlay-in` | Fade overlay (0.15s) |
| `.animate-message-slide` | Chat message appear (0.2s) |
| `.skeleton` | Shimmer loading skeleton |
| `.card-stagger` | Staggered child entrance |
| `.btn-press` | Press scale feedback |

---

## Rules

1. **No hardcoded hex** outside `globals.css`. Use `var(--token)`.
2. **`#fff`** on colored buttons is OK — it's intentional contrast text.
3. **Provider logo SVG colors** (Google, GitHub) are brand-exact — leave them.
4. **Dark-panel surfaces** (`--moss-dark`, `--moss-border-dark`) are intentionally always-dark regardless of theme — used only on the moss-green topbar dropdown.
5. **`--goblin-*` aliases** exist for backwards compatibility. Prefer the non-prefixed vars (`--moss` not `--goblin-moss`).
