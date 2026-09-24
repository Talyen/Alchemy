---
status: complete
updated: 2026-09-24
---

# App navigation module boundaries

## Objective

Make app-level navigation behavior easier to locate and change by separating
pure screen-routing policy, global keyboard subscriptions, and developer-only
actions from the navigation hooks. Runtime behavior and public import paths
remain unchanged.

## Plan

- [x] Move screen-back and return-target decisions into a pure policy module;
      keep policy tests focused on that module.
- [x] Move Escape-stack subscription logic into its own app hook module.
- [x] Move save reset and developer unlock behavior into its own hook module.
- [x] Keep app-shell exports stable and review the scoped diff.
- [x] Run the scoped handoff gate and diff checks.

## Completion

Implementation preserves app-shell's existing hook exports. The first scoped
handoff attempt caught a formatting issue in the barrel, which was corrected;
the final scoped gate result is recorded in the task handoff.

## Notes

Keep durable rules in their canonical owner. For test selection and task-owned handoff, follow [CONTRIBUTING](../../../CONTRIBUTING.md#what-to-run-when-you-change) and [the plan lifecycle](../README.md#task-handoff).
