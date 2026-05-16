import { Hono } from 'hono';
import { runEvalSuite } from '../lib/eval/runner';
import logger from '../lib/logger';

const internalEval = new Hono();

internalEval.post('/run', async (c) => {
  const secret = c.req.header('x-eval-secret');
  const expected = process.env.EVAL_CRON_SECRET;
  if (!expected || !secret || secret !== expected) {
    return c.json({ error: 'forbidden' }, 403);
  }
  logger.info('eval triggered via internal endpoint');
  const result = await runEvalSuite();
  return c.json(result);
});

export { internalEval };
