// Rebind live-run HP and in-combat manifests from profile-lifetime meta (gear, talents, homestead).
import { computeTalentEffects, computeStartingMaxHealth } from "@/lib/game-data";
import { mergeIntoManifest } from "@/lib/homestead/effects";
import { computeGearManifest, flattenGearInventories } from "@/lib/gear";
import type { GameplayDraft } from "./run-session-command";
import { syncBattleGoldFromPurse } from "./gold-purse";
import { combineTrinketEffectIds, computeTrinketManifest } from "@/lib/trinkets";

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
  // runMetaMaxHealth is always a positive baseline: seeded at run start or shimmed
  // from legacy 0 values by normalizeActiveRunData.
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
  // Homestead max-health always recomputed (gear + homestead tally). Battle
  // manifests are guarded by dirty flags to skip unchanged recomputes.
  // `undefined` means recompute (previous behavior) for backward compat.
  const gearChanged = options?.gearChanged ?? true;
  const talentChanged = options?.talentChanged ?? true;
  applyDerivedMaxHealth(draft);
  if (!draft.battle.hasActiveBattle) return;

  const characterId = draft.run.activeRun.characterId;
  const battle = draft.battle.battleState;
  if (gearChanged) {
    battle.gearEffects = computeGearManifest(
      characterId,
      flattenGearInventories(draft.gear.inventories),
      draft.gear.loadouts,
    );
    battle.trinketEffects = computeTrinketManifest(
      combineTrinketEffectIds(draft.run.activeRun.runBoons, draft.gear.equippedTrinkets[characterId]),
    );
  }
  if (talentChanged) {
    battle.talentEffects = mergeIntoManifest(
      computeTalentEffects(draft.runProfile.unlockedTalents),
      draft.runProfile.effects,
    );
  }
  battle.playerMaxHealth = draft.run.activeRun.runMaxHealth;
  battle.playerHealth = Math.min(battle.playerMaxHealth, battle.playerHealth);
  syncBattleGoldFromPurse(draft);
}
