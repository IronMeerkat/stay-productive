import type {
  AgentInvokeRequest,
  AgentInvokeResponse,
  ProtocolMessage,
  PolicyDecision,
  PageFeatures,
  ClassifierResult,
} from '@extension/contracts';
import { AgentRegistry } from '@extension/agent-kit';
import { getSettings, isWithinActiveSchedule } from './settings';
import { isTemporarilyAllowed } from './state';

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
    // Orchestrated path: DOM captured → sense → policy → (optional classify) → enforce
    if ((message as { type: string }).type === 'DOM_CAPTURED') {
      console.log('in orchestrator');
      const payload = (message as unknown as { payload: { url: string; title: string; content: string } }).payload;
      // Sense
      const sensed = (await registry.invoke(
        'sense',
        { tabId: ctx.tabId, env: ctx.env },
        { type: 'sense', payload },
      )) as AgentInvokeResponse;
      console.log('sensed', sensed);
      if (!sensed.ok) return { ok: false };
      const features = sensed.data as PageFeatures;
      // Inputs for policy
      const { settings } = await getSettings();
      const activeSchedule = isWithinActiveSchedule(settings, new Date());
      let classifier: ClassifierResult | undefined;
      // Optional classifier consult; naive caching by host+path+hour
      const cacheKey = `${features.host}|${features.path}|${new Date().getHours()}`;
      const cached = classifierCache.get(cacheKey);
      if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        classifier = cached.result;
      } else {
        const pending = inflightClassify.get(cacheKey);
        let classifyRes: AgentInvokeResponse | undefined;
        if (pending) {
          classifyRes = await pending;
        } else {
          const p = registry.invoke(
            'classifier',
            { tabId: ctx.tabId, env: ctx.env },
            { type: 'classify', payload: { title: features.title, host: features.host } },
          );
          inflightClassify.set(cacheKey, p);
          try {
            classifyRes = (await p) as AgentInvokeResponse;
          } finally {
            inflightClassify.delete(cacheKey);
          }
        }
        console.log('classifyRes', classifyRes);
        if (classifyRes?.ok) {
          classifier = classifyRes.data as ClassifierResult;
          classifierCache.set(cacheKey, { result: classifier, ts: Date.now() });
          if (classifierCache.size > CLASSIFIER_CACHE_MAX) {
            // Drop oldest entry
            const firstKey = classifierCache.keys().next().value as string | undefined;
            if (firstKey) classifierCache.delete(firstKey);
          }
        }
      }

      const policyRes = (await registry.invoke(
        'policy',
        { tabId: ctx.tabId, env: ctx.env },
        {
          type: 'decide',
          payload: {
            features,
            settings,
            classifier,
            temporarilyAllowed: isTemporarilyAllowed(features.host),
            activeSchedule,
          },
        },
      )) as AgentInvokeResponse;
      console.log('policyRes', policyRes);
      const decision = (policyRes.ok ? policyRes.data : { action: 'allow', reason: 'fallback' }) as PolicyDecision;
      await registry.invoke(
        'enforce',
        { tabId: ctx.tabId, env: ctx.env },
        { type: 'apply', payload: { decision, page: { url: payload.url, title: payload.title } } },
      );
      return { ok: true };
    }
  }
  return undefined;
};

// Simple in-memory classifier cache and in-flight registry
const classifierCache = new Map<string, { result: ClassifierResult; ts: number }>();
const inflightClassify = new Map<string, Promise<AgentInvokeResponse>>();
const CACHE_TTL_MS = 10 * 60 * 1000;
const CLASSIFIER_CACHE_MAX = 500;
