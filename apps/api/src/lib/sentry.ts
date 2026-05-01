import * as Sentry from '@sentry/node';

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,
    beforeSend(event) {
      // Never send API keys or secrets to Sentry
      const scrub = ['apiKey', 'key', 'secret', 'password', 'token', 'key_encrypted', 'ENCRYPTION_KEY'];
      if (event.extra) {
        for (const field of scrub) delete event.extra[field];
      }
      return event;
    },
  });
}

export function captureError(err: unknown, context?: Record<string, unknown>) {
  if (!process.env.SENTRY_DSN) {
    console.error('[ERROR]', err, context);
    return;
  }
  Sentry.withScope(scope => {
    if (context) scope.setExtras(context);
    Sentry.captureException(err);
  });
}

export { Sentry };
