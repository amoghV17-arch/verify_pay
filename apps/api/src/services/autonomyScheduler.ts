/**
 * AutonomySchedulerService — handles background execution of assisted release windows
 * per docs/ARCHITECTURE.md section 6 and M7 checklist.
 *
 * In assisted mode, when an AI review returns 'release', the milestone moves to
 * 'approved' with `release_at = now + releaseWindowSeconds`.
 * This service checks for due releases and triggers payout unless the client has objected.
 */
import { eq, and, lte, isNotNull } from 'drizzle-orm';
import { getDb, type AppDatabase } from '../db/index.js';
import { milestones, projects } from '../db/schema.js';
import { ReleaseService } from './release.js';
import { sseHub } from './sse.js';
import type { PayPalPort } from '@milestone/shared';

export interface SchedulerTickResult {
  checked: number;
  released: number;
  errors: Array<{ milestoneId: string; error: string }>;
}

export class AutonomySchedulerService {
  private releaseService: ReleaseService;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    private db?: AppDatabase,
    private paypal?: PayPalPort
  ) {
    this.releaseService = new ReleaseService(db, paypal);
  }

  private get client(): AppDatabase {
    return this.db || getDb();
  }

  /**
   * Process all assisted-mode milestones where release_at has passed.
   */
  async processDueAssistedReleases(paypalAdapter?: PayPalPort): Promise<SchedulerTickResult> {
    const paypal = this.paypal || paypalAdapter;
    if (!paypal) {
      throw new Error('PayPal adapter is required for AutonomyScheduler');
    }

    const now = new Date();

    // Find milestones in 'approved' state with release_at <= now
    const dueMilestones = await this.client
      .select()
      .from(milestones)
      .where(
        and(
          eq(milestones.status, 'approved'),
          isNotNull(milestones.releaseAt),
          lte(milestones.releaseAt, now)
        )
      );

    const result: SchedulerTickResult = {
      checked: dueMilestones.length,
      released: 0,
      errors: [],
    };

    for (const m of dueMilestones) {
      try {
        // Double check project autonomy mode
        const [proj] = await this.client
          .select()
          .from(projects)
          .where(eq(projects.id, m.projectId))
          .limit(1);

        if (proj?.autonomyMode === 'manual') {
          // Manual mode does not auto-release; clear releaseAt and continue
          await this.client
            .update(milestones)
            .set({ releaseAt: null, updatedAt: new Date() })
            .where(eq(milestones.id, m.id));
          continue;
        }

        // Trigger payout release
        const releaseRes = await this.releaseService.releaseMilestone(m.id, paypal, 'ai');

        if (releaseRes.success) {
          result.released++;

          // Clear releaseAt after successful release
          await this.client
            .update(milestones)
            .set({ releaseAt: null, updatedAt: new Date() })
            .where(eq(milestones.id, m.id));

          // Broadcast SSE
          sseHub.broadcast(m.projectId, 'milestone.status', {
            milestoneId: m.id,
            status: 'releasing',
            source: 'assisted_scheduler',
          });
        } else {
          result.errors.push({
            milestoneId: m.id,
            error: releaseRes.message || 'Release returned failure',
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push({ milestoneId: m.id, error: msg });
      }
    }

    return result;
  }

  /**
   * Start recurring background timer (every 1000ms).
   */
  start(paypalAdapter: PayPalPort, intervalMs = 1000): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(async () => {
      try {
        await this.processDueAssistedReleases(paypalAdapter);
      } catch {
        // Silently continue in background
      }
    }, intervalMs);
  }

  /**
   * Stop background timer.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
