import crypto from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import fastifyCookie from '@fastify/cookie';
import { and, eq, isNull, ne, or } from 'drizzle-orm';
import type { AppConfig } from '@milestone/shared';
import { getDb } from '../db/index.js';
import { authEvents, milestones, projects, sessions, users } from '../db/schema.js';
import { generateOpaqueToken, hashIp, sha256Hex, summarizeUserAgent } from './crypto.js';

export const COOKIE_SESSION = 'ms_session';
export const COOKIE_CSRF = 'ms_csrf';

export const SESSION_IDLE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
export const SESSION_ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const LAST_SEEN_TOUCH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export type DemoSlot = 'client' | 'freelancer';

export interface AuthenticatedUser {
  userId: string;
  sessionId: string;
  email: string;
  name: string;
  displayName: string | null;
  company: string | null;
  avatarColor: string;
  emailVerified: boolean;
  payoutPaypalEmail: string | null;
  payoutEmailChangedAt: Date | null;
  lastWorkspace: 'client' | 'freelancer';
  isDemo: boolean;
  slot: DemoSlot | null;
  // Backward-compatible property mapped per-project or lastWorkspace (not a global persona)
  role: 'client' | 'freelancer';
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
    project?: typeof projects.$inferSelect;
    projectRole?: 'client' | 'freelancer';
  }
}

export function getSessionCookieName(slot?: DemoSlot | null, demoMode = false): string {
  if (demoMode && (slot === 'client' || slot === 'freelancer')) {
    return `${COOKIE_SESSION}__${slot}`;
  }
  return COOKIE_SESSION;
}

export function resolveRequestedSlot(request: FastifyRequest, config: AppConfig): DemoSlot | null {
  if (!config.DEMO_MODE) return null;
  const raw = request.headers['x-session-slot'];
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'client' || normalized === 'freelancer') {
    return normalized;
  }
  return null;
}

function getAllowedOrigins(request: FastifyRequest, config: AppConfig): Set<string> {
  const allowed = new Set<string>();
  try {
    allowed.add(new URL(config.APP_BASE_URL).origin);
  } catch {
    // Ignore malformed base URL
  }
  const host = request.headers.host;
  if (host) {
    allowed.add(`https://${host}`);
    allowed.add(`http://${host}`);
  }
  if (config.NODE_ENV !== 'production') {
    allowed.add('http://localhost:5173');
    allowed.add('http://127.0.0.1:5173');
    allowed.add('http://localhost:8080');
    allowed.add('http://127.0.0.1:8080');
  }
  return allowed;
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function createUserSession(opts: {
  userId: string;
  ip?: string;
  userAgent?: string;
  slot?: DemoSlot | null;
  config: AppConfig;
}): Promise<{ sessionId: string; rawToken: string; csrfToken: string }> {
  const db = getDb();
  const sessionId = `sess_${crypto.randomUUID()}`;
  const rawToken = generateOpaqueToken(32);
  const tokenHash = sha256Hex(rawToken);
  const csrfToken = generateOpaqueToken(24);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_MS);
  const safeSlot = opts.config.DEMO_MODE && opts.slot ? opts.slot : null;

  await db.insert(sessions).values({
    id: sessionId,
    userId: opts.userId,
    tokenHash,
    createdAt: now,
    lastSeenAt: now,
    expiresAt,
    ipHash: hashIp(opts.ip, opts.config.SESSION_SECRET),
    userAgentSummary: summarizeUserAgent(opts.userAgent),
    slot: safeSlot,
  });

  return { sessionId, rawToken, csrfToken };
}

export function setSessionCookies(
  reply: FastifyReply,
  rawToken: string,
  csrfToken: string,
  config: AppConfig,
  slot?: DemoSlot | null
): void {
  const cookieName = getSessionCookieName(slot, Boolean(config.DEMO_MODE));
  const isProd = config.NODE_ENV === 'production';

  reply.setCookie(cookieName, rawToken, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: Math.floor(SESSION_ABSOLUTE_MS / 1000),
  });

  reply.setCookie(COOKIE_CSRF, csrfToken, {
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    secure: isProd,
    maxAge: Math.floor(SESSION_ABSOLUTE_MS / 1000),
  });
}

export function clearSessionCookies(
  reply: FastifyReply,
  config: AppConfig,
  slot?: DemoSlot | null
): void {
  const cookieName = getSessionCookieName(slot, Boolean(config.DEMO_MODE));
  const isProd = config.NODE_ENV === 'production';
  reply.clearCookie(cookieName, { path: '/', sameSite: 'lax', secure: isProd });
}

export async function revokeSessionById(sessionId: string): Promise<void> {
  const db = getDb();
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
}

export async function revokeOtherSessions(userId: string, keepSessionId: string): Promise<void> {
  const db = getDb();
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(sessions.userId, userId),
        ne(sessions.id, keepSessionId),
        isNull(sessions.revokedAt)
      )
    );
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  const db = getDb();
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}

export async function recordAuthEvent(opts: {
  userId?: string | null;
  type: string;
  ip?: string;
  meta?: Record<string, unknown>;
  secret: string;
}): Promise<void> {
  try {
    const db = getDb();
    await db.insert(authEvents).values({
      id: `aevt_${crypto.randomUUID()}`,
      userId: opts.userId || null,
      type: opts.type,
      ipHash: hashIp(opts.ip, opts.secret),
      meta: opts.meta || {},
    });
  } catch {
    // Non-fatal audit write
  }
}

async function authPlugin(server: FastifyInstance): Promise<void> {
  const config = ((server as unknown as { appConfig?: AppConfig }).appConfig || {
    NODE_ENV: process.env.NODE_ENV || 'development',
    APP_BASE_URL: process.env.APP_BASE_URL || 'http://localhost:5173',
    SESSION_SECRET: process.env.SESSION_SECRET || 'development-session-secret-at-least-32-chars',
    DEMO_MODE: process.env.DEMO_MODE === 'true',
  }) as AppConfig;

  await server.register(fastifyCookie, {
    secret: config.SESSION_SECRET,
  });

  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const slot = resolveRequestedSlot(request, config);
    const cookieName = getSessionCookieName(slot, Boolean(config.DEMO_MODE));
    const rawToken = request.cookies?.[cookieName];

    if (rawToken && typeof rawToken === 'string' && rawToken.length >= 16) {
      const db = getDb();
      const tokenHash = sha256Hex(rawToken);
      const [row] = await db
        .select({
          session: sessions,
          user: users,
        })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(eq(sessions.tokenHash, tokenHash))
        .limit(1);

      if (row) {
        const now = Date.now();
        const isRevoked = Boolean(row.session.revokedAt) || Boolean(row.user.deletedAt);
        const isExpired = row.session.expiresAt.getTime() <= now;
        const isIdleExpired = now - row.session.lastSeenAt.getTime() > SESSION_IDLE_MS;

        if (!isRevoked && !isExpired && !isIdleExpired) {
          if (now - row.session.lastSeenAt.getTime() > LAST_SEEN_TOUCH_INTERVAL_MS) {
            void db
              .update(sessions)
              .set({ lastSeenAt: new Date(now) })
              .where(eq(sessions.id, row.session.id))
              .catch(() => {});
          }

          const lastWs =
            row.user.lastWorkspace === 'freelancer' ? 'freelancer' : 'client';
          request.user = {
            userId: row.user.id,
            sessionId: row.session.id,
            email: row.user.email,
            name: row.user.displayName || row.user.name,
            displayName: row.user.displayName,
            company: row.user.company,
            avatarColor: row.user.avatarColor || '#337D70',
            emailVerified: Boolean(row.user.emailVerifiedAt),
            payoutPaypalEmail: row.user.payoutPaypalEmail,
            payoutEmailChangedAt: row.user.payoutEmailChangedAt,
            lastWorkspace: lastWs,
            isDemo: Boolean(row.user.isDemo),
            slot:
              row.session.slot === 'client' || row.session.slot === 'freelancer'
                ? row.session.slot
                : null,
            role: slot || lastWs,
          };
        } else if (!row.session.revokedAt && (isExpired || isIdleExpired)) {
          await revokeSessionById(row.session.id);
        }
      }
    }

    // Origin & CSRF enforcement on state-changing requests
    const method = request.method.toUpperCase();
    if (
      (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') &&
      !request.url.startsWith('/api/webhooks/')
    ) {
      const originHeader = request.headers.origin;
      if (originHeader) {
        const allowed = getAllowedOrigins(request, config);
        if (!allowed.has(originHeader)) {
          return reply.status(403).send({
            error: 'Forbidden',
            message: 'Origin not permitted.',
          });
        }
      }

      // Enforce double-submit CSRF when cookie session is active in browser contexts
      const csrfCookie = request.cookies?.[COOKIE_CSRF];
      const hasSessionCookie = Boolean(rawToken && request.user);
      const isBrowserRequest = Boolean(originHeader || request.headers['sec-fetch-site']);
      if (hasSessionCookie && isBrowserRequest && csrfCookie) {
        const csrfHeader = request.headers['x-csrf-token'];
        if (typeof csrfHeader !== 'string' || !timingSafeStringEqual(csrfCookie, csrfHeader)) {
          return reply.status(403).send({
            error: 'InvalidCsrfToken',
            message: 'Your session security token expired. Please refresh the page and try again.',
          });
        }
      }
    }
  });
}

export const registerAuth = fp(authPlugin);

export function requireAuth() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Please log in to continue.',
      });
    }
  };
}

export function requireVerifiedEmailIfNeeded() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Please log in to continue.',
      });
    }
    const config = (request.server as unknown as { appConfig?: AppConfig }).appConfig;
    if (config?.EMAIL_VERIFICATION === 'required' && !request.user.emailVerified && !request.user.isDemo) {
      return reply.status(403).send({
        error: 'EmailNotVerified',
        message: 'Please verify your email address before creating invites or funding a project.',
      });
    }
  };
}

/**
 * Membership authorization middleware for project routes (/api/projects/:id/...).
 */
export function requireProjectMember(requiredRole: 'client' | 'freelancer' | 'any' = 'any') {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Please log in to access this project.',
      });
    }

    const params = request.params as { id?: string; projectId?: string };
    const projId = params.id || params.projectId;
    if (!projId) return;

    const db = getDb();
    const [proj] = await db.select().from(projects).where(eq(projects.id, projId)).limit(1);
    if (!proj) {
      return reply.status(404).send({
        error: 'NotFound',
        message: `Project "${projId}" not found.`,
      });
    }

    const isClient = request.user.userId === proj.clientId;
    const isFreelancer = Boolean(proj.freelancerId && request.user.userId === proj.freelancerId);

    if (requiredRole === 'client' && !isClient) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Only the client for this project can perform this action.',
      });
    }
    if (requiredRole === 'freelancer' && !isFreelancer) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Only the assigned freelancer for this project can perform this action.',
      });
    }
    if (!isClient && !isFreelancer) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You are not a member of this project.',
      });
    }

    request.project = proj;
    request.projectRole = isClient ? 'client' : 'freelancer';
  };
}

/**
 * Membership authorization middleware for milestone routes (/api/milestones/:id/...).
 */
export function requireMilestoneMember(requiredRole: 'client' | 'freelancer' | 'any' = 'any') {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Please log in to access this milestone.',
      });
    }

    const params = request.params as { id?: string };
    const milestoneId = params.id;
    if (!milestoneId) return;

    const db = getDb();
    const [row] = await db
      .select({
        milestone: milestones,
        project: projects,
      })
      .from(milestones)
      .innerJoin(projects, eq(milestones.projectId, projects.id))
      .where(or(eq(milestones.id, milestoneId), eq(milestones.taskId, milestoneId)))
      .limit(1);

    if (!row) {
      return reply.status(404).send({
        error: 'NotFound',
        message: `Milestone "${milestoneId}" not found.`,
      });
    }

    const proj = row.project;
    const isClient = request.user.userId === proj.clientId;
    const isFreelancer = Boolean(proj.freelancerId && request.user.userId === proj.freelancerId);

    if (requiredRole === 'client' && !isClient) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Only the client for this project can perform this action.',
      });
    }
    if (requiredRole === 'freelancer' && !isFreelancer) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Only the assigned freelancer for this project can perform this action.',
      });
    }
    if (!isClient && !isFreelancer) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You are not a member of this project.',
      });
    }

    request.project = proj;
    request.projectRole = isClient ? 'client' : 'freelancer';
  };
}

// Temporary compile-only bridge for legacy vitest files until Phase A7 updates all tests
export const COOKIE_CLIENT = COOKIE_SESSION;
export const COOKIE_FREELANCER = COOKIE_SESSION;
export async function createSessionToken(_payload: {
  userId: string;
  role: 'client' | 'freelancer';
  name?: string;
  email?: string;
}): Promise<string> {
  throw new Error('Legacy JWT session tokens are removed. Use createUserSession in tests.');
}
export function setRoleSessionCookie(): void {
  throw new Error('Legacy role session cookies are removed. Use setSessionCookies in tests.');
}
export function requireRole(allowedRoles: Array<'client' | 'freelancer'>) {
  if (allowedRoles.length === 1 && allowedRoles[0] === 'client') {
    return requireProjectMember('client');
  }
  if (allowedRoles.length === 1 && allowedRoles[0] === 'freelancer') {
    return requireProjectMember('freelancer');
  }
  return requireProjectMember('any');
}
