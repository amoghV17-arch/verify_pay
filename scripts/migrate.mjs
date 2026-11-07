#!/usr/bin/env node
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

import { initDb, closeDb, applyMigrations } from '../apps/api/dist/db/index.js';

console.log('[db:migrate] Running Drizzle migrations...');
try {
  const db = await initDb();
  await applyMigrations(db);
  console.log('[db:migrate] Migrations applied successfully!');
} catch (err) {
  console.error('[db:migrate] Migration failed:', err);
  process.exit(1);
} finally {
  await closeDb();
}

