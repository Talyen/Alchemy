import { computeTalentEffects, type TalentEffectManifest } from "@/lib/game-data";
import { computeGearManifest, flattenGearInventories, type GearEffectManifest } from "@/lib/gear";
import { mergeIntoManifest } from "@/lib/homestead/effects";
import { combineTrinketEffectIds } from "@/lib/trinkets";
import type { GameplayDraft } from "./run-session-command";

export interface CombatMeta {
  talentEffects: TalentEffectManifest;
  gearEffects: GearEffectManifest;
  activeTrinketIds: string[];
}

export function deriveCombatMeta(draft: GameplayDraft): CombatMeta {
  const run = draft.run.activeRun;
  const characterId = run.characterId;
  return {
    talentEffects: mergeIntoManifest(computeTalentEffects(draft.runProfile.unlockedTalents), draft.runProfile.effects),
    gearEffects: computeGearManifest(characterId, flattenGearInventories(draft.gear.inventories), draft.gear.loadouts),
    activeTrinketIds: combineTrinketEffectIds(run.runBoons, draft.gear.equippedTrinkets[characterId]),
  };
}
