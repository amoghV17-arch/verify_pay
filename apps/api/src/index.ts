import 'dotenv/config';
import { loadConfig } from '@milestone/shared';
import { buildServer } from './server.js';
import { initDb } from './db/index.js';
import { seedDatabase } from './db/seed.js';

const config = loadConfig(process.env);
const server = buildServer(config);

async function start() {
  try {
    const db = await initDb();
    await seedDatabase(db);
    server.log.info('Database initialized and seeded.');

    const address = await server.listen({
      port: config.PORT,
      host: '0.0.0.0',
    });
    server.log.info(`Milestone API server listening on ${address}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
