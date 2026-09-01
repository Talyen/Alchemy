---
name: playwright-e2e
description: Browser automation, Playwright testing, and app verification skill for Alchemy. Auto-triggers when authoring, modifying, or debugging Playwright specs (*.spec.ts), controlling the game via browser fixtures/page objects, adding UI/journey test coverage, or triaging E2E failures.
---

# Playwright E2E & app control

Read [tests/e2e/README.md](../../../tests/e2e/README.md) before changing a spec;
it owns imports, fixtures, page objects, tags, helpers, and diagnostics.
[CONTRIBUTING.md](../../../CONTRIBUTING.md) owns changed-path and CI tiers.

## Workflow

1. Classify the test as animation/boot or gameplay flow, then use the canonical import and fixture selected by the E2E README.
2. Reach targeted state with the documented injector or page object. Preserve legitimate player actions for the behavior under test; do not add production-hidden QA controls.
3. Use semantic locators and deterministic waits. Keep animation coverage on real timing and fast combat only in fixture-backed flow tests.
4. Run the narrow spec while iterating, then the changed-path route. Read the bounded failure digest before opening a raw trace.

Keep mechanics in the canonical README; update this skill only when the task-selection or execution strategy changes.
