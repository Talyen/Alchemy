---
name: playwright-e2e
description: Use when writing or debugging Alchemy Playwright tests, using its browser fixtures or page objects, or diagnosing E2E failures.
---

# Playwright E2E authoring and debugging

Read [tests/e2e/README.md](../../../tests/e2e/README.md) before authoring or diagnosing a spec;
it owns imports, fixtures, page objects, tags, helpers, and diagnostics.
[CONTRIBUTING.md](../../../CONTRIBUTING.md) owns changed-path and CI tiers.

## Workflow

1. Apply [coverage selection](../../../tests/e2e/README.md#choosing-browser-coverage) before adding a journey: establish the consequential browser-specific risk and why existing or cheaper protection cannot catch it. Follow the shared [test value policy](../../../CONTRIBUTING.md#test-value-and-coverage-strategy) for additions and task-relevant retirement.
2. For a failure, identify the failing spec, project, source revision and available report or trace. Read the relevant fixture and page object before choosing a reproduction; distinguish setup failures from the player behavior the assertion protects. Use [failure-first triage](../../../scripts/VERIFICATION.md#failure-first-triage) when the cause is unclear.
3. Follow [execution permissions](../../../CONTRIBUTING.md#what-to-run-when-you-change). Authoring or debugging a test does not itself authorize local browser/Electron execution. Report source review, existing trace evidence and checks actually run separately.

Use this skill for authoring/debugging browser tests; ordinary verification follows CONTRIBUTING directly. Keep mechanics in the canonical README; update this skill only when the task-selection or execution strategy changes.
