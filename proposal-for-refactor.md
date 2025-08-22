# Athena Browser Extension — Proposal for Refactor (2025)

## Purpose

Refactor the current Manifest V3 extension to a clean, scalable, AI-first architecture using React + TypeScript, with Zustand for state management, strict separation of types/interfaces, minimal `App.tsx` per page, and shared packages for cross-cutting concerns. The outcome should be intuitive to read, easy to maintain, and ready to grow from “anti‑distraction” into multi-agent local/remote AI functionality.

## Goals

- Establish stable architectural boundaries (UI pages, background orchestration, typed messaging, storage, LLM providers, i18n, observability).
- Adopt Zustand as the single state manager per extension page and background.
- Centralize all shared contracts/types in a dedicated package to avoid types co-located with UI.
- Make each `App.tsx` minimal (provider/wiring only), pushing features into `pages/` and `components/`.
- Keep current number of apps/pages; restructure their internals consistently.
- Prepare for future i18n with an added `he.json` alongside `en.json`.

## Non‑Goals (for this refactor)

- No functional scope increase (anti‑distraction remains primary behavior).
- No change to permission footprint yet (only tighten where safe).
- No heavy auth/remote server integration beyond scaffold/stubs.

---

## Guiding Principles (2025 best practices)

- **MV3 service worker lifecycle aware**: background code must be event-driven, stateless between activations when possible, and persist durable state in storage.
- **Typed boundaries**: define runtime message contracts and domain types in shared packages; avoid implicit `any` at boundaries.
- **State with Zustand**: small, focused stores per domain; persist selectively; avoid global monolith stores.
- **Minimal apps**: `App.tsx` wires providers and shells; pages and components implement behavior.
- **AI-ready**: provider abstraction for local vs remote AI, streaming-friendly interfaces, web workers for heavy local compute.
- **Security first**: strict CSP, least privilege permissions, sanitize any injected HTML, compartmentalize origins and content scripts.
- **Performance**: code-splitting, lazy loading, long-task avoidance in the UI thread, background work offloaded to workers.
- **DX**: shared Vite config, shared Tailwind config, consistent folder conventions, fast tests (Vitest) + WDIO e2e.

---

## Target High-Level Architecture

- **Background (service worker) as orchestrator**: routes typed messages, coordinates agents (local/remote), manages auth tokens and sync.
- **Pages (popup/options/new-tab/side-panel/devtools/content-runtime/content-ui)**: each is a small React app with the same internal shape and patterns.
- **Agent kit**: common interfaces to implement local agents (in-page or worker) and remote agents (server API).
- **LLM provider abstraction**: OpenAI/Anthropic/Local worker behind one interface, supporting streaming.
- **Typed messaging bus**: content <-> background <-> pages using shared protocol types.
- **Storage abstraction**: local-first with optional remote sync, single interfaces.
- **i18n foundation**: locale resources centralized; `en.json` now and `he.json` placeholder added.

---

## Repository Layout (proposed)

```text
athena-browser-extension/
├─ chrome-extension/
│  ├─ manifest.ts
│  └─ src/
│     ├─ background/                 # MV3 service worker entry and orchestration
│     │  ├─ index.ts                 # registers listeners, wires orchestrator
│     │  ├─ orchestrator.ts          # message router + agent registry bridge
│     │  ├─ messaging.ts             # background-side runtime message handlers
│     │  ├─ stores/                  # Zustand stores for background-only state
│     │  │  └─ focusStore.ts
│     │  ├─ services/
│     │  │  ├─ auth.ts               # PKCE scaffold, token storage (stub initially)
│     │  │  ├─ permissions.ts
│     │  │  └─ telemetry.ts
│     │  └─ workers/                 # background web workers (if any)
│     └─ services/
│        └─ openai.ts                # kept, refactored to provider implementation
│
├─ pages/
│  ├─ popup/
│  │  ├─ index.html
│  │  └─ src/
│  │     ├─ app/
│  │     │  ├─ App.tsx               # minimal: providers + router shell
│  │     │  └─ routes.tsx            # optional
│  │     ├─ pages/                   # route-level components
│  │     │  ├─ Home.tsx
│  │  │  └─ Settings.tsx
│  │     ├─ components/              # presentational + small containers
│  │     ├─ stores/                  # Zustand (scoped to this app)
│  │     │  ├─ useSettingsStore.ts
│  │     │  └─ useFocusStore.ts
│  │     ├─ hooks/
│  │     ├─ services/                # thin wrappers over shared packages
│  │     ├─ types/                   # (optional) view-only types; domain in packages/contracts
│  │     ├─ assets/
│  │     │  ├─ styles/
│  │     │  │  ├─ tailwind.css
│  │     │  │  └─ global.css
│  │     │  └─ images/
│  │     ├─ i18n/                    # app-level message keys if needed
│  │     ├─ index.tsx
│  │     └─ index.css
│  ├─ options/ ... (same structure)
│  ├─ new-tab/ ... (same structure)
│  ├─ side-panel/ ... (same structure)
│  ├─ devtools/ ... (same structure)
│  ├─ devtools-panel/ ... (same structure)
│  ├─ content-runtime/               # React app injected into page runtime
│  │  └─ src/ (same internal structure as popup)
│  └─ content-ui/                    # UI-only overlay app for content scripts
│     └─ src/ (same internal structure as popup)
│
├─ packages/
│  ├─ contracts/                     # NEW: central TS-only types/interfaces (no React)
│  │  ├─ src/
│  │  │  ├─ protocol/                # runtime message contracts
│  │  │  │  ├─ messages.ts
│  │  │  │  └─ index.ts
│  │  │  ├─ domain/                  # Settings, User, FocusRule, Agent, etc.
│  │  │  ├─ llm/                     # model/provider enums, request/response shapes
│  │  │  ├─ storage/                 # schemas for persisted data
│  │  │  ├─ env/                     # typed env flags
│  │  │  └─ index.ts
│  │  └─ package.json
│  ├─ agent-kit/                     # interfaces + helpers to build agents
│  │  ├─ src/
│  │  │  ├─ base-agent.ts            # Agent interface + adapter utils
│  │  │  ├─ registry.ts              # in-memory registry for background
│  │  │  └─ index.ts
│  │  └─ package.json
│  ├─ llm/                           # provider abstraction and adapters
│  │  ├─ src/
│  │  │  ├─ provider.ts              # LLMProvider interface (streaming friendly)
│  │  │  ├─ openai-provider.ts       # wraps current openai.ts
│  │  │  ├─ worker-provider.ts       # local worker-backed provider (stub)
│  │  │  └─ index.ts
│  │  └─ package.json
│  ├─ api-client/                    # typed fetch client, auth, retries
│  │  ├─ src/
│  │  │  ├─ client.ts
│  │  │  ├─ auth.ts                  # PKCE helpers (stub now)
│  │  │  └─ index.ts
│  │  └─ package.json
│  ├─ storage/                       # (exists) extend for local-first + optional sync
│  ├─ i18n/                          # (exists) centralize locales here
│  │  ├─ locales/
│  │  │  ├─ en/messages.json
│  │  │  ├─ he/messages.json         # NEW placeholder file to be added later
│  │  │  └─ ...
│  │  ├─ src/
│  │  │  ├─ i18n-dev.ts
│  │  │  ├─ i18n-prod.ts
│  │  │  └─ index.ts
│  ├─ ui/                            # (exists) shared React UI components
│  ├─ env/                           # (exists) env flags + loader
│  ├─ vite-config/                   # (exists) per-page Vite config helpers
│  ├─ tailwindcss-config/            # (exists) single source of Tailwind config
│  ├─ shared/                        # (exists) generic utils/hooks/hocs
│  ├─ dev-utils/, hmr/, zipper/, module-manager/, ... (existing)
│
├─ tests/
│  ├─ e2e/                           # WDIO specs stay; update to new selectors
│  └─ unit/                          # NEW: Vitest for stores, agents, protocol
│     ├─ protocol.test.ts
│     ├─ stores.test.ts
│     └─ llm-provider.test.ts
│
├─ proposal-for-refactor.md          # this document
└─ ...
```

Notes:

- We keep existing `pages/*` apps. Each gains the same internal structure and Zustand stores.
- `packages/contracts` becomes the single source of truth for all types/interfaces.
- `packages/i18n` gains a placeholder `he/messages.json` (to be added later when translating).

---

## State Management with Zustand

- **Pattern**: one small store per domain (e.g., `useSettingsStore`, `useFocusStore`) instead of one large global store.
- **Persistence**: use `zustand/persist` for specific slices. For cross-context persistence, write through to `chrome.storage.local` and subscribe to `chrome.storage.onChanged` to hydrate peers.
- **Cross-context sync**: background store is the source of truth for shared state; UI stores fetch/sync via typed messages.
- **Selectors and actions**: expose selectors to minimize re-renders; actions return promises when they involve async side effects.

Example store shape (conceptual):

```ts
type FocusState = {
  isBlocking: boolean;
  rules: FocusRule[];
};

type FocusActions = {
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  setRules: (rules: FocusRule[]) => void;
};
```

---

## Messaging and Protocol (Typed)

- Define `ProtocolMessage` types in `packages/contracts/src/protocol` (e.g., `AgentInvoke`, `SettingsGet/Put`, `TelemetryEvent`).
- Background registers handlers mapped by `type` and returns structured responses with `ok/data/error`.
- Pages and content runtime call via small wrappers, always using the shared protocol types.

Benefits: compile-time safety at boundaries, discoverable contracts, fewer runtime errors.

---

## Agent Kit and LLM Providers

- **Agent kit**: `Agent` interface, `AgentContext`, and a registry that background uses to route `agent:invoke` commands.
- **LLM provider abstraction**: `LLMProvider` with methods for `complete`, `chat`, `embed`, each supporting streaming callbacks and cancellation.
- **Local vs remote**: add `worker-provider` for local inference later; add `api-client` provider for server-hosted models.
- **Prompt hygiene**: centralize prompt templates and model parameters in `packages/llm` to avoid duplication across pages.

---

## i18n

- Keep locale files in `packages/i18n/locales`. Present: `en/messages.json`. Add a placeholder `he/messages.json` soon (scaffolded in structure above; actual file to be added later).
- Provide a lightweight runtime that loads only the active locale and supports lazy segment loading.
- Pages pull from the same provider; avoid page-level duplicated dictionaries unless strictly presentation-specific.

---

## Styling and Theming

- Single Tailwind config in `packages/tailwindcss-config`; each page extends it.
- Keep a small `global.css` per app for app-specific resets.
- Prefer design tokens and shared UI primitives from `packages/ui` to avoid drift.

---

## Security and Privacy

- **Permissions**: keep minimal, prefer `host_permissions` over `*://*/*`, and consider optional permissions for advanced features.
- **CSP**: disallow `unsafe-eval`; allow connections only to required endpoints; gate dev-time exceptions via env.
- **Sanitization**: sanitize any HTML injected into content UIs (e.g., DOMPurify).
- **Secrets**: never embed API keys; use server-side token exchange when feasible; store tokens in `chrome.storage` with least scope.

---

## Performance

- Lazy-load non-critical UI; code-split vendors by page.
- Offload heavy computation to Web Workers.
- Stream AI outputs when possible to improve perceived latency; design components to render partial results.

---

## Testing

- **Unit (Vitest)**: protocol type guards, store actions, provider adapters.
- **Component (Testing Library)**: critical components in `packages/ui` and high-value page components.
- **E2E (WDIO)**: keep existing flows; update selectors after refactor.

---

## Build and CI/CD

- All pages use a shared Vite base from `packages/vite-config` (with per-page overrides).
- Feature flags via `packages/env` (e.g., `ENABLE_AGENTS`, `USE_REMOTE_AGENT`).
- Version syncing: ensure manifest version derives from root `package.json` in CI.
- Zip bundling remains via existing zipper/module-manager packages.

---

## Migration Plan (staged, low-risk)

1. **Contracts first**
   - Create `packages/contracts` with protocol/domain/storage/env types.
   - Replace scattered local types with imports from `contracts`.

2. **Zustand adoption**
   - Introduce stores per page (`stores/`), lift logic out of `App.tsx`.
   - Background gets its own stores; add hydration/persist where appropriate.

3. **Messaging refactor**
   - Add background `orchestrator.ts` using protocol types.
   - Replace ad-hoc message passing with typed wrappers.

4. **LLM provider abstraction**
   - Wrap existing OpenAI code as `openai-provider` in `packages/llm`.
   - Update consumers to use `LLMProvider` interface.

5. **Styling + i18n consolidation**
   - Ensure all pages extend `packages/tailwindcss-config`.
   - Wire pages to `packages/i18n`; scaffold `he/messages.json` soon.

6. **Clean up `App.tsx` per page**
   - Restrict to providers/router/layout; move logic to pages/components/stores.

7. **Testing updates**
   - Add Vitest unit tests for protocols/stores/providers.
   - Update WDIO specs where selectors changed.

Acceptance: Typecheck and lint pass, WDIO e2e green, no behavioral regression.

---

## Conventions

- File names: `PascalCase` for components, `camelCase` for hooks/stores/utils, `.ts` for types-only files.
- No types in `.tsx` files beyond local view props; import from `packages/contracts`.
- Export barrels via `index.ts` in every leaf folder.
- Avoid deep prop drilling; prefer local store selectors and dedicated hooks.

---

## Next Steps

- Approve this plan.
- Create `packages/contracts` and move shared types.
- Introduce base Zustand stores and refactor one page as a pilot (popup).
- After validation, replicate to other pages, then proceed with messaging and LLM provider steps.
