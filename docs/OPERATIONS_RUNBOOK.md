# Operations Runbook — Goblin

Stand: 2026-05-15 (Session 9B).

## Quick Reference

| What | Where | Provider |
|---|---|---|
| Production Web | https://justgoblin.com | Vercel |
| Production API | https://goblinapi-production.up.railway.app | Railway |
| DB / Auth | Supabase project `ogrkollxnoawfdkzdmtn` (EU-Frankfurt) | Supabase |
| Object Storage | `goblin-projects` (eu-central-003) | Backblaze B2 |
| Error Tracking | `goblin-web` + `goblin-api` projects | Sentry |
| Uptime | 2 monitors + 1 heartbeat | Better-Stack |
| AI Router | `litellm-proxy` Railway service | LiteLLM |

## Health Endpoints

- `GET https://goblinapi-production.up.railway.app/version` → commit, build time
- `GET https://goblinapi-production.up.railway.app/health` → 200 quick check
- `GET https://goblinapi-production.up.railway.app/health/deep` → per-dependency status (Supabase, B2, LiteLLM, Stripe). 503 = degraded.
- `GET https://justgoblin.com/api/version` → Next.js side

## Admin Dashboards

| Page | What it shows |
|---|---|
| `/admin/costs` | 30-day spend per provider, total + Ø per completion |
| `/admin/evals` | latest eval-run results + 30-day trend per provider |
| `/admin/health` | per-dependency status snapshot |
| `/admin/users` | user list, search, plan tier |
| `/admin/status` | high-level platform status |

Access: only users with `users.is_admin = true` in Supabase.

## Incident Response

### Sentry alert: spike of 5xx on API

1. Open Sentry → group by stack trace
2. `railway logs --service goblin-api` for live logs
3. Check `/health/deep` — is Supabase, B2, or LiteLLM down?
4. If LiteLLM down: Railway → restart `litellm-proxy` service
5. If Supabase down: check status.supabase.com — wait, post status
6. If unknown root cause: `git revert HEAD && git push`

### Better-Stack alert: justgoblin.com unreachable

1. Check Vercel deployments for build failure
2. `dig justgoblin.com` — Cloudflare/DNS healthy?
3. Vercel UI → redeploy last known-good commit

### Better-Stack alert: Eval-Heartbeat missing (>25h)

1. Railway → goblin-api → logs → search "eval suite"
2. Manual trigger:
   ```bash
   curl -X POST https://goblinapi-production.up.railway.app/api/internal/eval/run \
     -H "x-eval-secret: $EVAL_CRON_SECRET"
   ```
3. If Anthropic/OpenAI/Gemini/Groq key expired → rotate `EVAL_*_KEY` in Railway env

## Routine Maintenance

### Weekly (Vincent, Sundays)
- Triage Sentry inbox
- Open `/admin/costs` — spend trend OK?
- Open `/admin/evals` — quality regression vs. prior week?

### Monthly
- Verify Supabase backup snapshot exists (Supabase → Backups)
- Rotate `EVAL_CRON_SECRET`
- Update `apps/api/src/lib/model-pricing.ts` with current provider pricing

### Quarterly
- Restore Supabase backup to staging-DB → verify integrity
- Sentry retention review (free plan = 30 days)
- Review BYOK key-rotation reminders to users

## Backup Strategy

- **Postgres:** Supabase Free Plan = daily auto-backup, 7-day retention. Pro upgrade for longer.
- **Object Storage:** B2 versioning ON → last 7 days of overwrites/deletes recoverable
- **Code:** GitHub + master branch (protection rules TBD)
- **Secrets:** Vincent maintains a private 1Password vault per environment

## Monthly Cost Snapshot

| Service | Plan | USD/month |
|---|---|---|
| Vercel | Hobby | $0 |
| Railway | Hobby + add-ons | ~$10 |
| Supabase | Free | $0 |
| Backblaze B2 | Pay-per-use | < $1 |
| Sentry | Developer | $0 |
| Better-Stack | Free | $0 |
| Cloudflare | Free | $0 |
| Resend | Free | $0 |
| **Infra total** | | **~$10** |
| Eval-Runner spend | hard cap per provider | ~$15 |

## Escalation

- Vincent: Telegram, +41 (CH)
- Emergency only: see private contacts doc
