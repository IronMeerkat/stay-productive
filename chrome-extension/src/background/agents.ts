import type { Agent, AgentContext, AgentRequest, AgentResponse } from '@extension/agent-kit';
import { OpenAILLMProvider } from '@extension/llm';

const llm = new OpenAILLMProvider(process.env.CEB_OPENAI_API_KEY);

export class EchoAgent implements Agent {
  name = 'echo';
  supports = ['invoke', 'echo'];
  async handle(_ctx: AgentContext, req: AgentRequest): Promise<AgentResponse> {
    if (req.type === 'echo') {
      return { ok: true, data: req.payload };
    }
    return { ok: true, data: { message: 'invoked', input: req.payload } };
  }
}

export class SummarizeTitleAgent implements Agent {
  name = 'summarizeTitle';
  supports = ['summarize', 'invoke'];
  async handle(_ctx: AgentContext, req: AgentRequest): Promise<AgentResponse> {
    // Allow generic invoke to map to summarize for convenience
    const requestType = req.type === 'invoke' ? 'summarize' : req.type;
    if (requestType !== 'summarize') return { ok: false, error: { code: 'UNSUPPORTED', message: 'Unsupported' } };
    try {
      const result = await llm.chat({
        model: 'gpt-5-mini',
        messages: [
          { role: 'system', content: 'Summarize the following page title in 1 short sentence.' },
          { role: 'user', content: String(req.payload ?? '') },
        ],
      });
      return { ok: true, data: { summary: result?.content ?? '' } };
    } catch (e) {
      return { ok: false, error: { code: 'LLM_ERROR', message: (e as Error).message } };
    }
  }
}
