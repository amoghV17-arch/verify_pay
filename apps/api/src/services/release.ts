import { eq, or, and } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb, type AppDatabase } from '../db/index.js';
import {
  milestones,
  projects,
  ledgerEntries,
  payoutBatches,
  activity,
} from '../db/schema.js';
import { LedgerService } from './ledger.js';
import { sseHub } from './sse.js';
import { PayPalPort, PayPalPayoutResult } from '@milestone/shared';

export interface ReleaseResult {
  success: boolean;
  milestoneId: string;
  status: string;
  message?: string;
  payoutBatchId?: string;
  idempotencyKey: string;
  holdingBalanceCents?: number;
}

export class ReleaseService {
  private ledgerService: LedgerService;

  constructor(
    private db?: AppDatabase,
    private paypal?: PayPalPort
  ) {
    this.ledgerService = new LedgerService(db);
  }

  private get client(): AppDatabase {
    return this.db || getDb();
  }

  /**
   * Release payout for an approved milestone per ARCHITECTURE.md section 7.3.
   * Enforces row locking, approved status assertion, holding balance sufficiency,
   * atomic pending ledger entry with unique idempotency key, and PayPal Payout invocation.
   */
  async releaseMilestone(
    milestoneId: string,
    paypalAdapter: PayPalPort,
    actor: 'client' | 'worker' | 'ai' = 'client'
  ): Promise<ReleaseResult> {
    const paypal = this.paypal || paypalAdapter;
    const now = new Date();

    // 1. Transaction: Row lock, status check, holding balance check, and mark 'releasing'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prepResult = await this.client.transaction(async (tx: any) => {
      // Row lock milestone with FOR UPDATE if supported (supports matching either milestone.id or milestone.taskId)
      let query = tx
        .select()
        .from(milestones)
        .where(or(eq(milestones.id, milestoneId), eq(milestones.taskId, milestoneId)));

      if ('for' in query && typeof query.for === 'function') {
        query = query.for('update');
      }
      const [m] = await query.limit(1);

      if (!m) {
        throw new Error(`Milestone ${milestoneId} not found`);
      }

      const canonicalMilestoneId = m.id;

      // Count previous failed attempts for this milestone to determine attempt number
      const failedEntries = await tx
        .select()
        .from(ledgerEntries)
        .where(
          and(
            eq(ledgerEntries.milestoneId, canonicalMilestoneId),
            eq(ledgerEntries.type, 'release_failed')
          )
        );

      const attempt = failedEntries.length + 1;
      const idempotencyKey =
        attempt === 1
          ? `release:${canonicalMilestoneId}`
          : `release:${canonicalMilestoneId}:att${attempt}`;
      const senderBatchId =
        attempt === 1
          ? `ms_${canonicalMilestoneId}`
          : `ms_${canonicalMilestoneId}_att${attempt}`;

      // Check idempotent duplicate calls
      if (m.status === 'paid') {
        return {
          skip: true,
          result: {
            success: true,
            milestoneId: canonicalMilestoneId,
            status: 'paid',
            message: 'Milestone is already paid',
            idempotencyKey,
          },
        };
      }

      if (m.status === 'releasing') {
        return {
          skip: true,
          result: {
            success: true,
            milestoneId: canonicalMilestoneId,
            status: 'releasing',
            message: 'Release payout is already in progress for this milestone',
            idempotencyKey,
          },
        };
      }

      if (m.status !== 'approved') {
        throw new Error(
          `Cannot release milestone ${canonicalMilestoneId}: milestone must be in 'approved' status (current status: '${m.status}')`
        );
      }

      // Check project existence, holding balance, and acquire project-row lock FOR UPDATE
      let projQuery = tx
        .select()
        .from(projects)
        .where(eq(projects.id, m.projectId));

      if ('for' in projQuery && typeof projQuery.for === 'function') {
        projQuery = projQuery.for('update');
      }
      const [proj] = await projQuery.limit(1);

      if (!proj) {
        throw new Error(`Project ${m.projectId} not found for milestone ${canonicalMilestoneId}`);
      }

      const ledgerSummary = await this.ledgerService.getProjectLedgerSummary(proj.id, tx);
      const availableFunds =
        ledgerSummary.availableHoldingCents !== undefined
          ? ledgerSummary.availableHoldingCents
          : ledgerSummary.holdingBalanceCents - ledgerSummary.pendingReleaseCents;

      if (availableFunds < m.amountCents) {
        throw new Error(
          `CRITICAL FINANCIAL GUARD: Insufficient available holding balance (${availableFunds} cents available, ${ledgerSummary.pendingReleaseCents} cents reserved) to release milestone amount (${m.amountCents} cents).`
        );
      }

      // Insert pending ledger entry with idempotency key
      const ledgerEntryId = `led_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
      await tx
        .insert(ledgerEntries)
        .values({
          id: ledgerEntryId,
          projectId: proj.id,
          milestoneId: m.id,
          type: 'release_pending',
          amountCents: m.amountCents,
          idempotencyKey,
          meta: {
            actor,
            milestoneName: m.name,
            initiatedAt: now.toISOString(),
          },
          createdAt: now,
        })
        .onConflictDoNothing();

      // Transition milestone to 'releasing'
      await tx
        .update(milestones)
        .set({
          status: 'releasing',
          updatedAt: now,
        })
        .where(eq(milestones.id, m.id));

      return {
        skip: false,
        milestone: m,
        project: proj,
        holdingBalanceCents: ledgerSummary.holdingBalanceCents,
        idempotencyKey,
        senderBatchId,
        attempt,
      };
    });

    if (prepResult.skip && prepResult.result) {
      return prepResult.result;
    }

    const { milestone: m, project: proj, holdingBalanceCents, idempotencyKey, senderBatchId, attempt } = prepResult;
    if (!m || !proj) {
      throw new Error('Unexpected release preparation failure');
    }

    const effectiveKey = idempotencyKey || (attempt && attempt > 1 ? `release:${m.id}:att${attempt}` : `release:${m.id}`);
    const effectiveSenderBatchId = senderBatchId || (attempt && attempt > 1 ? `ms_${m.id}_att${attempt}` : `ms_${m.id}`);

    // 2. Call PayPal Payouts with unique sender_batch_id and Request-Id
    const receiverEmail =
      proj.freelancerPaypalEmail ||
      process.env.DEMO_FREELANCER_PAYPAL_EMAIL ||
      'arjun-sandbox@freelance.dev';

    let payoutResult: PayPalPayoutResult;
    try {
      payoutResult = await paypal.createPayout(
        {
          milestoneId: m.id,
          projectId: proj.id,
          amountCents: m.amountCents,
          currency: proj.currency || 'USD',
          receiverEmail,
          senderBatchId: effectiveSenderBatchId,
          note: `${proj.title}: ${m.name}`,
          emailSubject: `Payout for milestone: ${m.name}`,
        },
        effectiveKey
      );
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown PayPal payout error';
      await this.failMilestonePayout({
        milestoneId: m.id,
        projectId: proj.id,
        reason: errorMsg,
      });

      return {
        success: false,
        milestoneId: m.id,
        status: 'approved',
        message: `Payout initiation failed: ${errorMsg}. Milestone returned to approved.`,
        idempotencyKey: effectiveKey,
      };
    }

    // Check if PayPal immediately rejected the batch
    if (payoutResult.batchStatus === 'DENIED' || payoutResult.itemStatus === 'FAILED') {
      await this.failMilestonePayout({
        milestoneId: m.id,
        projectId: proj.id,
        reason: `PayPal batch denied (${payoutResult.batchStatus})`,
        payoutBatchId: payoutResult.payoutBatchId,
      });

      return {
        success: false,
        milestoneId: m.id,
        status: 'approved',
        message: `PayPal batch denied. Milestone returned to approved.`,
        idempotencyKey: effectiveKey,
      };
    }

    // 3. Store payout_batches record
    await this.client
      .insert(payoutBatches)
      .values({
        id: `pb_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
        milestoneId: m.id,
        senderBatchId: effectiveSenderBatchId,
        paypalBatchId: payoutResult.payoutBatchId,
        status: payoutResult.batchStatus,
        raw: payoutResult.raw || {},
        createdAt: new Date(),
      })
      .onConflictDoNothing();

    // 4. If immediate itemStatus is SUCCESS (e.g. In mock mode), complete payout immediately
    if (payoutResult.itemStatus === 'SUCCESS') {
      await this.completeMilestonePayout({
        milestoneId: m.id,
        projectId: proj.id,
        payoutBatchId: payoutResult.payoutBatchId,
        payoutItemId: payoutResult.payoutItemId,
        amountCents: m.amountCents,
        milestoneName: m.name,
      });

      return {
        success: true,
        milestoneId: m.id,
        status: 'paid',
        message: 'Payout completed successfully',
        payoutBatchId: payoutResult.payoutBatchId,
        idempotencyKey: effectiveKey,
        holdingBalanceCents: (holdingBalanceCents ?? 0) - m.amountCents,
      };
    }

    // Broadcast that milestone is now releasing
    sseHub.broadcast(proj.id, 'milestone.status', {
      milestoneId: m.id,
      status: 'releasing',
    });

    return {
      success: true,
      milestoneId: m.id,
      status: 'releasing',
      message: 'Payout batch accepted by PayPal and processing',
      payoutBatchId: payoutResult.payoutBatchId,
      idempotencyKey: effectiveKey,
      holdingBalanceCents,
    };
  }

  /**
   * Finalizes milestone payout upon SUCCESS webhook or reconciler confirmation.
   * Atomically records 'released' ledger entry, updates milestone to 'paid', logs activity, and emits SSE.
   */
  async completeMilestonePayout(params: {
    milestoneId: string;
    projectId?: string;
    payoutBatchId?: string;
    payoutItemId?: string;
    transactionId?: string;
    amountCents?: number;
    milestoneName?: string;
  }): Promise<boolean> {
    const now = new Date();

    // Verify milestone exists (supporting milestone.id or milestone.taskId)
    const [m] = await this.client
      .select()
      .from(milestones)
      .where(or(eq(milestones.id, params.milestoneId), eq(milestones.taskId, params.milestoneId)))
      .limit(1);

    if (!m) return false;
    const releaseKey = `release_complete:${m.id}`;
    const projectId = params.projectId || m.projectId;
    const amountCents = params.amountCents ?? m.amountCents;
    const milestoneName = params.milestoneName ?? m.name;

    // Check if already marked paid
    if (m.status === 'paid') {
      return true;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.client.transaction(async (tx: any) => {
        // 1. Insert 'released' ledger entry (guarded by partial unique index one_released_per_milestone)
        await tx.insert(ledgerEntries).values({
          id: `led_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
          projectId,
          milestoneId: m.id,
          type: 'released',
          amountCents,
          paypalRef: params.transactionId || params.payoutItemId || params.payoutBatchId,
          idempotencyKey: releaseKey,
          meta: {
            payoutBatchId: params.payoutBatchId,
            payoutItemId: params.payoutItemId,
            transactionId: params.transactionId,
            completedAt: now.toISOString(),
          },
          createdAt: now,
        });

        // 2. Mark milestone as 'paid'
        await tx
          .update(milestones)
          .set({
            status: 'paid',
            updatedAt: now,
          })
          .where(eq(milestones.id, m.id));

        // 3. Log activity
        const formattedAmount = (amountCents / 100).toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
        });
        await tx.insert(activity).values({
          id: `act_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
          projectId,
          actor: 'paypal',
          kind: 'milestone_paid',
          text: `Payout of ${formattedAmount} released for "${milestoneName}" via PayPal`,
          meta: {
            milestoneId: m.id,
            payoutBatchId: params.payoutBatchId,
            payoutItemId: params.payoutItemId,
            transactionId: params.transactionId,
          },
          ts: now,
        });
      });

      // 4. Broadcast live events
      sseHub.broadcast(projectId, 'milestone.status', {
        milestoneId: m.id,
        status: 'paid',
        amountCents,
      });

      sseHub.broadcast(projectId, 'ledger.entry', {
        type: 'released',
        milestoneId: m.id,
        amountCents,
      });

      return true;
    } catch (err: unknown) {
      // In case of conflict with partial unique index, it was already completed
      const errorMsg = err instanceof Error ? err.message : '';
      if (errorMsg.includes('one_released_per_milestone') || errorMsg.includes('idempotency_key')) {
        return true;
      }
      throw err;
    }
  }

  /**
   * Reverts milestone to 'approved' and records 'release_failed' in ledger on terminal failure.
   */
  async failMilestonePayout(params: {
    milestoneId: string;
    projectId?: string;
    reason: string;
    payoutBatchId?: string;
  }): Promise<void> {
    const now = new Date();
    const [m] = await this.client
      .select()
      .from(milestones)
      .where(or(eq(milestones.id, params.milestoneId), eq(milestones.taskId, params.milestoneId)))
      .limit(1);

    if (!m) return;
    const projectId = params.projectId || m.projectId;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.client.transaction(async (tx: any) => {
      // 1. Record release_failed entry
      await tx.insert(ledgerEntries).values({
        id: `led_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
        projectId,
        milestoneId: m.id,
        type: 'release_failed',
        amountCents: m.amountCents,
        paypalRef: params.payoutBatchId,
        idempotencyKey: `release_failed:${m.id}:${now.getTime()}`,
        meta: {
          reason: params.reason,
          payoutBatchId: params.payoutBatchId,
          failedAt: now.toISOString(),
        },
        createdAt: now,
      });

      // 2. Revert milestone status to 'approved' so it can be retried
      await tx
        .update(milestones)
        .set({
          status: 'approved',
          updatedAt: now,
        })
        .where(eq(milestones.id, m.id));

      // 3. Log activity alert
      await tx.insert(activity).values({
        id: `act_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
        projectId,
        actor: 'system',
        kind: 'milestone_release_failed',
        text: `Payout release failed for "${m.name}": ${params.reason}. Returned to approved state.`,
        meta: {
          milestoneId: m.id,
          reason: params.reason,
        },
        ts: now,
      });
    });

    // Broadcast status change back to approved
    sseHub.broadcast(projectId, 'milestone.status', {
      milestoneId: m.id,
      status: 'approved',
    });
  }
}
