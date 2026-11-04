#!/usr/bin/env node
import { initDb, closeDb } from '../apps/api/dist/db/index.js';
import { seedDatabase } from '../apps/api/dist/db/seed.js';

console.log('[db:seed] Seeding database with demo personas and sample project...');
try {
  const db = await initDb();
  await seedDatabase(db);
  console.log('[db:seed] Seed completed successfully!');
} catch (err) {
  console.error('[db:seed] Seed failed:', err);
  process.exit(1);
} finally {
  await closeDb();
}

