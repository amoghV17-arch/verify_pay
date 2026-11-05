import { AppConfig, PayPalPort } from '@milestone/shared';
import { MockPayPalAdapter, MockPayPalOptions } from './mockAdapter.js';
import { SandboxPayPalAdapter } from './sandboxAdapter.js';

export * from './mockAdapter.js';
export * from './sandboxAdapter.js';

export function createPayPalAdapter(
  config: AppConfig,
  mockOptions?: MockPayPalOptions
): PayPalPort {
  if (config.PAYPAL_ENV === 'sandbox') {
    if (!config.PAYPAL_CLIENT_ID || !config.PAYPAL_CLIENT_SECRET) {
      throw new Error(
        'Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET while PAYPAL_ENV is set to "sandbox". Check .env file.'
      );
    }
    return new SandboxPayPalAdapter({
      clientId: config.PAYPAL_CLIENT_ID,
      clientSecret: config.PAYPAL_CLIENT_SECRET,
      webhookId: config.PAYPAL_WEBHOOK_ID,
    });
  }

  // Default to Mock adapter
  return new MockPayPalAdapter(mockOptions);
}

