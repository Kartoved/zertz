const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@zertz.online';

/**
 * Send an email via Resend API.
 * Falls back to console.log if RESEND_API_KEY is not set (dev mode).
 */
export async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    console.log(`\n[EMAIL DEV] To: ${to}\nSubject: ${subject}\n${html.replace(/<[^>]+>/g, '')}\n`);
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Email send failed: ${JSON.stringify(err)}`);
  }
}
