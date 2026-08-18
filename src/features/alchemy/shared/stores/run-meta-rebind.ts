// Rebind live-run HP and in-combat manifests from profile-lifetime meta (gear, talents, homestead).
import { computeTalentEffects, computeStartingMaxHealth } from "@/lib/game-data";
import { mergeIntoManifest } from "@/lib/homestead/effects";
import { computeGearManifest, flattenGearInventories } from "@/lib/gear";
import type { GameplayDraft } from "./run-session-command";
import { syncBattleGoldFromPurse } from "./gold-purse";

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
  const metaBaseline = draft.run.activeRun.runMetaMaxHealth || derived;
  const combatBonus = Math.max(0, draft.run.activeRun.runMaxHealth - metaBaseline);
  draft.run.activeRun.runMetaMaxHealth = derived;
  draft.run.activeRun.runMaxHealth = Math.max(1, derived + combatBonus);
  draft.run.activeRun.runPlayerHealth = Math.min(draft.run.activeRun.runMaxHealth, draft.run.activeRun.runPlayerHealth);
}

export function rebindLiveRunMeta(draft: GameplayDraft): void {
  if (!draft.session.hasActiveRun) return;
  applyDerivedMaxHealth(draft);
  if (!draft.battle.hasActiveBattle) return;

  const characterId = draft.run.activeRun.characterId;
  const gearEffects = computeGearManifest(
    characterId,
    flattenGearInventories(draft.gear.inventories),
    draft.gear.loadouts,
  );
  const talentEffects = mergeIntoManifest(
    computeTalentEffects(draft.runProfile.unlockedTalents),
    draft.runProfile.effects,
  );
  const battle = draft.battle.battleState;
  battle.gearEffects = gearEffects;
  battle.talentEffects = talentEffects;
  battle.playerMaxHealth = draft.run.activeRun.runMaxHealth;
  battle.playerHealth = Math.min(battle.playerMaxHealth, battle.playerHealth);
  syncBattleGoldFromPurse(draft);
}
