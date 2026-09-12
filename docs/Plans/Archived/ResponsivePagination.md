---
status: complete
updated: 2026-09-11
implementation: c2d06be6
---

# Responsive pagination

## Decision and rationale

Implemented in `c2d06be6`. Shared pagination arithmetic and transitions retain
valid browsing positions through resize, list changes, and tab changes. Grid
capacity derives from measured width and scale, preventing a previous artwork
shape's capacity from briefly controlling the next tab.

Collection previously corrected pages only locally, so returning to a tab
restored stale state. Output-only clamping also let removed pages reappear when
lists grew again. The shared owner retains corrections and notifies existing
page owners after commit without introducing a generic grid framework.

## Compatibility

Collection preserves per-tab memory and honors explicit parent page changes.
Armory resets on context changes. Selected or first-visible items anchor resize;
empty lists retain page zero and a usable capacity. Card pickers preserve filtered
indices and offered-choice counts. No save shape or game rule changed. Durable
behavior lives in [UI browsing](../../UI.md#collection-and-armory-browsing).

## Verification recorded at implementation

Regressions reproduced stale-page regrowth, Collection synchronization failures,
and invalid bounds. Focused tests covered StrictMode callback deduplication,
selection identity, list growth, and portrait/landscape capacity changes.

Four Chromium checks passed against development source: Collection resize/tab
round trips and three card-removal layouts. Runtime-error collectors were clean;
screenshots confirmed layout. Redundant Armory slicing/filler wrappers and their
duplicate tests were removed while preserving meaningful transition coverage.

Task-scoped handoff `check-20260907t184724z-15500-82ba27` passed unit, documentation,
CI static, web-build, and preview-smoke checks after a test-matcher typing fix.
A separate repository-wide closure check encountered another task's active overlay
plan; that unrelated work was preserved. Ordinary handoff now follows the
[current plan lifecycle](../README.md#task-handoff).
