import { buildServer } from '../apps/api/src/server.js';
import { loadConfig } from '../packages/shared/src/config/env.js';
import { MockPayPalAdapter } from '../apps/api/src/paypal/mockAdapter.js';
import { initDb, closeDb, resetDemoDatabase } from '../apps/api/src/db/index.js';
import type { FastifyInstance } from 'fastify';

export interface TestServerContext {
  server: FastifyInstance;
  mockPayPal: MockPayPalAdapter;
  stop: () => Promise<void>;
}

export async function startTestServer(): Promise<TestServerContext> {
  const config = loadConfig({
    NODE_ENV: 'test',
    PORT: '8080',
    APP_BASE_URL: 'http://localhost:5173',
    PAYPAL_ENV: 'mock',
    LLM_PROVIDER: 'fixture',
    DEMO_MODE: 'true',
  });

  const db = await initDb({ useMemory: true });
  await resetDemoDatabase(db);

  const mockPayPal = new MockPayPalAdapter({ defaultWebhookDelayMs: 0 });
  const server = buildServer(config, { paypalAdapter: mockPayPal });
  await server.listen({ port: 8080, host: '127.0.0.1' });

  return {
    server,
    mockPayPal,
    stop: async () => {
      await server.close();
      await closeDb();
    },
  };
}

