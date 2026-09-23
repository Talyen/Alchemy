import { resolveSecondaryAction } from "./action-context";
import { beneficialPlayerStatusIds } from "@/lib/game-data";
import { getBattleRng, pickRandom } from "@/lib/rng";
import { BRAWLER_PENALTY_MULTIPLIER, ENEMY_ABILITY_TRAIT_REWARD, VAMPIRE_BLOOD_SCENT_DAMAGE } from "../game-constants";
import { recordEnemyAbilityActivation } from "./battle-metrics";
import { recordEnemyAbilityHit, type EnemyAbilityContext } from "./enemy-ability-context";
import { resolveEnemyAttackHit } from "./enemy-attack-hit";
import { resolveFollowUpHit } from "./follow-up-hit-resolution";
import { applyPlayerStatusFromAttack } from "./status-player";
import { removePlayerArmor } from "./status-helpers";
import {
  hasEnemyTrait,
  isPlayerDefeated,
  setEnemyStatus,
  setPlayerStatus,
  type BattleState,
  type CombatTextEvent,
} from "./types";

export function applyAbilityFollowups(
  state: BattleState,
  context: EnemyAbilityContext,
  combatTexts: CombatTextEvent[],
): BattleState {
  let nextState = state;
  if (context.vampireBonus) {
    nextState = recordEnemyAbilityActivation(nextState, "vampire");
    const result = resolveEnemyAttackHit(
      nextState,
      { kind: "damage", damageType: "bleed", amount: VAMPIRE_BLOOD_SCENT_DAMAGE },
      combatTexts,
      {
        canDodge: true,
        skipTraitReactions: true,
        traitSet: context.traitSet,
        amountMultiplier: context.brawlerPenalty ? BRAWLER_PENALTY_MULTIPLIER : 1,
      },
    );
    nextState = result.state;
    recordEnemyAbilityHit(context, result);
  }
  for (const [traitId, status] of [
    ["fire-imp", "burn"],
    ["giant-spider", "poison"],
  ] as const) {
    if (nextState.enemyHealth <= 0 || isPlayerDefeated(nextState)) return nextState;
    if (context.healthDamage > 0 && hasEnemyTrait(nextState, traitId, context.traitSet)) {
      nextState = applyPlayerStatusFromAttack(
        recordEnemyAbilityActivation(nextState, traitId),
        {
          kind: "player-status",
          status,
          amount: ENEMY_ABILITY_TRAIT_REWARD,
        },
        combatTexts,
      );
    }
  }
  if (nextState.enemyHealth <= 0 || isPlayerDefeated(nextState)) return nextState;
  if (context.healthDamage > 0 && hasEnemyTrait(nextState, "winter-wolf", context.traitSet)) {
    nextState = resolveEnemyAttackHit(
      recordEnemyAbilityActivation(nextState, "winter-wolf"),
      {
        kind: "damage",
        damageType: "freeze",
        amount: ENEMY_ABILITY_TRAIT_REWARD,
      },
      combatTexts,
      { canDodge: false, traitSet: context.traitSet },
    ).state;
  }
  if (nextState.enemyHealth <= 0 || isPlayerDefeated(nextState)) return nextState;
  if (context.landed && hasEnemyTrait(nextState, "banshee", context.traitSet)) {
    const purgeCandidates = beneficialPlayerStatusIds.filter((stat) => nextState.playerStatuses[stat] > 0);
    const purgeTarget = pickRandom(purgeCandidates, getBattleRng(nextState));
    if (purgeTarget) {
      nextState = recordEnemyAbilityActivation(nextState, "banshee");
      nextState =
        purgeTarget === "armor"
          ? removePlayerArmor(nextState, nextState.playerStatuses.armor, combatTexts)
          : setPlayerStatus(nextState, purgeTarget, 0);
      combatTexts.push({ target: "player", kind: "notice", stat: purgeTarget, text: "Purged", signal: "purge" });
    }
  }
  if (nextState.enemyStatuses.onAttackBleed > 0) {
    const amount = nextState.enemyStatuses.onAttackBleed;
    nextState = resolveFollowUpHit(
      setEnemyStatus(nextState, "onAttackBleed", 0),
      { source: "player-follow-up", damageType: "bleed", amount },
      combatTexts,
    );
  }
  if (nextState.enemyHealth <= 0 || isPlayerDefeated(nextState)) return nextState;
  // Purged Thorns stay purged: the retaliation check below sees zero stacks, so no Nature damage fires.
  if (context.landed && nextState.playerStatuses.thorns > 0) {
    const amount = nextState.playerStatuses.thorns;
    nextState = resolveSecondaryAction(setPlayerStatus(nextState, "thorns", 0), "retaliation", (current) =>
      resolveFollowUpHit(current, { source: "player-follow-up", damageType: "nature", amount }, combatTexts),
    );
  }
  return nextState;
}
