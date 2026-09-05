# Friction Log

Centralized intake for agent pain points, confusion, and struggle while working in this codebase. Keep entries short — one line in the table is enough. Use the expanded template only when extra context helps.

Add a row to `Open` when docs mislead, behavior surprises, or repeated friction appears. Move it to `Resolved` with a fix link plus either a `knowledge/patterns/<name>.md` link or `N/A (one-off)` with a one-line reason. Repeated friction is evidence for reusable prevention; add a knowledge note only when the explanation will help future work.

## How to log

1. Add a row to `## Open` below.
2. For longer context, add a `### YYYY-MM-DD — short slug` subsection under `## Details` using the template at the bottom.
3. When resolved, move the row to `## Resolved` and include a commit, PR, or `knowledge/patterns/<name>.md` link — or `N/A (one-off)` with reason. Link an existing lesson before creating another.

## Open

| Date       | Area           | Symptom (expected vs actual)                                                                                                                                                                                                                                            |
| ---------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-02 | Tests          | `renderHook().rerender(newCallback)` silently skipped effect refires; `initialProps` + `rerender(props)` works.                                                                                                                                                         |
| 2026-09-03 | Reads/tests    | Early file reads went stale as the dirty tree shifted mid-session (`next-archery-free`, `thorns` missing); one transient parity failure cleared on re-run. Re-read touched files and re-run red tests before concluding.                                                |
| 2026-09-03 | Parallel edits | Concurrent card-library edits duplicated a card id (`stargaze` in core + defense), failing the whole suite at import via the library guard; also overwrote a doc sentence mid-edit. Asked user, resolved per answer; re-verify shared files after any parallel session. |
| 2026-09-03 | Save docs      | MIGRATIONS.md described tombstone→hydrate→normalize and dropping of all unknown card IDs; code was migrate→validate→normalize→hydrate→restore and stripped only 2 tombstoned IDs. Fixed in-tree (strict catalog-liveness cleanup + layer-order rewrite).                |
| 2026-09-03 | E2E            | `save-error-paths` cold-start menu test times out (15s Play-button wait) when run under full `test:ship:e2e` parallel load; passes alone (7s) and file-alone (20s). Environmental, not save-logic.                                                                      |
| 2026-09-03 | Commands       | `dispatchRunSessionCommand` fires `afterCommit` even when Immer returns the base (no-op assignment); idempotent commands rely on it for navigation. Gating `afterCommit` on change would silently drop transitions. Left as-is.                                         |
| 2026-09-04 | UI docs        | `docs/UI.md` named a deleted trinket title module path and omitted the `fade-presence`/`fade-slot` shim layer; fixed in-tree alongside shim removal. N/A (one-off).                                                                                                     |

| 2026-09-04 | UI verification | A historical deleted filename in this log was parsed as a current file reference by docs verification; changed it to prose. N/A (one-off). |

| 2026-09-04 | React compiler | Bundling callback refs with layout values produced ref-access lint errors at property reads; destructuring callbacks and values before JSX resolves the inference. N/A (one-off). |

| 2026-09-04 | Browser checks | Overlapping Playwright invocations shared a dev server; one invocation teardown disconnected the other. Run browser batches serially or in one invocation. N/A (one-off). |

## Resolved

2026-09-05 — Canvas animation loops did redundant sizing work: status effects polled layout every frame despite observing size, and background particles reset unchanged backing dimensions on the observer’s initial notification. Fixed in the [status loop](../src/lib/animation/combatant-status-effect-loop.ts) and [particle renderer](../src/lib/animation/background-particles.ts). N/A (one-off); old/new browser output matched at 18 sampled frames, including resize and DPR changes.

2026-09-05 — The full performance run failed Armory and startup navigation because scenarios used screen-specific menu labels while the shared header exposes “Open game menu.” Updated the three affected scenarios. Trace source locations also added one to Chrome’s already one-based line numbers; corrected against the built script. N/A (one-off profiling reconciliation).

2026-09-05 — Performance profiling could reuse stale build output on a clean checkout, and trace summaries mixed threads and counted nested work repeatedly. Fixed the [runner](../scripts/run-performance.mjs) and [slow-frame attribution](../performance/trace-insights.ts); the [profiling workflow](../docs/PERFORMANCE.md#finding-the-work-behind-a-slow-frame) now explains retained evidence. N/A (one-off tooling reconciliation); verified with a battle trace and an injected main-thread stall.

2026-09-05 — Skill review found broken routing links, duplicate purpose files, optional rationale routed as mandatory procedure, and audit delegation pointing to a nonexistent policy. Consolidated [skill routing](./skills/README.md) and [knowledge](./knowledge/index.md), corrected skill workflows and stale asset/battle references. N/A (documentation consolidation).

2026-09-05 — Build review found asset gates excluding raw sources, browser cache hits skipping OS dependencies, and bundle checks succeeding without outputs. Fixed the [workflows](../.github/workflows/ci.yml), [browser setup](../.github/actions/setup-playwright/action.yml), and [bundle gate](../scripts/check-bundle-budget.mjs); corrected the [script catalog](../scripts/README.md). N/A (one-off pipeline reconciliation).

2026-09-05 — Agent routing contradicted optional knowledge reads and mandatory post-edit verification; aligned [agent rules](../AGENTS.md), [skill routing](./skills/README.md), and [knowledge triggers](./knowledge/index.md). Browser invocation lessons now live in the [E2E guide](../tests/e2e/README.md#running-focused-checks). N/A (one-off documentation reconciliation).

2026-09-05 — Focused browser layout checks used an old preview build by default. Use `PLAYWRIGHT_VITE_MODE=dev` when verifying current source edits; see [Playwright configuration](../tests/playwright-shared.ts). N/A (one-off).

2026-09-04 — Labyrinth input: removing a decorative dimming layer during hover could lose mouse clicks; the artwork now ignores pointer events so the hex button remains the target. Browser coverage in [Labyrinth tests](../tests/labyrinth.spec.ts). N/A (one-off).

2026-09-04 — Labyrinth history: the viewed-floor synchronization effect snapped manual history selection back to the current floor; advance only when the current floor actually changes. Covered by [Labyrinth tests](../tests/labyrinth.spec.ts). N/A (one-off).

2026-09-04 — Focused E2E invocation: appending a spec after the npm script's spaced project flag treated the spec as another project. Use an explicit Playwright invocation with `--project=chromium` for focused files. N/A (one-off).

Labyrinth fresh-start regression (2026-09-04): resume-only browser coverage missed a missing map-generation step. Fixed in [run initialization](../src/features/alchemy/run-setup/run/content-system-run-init.ts) with fresh-start and Wildcard coverage; N/A (one-off).

2026-09-04 — Artwork reveal: startup preload completion did not guarantee later mounted images were decoded. Screen and tab fades now wait for mounted artwork, with dimensions reserved for the menu logo; see [UI](../docs/UI.md#screen-fade-motion). N/A (one-off).

2026-09-04 — Tooltip fade: hover-only descriptions cleared before the panel finished exiting. The shared tooltip now retains its complete visible content through exit; regression coverage includes rapid reopening. N/A (one-off). Related verification also refreshed five stale display-size assertions.

2026-09-04 — Artwork corners: runtime radius variables inherited an ancestor’s content scale while inline rounded utilities used the local scale. Resolved in `src/styles/components.css` with inline theme resolution for clipping radii; N/A (one-off).

| Date       | Area           | Resolution (commit / pattern link, or N/A + reason)                                                                                                                                                                                                      |
| ---------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-04 | Battle E2E     | End Turn retry kept waiting for a removed button after victory arrived during its first wait; recheck battle outcome on every retry in BattlePage. N/A (one-off).                                                                                        |
| 2026-09-04 | Mystery test   | Restore test expected retired Crypt trinkets after the choice changed to random gear; updated run-domain-resume test to assert current rewards. N/A (one-off).                                                                                           |
| 2026-09-02 | Agent scope    | Replaced blanket unrelated-path avoidance with the safe incidental-fix policy in [AGENTS.md](../AGENTS.md#working-style).                                                                                                                                |
| 2026-09-02 | Verification   | Replaced duplicated push/handoff gates and incomplete child-only records with one source-aware `check` run.                                                                                                                                              |
| 2026-09-03 | Knip entries   | Explicit `src/main.tsx` / `src/startup.ts` entries flagged redundant under `--treat-config-hints-as-errors`; Vite/HTML plugins auto-infer them — documented in `knip.config.js`, keep only `src/App.tsx`.                                                |
| 2026-09-02 | Script budgets | `ROUTE_CONTEXT_BUDGETS` assets total went stale (test red on main); budgets now enforced by `context-hotspots --check`.                                                                                                                                  |
| 2026-09-03 | Lint guards    | Dead ban entries (`battle-store`, `run-domain-store`) could not be removed from `eslint/fragments.js` because `lint-architecture-smoke` asserted their presence; smoke assertion now targets live `run-session-write-port` (this commit), N/A (one-off). |
|            |                |                                                                                                                                                                                                                                                          |

## Details

_Add expanded entries here when the table row is not enough. Keep the table as the index._

### Expanded entry template

Copy and fill when needed:

```
### YYYY-MM-DD — short slug

- **Context:** what you were trying to do
- **Expected:** what you expected to happen / where you expected to find it
- **Actual / confusion:** what happened or what was confusing
- **Impact:** how it slowed you down or affected the task
- **Suggestion (optional):** what would have helped
```
