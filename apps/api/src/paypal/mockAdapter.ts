import {
  PayPalPort,
  PayPalOrderInput,
  PayPalOrderResult,
  PayPalCaptureResult,
  PayPalPayoutInput,
  PayPalPayoutResult,
  PayPalPayoutBatchResult,
  PayPalPayoutItemStatus,
  PayPalWebhookVerifyInput,
  PayPalWebhookVerifyResult,
} from '@milestone/shared';

export interface MockPayPalOptions {
  webhookHandler?: (event: Record<string, unknown>, rawBody: string) => Promise<void>;
  defaultWebhookDelayMs?: number;
}

export class MockPayPalAdapter implements PayPalPort {
  readonly mode = 'mock' as const;

  private orders = new Map<
    string,
    { id: string; status: PayPalOrderResult['status']; amountCents: number; customId?: string }
  >();
  private captures = new Map<
    string,
    { id: string; orderId: string; status: PayPalCaptureResult['status']; amountCents: number; customId?: string }
  >();
  private payoutBatches = new Map<
    string,
    {
      payoutBatchId: string;
      senderBatchId: string;
      status: 'DENIED' | 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'CANCELED';
      items: Array<{
        payoutItemId: string;
        transactionStatus: PayPalPayoutItemStatus;
        amountCents: number;
        receiver: string;
        senderItemId: string;
      }>;
    }
  >();

  // Failure injection & simulation controls
  public failNextCapture = false;
  public failNextPayout = false;
  public delayWebhookMs: number;
  public duplicateWebhook = false;

  private webhookHandler?: (event: Record<string, unknown>, rawBody: string) => Promise<void>;

  constructor(options: MockPayPalOptions = {}) {
    this.webhookHandler = options.webhookHandler;
    this.delayWebhookMs = options.defaultWebhookDelayMs ?? 20;
  }

  setWebhookHandler(handler: (event: Record<string, unknown>, rawBody: string) => Promise<void>) {
    this.webhookHandler = handler;
  }

  async createFundingOrder(input: PayPalOrderInput, _requestId?: string): Promise<PayPalOrderResult> {
    const orderId = `mock_order_${Math.random().toString(36).slice(2, 10)}`;
    const result: PayPalOrderResult = {
      orderId,
      status: 'CREATED',
      customId: input.customId || input.projectId,
      amountCents: input.amountCents,
    };
    this.orders.set(orderId, {
      id: orderId,
      status: 'CREATED',
      amountCents: input.amountCents,
      customId: input.customId || input.projectId,
    });
    return result;
  }

  async captureFundingOrder(orderId: string, _requestId?: string): Promise<PayPalCaptureResult> {
    if (this.failNextCapture) {
      this.failNextCapture = false;
      return {
        captureId: `mock_cap_fail_${Math.random().toString(36).slice(2, 6)}`,
        orderId,
        status: 'FAILED',
        amountCents: 0,
        currency: 'USD',
      };
    }

    const order = this.orders.get(orderId) || {
      id: orderId,
      status: 'CREATED' as const,
      amountCents: 60000,
      customId: 'proj_brand_launch',
    };

    const captureId = `mock_cap_${Math.random().toString(36).slice(2, 10)}`;
    const captureResult: PayPalCaptureResult = {
      captureId,
      orderId,
      status: 'COMPLETED',
      amountCents: order.amountCents,
      currency: 'USD',
      customId: order.customId,
    };

    order.status = 'COMPLETED';
    this.orders.set(orderId, order);
    this.captures.set(captureId, {
      id: captureId,
      orderId,
      status: 'COMPLETED',
      amountCents: order.amountCents,
      customId: order.customId,
    });

    // Asynchronously dispatch webhook event if handler is registered
    if (this.webhookHandler) {
      const eventId = `WH-MOCK-${Math.random().toString(36).slice(2, 12).toUpperCase()}`;
      const eventPayload = {
        id: eventId,
        event_version: '1.0',
        create_time: new Date().toISOString(),
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource_type: 'capture',
        resource: {
          id: captureId,
          status: 'COMPLETED',
          amount: {
            value: (order.amountCents / 100).toFixed(2),
            currency_code: 'USD',
          },
          custom_id: order.customId,
          supplementary_data: {
            related_ids: {
              order_id: orderId,
            },
          },
        },
      };

      const dispatch = async () => {
        const rawBody = JSON.stringify(eventPayload);
        try {
          await this.webhookHandler!(eventPayload, rawBody);
          if (this.duplicateWebhook) {
            await this.webhookHandler!(eventPayload, rawBody);
          }
        } catch {
          // Mock background emission error handler
        }
      };

      if (this.delayWebhookMs <= 0) {
        queueMicrotask(dispatch);
      } else {
        setTimeout(dispatch, this.delayWebhookMs);
      }
    }

    return captureResult;
  }

  async getOrder(orderId: string): Promise<PayPalOrderResult> {
    const order = this.orders.get(orderId);
    if (!order) {
      return {
        orderId,
        status: 'VOIDED',
      };
    }
    return {
      orderId: order.id,
      status: order.status,
      customId: order.customId,
      amountCents: order.amountCents,
    };
  }

  async createPayout(input: PayPalPayoutInput, _requestId?: string): Promise<PayPalPayoutResult> {
    const payoutBatchId = `mock_batch_${Math.random().toString(36).slice(2, 10)}`;
    const payoutItemId = `mock_item_${Math.random().toString(36).slice(2, 10)}`;

    if (this.failNextPayout) {
      this.failNextPayout = false;
      const failedResult: PayPalPayoutResult = {
        payoutBatchId,
        batchStatus: 'DENIED',
        senderBatchId: input.senderBatchId,
        payoutItemId,
        itemStatus: 'FAILED',
      };

      this.payoutBatches.set(payoutBatchId, {
        payoutBatchId,
        senderBatchId: input.senderBatchId,
        status: 'DENIED',
        items: [
          {
            payoutItemId,
            transactionStatus: 'FAILED',
            amountCents: input.amountCents,
            receiver: input.receiverEmail,
            senderItemId: `ms_${input.milestoneId}_item`,
          },
        ],
      });

      if (this.webhookHandler) {
        const eventId = `WH-MOCK-FAIL-${Math.random().toString(36).slice(2, 12).toUpperCase()}`;
        const eventPayload = {
          id: eventId,
          event_version: '1.0',
          create_time: new Date().toISOString(),
          event_type: 'PAYMENT.PAYOUTS-ITEM.FAILED',
          resource_type: 'payouts_item',
          resource: {
            payout_item_id: payoutItemId,
            payout_batch_id: payoutBatchId,
            transaction_status: 'FAILED',
            sender_batch_id: input.senderBatchId,
            payout_item: {
              amount: {
                value: (input.amountCents / 100).toFixed(2),
                currency: 'USD',
              },
              receiver: input.receiverEmail,
              sender_item_id: `ms_${input.milestoneId}_item`,
            },
          },
        };

        const dispatch = async () => {
          const rawBody = JSON.stringify(eventPayload);
          try {
            await this.webhookHandler!(eventPayload, rawBody);
          } catch {
            // ignore
          }
        };

        if (this.delayWebhookMs <= 0) {
          queueMicrotask(dispatch);
        } else {
          setTimeout(dispatch, this.delayWebhookMs);
        }
      }

      return failedResult;
    }

    const successResult: PayPalPayoutResult = {
      payoutBatchId,
      batchStatus: 'SUCCESS',
      senderBatchId: input.senderBatchId,
      payoutItemId,
      itemStatus: 'SUCCESS',
    };

    this.payoutBatches.set(payoutBatchId, {
      payoutBatchId,
      senderBatchId: input.senderBatchId,
      status: 'SUCCESS',
      items: [
        {
          payoutItemId,
          transactionStatus: 'SUCCESS',
          amountCents: input.amountCents,
          receiver: input.receiverEmail,
          senderItemId: `ms_${input.milestoneId}_item`,
        },
      ],
    });

    if (this.webhookHandler) {
      const eventId = `WH-MOCK-PAYOUT-${Math.random().toString(36).slice(2, 12).toUpperCase()}`;
      const eventPayload = {
        id: eventId,
        event_version: '1.0',
        create_time: new Date().toISOString(),
        event_type: 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED',
        resource_type: 'payouts_item',
        resource: {
          payout_item_id: payoutItemId,
          payout_batch_id: payoutBatchId,
          transaction_id: `mock_tx_${Math.random().toString(36).slice(2, 8)}`,
          transaction_status: 'SUCCESS',
          sender_batch_id: input.senderBatchId,
          payout_item: {
            amount: {
              value: (input.amountCents / 100).toFixed(2),
              currency: 'USD',
            },
            receiver: input.receiverEmail,
            sender_item_id: `ms_${input.milestoneId}_item`,
          },
        },
      };

      const dispatch = async () => {
        const rawBody = JSON.stringify(eventPayload);
        try {
          await this.webhookHandler!(eventPayload, rawBody);
          if (this.duplicateWebhook) {
            await this.webhookHandler!(eventPayload, rawBody);
          }
        } catch {
          // ignore
        }
      };

      if (this.delayWebhookMs <= 0) {
        queueMicrotask(dispatch);
      } else {
        setTimeout(dispatch, this.delayWebhookMs);
      }
    }

    return successResult;
  }

  async getPayoutBatch(payoutBatchId: string): Promise<PayPalPayoutBatchResult> {
    const batch = this.payoutBatches.get(payoutBatchId);
    if (!batch) {
      return {
        payoutBatchId,
        batchStatus: 'SUCCESS',
        senderBatchId: `ms_unknown`,
        items: [
          {
            payoutItemId: `mock_item_default`,
            transactionStatus: 'SUCCESS',
          },
        ],
      };
    }

    return {
      payoutBatchId: batch.payoutBatchId,
      batchStatus: batch.status,
      senderBatchId: batch.senderBatchId,
      items: batch.items.map((i) => ({
        payoutItemId: i.payoutItemId,
        transactionStatus: i.transactionStatus,
        amountCents: i.amountCents,
        receiver: i.receiver,
        senderItemId: i.senderItemId,
      })),
    };
  }

  async verifyWebhook(input: PayPalWebhookVerifyInput): Promise<PayPalWebhookVerifyResult> {
    const invalidHeader = input.headers['x-mock-signature-invalid'];
    if (invalidHeader === 'true' || invalidHeader === '1') {
      return {
        verified: false,
        status: 'FAILURE',
      };
    }

    return {
      verified: true,
      status: 'SUCCESS',
    };
  }
}
