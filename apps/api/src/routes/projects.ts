import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { requireRole } from '../auth/index.js';

export async function registerProjectRoutes(server: FastifyInstance): Promise<void> {
  const { projects, milestones, ledgerEntries, tasks, dependencies, users } = schema;

  // List all projects accessible to current user
  server.get('/api/projects', async (_request: FastifyRequest, reply: FastifyReply) => {
    const db = getDb();
    const allProjects = await db.select().from(projects).orderBy(desc(projects.createdAt));
    return reply.send({ success: true, projects: allProjects });
  });

  // Get project by ID with milestones and ledger summary
  server.get<{ Params: { id: string } }>(
    '/api/projects/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const db = getDb();
      const { id } = request.params;

      const [proj] = await db.select().from(projects).where(eq(projects.id, id));
      if (!proj) {
        return reply.status(404).send({ error: 'NotFound', message: `Project "${id}" not found.` });
      }

      const projMilestones = await db
        .select()
        .from(milestones)
        .where(eq(milestones.projectId, id));

      const projLedger = await db
        .select()
        .from(ledgerEntries)
        .where(eq(ledgerEntries.projectId, id));

      // Calculate paid and held sums
      const paidCents = projLedger
        .filter((l) => l.type === 'released')
        .reduce((sum, l) => sum + l.amountCents, 0);

      const fundedCents = projLedger
        .filter((l) => l.type === 'funded')
        .reduce((sum, l) => sum + l.amountCents, 0);

      const [client] = await db.select().from(users).where(eq(users.id, proj.clientId));
      const [freelancer] = await db.select().from(users).where(eq(users.id, proj.freelancerId));

      return reply.send({
        success: true,
        project: proj,
        client,
        freelancer,
        milestones: projMilestones,
        ledger: {
          entries: projLedger,
          totalCents: proj.totalCents,
          fundedCents,
          paidCents,
          heldCents: fundedCents - paidCents,
        },
      });
    }
  );

  // Update project settings (Role: client only)
  server.patch<{ Params: { id: string }; Body: { title?: string; autonomyMode?: string; releaseWindowSeconds?: number } }>(
    '/api/projects/:id',
    { preHandler: [requireRole(['client'])] },
    async (request, reply) => {
      const db = getDb();
      const { id } = request.params;
      const { title, autonomyMode, releaseWindowSeconds } = request.body;

      const updateData: Partial<typeof projects.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (title) updateData.title = title;
      if (autonomyMode) updateData.autonomyMode = autonomyMode;
      if (releaseWindowSeconds != null) updateData.releaseWindowSeconds = releaseWindowSeconds;

      const [updated] = await db
        .update(projects)
        .set(updateData)
        .where(eq(projects.id, id))
        .returning();

      if (!updated) {
        return reply.status(404).send({ error: 'NotFound', message: `Project "${id}" not found.` });
      }

      return reply.send({ success: true, project: updated });
    }
  );

  // List tasks for a project
  server.get<{ Params: { id: string } }>(
    '/api/projects/:id/tasks',
    async (request, reply) => {
      const db = getDb();
      const { id } = request.params;

      const taskRows = await db.select().from(tasks).where(eq(tasks.projectId, id));
      const depRows = await db.select().from(dependencies).where(eq(dependencies.projectId, id));
      const milestoneRows = await db.select().from(milestones).where(eq(milestones.projectId, id));

      return reply.send({
        success: true,
        tasks: taskRows,
        dependencies: depRows,
        milestones: milestoneRows,
      });
    }
  );
}
