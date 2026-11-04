import { describe, it, expect } from 'vitest';
import { loadConfig } from '@milestone/shared';
import { buildServer } from '../server.js';

describe('Fastify server endpoints', () => {
  it('GET /healthz returns 200 and ok status', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      PAYPAL_ENV: 'mock',
    });
    const app = buildServer(config);

    const res = await app.inject({
      method: 'GET',
      url: '/healthz',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.paypalEnv).toBe('mock');
  });

  it('GET /api/admin/health returns adapter info', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      PAYPAL_ENV: 'mock',
      LLM_PROVIDER: 'fixture',
    });
    const app = buildServer(config);

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/health',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.adapters.paypal).toBe('mock');
    expect(body.adapters.llm).toBe('fixture');
  });
});

