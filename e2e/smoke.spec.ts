import { test, expect } from '@playwright/test';
import { loadConfig } from '@milestone/shared';
import { buildServer } from '../apps/api/src/server.js';

test.describe('E2E smoke foundation suite', () => {
  test('verifies mock API server boots and answers /healthz', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      PAYPAL_ENV: 'mock',
      PORT: '8089',
    });
    const server = buildServer(config);
    const address = await server.listen({ port: 8089, host: '127.0.0.1' });

    try {
      const response = await fetch(`${address}/healthz`);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('ok');
      expect(data.service).toBe('milestone-api');
      expect(data.paypalEnv).toBe('mock');
    } finally {
      await server.close();
    }
  });
});

