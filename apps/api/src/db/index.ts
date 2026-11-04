import { drizzle as drizzlePg, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite, PgliteDatabase } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './schema.js';

const { Pool } = pg;

export type AppDatabase = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

let dbInstance: AppDatabase | null = null;
let pgliteClient: PGlite | null = null;
let pgPool: pg.Pool | null = null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initDb(options?: { useMemory?: boolean; databaseUrl?: string }): Promise<AppDatabase> {
  const isTest = process.env.NODE_ENV === 'test' || options?.useMemory;
  const dbUrl = options?.databaseUrl || process.env.DATABASE_URL;

  // Use in-memory PGlite for tests or when no DATABASE_URL is provided
  if (isTest || !dbUrl) {
    if (!pgliteClient) {
      pgliteClient = new PGlite();
    }
    const db = drizzlePglite(pgliteClient, { schema });
    dbInstance = db;
    await applyMigrations(db);
    return db;
  }

  // Use standard PostgreSQL Pool
  if (!pgPool) {
    pgPool = new Pool({ connectionString: dbUrl });
  }
  const db = drizzlePg(pgPool, { schema });
  dbInstance = db;
  return db;
}

export function getDb(): AppDatabase {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDb() before accessing getDb().');
  }
  return dbInstance;
}

export async function closeDb(): Promise<void> {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
  if (pgliteClient) {
    await pgliteClient.close();
    pgliteClient = null;
  }
  dbInstance = null;
}

/**
 * Applies SQL migrations to the database.
 */
export async function applyMigrations(db: AppDatabase): Promise<void> {
  const migrationsDir = path.resolve(__dirname, '../../drizzle');
  if (!fs.existsSync(migrationsDir)) return;

  const sqlFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of sqlFiles) {
    const filePath = path.join(migrationsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const statements = content
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      try {
        if ('query' in db) {
          // PGlite direct query or sql
          if (pgliteClient) {
            await pgliteClient.query(statement);
          } else if (pgPool) {
            await pgPool.query(statement);
          }
        }
      } catch (err: unknown) {
        const error = err as { code?: string; message?: string };
        // Ignore "already exists" errors when reapplying migrations
        if (error.code !== '42P07' && error.code !== '42710' && !error.message?.includes('already exists')) {
          throw err;
        }
      }
    }
  }
}

export { schema };

export { seedDatabase } from './seed.js';
