#!/usr/bin/env node
/**
 * scripts/wake.mjs
 * Pings the deployed Render instance until it responds with HTTP 200 { status: 'ok' }.
 * Used before running smoke tests or recording demo videos to ensure free-tier cold starts
 * are warmed up.
 */

const targetUrl = process.argv.find((arg) => arg.startsWith('--url='))?.split('=')[1]
  || process.env.DEPLOYED_URL
  || 'https://verify-pay.onrender.com';

const healthzUrl = targetUrl.replace(/\/+$/, '') + '/healthz';
const MAX_ATTEMPTS = 30; // 30 attempts * 4s = 120s max
const INTERVAL_MS = 4000;

console.log(`[wake] Target: ${healthzUrl}`);
console.log(`[wake] Warming up instance (Render free tier cold start may take 30-60s)...`);

const startTime = Date.now();

async function main() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(healthzUrl);
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[wake] Instance is AWAKE and HEALTHY in ${elapsed}s!`);
        console.log(`[wake] Health response:`, JSON.stringify(data));
        return;
      } else {
        console.log(`[wake] Attempt ${attempt}/${MAX_ATTEMPTS}: HTTP ${res.status} (waiting ${INTERVAL_MS / 1000}s)`);
      }
    } catch (err) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[wake] Attempt ${attempt}/${MAX_ATTEMPTS} (${elapsed}s elapsed): ${err.message || 'Connecting...'}`);
    }

    if (attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, INTERVAL_MS));
    }
  }

  console.error(`[wake] Failed to wake instance at ${healthzUrl} after 120s.`);
  process.exitCode = 1;
}

await main();
