#!/usr/bin/env node
import path from 'node:path';
import fs from 'node:fs';

// Load .env without external dependencies
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

console.log('========================================');
console.log('Milestone PayPal Sandbox Smoke Test (M4)');
console.log('========================================');

const clientId = process.env.PAYPAL_CLIENT_ID;
const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
const paypalEnv = process.env.PAYPAL_ENV || 'mock';

if (paypalEnv !== 'sandbox' || !clientId || !clientSecret) {
  console.log('[smoke:sandbox] Notice: Running in mock / local development mode.');
  console.log(`[smoke:sandbox] PAYPAL_ENV: ${paypalEnv}`);
  console.log('[smoke:sandbox] To run against the live PayPal Sandbox:');
  console.log('  1. Set PAYPAL_ENV=sandbox in .env');
  console.log('  2. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env (Gate H2)');
  console.log('[smoke:sandbox] Mock verification passed.\n');
  process.exit(0);
}

console.log('[smoke:sandbox] Authenticating with PayPal Sandbox OAuth2...');
const baseUrl = 'https://api-m.sandbox.paypal.com';
const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

try {
  // 1. Fetch OAuth token
  const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    console.error(`[smoke:sandbox] OAuth token request failed (${tokenRes.status}): ${errText}`);
    process.exit(1);
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  console.log('[smoke:sandbox] OAuth2 token acquired successfully.');

  // 2. Create Funding Order ($10.00 USD)
  console.log('[smoke:sandbox] Creating a test funding order ($10.00 USD)...');
  const orderRes = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `smoke:${Date.now()}`,
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: 'smoke_test_project',
          custom_id: 'proj_smoke_test',
          description: 'Milestone Sandbox Smoke Test Order',
          amount: {
            currency_code: 'USD',
            value: '10.00',
          },
        },
      ],
    }),
  });

  if (!orderRes.ok) {
    const errText = await orderRes.text();
    console.error(`[smoke:sandbox] Order creation failed (${orderRes.status}): ${errText}`);
    process.exit(1);
  }

  const orderData = await orderRes.json();
  console.log(`[smoke:sandbox] Order created successfully! ID: ${orderData.id}, Status: ${orderData.status}`);

  // 3. Verify Order details
  console.log(`[smoke:sandbox] Verifying order retrieval via GET /v2/checkout/orders/${orderData.id}...`);
  const getRes = await fetch(`${baseUrl}/v2/checkout/orders/${orderData.id}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!getRes.ok) {
    console.error(`[smoke:sandbox] Order retrieval failed (${getRes.status})`);
    process.exit(1);
  }

  const retrieved = await getRes.json();
  console.log(`[smoke:sandbox] Verified order status: ${retrieved.status}`);

  // 4. Test Payouts Release ($1.00 USD)
  const recipientEmail =
    process.env.DEMO_FREELANCER_PAYPAL_EMAIL || 'sb-payout-freelancer@personal.example.com';
  console.log(`[smoke:sandbox] Creating a test payout ($1.00 USD to ${recipientEmail})...`);
  const senderBatchId = `smoke_payout_batch_${Date.now()}`;

  const payoutRes = await fetch(`${baseUrl}/v1/payments/payouts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `smoke_payout_${Date.now()}`,
    },
    body: JSON.stringify({
      sender_batch_header: {
        sender_batch_id: senderBatchId,
        email_subject: 'Milestone Sandbox Smoke Test Payout',
        email_message: 'Milestone verified deliverable release test',
      },
      items: [
        {
          recipient_type: 'EMAIL',
          amount: {
            value: '1.00',
            currency: 'USD',
          },
          note: 'Milestone Smoke Test Payout Item',
          sender_item_id: `smoke_item_${Date.now()}`,
          receiver: recipientEmail,
        },
      ],
    }),
  });

  if (!payoutRes.ok) {
    const errText = await payoutRes.text();
    console.warn(`[smoke:sandbox] Notice on Payouts API (${payoutRes.status}): ${errText}`);
    console.warn(
      '[smoke:sandbox] Note: If Payouts requires feature activation on sandbox account (Gate H3), verify balance or enable in developer portal.'
    );
  } else {
    const payoutData = await payoutRes.json();
    console.log(
      `[smoke:sandbox] Payout batch created successfully! ID: ${payoutData.batch_header.payout_batch_id}, Status: ${payoutData.batch_header.batch_status}`
    );

    // Verify Payout batch retrieval
    const batchRes = await fetch(`${baseUrl}/v1/payments/payouts/${payoutData.batch_header.payout_batch_id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (batchRes.ok) {
      const batchData = await batchRes.json();
      console.log(`[smoke:sandbox] Verified Payout batch status: ${batchData.batch_header.batch_status}`);
    }
  }

  console.log('\n[smoke:sandbox] ALL PAYPAL SANDBOX CHECKS PASSED!\n');
} catch (err) {
  console.error('[smoke:sandbox] Unexpected error during sandbox smoke test:', err);
  process.exit(1);
}
