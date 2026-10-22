import type { BattleSnapshot, BattleResolutionContext } from "./types";

export function battleSnapshot(state: BattleSnapshot & Partial<BattleResolutionContext>): BattleSnapshot {
  const {
    // oxlint-disable-next-line alchemy/restricted-syntax -- Serialization removes the execution dependency without drawing it.
    rng: _rng,
    action: _action,
    onEmptyDraw: _onEmptyDraw,
    observer: _observer,
    sampleWishOptions: _sampleWishOptions,
    ...snapshot
  } = state;
  return snapshot;
}
