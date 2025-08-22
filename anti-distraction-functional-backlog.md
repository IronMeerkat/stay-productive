# Anti‑Distraction Functional Backlog

This backlog captures additional high‑impact ideas beyond the core features integrated into the primary plan. Items are phrased as outcomes and aligned to the agentic architecture (Sense → Classify → Policy → Enforce) and MV3 constraints.

## Backlog items

- Search‑only mode (shipped in plan)
- Intent gate (shipped in plan)
- Adaptive strictness (shipped in plan)
- Appeal memory (shipped in plan)

- Proactive distraction alerts
  - Real‑time pattern detection triggers local notifications when risk spikes (late night, pre‑deadline, repeated host loops).

- Personalized productivity insights
  - Summarize peak focus periods and overruns; propose small schedule tweaks (opt‑in, local‑first).

- Automated task prioritization
  - Integrate a local task list and calendar context to suggest what to do now; block distractors during top tasks.

- Seamless integration with productivity tools
  - Optional connectors (local/remote gated) for calendars, issue trackers, docs; never required for core blocking.

- Enhanced user engagement through gamification
  - Streaks, soft rewards, weekly review summary of blocks vs allows; no dark patterns.

- Real‑time feedback mechanisms
  - Live counters and brief reports on productive vs distracting time; privacy‑preserving and local.

- Customizable distraction profiles
  - Per‑host and per‑path profiles: allow channels/subreddits/queries; block feeds/recommendations by default.

- Granular feed removal
  - DOM/CSS rule packs per site to hide recommendations/comments/infinite scroll; configurable in Options.

- Minimal mode
  - Remove thumbnails, disable autoplay, collapse comments; grayscale option per host.

- Task redirector
  - On block, show quick links to current tickets/docs and recent “work links” to re‑route attention.

- Context alignment check (LLM)
  - Quick relevance score to today’s goals with a short rationale; nudge instead of block when uncertain.

- Micro‑cooldowns
  - Per‑host cooldowns after block; repeated attempts extend cooldown duration automatically.

- Revisit guard
  - Detect tab‑switch loops and auto‑block with explicit rationale and short cooldown.

- Content rewriting (gentle mode)
  - Convert feeds to static, paginated lists without engagement hooks; keep links accessible.

- Just‑in‑time notifications
  - Triggered on risky patterns (3rd attempt, late night, over budget); throttle and respect Do Not Disturb.

- Task‑first overlay
  - Quick capture of goal/URL; route user directly; integrate with intent reminder banner.

- Granular allowlists
  - Allow specific channels/subreddits/queries only; everything else blocked on the same domain.

- Shadow blocking
  - Replace feed click targets with inert placeholders until a deliberate “Show anyway” is pressed.

- Network‑level assist (MV3 DNR)
  - Use declarativeNetRequest to block known rec/feed endpoints (e.g., `/recommendations`, `/home_timeline`).

- Team mode (opt‑in)
  - Soft accountability with a buddy; share daily focus intents and outcomes; local export first.

## Notes

- All items respect existing privacy, validation, and guardrail principles.
- Each feature should introduce a feature flag and default‑safe behavior.
- Prefer local‑first implementations; remote connectors behind explicit consent and flags.
