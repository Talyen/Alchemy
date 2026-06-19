/**
 * Non-seeded placeholder RNG for UI-only default battle states.
 * Do NOT import in production turn/battle logic — use state.rng or getBattleRng(state).
 * This export provides a named reference so the eslint Math.random rule
 * catches accidental usage outside the placeholder path.
 */
export const unsafeNonSeededRng: () => number = Math.random;
