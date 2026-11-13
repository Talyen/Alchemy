import { computeStartingMaxHealth } from "@/lib/game-data";
import { computeTrinketManifest } from "@/lib/trinkets";
import type { GameplayDraft } from "../../session/gameplay-command";
import { deriveCombatMeta, type CombatMeta } from "../../session/combat-meta";
import { syncBattleGoldFromPurse } from "./run-gold";

export { deriveCombatMeta, type CombatMeta } from "../../session/combat-meta";

// ── Live meta rebind ─────────────────────────────────────────────────────────
// After gear/talent/homestead changes, refresh derived run Health and the live
// battle manifest in the same command. Skipped when no run is active.

function applyDerivedMaxHealth(draft: GameplayDraft, gearBonus: number): void {
  const derived =
    computeStartingMaxHealth(draft.runProfile.talentXP) + gearBonus + draft.runProfile.effects.runMaxHealthBonus;

  const metaBaseline = draft.run.activeRun.runMetaMaxHealth;
  const combatBonus = Math.max(0, draft.run.activeRun.runMaxHealth - metaBaseline);
  draft.run.activeRun.runMetaMaxHealth = derived;
  draft.run.activeRun.runMaxHealth = Math.max(1, derived + combatBonus);
  draft.run.activeRun.runPlayerHealth = Math.min(draft.run.activeRun.runMaxHealth, draft.run.activeRun.runPlayerHealth);
}

function rebindBattleState(draft: GameplayDraft, combatMeta: CombatMeta): void {
  if (draft.session.activity.kind !== "battle") return;
  const battle = draft.session.activity.data.battleState;
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
