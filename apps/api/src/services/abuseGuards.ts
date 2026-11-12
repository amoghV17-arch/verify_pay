import type { FastifyRequest, FastifyReply } from 'fastify';
import { lt, and, eq, ne, or, like } from 'drizzle-orm';
import type { AppDatabase } from '../db/index.js';
import { projects, users, sessions, emailTokens } from '../db/schema.js';

// Configuration constants per docs/LIVE_PROOF.md Section 2
export const MAX_BRIEF_LENGTH = 5000;
export const MAX_DEMO_BUDGET_CENTS = 50000; // $500.00 USD

export const DEFAULT_RATE_LIMITS: Record<string, { limit: number; windowMs: number }> = {
  planner: { limit: 10, windowMs: 60_000 },
  reviewer: { limit: 20, windowMs: 60_000 },
  invite: { limit: 20, windowMs: 60_000 },
  demo_session: { limit: 10, windowMs: 60_000 },
};

// In-memory rate limiting store: `${ip}:${category}` -> array of epoch millisecond timestamps
const rateLimitStore = new Map<string, number[]>();

export function checkRateLimit(
  ip: string,
  category: string,
  customLimit?: number,
  customWindowMs?: number
): { allowed: boolean; retryAfterSeconds?: number; current: number; limit: number } {
  const config = DEFAULT_RATE_LIMITS[category] || { limit: 30, windowMs: 60_000 };
  const limit = customLimit ?? config.limit;
  const windowMs = customWindowMs ?? config.windowMs;

  const key = `${ip}:${category}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  const existingTimestamps = rateLimitStore.get(key) || [];
  // Prune timestamps outside current sliding window
  const validTimestamps = existingTimestamps.filter((ts) => ts > windowStart);

  if (validTimestamps.length >= limit) {
    const oldestTimestamp = validTimestamps[0] || now;
    const retryAfterMs = Math.max(0, oldestTimestamp + windowMs - now);
    rateLimitStore.set(key, validTimestamps);
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000) || 1,
      current: validTimestamps.length,
      limit,
    };
  }

  validTimestamps.push(now);
  rateLimitStore.set(key, validTimestamps);

  return {
    allowed: true,
    current: validTimestamps.length,
    limit,
  };
}

export function resetRateLimits(): void {
  rateLimitStore.clear();
}

/**
 * Fastify preHandler hook for IP-based rate limiting on sensitive routes
 */
export function createRateLimitHandler(category: string, customLimit?: number, customWindowMs?: number) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // If running in automated tests with mock IP, respect X-Forwarded-For or remote address
    const clientIp =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      request.ip ||
      '127.0.0.1';

    const result = checkRateLimit(clientIp, category, customLimit, customWindowMs);

    reply.header('X-RateLimit-Limit', String(result.limit));
    reply.header('X-RateLimit-Remaining', String(Math.max(0, result.limit - result.current)));

    if (!result.allowed) {
      reply.header('Retry-After', String(result.retryAfterSeconds));
      return reply.status(429).send({
        error: 'TooManyRequests',
        message: `Rate limit exceeded for ${category}. Please wait ${result.retryAfterSeconds}s before trying again.`,
        retryAfterSeconds: result.retryAfterSeconds,
      });
    }
  };
}

// --- Daily LLM Cap Tracking ---
let currentLlmDate = new Date().toISOString().slice(0, 10);
let dailyLlmCallsCount = 0;

export function getDailyLlmUsage(): { used: number; cap: number; remaining: number } {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== currentLlmDate) {
    currentLlmDate = today;
    dailyLlmCallsCount = 0;
  }
  const cap = parseInt(process.env.DAILY_LLM_CAP || '200', 10);
  return {
    used: dailyLlmCallsCount,
    cap,
    remaining: Math.max(0, cap - dailyLlmCallsCount),
  };
}

export function checkAndRecordLlmCall(): { allowed: boolean; message?: string } {
  const usage = getDailyLlmUsage();
  if (usage.used >= usage.cap) {
    return {
      allowed: false,
      message:
        'The demo environment has reached its daily AI processing limit. Please try again tomorrow or contact the project team.',
    };
  }
  dailyLlmCallsCount += 1;
  return { allowed: true };
}

export function resetDailyLlmUsage(): void {
  dailyLlmCallsCount = 0;
}

// --- Brief Length Validation ---
export function validateBriefLength(brief: string): { valid: boolean; error?: string } {
  if (typeof brief !== 'string') {
    return { valid: false, error: 'Project brief must be a string.' };
  }
  if (brief.trim().length === 0) {
    return { valid: false, error: 'Project brief is required.' };
  }
  if (brief.length > MAX_BRIEF_LENGTH) {
    return {
      valid: false,
      error: `Project brief exceeds maximum allowed length of ${MAX_BRIEF_LENGTH} characters (received ${brief.length}).`,
    };
  }
  return { valid: true };
}

// --- Demo Budget Cap Validation ---
export function validateDemoBudget(
  amountCents: number,
  isDemo: boolean
): { valid: boolean; error?: string } {
  if (isDemo && amountCents > MAX_DEMO_BUDGET_CENTS) {
    return {
      valid: false,
      error: `In demo mode, maximum project budget is $${(MAX_DEMO_BUDGET_CENTS / 100).toFixed(2)} USD (attempted $${(amountCents / 100).toFixed(2)}).`,
    };
  }
  return { valid: true };
}

// --- 24-Hour Demo Sessions Cleanup ---
export async function cleanupOldDemoSessions(
  db: AppDatabase,
  maxAgeMs = 24 * 60 * 60 * 1000
): Promise<{ purgedProjectsCount: number; purgedUserIds: string[] }> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - maxAgeMs);

  // Purge expired auth sessions & email verification/reset tokens
  await db.delete(sessions).where(lt(sessions.expiresAt, now));
  await db.delete(emailTokens).where(lt(emailTokens.expiresAt, now));

  // Find demo projects older than cutoff, preserving canonical project 'proj_brand_launch'
  const staleProjects = await db
    .select({
      id: projects.id,
      clientId: projects.clientId,
      freelancerId: projects.freelancerId,
    })
    .from(projects)
    .where(
      and(
        eq(projects.isDemo, true),
        ne(projects.id, 'proj_brand_launch'),
        lt(projects.createdAt, cutoff)
      )
    );

  const purgedUserIds: string[] = [];

  for (const proj of staleProjects) {
    // Delete project (cascades to milestones, tasks, dependencies, ledger, etc.)
    await db.delete(projects).where(eq(projects.id, proj.id));

    if (proj.clientId.startsWith('client_vis_')) {
      await db.delete(users).where(eq(users.id, proj.clientId));
      purgedUserIds.push(proj.clientId);
    }
    if (proj.freelancerId && proj.freelancerId.startsWith('freelancer_vis_')) {
      await db.delete(users).where(eq(users.id, proj.freelancerId));
      purgedUserIds.push(proj.freelancerId);
    }
  }

  // Also purge orphaned ephemeral demo users older than cutoff
  const staleDemoUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.isDemo, true),
        ne(users.id, 'user_client_01'),
        ne(users.id, 'user_freelancer_01'),
        or(like(users.id, 'client_vis_%'), like(users.id, 'freelancer_vis_%'), like(users.id, 'demo_%')),
        lt(users.createdAt, cutoff)
      )
    );

  for (const u of staleDemoUsers) {
    await db.delete(users).where(eq(users.id, u.id));
    purgedUserIds.push(u.id);
  }

  return {
    purgedProjectsCount: staleProjects.length,
    purgedUserIds,
  };
}

