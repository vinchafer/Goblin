import { config } from 'dotenv';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
config({ path: join(__dirname, '../../../.env') });

import { initSentry } from '../src/lib/sentry';
import { runEvalSuite } from '../src/lib/eval/runner';

async function main(): Promise<void> {
  initSentry();
  console.log('Manually triggering eval suite...');
  const result = await runEvalSuite();
  console.log('Done:', JSON.stringify(result, null, 2));
  process.exit(result.failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
