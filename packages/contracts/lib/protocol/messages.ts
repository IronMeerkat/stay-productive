export type ShowBlockModalMessage = {
  type: 'SHOW_BLOCK_MODAL';
  payload: { url: string; title: string };
};

export type CloseBlockModalMessage = {
  type: 'CLOSE_BLOCK_MODAL';
};

export type RuntimeMessage = ShowBlockModalMessage | CloseBlockModalMessage;

export type AgentInvokeRequest = {
  type: 'agent:invoke';
  payload: { agent: string; input: unknown };
};

export type AgentInvokeResponse = {
  ok: boolean;
  data?: unknown;
  error?: { code: string; message: string };
};

export type ProtocolMessage = RuntimeMessage | AgentInvokeRequest;
