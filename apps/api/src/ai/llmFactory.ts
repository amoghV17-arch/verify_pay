import type { LlmPort, AppConfig } from '@milestone/shared';
import { FixtureAdapter } from './adapters/fixtureAdapter.js';
import { AnthropicAdapter } from './adapters/anthropicAdapter.js';
import { GeminiAdapter } from './adapters/geminiAdapter.js';
import { OpenAiAdapter } from './adapters/openAiAdapter.js';

let customAdapter: LlmPort | null = null;

export function setCustomLlmAdapter(adapter: LlmPort | null): void {
  customAdapter = adapter;
}

export function createLlmPort(config: Partial<AppConfig> = {}): LlmPort {
  if (customAdapter) {
    return customAdapter;
  }

  const provider = config.LLM_PROVIDER || process.env.LLM_PROVIDER;
  const apiKey = config.LLM_API_KEY || process.env.LLM_API_KEY || '';
  const model = config.LLM_MODEL || process.env.LLM_MODEL || '';
  const baseUrl = config.LLM_BASE_URL || process.env.LLM_BASE_URL || '';

  // Use fixtures only when LLM_PROVIDER=fixture is set explicitly
  if (provider === 'fixture') {
    return new FixtureAdapter();
  }

  if (!provider) {
    throw new Error(
      '[LLM Configuration Error] No LLM_PROVIDER configured. Set LLM_PROVIDER=fixture explicitly to use test fixtures, or configure a real provider (anthropic, gemini, openai-compatible) with LLM_API_KEY.',
    );
  }

  if (!apiKey) {
    throw new Error(
      `[LLM Configuration Error] LLM_API_KEY is required for provider "${provider}". Fixtures are only used when LLM_PROVIDER=fixture is set explicitly.`,
    );
  }

  switch (provider) {
    case 'anthropic':
      return new AnthropicAdapter({ apiKey, model: model || undefined, baseUrl: baseUrl || undefined });
    case 'gemini':
      return new GeminiAdapter({ apiKey, model: model || undefined, baseUrl: baseUrl || undefined });
    case 'openai-compatible':
      return new OpenAiAdapter({ apiKey, model: model || undefined, baseUrl: baseUrl || undefined });
    default:
      throw new Error(`[LLM Configuration Error] Unsupported LLM_PROVIDER "${provider}".`);
  }
}

