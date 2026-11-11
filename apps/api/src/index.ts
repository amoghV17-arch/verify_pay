import './env.js';
import { loadConfig, type PayPalPort } from '@milestone/shared';
import { buildServer } from './server.js';
import { initDb } from './db/index.js';
import { seedDatabase } from './db/seed.js';
import { AutonomySchedulerService } from './services/autonomyScheduler.js';

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

    // Start assisted release window scheduler
    const paypalAdapter = (server as unknown as { paypalAdapter: PayPalPort }).paypalAdapter;
    const scheduler = new AutonomySchedulerService(db, paypalAdapter);
    scheduler.start(paypalAdapter, 2000);

    const shutdown = async () => {
      scheduler.stop();
      await server.close();
      process.exit(0);
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
