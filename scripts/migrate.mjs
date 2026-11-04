#!/usr/bin/env node
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

