#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

console.log('[secret-scan] Scanning for committed secrets and prohibited live credentials...');

let failed = false;

// 1. Ensure .env files are not tracked in git
try {
  const trackedEnvFiles = execSync('git ls-files ".env*"', { encoding: 'utf8' })
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s && s !== '.env.example');

  if (trackedEnvFiles.length > 0) {
    console.error('[secret-scan] Error: Found tracked .env files in git:');
    trackedEnvFiles.forEach((file) => console.error(`  - ${file}`));
    failed = true;
  }
} catch {
  // If git command fails (e.g. outside git repo), continue with file scan
}

// 2. Scan tracked files for known secret patterns or live endpoints
let files = [];
try {
  files = execSync('git ls-files', { encoding: 'utf8' })
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s && existsSync(s));
} catch {
  // Fallback if git fails
}

const FORBIDDEN_PATTERNS = [
  {
    name: 'Live PayPal endpoint (api-m.paypal.com without sandbox)',
    regex: /https:\/\/api-m\.paypal\.com(?!\/sandbox)/i,
    allowedIn: ['docs/ANTIGRAVITY_GUIDE.md', 'scripts/secret-scan.mjs'],
  },
  {
    name: 'Private Key header',
    regex: /-----BEGIN (RSA|EC|DSA|OPENSSH|PGP)?\s?PRIVATE KEY-----/,
    allowedIn: [],
  },
  {
    name: 'Anthropic Live API Key',
    regex: /sk-ant-api03-[a-zA-Z0-9_\-]{30,}/,
    allowedIn: [],
  },
  {
    name: 'OpenAI Live API Key',
    regex: /sk-proj-[a-zA-Z0-9_\-]{30,}/,
    allowedIn: [],
  },
  {
    name: 'Google API Key',
    regex: /AIza[0-9A-Za-z-_]{35}/,
    allowedIn: [],
  },
];

for (const file of files) {
  // Skip binary or known large files
  if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.ico') || file.endsWith('.pdf')) {
    continue;
  }

  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  for (const { name, regex, allowedIn } of FORBIDDEN_PATTERNS) {
    if (allowedIn.some((allowed) => file.replace(/\\/g, '/').endsWith(allowed))) {
      continue;
    }

    if (regex.test(content)) {
      console.error(`[secret-scan] Violation in ${file}: matches pattern "${name}"`);
      failed = true;
    }
  }
}

if (failed) {
  console.error('[secret-scan] Secret scan FAILED. Remove secrets before committing.');
  process.exit(1);
} else {
  console.log('[secret-scan] Passed: No tracked secrets or prohibited credentials detected.');
  process.exit(0);
}

