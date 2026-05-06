const PUSH_PREF_KEY = 'zertz_push_enabled';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function getVapidPublicKey(): Promise<string> {
  const res = await fetch('/api/push/vapid-public-key');
  const data = await res.json();
  return data.publicKey as string;
}

export function getPushPref(): boolean {
  const val = localStorage.getItem(PUSH_PREF_KEY);
  if (val === null) return true; // default: enabled for new users
  return val === 'true';
}

export async function initPushIfFirstVisit(): Promise<boolean> {
  if (localStorage.getItem(PUSH_PREF_KEY) !== null) return false; // user already made a choice
  const ok = await subscribeToPush();
  if (!ok) setPushPref(false);
  return ok;
}

export function setPushPref(value: boolean): void {
  localStorage.setItem(PUSH_PREF_KEY, String(value));
}

export async function subscribeToPush(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const registration = await navigator.serviceWorker.ready;
    const vapidPublicKey = await getVapidPublicKey();
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
    });

    const sub = subscription.toJSON();
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.keys?.p256dh, auth: sub.keys?.auth },
      }),
    });

    setPushPref(true);
    return true;
  } catch (err) {
    console.error('subscribeToPush error:', err);
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await fetch('/api/push/unsubscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      await subscription.unsubscribe();
    }
  } catch (err) {
    console.error('unsubscribeFromPush error:', err);
  }
  setPushPref(false);
}

export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js');

    // When a new SW is detected and reaches the "installed" state while an
    // existing SW controls the page, ask it to skip waiting and reload once
    // it takes control. This lets bundle updates land without the user
    // needing to close every tab.
    registration.addEventListener('updatefound', () => {
      const incoming = registration.installing;
      if (!incoming) return;
      incoming.addEventListener('statechange', () => {
        if (incoming.state === 'installed' && navigator.serviceWorker.controller) {
          incoming.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });

    // After the new SW takes over, reload the page so the fresh shell loads.
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });

    // Probe for updates on registration (fires off-main-thread, no harm if none).
    registration.update().catch(() => { /* ignore */ });
  } catch (err) {
    console.error('SW registration failed:', err);
  }
}

function authHeader(): Record<string, string> {
  const token = localStorage.getItem('zertz_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}
