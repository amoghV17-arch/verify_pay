import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { AppConfig } from '@milestone/shared';

export function buildServer(config: AppConfig): FastifyInstance {
  const server = Fastify({
    logger: {
      level: config.NODE_ENV === 'test' ? 'silent' : 'info',
    },
  });

  server.register(cors, {
    origin: true,
    credentials: true,
  });

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

