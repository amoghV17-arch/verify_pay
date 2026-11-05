import type {
  LlmPort,
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmToolCall,
} from '@milestone/shared';

export interface AnthropicAdapterConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export class AnthropicAdapter implements LlmPort {
  readonly provider = 'anthropic';
  readonly model: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(config: AnthropicAdapterConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'claude-3-5-sonnet-20241022';
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const startTime = Date.now();

    // Separate system message from conversation messages
    const systemMessage = request.messages.find((m) => m.role === 'system')?.content || '';
    const conversationMessages = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));

    // Format tools
    const tools = request.tools?.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: request.maxTokens || 4096,
      temperature: request.temperature ?? 0.2,
      messages: conversationMessages,
    };

    if (systemMessage) {
      body.system = systemMessage;
    }
    if (tools && tools.length > 0) {
      body.tools = tools;
      if (typeof request.toolChoice === 'object' && request.toolChoice.type === 'function') {
        body.tool_choice = { type: 'tool', name: request.toolChoice.function.name };
      }
    }

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>;
      usage?: { input_tokens: number; output_tokens: number };
    };

    const textBlock = data.content.find((c) => c.type === 'text');
    const toolCallBlocks = data.content.filter((c) => c.type === 'tool_use');

    const toolCalls: LlmToolCall[] = toolCallBlocks.map((t) => ({
      id: t.id || `call_${Math.random().toString(36).substring(2, 9)}`,
      name: t.name || '',
      arguments: JSON.stringify(t.input || {}),
    }));

    return {
      content: textBlock?.text ?? null,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      provider: this.provider,
      model: this.model,
      latencyMs: Date.now() - startTime,
      inputTokens: data.usage?.input_tokens,
      outputTokens: data.usage?.output_tokens,
      promptVersion: 'planner.v1',
    };
  }
}

