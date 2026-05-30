/**
 * Loads local env files BEFORE any other module is evaluated. MUST be the very first import
 * in index.ts so that modules which read process.env at load time (lib/env.ts, lib/sentry,
 * etc.) observe the values.
 *
 * On Railway / prod the files are absent and dotenv no-ops — the real injected env wins.
 * dotenv never overrides already-set vars, so the first file loaded wins; we load `.env`
 * first (legacy) then `.env.local` (the file actually present in local dev) to fill gaps.
 */
import { config } from 'dotenv';
import { join } from 'path';
import { fileURLToPath } from 'url';

const here = fileURLToPath(new URL('.', import.meta.url));
config({ path: join(here, '../../../.env') });
config({ path: join(here, '../../../.env.local') });
