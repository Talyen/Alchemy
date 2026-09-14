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
2. Use the shared browser fixture. Keep real timing for animation/boot behavior; request fast combat only for gameplay flows where timing is not under test.
3. Reach targeted state with the documented injector or page object. Preserve legitimate player actions for the behavior under test; do not add production-hidden QA controls.
4. Use semantic locators and deterministic waits. Keep animation coverage on real timing and fast combat only in fixture-backed flow tests.
5. Run the narrow spec while iterating. Use the failure digest when the cause is unclear, or open a relevant trace directly for a specific hypothesis.

Keep mechanics in the canonical README; update this skill only when the task-selection or execution strategy changes.
