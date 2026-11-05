import { z } from 'zod';

export const PayPalOrderInputSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1),
  amountCents: z.number().int().positive(),
  currency: z.string().default('USD'),
  customId: z.string().optional(),
});
export type PayPalOrderInput = z.infer<typeof PayPalOrderInputSchema>;

export const PayPalOrderResultSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(['CREATED', 'SAVED', 'APPROVED', 'VOIDED', 'COMPLETED', 'PAYER_ACTION_REQUIRED']),
  customId: z.string().optional(),
  amountCents: z.number().int().nonnegative().optional(),
});
export type PayPalOrderResult = z.infer<typeof PayPalOrderResultSchema>;

export const PayPalCaptureResultSchema = z.object({
  captureId: z.string().min(1),
  orderId: z.string().min(1),
  status: z.enum(['COMPLETED', 'DECLINED', 'FAILED', 'PENDING']),
  amountCents: z.number().int().nonnegative(),
  currency: z.string().default('USD'),
  customId: z.string().optional(),
});
export type PayPalCaptureResult = z.infer<typeof PayPalCaptureResultSchema>;

export const PayPalWebhookVerifyInputSchema = z.object({
  headers: z.record(z.union([z.string(), z.array(z.string()), z.undefined()])),
  rawBody: z.string(),
  webhookId: z.string().optional(),
});
export type PayPalWebhookVerifyInput = z.infer<typeof PayPalWebhookVerifyInputSchema>;

export const PayPalWebhookVerifyResultSchema = z.object({
  verified: booleanValidator(),
  status: z.enum(['SUCCESS', 'FAILURE']),
});
export type PayPalWebhookVerifyResult = z.infer<typeof PayPalWebhookVerifyResultSchema>;

function booleanValidator() {
  return z.boolean();
}

/**
 * Port interface defining all interactions with PayPal.
 * Implemented by MockPayPalAdapter (for hermetic testing and offline dev)
 * and SandboxPayPalAdapter (for live sandbox transactions).
 */
export interface PayPalPort {
  readonly mode: 'mock' | 'sandbox';

  /**
   * Creates an Order for funding the entire project budget with intent CAPTURE.
   */
  createFundingOrder(input: PayPalOrderInput, requestId?: string): Promise<PayPalOrderResult>;

  /**
   * Captures an approved funding order.
   */
  captureFundingOrder(orderId: string, requestId?: string): Promise<PayPalCaptureResult>;

  /**
   * Retrieves order details from PayPal for reconciliation.
   */
  getOrder(orderId: string): Promise<PayPalOrderResult>;

  /**
   * Verifies incoming webhook signature authenticity.
   */
  verifyWebhook(input: PayPalWebhookVerifyInput): Promise<PayPalWebhookVerifyResult>;
}

