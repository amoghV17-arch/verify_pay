import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '@milestone/shared';
import { buildServer } from '../server.js';
import type { FastifyInstance } from 'fastify';

describe('Single Deployable Static Serving & SPA Fallback', () => {
  let app: FastifyInstance;
  let createdMockDist = false;
  let mockDistPath = '';

  beforeAll(async () => {
    // Hermetic test guard: if web app has not been built yet, create a minimal index.html
    // so this unit test runs cleanly on clean checkouts before build steps.
    const distPath = path.resolve(process.cwd(), 'apps/web/dist');
    const indexPath = path.join(distPath, 'index.html');
    if (!fs.existsSync(indexPath)) {
      fs.mkdirSync(distPath, { recursive: true });
      fs.writeFileSync(
        indexPath,
        '<!doctype html><html lang="en"><body><div id="root">Mock Milestone SPA</div></body></html>',
        'utf-8'
      );
      createdMockDist = true;
      mockDistPath = distPath;
    }

    const config = loadConfig({
      NODE_ENV: 'test',
      PAYPAL_ENV: 'mock',
    });
    app = buildServer(config, { serveStatic: true });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    if (createdMockDist && mockDistPath && fs.existsSync(mockDistPath)) {
      try {
        fs.rmSync(mockDistPath, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
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

