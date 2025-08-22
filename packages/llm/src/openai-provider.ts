import OpenAI from 'openai';
import type { LLMChatParams } from '@extension/contracts';
import { BaseLLMProvider } from './provider.js';

export class OpenAILLMProvider extends BaseLLMProvider {
  private client: OpenAI;

  constructor(apiKey: string | undefined) {
    super();
    this.client = new OpenAI({ apiKey });
  }

  async chat(params: LLMChatParams): Promise<{ content: string }> {
    const response = await this.client.chat.completions.create({
      model: params.model,
      messages: params.messages,
      temperature: params.temperature,
      max_tokens: params.maxTokens,
    });
    const content = (response.choices[0]?.message?.content as string | undefined) ?? '';
    return { content };
  }
}
