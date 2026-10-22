---
name: playwright-e2e
description: Use when writing or debugging Alchemy Playwright tests, using its browser fixtures or page objects, or diagnosing E2E failures.
---

# Playwright E2E & app control

Read [tests/e2e/README.md](../../../tests/e2e/README.md) before changing a spec;
it owns imports, fixtures, page objects, tags, helpers, and diagnostics.
[CONTRIBUTING.md](../../../CONTRIBUTING.md) owns changed-path and CI tiers.

## Workflow

1. Apply [coverage selection](../../../tests/e2e/README.md#choosing-browser-coverage) before adding a journey: establish the consequential browser-specific risk and why existing or cheaper protection cannot catch it. Follow the shared [test value policy](../../../CONTRIBUTING.md#test-value-and-coverage-strategy) for additions and task-relevant retirement.
2. Follow [execution permissions](../../../CONTRIBUTING.md#what-to-run-when-you-change). Use the failure digest when the cause is unclear, or open an existing trace for a specific hypothesis.

Use this skill for authoring/debugging browser tests; ordinary verification follows CONTRIBUTING directly. Keep mechanics in the canonical README; update this skill only when the task-selection or execution strategy changes.
