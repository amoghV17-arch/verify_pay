import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/index.js';
import { paypalEvents } from '../db/schema.js';
import { LedgerService } from '../services/ledger.js';
import { ReleaseService } from '../services/release.js';
import { sseHub } from '../services/sse.js';
import { PayPalPort } from '@milestone/shared';

export interface WebhookRouteOptions {
  paypalAdapter?: PayPalPort;
}

export const registerWebhookRoutes: FastifyPluginAsync<WebhookRouteOptions> = async (
  server,
  options
) => {
  const ledgerService = new LedgerService();
  const releaseService = new ReleaseService();

  server.post(
    '/api/webhooks/paypal',
    async (request: FastifyRequest, reply) => {
      const paypal =
        (request.server as unknown as { paypalAdapter: PayPalPort }).paypalAdapter ||
        options.paypalAdapter;

      if (!paypal) {
        return reply.status(500).send({ error: 'PayPal adapter not initialized' });
      }

      const rawBody = (request as unknown as { rawBody?: string }).rawBody || JSON.stringify(request.body);

      // 1. Signature Verification
      const verifyResult = await paypal.verifyWebhook({
        headers: request.headers,
        rawBody,
      });

      if (!verifyResult.verified) {
        request.log.warn('PayPal webhook signature verification failed');
        return reply.status(401).send({ error: 'Invalid webhook signature' });
      }

      let event: {
        id: string;
        event_type: string;
        resource?: {
          id?: string;
          status?: string;
          custom_id?: string;
          sender_batch_id?: string;
          payout_batch_id?: string;
          payout_item_id?: string;
          transaction_id?: string;
          transaction_status?: string;
          payout_item?: {
            sender_item_id?: string;
            receiver?: string;
            amount?: { value: string; currency?: string };
          };
          batch_header?: {
            sender_batch_header?: {
              sender_batch_id?: string;
            };
          };
          amount?: { value: string; currency_code?: string };
          supplementary_data?: {
            related_ids?: {
              order_id?: string;
            };
          };
        };
      };

      try {
        event = typeof request.body === 'object' && request.body !== null
          ? (request.body as typeof event)
          : JSON.parse(rawBody);
      } catch {
        return reply.status(400).send({ error: 'Malformed JSON payload' });
      }

      if (!event.id || !event.event_type) {
        return reply.status(400).send({ error: 'Missing event ID or event_type' });
      }

      const db = getDb();

      // 2. Event Deduplication
      const [existing] = await db
        .select({ id: paypalEvents.id })
        .from(paypalEvents)
        .where(eq(paypalEvents.paypalEventId, event.id))
        .limit(1);

      if (existing) {
        return reply.status(200).send({ status: 'ignored_duplicate', eventId: event.id });
      }

      // 3. Persist Event
      const dbEventId = `evt_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
      const now = new Date();

      await db.insert(paypalEvents).values({
        id: dbEventId,
        paypalEventId: event.id,
        type: event.event_type,
        payload: event as unknown as Record<string, unknown>,
        createdAt: now,
      });

      // 4. Process Recognized Events
      try {
        // A. Capture Completed (Funding)
        if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED' && event.resource) {
          const captureId = event.resource.id;
          const projectId = event.resource.custom_id;
          const orderId =
            event.resource.supplementary_data?.related_ids?.order_id || 'unknown';
          const amountCents = event.resource.amount?.value
            ? Math.round(parseFloat(event.resource.amount.value) * 100)
            : 0;

          if (projectId && captureId) {
            const record = await ledgerService.recordProjectFunding({
              projectId,
              captureId,
              orderId,
              amountCents,
              meta: { source: 'webhook', webhookEventId: event.id },
            });

            sseHub.broadcast(projectId, 'project.funded', {
              projectId,
              captureId,
              amountCents,
              holdingBalanceCents: record.summary.holdingBalanceCents,
            });

            sseHub.broadcast(projectId, 'ledger.entry', {
              type: 'funded',
              amountCents,
              paypalRef: captureId,
            });
          }
        }

        // B. Payout Succeeded
        if (
          (event.event_type === 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED' ||
            event.event_type === 'PAYMENT.PAYOUTSBATCH.SUCCESS') &&
          event.resource
        ) {
          const senderBatchId =
            event.resource.sender_batch_id ||
            event.resource.batch_header?.sender_batch_header?.sender_batch_id ||
            '';
          const senderItemId = event.resource.payout_item?.sender_item_id || '';

          let milestoneId = '';
          if (senderBatchId.startsWith('ms_')) {
            milestoneId = senderBatchId.replace(/^ms_/, '').replace(/_att\d+$/, '');
          } else if (senderItemId.startsWith('ms_')) {
            milestoneId = senderItemId.replace(/^ms_/, '').replace(/_att\d+$/, '').replace(/_item$/, '');
          }

          if (milestoneId) {
            const payoutBatchId = event.resource.payout_batch_id;
            const payoutItemId = event.resource.payout_item_id;
            const transactionId = event.resource.transaction_id;
            const amountCents = event.resource.payout_item?.amount?.value
              ? Math.round(parseFloat(event.resource.payout_item.amount.value) * 100)
              : undefined;

            await releaseService.completeMilestonePayout({
              milestoneId,
              payoutBatchId,
              payoutItemId,
              transactionId,
              amountCents,
            });
          }
        }

        // C. Payout Failed / Denied / Returned / Blocked
        if (
          [
            'PAYMENT.PAYOUTS-ITEM.FAILED',
            'PAYMENT.PAYOUTS-ITEM.DENIED',
            'PAYMENT.PAYOUTS-ITEM.RETURNED',
            'PAYMENT.PAYOUTS-ITEM.BLOCKED',
            'PAYMENT.PAYOUTSBATCH.DENIED',
          ].includes(event.event_type) &&
          event.resource
        ) {
          const senderBatchId =
            event.resource.sender_batch_id ||
            event.resource.batch_header?.sender_batch_header?.sender_batch_id ||
            '';
          const senderItemId = event.resource.payout_item?.sender_item_id || '';

          let milestoneId = '';
          if (senderBatchId.startsWith('ms_')) {
            milestoneId = senderBatchId.replace(/^ms_/, '').replace(/_att\d+$/, '');
          } else if (senderItemId.startsWith('ms_')) {
            milestoneId = senderItemId.replace(/^ms_/, '').replace(/_att\d+$/, '').replace(/_item$/, '');
          }

          if (milestoneId) {
            await releaseService.failMilestonePayout({
              milestoneId,
              reason: event.event_type,
              payoutBatchId: event.resource.payout_batch_id,
            });
          }
        }

        // Mark processed
        await db
          .update(paypalEvents)
          .set({ processedAt: new Date() })
          .where(eq(paypalEvents.id, dbEventId));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Processing error';
        await db
          .update(paypalEvents)
          .set({ error: msg })
          .where(eq(paypalEvents.id, dbEventId));
        request.log.error(err, 'Failed to process PayPal webhook event');
      }

      return reply.status(200).send({ status: 'received', eventId: event.id });
    }
  );
};
