---
status: complete
updated: 2026-09-22
---

# Controller support implementation record

Implemented the game-side, hardware-free scope of the controller support plan.
The game continues to consume mouse and keyboard events; Steam Input translates
physical controllers into these existing interfaces. No runtime dependency,
controller settings screen, virtual-device driver, native Linux build, or
additional CI service was introduced.

## Delivered behavior

- Keyboard screen changes recover focus after screen/artwork readiness; pointer
  navigation does not request this recovery.
- After keyboard card play, focus continues to the next playable card, then a
  preceding/newly drawn playable card, and finally End Turn. Recovery waits for
  card transfer and activation animation completion. Existing rapid manual play
  during transfers is preserved.
- Held Enter/Space cannot repeatedly activate the next card or a new screen.
- Hand previews persist when the mouse leaves a keyboard-focused card. Pointer
  plays do not steal focus.
- Dialogs filter unavailable focus targets, restore their opener, and recover into
  the active screen when the opener disappeared.
- Options and Armory dropdowns register with the Escape stack. Back closes the
  dropdown before it can navigate away from the screen.
- Cards expose gameplay availability through aria-disabled without losing their
  inspection behavior.

The canonical behavior and ownership are documented in
[UI interaction](../../UI_INTERACTION.md#keyboard-and-steam-input-navigation).
The [release setup](../../RELEASE_SETUP.md#steam-input-default-mapping-controller-playable)
owns the intended mapping and clearly separates proposed mappings from published
and hardware-validated configurations.

## Automated protection

[Controller input](../../../tests/e2e/controller-input.ts) uses actual Playwright
keyboard and mouse events, with bounded focus traversal and cycle diagnostics.
It cannot bypass focus by invoking handlers, clicking a keyboard target, or
programmatically focusing it. Fixtures establish deterministic initial state only.

The existing browser suites now cover continuous menu-to-battle and
battle-to-reward/destination journeys, consecutive card focus, held-confirm timing,
Options sliders/selects/dialogs, Shop purchases, Campfire, Corruption, Talents,
Armory, Collection, Labyrinth, Wish choices, and a real cursor/wheel scroll flow.
The shared Options journey also runs in Electron with preview and packaged
renderers. Existing critical, full/nightly, and desktop tiers collect these tests.
No meaningful protection was retired: menu anchoring assertions moved from the
keyboard spec to its existing menu-navigation journey.

Deck-size coverage exercises 1280×720 and 1280×800, including hand previews,
Options, confirmation dialogs, Wish choices, and dense enemy details. Captures
are retained under ignored `reports/controller-support/`. Representative images
were visually inspected. Text measurements describe rendered CSS font sizes,
not physical glyph heights or a Valve certification result.

## Verification evidence

- Task-scoped `npm run check -- <task-owned paths>` passed in run
  `check-20260922t052346z-86313-94b29e`: 290 related unit tests, 14 changed unit tests
  (overlapping coverage), CI static checks, web build, bundle budget, and preview
  smoke. The handoff gate is repeated for subsequent test/documentation edits.
- Full touched-browser batch: 96 of 97 passed with two workers in run
  `playwright-20260922t052457z-87018-8cec39`. The existing small-viewport Talents
  layout test failed while entering Talents from the menu. It passed in isolation;
  the exact cause remains unconfirmed. This batch is not recorded as a clean pass.
- The subsequent focused batch passed all four tests: menu-to-battle focus,
  consecutive plays/menu Escape, menu anchoring, and the Talents layout test
  (`playwright-20260922t052758z-87851-36e39f`).
- The final six keyboard journeys passed, including cancellation of pending focus
  when Escape opens the menu during card activation
  (`playwright-20260922t053206z-6523-a37307`).
- Stronger Wish description assertions passed at all three tested resolutions
  (`playwright-20260922t052903z-88804-ee9341`).
- `npm run build:desktop` passed, then
  `npm run test:ship:desktop -- tests/electron/electron-smoke.spec.ts --grep 'mapped controller'`
  passed both tests on macOS. The packaged case used `alchemy://` assets with an
  isolated Electron profile; this was not a Windows executable or Proton test.
- Agent-browser independently loaded the menu, reported no page errors, and
  captured `reports/controller-support/browser-smoke.png`.

Existing unrelated UI/test edits were preserved. No commit, push, or release was
performed.

## External evidence still unavailable

The completed result is **game-side Steam Input compatibility tested with
automated mouse/keyboard input**. No authenticated Steam layout publication was
performed and no actual configuration IDs were verified. Physical-controller
comfort, Bluetooth/reconnect behavior, actual Steam translation/delivery, Proton,
Deck performance and suspend/resume, and Valve's rating remain unverified.
These are explicit evidence limits, not manual tasks required of the user to
complete this implementation.
