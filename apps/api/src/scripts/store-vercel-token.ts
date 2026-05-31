// One-time (Sprint 2 B1): store the test-Vercel-account token as the test user's 'vercel'
// connection, through the real storeVercelToken flow so encryption matches decryption.
// Run: pnpm --filter @goblin/api exec tsx src/scripts/store-vercel-token.ts
import '../load-env.js';
import { resolveTestUserId } from '../lib/supabase.js';
import { storeVercelToken, getVercelConnection } from '../services/byok-service.js';

const token = process.env.VERCEL_TOKEN_SCOPE;
if (!token) { console.error('VERCEL_TOKEN_SCOPE not set'); process.exit(1); }

const tid = await resolveTestUserId();
console.log('resolved test user id:', tid);
if (!tid) { console.error('could not resolve test user id'); process.exit(1); }

const r = await storeVercelToken(tid, token);
console.log('stored vercel token for test user. account:', JSON.stringify(r.account));

const conn = await getVercelConnection(tid);
console.log('verify getVercelConnection:', JSON.stringify(conn));
process.exit(0);
