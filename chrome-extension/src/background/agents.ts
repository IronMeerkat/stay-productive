import type { Agent, AgentContext, AgentRequest, AgentResponse } from '@extension/agent-kit';
import { OpenAILLMProvider } from '@extension/llm';
import type { AppealDecision, AppealTurn, ClassifierResult, PageFeatures, PolicyDecision } from '@extension/contracts';
import { policyDecisionSchema } from '@extension/contracts';
import { CLASSIFIER_TIMEOUT_MS, FORCE_DETERMINISTIC_ONLY, ENABLE_APPEALS } from '@extension/env';
import { createAppealSession, getHostnameFromUrl } from './state';

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

export class SenseAgent implements Agent {
  name = 'sense';
  supports = ['sense'];
  async handle(_ctx: AgentContext, req: AgentRequest): Promise<AgentResponse> {
    const input = (req.payload ?? {}) as { url?: string; title?: string; content?: string };
    try {
      const url = new URL(String(input.url ?? ''));
      const features: PageFeatures = {
        host: url.hostname,
        path: url.pathname || '/',
        title: String(input.title ?? ''),
      };
      return { ok: true, data: features };
    } catch {
      return { ok: false, error: { code: 'BAD_INPUT', message: 'Invalid URL' } };
    }
  }
}

export class DistractionClassifierAgent implements Agent {
  name = 'classifier';
  supports = ['classify'];
  async handle(_ctx: AgentContext, req: AgentRequest): Promise<AgentResponse> {
    if (FORCE_DETERMINISTIC_ONLY)
      return { ok: true, data: { label: 'neutral', confidence: 0.0, schemaVersion: 1 } satisfies ClassifierResult };
    const { title, host } = (req.payload ?? {}) as { title?: string; host?: string };
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), CLASSIFIER_TIMEOUT_MS);
      const result = await llm.chat({
        model: 'gpt-5-nano',
        messages: [
          {
            role: 'system',
            content:
              'You classify a web page strictly for distraction risk. Labels: distract|neutral|work. Return ONLY JSON {"schemaVersion":1,"label":"distract|neutral|work","confidence":0..1}',
          },
          { role: 'user', content: `host=${host ?? ''} title=${title ?? ''}` },
        ],
      });
      clearTimeout(timeout);
      let parsed: ClassifierResult = { label: 'neutral', confidence: 0.0, schemaVersion: 1 } as ClassifierResult;
      try {
        parsed = JSON.parse(result?.content ?? '{}') as ClassifierResult;
      } catch {
        console.error('Failed to parse classifier result', result?.content);
      }
      return { ok: true, data: parsed };
    } catch (e) {
      return { ok: false, error: { code: 'LLM_ERROR', message: (e as Error).message } };
    }
  }
}

export class PolicyAgent implements Agent {
  name = 'policy';
  supports = ['decide'];
  async handle(_ctx: AgentContext, req: AgentRequest): Promise<AgentResponse> {
    const input = (req.payload ?? {}) as {
      features: PageFeatures;
      settings: {
        whitelistPatterns: string[];
        blacklistPatterns: string[];
        strictMode: { enabled: boolean };
      };
      classifier?: ClassifierResult;
      temporarilyAllowed?: boolean;
      activeSchedule?: boolean;
    };

    const { features, settings } = input;
    if (!features || !settings) return { ok: false, error: { code: 'BAD_INPUT', message: 'Missing inputs' } };

    // Schedule gate
    if (input.activeSchedule === false) {
      return { ok: true, data: policyDecisionSchema.parse({ action: 'allow', reason: 'Outside schedule' }) };
    }

    // Whitelist
    for (const p of settings.whitelistPatterns) {
      try {
        const re = new RegExp(p);
        if (re.test(features.host) || re.test(features.path)) {
          return { ok: true, data: policyDecisionSchema.parse({ action: 'allow', reason: 'Whitelist' }) };
        }
      } catch {
        // ignore invalid pattern
      }
    }

    // Temporary allow
    if (input.temporarilyAllowed) {
      return { ok: true, data: policyDecisionSchema.parse({ action: 'allow', reason: 'Temporary allow' }) };
    }

    // Blacklist
    for (const p of settings.blacklistPatterns) {
      try {
        const re = new RegExp(p);
        if (re.test(features.host) || re.test(features.path)) {
          return { ok: true, data: policyDecisionSchema.parse({ action: 'block', reason: 'Blacklist' }) };
        }
      } catch {
        // ignore invalid pattern
      }
    }

    // Strict mode: default to block unless explicit allow by classifier
    if (settings.strictMode?.enabled) {
      if (input.classifier && input.classifier.label === 'work' && input.classifier.confidence > 0.65) {
        return { ok: true, data: policyDecisionSchema.parse({ action: 'allow', reason: 'Work (strict)' }) };
      }
      return { ok: true, data: policyDecisionSchema.parse({ action: 'promptAppeal', reason: 'Strict mode' }) };
    }

    // Classifier suggests
    if (input.classifier) {
      if (input.classifier.label === 'distract' && input.classifier.confidence >= 0.5) {
        return { ok: true, data: policyDecisionSchema.parse({ action: 'promptAppeal', reason: 'Likely distraction' }) };
      }
      if (input.classifier.label === 'work' && input.classifier.confidence >= 0.5) {
        return { ok: true, data: policyDecisionSchema.parse({ action: 'allow', reason: 'Likely work' }) };
      }
    }

    // Default safe
    return { ok: true, data: policyDecisionSchema.parse({ action: 'allow', reason: 'Default allow' }) };
  }
}

export class AppealAgent implements Agent {
  name = 'appeal';
  supports = ['evaluate'];
  async handle(_ctx: AgentContext, req: AgentRequest): Promise<AgentResponse> {
    if (!ENABLE_APPEALS) return { ok: true, data: { assistant: 'Appeals disabled.', allow: false, minutes: 0 } };
    const { conversation, context } = (req.payload ?? {}) as {
      conversation: AppealTurn[];
      context: { url: string; title: string };
    };
    try {
      const result = await llm.chat({
        model: 'gpt-5-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a strict productivity coach. Decide allow and minutes (5..30). Respond ONLY JSON {"assistant":string,"allow":boolean,"minutes":number}',
          },
          { role: 'system', content: `Context URL: ${context?.url ?? ''} | Title: ${context?.title ?? ''}` },
          ...(conversation ?? []),
        ],
      });
      let decision: AppealDecision = { assistant: '', allow: false, minutes: 0 };
      try {
        decision = JSON.parse(result?.content ?? '{}') as AppealDecision;
      } catch {
        // keep default
      }
      return { ok: true, data: decision };
    } catch (e) {
      return { ok: false, error: { code: 'LLM_ERROR', message: (e as Error).message } };
    }
  }
}

export class EnforcementAgent implements Agent {
  name = 'enforce';
  supports = ['apply'];
  async handle(ctx: AgentContext, req: AgentRequest): Promise<AgentResponse> {
    const { tabId } = ctx;
    const { decision, page } = (req.payload ?? {}) as {
      decision: PolicyDecision;
      page: { url: string; title: string };
    };
    if (!tabId) return { ok: false, error: { code: 'NO_TAB', message: 'Missing tabId' } };
    try {
      if (decision.action === 'allow') {
        // nothing to do
        return { ok: true, data: { ok: true } };
      }
      if (decision.action === 'promptAppeal' || decision.action === 'block') {
        const host = getHostnameFromUrl(page.url);
        if (host) createAppealSession(tabId, host);
        chrome.tabs.sendMessage(tabId, { type: 'SHOW_BLOCK_MODAL', payload: page });
        return { ok: true, data: { ok: true } };
      }
      return { ok: true, data: { ok: true } };
    } catch (e) {
      return { ok: false, error: { code: 'ENFORCE_ERROR', message: (e as Error).message } };
    }
  }
}
