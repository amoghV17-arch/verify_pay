import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadConfig } from '@milestone/shared';
import { buildServer } from '../server.js';
import type { FastifyInstance } from 'fastify';

describe('Single Deployable Static Serving & SPA Fallback', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      PAYPAL_ENV: 'mock',
    });
    app = buildServer(config, { serveStatic: true });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET / serves the index.html SPA entrypoint', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('<!doctype html>');
    expect(res.body).toContain('id="root"');
  });

  it('GET /projects/proj_brand_launch serves SPA fallback index.html', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/projects/proj_brand_launch',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('id="root"');
  });

  it('GET /api/non-existent returns 404 JSON instead of HTML fallback', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/non-existent',
    });

    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/json');
    const body = res.json();
    expect(body.statusCode).toBe(404);
  });

  it('POST /non-existent returns 404 JSON', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/something-else',
    });

    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/json');
  });
});

