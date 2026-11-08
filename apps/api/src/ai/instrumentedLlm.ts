import type {
  LlmPort,
  LlmCompletionRequest,
  LlmCompletionResponse,
} from '@milestone/shared';
import { recordExternalCall } from '../services/externalCalls.js';

export class InstrumentedLlmPort implements LlmPort {
  constructor(private readonly inner: LlmPort) {}

  get provider(): string {
    return this.inner.provider;
  }

  get model(): string {
    return this.inner.model;
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const start = Date.now();
    try {
      const res = await this.inner.complete(request);
      const durationMs = Date.now() - start;

      void recordExternalCall({
        service: 'llm',
        method: 'POST',
        endpointTemplate: `/${this.provider}/chat/completions`,
        status: 200,
        durationMs,
        ok: true,
        meta: {
          model: res.model || this.model,
          inputTokens: res.inputTokens,
          outputTokens: res.outputTokens,
          toolCallsCount: res.toolCalls?.length || 0,
        },
      });

      return res;
    } catch (err: any) {
      const durationMs = Date.now() - start;

      void recordExternalCall({
        service: 'llm',
        method: 'POST',
        endpointTemplate: `/${this.provider}/chat/completions`,
        status: 500,
        durationMs,
        ok: false,
        errorCode: err?.message || 'LLM_COMPLETION_FAILED',
        meta: {
          model: this.model,
        },
      });

      throw err;
    }
  }
}

