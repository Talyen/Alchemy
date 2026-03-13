# UI QA Process

This process creates visual artifacts and machine-checkable UI assertions so regressions can be caught without manual click-through QA every time.

## Command

- `npm run qa:visual`

## Output

- Screenshots: `screenshots/qa/*.png`
- JSON report: `screenshots/qa/report.json`
- Human-readable report: `screenshots/qa/report.md`

## Current Coverage

- Main menu, character select, battle, inventory modal, destination-derived screens (shop/alchemy/campfire), collection, talents, options.
- Directional check for combat sprites (player/enemy should face one another).
- Trinket rendering check in inventory modal:
  - Valid if empty-state text appears and no icons exist.
  - Valid if icons exist and all loaded images have non-zero dimensions.
- Destination reachability checks for Shop, Alchemy, and Campfire via preview destination rolls.

## Usage Notes

- Uses Playwright's configured `webServer`, so the app server is started automatically.
- This is not a visual diff baseline yet; it is a deterministic capture + assertion pass.
- If a check fails, inspect `screenshots/qa/report.md` first, then open the relevant image(s).

## Recommended Workflow

1. Run `npm run build:ui-strict`.
2. Run `npm run qa:visual`.
3. Run `npm run test:ui-guardrails`.
4. If any failure appears, inspect screenshot artifacts before merging.

## Why Overlap Bugs Previously Slipped Through

- The first guardrail regression focused on menu + character select only, not battle control placement.
- Runtime validation only compared `data-ui-boundary` nodes; interactive controls without `data-ui-control` tags were not checked for collisions.
- Visual QA captured battle, but initially did not assert geometric overlap between menu and pile controls.

## New Prevention Coverage

- Battle menu is anchored top-right to avoid sharing the discard pile region.
- Critical controls are tagged with `data-ui-control` so runtime diagnostics can detect control collisions.
- Runtime validator now emits `control-overlap` warnings when interactive controls overlap.
- Regression test now verifies menu vs draw/discard overlap at 800x600, 1280x720, and 1920x1080.
- Visual QA report includes a dedicated `combat-menu-pile-overlap` check.

## Critical Control Matrix

- Source of truth: `src/ui/qa/criticalControlMatrix.ts`
- Runtime diagnostics (`src/ui/debug/responsiveValidation.ts`) and Playwright visual/layout tests both consume this shared rule set.
- Add new selector pairs here when introducing critical controls (menu, turn controls, core pile buttons, etc.) so architecture and test enforcement stay in sync.
