import type { Agent, AgentContext, AgentRequest, AgentResponse } from './base-agent.js';

export class AgentRegistry {
  private agents: Map<string, Agent> = new Map();

  register(agent: Agent): void {
    this.agents.set(agent.name, agent);
  }

  async invoke(agentName: string, ctx: AgentContext, req: AgentRequest): Promise<AgentResponse> {
    const agent = this.agents.get(agentName);
    if (!agent) return { ok: false, error: { code: 'NOT_FOUND', message: `Agent ${agentName} not found` } };
    if (!agent.supports.includes(req.type))
      return { ok: false, error: { code: 'UNSUPPORTED', message: `Type ${req.type} not supported` } };
    return agent.handle(ctx, req);
  }
}
