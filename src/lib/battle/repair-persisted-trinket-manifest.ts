// Recompute default trinket manifests from runBoons on mid-combat resume.
// Wire validation keeps structural defaults; domain repair lives next to battle start.
import { computeTrinketManifest, isDefaultTrinketManifest } from "@/lib/trinkets";

import type { BattleState } from "./types";

export function repairPersistedBattleBoonManifest(battleState: BattleState, runBoons: string[]): BattleState {
  if (runBoons.length === 0) return battleState;
  if (!isDefaultTrinketManifest(battleState.trinketEffects)) return battleState;
  return {
    ...battleState,
    trinketEffects: computeTrinketManifest(runBoons),
  };
}
