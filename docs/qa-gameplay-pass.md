# QA Gameplay Pass

Run this after every non-trivial UI or gameplay change.

## Automated pass

1. Run `npm run qa:gameplay`.
2. If a UI issue is easier to inspect visually, run `npm run test:e2e:headed`.
3. Review Playwright traces, screenshots, and videos on any failure.

## Manual smoke pass

1. Launch the game and verify the main menu is centered with no overlapping UI.
2. Open Collection and confirm cards fit within two rows, pagination works, and page 2 loads correctly.
3. Open Options and confirm only the main settings panel is present.
4. Start a Knight run and check character select cards fit without clipping at the bottom edge.
5. In battle, confirm art, status cards, piles, and hand all have clear separation with no overlap.
6. Play cards until no playable cards remain and confirm the turn advances automatically.
7. Win a battle and verify the destination screen appears and routes back into battle.

## Failure rule

If any screen visibly overlaps, clips, or misaligns, fix it before considering the change done. Treat the manual pass as required for layout work, not optional polish.