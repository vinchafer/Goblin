import webpush from 'web-push';
import { getSupabaseAdmin } from '../lib/supabase';

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

let _vapidInitialized = false;

function initVapid() {
  if (_vapidInitialized) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const contact = process.env.VAPID_CONTACT || 'mailto:hi@justgoblin.com';
  if (pub && priv) {
    webpush.setVapidDetails(contact, pub, priv);
    _vapidInitialized = true;
  }
}

export async function sendToUser(userId: string, payload: PushPayload): Promise<void> {
  initVapid();
  if (!_vapidInitialized) {
    console.warn('[notifications] VAPID keys not configured — skipping push');
    return;
  }

  const supabase = getSupabaseAdmin();
  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, keys')
    .eq('user_id', userId);

  if (error || !subscriptions?.length) return;

  const body = JSON.stringify(payload);

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys as webpush.PushSubscription['keys'] },
        body
      );
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 410 || status === 404) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', sub.endpoint);
      }
    }
  }
}
