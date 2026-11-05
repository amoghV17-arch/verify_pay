import {
  PayPalPort,
  PayPalOrderInput,
  PayPalOrderResult,
  PayPalCaptureResult,
  PayPalWebhookVerifyInput,
  PayPalWebhookVerifyResult,
} from '@milestone/shared';

export interface SandboxPayPalConfig {
  clientId: string;
  clientSecret: string;
  webhookId?: string;
  baseUrl?: string;
}

export class SandboxPayPalAdapter implements PayPalPort {
  readonly mode = 'sandbox' as const;
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly webhookId?: string;

  // In-memory token cache
  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(config: SandboxPayPalConfig) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.webhookId = config.webhookId;
    this.baseUrl = config.baseUrl || 'https://api-m.sandbox.paypal.com';
  }

  /**
   * Retrieves OAuth2 client_credentials token with in-memory caching and 60-second safety buffer.
   */
  async getAccessToken(forceRefresh = false): Promise<string> {
    const now = Date.now();
    if (!forceRefresh && this.cachedToken && this.tokenExpiresAt > now + 60_000) {
      return this.cachedToken;
    }

    const authHeader = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`PayPal OAuth failed (status ${response.status}): ${errText}`);
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    this.cachedToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;
    return this.cachedToken;
  }

  /**
   * Wrapper executing authorized PayPal calls with a single automatic retry on 401 Unauthorized.
   */
  private async executeWithAuth<T>(
    endpoint: string,
    options: RequestInit,
    retried = false
  ): Promise<T> {
    const token = await this.getAccessToken(retried);
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('Content-Type', 'application/json');

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (res.status === 401 && !retried) {
      // Clear token and retry once
      this.cachedToken = null;
      return this.executeWithAuth<T>(endpoint, options, true);
    }

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`PayPal API error [${options.method || 'GET'} ${endpoint}] ${res.status}: ${errorBody}`);
    }

    return (await res.json()) as T;
  }

  async createFundingOrder(input: PayPalOrderInput, requestId?: string): Promise<PayPalOrderResult> {
    const customId = input.customId || input.projectId;
    const body = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: `project_${input.projectId}`,
          custom_id: customId,
          description: `Milestone project funding: ${input.title}`,
          amount: {
            currency_code: input.currency,
            value: (input.amountCents / 100).toFixed(2),
          },
        },
      ],
    };

    const headers: Record<string, string> = {};
    if (requestId) {
      headers['PayPal-Request-Id'] = requestId;
    }

    const response = await this.executeWithAuth<{ id: string; status: PayPalOrderResult['status'] }>(
      '/v2/checkout/orders',
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      }
    );

    return {
      orderId: response.id,
      status: response.status,
      customId,
      amountCents: input.amountCents,
    };
  }

  async captureFundingOrder(orderId: string, requestId?: string): Promise<PayPalCaptureResult> {
    const headers: Record<string, string> = {};
    if (requestId) {
      headers['PayPal-Request-Id'] = requestId;
    }

    interface CaptureApiResponse {
      id: string;
      status: string;
      purchase_units?: Array<{
        payments?: {
          captures?: Array<{
            id: string;
            status: 'COMPLETED' | 'DECLINED' | 'FAILED' | 'PENDING';
            amount: { value: string; currency_code: string };
            custom_id?: string;
          }>;
        };
      }>;
    }

    const response = await this.executeWithAuth<CaptureApiResponse>(
      `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      }
    );

    const firstCapture = response.purchase_units?.[0]?.payments?.captures?.[0];
    if (!firstCapture) {
      throw new Error(`PayPal capture response did not contain capture details for order ${orderId}`);
    }

    const amountCents = Math.round(parseFloat(firstCapture.amount.value) * 100);

    return {
      captureId: firstCapture.id,
      orderId,
      status: firstCapture.status,
      amountCents,
      currency: firstCapture.amount.currency_code,
      customId: firstCapture.custom_id,
    };
  }

  async getOrder(orderId: string): Promise<PayPalOrderResult> {
    interface OrderApiResponse {
      id: string;
      status: PayPalOrderResult['status'];
      purchase_units?: Array<{
        custom_id?: string;
        amount?: { value: string };
      }>;
    }

    const res = await this.executeWithAuth<OrderApiResponse>(
      `/v2/checkout/orders/${encodeURIComponent(orderId)}`,
      { method: 'GET' }
    );

    const unit = res.purchase_units?.[0];
    const amountCents = unit?.amount?.value ? Math.round(parseFloat(unit.amount.value) * 100) : undefined;

    return {
      orderId: res.id,
      status: res.status,
      customId: unit?.custom_id,
      amountCents,
    };
  }

  async verifyWebhook(input: PayPalWebhookVerifyInput): Promise<PayPalWebhookVerifyResult> {
    const webhookId = input.webhookId || this.webhookId;
    if (!webhookId) {
      throw new Error('PAYPAL_WEBHOOK_ID is required to verify webhook signature in sandbox mode');
    }

    const getHeader = (name: string): string => {
      const val = input.headers[name] || input.headers[name.toLowerCase()];
      if (Array.isArray(val)) return val[0] || '';
      return val || '';
    };

    let parsedEvent: unknown;
    try {
      parsedEvent = JSON.parse(input.rawBody);
    } catch {
      return { verified: false, status: 'FAILURE' };
    }

    const verifyPayload = {
      auth_algo: getHeader('paypal-auth-algo'),
      cert_url: getHeader('paypal-cert-url'),
      transmission_id: getHeader('paypal-transmission-id'),
      transmission_sig: getHeader('paypal-transmission-sig'),
      transmission_time: getHeader('paypal-transmission-time'),
      webhook_id: webhookId,
      webhook_event: parsedEvent,
    };

    interface VerifyApiResponse {
      verification_status: 'SUCCESS' | 'FAILURE';
    }

    const result = await this.executeWithAuth<VerifyApiResponse>(
      '/v1/notifications/verify-webhook-signature',
      {
        method: 'POST',
        body: JSON.stringify(verifyPayload),
      }
    );

    return {
      verified: result.verification_status === 'SUCCESS',
      status: result.verification_status,
    };
  }
}

