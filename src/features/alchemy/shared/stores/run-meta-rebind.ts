import { computeStartingMaxHealth } from "@/lib/game-data";
import { computeGearManifest, flattenGearInventories } from "@/lib/gear";
import type { GameplayDraft } from "./run-session-command";
import { syncBattleGoldFromPurse } from "./gold-purse";
import { computeTrinketManifest } from "@/lib/trinkets";
import { deriveCombatMeta } from "./combat-meta";

function computeDerivedRunMaxHealth(draft: GameplayDraft): number {
  const characterId = draft.run.activeRun.characterId;
  const gearBonus = computeGearManifest(
    characterId,
    flattenGearInventories(draft.gear.inventories),
    draft.gear.loadouts,
  ).maxHealth;
  return computeStartingMaxHealth(draft.runProfile.talentXP) + gearBonus + draft.runProfile.effects.runMaxHealthBonus;
}

function applyDerivedMaxHealth(draft: GameplayDraft): void {
  const derived = computeDerivedRunMaxHealth(draft);

  const metaBaseline = draft.run.activeRun.runMetaMaxHealth;
  const combatBonus = Math.max(0, draft.run.activeRun.runMaxHealth - metaBaseline);
  draft.run.activeRun.runMetaMaxHealth = derived;
  draft.run.activeRun.runMaxHealth = Math.max(1, derived + combatBonus);
  draft.run.activeRun.runPlayerHealth = Math.min(draft.run.activeRun.runMaxHealth, draft.run.activeRun.runPlayerHealth);
}

export function rebindLiveRunMeta(
  draft: GameplayDraft,
  options?: { gearChanged?: boolean; talentChanged?: boolean },
): void {
  if (!draft.session.hasActiveRun) return;

  const gearChanged = options?.gearChanged ?? true;
  const talentChanged = options?.talentChanged ?? true;
  applyDerivedMaxHealth(draft);
  if (!draft.battle.hasActiveBattle) return;

  const battle = draft.battle.battleState;
  const combatMeta = deriveCombatMeta(draft);
  if (gearChanged) {
    battle.gearEffects = combatMeta.gearEffects;
    battle.trinketEffects = computeTrinketManifest(combatMeta.activeTrinketIds);
  }
  if (talentChanged) {
    battle.talentEffects = combatMeta.talentEffects;
  }
  battle.playerMaxHealth = draft.run.activeRun.runMaxHealth;
  battle.playerHealth = Math.min(battle.playerMaxHealth, battle.playerHealth);
  syncBattleGoldFromPurse(draft);
}
