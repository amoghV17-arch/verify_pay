import { useState, useEffect } from 'react';

export interface SystemModeLlm {
  provider: string;
  model: string;
  live: boolean;
}

const PROVIDER_DISPLAY: Record<string, string> = {
  gemini: 'Google Gemini',
  anthropic: 'Anthropic Claude',
  'openai-compatible': 'OpenAI-Compatible',
};

let cachedLabelPromise: Promise<string> | null = null;
let cachedLabelValue = 'AI Reviewer';

/**
 * Formats an LLM provider and model identifier into a readable label for UI surfaces.
 */
export function formatModelLabel(
  model?: string | null,
  provider?: string | null,
  live?: boolean
): string {
  if (live === false) {
    return 'Simulated AI Reviewer';
  }

  const cleanModel = (model || '').trim();
  const cleanProvider = (provider || '').trim().toLowerCase();

  if (!cleanModel && !cleanProvider) {
    return 'AI Reviewer';
  }

  if (cleanModel.startsWith('fixt') || cleanProvider.startsWith('fixt')) {
    return 'Simulated AI Reviewer';
  }

  const inferredProvider =
    cleanProvider ||
    (cleanModel.startsWith('gemini')
      ? 'gemini'
      : cleanModel.startsWith('claude')
      ? 'anthropic'
      : cleanModel
      ? 'openai-compatible'
      : '');

  const providerLabel = PROVIDER_DISPLAY[inferredProvider] || inferredProvider || 'AI';

  if (cleanModel && cleanModel !== 'unspecified' && cleanModel !== 'default') {
    return `${providerLabel} (${cleanModel})`;
  }

  return providerLabel;
}

async function fetchSystemLlmLabel(): Promise<string> {
  if (typeof window === 'undefined' || typeof fetch !== 'function') {
    return cachedLabelValue;
  }

  try {
    const res = await fetch('/api/system/mode');
    if (!res.ok) return cachedLabelValue;
    const data = (await res.json()) as { llm?: SystemModeLlm };
    if (data?.llm) {
      cachedLabelValue = formatModelLabel(data.llm.model, data.llm.provider, data.llm.live);
    }
  } catch {
    // Keep default fallback label when status endpoint is unavailable
  }
  return cachedLabelValue;
}

/**
 * React hook that resolves the active backend LLM reviewer label from /api/system/mode.
 */
export function useSystemLlmLabel(): string {
  const [label, setLabel] = useState<string>(cachedLabelValue);

  useEffect(() => {
    let active = true;
    if (!cachedLabelPromise) {
      cachedLabelPromise = fetchSystemLlmLabel();
    }
    cachedLabelPromise.then((resolved) => {
      if (active) setLabel(resolved);
    });
    return () => {
      active = false;
    };
  }, []);

  return label;
}

/**
 * Computes a finite percentage [0..100] from either review.confidence or review.minConfidence.
 */
export function getReviewConfidencePct(review?: {
  confidence?: unknown;
  minConfidence?: unknown;
} | null): number {
  if (!review) return 0;
  const raw =
    typeof review.confidence === 'number' && Number.isFinite(review.confidence)
      ? review.confidence
      : typeof review.minConfidence === 'number' && Number.isFinite(review.minConfidence)
      ? review.minConfidence
      : 0;
  const clamped = Math.max(0, Math.min(1, raw));
  return Math.round(clamped * 100);
}

/**
 * Returns true if the AI review verdict recommends payout approval/release.
 */
export function isApprovalVerdict(verdict?: string | null): boolean {
  return verdict === 'pass' || verdict === 'release';
}
