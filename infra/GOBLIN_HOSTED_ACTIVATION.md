# Goblin-Hosted Activation Guide

**Estimated time: ~1 hour from decision to live**

## Prerequisites

- Vast.ai account with $30-50 credits
- Access to Railway dashboard (API env vars)
- Supabase migration 0035 already applied (goblin_hosted_usage table)

---

## Step 1: Vast.ai Instance Setup (~20 min)

1. Go to [vast.ai](https://vast.ai/console/create/) → Create new instance
2. Select template: **vLLM** (search "vllm" in templates)
3. Recommended GPU: **RTX 3060 (~$0.10-0.15/h, ~$80/mo max)** for Qwen 14B
   - More power: **RTX 4090 (~$0.40/h, ~$290/mo max)** for Llama 70B
4. Disk: 40 GB minimum
5. Environment variables to set in Vast.ai instance:
   ```
   MODEL=Qwen/Qwen2.5-Coder-14B-Instruct
   TENSOR_PARALLEL_SIZE=1
   MAX_MODEL_LEN=8192
   ```
6. Click "Rent" — instance boots in ~5 minutes
7. Once running, note the **Public IP + Port** from the instance dashboard

---

## Step 2: Verify vLLM is Running (~5 min)

```bash
# Replace with your Vast.ai public address
curl http://<VAST_IP>:<PORT>/health
# Expected: {"status":"ok"}

curl http://<VAST_IP>:<PORT>/v1/models
# Expected: list with Qwen model
```

---

## Step 3: Set Railway Environment Variables (~5 min)

In Railway dashboard → Goblin API service → Variables:

```
GOBLIN_HOSTED_ENABLED=true
GOBLIN_HOSTED_URL=http://<VAST_IP>:<PORT>
GOBLIN_HOSTED_API_KEY=goblin-internal
```

Also set in Vercel (for frontend feature flag):
```
NEXT_PUBLIC_GOBLIN_HOSTED_ENABLED=true
```

---

## Step 4: Verify Health Check (~2 min)

```bash
curl https://goblinapi-production.up.railway.app/health/deep
```

Expected: `goblin_hosted: { status: "active" }` (or similar)

---

## Step 5: Test a Chat Request (~5 min)

In the Goblin dashboard:
1. Log in as a test user
2. Open chat — the model picker should now show Goblin-Hosted models (no "Coming Soon" badge)
3. Select Qwen Coder 14B and send a message

---

## Rollback

If something goes wrong:
1. Set `GOBLIN_HOSTED_ENABLED=false` in Railway → redeploy
2. Set `NEXT_PUBLIC_GOBLIN_HOSTED_ENABLED=false` in Vercel → redeploy
3. Stop the Vast.ai instance to stop billing

---

## Cost Estimates

| GPU | Model | $/hour | $/month (24/7) | Recommended for |
|-----|-------|--------|----------------|-----------------|
| RTX 3060 | Qwen 14B | ~$0.12 | ~$86 | Phase 1 launch |
| RTX 4090 | Llama 70B | ~$0.40 | ~$288 | After 50+ paying users |
| 2x RTX 4090 | Both models | ~$0.80 | ~$576 | After 100+ paying users |

**Important:** Stop the instance when usage is < 5 requests/day to save costs.
Use Vast.ai's "sleep" feature or set up auto-shutdown via their API.

---

## Trigger Conditions (from Strategy V1)

Activate Layer C when one of:
- Vincent has received funding, OR
- 30+ paying users request Goblin-Hosted, OR
- BYOK adoption < 50% (users want models without their own keys)
