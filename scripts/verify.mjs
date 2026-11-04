#!/usr/bin/env node
import { execSync } from 'node:child_process';

const steps = [
  { name: 'Secret Scan', cmd: 'node scripts/secret-scan.mjs' },
  { name: 'ESLint', cmd: 'pnpm run lint' },
  { name: 'TypeScript Typecheck', cmd: 'pnpm run typecheck' },
  { name: 'Unit & Integration Tests (Vitest)', cmd: 'pnpm run test' },
  { name: 'E2E Tests (Playwright)', cmd: 'pnpm run test:e2e' },
];

console.log('========================================');
console.log('Running Milestone Verification Suite');
console.log('========================================\n');

for (const step of steps) {
  console.log(`--> [${step.name}] running: ${step.cmd}`);
  try {
    execSync(step.cmd, { stdio: 'inherit', env: process.env });
    console.log(`[${step.name}] PASSED\n`);
  } catch {
    console.error(`\n[${step.name}] FAILED!`);
    process.exit(1);
  }
}

console.log('========================================');
console.log('ALL VERIFICATION CHECKS PASSED!');
console.log('========================================');

