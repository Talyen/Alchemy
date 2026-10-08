import { beneficialPlayerStatusIds } from "@/lib/game-data";
import { getBattleRng, pickRandom } from "@/lib/rng";
import { removePlayerArmor } from "./status-helpers";
import { applyBlockDepletionForgeReward } from "./status-player";
import { applyArmorLossAttackRetaliation } from "./player-defensive-reactions";
import type { BattleState, CombatTextEvent } from "./types";
import { setPlayerStatus } from "./status-state";

export function purgeOnePlayerBenefit(
  state: BattleState,
  combatTexts: CombatTextEvent[],
): { state: BattleState; purged: boolean } {
  const candidates = beneficialPlayerStatusIds.filter((stat) => state.playerStatuses[stat] > 0);
  const target = pickRandom(candidates, getBattleRng(state));
  if (!target) return { state, purged: false };
  let nextState =
    target === "armor"
      ? removePlayerArmor(state, state.playerStatuses.armor, combatTexts)
      : setPlayerStatus(state, target, 0);
  combatTexts.push({ target: "player", kind: "notice", stat: target, text: "Purged", signal: "purge" });
  if (target === "block") nextState = applyBlockDepletionForgeReward(state, nextState, combatTexts);
  // Both callers are enemy attack reactions. Capture the purged Armor before
  // Reactive Guard or Armored Surge can replace it.
  return {
    state: applyArmorLossAttackRetaliation(nextState, target === "armor" ? state.playerStatuses.armor : 0, combatTexts),
    purged: true,
  };
}
