import type { CharacterId } from "@/lib/game-data";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { GameplayState } from "./gameplay-state-store";

export interface GearCombatRestrictions {
  characters: Partial<Record<CharacterId, ContentSystemId[]>>;
  gear: Record<string, CharacterId>;
  trinkets: Record<string, CharacterId>;
}

// Two-tier lock policy (deliberate — see gear-combat-restrictions tests):
// equipped items and locked heroes are fully frozen, but an UNEQUIPPED item
// sitting in a locked hero's inventory may still be equipped elsewhere or
// acquired. It may NOT be salvaged or modified (see isInstanceLocked in
// gear-session-command, which extends this with the inventory-owner check).
// Do not "unify" the equip path onto isInstanceLocked: shared spares are
// intentionally equippable mid-battle without touching the live manifest.
export function deriveGearCombatRestrictions(state: {
  run: { activeRun: Pick<GameplayState["run"]["activeRun"], "characterId" | "contentSystemType"> };
  session: { activity: Pick<GameplayState["session"]["activity"], "kind"> };
  battle: Pick<GameplayState["battle"], "hasActiveBattle">;
  gear: Pick<GameplayState["gear"], "loadouts" | "equippedTrinkets">;
}): GearCombatRestrictions {
  const characters: GearCombatRestrictions["characters"] = {};
  const foregroundMode = state.session.activity.kind !== "inactive" ? state.run.activeRun.contentSystemType : null;
  if (foregroundMode && state.battle.hasActiveBattle) {
    characters[state.run.activeRun.characterId] = [foregroundMode];
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
