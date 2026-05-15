# 9E Backlog — Deferred from 9D (2026-05-15)

## Security / Auth
- 2FA TOTP implementation (otpauth + QR + 6-digit verify + 10 backup-codes) — placeholders in ProfilePage
- Passkeys (WebAuthn via @simplewebauthn) — placeholders in ProfilePage
- Active Sessions list with revoke (DB table `user_sessions`) — placeholder
- Password change flow (Supabase auth.updateUser) — alert stub in ProfilePage
- Konto löschen Confirm-Flow — alert stub in ProfilePage Danger-Zone

## Chat Workflow
- RecentChatRow Context Actions live machen:
  - Pin/Unpin (DB column + endpoint + sidebar sort)
  - Rename Modal (PATCH /api/chat-sessions/:id existiert)
  - Share Modal (publishable share-token)
  - Move to Project (Project-Picker UI)
  - Archive (DB column + endpoint + filter in sidebar)
- ComposerPlusPopover Actions live machen:
  - upload-file (storage upload via Backblaze)
  - screenshot (device camera/file pick)
  - github (GitHub-Connect, repo picker)
  - research (DeepResearch agent flow)
  - websearch — toggle persistent in chat-session metadata

## Project Workflow (9D-7 partial)
- Project-Detail-Page mit Description-Card (editable info)
- Files-Sheet pro Projekt (capacity-bar + drag-drop upload via B2)
- Anweisungen-Sheet (editable system-prompt per project)
- Filter-Pills Integration in /dashboard/projects/[id]: Alle/Angeheftet/Archiviert für Project-Chats
- Project favorites (star-icon)

## Settings polish
- Avatar Upload (currently initials only)
- Dark Mode Switch — Tokens prepared, switch untested
- i18n EN/DE language switch (currently localStorage only, no UI string changes)
- Custom Accent Color (currently disabled "Bald")
- Notifications Sub-Page real (currently stub)
- Privacy Sub-Page real (GDPR export, delete)
- Personalization Sub-Page real (currently stub)
- Konnektoren Sub-Page real (Google, GitHub OAuth — currently /dashboard/settings/integrations existiert separat)

## API Keys (9D-4 partial)
- LiteLLM-Middleware-Hook für `byok_key_usage` write — pro chat-completion: `increment_byok_usage(user_id, provider, tokens_in, tokens_out)`. Currently nur Read-Pfad live.
- ApiKeysPage Add/Remove-Key Inline-Flow (currently Link "Schlüssel verwalten →" zu `/dashboard/settings/keys`)
- Monthly reset cron (period_start logic)

## Notifications
- Web-Push subscription
- In-app notification center

## Avatar Menu
- Desktop-Popover-Variante statt Sheet (besseres Desktop-UX); aktuell Sheet auch auf Desktop
- Provider-Icon (Google/GitHub) im User-Header anzeigen — war im alten Header, fehlt im neuen Sheet

## Reference Screenshots
- Comparison-Doc um konkrete Screenshot-Verweise erweitern: `docs/Reference Screenshots/Mobile/Claude/X.jpeg`

## Already known (pre-9D)
- Supabase Custom Domain `auth.justgoblin.com`
- Stripe Tax activation
- GROQ_FREE_API_KEY removal from Railway (Layer B cleanup)
- ENCRYPTION_KEY setup für CI
