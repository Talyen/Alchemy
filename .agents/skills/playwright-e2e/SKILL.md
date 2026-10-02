---
name: playwright-e2e
description: Use when writing or debugging Alchemy Playwright tests, using its browser fixtures or page objects, or diagnosing E2E failures.
---

# Playwright E2E & app control

Read [tests/e2e/README.md](../../../tests/e2e/README.md) before changing a spec;
it owns imports, fixtures, page objects, tags, helpers, and diagnostics.
[CONTRIBUTING.md](../../../CONTRIBUTING.md) owns changed-path and CI tiers.

## Workflow

1. Apply [coverage selection](../../../tests/e2e/README.md#choosing-browser-coverage) to establish the distinct browser risk before adding a test.
2. Use CI results while iterating. Run browser or Electron tests locally only when the user explicitly requests local execution. Use the failure digest when the cause is unclear, or open an existing trace for a specific hypothesis.

For authoring/debugging browser tests use this skill; for gating edited work use `verifier`. Keep mechanics in the canonical README; update this skill only when the task-selection or execution strategy changes.
