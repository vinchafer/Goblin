import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,
  integrations: [Sentry.replayIntegration()],
  beforeSend(event) {
    // Strip sensitive fields from error context
    if (event.extra) {
      const scrub = ['apiKey', 'key', 'secret', 'password', 'token', 'key_encrypted'];
      for (const field of scrub) delete event.extra[field];
    }
    return event;
  },
});
