export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type LLMChatParams = {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
};

export type LLMStreamCallbacks = {
  onToken?: (text: string) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
};

export interface LLMProvider {
  chat(params: LLMChatParams, callbacks?: LLMStreamCallbacks): Promise<{ content: string } | void>;
}
