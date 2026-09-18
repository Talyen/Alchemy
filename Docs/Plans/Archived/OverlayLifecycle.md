---
status: complete
updated: 2026-09-11
implementation: c2d06be6
---

# Overlay interaction lifecycle

## Decision and rationale

Implemented in `c2d06be6`. The shared overlay shell owns interaction eligibility
from open state, content mounting, and rendered presence. Closing visuals remain
for their fade but are inert and reject stale activation; hidden overlays do not
register Escape handlers. Reopening cancels pending removal.

Previously, pointer-only suppression left keyboard actions live during closing,
and `mount=false` could hide an overlay while it still intercepted Escape.
Central ownership removed GameMenu's redundant guard while preserving
consumer-specific safeguards such as Wish's selection latch.

## Compatibility

Confirmation focus containment pauses while content is inert and retains its
existing return target. Escape ordering, required Wish selection, animation
duration, and dismissal policies were preserved. The current and subsequently
refined contract lives in [UI overlay lifecycle](../../UI.md#overlay-lifecycle).

## Verification recorded at implementation

The baseline covered 29 tests in six files, and temporary diagnostics reproduced
closing-menu keyboard activation and hidden-overlay Escape interception. The
final component run passed 35 tests across seven files.

Three browser cases passed: closing-menu keyboard input, Options confirmation
focus containment/restoration, and Armory salvage focus restoration. An initial
attempt was disrupted by editing the running spec; the steady-source rerun passed.

Task-scoped handoff `check-20260907t190606z-21820-988671` passed related and changed
unit tests, documentation, CI static checks, the web build, and preview smoke.
