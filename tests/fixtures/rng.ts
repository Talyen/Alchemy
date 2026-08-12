// Shared LCG constants for Vitest battle fixtures and Playwright E2E seeding.
export const LCG_MULTIPLIER = 1664525;
export const LCG_INCREMENT = 1013904223;

function createLcgRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * LCG_MULTIPLIER + LCG_INCREMENT) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

/** Seeded PRNG for battle unit tests (`createBattleState({ rng })`, talent rolls). */
export function seededRng(seed = 42): () => number {
  return createLcgRng(seed);
}

/** Sequential rolls, then 0.99 (no-proc) for talent/trinket chance tests. */
export function rngSequence(...values: number[]): () => number {
  let index = 0;
  return () => (index < values.length ? values[index++]! : 0.99);
}
