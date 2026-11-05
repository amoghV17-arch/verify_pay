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
    this.model = config.model || 'gemini-1.5-pro-latest';
    this.baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const startTime = Date.now();

    const systemMessage = request.messages.find((m) => m.role === 'system')?.content;
    const contents = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
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
    }

    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errorText}`);
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
      model: this.model,
      latencyMs: Date.now() - startTime,
      inputTokens: data.usageMetadata?.promptTokenCount,
      outputTokens: data.usageMetadata?.candidatesTokenCount,
      promptVersion: 'planner.v1',
    };
  }
}

