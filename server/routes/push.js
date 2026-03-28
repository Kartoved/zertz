import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

// Return VAPID public key so the frontend can subscribe
router.get('/vapid-public-key', (_req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// Save a push subscription for the authenticated user
router.post('/subscribe', authRequired, async (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ error: 'Invalid subscription' });
    return;
  }
  try {
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, endpoint) DO UPDATE SET p256dh = $3, auth = $4`,
      [req.user.id, endpoint, keys.p256dh, keys.auth]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('push subscribe error:', err);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// Remove a push subscription for the authenticated user
router.delete('/unsubscribe', authRequired, async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) {
    res.status(400).json({ error: 'Missing endpoint' });
    return;
  }
  try {
    await pool.query(
      'DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2',
      [req.user.id, endpoint]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('push unsubscribe error:', err);
    res.status(500).json({ error: 'Failed to remove subscription' });
  }
});

export default router;
