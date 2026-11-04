import 'dotenv/config';
import { loadConfig } from '@milestone/shared';
import { buildServer } from './server.js';

const config = loadConfig(process.env);
const server = buildServer(config);

async function start() {
  try {
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

