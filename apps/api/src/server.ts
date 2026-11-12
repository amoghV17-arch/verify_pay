import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppConfig, PayPalPort, LlmPort } from '@milestone/shared';
import { registerAuth } from './auth/index.js';
import { createEmailPort, type EmailPort } from './email/index.js';
import { registerNotificationEventListener } from './services/notifications.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerAccountRoutes } from './routes/account.js';
import { registerProjectRoutes } from './routes/projects.js';
import { registerGanttRoutes } from './routes/gantt.js';
import { registerFundRoutes } from './routes/fund.js';
import { registerWebhookRoutes } from './routes/webhooks.js';
import { registerMilestoneRoutes } from './routes/milestones.js';
import { registerInviteRoutes } from './routes/invites.js';
import { registerReceiptShareRoutes } from './routes/receiptShares.js';
import { registerDemoRoutes } from './routes/demo.js';
import { registerSystemRoutes } from './routes/system.js';
import { registerProofRoutes } from './routes/proof.js';
import { createPayPalAdapter } from './paypal/index.js';
import { createLlmPort } from './ai/llmFactory.js';

export interface BuildServerOptions {
  paypalAdapter?: PayPalPort;
  llmAdapter?: LlmPort;
  emailPort?: EmailPort;
  serveStatic?: boolean;
  cspReportOnly?: boolean;
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

export function buildServer(
  rawConfig: Partial<AppConfig> & Pick<AppConfig, 'NODE_ENV' | 'PORT' | 'APP_BASE_URL' | 'DATABASE_URL' | 'SESSION_SECRET' | 'PAYPAL_ENV'>,
  options?: BuildServerOptions
): FastifyInstance {
  const config: AppConfig = {
    PAYPAL_CLIENT_ID: '',
    PAYPAL_CLIENT_SECRET: '',
    PAYPAL_WEBHOOK_ID: '',
    DEMO_MODE: false,
    DEMO_FREELANCER_PAYPAL_EMAIL: '',
    LLM_PROVIDER: 'fixture',
    LLM_API_KEY: '',
    LLM_MODEL: '',
    LLM_BASE_URL: '',
    REVIEW_MIN_CONFIDENCE: 0.75,
    ASSISTED_RELEASE_WINDOW_SECONDS: 20,
    BRYNTUM_PACKAGE: 'trial',
    EMAIL_PROVIDER: 'outbox',
    EMAIL_FROM: 'Milestone <noreply@milestone.local>',
    RESEND_API_KEY: '',
    SMTP_HOST: '',
    SMTP_PORT: 587,
    SMTP_USER: '',
    SMTP_PASS: '',
    EMAIL_VERIFICATION: 'soft',
    GOOGLE_CLIENT_ID: '',
    GOOGLE_CLIENT_SECRET: '',
    SUPPORT_EMAIL: '',
    ...rawConfig,
  } as AppConfig;

  const server = Fastify({
    trustProxy: true,
    logger: {
      level: config.NODE_ENV === 'test' ? 'silent' : 'info',
    },
  });

  server.register(helmet, {
    hsts: config.NODE_ENV === 'production' ? { maxAge: 15552000, includeSubDomains: true } : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    frameguard: { action: 'sameorigin' },
    contentSecurityPolicy: {
      reportOnly: options?.cspReportOnly ?? true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://www.paypal.com', 'https://www.sandbox.paypal.com'],
        frameSrc: ["'self'", 'https://www.paypal.com', 'https://www.sandbox.paypal.com'],
        connectSrc: [
          "'self'",
          'https://www.paypal.com',
          'https://www.sandbox.paypal.com',
          'https://api-m.sandbox.paypal.com',
        ],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://www.paypalobjects.com'],
        workerSrc: ["'self'", 'blob:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'", 'https://accounts.google.com'],
      },
    },
  });

  if (config.NODE_ENV !== 'test') {
    server.register(rateLimit, {
      max: 400,
      timeWindow: '1 minute',
    });
  }

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

  // Initialize Adapters and Decorators before Auth & Routes
  server.decorate('appConfig', config);

  const paypalAdapter = options?.paypalAdapter || createPayPalAdapter(config);
  server.decorate('paypalAdapter', paypalAdapter);

  const emailPort = options?.emailPort || createEmailPort(config);
  server.decorate('emailPort', emailPort);
  registerNotificationEventListener(config, emailPort);

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

  // Register Auth and Session Handling
  server.register(registerAuth);

  // Register Auth, Account, Core Data and Sync Routes
  server.register(registerAuthRoutes);
  server.register(registerAccountRoutes);
  server.register(registerProjectRoutes);
  server.register(registerGanttRoutes);
  server.register(registerFundRoutes, { paypalAdapter });
  server.register(registerWebhookRoutes, { paypalAdapter });
  server.register(registerMilestoneRoutes, { paypalAdapter });
  server.register(registerInviteRoutes);
  server.register(registerReceiptShareRoutes);
  server.register(registerDemoRoutes);
  server.register(registerSystemRoutes);
  server.register(registerProofRoutes);

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
