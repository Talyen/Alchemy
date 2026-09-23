---
status: complete
updated: 2026-09-23
---

# Startup loading ownership

## Objective

Make the opening screen's reveal decision explicit and reliable when art or font loading fails, while preserving the existing progress, minimum duration, and background Gear art warming.

## Plan

- [x] Put readiness and eased progress transitions in a small pure startup state module. Keep browser timers, preloads, and React publication in the hook.
- [x] Route all art/font completion and failures through that state, and prevent callbacks from an unmounted hook from changing UI or launching deferred work.
- [x] Test reveal ordering, bootstrap changes, and preload failures; update the architecture owner and run the task-scoped handoff gate.

## Notes

Keep durable rules in their canonical owner. For test selection and task-owned handoff, follow [CONTRIBUTING](../../../CONTRIBUTING.md#what-to-run-when-you-change) and [the plan lifecycle](../README.md#task-handoff).
