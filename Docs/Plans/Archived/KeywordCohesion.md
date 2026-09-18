---
status: complete
updated: 2026-09-15
---

# Keyword Cohesion

## Decision

Adopt keyword cohesion for the 4 outlier talents (`Restock`, `Distillation`, `Brewmaster`, `Will to Live`), Bandit _Ambush_ and Banshee _Dread Wail_ wording, Predator's Focus Leech, and Maul "at random" clarification. Exclude Trinket-specific talent, card, affix, and Unique redesigns; Alchemy's 101 affixes and 5 Forge/Archery Uniques already carry keywords.

## Reason

Evaluated against a sibling Trinket keyword plan (outside this repo). Alchemy's 22 keyword pools, `keywordId`-bound affixes in `src/lib/gear/affix-catalog.ts`, and existing Unique identities made most Trinket changes inapplicable.

## Compatibility

No save or balance break. Predator's Focus pairs `next-hit-crit` with `next-hit-leech` (`nextHitLeech` consumed in `damage.ts`; dodge preserves it; companions and delayed pulses cannot consume it). Maul's corruption helper in `src/lib/corruption/numeric.ts` accepts the " at random" suffix. Cleanse text kept as-is under card-parity rules.

## Verification

`tests/lib/content-validation/`, `tests/architecture/` (affix/catalog guards), `tests/lib/battle/`, and `npm run content:audit` passed at implementation.

Implemented in `b3415e42`. Full rationale and audit tables remain in git history.
