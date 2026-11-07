import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppConfig, PayPalPort, LlmPort } from '@milestone/shared';
import { registerAuth } from './auth/index.js';
import { registerProjectRoutes } from './routes/projects.js';
import { registerGanttRoutes } from './routes/gantt.js';
import { registerFundRoutes } from './routes/fund.js';
import { registerWebhookRoutes } from './routes/webhooks.js';
import { registerMilestoneRoutes } from './routes/milestones.js';
import { registerInviteRoutes } from './routes/invites.js';
import { registerReceiptShareRoutes } from './routes/receiptShares.js';
import { createPayPalAdapter } from './paypal/index.js';
import { createLlmPort } from './ai/llmFactory.js';
import { createSessionToken, setRoleSessionCookie } from './auth/index.js';
import { getDb, resetDemoDatabase, PREPARED_DELIVERABLES } from './db/index.js';

export interface BuildServerOptions {
  paypalAdapter?: PayPalPort;
  llmAdapter?: LlmPort;
  serveStatic?: boolean;
}

function resolveWebDist(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'apps/web/dist'),
    path.resolve(process.cwd(), '../web/dist'),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../apps/web/dist'),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, 'index.html'))) {
      return candidate;
    }
  }
  return null;
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

  // Initialize LLM Adapter if configured or supplied
  let llmAdapter = options?.llmAdapter;
  if (!llmAdapter && config.LLM_PROVIDER) {
    try {
      llmAdapter = createLlmPort(config);
    } catch {
      // Defer throwing to explicit AI calls
    }
  }
  if (llmAdapter) {
    server.decorate('llmAdapter', llmAdapter);
  }
  server.decorate('appConfig', config);

  // Register Core Data and Sync Routes
  server.register(registerProjectRoutes);
  server.register(registerGanttRoutes);
  server.register(registerFundRoutes, { paypalAdapter });
  server.register(registerWebhookRoutes, { paypalAdapter });
  server.register(registerMilestoneRoutes, { paypalAdapter });
  server.register(registerInviteRoutes);
  server.register(registerReceiptShareRoutes);

  // Demo Mode Endpoints (Section 10.4)
  if (process.env.DEMO_MODE === 'true' || config.NODE_ENV === 'test' || config.NODE_ENV === 'development') {
    server.post<{ Body: { persona?: 'client' | 'freelancer' } }>(
      '/api/demo/login-as',
      async (request, reply) => {
        const persona = request.body?.persona || 'client';
        const isClient = persona === 'client';
        const userId = isClient ? 'user_client_01' : 'user_freelancer_01';
        const name = isClient ? 'Sarah Lin (Acme Corp)' : 'Arjun Mehta';

        const token = await createSessionToken({
          userId,
          role: isClient ? 'client' : 'freelancer',
          name,
        });

        setRoleSessionCookie(reply, isClient ? 'client' : 'freelancer', token);

        return reply.send({
          success: true,
          user: { id: userId, role: persona, name },
        });
      }
    );

    server.post('/api/demo/reset', async (_request, reply) => {
      const db = getDb();
      await resetDemoDatabase(db);
      return reply.send({ success: true, message: 'Demo environment reset successfully.' });
    });

    server.get('/api/demo/prepared-deliverables', async () => {
      return { success: true, deliverables: PREPARED_DELIVERABLES };
    });

    server.get('/api/demo/status', async () => {
      return {
        success: true,
        demoMode: true,
        personas: {
          client: {
            id: 'user_client_01',
            name: 'Sarah Lin (Acme Corp)',
            email: 'sarah@acme-corp.com',
            role: 'client',
          },
          freelancer: {
            id: 'user_freelancer_01',
            name: 'Arjun Mehta',
            email: 'arjun@freelance.dev',
            paypalEmail: 'arjun-sandbox@freelance.dev',
            role: 'freelancer',
          },
        },
      };
    });
  }

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

  // Register static file serving for React SPA in production/single-deployable mode
  const shouldServeStatic = options?.serveStatic ?? true;
  if (shouldServeStatic) {
    const webDist = resolveWebDist();
    if (webDist) {
      server.register(fastifyStatic, {
        root: webDist,
        prefix: '/',
      });

      server.setNotFoundHandler((req, reply) => {
        // Return 404 JSON for api, health, or non-GET requests
        if (
          (req.method !== 'GET' && req.method !== 'HEAD') ||
          req.raw.url?.startsWith('/api') ||
          req.raw.url?.startsWith('/healthz')
        ) {
          reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: `Route ${req.method}:${req.raw.url} not found`,
          });
          return;
        }

        reply.sendFile('index.html');
      });
    }
  }

  return server;
}
