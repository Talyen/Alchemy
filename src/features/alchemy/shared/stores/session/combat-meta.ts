import { computeTalentEffects, type TalentEffectManifest } from "@/lib/game-data";
import { computeGearManifest, flattenGearInventories, type GearEffectManifest } from "@/lib/gear";
import { combineTrinketEffectIds } from "@/lib/trinkets";
import { computeTrinketManifest } from "@/lib/trinkets";
import type { RunCompanionInspectionState } from "@/lib/battle";
import { mergeIntoManifest } from "@/lib/homestead/effects";
import type { GameplayState } from "./gameplay-state";

export interface CombatMeta {
  talentEffects: TalentEffectManifest;
  gearEffects: GearEffectManifest;
  activeTrinketIds: string[];
}

/** Shared standing actor modifiers for battle initialization and non-combat inspection. */
export function deriveCombatMeta(state: Pick<GameplayState, "run" | "runProfile" | "gear">): CombatMeta {
  const run = state.run.activeRun;
  const characterId = run.characterId;
  return {
    talentEffects: mergeIntoManifest(computeTalentEffects(state.runProfile.unlockedTalents), state.runProfile.effects),
    gearEffects: computeGearManifest(characterId, flattenGearInventories(state.gear.inventories), state.gear.loadouts),
    activeTrinketIds: combineTrinketEffectIds(run.runBoons, state.gear.equippedTrinkets[characterId]),
  };
}

const companionInspectionCache = new WeakMap<
  GameplayState["gear"],
  { inputs: readonly unknown[]; value: RunCompanionInspectionState }
>();

/** Stable across unrelated session writes so shop/deck readers retain selective subscriptions. */
export function selectRunCompanionInspectionState(state: GameplayState): RunCompanionInspectionState {
  const run = state.run.activeRun;
  const inputs = [
    run.characterId,
    run.runBoons,
    run.runPlayerHealth,
    run.runMaxHealth,
    state.runProfile.unlockedTalents,
    state.runProfile.effects,
  ];
  const cached = companionInspectionCache.get(state.gear);
  if (cached && cached.inputs.every((input, index) => input === inputs[index])) return cached.value;
  const meta = deriveCombatMeta(state);
  const value = {
    talentEffects: meta.talentEffects,
    gearEffects: meta.gearEffects,
    trinketEffects: computeTrinketManifest(meta.activeTrinketIds),
    playerHealth: run.runPlayerHealth,
    playerMaxHealth: run.runMaxHealth,
  };
  companionInspectionCache.set(state.gear, { inputs, value });
  return value;
}
