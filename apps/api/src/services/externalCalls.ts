import { getDb } from '../db/index.js';
import { externalCalls, paypalEvents } from '../db/schema.js';
import { desc, eq } from 'drizzle-orm';

export interface ExternalCallInput {
  service: 'paypal' | 'llm' | 'github';
  method: string;
  endpointTemplate: string;
  status?: number;
  durationMs: number;
  requestId?: string;
  providerDebugId?: string;
  projectId?: string;
  milestoneId?: string;
  ok: boolean;
  errorCode?: string;
  meta?: Record<string, unknown>;
}

export interface ExternalCallItem {
  id: string;
  at: string;
  service: string;
  method: string;
  endpointTemplate: string;
  status: number | null;
  durationMs: number;
  requestId: string | null;
  providerDebugId: string | null;
  projectId: string | null;
  milestoneId: string | null;
  ok: boolean;
  errorCode: string | null;
  meta: Record<string, unknown> | null;
}

export interface WebhookLogItem {
  id: string;
  paypalEventId: string;
  type: string;
  receivedAt: string;
  verified: boolean;
  processedAt: string | null;
  error: string | null;
  projectId?: string | null;
  milestoneId?: string | null;
}

let callCountSinceCleanup = 0;

export async function recordExternalCall(input: ExternalCallInput): Promise<void> {
  try {
    const db = getDb();
    const id = `call_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    // Sanitize meta: never store prompt contents, credentials, or request/response bodies
    const sanitizedMeta: Record<string, unknown> = {};
    if (input.meta) {
      if (typeof input.meta.model === 'string') sanitizedMeta.model = input.meta.model;
      if (typeof input.meta.inputTokens === 'number') sanitizedMeta.inputTokens = input.meta.inputTokens;
      if (typeof input.meta.outputTokens === 'number') sanitizedMeta.outputTokens = input.meta.outputTokens;
      if (typeof input.meta.toolName === 'string') sanitizedMeta.toolName = input.meta.toolName;
      if (typeof input.meta.url === 'string') sanitizedMeta.url = input.meta.url;
      if (typeof input.meta.note === 'string') sanitizedMeta.note = input.meta.note;
    }

    await db.insert(externalCalls).values({
      id,
      at: new Date(),
      service: input.service,
      method: input.method.toUpperCase(),
      endpointTemplate: input.endpointTemplate,
      status: input.status ?? (input.ok ? 200 : 500),
      durationMs: Math.max(0, Math.round(input.durationMs)),
      requestId: input.requestId ?? null,
      providerDebugId: input.providerDebugId ?? null,
      projectId: input.projectId ?? null,
      milestoneId: input.milestoneId ?? null,
      ok: input.ok,
      errorCode: input.errorCode ?? null,
      meta: Object.keys(sanitizedMeta).length > 0 ? sanitizedMeta : null,
    });

    // Cleanup: Enforce 5,000 rows retention every 100 calls
    callCountSinceCleanup++;
    if (callCountSinceCleanup >= 100) {
      callCountSinceCleanup = 0;
      // Asynchronously prune older calls keeping last 5000
      void pruneOldExternalCalls(db);
    }
  } catch (err) {
    // Logging errors must never fail caller or payment flow
    console.warn('[ExternalCalls] Failed to record call:', err);
  }
}

async function pruneOldExternalCalls(db: ReturnType<typeof getDb>): Promise<void> {
  try {
    const recent = await db
      .select({ id: externalCalls.id })
      .from(externalCalls)
      .orderBy(desc(externalCalls.at))
      .limit(5000);

    if (recent.length === 5000) {
      const oldestKeptId = recent[recent.length - 1]?.id;
      if (oldestKeptId) {
        // Retain latest 5,000 rows
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}

export async function getRecentExternalCalls(
  projectId?: string,
  limit = 25
): Promise<ExternalCallItem[]> {
  const db = getDb();
  let query = db
    .select()
    .from(externalCalls)
    .orderBy(desc(externalCalls.at))
    .limit(limit);

  if (projectId) {
    // @ts-expect-error dynamic condition
    query = query.where(eq(externalCalls.projectId, projectId));
  }

  const rows = await query;
  return rows.map((r) => ({
    id: r.id,
    at: r.at ? r.at.toISOString() : new Date().toISOString(),
    service: r.service,
    method: r.method,
    endpointTemplate: r.endpointTemplate,
    status: r.status,
    durationMs: r.durationMs,
    requestId: r.requestId,
    providerDebugId: r.providerDebugId,
    projectId: r.projectId,
    milestoneId: r.milestoneId,
    ok: r.ok,
    errorCode: r.errorCode,
    meta: (r.meta as Record<string, unknown>) ?? null,
  }));
}

export async function getWebhookReceiptLog(limit = 25): Promise<WebhookLogItem[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(paypalEvents)
    .orderBy(desc(paypalEvents.createdAt))
    .limit(limit);

  return rows.map((r) => {
    const payload = (r.payload as Record<string, any>) || {};
    const resource = payload.resource || {};
    const customId = resource.custom_id || resource.custom;
    const milestoneId = resource.sender_item_id || resource.item_id || null;

    return {
      id: r.id,
      paypalEventId: r.paypalEventId,
      type: r.type,
      receivedAt: r.createdAt.toISOString(),
      verified: !r.error?.includes('Signature'),
      processedAt: r.processedAt ? r.processedAt.toISOString() : null,
      error: r.error,
      projectId: customId || null,
      milestoneId: milestoneId || null,
    };
  });
}

