# Bug → File Map (Phase 0, 6.4)

## Phase A (onboarding)
| Slice | Bug | File(s) |
|-------|-----|---------|
| A-S1 | Step 0 language (new) | `app/welcome/language/page.tsx` (new), `chrome.tsx`, `users.ts`, migration 0059 |
| A-S2 | Step 1 green-on-green (PATH B footer tags + arrow) | `app/welcome/page.tsx` |
| A-S3 | Letter-avatar providers | `app/welcome/provider/page.tsx`, new `public/brand/providers/*`, new `components/onboarding/ProviderLogo.tsx` |
| A-S4 | Links not clickable + Fireworks + Pro disclosure | `app/welcome/provider/page.tsx` |
| A-S5 | Empty dark-green panels | `app/welcome/provider/page.tsx` |
| A-S6 | Layer story rewrite + waitlist | `app/welcome/routing/page.tsx`, `api/src/routes/` (new waitlist route), migration 0060 |
| A-S7 | Step 3 bullet contrast | `app/welcome/routing/page.tsx` |
| A-S8 | Toggles circles→rect, honest tools, green panel | `app/welcome/tools/page.tsx`, verify `api/src/lib` agent tools |
| A-S9 | Step 5 re-skin + mobile hint + Supabase/Railway | `app/welcome/integrations/page.tsx` |
| A-S10 | GitHub redirect_uri | `api/src/routes/github.ts` |
| A-S11 | Land at project-create not Chat | `app/welcome/integrations/page.tsx` (Start building), dashboard |
| A-S12 | Back btn spacing + step counter 5→6 | `chrome.tsx`, step pages eyebrows |

## Phase B (core flow)
| Slice | Bug | File(s) |
|-------|-----|---------|
| B-S1 | Code ModelPicker: connected-only, scrollable, auto-select | `components/code/SessionModelPicker.tsx`, `components/code/SessionPromptInput.tsx` |
| B-S2 | Chat composer ModelPicker | `components/chat/ChatInput.tsx` |
| B-S3 | "Sag Goblin" → project-or-chat modal | `app/dashboard/page.tsx` |
| B-S4 | Send-to-Code without project | `components/chat/CodeBlock.tsx` / `Message.tsx` + project picker modal |
| B-S5 | Vercel Öffnen/Kopieren 404 | `api/src/routes/deploy.ts` |
| B-S6 | Sidebar Chats+ size + new-project from any page | `components/layout/Sidebar.tsx` |
| B-S7 | Settings scroll spring + Modelle/Groq old UI | `app/dashboard/settings/*` |
| B-S8 | New-project modal mobile scaling | `components/projects/new-project-modal.tsx` + `components/app-shell/new-project-modal.tsx` (determine canonical) |
| B-S9 | Viewport meta (disable zoom app routes) | `app/layout.tsx`, dashboard/welcome layouts |
| B-S10 | Old GoblinLogo regression hunt | grep `GMark`/old logo across `web/`; loading.tsx files |
| B-S11 | Chat code-block `</>` icon position | `components/chat/CodeBlock.tsx` |

## Notes
- Deploy route is `deploy.ts` (not `vercel.ts`).
- GoblinLogo canonical: `components/brand/GoblinLogo.tsx`. `GMark` used in onboarding chrome.
- TWO new-project modals exist (`app-shell/` + `projects/`) — resolve in B-S8.
