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
- Structured outputs & validation: all LLM responses use JSON schema (Zod/Ajv) with strict runtime validation and versioned schemas.
- Observability: privacy-preserving telemetry for decisions, agent timings, model+prompt versions, errors; local ring buffer for debug.
- Resilience & budgets: timeouts, retries with backoff, circuit breaker, token and QPS budgets per model; deterministic degrade paths.
- Human-in-the-loop: short, bounded appeal loop; user feedback informs future policy explanations without auto-whitelisting.
- Accessibility & i18n: content UI is keyboard-first, screen-reader friendly, localized strings with safe defaults.

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

// Optional/phaseable agents

- NotificationAgent (local)
  - Input: PolicyDecision
  - Effects: schedule gentle nudges or break timers (no PII, opt-in)

- ScheduleAdvisorAgent (LLM optional)
  - Input: anonymized usage summaries
  - Output: suggested schedule tweaks (never auto-apply; propose via Options)

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

Validation:

- Add Zod schemas for all protocol types and export both TS types and runtime parsers.
- Include `schemaVersion` in LLM-facing contracts; reject mismatches.
- Validate LLM JSON strictly; clamp numerics; default-safe on validation failure.

## Implementation steps

1. **Agents (background)**
   - Add to `chrome-extension/src/background/agents.ts`:
     - SenseAgent (local summarization; redact IDs/tokens; 1–2 sentence summary)
     - DistractionClassifierAgent (LLM via `@extension/llm`)
     - PolicyAgent (rule engine + optional classifier consult)
     - AppealAgent (wrap current prompt via `OpenAILLMProvider`)
     - EnforcementAgent (temp allow; modal show/hide; alarms)

2. **Orchestrator wiring**
   - Extend `chrome-extension/src/background/orchestrator.ts` to sequence sense → policy → enforce on DOM capture and handle appeal flow.
   - Keep `agent:invoke` as the transport; use typed payloads and guard inputs.
   - Persist a tiny in-memory cache and mirror to `chrome.storage.session` on `onSuspend` to survive SW restarts.

3. **Content/UI**
   - Keep `pages/content/src/...` capture thin (already debounced and robust).
   - Keep `pages/content-ui` a pure UI; it only reacts to `SHOW_BLOCK_MODAL`/`CLOSE_BLOCK_MODAL` and sends `EVALUATE_APPEAL`.
   - Use React functional components + hooks; extract `useAppealSession`, `useBlockModal` custom hooks.
   - Memoize heavy props; prefer controlled components; avoid unnecessary re-renders.

4. **Feature flags**
   - Add `ENABLE_AGENTS`, `USE_REMOTE_AGENT` in `@extension/env`. Skip agents in prod if disabled.
   - Add `ENABLE_APPEALS`, `FORCE_DETERMINISTIC_ONLY`, and token/QPS budgets per provider.

5. **Caching and cooldowns**
   - Cache classifier results by (host, path, hour) in background memory; add short per‑host cooldown.
   - Key cache by model+promptVersion+roundedHour; cap size with LRU; respect per-host cooldown.
   - Batch-identical concurrent classifications to a single in-flight promise.

## LLM guardrails

- Redact and shorten: only title+host+short summary; cap tokens.
- Stable prompts: version them; log model+prompt version in local telemetry.
- JSON‑only responses: validate strictly; clamp minutes [5..30].
- Circuit breaker: backoff on repeated failures; degrade to deterministic policy.
- Prefer function/tool calling with explicit JSON Schema when provider supports it.
- Enforce per-tab and global token budgets; short timeouts (e.g., 3–5s) for classification.

## Performance

- Debounce DOM sensing (existing) and re‑capture; avoid repeated classification.
- Stream appeal assistant responses later for improved UX (provider supports it down the line).
- MV3 specifics: avoid long-lived state; persist hot caches to `chrome.storage.session`; handle `runtime.onSuspend`.
- Coalesce events across same host within short windows; dedupe multi-tab requests.
- Guard CPU usage; avoid heavy parsing in content scripts; offload to background.

## Privacy & security

- Do not send raw DOM to LLM; never include secrets; sanitize any injected HTML in content‑ui.
- Persist settings encrypted (already implemented). Keep tokens in background only.
- Narrow permissions in production; prefer optional host permissions when expanding scope.
- Enforce strict CSP with Trusted Types; sanitize with DOMPurify in UI; avoid `dangerouslySetInnerHTML`.
- Rotate model prompts and redact consistently; include privacy note in Options; telemetry is opt-in.
- Data retention: keep minimal local ring buffer with rolling window; no remote exfiltration.

## Testing

- Unit: PolicyAgent (rules & edge cases), classifier result mapping, expiry timers.
- E2E: block/allow/prompt flows across example sites; temp allow expiry; schedule boundaries.
- Contract tests: validate LLM outputs against schemas; property-based tests for policy edge conditions.
- Mock LLM provider for deterministic tests; fuzz inputs (titles, hosts) incl. unicode/RTL.
- Playwright-based E2E with fixtures for Reddit/YouTube and schedule cross-midnight cases.

## Observability & telemetry

- Structured logs with requestId/tabId, timings (sense/classify/policy/enforce), model+prompt version.
- Privacy-preserving counters: blocks, prompts, allows, appeal outcomes; stored locally.
- Simple debug panel (dev only) to inspect last N decisions and cache state.

## Personalization (opt-in, local-first)

- Capture lightweight feedback: user taps "This was wrong" or "Good call"; adjust explanations.
- Learn per-host strictness within caps; never auto-whitelist without user action.
- Suggest schedule tweaks based on patterns; require explicit confirmation in Options.

## Roadmap

- Phase 1: implement Sense/Policy/Appeal/Enforcement agents; local‑first; add simple cache and cooldowns.
- Phase 2: streaming appeal UI; richer policy explanations; batch LLM calls if multiple tabs fire.
- Phase 3: remote agents (server) via same `agent:invoke` protocol; use `USE_REMOTE_AGENT` flag.
- Phase 4: opt-in personalization, advanced telemetry dashboard in Options, configurable budgets.
- Phase 5: shared remote cache for classifications (privacy-preserving hashing) behind feature flag.

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

## Feature additions (aligned)

### Search‑only mode

- Goal: allow search/results pages while blocking home/recommendations and infinite feeds.
- Contracts:
  - Extend `PolicyDecision` with `mode?: 'full'|'searchOnly'|'minimal'`.
  - Add `EnforcementDirective` with `domRules?: string[]` (CSS selectors to hide) and `networkRules?: string[]` (paths for MV3 DNR).
- Agents:
  - SenseAgent emits `hints` (e.g., `isSearchPage`, `isFeedLike`).
  - PolicyAgent sets `action: allow` with `mode: 'searchOnly'` and `domRules` when host is distractor but search intent is detected.
  - EnforcementAgent applies DOM/CSS rules via content script and optional DNR rules.
- Flow changes:
  - On DOM_CAPTURED → if `isSearchPage` and host is distractor → enforce `searchOnly`.
  - On SPA navigation changes → re-apply rules if context flips between search and feed.
- UI:
  - Small banner “Search‑only mode” with a link to turn off for N minutes (respects budgets/flags).

### Intent gate

- Goal: require a short typed intent before granting access; show it while browsing.
- Contracts:
  - New `IntentRecord { text: string; createdAt: number; ttlMs: number; host: string }`.
  - Extend `PolicyDecision` with `requireIntent?: boolean` and `intentTtlMs?: number`.
  - New runtime messages: `INTENT_REQUEST`, `INTENT_SUBMIT`.
- Agents:
  - PolicyAgent decides `promptIntent` (represented as `action: 'promptAppeal'` with `requireIntent: true`) when confidence is low or host over budget.
  - EnforcementAgent opens minimal intent modal; stores accepted `IntentRecord` in memory + `chrome.storage.session` keyed by host.
- Flow changes:
  - On `INTENT_SUBMIT` → validate length (3–10 words), persist with TTL, then re‑evaluate policy and allow with `ttlMs`.
  - On expiry, violation, or navigation away → remove and require new intent next time.
- UI:
  - Non-distracting single input with word counter; shows sticky reminder of declared intent.

### Adaptive strictness

- Goal: adjust friction based on recent behavior while never auto‑whitelisting.
- Contracts:
  - New `StrictnessProfile { host: string; score: number; updatedAt: number }` (score 0..100).
  - Extend `PolicyDecision` with `friction?: 'low'|'medium'|'high'` and `budgetState?: { remainingMinutes: number }`.
- Agents:
  - PolicyAgent increases `score` on repeated quick bounces, overruns, or late‑night use; decreases on adherence.
  - EnforcementAgent escalates friction (e.g., longer cooldowns, search‑only instead of allow) when `score` is high.
- Flow changes:
  - Update `StrictnessProfile` after each decision; cap rate of change; store locally only.
  - Use `score` to choose between `allow`, `searchOnly`, or `promptIntent`.

### Appeal memory

- Goal: learn from justified appeals to improve future explanations without auto‑whitelisting.
- Contracts:
  - New `AppealMemoryEntry { host: string; topic?: string; justification: string; minutesGranted: number; timestamp: number }`.
  - `AppealAgent` can read prior entries to provide context‑aware assistant messages.
- Agents:
  - After an allow decision via appeal, EnforcementAgent stores an entry (clamped length, redacted) locally.
  - PolicyAgent references memory to pre‑fill rationale in future blocks and to shorten appeal dialogs.
- Flow changes:
  - On EVALUATE_APPEAL → pass last N memory entries for the host to the `AppealAgent` prompt as summarized bullets.
  - Memory never auto‑permits; user still needs intent or timebox according to policy.
