// Recompute default trinket manifests from runTrinkets on mid-combat resume.
// Wire validation keeps structural defaults; domain repair lives next to battle start.
import { computeTrinketManifest, isDefaultTrinketManifest } from "@/lib/trinkets";

import type { BattleState } from "./types";

export function repairPersistedBattleTrinketManifest(battleState: BattleState, runTrinkets: string[]): BattleState {
  if (runTrinkets.length === 0) return battleState;
  if (!isDefaultTrinketManifest(battleState.trinketEffects)) return battleState;
  return {
    ...battleState,
    trinketEffects: computeTrinketManifest(runTrinkets),
  };
}
