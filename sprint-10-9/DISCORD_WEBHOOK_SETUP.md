# Sprint 10.9-4 — Discord Ops Webhook (Founder action)

The weekly founder digest (Mon 09:00 UTC) posts to a Discord webhook. Until you
create it, the digest **writes a file** (`sprint-10-9/digest-YYYY-MM-DD.md`) on
the API host instead of failing — so nothing breaks; you just don't get the
Discord message.

## Create the webhook

1. Discord → your ops server → a channel (e.g. `#goblin-ops`).
2. Channel settings → **Integrations → Webhooks → New Webhook**.
3. Name it "Goblin Ops", **Copy Webhook URL**.

## Wire it

Set the env var on the **Railway API service**:

```
DISCORD_OPS_WEBHOOK_URL=https://discord.com/api/webhooks/XXXX/YYYY
```

Redeploy the API. That's it — the Monday cron now posts there. Optional email
fallback via Resend uses the already-configured Resend key if present.

## Test it now

GitHub → Actions → "Catalog Ops Cron" → Run workflow → job **digest**. Or:

```
curl -X POST "$GOBLIN_API_URL/api/admin/digest/send?test=1" -H "x-admin-key: $ADMIN_API_KEY"
```

The response includes `delivery: 'discord' | 'file'` so you can confirm where it
landed.

## Digest content (OPTION B)

Week range · catalog source = per-user provider-discovery (no library version) ·
catalog changes (models discovered / keys re-validated / keys now-invalid) ·
provider-health incidents + minutes degraded · slug-failures · action-required.
