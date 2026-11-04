import { describe, it, expect } from 'vitest';
import { loadConfig } from '../config/env.js';

describe('loadConfig and environment guards', () => {
  it('loads default mock configuration in development', () => {
    const config = loadConfig({
      NODE_ENV: 'development',
      PORT: '8080',
    });
    expect(config.NODE_ENV).toBe('development');
    expect(config.PAYPAL_ENV).toBe('mock');
    expect(config.PORT).toBe(8080);
    expect(config.REVIEW_MIN_CONFIDENCE).toBe(0.75);
  });

  it('allows PAYPAL_ENV=sandbox', () => {
    const config = loadConfig({
      NODE_ENV: 'development',
      PAYPAL_ENV: 'sandbox',
    });
    expect(config.PAYPAL_ENV).toBe('sandbox');
  });

  it('strictly rejects PAYPAL_ENV=live with a critical security error', () => {
    expect(() =>
      loadConfig({
        PAYPAL_ENV: 'live' as unknown as 'mock',
      }),
    ).toThrowError(/CRITICAL SECURITY GUARD/);
  });

  it('rejects arbitrary invalid PAYPAL_ENV values', () => {
    expect(() =>
      loadConfig({
        PAYPAL_ENV: 'production' as unknown as 'mock',
      }),
    ).toThrowError(/PAYPAL_ENV must be either "mock" or "sandbox"/);
  });
});

