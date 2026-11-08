import type {
  PayPalPort,
  PayPalOrderInput,
  PayPalOrderResult,
  PayPalCaptureResult,
  PayPalPayoutInput,
  PayPalPayoutResult,
  PayPalPayoutBatchResult,
  PayPalWebhookVerifyInput,
  PayPalWebhookVerifyResult,
} from '@milestone/shared';
import { recordExternalCall } from '../services/externalCalls.js';

export class InstrumentedPayPalAdapter implements PayPalPort {
  constructor(private readonly inner: PayPalPort) {}

  get mode(): 'mock' | 'sandbox' {
    return this.inner.mode;
  }

  getLastDebugId(): string | null {
    if ('getLastDebugId' in this.inner && typeof (this.inner as any).getLastDebugId === 'function') {
      return (this.inner as any).getLastDebugId();
    }
    return null;
  }

  async createFundingOrder(input: PayPalOrderInput, requestId?: string): Promise<PayPalOrderResult> {
    const start = Date.now();
    try {
      const res = await this.inner.createFundingOrder(input, requestId);
      const durationMs = Date.now() - start;
      const debugId = this.getLastDebugId();

      void recordExternalCall({
        service: 'paypal',
        method: 'POST',
        endpointTemplate: '/v2/checkout/orders',
        status: 201,
        durationMs,
        requestId: requestId || input.projectId,
        providerDebugId: debugId || undefined,
        projectId: input.projectId,
        ok: true,
        meta: { orderId: res.orderId, status: res.status, amountCents: input.amountCents },
      });

      return res;
    } catch (err: any) {
      const durationMs = Date.now() - start;
      const debugId = this.getLastDebugId();

      void recordExternalCall({
        service: 'paypal',
        method: 'POST',
        endpointTemplate: '/v2/checkout/orders',
        status: 500,
        durationMs,
        requestId: requestId || input.projectId,
        providerDebugId: debugId || undefined,
        projectId: input.projectId,
        ok: false,
        errorCode: err?.message || 'UNKNOWN_ERROR',
      });

      throw err;
    }
  }

  async captureFundingOrder(orderId: string, requestId?: string): Promise<PayPalCaptureResult> {
    const start = Date.now();
    try {
      const res = await this.inner.captureFundingOrder(orderId, requestId);
      const durationMs = Date.now() - start;
      const debugId = this.getLastDebugId();

      void recordExternalCall({
        service: 'paypal',
        method: 'POST',
        endpointTemplate: '/v2/checkout/orders/{id}/capture',
        status: 201,
        durationMs,
        requestId: requestId || orderId,
        providerDebugId: debugId || undefined,
        projectId: res.customId,
        ok: true,
        meta: { captureId: res.captureId, status: res.status, amountCents: res.amountCents },
      });

      return res;
    } catch (err: any) {
      const durationMs = Date.now() - start;
      const debugId = this.getLastDebugId();

      void recordExternalCall({
        service: 'paypal',
        method: 'POST',
        endpointTemplate: '/v2/checkout/orders/{id}/capture',
        status: 500,
        durationMs,
        requestId: requestId || orderId,
        providerDebugId: debugId || undefined,
        ok: false,
        errorCode: err?.message || 'UNKNOWN_ERROR',
      });

      throw err;
    }
  }

  async getOrder(orderId: string): Promise<PayPalOrderResult> {
    const start = Date.now();
    try {
      const res = await this.inner.getOrder(orderId);
      const durationMs = Date.now() - start;
      const debugId = this.getLastDebugId();

      void recordExternalCall({
        service: 'paypal',
        method: 'GET',
        endpointTemplate: '/v2/checkout/orders/{id}',
        status: 200,
        durationMs,
        requestId: orderId,
        providerDebugId: debugId || undefined,
        projectId: res.customId,
        ok: true,
        meta: { orderId: res.orderId, status: res.status },
      });

      return res;
    } catch (err: any) {
      const durationMs = Date.now() - start;
      const debugId = this.getLastDebugId();

      void recordExternalCall({
        service: 'paypal',
        method: 'GET',
        endpointTemplate: '/v2/checkout/orders/{id}',
        status: 500,
        durationMs,
        requestId: orderId,
        providerDebugId: debugId || undefined,
        ok: false,
        errorCode: err?.message || 'UNKNOWN_ERROR',
      });

      throw err;
    }
  }

  async createPayout(input: PayPalPayoutInput, requestId?: string): Promise<PayPalPayoutResult> {
    const start = Date.now();
    try {
      const res = await this.inner.createPayout(input, requestId);
      const durationMs = Date.now() - start;
      const debugId = this.getLastDebugId();

      void recordExternalCall({
        service: 'paypal',
        method: 'POST',
        endpointTemplate: '/v1/payments/payouts',
        status: 201,
        durationMs,
        requestId: requestId || input.senderBatchId,
        providerDebugId: debugId || undefined,
        projectId: input.projectId,
        milestoneId: input.milestoneId,
        ok: true,
        meta: {
          payoutBatchId: res.payoutBatchId,
          batchStatus: res.batchStatus,
          senderBatchId: res.senderBatchId,
          payoutItemId: res.payoutItemId,
        },
      });

      return res;
    } catch (err: any) {
      const durationMs = Date.now() - start;
      const debugId = this.getLastDebugId();

      void recordExternalCall({
        service: 'paypal',
        method: 'POST',
        endpointTemplate: '/v1/payments/payouts',
        status: 500,
        durationMs,
        requestId: requestId || input.senderBatchId,
        providerDebugId: debugId || undefined,
        projectId: input.projectId,
        milestoneId: input.milestoneId,
        ok: false,
        errorCode: err?.message || 'UNKNOWN_ERROR',
      });

      throw err;
    }
  }

  async getPayoutBatch(payoutBatchId: string): Promise<PayPalPayoutBatchResult> {
    const start = Date.now();
    try {
      const res = await this.inner.getPayoutBatch(payoutBatchId);
      const durationMs = Date.now() - start;
      const debugId = this.getLastDebugId();

      void recordExternalCall({
        service: 'paypal',
        method: 'GET',
        endpointTemplate: '/v1/payments/payouts/{id}',
        status: 200,
        durationMs,
        requestId: payoutBatchId,
        providerDebugId: debugId || undefined,
        ok: true,
        meta: { payoutBatchId: res.payoutBatchId, batchStatus: res.batchStatus, itemCount: res.items?.length },
      });

      return res;
    } catch (err: any) {
      const durationMs = Date.now() - start;
      const debugId = this.getLastDebugId();

      void recordExternalCall({
        service: 'paypal',
        method: 'GET',
        endpointTemplate: '/v1/payments/payouts/{id}',
        status: 500,
        durationMs,
        requestId: payoutBatchId,
        providerDebugId: debugId || undefined,
        ok: false,
        errorCode: err?.message || 'UNKNOWN_ERROR',
      });

      throw err;
    }
  }

  async verifyWebhook(input: PayPalWebhookVerifyInput): Promise<PayPalWebhookVerifyResult> {
    const start = Date.now();
    try {
      const res = await this.inner.verifyWebhook(input);
      const durationMs = Date.now() - start;
      const debugId = this.getLastDebugId();

      void recordExternalCall({
        service: 'paypal',
        method: 'POST',
        endpointTemplate: '/v1/notifications/verify-webhook-signature',
        status: 200,
        durationMs,
        providerDebugId: debugId || undefined,
        ok: res.verified,
        meta: { verified: res.verified, status: res.status },
      });

      return res;
    } catch (err: any) {
      const durationMs = Date.now() - start;
      const debugId = this.getLastDebugId();

      void recordExternalCall({
        service: 'paypal',
        method: 'POST',
        endpointTemplate: '/v1/notifications/verify-webhook-signature',
        status: 500,
        durationMs,
        providerDebugId: debugId || undefined,
        ok: false,
        errorCode: err?.message || 'UNKNOWN_ERROR',
      });

      throw err;
    }
  }
}

