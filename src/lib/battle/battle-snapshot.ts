import type { BattleSnapshot, BattleResolutionContext } from "./types";

export function battleSnapshot(state: BattleSnapshot & Partial<BattleResolutionContext>): BattleSnapshot {
  // oxlint-disable-next-line alchemy/restricted-syntax -- Serialization removes the execution dependency without drawing it.
  const { rng: _rng, action: _action, ...snapshot } = state;
  return snapshot;
}
