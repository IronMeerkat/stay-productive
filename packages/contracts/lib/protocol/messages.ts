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

// Additional runtime messages for orchestrator events
export type DomCapturedMessage = {
  type: 'DOM_CAPTURED';
  payload: { url: string; title: string; content: string; timestamp: number };
};

export type GetDomDataMessage = { type: 'GET_DOM_DATA' };

export type EvaluateAppealMessage = {
  type: 'EVALUATE_APPEAL';
  payload: { conversation: Array<{ role: 'user' | 'assistant'; content: string }>; url: string; title: string };
};

export type AppealAllowMessage = {
  type: 'APPEAL_ALLOW';
  payload: { url: string; minutes: number };
};

export type GetSettingsMessage = { type: 'GET_SETTINGS' };
export type UpdateSettingsMessage = { type: 'UPDATE_SETTINGS'; payload: Record<string, unknown> };
export type EnableStrictMessage = { type: 'ENABLE_STRICT'; payload: { days: number; hours: number } };
export type IsLockedMessage = { type: 'IS_LOCKED' };

export type ExtendedRuntimeMessage =
  | RuntimeMessage
  | DomCapturedMessage
  | GetDomDataMessage
  | EvaluateAppealMessage
  | AppealAllowMessage
  | GetSettingsMessage
  | UpdateSettingsMessage
  | EnableStrictMessage
  | IsLockedMessage;

export type ProtocolMessageV2 = ExtendedRuntimeMessage | AgentInvokeRequest;
