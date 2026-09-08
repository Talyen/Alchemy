import { isPlayerDefeated } from "@/lib/battle";
import type { CharacterId } from "@/lib/game-data";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { GameplayState } from "./gameplay-state-store";

export interface GearCombatRestrictions {
  characters: Partial<Record<CharacterId, ContentSystemId[]>>;
  gear: Record<string, CharacterId>;
  trinkets: Record<string, CharacterId>;
}

export function deriveGearCombatRestrictions(
  state: Pick<GameplayState, "run" | "session" | "battle" | "gear">,
): GearCombatRestrictions {
  const characters: GearCombatRestrictions["characters"] = {};
  const foregroundMode = state.session.hasActiveRun ? state.run.activeRun.contentSystemType : null;
  if (foregroundMode && state.battle.hasActiveBattle) {
    characters[state.run.activeRun.characterId] = [foregroundMode];
  }
  for (const [mode, run] of Object.entries(state.run.parkedRuns)) {
    if (mode === foregroundMode || !run?.activeCombat) continue;
    const battle = run.activeCombat.battleState;
    if (battle.enemyHealth <= 0 || isPlayerDefeated(battle)) continue;
    const modes = characters[run.characterId] ?? [];
    characters[run.characterId] = [...modes, run.contentSystemType];
  }
  const gear: GearCombatRestrictions["gear"] = {};
  const trinkets: GearCombatRestrictions["trinkets"] = {};
  for (const characterId of Object.keys(characters) as CharacterId[]) {
    for (const instanceId of Object.values(state.gear.loadouts[characterId])) {
      if (instanceId) gear[instanceId] = characterId;
    }
    const trinketId = state.gear.equippedTrinkets[characterId];
    if (trinketId) trinkets[trinketId] = characterId;
  }
  return { characters, gear, trinkets };
}
