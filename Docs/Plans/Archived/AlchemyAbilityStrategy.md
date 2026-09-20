---
status: complete
updated: 2026-09-20
---

# Strategic cards and consolidated feedback

Implement the approved Shield Bash, Maul, and Ice Shot revisions; icon-only
notices, immediate preparations, full effective healing feedback, and 250 ms
cross-action merging without restarting animation or lifetime. Keep other card
mechanics, complete saved cards, and unrelated work intact.

## Outcome

Implemented the three approved card revisions, shared actor-relative conditional
resolution, compatible saved-card handling, numeric upgrade/parity support, full
healing feedback, icon-only notices and preparations, and 250 ms cross-action
consolidation. Aggregation retains original clocks/IDs/expiry, reserves digit
width, preserves incoming impact/audio cues, and avoids merging fresh hits into
bursts selected for eviction. Other card mechanics and enemy repertoires remain.

Validation completed during iteration: related unit tests, save/persistence unit
tests, fake-clock merge regressions, catalog feedback coverage, and eight browser
animation checks covering desktop/ultrawide and reduced motion. Browser run:
`playwright-20260920t052932z-15807-a8fd59`. Live dev-page inspection showed no browser
errors; consolidated feedback screenshots were visually inspected. The final
task-scoped completion gate owns the final result.

The healing owner now supplies effective/restored/overflow amounts consistently.
Clean Slate uses the same effective amount, fixing missed overflow when current
Homestead healing bonuses create it. Autoplay reads conditional damage amounts
without changing its scoring weights.

## Focused balance comparison

The local artifact is `reports/strategic-cards-balance.json`. It compares old and
new definitions in the same current engine: 40 paired world seeds beginning at
1772, fixed eight-card Knight/Ranger/Druid decks, bare gear, early talents,
`greedy-effective-damage`, and depths 3 and 12. Forty-eight matchup/depth cells,
3,840 simulations total, no timeouts. This is a focused strategy/balance check,
not a claim about every player build.

Largest late-depth observations (wins out of 40):

| Deck   | Enemy       | Before | After |
| ------ | ----------- | ------ | ----- |
| Knight | Stone Titan | 39     | 9     |
| Knight | Stone Golem | 17     | 0     |
| Ranger | Iron Bear   | 17     | 36    |
| Ranger | Stone Titan | 17     | 35    |

Losing Shield Bash's defensive grant is a material cost in the tested Knight
build. These results are reported for follow-up; no unapproved magnitude changes,
other-card redesigns, enemy repertoire changes, or scoring-weight retunes were made.
