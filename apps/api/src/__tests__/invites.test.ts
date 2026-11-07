import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildServer } from '../server.js';
import { initDb, closeDb, getDb } from '../db/index.js';
import { seedDatabase } from '../db/seed.js';
import { projects, invites } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import {
  generateInviteCredentials,
  verifyInviteHash,
  hashInviteValue,
  resetInviteRateLimits,
} from '../services/invite.js';
import { createSessionToken } from '../auth/index.js';
import { loadConfig } from '@milestone/shared';

describe('M8d Phase P3: Invites Architecture Suite', () => {
  let server: ReturnType<typeof buildServer>;
  let clientCookie: string;

  beforeEach(async () => {
    resetInviteRateLimits();
    await initDb({ useMemory: true });
    const db = getDb();
    await seedDatabase(db);

    const config = loadConfig({
      NODE_ENV: 'test',
      PORT: '8080',
      PAYPAL_ENV: 'mock',
    });
    server = buildServer(config);

    const clientToken = await createSessionToken({
      userId: 'user_client_01',
      role: 'client',
      name: 'Sarah Lin (Acme Corp)',
    });
    clientCookie = `ms_client=${clientToken}; milestone_session=${clientToken}`;
  });

  afterEach(async () => {
    await server.close();
    await closeDb();
  });

  describe('Cryptographic & Code Generation Integrity', () => {
    it('generates 128-bit CSPRNG token and Crockford base32 MILE- code with valid HMACs', () => {
      const creds = generateInviteCredentials();

      expect(creds.token).toMatch(/^[A-Za-z0-9_-]{22}$/);
      expect(creds.code).toMatch(/^MILE-[0-9A-HJKMNP-Z]{10}$/);

      // Verify HMAC-SHA-256 length (64 hex characters)
      expect(creds.tokenHash).toHaveLength(64);
      expect(creds.codeHash).toHaveLength(64);

      // Verify constant-time comparison
      expect(verifyInviteHash(creds.token, creds.tokenHash)).toBe(true);
      expect(verifyInviteHash(creds.code, creds.codeHash)).toBe(true);
      expect(verifyInviteHash('tampered-token', creds.tokenHash)).toBe(false);
    });

    it('Crockford base32 alphabet excludes confusing characters I, L, O, U', () => {
      for (let i = 0; i < 20; i++) {
        const creds = generateInviteCredentials();
        const codeSuffix = creds.code.replace('MILE-', '');
        expect(codeSuffix).not.toMatch(/[ILOUilou]/);
      }
    });
  });

  describe('Invite Creation and Management Flow', () => {
    it('client can create an invite for a project; returns plaintext once', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/projects/proj_brand_launch/invites',
        headers: {
          cookie: clientCookie,
          'x-persona': 'client',
        },
        payload: { expiryDays: 7, maxUses: 1 },
      });

      expect(res.statusCode).toBe(201);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.invite.token).toBeDefined();
      expect(data.invite.code).toMatch(/^MILE-/);
      expect(data.invite.inviteUrl).toContain('/join/');

      // Verify DB stores only hashes, never plaintext token or code
      const db = getDb();
      const [stored] = await db
        .select()
        .from(invites)
        .where(eq(invites.id, data.invite.id));

      expect(stored).toBeDefined();
      expect(stored.tokenHash).toBe(hashInviteValue(data.invite.token));
      expect(stored.codeHash).toBe(hashInviteValue(data.invite.code));
      expect((stored as Record<string, unknown>).token).toBeUndefined();
      expect((stored as Record<string, unknown>).code).toBeUndefined();
    });

    it('client can list all invites for their project', async () => {
      // Create two invites
      await server.inject({
        method: 'POST',
        url: '/api/projects/proj_brand_launch/invites',
        headers: { cookie: clientCookie, 'x-persona': 'client' },
      });
      await server.inject({
        method: 'POST',
        url: '/api/projects/proj_brand_launch/invites',
        headers: { cookie: clientCookie, 'x-persona': 'client' },
      });

      const res = await server.inject({
        method: 'GET',
        url: '/api/projects/proj_brand_launch/invites',
        headers: { cookie: clientCookie, 'x-persona': 'client' },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.invites.length).toBeGreaterThanOrEqual(2);
    });

    it('client can revoke an invite; revoked invite fails preview with generic message', async () => {
      const createRes = await server.inject({
        method: 'POST',
        url: '/api/projects/proj_brand_launch/invites',
        headers: { cookie: clientCookie, 'x-persona': 'client' },
      });
      const { invite } = createRes.json();

      // Revoke the invite
      const revokeRes = await server.inject({
        method: 'POST',
        url: `/api/invites/${invite.id}/revoke`,
        headers: { cookie: clientCookie, 'x-persona': 'client' },
      });
      expect(revokeRes.statusCode).toBe(200);

      // Attempt preview with revoked token
      const previewRes = await server.inject({
        method: 'GET',
        url: `/api/invites/${invite.token}`,
      });

      expect(previewRes.statusCode).toBe(404);
      expect(previewRes.json().message).toBe('This invitation is no longer valid.');
    });
  });

  describe('Invite Preview and Acceptance Security', () => {
    it('public can preview project via token or short code without authentication', async () => {
      const createRes = await server.inject({
        method: 'POST',
        url: '/api/projects/proj_brand_launch/invites',
        headers: { cookie: clientCookie, 'x-persona': 'client' },
      });
      const { invite } = createRes.json();

      // Preview via token
      const previewByToken = await server.inject({
        method: 'GET',
        url: `/api/invites/${invite.token}`,
      });
      expect(previewByToken.statusCode).toBe(200);
      const dataToken = previewByToken.json();
      expect(dataToken.valid).toBe(true);
      expect(dataToken.project.title).toBe('Brand-site Redesign & Launch');
      expect(dataToken.project.milestones.length).toBeGreaterThan(0);
      expect(dataToken.project.milestones[0].criteria).toBeDefined();

      // Preview via code (case insensitive)
      const previewByCode = await server.inject({
        method: 'GET',
        url: `/api/invites/${invite.code.toLowerCase()}`,
      });
      expect(previewByCode.statusCode).toBe(200);
      expect(previewByCode.json().valid).toBe(true);
    });

    it('returns generic "This invitation is no longer valid." for non-existent, expired, or used invites', async () => {
      // Non-existent
      const fakeRes = await server.inject({
        method: 'GET',
        url: '/api/invites/MILE-0000000000',
      });
      expect(fakeRes.statusCode).toBe(404);
      expect(fakeRes.json().message).toBe('This invitation is no longer valid.');

      // Expired invite
      const db = getDb();
      const expiredCreds = generateInviteCredentials();
      await db.insert(invites).values({
        id: 'inv_expired_test',
        projectId: 'proj_brand_launch',
        tokenHash: expiredCreds.tokenHash,
        codeHash: expiredCreds.codeHash,
        expiresAt: new Date(Date.now() - 10000), // Expired 10s ago
        maxUses: 1,
        usedCount: 0,
      });

      const expiredRes = await server.inject({
        method: 'GET',
        url: `/api/invites/${expiredCreds.token}`,
      });
      expect(expiredRes.statusCode).toBe(404);
      expect(expiredRes.json().message).toBe('This invitation is no longer valid.');
    });

    it('freelancer can accept invite, receives ms_freelancer cookie, and project records membership', async () => {
      const createRes = await server.inject({
        method: 'POST',
        url: '/api/projects/proj_brand_launch/invites',
        headers: { cookie: clientCookie, 'x-persona': 'client' },
      });
      const { invite } = createRes.json();

      const acceptRes = await server.inject({
        method: 'POST',
        url: `/api/invites/${invite.code}/accept`,
        payload: {
          name: 'Priya Sharma',
          email: 'priya@freelance.studio',
          paypalEmail: 'priya-sandbox@freelance.studio',
        },
      });

      expect(acceptRes.statusCode).toBe(200);
      const data = acceptRes.json();
      expect(data.success).toBe(true);
      expect(data.user.name).toBe('Priya Sharma');
      expect(data.user.role).toBe('freelancer');

      // Verify ms_freelancer cookie was set
      const cookies = acceptRes.cookies;
      const freelancerCookie = cookies.find((c) => c.name === 'ms_freelancer');
      expect(freelancerCookie).toBeDefined();
      expect(freelancerCookie?.httpOnly).toBe(true);

      // Verify project freelancerId was updated in database
      const db = getDb();
      const [proj] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, 'proj_brand_launch'));
      expect(proj.freelancerId).toBe(data.user.id);
      expect(proj.freelancerPaypalEmail).toBe('priya-sandbox@freelance.studio');

      // Verify single-use invite cannot be accepted a second time
      const secondAcceptRes = await server.inject({
        method: 'POST',
        url: `/api/invites/${invite.code}/accept`,
        payload: {
          name: 'Another Freelancer',
          email: 'another@freelance.studio',
        },
      });
      expect(secondAcceptRes.statusCode).toBe(400);
      expect(secondAcceptRes.json().message).toBe('This invitation is no longer valid.');
    });

    it('enforces rate limiting: 11th request from same IP returns 429', async () => {
      for (let i = 0; i < 10; i++) {
        const res = await server.inject({
          method: 'GET',
          url: '/api/invites/MILE-PROBING00',
          remoteAddress: '198.51.100.42',
        });
        expect(res.statusCode).toBe(404);
      }

      const blockedRes = await server.inject({
        method: 'GET',
        url: '/api/invites/MILE-PROBING00',
        remoteAddress: '198.51.100.42',
      });
      expect(blockedRes.statusCode).toBe(429);
      expect(blockedRes.json().error).toBe('RateLimitExceeded');
    });

    it('funding is blocked before a freelancer is assigned to project', async () => {
      // Create project without freelancer
      const db = getDb();
      const [newProj] = await db
        .insert(projects)
        .values({
          id: 'proj_unassigned_test',
          title: 'Unassigned Project',
          brief: 'Test brief',
          totalCents: 100000,
          status: 'planned',
          clientId: 'user_client_01',
          freelancerId: null,
          isDemo: false,
        })
        .returning();

      // Attempt to create funding order
      const orderRes = await server.inject({
        method: 'POST',
        url: `/api/projects/${newProj.id}/fund/order`,
        headers: { cookie: clientCookie, 'x-persona': 'client' },
      });

      expect(orderRes.statusCode).toBe(400);
      expect(orderRes.json().message).toContain('Project must have an accepted freelancer before funding.');
    });
  });
});
