import { computeTalentEffects, type TalentEffectManifest } from "@/lib/game-data";
import { computeGearManifest, flattenGearInventories, type GearEffectManifest } from "@/lib/gear";
import { combineTrinketEffectIds, computeTrinketManifest } from "@/lib/trinkets";
import { mergeIntoManifest } from "@/lib/homestead/effects";
import { computeRunMaxHealth } from "../../run-flow/run-max-health";
import type { GameplayDraft } from "../run-session-command";
import { syncBattleGoldFromPurse } from "./run-gold";

// ── Live meta rebind ─────────────────────────────────────────────────────────
// After gear/talent/homestead changes, refresh derived run Health and the live
// battle manifest in the same command. Skipped when no run is active.

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

function applyDerivedMaxHealth(draft: GameplayDraft, gearBonus: number): void {
  const derived = computeRunMaxHealth(draft.runProfile.talentXP, gearBonus, draft.runProfile.effects.runMaxHealthBonus);

  const metaBaseline = draft.run.activeRun.runMetaMaxHealth;
  const combatBonus = Math.max(0, draft.run.activeRun.runMaxHealth - metaBaseline);
  draft.run.activeRun.runMetaMaxHealth = derived;
  draft.run.activeRun.runMaxHealth = Math.max(1, derived + combatBonus);
  draft.run.activeRun.runPlayerHealth = Math.min(draft.run.activeRun.runMaxHealth, draft.run.activeRun.runPlayerHealth);
}

function rebindBattleState(draft: GameplayDraft, combatMeta: CombatMeta): void {
  if (!draft.battle.hasActiveBattle) return;
  const battle = draft.battle.battleState;
  battle.gearEffects = combatMeta.gearEffects;
  battle.trinketEffects = computeTrinketManifest(combatMeta.activeTrinketIds);
  battle.talentEffects = combatMeta.talentEffects;
  battle.playerMaxHealth = draft.run.activeRun.runMaxHealth;
  battle.playerHealth = Math.min(battle.playerMaxHealth, battle.playerHealth);
  syncBattleGoldFromPurse(draft);
}

export function rebindLiveRunMeta(draft: GameplayDraft): void {
  if (draft.session.activity.kind === "inactive") return;
  const combatMeta = deriveCombatMeta(draft);
  applyDerivedMaxHealth(draft, combatMeta.gearEffects.maxHealth);
  rebindBattleState(draft, combatMeta);
}
