import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

type Variables = { userId: string };
const notifications = new Hono<{ Variables: Variables }>();

// Protected routes
notifications.use('/subscribe', authMiddleware);
notifications.use('/unsubscribe', authMiddleware);
notifications.use('/test', authMiddleware);

// Set up VAPID details once
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidContact = process.env.VAPID_CONTACT || 'mailto:hi@justgoblin.com';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidContact, vapidPublicKey, vapidPrivateKey);
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST /api/notifications/subscribe
notifications.post('/subscribe', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  const schema = z.object({
    subscription: z.object({
      endpoint: z.string(),
      keys: z.object({
        p256dh: z.string(),
        auth: z.string(),
      }),
    }),
  });

  const result = schema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Invalid subscription data' }, 400);
  }

  const { endpoint, keys } = result.data.subscription;
  const supabase = getSupabase();

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: userId,
        endpoint,
        keys,
      },
      { onConflict: 'user_id, endpoint' }
    );

  if (error) {
    console.error('Failed to save push subscription:', error);
    return c.json({ error: 'Failed to save subscription' }, 500);
  }

  return c.json({ success: true });
});

// POST /api/notifications/unsubscribe
notifications.post('/unsubscribe', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  const schema = z.object({
    endpoint: z.string(),
  });

  const result = schema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Invalid request' }, 400);
  }

  const supabase = getSupabase();

  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', result.data.endpoint);

  return c.json({ success: true });
});

// POST /api/notifications/test — sends test push to current user
notifications.post('/test', async (c) => {
  const userId = c.get('userId');

  if (!vapidPublicKey || !vapidPrivateKey) {
    return c.json({ error: 'Push notifications not configured' }, 500);
  }

  const supabase = getSupabase();

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, keys')
    .eq('user_id', userId);

  if (error || !subscriptions || subscriptions.length === 0) {
    return c.json({ error: 'No subscriptions found. Enable notifications first.' }, 400);
  }

  const payload = JSON.stringify({
    title: 'Goblin Test',
    body: '🔔 Push notifications are working!',
    url: '/dashboard',
  });

  let sent = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: sub.keys as webpush.PushSubscription['keys'],
        },
        payload
      );
      sent++;
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', sub.endpoint);
      }
    }
  }

  return c.json({ sent, message: sent > 0 ? 'Test notification sent' : 'No notifications sent' });
});

// POST /api/notifications/send (internal — requires CRON_SECRET header)
notifications.post('/send', async (c) => {
  const secret = c.req.header('x-cron-secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const body = await c.req.json();

  const schema = z.object({
    userId: z.string().uuid(),
    title: z.string(),
    body: z.string(),
    url: z.string().optional(),
  });

  const result = schema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Invalid request' }, 400);
  }

  const { userId, title, body: notificationBody, url } = result.data;

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error('VAPID keys not configured — cannot send push notification');
    return c.json({ error: 'Push notifications not configured' }, 500);
  }

  const supabase = getSupabase();

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, keys')
    .eq('user_id', userId);

  if (error || !subscriptions || subscriptions.length === 0) {
    return c.json({ sent: 0 });
  }

  const payload = JSON.stringify({
    title,
    body: notificationBody,
    url: url || '/dashboard',
  });

  let sent = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: sub.keys as webpush.PushSubscription['keys'],
        },
        payload
      );
      sent++;
    } catch (err: any) {
      // If subscription is expired/invalid, remove it
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', sub.endpoint);
      }
      console.error('Push send failed for endpoint:', sub.endpoint, err.message);
    }
  }

  return c.json({ sent });
});

// Service function exported for use by other route modules
export async function sendPushNotification(
  userId: string,
  notification: { title: string; body: string; url?: string }
): Promise<void> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('VAPID keys not configured — skipping push notification');
    return;
  }

  const supabase = getSupabase();

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, keys')
    .eq('user_id', userId);

  if (error || !subscriptions || subscriptions.length === 0) {
    return;
  }

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    url: notification.url || '/dashboard',
  });

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: sub.keys as webpush.PushSubscription['keys'],
        },
        payload
      );
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', sub.endpoint);
      }
    }
  }
}

export { notifications };