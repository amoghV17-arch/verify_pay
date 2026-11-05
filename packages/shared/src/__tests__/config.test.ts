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

  it('strictly rejects LLM_PROVIDER=fixture in production environment', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        LLM_PROVIDER: 'fixture',
      }),
    ).toThrowError(/LLM_PROVIDER cannot be "fixture" in production/);
  });

  it('rejects real LLM provider with missing LLM_API_KEY', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'development',
        LLM_PROVIDER: 'anthropic',
        LLM_API_KEY: '',
      }),
    ).toThrowError(/LLM_API_KEY must be provided when LLM_PROVIDER is "anthropic"/);
  });

  it('accepts real LLM provider when LLM_API_KEY is configured', () => {
    const config = loadConfig({
      NODE_ENV: 'development',
      LLM_PROVIDER: 'anthropic',
      LLM_API_KEY: 'sk-ant-test-key-12345',
    });
    expect(config.LLM_PROVIDER).toBe('anthropic');
    expect(config.LLM_API_KEY).toBe('sk-ant-test-key-12345');
  });

  it('accepts explicit LLM_PROVIDER=fixture in development', () => {
    const config = loadConfig({
      NODE_ENV: 'development',
      LLM_PROVIDER: 'fixture',
    });
    expect(config.LLM_PROVIDER).toBe('fixture');
  });
});

