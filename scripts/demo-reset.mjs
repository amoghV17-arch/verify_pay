#!/usr/bin/env node
/**
 * scripts/demo-reset.mjs
 * Wipes transient activity, reviews, deliverables, and ledger state,
 * and restores clean demo personas and default project in under 10 seconds.
 */
import path from 'node:path';
import fs from 'node:fs';

// Load .env if present
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

import { initDb, closeDb, resetDemoDatabase } from '../apps/api/dist/db/index.js';

async function main() {
  const startTime = Date.now();
  console.log('[demo:reset] Resetting Milestone workspace to fresh demo state...');

  try {
    let db;
    try {
      db = await initDb({ skipMigrations: true });
      await resetDemoDatabase(db);
    } catch {
      await closeDb();
      db = await initDb();
      await resetDemoDatabase(db);
    }

    const elapsedMs = Date.now() - startTime;
    const elapsedSeconds = (elapsedMs / 1000).toFixed(2);

    console.log(`[demo:reset] Reset completed in ${elapsedSeconds}s (Target: < 10.0s).`);

    if (elapsedMs > 10000) {
      console.warn(`[demo:reset] WARNING: Reset took longer than 10 seconds (${elapsedSeconds}s).`);
    } else {
      console.log('[demo:reset] SUCCESS: Workspace restored cleanly for demo recording.');
    }
  } catch (err) {
    console.error('[demo:reset] ERROR: Failed to reset demo database:', err);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

main().catch((err) => {
  console.error('[demo:reset] Fatal error:', err);
  process.exit(1);
});

