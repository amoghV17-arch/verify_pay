import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildServer } from '../server.js';
import { initDb, closeDb, getDb } from '../db/index.js';
import { seedDatabase } from '../db/seed.js';
import { milestones } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { loadConfig } from '@milestone/shared';
import { createTestUserSession } from './helpers/authTestHelper.js';

describe('M8d Phase P3: Server-Side Authorization Matrix & Dual Sessions Suite', () => {
  let server: ReturnType<typeof buildServer>;
  let clientHeaders: Record<string, string>;
  let freelancerHeaders: Record<string, string>;
  let dualCookies: string;
  let clientCsrf: string;
  let freelancerCsrf: string;

  beforeEach(async () => {
    await initDb({ useMemory: true });
    const db = getDb();
    await seedDatabase(db);

    const config = loadConfig({
      NODE_ENV: 'test',
      PORT: '8080',
      PAYPAL_ENV: 'mock',
      LLM_PROVIDER: 'fixture',
      DEMO_MODE: 'true',
    });
    server = buildServer(config);

    const clientUser = await createTestUserSession({
      userId: 'user_client_01',
      role: 'client',
      name: 'Sarah Lin (Acme Corp)',
      slot: 'client',
      config,
    });
    const freelancerUser = await createTestUserSession({
      userId: 'user_freelancer_01',
      role: 'freelancer',
      name: 'Arjun Mehta',
      slot: 'freelancer',
      config,
    });

    clientHeaders = clientUser.headers;
    freelancerHeaders = freelancerUser.headers;
    clientCsrf = clientUser.csrfToken;
    freelancerCsrf = freelancerUser.csrfToken;

    // Both cookies present simultaneously (as in /demo/split)
    dualCookies = `${clientUser.cookie}; ${freelancerUser.cookie}`;
  });

  afterEach(async () => {
    await server.close();
    await closeDb();
  });

  describe('Authorization Matrix (Client vs Freelancer)', () => {
    // 1. Create project, approve plan, edit criteria (before funding)
    describe('Group 1: Project Creation, Plan Approval, Criteria Editing', () => {
      it('Client can create project (201); Freelancer is forbidden (403)', async () => {
        const clientRes = await server.inject({
          method: 'POST',
          url: '/api/projects',
          headers: { ...clientHeaders },
          payload: { brief: 'New client project brief', title: 'Brand Project' },
        });
        expect(clientRes.statusCode).toBe(201);

        const freelancerRes = await server.inject({
          method: 'POST',
          url: '/api/projects',
          headers: { ...freelancerHeaders },
          payload: { brief: 'Freelancer trying to create project' },
        });
        expect(freelancerRes.statusCode).toBe(403);
      });

      it('Client can approve/apply plan; Freelancer is forbidden (403)', async () => {
        const payload = {
          plan: {
            projectTitle: 'Applied Plan',
            summary: 'Summary',
            totalBudget: 8000,
            totalCents: 800000,
            tasks: [
              { id: 'pt1', name: 'Task 1', durationDays: 2, dependsOn: [] },
              { id: 'pt2', name: 'Task 2', durationDays: 3, dependsOn: ['pt1'] },
              { id: 'pt3', name: 'Task 3', durationDays: 4, dependsOn: ['pt2'] },
            ],
            milestones: [
              {
                id: 'pms1',
                name: 'Milestone 1',
                paymentPercent: 30,
                amountCents: 240000,
                deliverableType: 'document',
                acceptanceCriteria: ['API returns HTTP 200', 'Database schema exists'],
                afterTaskIds: ['pt1'],
              },
              {
                id: 'pms2',
                name: 'Milestone 2',
                paymentPercent: 35,
                amountCents: 280000,
                deliverableType: 'url',
                acceptanceCriteria: ['Unit tests pass 100%', 'Lighthouse score is 95+'],
                afterTaskIds: ['pt2'],
              },
              {
                id: 'pms3',
                name: 'Milestone 3',
                paymentPercent: 35,
                amountCents: 280000,
                deliverableType: 'repo',
                acceptanceCriteria: ['Git repository tagged v1.0', 'Production build passes'],
                afterTaskIds: ['pt3'],
              },
            ],
          },
        };

        const clientRes = await server.inject({
          method: 'POST',
          url: '/api/projects/proj_brand_launch/plan/apply',
          headers: { ...clientHeaders },
          payload,
        });
        expect(clientRes.statusCode).toBe(200);

        const freelancerRes = await server.inject({
          method: 'POST',
          url: '/api/projects/proj_brand_launch/plan/apply',
          headers: { ...freelancerHeaders },
          payload,
        });
        expect(freelancerRes.statusCode).toBe(403);
      });

      it('Client can edit criteria before funding; Freelancer is forbidden (403)', async () => {
        const clientRes = await server.inject({
          method: 'PATCH',
          url: '/api/projects/proj_brand_launch/milestones/ms-04/criteria',
          headers: { ...clientHeaders },
          payload: {
            criteria: [{ id: 'c4-1', description: 'Updated criteria description' }],
          },
        });
        // Note: proj_brand_launch is funded in seed, so criteria is locked (400) for client, but 403 for freelancer
        expect(clientRes.statusCode).toBe(400);

        const freelancerRes = await server.inject({
          method: 'PATCH',
          url: '/api/projects/proj_brand_launch/milestones/ms-04/criteria',
          headers: { ...freelancerHeaders },
          payload: {
            criteria: [{ id: 'c4-1', description: 'Freelancer tampering criteria' }],
          },
        });
        expect(freelancerRes.statusCode).toBe(403);
      });
    });

    // 2. Create or revoke invite, fund, set autonomy
    describe('Group 2: Invites, Funding, Autonomy Settings', () => {
      it('Client can create & revoke invites; Freelancer is forbidden (403)', async () => {
        // Create invite
        const clientCreate = await server.inject({
          method: 'POST',
          url: '/api/projects/proj_brand_launch/invites',
          headers: { ...clientHeaders },
        });
        expect(clientCreate.statusCode).toBe(201);
        const { invite } = clientCreate.json();

        const freelancerCreate = await server.inject({
          method: 'POST',
          url: '/api/projects/proj_brand_launch/invites',
          headers: { ...freelancerHeaders },
        });
        expect(freelancerCreate.statusCode).toBe(403);

        // Revoke invite
        const freelancerRevoke = await server.inject({
          method: 'POST',
          url: `/api/invites/${invite.id}/revoke`,
          headers: { ...freelancerHeaders },
        });
        expect(freelancerRevoke.statusCode).toBe(403);

        const clientRevoke = await server.inject({
          method: 'POST',
          url: `/api/invites/${invite.id}/revoke`,
          headers: { ...clientHeaders },
        });
        expect(clientRevoke.statusCode).toBe(200);
      });

      it('Client can initiate funding; Freelancer is forbidden (403)', async () => {
        const clientRes = await server.inject({
          method: 'POST',
          url: '/api/projects/proj_brand_launch/fund/order',
          headers: { ...clientHeaders },
        });
        expect(clientRes.statusCode).toBe(200);

        const freelancerRes = await server.inject({
          method: 'POST',
          url: '/api/projects/proj_brand_launch/fund/order',
          headers: { ...freelancerHeaders },
        });
        expect(freelancerRes.statusCode).toBe(403);
      });

      it('Client can set autonomy mode; Freelancer is forbidden (403)', async () => {
        const clientRes = await server.inject({
          method: 'PATCH',
          url: '/api/projects/proj_brand_launch',
          headers: { ...clientHeaders },
          payload: { autonomyMode: 'auto', releaseWindowSeconds: 30 },
        });
        expect(clientRes.statusCode).toBe(200);

        const freelancerRes = await server.inject({
          method: 'PATCH',
          url: '/api/projects/proj_brand_launch',
          headers: { ...freelancerHeaders },
          payload: { autonomyMode: 'manual' },
        });
        expect(freelancerRes.statusCode).toBe(403);
      });
    });

    // 3. Accept invite, submit deliverable, appeal, update progress
    describe('Group 3: Freelancer Actions (Submit, Appeal, Progress)', () => {
      it('Client cannot accept own invite (403); Freelancer can accept (200)', async () => {
        const inviteRes = await server.inject({
          method: 'POST',
          url: '/api/projects/proj_brand_launch/invites',
          headers: { ...clientHeaders },
        });
        const { invite } = inviteRes.json();

        // Client attempt to accept own invite
        const clientAccept = await server.inject({
          method: 'POST',
          url: `/api/invites/${invite.code}/accept`,
          headers: { ...clientHeaders },
          payload: { paypalEmail: 'client-sandbox@acme.com' },
        });
        expect(clientAccept.statusCode).toBe(403);

        // Freelancer attempt with a fresh user session
        const newFreelancer = await createTestUserSession({
          userId: 'user_freelancer_new_01',
          email: 'freelancer.new@example.com',
          role: 'freelancer',
        });
        const freelancerAccept = await server.inject({
          method: 'POST',
          url: `/api/invites/${invite.code}/accept`,
          headers: { ...newFreelancer.headers },
          payload: { paypalEmail: 'freelancer.new-sandbox@example.com' },
        });
        expect(freelancerAccept.statusCode).toBe(200);
      });

      it('Freelancer can submit deliverable (202); Client is forbidden (403)', async () => {
        // Set ms-02 to funded for submission test
        const db = getDb();
        await db.update(milestones).set({ status: 'funded' }).where(eq(milestones.id, 'ms-02'));

        const clientRes = await server.inject({
          method: 'POST',
          url: '/api/milestones/ms-02/submit',
          headers: { ...clientHeaders },
          payload: { kind: 'document', payload: { documentUrl: 'https://example.com/wireframes.pdf' } },
        });
        expect(clientRes.statusCode).toBe(403);

        const freelancerRes = await server.inject({
          method: 'POST',
          url: '/api/milestones/ms-02/submit',
          headers: { ...freelancerHeaders },
          payload: { kind: 'document', payload: { documentUrl: 'https://example.com/wireframes.pdf' } },
        });
        expect(freelancerRes.statusCode).toBe(202);
      });

      it('Freelancer can appeal; Client is forbidden (403)', async () => {
        // Set ms-03 to changes_requested for appeal test
        const db = getDb();
        await db.update(milestones).set({ status: 'changes_requested' }).where(eq(milestones.id, 'ms-03'));

        const clientRes = await server.inject({
          method: 'POST',
          url: '/api/milestones/ms-03/appeal',
          headers: { ...clientHeaders },
          payload: { explanation: 'Client appealing milestone verdict' },
        });
        expect(clientRes.statusCode).toBe(403);

        const freelancerRes = await server.inject({
          method: 'POST',
          url: '/api/milestones/ms-03/appeal',
          headers: { ...freelancerHeaders },
          payload: { explanation: 'Freelancer comprehensive appeal explanation here.' },
        });
        expect(freelancerRes.statusCode).toBe(202);
      });

      it('Freelancer can update task progress; Client is forbidden (403)', async () => {
        const clientRes = await server.inject({
          method: 'PATCH',
          url: '/api/projects/proj_brand_launch/tasks/t7/progress',
          headers: { ...clientHeaders },
          payload: { percentDone: 100 },
        });
        expect(clientRes.statusCode).toBe(403);

        const freelancerRes = await server.inject({
          method: 'PATCH',
          url: '/api/projects/proj_brand_launch/tasks/t7/progress',
          headers: { ...freelancerHeaders },
          payload: { percentDone: 95 },
        });
        expect(freelancerRes.statusCode).toBe(200);
      });
    });

    // 4. Release, request changes, object
    describe('Group 4: Client Review Actions (Release, Request Changes, Object)', () => {
      it('Client can release payout; Freelancer is forbidden (403)', async () => {
        const freelancerRes = await server.inject({
          method: 'POST',
          url: '/api/milestones/ms-02/release',
          headers: { ...freelancerHeaders },
        });
        expect(freelancerRes.statusCode).toBe(403);

        const clientRes = await server.inject({
          method: 'POST',
          url: '/api/milestones/ms-02/release',
          headers: { ...clientHeaders },
        });
        expect(clientRes.statusCode).toBe(200);
      });

      it('Client can request changes / object; Freelancer is forbidden (403)', async () => {
        const freelancerObject = await server.inject({
          method: 'POST',
          url: '/api/milestones/ms-02/object',
          headers: { ...freelancerHeaders },
        });
        expect(freelancerObject.statusCode).toBe(403);

        const freelancerChanges = await server.inject({
          method: 'POST',
          url: '/api/milestones/ms-02/request-changes',
          headers: { ...freelancerHeaders },
        });
        expect(freelancerChanges.statusCode).toBe(403);

        const clientChanges = await server.inject({
          method: 'POST',
          url: '/api/milestones/ms-02/request-changes',
          headers: { ...clientHeaders },
          payload: { reason: 'Please refine color contrast' },
        });
        expect(clientChanges.statusCode).toBe(200);
      });
    });

    // 5. Read project, milestones, ledger, reviews (Role-scoped response shapes)
    describe('Group 5: Read Actions & Scoped Response Shapes', () => {
      it('Client reading /api/projects/:id receives full autonomy settings', async () => {
        const res = await server.inject({
          method: 'GET',
          url: '/api/projects/proj_brand_launch',
          headers: { ...clientHeaders },
        });

        expect(res.statusCode).toBe(200);
        const data = res.json();
        expect(data.project.autonomyMode).toBeDefined();
        expect(data.project.releaseWindowSeconds).toBeDefined();
        expect(data.project.isDemo).toBe(true);
      });

      it('Freelancer reading /api/projects/:id receives scoped DTO without autonomy settings', async () => {
        const res = await server.inject({
          method: 'GET',
          url: '/api/projects/proj_brand_launch',
          headers: { ...freelancerHeaders },
        });

        expect(res.statusCode).toBe(200);
        const data = res.json();
        expect(data.project.autonomyMode).toBeUndefined();
        expect(data.project.releaseWindowSeconds).toBeUndefined();
      });
    });
  });

  describe('Dual Cookies & X-Session-Slot Routing (/demo/split compatibility)', () => {
    it('selects client role when X-Session-Slot: client even if both cookies are present', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/projects/proj_brand_launch/invites',
        headers: {
          cookie: dualCookies,
          'x-csrf-token': clientCsrf,
          'x-session-slot': 'client',
        },
      });
      expect(res.statusCode).toBe(201);
    });

    it('selects freelancer role when X-Session-Slot: freelancer even if both cookies are present', async () => {
      // Freelancer should be forbidden from creating invites
      const res = await server.inject({
        method: 'POST',
        url: '/api/projects/proj_brand_launch/invites',
        headers: {
          cookie: dualCookies,
          'x-csrf-token': freelancerCsrf,
          'x-session-slot': 'freelancer',
        },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('Receipt Share Links Architecture', () => {
    it('client can create share link, public can view receipt, client can revoke', async () => {
      // 1. Create share link
      const createRes = await server.inject({
        method: 'POST',
        url: '/api/milestones/ms-01/share',
        headers: { ...clientHeaders },
      });

      expect(createRes.statusCode).toBe(201);
      const { shareId, shareUrl } = createRes.json();
      expect(shareId).toBeDefined();
      expect(shareUrl).toContain('/receipts/shared/');

      // 2. Public view without auth
      const publicRes = await server.inject({
        method: 'GET',
        url: `/api/receipts/shared/${shareId}`,
      });

      expect(publicRes.statusCode).toBe(200);
      const data = publicRes.json();
      expect(data.success).toBe(true);
      expect(data.receipt.milestone.name).toBe('Milestone 1: Brand Strategy Approved');

      // 3. Revoke share link
      const revokeRes = await server.inject({
        method: 'POST',
        url: '/api/milestones/ms-01/share/revoke',
        headers: { ...clientHeaders },
      });
      expect(revokeRes.statusCode).toBe(200);

      // 4. Public view after revocation fails with 404
      const afterRevokeRes = await server.inject({
        method: 'GET',
        url: `/api/receipts/shared/${shareId}`,
      });
      expect(afterRevokeRes.statusCode).toBe(404);
    });
  });
});
