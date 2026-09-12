---
status: complete
updated: 2026-09-12
---

# Accidental Complexity Review

## Final decisions

Implemented on 2026-09-12. This record supersedes the earlier replacement-run flow and mockups.

- Keep one unfinished run, with exact resume.
- Main menu: **Continue** when a run exists; otherwise **Play**. Never show both, a separate New Run action, or a disabled Play action.
- Players end the current run using the existing red **End Run** menu action. It acts immediately, with **no confirmation**, and returns to the main menu.
- Existing development saves are disposable. Establish a new supported save baseline without migrating or salvaging old development saves.
- Keep explicit combat resolution paths; make only evidenced, targeted improvements to reaction eligibility and ordering.
- Keep animated WebGL plasma with a static decorative fallback; remove animated Canvas support.
- Preserve Alchemy's actual screens, artwork, typography, controls, and minimal copy. Do not add run-summary cards, Health readouts on the menu, setup warnings, step indicators, instructional text, or extra setup screens.

## 1. One unfinished run

### Player flow

1. With no unfinished run, Play opens the existing mode, hero, and applicable difficulty selection.
2. With an unfinished run, Continue resumes its exact saved activity. The player must end it before starting another run, including another run of the same mode or hero.
3. The existing in-game menu exposes End Run during all unfinished run activities, including battle, pending rewards, shops, Mystery, Corruption, and drafts. Opening the menu does not require completing the pending choice or playback.
4. Clicking End Run closes the menu, ends the run immediately, and returns to the main menu with Play available. No confirmation, replacement setup, undo mechanism, or new warning is added.
5. Visiting the main menu or meta screens preserves the current run and its resume location. Ordinary setup before a run begins may be discarded on exit. A draft is part of the new run from its first card offer and must resume exactly.

The existing End Run handler can surrender a battle and route through Game Over. Change **manual** End Run to use a common terminal operation and return directly to the main menu. Preserve normal defeat and victory presentation and their existing rules.

### Implementation and contracts

- Remove parked-run maps, recency tracking, mode-specific resume selection, parking/switching commands, and their schema and fixture fields. Simplify menu/route props to a single current-run availability value and a Continue action through the existing controller boundaries.
- Reject stale or indirect start actions while a run is active; do not let an old callback or alternate route overwrite it. Return to the normal Continue entry point without adding warning copy.
- Keep the active-run resume codec, hydration, pending battle transitions, shop repair, and other restoration behavior still needed by the sole run. Extract retained restoration responsibilities from parking-related owners rather than deleting those owners wholesale.
- Keep equipment and Trinket restrictions for the current battle, including while visiting Armory. Remove only restrictions and reservations that exist to coordinate multiple parked battles.
- Reuse existing run-end bookkeeping: finalize earned XP, existing end-of-run material bonuses, and existing completion/unlock bookkeeping exactly once. Preserve owned Gear, Talents, discoveries, materials, and other profile progress. Do not grant unclaimed reward selections or resolve unfinished random choices merely because the player ended the run.
- Invalidate pending battle playback, timers, navigation work, and asynchronous completions before clearing the run. Late work must neither award progress nor restore or mutate a subsequent run.
- Finalize profile changes and remove the resumable run through the existing command/lifecycle owners. Use the existing terminal-save path so older queued autosaves cannot resurrect the run; keep its write acknowledgement and retry behavior.

**Benefit:** removes parallel run ownership and replacement setup state while giving the menu one obvious play action.

## 2. Retire development-save history

### Baseline policy

- Introduce the single-run format with a new schema version above the existing current version, and raise the minimum supported schema version to that new baseline. Retain the distinction between build identity, save structure, and content version: an ordinary new build does not invalidate compatible saves.
- Reject below-baseline candidates before permissive defaults or version stamping can reinterpret them as current saves. If no supported playable or protecting future candidate remains, initialize fresh defaults through the normal save path. Do not add a wipe prompt or separately delete local/Cloud backups to perform this reset.
- Do not preserve an old active/parked run or independently salvage an old profile. Remove obsolete schema migrations, content remaps, legacy battle-field conversions, and fixtures/tests whose sole purpose is below-baseline compatibility.
- Keep current-format validators, safe defaults, normalization, hydration, live-catalog repairs, and current-content metadata/guards. Classify historical conversion separately from current-data repair before deleting anything. Directory names or `legacy` names alone are not sufficient evidence for removal.
- Freeze the supported baseline at the first distribution whose progress is promised to persist, including a playtest or Early Access release if applicable. Subsequent supported saves retain their compatibility commitments. Do not automatically advance the floor with every build.

### Recovery and durability

- For supported current-format saves, retain field-level recovery and preserve valid profile progress when the run is unusable. Do not build a general salvage system for arbitrary unsupported shapes.
- Preserve local-first writes, backup and Cloud candidate handling, deterministic candidate selection, write acknowledgements, retry timing, and lifecycle flushes.
- Preserve future schema **and content** protection: a recognizable future candidate protects the session when it is fresher than every playable candidate, or when none is playable. A stale future candidate does not block a fresher playable one; timestamp ties favor playable data. Retain the existing missing-timestamp behavior.
- When protection applies, keep writes disabled and retain the existing blocking Save Protected flow and explicit deletion escape hatch. Do not let players silently play against unsaved defaults. Use concise update guidance; do not surface internal schema numbers.
- Update save metadata, schemas, defaults, hydration, fixtures, migration guards, and the canonical save contract together.

**Benefit:** removes obligations to disposable formats without replacing them with an equally complex recovery policy or weakening supported-save durability.

## 3. Targeted battle cleanup

### Scope

- Review the existing uncommitted battle changes first. Typed pre-hit facts and named reaction stages already exist in the working tree; verify those changes rather than recreating them.
- Keep separate, explicit ordering for card hits, enemy hits, DoT ticks, Companion actions, and typed follow-up damage. Reuse individual mechanic handlers where semantics match. Do not introduce a universal event bus, reaction queue, configurable stage registry, or generalized combat pipeline.
- Keep captured pre-action facts distinct from evolving state. Preserve depth-first nested reactions, including Archery extra-hit completion before the outer hit's payout, existing fatal cutoffs, reward timing, and seeded RNG consumption.
- Keep the persisted battle-state shape unchanged during this refactor. Remove only historical load conversions in the save-baseline work; do not reorganize persistent flags merely to make them look tidier.

### Reaction eligibility

- Before replacing any `withPreservedFlags()` usage, document its behavior for played cards, Companions, repeats, and turn-start effects: which benefits may trigger, which may be consumed, which newly earned benefits survive, and how nested effects behave.
- Include its current cost-reduction preservation rule; it is not merely a source label or blanket suppression switch.
- Reuse the existing effect-resolution context for narrowly typed eligibility where it demonstrably removes dependence on temporarily falsified flags. Migrate one independently verifiable origin at a time. Keep a remaining wrapper when explicit context would only spread equivalent switches through more handlers.
- Stop when the evidenced ordering and eligibility problems are addressed. Do not extend this into unrelated combat cleanup or a persisted-state redesign.

**Benefit:** makes specific reaction decisions locally understandable without replacing game rules with another framework.

## 4. WebGL plasma with static fallback

- Keep one public plasma entry point and the current WebGL visuals. Remove the renderer-choice prop/type, animated Canvas implementation, and tests that only exercise that removed backend.
- Place a static CSS gradient beneath the WebGL canvas, matching the existing effect's colors, focal placement, blending, and intensity. Show it when WebGL initialization fails; suppress it when WebGL is rendering so brightness is not doubled.
- Make initialization success/failure explicit. Clean up partially created shaders, programs, buffers, listeners, and scheduling when initialization fails.
- On context loss, stop drawing and reveal the static fallback. On a restoration event, rebuild resources and resume WebGL only after successful initialization; otherwise retain the fallback. Do not add a polling/retry loop or a graphics-selection UI.
- The fallback uses an ordinary decorative layer, not a 2D context on the WebGL canvas. No second animated renderer or canvas-backend switching is needed.
- Keep colors and intensity responsive to existing interaction state. Zero intensity hides the effect entirely. Preserve existing reduced-motion and animation-disabled appearance rather than treating those preferences as a graphics failure; neither path should schedule decorative animation when motion is disabled.
- Log graphics failures at the appropriate seam. Do not show a graphics error dialog. Validate the static appearance as an acceptable approximation, not pixel-equivalent plasma.

**Benefit:** retains graceful decoration when graphics resources fail while removing a second animation implementation.

## Implementation order and verification

1. **Establish a baseline.** Inspect current diffs and validate relevant existing edits, especially battle, navigation, and autosave. Preserve concurrent work and make task changes separable. Capture representative deterministic battle inputs/results before further refactoring.
2. **Single-run model and save baseline.** Implement together as one coherent compatibility transition, with reviewable changes to navigation, lifecycle, and storage. Use the architect skill before changing cross-boundary contracts. Update canonical architecture, run workflow, Armory, and persistence owners alongside their invariants.
3. **Graphics fallback.** Implement and verify independently of combat changes.
4. **Battle cleanup.** Make only the bounded improvements above, checking behavior after each change. Record ordering and eligibility invariants in the canonical battle owner.
5. **Handoff.** Review the final diff and behavior, run the repository's changed-path completion gates for all task-owned paths, and report meaningful test retirements. Archive this plan only after implementation is complete.

### Acceptance scenarios

- Main menu shows exactly Continue or Play. No New Run action, replacement confirmation, or new instructional UI exists. Actual artwork and screen layouts remain in use.
- Continue restores battle, shops, rewards, Mystery, Corruption, and drafts after menu/meta visits and reload. Include interrupted opening draw, enemy-turn playback, a final draft pick, and pending reward claims; no choices reroll and no rewards duplicate.
- End Run works immediately from every unfinished activity, returns to the main menu, and survives reload with no resumable run. Repeated clicks, pending callbacks, and in-flight autosaves cannot duplicate progression, resurrect the ended run, or affect the next run.
- Earned progression and existing terminal bookkeeping remain correct. Current-battle equipment restrictions persist through Armory visits and release on run end. Natural defeat and victory retain their existing outcomes and presentation.
- A fresh baseline save round-trips. Below-baseline saves are rejected, while valid supported backups remain eligible. Invalid current-run data does not erase a valid supported profile. Verify future schema/content freshness, ties, missing timestamps, write protection, and existing save retry/flush behavior.
- Battle tests cover the eligibility matrix, nested reactions, fatal cutoffs, and representative interacting mechanics. Compare identical initial states/action sequences before and after refactoring: gameplay state, combat text order, payouts, and RNG counters must match. Retain description-parity and full battle-suite protection; do not add tests solely to mirror extracted helpers.
- Browser and packaged Electron checks cover WebGL context acquisition failure, shader/program failure, context loss/restoration, resize, inactivity/wake, unmount cleanup, intensity zero, and motion preferences. Inspect the static fallback on representative screens and ensure it does not add animation work or double the normal glow.
- Use the verifier skill and `npm run check -- <task-owned paths>` after each coherent change. Add the full battle suite and focused browser/Electron scenarios where the changed-path gate does not select them. Do not redundantly rerun successful gates without a new change or unresolved concern.

## Preserved scope and assumptions

Exact current-run resume, described card/Talent/Gear/Trinket/enemy-Trait behavior, combat animation timing and playback, Autoplay, Auto-End Turn, deck inspection, artwork-safe fades, balance simulation, performance tooling, and supported-save durability remain requirements.

The user explicitly chose immediate End Run without confirmation, disposable development saves, minimal UI, and static fallback rather than animated Canvas. No product decisions remain open for this scope. Earlier mockups with Continue plus New Run or replacement dialogs are superseded and must not be used as implementation specifications.

## Completion record

- Delivered the single-run Continue/Play flow and immediate End Run. Kept current-run restoration and existing earned-progression rules; preserved the outgoing battle snapshot only for presentation while removing all resumable activity.
- Established schema 19 as the supported baseline. Removed parked-run state, below-baseline migrations/aliases, their historical fixtures, and the animated Canvas backend. Updated CI fixture triggers and canonical documentation.
- Reviewed and verified the pre-existing typed battle facts/stages. Kept the scoped flag wrapper where explicit source checks would spread equivalent policy across handlers; documented its eligibility matrix and added nested earned-benefit coverage. No persisted combat-state redesign or universal pipeline was introduced.
- Retired tests specific to parking, historical schema/content conversions, the old End Run defeat route, and animated Canvas. Retained/adapted current-run shop/draft/choice/battle restoration and pending Gold protection; added baseline rejection, single-run navigation, terminal progression, resource cleanup, and graphics failure/restoration checks.
- Completion gate `check-20260912t212647z-87585-e00932` passed: 4,724 related unit tests (one unrelated test skipped), the complete save and tooling/architecture suites, changed tests, CI static checks, web build, bundle budget, and preview smoke. Suite counts overlap and should not be summed.
- Browser verification passed 13 distinct menu/graphics cases (the two corrected cases passed in `playwright-20260912t211333z-76222-a5da69`) and all 15 save/outcome journeys (`playwright-20260912t211829z-77410-083bdf`).
- The final desktop build passed. Packaged-renderer Electron graphics loss/restoration and shader fallback passed on macOS (`playwright-20260912t212906z-93100-4d12d0`). This was implementation verification, not a Windows installer or Steam release.
- Existing unrelated uncommitted work was preserved. No commit or push was requested or performed.
