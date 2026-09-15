---
status: complete
updated: 2026-09-12
---

# Low-Value Test Review

## Purpose

Review the unit, browser UI, and Electron test suites and identify only low-value tests for possible removal, consolidation, or movement to a cheaper layer. Medium- and high-value tests are intentionally omitted.

Low value means that a test:

- protects only cosmetic styling, exact CSS, or an implementation detail;
- duplicates stronger coverage at another layer;
- is a generic render or object-shape smoke test with no meaningful outcome; or
- has maintenance cost disproportionate to the behavior it protects.

Save compatibility, battle mechanics, progression, accessibility, persistence, security, architectural contracts, documented responsive behavior, anti-flash behavior, and meaningful real-timing behavior remain out of scope for retirement.

When a test mixes low-value assertions with a meaningful contract, retain the meaningful assertion and remove only the literal CSS, palette, or markup checks. Every consolidation must name the surviving test or move the assertion to the cheapest layer that can still detect the failure.

## Decisions

Retired cosmetic-only smoke files, duplicate shine/color-literal assertions, and redundant per-variant E2E cases; retained representative behavior coverage for startup accessibility, item-shine semantics, interaction/focus wiring, responsive/anti-flash contracts, and battle presentation. Per-test retain/consolidate/retire pins applied in this review remain in git history; surviving suites own the current contracts.

## Verification summary

Affected Vitest suites passed: 25 files, 193 tests. Changed browser specs collected 35 cases; all passed after the run-setup fixture was isolated with a valid save envelope. `npm run plans:check` passed before completion, and the final task-scoped `npm run check -- <paths>` passed static checks, build, bundle budget, and preview smoke. Implementation changed only the test files and plan paths named by this review; unrelated working-tree edits remain untouched.
