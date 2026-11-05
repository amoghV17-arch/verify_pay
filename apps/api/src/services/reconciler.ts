import { eq, and, lt, desc } from 'drizzle-orm';
import { getDb, type AppDatabase } from '../db/index.js';
import { milestones, payoutBatches } from '../db/schema.js';
import { ReleaseService } from './release.js';
import { PayPalPort } from '@milestone/shared';

export class ReconcilerService {
  private releaseService: ReleaseService;

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
   * Reconciles milestones stuck in 'releasing' > thresholdSeconds without a webhook.
   * Per PAYPAL_INTEGRATION.md section 7:
   * Every 30 seconds: milestones in releasing for more than 20 seconds with no webhook: GET batch, apply result.
   */
  async reconcileStaleReleases(
    paypalAdapter: PayPalPort,
    thresholdSeconds = 20
  ): Promise<{ checked: number; resolved: number }> {
    const paypal = this.paypal || paypalAdapter;
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
        } else if (['FAILED', 'DENIED', 'RETURNED', 'BLOCKED'].includes(status)) {
          await this.releaseService.failMilestonePayout({
            milestoneId: m.id,
            projectId: m.projectId,
            reason: `Reconciled failure: ${status}`,
            payoutBatchId: batch.paypalBatchId,
          });
          resolved++;
        }
      } catch {
        // Skip on temporary network failure
      }
    }

    return { checked: staleMilestones.length, resolved };
  }
}

