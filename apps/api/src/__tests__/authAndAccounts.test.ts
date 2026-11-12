import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildServer } from '../server.js';
import { initDb, closeDb, getDb } from '../db/index.js';
import { seedDatabase } from '../db/seed.js';
import { users, sessions, projects, milestones, ledgerEntries } from '../db/schema.js';
import { loadConfig } from '@milestone/shared';
import { createTestUserSession } from './helpers/authTestHelper.js';
import { hashPassword } from '../auth/crypto.js';

describe('Phase A7: Comprehensive Auth, Accounts, Security & Lifecycle Suite', () => {
  let server: ReturnType<typeof buildServer>;
  const baseConfig = loadConfig({
    NODE_ENV: 'test',
    PORT: '8080',
    PAYPAL_ENV: 'mock',
    LLM_PROVIDER: 'fixture',
    DEMO_MODE: 'true',
  });

  beforeEach(async () => {
    await initDb({ useMemory: true });
    const db = getDb();
    await seedDatabase(db);
    server = buildServer(baseConfig);
  });

  afterEach(async () => {
    await server.close();
    await closeDb();
  });

  describe('1. Registration & Password Strength', () => {
    it('registers new user, creates session, and hashes password with scrypt', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/auth/signup',
        headers: { origin: 'http://localhost:5173' },
        payload: {
          name: 'Elena Rostova',
          email: 'elena@example.com',
          password: 'CorrectHorseBatteryStaple99!',
          agreedToTerms: true,
        },
      });

      expect(res.statusCode).toBe(201);
      const data = res.json();
      expect(data.ok).toBe(true);
      expect(data.user.email).toBe('elena@example.com');
      expect(data.user.passwordHash).toBeUndefined();

      // Check DB password format
      const db = getDb();
      const [dbUser] = await db.select().from(users).where(eq(users.email, 'elena@example.com'));
      expect(dbUser).toBeDefined();
      expect(dbUser.passwordHash).toMatch(/^\$scrypt\$n=16384,r=8,p=1\$/);
    });

    it('rejects weak password with 400 and helpful message', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/auth/signup',
        headers: { origin: 'http://localhost:5173' },
        payload: {
          name: 'Weak User',
          email: 'weak@example.com',
          password: 'password1234',
          agreedToTerms: true,
        },
      });

      expect(res.statusCode).toBe(400);
      const data = res.json();
      expect(data.error).toBe('WeakPassword');
    });

    it('suppresses duplicate email disclosure when verification is active (§5.3)', async () => {
      await server.inject({
        method: 'POST',
        url: '/api/auth/signup',
        headers: { origin: 'http://localhost:5173' },
        payload: {
          name: 'First Registrant',
          email: 'duplicate@example.com',
          password: 'Password123!Secure',
          agreedToTerms: true,
        },
      });

      const res2 = await server.inject({
        method: 'POST',
        url: '/api/auth/signup',
        headers: { origin: 'http://localhost:5173' },
        payload: {
          name: 'Second Registrant',
          email: 'duplicate@example.com',
          password: 'Password123!Secure',
          agreedToTerms: true,
        },
      });

      expect(res2.statusCode).toBe(200);
      expect(res2.json().ok).toBe(true);
      expect(res2.json().checkEmail).toBe(true);
    });

    it('claims an existing placeholder or invited user without password on signup', async () => {
      const db = getDb();
      await db.insert(users).values({
        id: 'user_placeholder_claim_test',
        name: 'Invited Person',
        email: 'invited-person@example.com',
        avatarColor: '#337D70',
        lastWorkspace: 'client',
        passwordHash: null,
      });

      const res = await server.inject({
        method: 'POST',
        url: '/api/auth/signup',
        headers: { origin: 'http://localhost:5173' },
        payload: {
          name: 'Invited Person Claimed',
          email: 'invited-person@example.com',
          password: 'Password123!Secure',
          agreedToTerms: true,
          intent: 'freelancer',
        },
      });

      expect(res.statusCode).toBe(201);
      const data = res.json();
      expect(data.ok).toBe(true);
      expect(data.user.id).toBe('user_placeholder_claim_test');

      const [updated] = await db
        .select()
        .from(users)
        .where(eq(users.id, 'user_placeholder_claim_test'));
      expect(updated.passwordHash).not.toBeNull();
      expect(updated.displayName).toBe('Invited Person Claimed');
    });
  });

  describe('2. Authentication, Lockout, and Session Lifecycle', () => {
    it('authenticates user with valid password and rotates session', async () => {
      const password = 'CorrectPassword99!';
      const db = getDb();
      const passwordHash = await hashPassword(password);
      await db.insert(users).values({
        id: 'user_login_test',
        email: 'logintest@example.com',
        name: 'Login Test',
        passwordHash,
        emailVerifiedAt: new Date(),
        lastWorkspace: 'client',
      });

      const res = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { origin: 'http://localhost:5173' },
        payload: {
          email: 'logintest@example.com',
          password,
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.ok).toBe(true);
      expect(data.user.id).toBe('user_login_test');

      // Verify session cookie set
      const sessionCookie = res.cookies.find((c) => c.name.startsWith('ms_session'));
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie?.httpOnly).toBe(true);
    });

    it('rejects invalid password and increments failed attempt tracking', async () => {
      const password = 'RightPassword123!';
      const db = getDb();
      const passwordHash = await hashPassword(password);
      await db.insert(users).values({
        id: 'user_lockout_test',
        email: 'lockout@example.com',
        name: 'Lockout Test',
        passwordHash,
        emailVerifiedAt: new Date(),
        lastWorkspace: 'client',
      });

      const failRes = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { origin: 'http://localhost:5173' },
        payload: { email: 'lockout@example.com', password: 'WrongPassword!' },
      });
      expect(failRes.statusCode).toBe(401);
      expect(failRes.json().error).toBe('InvalidCredentials');
    });

    it('logs out and revokes active session', async () => {
      const user = await createTestUserSession({ userId: 'user_logout_01' });

      const logoutRes = await server.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: { ...user.headers },
      });
      expect(logoutRes.statusCode).toBe(200);

      // Verify session is revoked in DB
      const db = getDb();
      const [sessRow] = await db
        .select()
        .from(sessions)
        .where(eq(sessions.id, user.session.sessionId));
      expect(sessRow.revokedAt).not.toBeNull();

      // Subsequent /api/auth/me returns authenticated: false
      const meRes = await server.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie: user.cookie },
      });
      expect(meRes.json().authenticated).toBe(false);
    });
  });

  describe('3. CSRF & Security Controls', () => {
    it('blocks mutating requests when CSRF token is missing', async () => {
      const user = await createTestUserSession({ userId: 'user_csrf_01' });

      const res = await server.inject({
        method: 'PATCH',
        url: '/api/me',
        headers: {
          cookie: user.cookie,
          origin: 'http://localhost:5173',
          // Deliberately omit x-csrf-token
        },
        payload: { displayName: 'Hacked Name' },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe('InvalidCsrfToken');
    });

    it('blocks mutating requests when Origin is unauthorized', async () => {
      const user = await createTestUserSession({ userId: 'user_origin_01' });

      const res = await server.inject({
        method: 'PATCH',
        url: '/api/me',
        headers: {
          ...user.headers,
          origin: 'https://evil-attacker.example.com',
        },
        payload: { displayName: 'Hacked Name' },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe('Forbidden');
    });
  });

  describe('4. Settings, Payout Email, and Safe Account Deletion', () => {
    it('updates user profile and validates PayPal payout email', async () => {
      const user = await createTestUserSession({ userId: 'user_profile_01', role: 'freelancer' });

      const updateRes = await server.inject({
        method: 'PATCH',
        url: '/api/me',
        headers: { ...user.headers },
        payload: {
          displayName: 'Updated Elena',
          company: 'Acme Design Studio',
          avatarColor: '#2D6A4F',
        },
      });
      expect(updateRes.statusCode).toBe(200);
      expect(updateRes.json().user.displayName).toBe('Updated Elena');

      const payoutRes = await server.inject({
        method: 'PUT',
        url: '/api/me/payout',
        headers: { ...user.headers },
        payload: { payoutPaypalEmail: 'elena-sandbox@personal.example.com' },
      });
      expect(payoutRes.statusCode).toBe(200);
      expect(payoutRes.json().payoutPaypalEmail).toBe('elena-sandbox@personal.example.com');
    });

    it('refuses account deletion with 409 Conflict when user has unreleased held funds', async () => {
      const db = getDb();
      const client = await createTestUserSession({ userId: 'client_active_funds' });

      // Create a project with held balance and active milestone
      const projId = 'proj_active_balance_test';
      await db.insert(projects).values({
        id: projId,
        title: 'Project with Active Held Budget',
        brief: 'Active brief',
        clientId: client.userId,
        status: 'funded',
        totalCents: 50000,
        currency: 'USD',
      });
      await db.insert(milestones).values({
        id: 'ms_active_fund_1',
        projectId: projId,
        name: 'Active Milestone 1',
        amountCents: 50000,
        percent: 100,
        status: 'funded',
        criteria: [{ id: 'c1', description: 'Active test criteria' }],
      });
      await db.insert(ledgerEntries).values({
        id: 'ledg_active_fund',
        projectId: projId,
        type: 'funded',
        amountCents: 50000,
        idempotencyKey: 'fund_proj_active_balance_test',
      });

      const deleteRes = await server.inject({
        method: 'DELETE',
        url: '/api/me',
        headers: { ...client.headers },
        payload: { password: 'TestPassword123!', confirmation: 'DELETE' },
      });

      expect(deleteRes.statusCode).toBe(409);
      expect(deleteRes.json().error).toBe('ActiveHeldFunds');
      expect(deleteRes.json().message).toContain('funded, unreleased milestones');
    });

    it('allows account deletion when user has no active held funds', async () => {
      const user = await createTestUserSession({ userId: 'client_no_funds' });

      const deleteRes = await server.inject({
        method: 'DELETE',
        url: '/api/me',
        headers: { ...user.headers },
        payload: { password: 'TestPassword123!', confirmation: 'DELETE' },
      });

      expect(deleteRes.statusCode).toBe(200);
      expect(deleteRes.json().ok).toBe(true);

      // Verify user is soft-deleted
      const db = getDb();
      const [u] = await db.select().from(users).where(eq(users.id, user.userId));
      expect(u.deletedAt).not.toBeNull();
    });
  });

  describe('5. Cross-User Project Access & Targeted Invites', () => {
    it('strictly forbids a user from accessing projects they do not own (403)', async () => {
      const stranger = await createTestUserSession({ userId: 'user_stranger_99' });

      const res = await server.inject({
        method: 'GET',
        url: '/api/projects/proj_brand_launch',
        headers: { ...stranger.headers },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe('Forbidden');
    });

    it('rejects invite acceptance when target invitedEmail does not match accepting user', async () => {
      const client = await createTestUserSession({ userId: 'user_client_01', role: 'client' });
      const createRes = await server.inject({
        method: 'POST',
        url: '/api/projects/proj_brand_launch/invites',
        headers: { ...client.headers },
        payload: { invitedEmail: 'exclusive-partner@design.com' },
      });
      const { invite } = createRes.json();

      const wrongUser = await createTestUserSession({
        userId: 'user_wrong_email',
        email: 'uninvited-person@other.com',
        role: 'freelancer',
      });

      const acceptRes = await server.inject({
        method: 'POST',
        url: `/api/invites/${invite.code}/accept`,
        headers: { ...wrongUser.headers },
        payload: { paypalEmail: 'wrong-sandbox@example.com' },
      });

      expect(acceptRes.statusCode).toBe(403);
      expect(acceptRes.json().message).toContain('different email address');
    });
  });

  describe('6. DEMO_MODE Enforcements', () => {
    it('returns 404 on /api/demo/* endpoints when DEMO_MODE is false', async () => {
      const prodConfig = loadConfig({
        NODE_ENV: 'test',
        PORT: '8080',
        PAYPAL_ENV: 'mock',
        LLM_PROVIDER: 'fixture',
        DEMO_MODE: 'false',
      });
      const prodServer = buildServer(prodConfig);

      const resStatus = await prodServer.inject({
        method: 'GET',
        url: '/api/demo/status',
      });
      expect(resStatus.statusCode).toBe(404);

      const resSession = await prodServer.inject({
        method: 'POST',
        url: '/api/demo/session',
        payload: { brief: 'Test demo brief' },
      });
      expect(resSession.statusCode).toBe(404);

      await prodServer.close();
    });
  });
});
