# Resolved agent friction — September 2026

Historical evidence; current instructions live in the linked canonical owners.

2026-09-05 — A standalone ambient script-test declaration file passed TypeScript but failed Knip as unused. Consolidated its declarations into the existing test declaration owner; prevention lives in the [script catalog](../../scripts/README.md). N/A (one-off tooling integration).

2026-09-05 — Collection and shared item hover Shine passed visibility/layout checks while the artwork clip hid the colored border. Moved frame Shine to `Surface.overlay`; the hover browser check now rejects clipping ancestors. Prevention lives in [UI](../../docs/UI.md). N/A (one-off clipped-frame regression).

2026-09-05 — The hand-hover size matrix exceeded the default 20-second Playwright budget during real pointer sweeps at two 1920px settings. The [focused spec](../../tests/hand-hover.spec.ts) now uses the existing animation suites’ 60-second budget; all 11 cases passed without changing animation speed. N/A (one-off test-budget correction).

2026-09-05 — Wish reused a card-width variable scoped only to the battle hand, so artwork rendered at intrinsic size and pushed confirmation out of view. Wish now uses the shared view-card size and fits every option on one row; queued selections reset independently. Prevention lives in [UI sizing](../../docs/UI.md#display-sizing) and Wish browser regressions. N/A (one-off sizing and selection lifecycle mismatch).

2026-09-05 — Affix tags omitted Frozen while tooltip recognition omitted Dodge, making shine disagree with descriptions. Shared recognition in `src/lib/keyword-text.ts` and keyword-coverage regressions now enforce [ARMORY](../../docs/ARMORY.md) presentation rules. Follow-up: Unique tooltips overrode corrected affix palettes with gold; Nourishing lacked recognized aliases, and hover backgrounds mixed affinity colors and CSS fades into hex-only rendering. Renderer-level catalog tests and a Dance of Blades browser regression now cover these integration paths.

2026-09-05 — The draw/discard animation test watched the card-play ghost layer, so it could pass only by catching a leftover play animation. Updated [the test](../../tests/draw-discard-animations.spec.ts) to watch the transfer layer. N/A (one-off stale selector).

2026-09-05 — Companion Bond tooltips ignored their supplied context, and combat only scaled damage; the one-effect validation also contradicted the array-based combat model. Shared Bond resolution now feeds combat and descriptions, with multi-effect validation and progression documented in [WORKFLOWS](../../docs/WORKFLOWS.md#add-a-new-companion). N/A (one-off contract reconciliation).

2026-09-05 — Lifegiving revived defeated heroes and Mana Moth restored against full Mana or erased Wellspring overflow. Fixed [terminal turn processing](../../src/lib/battle/enemy-turn.ts), [healing and Mana restoration](../../src/lib/battle/types/state-helpers.ts), and Mana Moth’s extra Mana effect; covered by battle regression tests. N/A (one-off combat-rule correction).

2026-09-05 — Balance matchup rows used only the first depth despite simulating three, timeout durations included an unplayed next round, and duration findings were gated on win-rate noise. Fixed aggregation, round counting, and independent metric filtering; prevention and interpretation live in [balance simulation](../../docs/REFERENCE.md#balance-simulation). N/A (one-off tooling reconciliation).

2026-09-05 — Canvas animation loops did redundant sizing work: status effects polled layout every frame despite observing size, and background particles reset unchanged backing dimensions on the observer’s initial notification. Fixed in the [status loop](../../src/lib/animation/combatant-status-effect-loop.ts) and [particle renderer](../../src/lib/animation/background-particles.ts). N/A (one-off); old/new browser output matched at 18 sampled frames, including resize and DPR changes.

2026-09-05 — The full performance run failed Armory and startup navigation because scenarios used screen-specific menu labels while the shared header exposes “Open game menu.” Updated the three affected scenarios. Trace source locations also added one to Chrome’s already one-based line numbers; corrected against the built script. N/A (one-off profiling reconciliation).

2026-09-05 — Performance profiling could reuse stale build output on a clean checkout, and trace summaries mixed threads and counted nested work repeatedly. Fixed the [runner](../../scripts/run-performance.mjs) and [slow-frame attribution](../../performance/trace-insights.ts); the [profiling workflow](../../docs/PERFORMANCE.md#finding-the-work-behind-a-slow-frame) now explains retained evidence. N/A (one-off tooling reconciliation); verified with a battle trace and an injected main-thread stall.

2026-09-05 — Skill review found broken routing links, duplicate purpose files, optional rationale routed as mandatory procedure, and audit delegation pointing to a nonexistent policy. Consolidated [skill routing](../skills/README.md) and [knowledge](../knowledge/index.md), corrected skill workflows and stale asset/battle references. N/A (documentation consolidation).

2026-09-05 — Build review found asset gates excluding raw sources, browser cache hits skipping OS dependencies, and bundle checks succeeding without outputs. Fixed the [workflows](../../.github/workflows/ci.yml), [browser setup](../../.github/actions/setup-playwright/action.yml), and [bundle gate](../../scripts/check-bundle-budget.mjs); corrected the [script catalog](../../scripts/README.md). N/A (one-off pipeline reconciliation).

2026-09-05 — Agent routing contradicted optional knowledge reads and mandatory post-edit verification; aligned [agent rules](../../AGENTS.md), [skill routing](../skills/README.md), and [knowledge triggers](../knowledge/index.md). Browser invocation lessons now live in the [E2E guide](../../tests/e2e/README.md#running-focused-checks). N/A (one-off documentation reconciliation).

2026-09-05 — Focused browser layout checks used an old preview build by default. Use `PLAYWRIGHT_VITE_MODE=dev` when verifying current source edits; see [Playwright configuration](../../tests/playwright-shared.ts). N/A (one-off).

2026-09-04 — Labyrinth input: removing a decorative dimming layer during hover could lose mouse clicks; the artwork now ignores pointer events so the hex button remains the target. Browser coverage in [Labyrinth tests](../../tests/labyrinth.spec.ts). N/A (one-off).

2026-09-04 — Labyrinth history: the viewed-floor synchronization effect snapped manual history selection back to the current floor; advance only when the current floor actually changes. Covered by [Labyrinth tests](../../tests/labyrinth.spec.ts). N/A (one-off).

2026-09-04 — Focused E2E invocation: appending a spec after the npm script's spaced project flag treated the spec as another project. Use an explicit Playwright invocation with `--project=chromium` for focused files. N/A (one-off).

Labyrinth fresh-start regression (2026-09-04): resume-only browser coverage missed a missing map-generation step. Fixed in [run initialization](../../src/features/alchemy/run-setup/run/content-system-run-init.ts) with fresh-start and Wildcard coverage; N/A (one-off).

2026-09-04 — Artwork reveal: startup preload completion did not guarantee later mounted images were decoded. Screen and tab fades now wait for mounted artwork, with dimensions reserved for the menu logo; see [UI](../../docs/UI.md#screen-fade-motion). N/A (one-off).

2026-09-04 — Tooltip fade: hover-only descriptions cleared before the panel finished exiting. The shared tooltip now retains its complete visible content through exit; regression coverage includes rapid reopening. N/A (one-off). Related verification also refreshed five stale display-size assertions.

2026-09-04 — Artwork corners: runtime radius variables inherited an ancestor’s content scale while inline rounded utilities used the local scale. Resolved in `src/styles/components.css` with inline theme resolution for clipping radii; N/A (one-off).

| Date       | Area           | Resolution (commit / pattern link, or N/A + reason)                                                                                                                                                                                                      |
| ---------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-04 | Battle E2E     | End Turn retry kept waiting for a removed button after victory arrived during its first wait; recheck battle outcome on every retry in BattlePage. N/A (one-off).                                                                                        |
| 2026-09-04 | Mystery test   | Restore test expected retired Crypt trinkets after the choice changed to random gear; updated run-domain-resume test to assert current rewards. N/A (one-off).                                                                                           |
| 2026-09-02 | Agent scope    | Replaced blanket unrelated-path avoidance with the safe incidental-fix policy in [AGENTS.md](../../AGENTS.md#working-style).                                                                                                                             |
| 2026-09-02 | Verification   | Replaced duplicated push/handoff gates and incomplete child-only records with one source-aware `check` run.                                                                                                                                              |
| 2026-09-03 | Knip entries   | Explicit `src/main.tsx` / `src/startup.ts` entries flagged redundant under `--treat-config-hints-as-errors`; Vite/HTML plugins auto-infer them — documented in `knip.config.js`, keep only `src/App.tsx`.                                                |
| 2026-09-02 | Script budgets | `ROUTE_CONTEXT_BUDGETS` assets total went stale (test red on main); budgets now enforced by `context-hotspots --check`.                                                                                                                                  |
| 2026-09-03 | Lint guards    | Dead ban entries (`battle-store`, `run-domain-store`) could not be removed from `eslint/fragments.js` because `lint-architecture-smoke` asserted their presence; smoke assertion now targets live `run-session-write-port` (this commit), N/A (one-off). |
|            |                |                                                                                                                                                                                                                                                          |
| 2026-09-05 | Armory salvage | Preview RNG rerolled on reopen; stable per-item rewards and single-action targeting now documented in [ARMORY](../../docs/ARMORY.md). N/A (one-off).                                                                                                     |
| 2026-09-05 | Save E2E       | Page-level injection reapplies fixtures on reload; [E2E guidance](../../tests/e2e/README.md#navigation-and-bootstrap) now documents fresh-page persistence checks. N/A (one-off).                                                                        |
| 2026-09-05 | Feedback fade  | Fresh object inputs to `useHeldWhile` looped in Vitest without React Compiler; memoized snapshots and a focused regression test now enforce [UI guidance](../../docs/UI.md#screen-fade-motion). N/A (one-off).                                           |
