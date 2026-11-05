import type {
  LlmPort,
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmToolCall,
} from '@milestone/shared';

export interface OpenAiAdapterConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export class OpenAiAdapter implements LlmPort {
  readonly provider = 'openai-compatible';
  readonly model: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(config: OpenAiAdapterConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'gpt-4o';
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const startTime = Date.now();

    const messages = request.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const body: Record<string, unknown> = {
      model: this.model,
      temperature: request.temperature ?? 0.2,
      max_tokens: request.maxTokens || 4096,
      messages,
    };

    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
      if (request.toolChoice) {
        body.tool_choice = request.toolChoice;
      }
    }

    if (request.responseFormat === 'json_object') {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
          tool_calls?: Array<{
            id?: string;
            function?: { name?: string; arguments?: string };
          }>;
        };
      }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
      };
    };

    const choice = data.choices?.[0];
    const message = choice?.message;

    const toolCalls: LlmToolCall[] = (message?.tool_calls || []).map((tc) => ({
      id: tc.id || `openai_call_${Math.random().toString(36).substring(2, 9)}`,
      name: tc.function?.name || '',
      arguments: tc.function?.arguments || '{}',
    }));

    return {
      content: message?.content ?? null,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      provider: this.provider,
      model: this.model,
      latencyMs: Date.now() - startTime,
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
      promptVersion: 'planner.v1',
    };
  }
}

