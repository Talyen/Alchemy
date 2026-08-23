/**
 * Deterministic placeholder RNG for UI-only default battle states.
 * Do NOT use it for production turn/battle outcomes — use state.rng or
 * getBattleRng(state) with an injected battle stream.
 *
 * Note: returning 0 means every percent roll against it SUCCEEDS (rng() < N%),
 * including the global crit chance — previews built on this bias toward
 * triggering procs. Tests wanting the opposite use a () => 0.99 rng.
 */
export const placeholderRng: () => number = () => 0;
