import { eq, and, lt, desc } from 'drizzle-orm';
import { getDb, type AppDatabase } from '../db/index.js';
import { milestones, payoutBatches } from '../db/schema.js';
import { ReleaseService } from './release.js';
import { PayPalPort } from '@milestone/shared';

export class ReconcilerService {
  private releaseService: ReleaseService;
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

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
   * Starts background reconciliation polling for stale 'releasing' payouts.
   */
  start(paypalAdapter: PayPalPort, intervalMs = 15_000, thresholdSeconds = 10): void {
    if (this.timer) return;
    const paypal = paypalAdapter || this.paypal;
    const tick = async () => {
      if (this.isRunning) return;
      this.isRunning = true;
      try {
        await this.reconcileStaleReleases(paypal, thresholdSeconds);
      } catch {
        // Non-fatal: retry on next interval
      } finally {
        this.isRunning = false;
      }
    };

    void tick();
    this.timer = setInterval(() => {
      void tick();
    }, intervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Reconciles milestones stuck in 'releasing' > thresholdSeconds without a webhook.
   * Per PAYPAL_INTEGRATION.md section 7:
   * Every 30 seconds: milestones in releasing for more than 20 seconds with no webhook: GET batch, apply result.
   */
  async reconcileStaleReleases(
    paypalAdapter: PayPalPort,
    thresholdSeconds = 20
  ): Promise<{ checked: number; resolved: number }> {
    const paypal = paypalAdapter || this.paypal;
    const cutoff = new Date(Date.now() - thresholdSeconds * 1000);

    const staleMilestones = await this.client
      .select()
      .from(milestones)
      .where(and(eq(milestones.status, 'releasing'), lt(milestones.updatedAt, cutoff)));

    let resolved = 0;

    for (const m of staleMilestones) {
      const [batch] = await this.client
        .select()
        .from(payoutBatches)
        .where(eq(payoutBatches.milestoneId, m.id))
        .orderBy(desc(payoutBatches.createdAt))
        .limit(1);

      if (!batch?.paypalBatchId) {
        continue;
      }

      try {
        const batchDetails = await paypal.getPayoutBatch(batch.paypalBatchId);
        const item = batchDetails.items[0];
        const status = item?.transactionStatus || batchDetails.batchStatus;

        if (status === 'SUCCESS') {
          await this.releaseService.completeMilestonePayout({
            milestoneId: m.id,
            projectId: m.projectId,
            payoutBatchId: batch.paypalBatchId,
            payoutItemId: item?.payoutItemId,
            transactionId: item?.transactionId,
          });
          resolved++;
        } else if (['FAILED', 'DENIED', 'RETURNED', 'BLOCKED', 'CANCELED'].includes(status)) {
          await this.client
            .update(payoutBatches)
            .set({ status })
            .where(eq(payoutBatches.id, batch.id));
          await this.releaseService.failMilestonePayout({
            milestoneId: m.id,
            projectId: m.projectId,
            reason: `Reconciled failure: ${status}`,
            payoutBatchId: batch.paypalBatchId,
          });
          resolved++;
        } else if (status && status !== batch.status) {
          // Keep UNCLAIMED / ONHOLD / PENDING synced in payout_batches for UI visibility
          await this.client
            .update(payoutBatches)
            .set({ status })
            .where(eq(payoutBatches.id, batch.id));
        }
      } catch {
        // Skip on temporary network failure
      }
    }

    return { checked: staleMilestones.length, resolved };
  }
}

