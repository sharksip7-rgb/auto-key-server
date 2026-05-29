const nodemailer = require('nodemailer');

const SECRET = 'VBP-SAID-TANJA-2024';
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const SMTP_HOST = process.env.SMTP_HOST || 'mail.privateemail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const PADDLE_API_KEY = process.env.PADDLE_API_KEY;

function computeChecksum(raw) {
  const seed = SECRET + raw;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  let n = Math.abs(hash);
  for (let i = 0; i < 4; i++) {
    result += chars[n % chars.length];
    n = Math.floor(n / chars.length);
  }
  return result;
}

function generateKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let p1='', p2='', p3='';
  for (let i=0;i<4;i++) p1 += chars[Math.floor(Math.random()*chars.length)];
  for (let i=0;i<4;i++) p2 += chars[Math.floor(Math.random()*chars.length)];
  for (let i=0;i<4;i++) p3 += chars[Math.floor(Math.random()*chars.length)];
  const raw = p1+p2+p3;
  return `VBP-${p1}-${p2}-${p3}-${computeChecksum(raw)}`;
}

async function getCustomerEmail(customerId) {
  try {
    const res = await fetch(`https://api.paddle.com/customers/${customerId}`, {
      headers: {
        'Authorization': `Bearer ${PADDLE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await res.json();
    console.log('Customer data:', JSON.stringify(data));
    return data?.data?.email || null;
  } catch(e) {
    console.error('Failed to get customer email:', e.message);
    return null;
  }
}

async function saveToSupabase(email, licenseKey, plan) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/licenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ email, license_key: licenseKey, plan })
    });
    console.log(`✅ Saved to Supabase: ${email}`);
  } catch(e) {
    console.error('Supabase error:', e.message);
  }
}

async function sendLicenseEmail(customerEmail, licenseKey, productName) {
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    tls: { rejectUnauthorized: false }
  });

  const isLifetime = productName && productName.toLowerCase().includes('lifetime');
  const planName = isLifetime ? 'Lifetime Pro' : 'Monthly Pro';

  await transporter.sendMail({
    from: `"VolumeBooster Support" <${EMAIL_USER}>`,
    to: customerEmail,
    subject: 'Your Volume Booster AI — License Key 🎉',
    html: `
      <div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:20px">
        <div style="text-align:center;margin-bottom:28px">
          <img src="https://volumebooster.cc/wp-content/uploads/2026/05/cropped-cropped-icon128-37x37.png" width="56" height="56" style="border-radius:14px;display:block;margin:0 auto" alt="Volume Booster AI"/>
          <h1 style="color:#1a1a1a;margin:14px 0 4px;font-size:22px">Volume Booster AI</h1>
          <p style="color:#888;margin:0;font-size:14px">Your ${planName} is ready!</p>
        </div>
        <div style="background:#fffbeb;border:2px solid #ffcc00;border-radius:14px;padding:22px;margin-bottom:24px;text-align:center">
          <p style="color:#92400e;font-size:12px;font-weight:700;margin:0 0 10px;text-transform:uppercase;letter-spacing:1px">Your License Key</p>
          <div style="background:#1a1a1a;color:#ffcc00;font-family:monospace;font-size:20px;font-weight:800;padding:14px 20px;border-radius:8px;letter-spacing:2px">
            ${licenseKey}
          </div>
        </div>
        <div style="background:#f9f9f9;border-radius:12px;padding:20px;margin-bottom:24px">
          <h3 style="color:#1a1a1a;margin:0 0 14px;font-size:15px">How to activate:</h3>
          <ol style="color:#555;font-size:14px;line-height:2;margin:0;padding-left:20px">
            <li>Open <strong>Volume Booster AI</strong> in Chrome</li>
            <li>Click the <strong>👑 Pro</strong> tab</li>
            <li>Paste your key and click <strong>Activate</strong></li>
            <li>All Pro features unlock instantly! 🎉</li>
          </ol>
        </div>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;margin-bottom:24px">
          <p style="color:#166534;font-size:13px;font-weight:700;margin:0 0 8px">✅ Pro Features Unlocked:</p>
          <p style="color:#15803d;font-size:13px;margin:0;line-height:1.8">
            🚀 Volume boost up to 1500%+<br/>
            🎚 10-Band Advanced Equalizer<br/>
            🎵 Pro Presets — Music, Movies, Gaming<br/>
            😴 Sleep Timer<br/>
            🎛 Multi-tab Mixer
          </p>
        </div>
        <p style="color:#aaa;font-size:12px;text-align:center;margin:0">
          Need help? Reply to this email<br/>
          <a href="https://volumebooster.cc" style="color:#b45309">volumebooster.cc</a>
        </p>
      </div>
    `
  });
  console.log(`✅ Email sent to ${customerEmail}: ${licenseKey}`);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ status: 'Volume Booster AI — Auto Key Server Running ✅' });
  }

  try {
    const body = req.body;
    const eventType = body?.event_type || body?.alert_name;
    console.log('Webhook received:', eventType);

    const paymentEvents = ['transaction.completed', 'subscription.created'];
    if (!paymentEvents.includes(eventType)) {
      return res.status(200).json({ message: 'Event ignored', event: eventType });
    }

    // Get customer_id from payload
    const customerId = body?.data?.customer_id;
    console.log('Customer ID:', customerId);

    if (!customerId) {
      return res.status(400).json({ error: 'No customer_id found' });
    }

    // Fetch email from Paddle API
    const customerEmail = await getCustomerEmail(customerId);
    console.log('Customer email:', customerEmail);

    if (!customerEmail) {
      return res.status(400).json({ error: 'Could not fetch customer email' });
    }

    const productName = body?.data?.items?.[0]?.price?.description || 'Pro';
    const licenseKey = generateKey();

    await Promise.all([
      saveToSupabase(customerEmail, licenseKey, productName),
      sendLicenseEmail(customerEmail, licenseKey, productName)
    ]);

    return res.status(200).json({ success: true, key: licenseKey, email: customerEmail });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
};
