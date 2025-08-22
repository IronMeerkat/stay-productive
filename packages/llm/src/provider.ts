import type { LLMChatParams, LLMProvider, LLMStreamCallbacks } from '@extension/contracts';

export abstract class BaseLLMProvider implements LLMProvider {
  abstract chat(params: LLMChatParams, callbacks?: LLMStreamCallbacks): Promise<{ content: string } | void>;
}
