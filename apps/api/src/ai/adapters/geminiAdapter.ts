import type {
  LlmPort,
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmToolCall,
} from '@milestone/shared';

export interface GeminiAdapterConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export class GeminiAdapter implements LlmPort {
  readonly provider = 'gemini';
  readonly model: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(config: GeminiAdapterConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'gemini-3.5-flash-lite';
    this.baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const startTime = Date.now();

    const systemMessage = request.messages.find((m) => m.role === 'system')?.content;
    const contents = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content && m.content.trim().length > 0 ? m.content : '(calling tool)' }],
      }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: request.temperature ?? 0.2,
        maxOutputTokens: request.maxTokens || 4096,
      },
    };

    if (systemMessage) {
      body.systemInstruction = {
        parts: [{ text: systemMessage }],
      };
    }

    if (request.tools && request.tools.length > 0) {
      body.tools = [
        {
          functionDeclarations: request.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
        },
      ];

      if (request.toolChoice === 'auto') {
        body.toolConfig = { functionCallingConfig: { mode: 'AUTO' } };
      } else if (request.toolChoice === 'none') {
        body.toolConfig = { functionCallingConfig: { mode: 'NONE' } };
      } else if (
        request.toolChoice &&
        typeof request.toolChoice === 'object' &&
        request.toolChoice.type === 'function'
      ) {
        body.toolConfig = {
          functionCallingConfig: {
            mode: 'ANY',
            allowedFunctionNames: [request.toolChoice.function.name],
          },
        };
      }
    }

    const candidateModels = Array.from(
      new Set([
        this.model,
        'gemini-3.8-flash',
        'gemini-3-flash-preview',
        'gemini-3.1-flash-lite',
        'gemini-flash-lite-latest',
      ])
    );

    let response: Response | null = null;
    let usedModel = this.model;
    let lastErrorStatus = 500;
    let lastErrorText = '';

    for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
      const targetModel = candidateModels[mIdx];
      // Allow 2 attempts on primary model for transient 503/429 spikes, 1 attempt on fallbacks
      const maxAttempts = mIdx === 0 ? 2 : 1;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const url = `${this.baseUrl}/models/${targetModel}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
        let res: Response;
        try {
          res = await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(30_000),
          });
        } catch (err) {
          lastErrorStatus = 504;
          lastErrorText = err instanceof Error ? err.message : String(err);
          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 450 * attempt));
          }
          continue;
        }

        if (res.ok) {
          response = res;
          usedModel = targetModel;
          break;
        }

        lastErrorStatus = res.status;
        lastErrorText = await res.text();

        // Only retry / fallback on transient capacity or model-not-found errors
        const isTransientOrMissing = [404, 429, 500, 502, 503, 504].includes(res.status);
        if (!isTransientOrMissing) {
          throw new Error(`Gemini API error (${res.status}): ${lastErrorText}`);
        }

        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 450 * attempt));
        }
      }

      if (response) break;
    }

    if (!response) {
      throw new Error(`Gemini API error (${lastErrorStatus}): ${lastErrorText}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
            functionCall?: { name: string; args: unknown };
          }>;
        };
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
      };
    };

    const firstCandidate = data.candidates?.[0];
    const parts = firstCandidate?.content?.parts || [];

    const textPart = parts.find((p) => typeof p.text === 'string');
    const functionCallParts = parts.filter((p) => p.functionCall);

    const toolCalls: LlmToolCall[] = functionCallParts.map((p, idx) => ({
      id: `gemini_call_${idx}_${Date.now()}`,
      name: p.functionCall!.name,
      arguments: JSON.stringify(p.functionCall!.args || {}),
    }));

    return {
      content: textPart?.text ?? null,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      provider: this.provider,
      model: usedModel,
      latencyMs: Date.now() - startTime,
      inputTokens: data.usageMetadata?.promptTokenCount,
      outputTokens: data.usageMetadata?.candidatesTokenCount,
      promptVersion: 'planner.v1',
    };
  }
}

