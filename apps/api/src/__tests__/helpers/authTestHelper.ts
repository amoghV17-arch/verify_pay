import { eq } from 'drizzle-orm';
import { loadConfig, type AppConfig } from '@milestone/shared';
import { createUserSession } from '../../auth/index.js';
import { users } from '../../db/schema.js';
import { getDb } from '../../db/index.js';
import { hashPassword } from '../../auth/crypto.js';

export async function createTestUserSession(opts: {
  userId?: string;
  email?: string;
  name?: string;
  role?: 'client' | 'freelancer';
  config?: AppConfig;
  slot?: 'client' | 'freelancer' | null;
}) {
  const db = getDb();
  const userId = opts.userId || `user_test_${Math.random().toString(36).slice(2, 8)}`;
  const email = opts.email || `${userId}@example.com`;
  const name = opts.name || 'Test User';
  const role = opts.role || 'client';

  const existing = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!existing) {
    const passwordHash = await hashPassword('TestPassword123!');
    await db.insert(users).values({
      id: userId,
      email,
      name,
      displayName: name,
      passwordHash,
      emailVerifiedAt: new Date(),
      lastWorkspace: role,
      payoutPaypalEmail: role === 'freelancer' ? 'sb-freelancer@personal.example.com' : null,
      isDemo: true,
    });
  }

  const appConfig =
    opts.config ||
    loadConfig({
      NODE_ENV: 'test',
      PORT: '8080',
      APP_BASE_URL: 'http://localhost:5173',
      DATABASE_URL: ':memory:',
      SESSION_SECRET: 'test-session-secret-at-least-32-chars-long',
      PAYPAL_ENV: 'mock',
      PAYPAL_CLIENT_ID: 'mock',
      PAYPAL_CLIENT_SECRET: 'mock',
      PAYPAL_WEBHOOK_ID: 'mock',
      DEMO_MODE: 'true',
      EMAIL_PROVIDER: 'outbox',
      EMAIL_VERIFICATION: 'soft',
    });

  const session = await createUserSession({
    userId,
    slot: opts.slot,
    config: appConfig,
  });

  const cookieName = appConfig.DEMO_MODE && opts.slot ? `ms_session__${opts.slot}` : 'ms_session';
  const cookie = `${cookieName}=${session.rawToken}; ms_csrf=${session.csrfToken}`;

  const headers: Record<string, string> = {
    cookie,
    'x-csrf-token': session.csrfToken,
    origin: 'http://localhost:5173',
  };

  if (opts.slot) {
    headers['x-session-slot'] = opts.slot;
  }

  return {
    userId,
    email,
    session,
    cookie,
    csrfToken: session.csrfToken,
    headers,
  };
}

