import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SandboxPayPalAdapter } from '../paypal/sandboxAdapter.js';

describe('SandboxPayPalAdapter Test Suite', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('caches OAuth access token and reuses it across multiple calls', async () => {
    let tokenFetchCount = 0;

    global.fetch = vi.fn(async (url: RequestInfo | URL) => {
      const urlStr = url.toString();

      if (urlStr.includes('/v1/oauth2/token')) {
        tokenFetchCount++;
        return new Response(
          JSON.stringify({
            access_token: 'mock_access_token_123',
            token_type: 'Bearer',
            expires_in: 3600,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (urlStr.includes('/v2/checkout/orders')) {
        return new Response(
          JSON.stringify({
            id: 'ord_sandbox_123',
            status: 'CREATED',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response('Not found', { status: 404 });
    });

    const adapter = new SandboxPayPalAdapter({
      clientId: 'sandbox_client_id',
      clientSecret: 'sandbox_client_secret',
      baseUrl: 'https://api-m.sandbox.paypal.com',
    });

    // Call 1
    const order1 = await adapter.createFundingOrder({
      projectId: 'proj_01',
      title: 'Project 1',
      amountCents: 50000,
      currency: 'USD',
    });

    // Call 2
    const order2 = await adapter.createFundingOrder({
      projectId: 'proj_01',
      title: 'Project 1',
      amountCents: 50000,
      currency: 'USD',
    });

    expect(order1.orderId).toBe('ord_sandbox_123');
    expect(order2.orderId).toBe('ord_sandbox_123');
    // Token was only fetched once
    expect(tokenFetchCount).toBe(1);
  });

  it('automatically refreshes OAuth token and retries once on 401 Unauthorized', async () => {
    let tokenFetchCount = 0;
    let orderCallCount = 0;

    global.fetch = vi.fn(async (url: RequestInfo | URL) => {
      const urlStr = url.toString();

      if (urlStr.includes('/v1/oauth2/token')) {
        tokenFetchCount++;
        return new Response(
          JSON.stringify({
            access_token: `token_${tokenFetchCount}`,
            token_type: 'Bearer',
            expires_in: 3600,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (urlStr.includes('/v2/checkout/orders')) {
        orderCallCount++;
        if (orderCallCount === 1) {
          // Simulate expired token on first try
          return new Response('Unauthorized', { status: 401 });
        }
        return new Response(
          JSON.stringify({
            id: 'ord_sandbox_retried',
            status: 'CREATED',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response('Not found', { status: 404 });
    });

    const adapter = new SandboxPayPalAdapter({
      clientId: 'sandbox_client_id',
      clientSecret: 'sandbox_client_secret',
    });

    const order = await adapter.createFundingOrder({
      projectId: 'proj_01',
      title: 'Project 1',
      amountCents: 50000,
      currency: 'USD',
    });

    expect(order.orderId).toBe('ord_sandbox_retried');
    // First token fetch, then 401, then second token fetch, then success
    expect(tokenFetchCount).toBe(2);
    expect(orderCallCount).toBe(2);
  });

  it('correctly constructs webhook verification payload and returns verification status', async () => {
    global.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = url.toString();

      if (urlStr.includes('/v1/oauth2/token')) {
        return new Response(
          JSON.stringify({ access_token: 'tok_1', expires_in: 3600 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (urlStr.includes('/v1/notifications/verify-webhook-signature')) {
        const body = JSON.parse(init?.body as string);
        expect(body.webhook_id).toBe('WH_ID_999');
        expect(body.transmission_id).toBe('trans_123');
        expect(body.transmission_sig).toBe('sig_xyz');
        return new Response(
          JSON.stringify({ verification_status: 'SUCCESS' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response('Not found', { status: 404 });
    });

    const adapter = new SandboxPayPalAdapter({
      clientId: 'sandbox_client_id',
      clientSecret: 'sandbox_client_secret',
      webhookId: 'WH_ID_999',
    });

    const verify = await adapter.verifyWebhook({
      headers: {
        'paypal-transmission-id': 'trans_123',
        'paypal-transmission-sig': 'sig_xyz',
        'paypal-auth-algo': 'SHA256withRSA',
        'paypal-cert-url': 'https://api.sandbox.paypal.com/cert',
        'paypal-transmission-time': '2026-11-05T00:00:00Z',
      },
      rawBody: JSON.stringify({ id: 'WH-1', event_type: 'PAYMENT.CAPTURE.COMPLETED' }),
    });

    expect(verify.verified).toBe(true);
    expect(verify.status).toBe('SUCCESS');
  });

  it('sends application_context with returnUrl/cancelUrl and extracts approveUrl from PayPal HATEOAS links', async () => {
    const capturedOrderPayloads: Array<Record<string, unknown>> = [];

    global.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = url.toString();

      if (urlStr.includes('/v1/oauth2/token')) {
        return new Response(
          JSON.stringify({ access_token: 'tok_approve_1', expires_in: 3600 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (urlStr.includes('/v2/checkout/orders')) {
        capturedOrderPayloads.push(JSON.parse(init?.body as string) as Record<string, unknown>);
        return new Response(
          JSON.stringify({
            id: 'ORD-SANDBOX-APPROVE-1',
            status: 'CREATED',
            links: [
              { href: 'https://api-m.sandbox.paypal.com/v2/checkout/orders/ORD-SANDBOX-APPROVE-1', rel: 'self', method: 'GET' },
              { href: 'https://www.sandbox.paypal.com/checkoutnow?token=ORD-SANDBOX-APPROVE-1', rel: 'approve', method: 'GET' },
              { href: 'https://api-m.sandbox.paypal.com/v2/checkout/orders/ORD-SANDBOX-APPROVE-1/capture', rel: 'capture', method: 'POST' },
            ],
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response('Not found', { status: 404 });
    });

    const adapter = new SandboxPayPalAdapter({
      clientId: 'sandbox_client_id',
      clientSecret: 'sandbox_client_secret',
      baseUrl: 'https://api-m.sandbox.paypal.com',
    });

    const order = await adapter.createFundingOrder({
      projectId: 'proj_live_01',
      title: 'Dashboard MVP',
      amountCents: 35000,
      currency: 'USD',
      returnUrl: 'http://localhost:5173/client/new?step=4&projectId=proj_live_01',
      cancelUrl: 'http://localhost:5173/client/new?step=4&projectId=proj_live_01&paypalCancel=1',
    });

    expect(order.orderId).toBe('ORD-SANDBOX-APPROVE-1');
    expect(order.status).toBe('CREATED');
    expect(order.approveUrl).toBe('https://www.sandbox.paypal.com/checkoutnow?token=ORD-SANDBOX-APPROVE-1');
    expect(order.mode).toBe('sandbox');
    expect(capturedOrderPayloads[0]?.application_context).toEqual({
      brand_name: 'Milestone',
      user_action: 'PAY_NOW',
      return_url: 'http://localhost:5173/client/new?step=4&projectId=proj_live_01',
      cancel_url: 'http://localhost:5173/client/new?step=4&projectId=proj_live_01&paypalCancel=1',
    });
  });
});

