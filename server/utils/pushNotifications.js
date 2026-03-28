import webPush from 'web-push';
import { pool } from '../db.js';

webPush.setVapidDetails(
  'mailto:admin@zertz.online',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

/**
 * Send a push notification to all subscriptions of a given user.
 * Silently removes expired/invalid subscriptions (410/404).
 */
export async function sendPushToUser(userId, payload) {
  let rows;
  try {
    const result = await pool.query(
      'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1',
      [userId]
    );
    rows = result.rows;
  } catch (err) {
    console.error('push: failed to fetch subscriptions', err);
    return;
  }

  const payloadStr = JSON.stringify(payload);

  await Promise.all(rows.map(async (sub) => {
    try {
      await webPush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payloadStr
      );
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        // Subscription expired — remove it
        await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]).catch(() => {});
      } else {
        console.error('push: send error', err.statusCode, err.body);
      }
    }
  }));
}
