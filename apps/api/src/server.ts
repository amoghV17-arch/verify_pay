import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { AppConfig, PayPalPort } from '@milestone/shared';
import { registerAuth } from './auth/index.js';
import { registerProjectRoutes } from './routes/projects.js';
import { registerGanttRoutes } from './routes/gantt.js';
import { registerFundRoutes } from './routes/fund.js';
import { registerWebhookRoutes } from './routes/webhooks.js';
import { createPayPalAdapter } from './paypal/index.js';

export interface BuildServerOptions {
  paypalAdapter?: PayPalPort;
}

export function buildServer(config: AppConfig, options?: BuildServerOptions): FastifyInstance {
  const server = Fastify({
    logger: {
      level: config.NODE_ENV === 'test' ? 'silent' : 'info',
    },
  });

  server.register(cors, {
    origin: true,
    credentials: true,
  });

  // Preserve raw request body on JSON requests for cryptographic signature verification
  server.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    try {
      const raw = (body as Buffer).toString('utf8');
      (req as unknown as { rawBody: string }).rawBody = raw;
      if (!raw || raw.trim().length === 0) {
        done(null, {});
        return;
      }
      const parsed = JSON.parse(raw);
      done(null, parsed);
    } catch (err: unknown) {
      done(err as Error, undefined);
    }
  });

  // Register Auth and Session Handling
  server.register(registerAuth);

  // Initialize PayPal Adapter
  const paypalAdapter = options?.paypalAdapter || createPayPalAdapter(config);
  server.decorate('paypalAdapter', paypalAdapter);

  // Register Core Data and Sync Routes
  server.register(registerProjectRoutes);
  server.register(registerGanttRoutes);
  server.register(registerFundRoutes, { paypalAdapter });
  server.register(registerWebhookRoutes, { paypalAdapter });

  // Health check endpoint for Render and local checks per ARCHITECTURE.md
  server.get('/healthz', async () => {
    return {
      status: 'ok',
      service: 'milestone-api',
      env: config.NODE_ENV,
      paypalEnv: config.PAYPAL_ENV,
      timestamp: new Date().toISOString(),
    };
  });

  // Dev admin health check
  server.get('/api/admin/health', async () => {
    return {
      status: 'ok',
      adapters: {
        paypal: config.PAYPAL_ENV,
        llm: config.LLM_PROVIDER,
      },
      time: new Date().toISOString(),
    };
  });

  return server;
}
