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

  const provider = config.LLM_PROVIDER || process.env.LLM_PROVIDER || 'fixture';
  const apiKey = config.LLM_API_KEY || process.env.LLM_API_KEY || '';
  const model = config.LLM_MODEL || process.env.LLM_MODEL || '';
  const baseUrl = config.LLM_BASE_URL || process.env.LLM_BASE_URL || '';

  // If no API key or provider is 'fixture', use FixtureAdapter
  if (provider === 'fixture' || !apiKey) {
    return new FixtureAdapter();
  }

  switch (provider) {
    case 'anthropic':
      return new AnthropicAdapter({ apiKey, model: model || undefined, baseUrl: baseUrl || undefined });
    case 'gemini':
      return new GeminiAdapter({ apiKey, model: model || undefined, baseUrl: baseUrl || undefined });
    case 'openai-compatible':
      return new OpenAiAdapter({ apiKey, model: model || undefined, baseUrl: baseUrl || undefined });
    default:
      return new FixtureAdapter();
  }
}

