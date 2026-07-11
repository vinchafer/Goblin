import pino from 'pino';
import { scrubSecrets } from './scrub-secrets';

const SENSITIVE_PATHS = ['apiKey', 'key', 'secret', 'password', 'token', 'key_encrypted', 'authorization'];

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: { paths: SENSITIVE_PATHS, censor: '[REDACTED]' },
  // D-3: pino's redact is key-name-based only — it misses a secret embedded in a
  // string VALUE (err.message, a response body, a `data` blob). This formatter runs
  // scrubSecrets over every logged object so a key in any value is redacted too.
  formatters: {
    log: (obj: Record<string, unknown>) => scrubSecrets(obj),
  },
  ...(process.env.PRETTY_LOGS === 'true' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    },
  }),
});

export default logger;

export function logRequest(method: string, path: string, status: number, durationMs: number, extra?: Record<string, unknown>) {
  const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
  logger[level]({ method, path, status, duration_ms: durationMs, ...extra }, `${method} ${path} ${status}`);
}

export function logChat(userId: string, model: string, sourceTier: string, inputTokens: number, outputTokens: number) {
  logger.info({ user_id: userId, model, source_tier: sourceTier, input_tokens: inputTokens, output_tokens: outputTokens }, 'chat_completion');
}

// Backwards compat shim
export function log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>) {
  logger[level](meta ?? {}, message);
}
