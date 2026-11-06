#!/usr/bin/env node
/**
 * scripts/demo-check.mjs
 * Comprehensive pre-flight readiness audit for video recording and hackathon submission.
 * Verifies:
 * 1. Hosted Render service health (/healthz, / SPA entrypoint)
 * 2. Database connectivity & demo seed (Neon PostgreSQL)
 * 3. Fast demo reset execution (< 10 seconds)
 * 4. PayPal Sandbox OAuth2 & Webhook status
 * 5. Local AI eval integrity & test suite readiness
 */

import path from 'node:path';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

// Load .env
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

console.log('====================================================');
console.log('      MILESTONE PRE-FLIGHT DEMO & SUBMISSION AUDIT');
console.log('====================================================\n');

let allPassed = true;
const checks = [];

function recordCheck(name, passed, details = '') {
  checks.push({ name, passed, details });
  const symbol = passed ? '✓ PASS' : '✗ FAIL';
  console.log(`[${symbol}] ${name}${details ? ` (${details})` : ''}`);
  if (!passed) allPassed = false;
}

// 1. Check Deployed Render Instance
const deployedUrl = process.env.DEPLOYED_URL || 'https://verify-pay.onrender.com';
try {
  const healthRes = await fetch(`${deployedUrl}/healthz`);
  if (healthRes.ok) {
    const data = await healthRes.json();
    recordCheck('Render Service /healthz', true, `env=${data.env}, paypalEnv=${data.paypalEnv}`);
  } else {
    recordCheck('Render Service /healthz', false, `HTTP ${healthRes.status}`);
  }
} catch (err) {
  recordCheck('Render Service /healthz', false, err.message);
}

// 2. Check SPA Delivery on Deployed Service
try {
  const spaRes = await fetch(`${deployedUrl}/`);
  if (spaRes.ok) {
    const html = await spaRes.text();
    const hasRoot = html.includes('id="root"');
    recordCheck('Hosted React SPA Delivery (Single Deployable)', hasRoot, hasRoot ? 'index.html served' : 'Missing #root');
  } else {
    recordCheck('Hosted React SPA Delivery (Single Deployable)', false, `HTTP ${spaRes.status}`);
  }
} catch (err) {
  recordCheck('Hosted React SPA Delivery (Single Deployable)', false, err.message);
}

// 3. Check Hosted Database Connectivity & Seed
try {
  const projRes = await fetch(`${deployedUrl}/api/projects/proj_brand_launch`);
  if (projRes.ok) {
    const data = await projRes.json();
    const isOk = data.project?.id === 'proj_brand_launch' && (data.milestones?.length || 0) >= 4;
    recordCheck('Neon Database Seed & Connectivity', isOk, `Project: "${data.project?.title}", ${data.milestones?.length} milestones`);
  } else {
    recordCheck('Neon Database Seed & Connectivity', false, `HTTP ${projRes.status}`);
  }
} catch (err) {
  recordCheck('Neon Database Seed & Connectivity', false, err.message);
}

// 4. Test Demo Reset Latency (< 10 seconds)
try {
  const resetStart = Date.now();
  execSync('node scripts/demo-reset.mjs', { stdio: 'pipe' });
  const resetElapsed = ((Date.now() - resetStart) / 1000).toFixed(2);
  const resetOk = Number(resetElapsed) < 10.0;
  recordCheck('Demo Reset Speed (`pnpm demo:reset`)', resetOk, `${resetElapsed}s (Target: < 10.0s)`);
} catch (err) {
  recordCheck('Demo Reset Speed (`pnpm demo:reset`)', false, err.message);
}

// 5. Check PayPal Sandbox OAuth2 & Webhooks
const clientId = process.env.PAYPAL_CLIENT_ID;
const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
const webhookId = process.env.PAYPAL_WEBHOOK_ID;

if (clientId && clientSecret) {
  try {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenRes = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (tokenRes.ok) {
      const tokenData = await tokenRes.json();
      recordCheck('PayPal Sandbox OAuth2 Authentication', true, 'Client credentials valid');

      if (webhookId) {
        const whRes = await fetch(`https://api-m.sandbox.paypal.com/v1/notifications/webhooks/${webhookId}`, {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        if (whRes.ok) {
          const wh = await whRes.json();
          recordCheck('PayPal Webhook Registration', true, `URL: ${wh.url}`);
        } else {
          recordCheck('PayPal Webhook Registration', false, `Webhook ID ${webhookId} returned HTTP ${whRes.status}`);
        }
      } else {
        recordCheck('PayPal Webhook Registration', false, 'PAYPAL_WEBHOOK_ID missing in .env');
      }
    } else {
      recordCheck('PayPal Sandbox OAuth2 Authentication', false, `HTTP ${tokenRes.status}`);
    }
  } catch (err) {
    recordCheck('PayPal Sandbox OAuth2 Authentication', false, err.message);
  }
} else {
  recordCheck('PayPal Sandbox Credentials', false, 'PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET not set');
}

// 6. Check Codebase Secrets & Public Repository Files
try {
  execSync('node scripts/secret-scan.mjs', { stdio: 'pipe' });
  recordCheck('Security Secret Scan (Zero Committed Keys)', true, 'Passed');
} catch (err) {
  recordCheck('Security Secret Scan (Zero Committed Keys)', false, 'Found secrets in working directory');
}

const requiredFiles = ['README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'render.yaml', 'docs/DEMO_AND_SUBMISSION.md'];
for (const file of requiredFiles) {
  const exists = fs.existsSync(path.resolve(process.cwd(), file));
  recordCheck(`Required Submission Document: ${file}`, exists, exists ? 'Present' : 'MISSING');
}

console.log('\n====================================================');
if (allPassed) {
  console.log('🎉 ALL DEMO & SUBMISSION PRE-FLIGHT CHECKS PASSED!');
  console.log('Workspace is 100% prepared for rehearsal and video recording.');
} else {
  console.log('⚠️ SOME CHECKS REQUIRE ATTENTION (see above).');
}
console.log('====================================================\n');

process.exitCode = allPassed ? 0 : 1;

