export type AgentContext = {
  userId?: string;
  tabId?: number;
  env: 'development' | 'production';
};

export type AgentRequest = { type: string; payload: unknown };
export type AgentResponse = { ok: boolean; data?: unknown; error?: { code: string; message: string } };

export interface Agent {
  name: string;
  supports: string[];
  handle(ctx: AgentContext, req: AgentRequest): Promise<AgentResponse>;
}
