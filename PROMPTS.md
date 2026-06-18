# Alchemy — Code quality audits

Agent prompts for **code quality and UI/UX** — simplification, hardening, readability, and interaction/layout review. Copy a section into your agent with target paths or a diff attached. For domain wiring (cards, saves, screens, gear), use [WORKFLOWS.md](./docs/WORKFLOWS.md) and [CONTRIBUTING.md](./CONTRIBUTING.md) instead.

**Docs:** [AGENTS.md](./AGENTS.md) (rules) · [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) (run state) · [docs/WORKFLOWS.md](./docs/WORKFLOWS.md) (how-to) · [CONTRIBUTING.md](./CONTRIBUTING.md) (hooks & tests)

**Verification tiers:** narrow area tests from [CONTRIBUTING — What to run when you change](./CONTRIBUTING.md#what-to-run-when-you-change) · **Default gate:** `npm run lint:ci && npm test` · **Pre-push parity:** `npm run check:push` · **Save/ship:** `npm run check:ship`

Each audit uses: **Goal** · **Check** · **Docs** · **When done**

---

## Simplicity & LOC reduction audit

**Goal:** Remove dead code, duplication, and unnecessary indirection without breaking generated outputs.

**Check:**

- Run `npm run deadcode` (knip; also runs inside `lint:ci`)
- Unused exports, duplicate helpers, orphaned test files
- Duplicate logic across files — consolidate or extract only when it reduces total LOC
- Pass-through wrappers (re-export, thin delegate, alias function with no behavior)
- Unnecessary intermediate types/interfaces used in one place
- Split files only when cohesion is genuinely different; prefer deleting over splitting
- Do not delete symbols only referenced from generated files (`gear-art.ts`, `metadata.generated.ts`) without running the asset/sync scripts

**Docs:** [AGENTS.md — Generated and heavy files](./AGENTS.md#generated-and-heavy-files)

**When done:** `npm run deadcode && npm run lint:ci && npm test`

---

## Over-engineering audit

**Goal:** Remove abstraction that costs more than it saves.

**Check:**

- Generalization for a single caller (config objects, strategy/factory for 2 cases)
- Unused extension points, hooks, or "future-proof" parameters
- Indirection chains where the caller could use the underlying API directly
- Duplicate state sources (derive instead of sync)
- Comments explaining confusing code — prefer simplifying the code and deleting the comment
- New dependencies or patterns inconsistent with the surrounding module

**Docs:** [AGENTS.md — Architectural invariants](./AGENTS.md#architectural-invariants)

**When done:** `npm run lint:ci && npm test` (narrow tests for touched paths)

---

## Readability & clarity audit

**Goal:** Make code scannable without changing behavior.

**Check:**

- Names match domain vocabulary already used in the module
- Functions do one obvious thing; extract only when it improves top-to-bottom reading
- Prefer early returns over deep nesting (>3 levels)
- Prefer plain data structures over clever types when both are correct
- Match surrounding file conventions (imports, export style, error handling)
- React: explicit `Props` types, plain function components (per [AGENTS.md — UI conventions](./AGENTS.md#ui-conventions))

**Docs:** [AGENTS.md — UI conventions](./AGENTS.md#ui-conventions)

**When done:** `npm run lint:ci`

---

## Type safety audit

**Goal:** Eliminate unsafe typing in changed files; keep persistence boundaries validated.

**Check:**

- Hunt `any`, `@ts-expect-error`, `@ts-ignore`, `eslint-disable`, `as unknown as`, and non-null assertions at persistence boundaries
- Prefer narrowing over assertion at boundaries
- Zod/validation at save/load boundaries

**Docs:** [AGENTS.md — Architectural invariants](./AGENTS.md#architectural-invariants) · [WORKFLOWS — persisted save data](./docs/WORKFLOWS.md#change-persisted-save-data)

**When done:** `npm run lint:ci`

---

## Architecture compliance audit

**Goal:** Verify changed files respect layer constraints and boundary patterns enforced by ESLint and project invariants.

**Check:**

- `eslint.config.js` is the source of truth for import boundaries
- `src/lib/**` must not import `@/features/**`
- Feature screens must not import run-loop orchestration
- `src/lib/battle/**` remains framework-agnostic and must not import features
- `shared/ui` receives run/battle/session data through props only
- Features outside `shared/stores/` use `run-session-facade`, not `run-domain-store` directly

**Docs:** [AGENTS.md — Import boundary summary](./AGENTS.md#import-boundary-summary) · [AGENTS.md — Architectural invariants](./AGENTS.md#architectural-invariants) · [ARCHITECTURE.md — Import boundaries](./docs/ARCHITECTURE.md#import-boundaries)

**When done:** `npm run lint:ci` (+ architecture tests if facade/store paths touched)

---

## Behavior hardening audit

**Goal:** Strengthen correctness at boundaries without defensive overkill.

**Check:**

- Null/undefined/empty paths at module boundaries handled explicitly (not silently ignored)
- State transitions are idempotent where re-entry is possible (resume, retry, double-click)
- No swallowed errors; failures surface or log with context
- Invariants from [AGENTS.md — Architectural invariants](./AGENTS.md#architectural-invariants) respected in changed code (immutable battle state, materials via facade, etc.) — verify adherence, do not re-document wiring
- Edge cases covered by existing tests; add tests only when fixing a real gap

**Docs:** [AGENTS.md — Architectural invariants](./AGENTS.md#architectural-invariants) · [CONTRIBUTING — What to run when you change](./CONTRIBUTING.md#what-to-run-when-you-change)

**When done:** targeted tests from [CONTRIBUTING — What to run when you change](./CONTRIBUTING.md#what-to-run-when-you-change)

---

## Test quality audit

**Goal:** Tests protect behavior without adding maintenance burden.

**Check:**

- Assert outcomes, not implementation details
- No trivial assertions (e.g. "function exists", "returns defined")
- Duplicate setup — extract shared fixtures/helpers
- Orphaned or copy-pasted test files
- E2E: no dev-only QA shortcuts — no Skip Combat / Unlock All selectors or strings in specs; `enableFastMode` not in animation canary or animation-focused specs; `BattlePage.endTurn` works with animations on and off; prefer `winViaCombat()` or `playCardNamed()` over dev-only QA shortcuts

**Docs:** [CONTRIBUTING — E2E helpers](./CONTRIBUTING.md#e2e-helpers)

**When done:** relevant `npm test` paths + `npm run test:e2e:prepush` if battle/page helpers changed

---

## UI interaction & feedback audit

**Goal:** Find bugs desktop players feel but types miss — broken clicks, drag ghosts, stuck modes, missing feedback. **Desktop keyboard + mouse only** — hover tooltips and cursor feedback are fine.

**Check:**

- Pointer/drag: every `setPointerCapture` has matching release on up, cancel, and unmount; cursor/body styles restore on exit; no ghost clicks after drag
- One clear interaction mode at a time — drag, modal, targeting, scroll should not fight each other
- Hover tooltips: show/hide cleanly (no stuck tooltip after drag/mode change); do not block clicks on underlying controls
- Feedback: clicks/buttons give visible response; destructive actions need confirm + working cancel/backdrop dismiss
- Keyboard: focusable controls have names; Escape cancels overlays where users expect it
- After changes: note a 30s manual repro; ask the user if visual behavior is unclear

**When done:** relevant screen/unit tests + `npm run lint:ci`

---

## Layout & visual containment audit

**Goal:** Find clipping, overflow, and mis-scaled UI from structure/CSS — not pixel-perfect polish.

**Check:**

- Walk ancestors of popovers/tooltips/drag visuals for `overflow-hidden`, `transform`, and scroll containers that clip floats
- Flex/grid scroll areas need `min-h-0` / `min-w-0` on the scrolling child
- Floats stay on-screen (flip/clamp/portal) and do not block clicks on underlying controls unintentionally
- In-stage UI (`#vr-stage`): prefer `cqh`/`cqw` over `vw`/`vh` so scaled layouts stay consistent
- Check narrow + wide desktop viewports when layout changed; ask the user if clipping is uncertain

**When done:** `tests/features/ui/` or relevant `tests/*.spec.ts` if placement/layout logic changed; `npm run lint:ci`
