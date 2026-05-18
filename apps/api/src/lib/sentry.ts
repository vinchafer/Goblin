import * as Sentry from '@sentry/node';

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.RAILWAY_ENVIRONMENT ?? 'production',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.05),
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
    return;
  }
  Sentry.withScope(scope => {
    if (context) scope.setExtras(context);
    Sentry.captureException(err);
  });
}

export function setSentryUser(userId: string, plan?: string) {
  Sentry.setUser({ id: userId });
  if (plan) Sentry.setTag('user_plan', plan);
}

export function setSentryTags(tags: { provider?: string; route?: string; tier?: string }) {
  if (tags.provider) Sentry.setTag('provider', tags.provider);
  if (tags.route) Sentry.setTag('route', tags.route);
  if (tags.tier) Sentry.setTag('tier', tags.tier);
}

export { Sentry };
