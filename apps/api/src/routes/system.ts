import { FastifyInstance } from 'fastify';
import { getRecentExternalCalls, getWebhookReceiptLog } from '../services/externalCalls.js';
import { MAX_DEMO_BUDGET_CENTS } from '../services/abuseGuards.js';
import { getDb } from '../db/index.js';
import { sql } from 'drizzle-orm';

let cachedStatus: { data: any; expiresAt: number } | null = null;

export async function registerSystemRoutes(server: FastifyInstance): Promise<void> {
  const config = (server as any).appConfig;

  // 1. GET /api/system/mode - Truth about current backend execution environment
  server.get('/api/system/mode', async () => {
    const isLiveLlm = Boolean(
      config.LLM_PROVIDER && config.LLM_PROVIDER !== 'fixture' && config.LLM_API_KEY
    );
    const isWebhookConfigured = Boolean(
      config.PAYPAL_WEBHOOK_ID && config.PAYPAL_WEBHOOK_ID.trim().length > 0
    );
    const isDemoBudgetCap = Boolean(config.DEMO_MODE || process.env.DEMO_MODE === 'true');

    return {
      paypal: config.PAYPAL_ENV === 'sandbox' ? 'sandbox' : 'mock',
      llm: {
        provider: config.LLM_PROVIDER || 'fixture',
        model: config.LLM_MODEL || 'fixture-model',
        live: isLiveLlm,
      },
      demoMode: isDemoBudgetCap || config.NODE_ENV !== 'production',
      demoBudgetCapActive: isDemoBudgetCap,
      maxDemoBudgetCents: MAX_DEMO_BUDGET_CENTS,
      webhookConfigured: isWebhookConfigured,
      version: '0.9.0',
      commit: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || 'local-dev',
    };
  });

  // 2. GET /api/system/external-calls - Log tape of external calls
  server.get<{ Querystring: { projectId?: string; limit?: string } }>(
    '/api/system/external-calls',
    async (req) => {
      const limit = req.query.limit ? Math.min(100, Math.max(1, parseInt(req.query.limit, 10))) : 25;
      const calls = await getRecentExternalCalls(req.query.projectId, limit);
      return { calls };
    }
  );

  // 3. GET /api/system/webhooks/log - Read-only webhook receipt log from paypal_events
  server.get<{ Querystring: { limit?: string } }>('/api/system/webhooks/log', async (req) => {
    const limit = req.query.limit ? Math.min(100, Math.max(1, parseInt(req.query.limit, 10))) : 25;
    const events = await getWebhookReceiptLog(limit);
    return { events };
  });

  // 4. GET /api/system/status and GET /status - Public health page (cached 10s, zero secrets)
  const getPublicStatus = async () => {
    const now = Date.now();
    if (cachedStatus && cachedStatus.expiresAt > now) {
      return cachedStatus.data;
    }

    let dbOk = false;
    try {
      const db = getDb();
      await db.execute(sql`SELECT 1`);
      dbOk = true;
    } catch {
      dbOk = false;
    }

    let webhookLastSeen: string | null = null;
    try {
      const webhooks = await getWebhookReceiptLog(1);
      if (webhooks.length > 0 && webhooks[0]?.receivedAt) {
        webhookLastSeen = webhooks[0].receivedAt;
      }
    } catch {
      // ignore
    }

    const data = {
      api: 'ok',
      database: dbOk ? 'ok' : 'degraded',
      paypalApi: config.PAYPAL_ENV === 'sandbox' ? 'sandbox_active' : 'mock_active',
      webhookLastSeen,
      llmProvider: config.LLM_PROVIDER || 'fixture',
      worker: 'ok',
      version: '0.9.0',
      commit: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || 'local-dev',
      timestamp: new Date().toISOString(),
    };

    cachedStatus = {
      data,
      expiresAt: now + 10_000, // 10s cache per §5.3
    };

    return data;
  };

  server.get('/api/system/status', getPublicStatus);
  server.get('/status', getPublicStatus);
}
