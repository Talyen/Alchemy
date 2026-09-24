import { beneficialPlayerStatusIds } from "@/lib/game-data";
import { getBattleRng, pickRandom } from "@/lib/rng";
import { removePlayerArmor } from "./status-helpers";
import { setPlayerStatus, type BattleState, type CombatTextEvent } from "./types";

export function purgeOnePlayerBenefit(
  state: BattleState,
  combatTexts: CombatTextEvent[],
): { state: BattleState; purged: boolean } {
  const candidates = beneficialPlayerStatusIds.filter((stat) => state.playerStatuses[stat] > 0);
  const target = pickRandom(candidates, getBattleRng(state));
  if (!target) return { state, purged: false };
  const nextState =
    target === "armor"
      ? removePlayerArmor(state, state.playerStatuses.armor, combatTexts)
      : setPlayerStatus(state, target, 0);
  combatTexts.push({ target: "player", kind: "notice", stat: target, text: "Purged", signal: "purge" });
  return { state: nextState, purged: true };
}
