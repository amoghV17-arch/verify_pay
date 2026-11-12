import crypto from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { AppConfig } from '@milestone/shared';
import { getDb } from '../db/index.js';
import {
  emailTokens,
  notificationPrefs,
  oauthIdentities,
  projects,
  users,
} from '../db/schema.js';
import {
  COOKIE_CSRF,
  clearSessionCookies,
  createUserSession,
  recordAuthEvent,
  requireAuth,
  resolveRequestedSlot,
  revokeAllUserSessions,
  revokeOtherSessions,
  revokeSessionById,
  setSessionCookies,
} from '../auth/index.js';
import {
  generateOpaqueToken,
  hashPassword,
  sha256Hex,
  validatePasswordStrength,
  verifyPassword,
} from '../auth/crypto.js';
import { isRealEmailConfigured, type EmailPort } from '../email/index.js';
import { renderEmailTemplate } from '../email/templates.js';

const SignupSchema = z.object({
  name: z.string().trim().min(1, 'Full name is required').max(120),
  email: z.string().trim().email('Enter a valid email address').max(254),
  password: z.string().min(10, 'Password must be at least 10 characters').max(128),
  agreedToTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must agree to the prototype terms and privacy notice.' }),
  }),
  intent: z.enum(['client', 'freelancer']).optional().default('client'),
  company: z.string().trim().max(120).optional(),
});

const LoginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

const VerifySchema = z.object({
  token: z.string().trim().min(16),
});

const ForgotSchema = z.object({
  email: z.string().trim().email().max(254),
});

const ResetSchema = z.object({
  token: z.string().trim().min(16),
  password: z.string().min(10).max(128),
});

interface AttemptBucket {
  timestamps: number[];
  failures: number;
}

const authAttempts = new Map<string, AttemptBucket>();
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

function checkProgressiveLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const bucket = authAttempts.get(key) || { timestamps: [], failures: 0 };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
  if (bucket.timestamps.length >= maxAttempts) {
    const oldest = bucket.timestamps[0] || now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    authAttempts.set(key, bucket);
    return { allowed: false, retryAfterSec };
  }
  bucket.timestamps.push(now);
  authAttempts.set(key, bucket);
  return { allowed: true, retryAfterSec: 0 };
}

function recordFailureBucket(key: string): void {
  const now = Date.now();
  const bucket = authAttempts.get(key) || { timestamps: [], failures: 0 };
  bucket.timestamps.push(now);
  bucket.failures += 1;
  authAttempts.set(key, bucket);
}

function resetBucket(key: string): void {
  authAttempts.delete(key);
}

export async function getUserWorkspaceStats(userId: string): Promise<{
  clientCount: number;
  freelancerCount: number;
}> {
  const db = getDb();
  const memberProjects = await db
    .select({
      clientId: projects.clientId,
      freelancerId: projects.freelancerId,
      status: projects.status,
    })
    .from(projects)
    .where(or(eq(projects.clientId, userId), eq(projects.freelancerId, userId)));

  let clientCount = 0;
  let freelancerCount = 0;
  for (const p of memberProjects) {
    if (p.status === 'cancelled') continue;
    if (p.clientId === userId) clientCount += 1;
    if (p.freelancerId === userId) freelancerCount += 1;
  }
  return { clientCount, freelancerCount };
}

export async function createAccountUser(opts: {
  name: string;
  email: string;
  password?: string;
  intent?: 'client' | 'freelancer';
  company?: string;
  isDemo?: boolean;
  emailVerified?: boolean;
  payoutPaypalEmail?: string;
}): Promise<typeof users.$inferSelect> {
  const db = getDb();
  const normalizedEmail = opts.email.trim().toLowerCase();
  const userId = `${opts.isDemo ? 'demo_' : 'usr_'}${crypto.randomUUID()}`;
  const passwordHash = opts.password ? await hashPassword(opts.password) : null;
  const now = new Date();

  const [created] = await db
    .insert(users)
    .values({
      id: userId,
      name: opts.name.trim(),
      displayName: opts.name.trim(),
      email: normalizedEmail,
      passwordHash,
      company: opts.company?.trim() || null,
      avatarColor: '#337D70',
      lastWorkspace: opts.intent === 'freelancer' ? 'freelancer' : 'client',
      emailVerifiedAt: opts.emailVerified ? now : null,
      isDemo: Boolean(opts.isDemo),
      payoutPaypalEmail: opts.payoutPaypalEmail || null,
      payoutEmailChangedAt: opts.payoutPaypalEmail ? now : null,
      lastLoginAt: now,
    })
    .returning();

  await db
    .insert(notificationPrefs)
    .values({ userId })
    .onConflictDoNothing();

  return created;
}

export const registerAuthRoutes: FastifyPluginAsync = async (server) => {
  const getConfig = (): AppConfig =>
    (server as unknown as { appConfig: AppConfig }).appConfig;
  const getEmailPort = (): EmailPort | undefined =>
    (server as unknown as { emailPort?: EmailPort }).emailPort;

  const isGoogleConfigured = (cfg: AppConfig) =>
    Boolean(cfg.GOOGLE_CLIENT_ID && cfg.GOOGLE_CLIENT_SECRET);

  // GET /api/auth/csrf
  server.get('/api/auth/csrf', async (request, reply) => {
    const cfg = getConfig();
    const existing = request.cookies?.[COOKIE_CSRF];
    const token = existing || generateOpaqueToken(24);
    if (!existing) {
      reply.setCookie(COOKIE_CSRF, token, {
        path: '/',
        httpOnly: false,
        sameSite: 'lax',
        secure: cfg.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    return reply.send({ csrfToken: token });
  });

  // GET /api/auth/me
  server.get('/api/auth/me', async (request, reply) => {
    const cfg = getConfig();
    const emailConfigured = isRealEmailConfigured(cfg);
    const configSummary = {
      demoMode: Boolean(cfg.DEMO_MODE),
      emailVerification: cfg.EMAIL_VERIFICATION || 'soft',
      resetAvailable: emailConfigured,
      emailProvider: cfg.EMAIL_PROVIDER || 'outbox',
      googleAuthEnabled: isGoogleConfigured(cfg),
      supportEmail: cfg.SUPPORT_EMAIL || null,
    };

    if (!request.user) {
      return reply.send({
        authenticated: false,
        user: null,
        config: configSummary,
      });
    }

    const memberships = await getUserWorkspaceStats(request.user.userId);
    return reply.send({
      authenticated: true,
      user: {
        id: request.user.userId,
        name: request.user.displayName || request.user.name,
        displayName: request.user.displayName || request.user.name,
        email: request.user.email,
        company: request.user.company,
        avatarColor: request.user.avatarColor,
        emailVerified: request.user.emailVerified,
        payoutPaypalEmail: request.user.payoutPaypalEmail,
        payoutEmailChangedAt: request.user.payoutEmailChangedAt,
        lastWorkspace: request.user.lastWorkspace,
        isDemo: request.user.isDemo,
        slot: request.user.slot,
        role: request.user.role,
        memberships,
      },
      config: configSummary,
    });
  });

  // POST /api/auth/signup
  server.post<{ Body: unknown }>('/api/auth/signup', async (request, reply) => {
    const cfg = getConfig();
    const ipLimit = checkProgressiveLimit(`signup:ip:${request.ip}`, 15, 10 * 60_000);
    if (!ipLimit.allowed) {
      reply.header('Retry-After', String(ipLimit.retryAfterSec));
      return reply.status(429).send({
        error: 'TooManyRequests',
        message: 'Too many signup attempts. Please try again in a few minutes.',
      });
    }

    const parsed = SignupSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: parsed.error.issues[0]?.message || 'Please check the form fields.',
        details: parsed.error.issues,
      });
    }

    const strength = validatePasswordStrength(parsed.data.password);
    if (!strength.valid) {
      return reply.status(400).send({
        error: 'WeakPassword',
        message: strength.reason,
      });
    }

    const db = getDb();
    const normalizedEmail = parsed.data.email.trim().toLowerCase();
    const verificationMode = cfg.EMAIL_VERIFICATION || 'soft';

    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingUser) {
      // Never disclose account existence when verification is active (§5.3)
      if (verificationMode !== 'off') {
        await recordAuthEvent({
          userId: existingUser.id,
          type: 'signup_duplicate_suppressed',
          ip: request.ip,
          secret: cfg.SESSION_SECRET,
        });
        return reply.status(200).send({
          ok: true,
          requiresVerification: verificationMode === 'required',
          checkEmail: true,
          message: 'If this email address is available, we created your account and sent a confirmation link.',
        });
      }

      return reply.status(400).send({
        error: 'SignupRejected',
        message: 'Unable to create an account with that email address. Try logging in instead.',
      });
    }

    const newUser = await createAccountUser({
      name: parsed.data.name,
      email: normalizedEmail,
      password: parsed.data.password,
      intent: parsed.data.intent,
      company: parsed.data.company,
      emailVerified: verificationMode === 'off',
    });

    await recordAuthEvent({
      userId: newUser.id,
      type: 'signup',
      ip: request.ip,
      meta: { intent: parsed.data.intent },
      secret: cfg.SESSION_SECRET,
    });

    if (verificationMode !== 'off') {
      const rawToken = generateOpaqueToken(32);
      await db.insert(emailTokens).values({
        id: `etok_${crypto.randomUUID()}`,
        userId: newUser.id,
        type: 'verify',
        tokenHash: sha256Hex(rawToken),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const emailPort = getEmailPort();
      if (emailPort) {
        const verifyUrl = `${cfg.APP_BASE_URL.replace(/\/$/, '')}/verify-email/${rawToken}`;
        const rendered = renderEmailTemplate('verify_email', {
          recipientName: newUser.displayName || newUser.name,
          actionUrl: verifyUrl,
        });
        await emailPort.send({
          to: newUser.email,
          recipientUserId: newUser.id,
          template: 'verify_email',
          subject: rendered.subject,
          bodyText: rendered.bodyText,
          bodyHtml: rendered.bodyHtml,
        });
      }
    }

    // Create immediate session for soft/off verification; required mode redirects cleanly to /check-email
    if (verificationMode !== 'required') {
      const slot = resolveRequestedSlot(request, cfg);
      const { rawToken, csrfToken } = await createUserSession({
        userId: newUser.id,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        slot,
        config: cfg,
      });
      setSessionCookies(reply, rawToken, csrfToken, cfg, slot);
    }

    return reply.status(201).send({
      ok: true,
      requiresVerification: verificationMode === 'required',
      checkEmail: verificationMode === 'required',
      user: {
        id: newUser.id,
        name: newUser.displayName || newUser.name,
        email: newUser.email,
        emailVerified: Boolean(newUser.emailVerifiedAt),
        lastWorkspace: newUser.lastWorkspace,
      },
    });
  });

  // POST /api/auth/login
  server.post<{ Body: unknown }>('/api/auth/login', async (request, reply) => {
    const cfg = getConfig();
    const parsed = LoginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Email and password are required.',
      });
    }

    const emailLower = parsed.data.email.trim().toLowerCase();
    const ipKey = `login:ip:${request.ip}`;
    const emailKey = `login:email:${emailLower}`;

    const ipCheck = checkProgressiveLimit(ipKey, 25, 10 * 60_000);
    const emailCheck = checkProgressiveLimit(emailKey, 8, 10 * 60_000);
    if (!ipCheck.allowed || !emailCheck.allowed) {
      const retryAfter = Math.max(ipCheck.retryAfterSec, emailCheck.retryAfterSec);
      reply.header('Retry-After', String(retryAfter));
      await recordAuthEvent({
        type: 'login_rate_limited',
        ip: request.ip,
        meta: { emailHash: sha256Hex(emailLower).slice(0, 12) },
        secret: cfg.SESSION_SECRET,
      });
      return reply.status(429).send({
        error: 'TooManyRequests',
        message: 'Too many attempts. Try again in a few minutes.',
      });
    }

    const db = getDb();
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, emailLower), isNull(users.deletedAt)))
      .limit(1);

    const passwordOk = await verifyPassword(parsed.data.password, user?.passwordHash);
    if (!user || !passwordOk) {
      recordFailureBucket(ipKey);
      recordFailureBucket(emailKey);
      await recordAuthEvent({
        userId: user?.id || null,
        type: 'login_failed',
        ip: request.ip,
        secret: cfg.SESSION_SECRET,
      });
      return reply.status(401).send({
        error: 'InvalidCredentials',
        message: 'Email or password is incorrect.',
      });
    }

    if (cfg.EMAIL_VERIFICATION === 'required' && !user.emailVerifiedAt && !user.isDemo) {
      return reply.status(403).send({
        error: 'EmailNotVerified',
        message: 'Please verify your email address before logging in.',
      });
    }

    resetBucket(emailKey);

    // Revoke any stale session in this slot to prevent session fixation
    if (request.user?.sessionId) {
      await revokeSessionById(request.user.sessionId);
    }

    const slot = resolveRequestedSlot(request, cfg);
    const { rawToken, csrfToken } = await createUserSession({
      userId: user.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      slot,
      config: cfg,
    });

    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    await recordAuthEvent({
      userId: user.id,
      type: 'login_success',
      ip: request.ip,
      secret: cfg.SESSION_SECRET,
    });

    setSessionCookies(reply, rawToken, csrfToken, cfg, slot);

    const memberships = await getUserWorkspaceStats(user.id);
    return reply.send({
      ok: true,
      user: {
        id: user.id,
        name: user.displayName || user.name,
        displayName: user.displayName || user.name,
        email: user.email,
        emailVerified: Boolean(user.emailVerifiedAt),
        payoutPaypalEmail: user.payoutPaypalEmail,
        lastWorkspace: user.lastWorkspace === 'freelancer' ? 'freelancer' : 'client',
        isDemo: user.isDemo,
        memberships,
      },
    });
  });

  // POST /api/auth/logout
  server.post('/api/auth/logout', async (request, reply) => {
    const cfg = getConfig();
    const slot = resolveRequestedSlot(request, cfg);
    if (request.user?.sessionId) {
      await revokeSessionById(request.user.sessionId);
      await recordAuthEvent({
        userId: request.user.userId,
        type: 'logout',
        ip: request.ip,
        secret: cfg.SESSION_SECRET,
      });
    }
    clearSessionCookies(reply, cfg, slot);
    return reply.send({ ok: true });
  });

  // POST /api/auth/logout-others
  server.post('/api/auth/logout-others', { preHandler: [requireAuth()] }, async (request, reply) => {
    const cfg = getConfig();
    const user = request.user!;
    await revokeOtherSessions(user.userId, user.sessionId);
    await recordAuthEvent({
      userId: user.userId,
      type: 'logout_other_sessions',
      ip: request.ip,
      secret: cfg.SESSION_SECRET,
    });
    return reply.send({ ok: true });
  });

  // POST /api/auth/verify
  server.post<{ Body: unknown }>('/api/auth/verify', async (request, reply) => {
    const cfg = getConfig();
    const parsed = VerifySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'InvalidToken',
        message: 'This verification link is invalid.',
      });
    }

    const db = getDb();
    const tokenHash = sha256Hex(parsed.data.token);
    const [row] = await db
      .select()
      .from(emailTokens)
      .where(and(eq(emailTokens.tokenHash, tokenHash), eq(emailTokens.type, 'verify')))
      .limit(1);

    if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) {
      return reply.status(400).send({
        error: 'TokenExpiredOrUsed',
        message: 'This verification link has expired or has already been used.',
      });
    }

    const now = new Date();
    await db
      .update(emailTokens)
      .set({ usedAt: now })
      .where(eq(emailTokens.id, row.id));

    await db
      .update(users)
      .set({ emailVerifiedAt: now })
      .where(eq(users.id, row.userId));

    await recordAuthEvent({
      userId: row.userId,
      type: 'email_verified',
      ip: request.ip,
      secret: cfg.SESSION_SECRET,
    });

    return reply.send({ ok: true, message: 'Email address confirmed.' });
  });

  // POST /api/auth/resend-verification
  server.post<{ Body: { email?: string } }>('/api/auth/resend-verification', async (request, reply) => {
    const cfg = getConfig();
    const targetEmail = (request.body?.email || request.user?.email || '').trim().toLowerCase();
    const rl = checkProgressiveLimit(`resend:${request.ip}:${targetEmail}`, 4, 10 * 60_000);
    if (!rl.allowed) {
      reply.header('Retry-After', String(rl.retryAfterSec));
      return reply.status(429).send({
        error: 'TooManyRequests',
        message: 'Please wait a few minutes before requesting another verification email.',
      });
    }

    if (targetEmail) {
      const db = getDb();
      const [user] = await db
        .select()
        .from(users)
        .where(and(eq(users.email, targetEmail), isNull(users.deletedAt)))
        .limit(1);

      if (user && !user.emailVerifiedAt) {
        const rawToken = generateOpaqueToken(32);
        await db.insert(emailTokens).values({
          id: `etok_${crypto.randomUUID()}`,
          userId: user.id,
          type: 'verify',
          tokenHash: sha256Hex(rawToken),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
        const emailPort = getEmailPort();
        if (emailPort) {
          const verifyUrl = `${cfg.APP_BASE_URL.replace(/\/$/, '')}/verify-email/${rawToken}`;
          const rendered = renderEmailTemplate('verify_email', {
            recipientName: user.displayName || user.name,
            actionUrl: verifyUrl,
          });
          await emailPort.send({
            to: user.email,
            recipientUserId: user.id,
            template: 'verify_email',
            subject: rendered.subject,
            bodyText: rendered.bodyText,
            bodyHtml: rendered.bodyHtml,
          });
        }
      }
    }

    return reply.send({
      ok: true,
      message: 'If an unverified account matches that email, a fresh link has been prepared.',
    });
  });

  // POST /api/auth/forgot
  server.post<{ Body: unknown }>('/api/auth/forgot', async (request, reply) => {
    const cfg = getConfig();
    if (!isRealEmailConfigured(cfg)) {
      return reply.status(503).send({
        error: 'EmailDeliveryDisabled',
        message:
          'Password reset needs email delivery, which is turned off in this prototype. Create a new account or use the demo instead.',
      });
    }

    const rl = checkProgressiveLimit(`forgot:${request.ip}`, 5, 10 * 60_000);
    if (!rl.allowed) {
      reply.header('Retry-After', String(rl.retryAfterSec));
      return reply.status(429).send({
        error: 'TooManyRequests',
        message: 'Too many reset requests. Please try again later.',
      });
    }

    const parsed = ForgotSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Enter a valid email address.',
      });
    }

    const db = getDb();
    const normalizedEmail = parsed.data.email.trim().toLowerCase();
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, normalizedEmail), isNull(users.deletedAt)))
      .limit(1);

    if (user && !user.isDemo) {
      const rawToken = generateOpaqueToken(32);
      await db.insert(emailTokens).values({
        id: `etok_${crypto.randomUUID()}`,
        userId: user.id,
        type: 'reset',
        tokenHash: sha256Hex(rawToken),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      const emailPort = getEmailPort();
      if (emailPort) {
        const resetUrl = `${cfg.APP_BASE_URL.replace(/\/$/, '')}/reset-password/${rawToken}`;
        const rendered = renderEmailTemplate('reset_password', {
          recipientName: user.displayName || user.name,
          actionUrl: resetUrl,
        });
        await emailPort.send({
          to: user.email,
          recipientUserId: user.id,
          template: 'reset_password',
          subject: rendered.subject,
          bodyText: rendered.bodyText,
          bodyHtml: rendered.bodyHtml,
        });
      }

      await recordAuthEvent({
        userId: user.id,
        type: 'password_reset_requested',
        ip: request.ip,
        secret: cfg.SESSION_SECRET,
      });
    }

    return reply.send({
      ok: true,
      message: 'If an account exists for that email, we sent a link.',
    });
  });

  // POST /api/auth/reset
  server.post<{ Body: unknown }>('/api/auth/reset', async (request, reply) => {
    const cfg = getConfig();
    if (!isRealEmailConfigured(cfg)) {
      return reply.status(503).send({
        error: 'EmailDeliveryDisabled',
        message: 'Password reset needs email delivery, which is turned off in this prototype.',
      });
    }

    const parsed = ResetSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Valid reset token and password are required.',
      });
    }

    const strength = validatePasswordStrength(parsed.data.password);
    if (!strength.valid) {
      return reply.status(400).send({
        error: 'WeakPassword',
        message: strength.reason,
      });
    }

    const db = getDb();
    const tokenHash = sha256Hex(parsed.data.token);
    const [row] = await db
      .select()
      .from(emailTokens)
      .where(and(eq(emailTokens.tokenHash, tokenHash), eq(emailTokens.type, 'reset')))
      .limit(1);

    if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) {
      return reply.status(400).send({
        error: 'TokenExpiredOrUsed',
        message: 'This reset link is invalid or has expired.',
      });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const now = new Date();
    await db.update(emailTokens).set({ usedAt: now }).where(eq(emailTokens.id, row.id));
    await db
      .update(users)
      .set({ passwordHash, emailVerifiedAt: sql`COALESCE(email_verified_at, ${now})` })
      .where(eq(users.id, row.userId));

    // Revoke all existing sessions on reset
    await revokeAllUserSessions(row.userId);
    await recordAuthEvent({
      userId: row.userId,
      type: 'password_reset_completed',
      ip: request.ip,
      secret: cfg.SESSION_SECRET,
    });

    return reply.send({ ok: true, message: 'Password updated. Please log in with your new password.' });
  });

  // Optional Google OAuth (PKCE + state + nonce + ID token JWKS verification)
  server.get<{ Querystring: { intent?: string; next?: string } }>(
    '/api/auth/oauth/google/start',
    async (request, reply) => {
      const cfg = getConfig();
      if (!isGoogleConfigured(cfg)) {
        return reply.status(404).send({
          error: 'OAuthDisabled',
          message: 'Google sign-in is not configured in this environment.',
        });
      }

      const codeVerifier = generateOpaqueToken(32);
      const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');
      const state = generateOpaqueToken(24);
      const nonce = generateOpaqueToken(24);
      const intent = request.query.intent === 'freelancer' ? 'freelancer' : 'client';
      const nextPath =
        request.query.next && request.query.next.startsWith('/') && !request.query.next.startsWith('//')
          ? request.query.next
          : '';

      const cookieOpts = {
        path: '/',
        httpOnly: true,
        sameSite: 'lax' as const,
        secure: cfg.NODE_ENV === 'production',
        maxAge: 600,
      };
      reply.setCookie(
        'ms_oauth_tx',
        JSON.stringify({ state, nonce, codeVerifier, intent, nextPath }),
        cookieOpts
      );

      const redirectUri = `${cfg.APP_BASE_URL.replace(/\/$/, '')}/api/auth/oauth/google/callback`;
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', cfg.GOOGLE_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'openid email profile');
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('nonce', nonce);
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');

      return reply.redirect(authUrl.toString());
    }
  );

  server.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    '/api/auth/oauth/google/callback',
    async (request, reply) => {
      const cfg = getConfig();
      if (!isGoogleConfigured(cfg)) {
        return reply.status(404).send({ error: 'OAuthDisabled', message: 'Google sign-in disabled.' });
      }

      const txRaw = request.cookies?.ms_oauth_tx;
      reply.clearCookie('ms_oauth_tx', { path: '/' });
      if (!txRaw || request.query.error || !request.query.code) {
        return reply.redirect('/login?error=oauth_cancelled');
      }

      let tx: { state: string; nonce: string; codeVerifier: string; intent: 'client' | 'freelancer'; nextPath: string };
      try {
        tx = JSON.parse(txRaw);
      } catch {
        return reply.redirect('/login?error=oauth_invalid');
      }

      if (!tx.state || tx.state !== request.query.state) {
        return reply.redirect('/login?error=oauth_state_mismatch');
      }

      const redirectUri = `${cfg.APP_BASE_URL.replace(/\/$/, '')}/api/auth/oauth/google/callback`;
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: request.query.code,
          client_id: cfg.GOOGLE_CLIENT_ID,
          client_secret: cfg.GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: tx.codeVerifier,
        }),
      });

      if (!tokenRes.ok) {
        return reply.redirect('/login?error=oauth_exchange_failed');
      }

      const tokenJson = (await tokenRes.json()) as { id_token?: string };
      if (!tokenJson.id_token) {
        return reply.redirect('/login?error=oauth_missing_id_token');
      }

      const { payload } = await jwtVerify(tokenJson.id_token, GOOGLE_JWKS, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: cfg.GOOGLE_CLIENT_ID,
      });

      if (payload.nonce !== tx.nonce || payload.email_verified !== true || typeof payload.email !== 'string') {
        return reply.redirect('/login?error=oauth_unverified_email');
      }

      const subject = String(payload.sub || '');
      const emailLower = payload.email.trim().toLowerCase();
      const displayName = typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : emailLower.split('@')[0];

      const db = getDb();
      let userId: string | null = null;

      const [linked] = await db
        .select()
        .from(oauthIdentities)
        .where(and(eq(oauthIdentities.provider, 'google'), eq(oauthIdentities.subject, subject)))
        .limit(1);

      if (linked) {
        userId = linked.userId;
      } else {
        const [byEmail] = await db
          .select()
          .from(users)
          .where(and(eq(users.email, emailLower), isNull(users.deletedAt)))
          .limit(1);

        if (byEmail) {
          userId = byEmail.id;
        } else {
          const created = await createAccountUser({
            name: displayName,
            email: emailLower,
            intent: tx.intent,
            emailVerified: true,
          });
          userId = created.id;
        }

        await db
          .insert(oauthIdentities)
          .values({
            id: `oai_${crypto.randomUUID()}`,
            userId,
            provider: 'google',
            subject,
          })
          .onConflictDoNothing();
      }

      const { rawToken, csrfToken } = await createUserSession({
        userId,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        slot: null,
        config: cfg,
      });
      setSessionCookies(reply, rawToken, csrfToken, cfg, null);

      await recordAuthEvent({
        userId,
        type: 'oauth_google_login',
        ip: request.ip,
        secret: cfg.SESSION_SECRET,
      });

      const dest = tx.nextPath || (tx.intent === 'freelancer' ? '/freelancer' : '/client');
      return reply.redirect(dest);
    }
  );
};
