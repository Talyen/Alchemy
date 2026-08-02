/**
 * Deterministic placeholder RNG for UI-only default battle states.
 * Do NOT use it for production turn/battle outcomes — use state.rng or
 * getBattleRng(state) with an injected battle stream.
 */
export const placeholderRng: () => number = () => 0;
