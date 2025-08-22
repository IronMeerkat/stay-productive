# Athena — Agentic Anti‑Distraction Architecture

## Objective

Evolve Athena’s blocker into a small, cooperating set of agents behind the background orchestrator. Keep content scripts thin (sensing/events), centralize policy and LLM calls in the background, and communicate via typed contracts. Favor deterministic, local‑first decisions with LLM augmentation, guarded by feature flags and strict privacy.

## Principles

- Least data: never ship raw DOM to LLM; send short features (title, host, topic, redacted summary).
- Determinism before LLM: schedule/whitelist/blacklist and strict mode run first.
- Background as brain: MV3 service worker orchestrates; content scripts only sense and display.
- Typed boundaries: define protocol/domain types in `@extension/contracts`.
- Performance: debounce sensing, cache results, use temp allow TTLs, avoid repeated classification.
- Privacy and security: encrypt settings (done), minimize permissions, sanitize UI, strict CSP.

## Agents

- SenseAgent (local)
  - Input: { tabId, url, title, optional short DOM summary }
  - Output: PageFeatures { host, path, title, summary?, hints }

- DistractionClassifierAgent (LLM)
  - Input: PageFeatures
  - Output: ClassifierResult { label: distract | neutral | work, confidence, rationale? }

- PolicyAgent (local)
  - Input: ClassifierResult + Settings + temp allow state
  - Output: PolicyDecision { action: allow | block | promptAppeal, reason, ttlMs? }

- AppealAgent (LLM, chat)
  - Input: conversation + page context
  - Output: AppealDecision { allow, minutes, assistant }

- EnforcementAgent (local)
  - Effects: set temp allow TTL, show/hide modal, alarms, ask tabs to re‑capture
  - Output: { ok }

## Orchestrated flow (background)

1) On DOM_CAPTURED (from content script):
   - SenseAgent → PageFeatures
   - PolicyAgent (runs deterministic schedule/whitelist/blacklist/strict; consults classifier only if needed)
   - If allow → done. If block/promptAppeal → show modal via content‑ui and store appeal session.

2) On EVALUATE_APPEAL (from content‑ui modal):
   - Validate session; AppealAgent decides { allow, minutes }
   - If allow → EnforcementAgent sets temp allow + closes modal; request re‑capture

3) On ALARM or expiry: revoke temp allow; ask tabs to re‑capture so policy re‑applies.

## Contracts to add/extend (`@extension/contracts`)

- protocol/messages.ts (exists): `RuntimeMessage`, `AgentInvokeRequest/Response`
- protocol/policy.ts (new)
  - PageFeatures { host, path, title, summary? }
  - ClassifierResult { label: 'distract'|'neutral'|'work'; confidence: number; rationale?: string }
  - PolicyDecision { action: 'allow'|'block'|'promptAppeal'; reason: string; ttlMs?: number }
- protocol/appeal.ts (new)
  - AppealTurn, AppealDecision (centralize current types)

Settings and schedule types are already centralized in `lib/domain` and used by Options.

## Implementation steps

1) Agents (background)

- Add to `chrome-extension/src/background/agents.ts`:
  - SenseAgent (local summarization; redact IDs/tokens; 1–2 sentence summary)
  - DistractionClassifierAgent (LLM via `@extension/llm`)
  - PolicyAgent (rule engine + optional classifier consult)
  - AppealAgent (wrap current prompt via `OpenAILLMProvider`)
  - EnforcementAgent (temp allow; modal show/hide; alarms)

1) Orchestrator wiring

- Extend `chrome-extension/src/background/orchestrator.ts` to sequence sense → policy → enforce on DOM capture and handle appeal flow.
- Keep `agent:invoke` as the transport; use typed payloads and guard inputs.

1) Content/UI

- Keep `pages/content/src/...` capture thin (already debounced and robust).
- Keep `pages/content-ui` a pure UI; it only reacts to `SHOW_BLOCK_MODAL`/`CLOSE_BLOCK_MODAL` and sends `EVALUATE_APPEAL`.

1) Feature flags

- Add `ENABLE_AGENTS`, `USE_REMOTE_AGENT` in `@extension/env`. Skip agents in prod if disabled.

1) Caching and cooldowns

- Cache classifier results by (host, path, hour) in background memory; add short per‑host cooldown.

## LLM guardrails

- Redact and shorten: only title+host+short summary; cap tokens.
- Stable prompts: version them; log model+prompt version in local telemetry.
- JSON‑only responses: validate strictly; clamp minutes [5..30].
- Circuit breaker: backoff on repeated failures; degrade to deterministic policy.

## Performance

- Debounce DOM sensing (existing) and re‑capture; avoid repeated classification.
- Stream appeal assistant responses later for improved UX (provider supports it down the line).

## Privacy & security

- Do not send raw DOM to LLM; never include secrets; sanitize any injected HTML in content‑ui.
- Persist settings encrypted (already implemented). Keep tokens in background only.
- Narrow permissions in production; prefer optional host permissions when expanding scope.

## Testing

- Unit: PolicyAgent (rules & edge cases), classifier result mapping, expiry timers.
- E2E: block/allow/prompt flows across example sites; temp allow expiry; schedule boundaries.

## Roadmap

- Phase 1: implement Sense/Policy/Appeal/Enforcement agents; local‑first; add simple cache and cooldowns.
- Phase 2: streaming appeal UI; richer policy explanations; batch LLM calls if multiple tabs fire.
- Phase 3: remote agents (server) via same `agent:invoke` protocol; use `USE_REMOTE_AGENT` flag.

## Example usage (runtime messages)

```ts
// Echo
chrome.runtime.sendMessage({
  type: 'agent:invoke',
  payload: { agent: 'echo', input: { hello: 'world' } },
}, console.log);

// Summarize a title
chrome.runtime.sendMessage({
  type: 'agent:invoke',
  payload: { agent: 'summarizeTitle', input: 'A very long page title' },
}, console.log);
```
