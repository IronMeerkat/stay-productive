import type { AgentInvokeRequest, AgentInvokeResponse, ProtocolMessage } from '@extension/contracts';
import { AgentRegistry } from '@extension/agent-kit';

const registry = new AgentRegistry();

export const getRegistry = () => registry;

export const handleMessage = async (
  message: ProtocolMessage,
  ctx: { tabId?: number; env: 'development' | 'production' },
): Promise<unknown> => {
  if (message && typeof message === 'object' && 'type' in message) {
    if ((message as AgentInvokeRequest).type === 'agent:invoke') {
      const req = message as AgentInvokeRequest;
      const res = (await registry.invoke(
        req.payload.agent,
        { tabId: ctx.tabId, env: ctx.env },
        {
          type: 'invoke',
          payload: req.payload.input,
        },
      )) as AgentInvokeResponse;
      return res;
    }
  }
  return undefined;
};
