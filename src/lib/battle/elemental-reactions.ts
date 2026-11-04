import { resolveReactionAction } from "./action-context";
import { REACTION_CONFIG } from "../game-constants";
import type { CardEffectResolutionContext } from "./effect-handlers/handler-types";
import type { BattleSnapshot, BattleState, CombatTextEvent } from "./types";
import type { DamageType } from "@/lib/game-data";
import { REACTION_DEFINITIONS, type ReactionId } from "./reaction-definitions";
import { getReactionBonus, isReactionDotPrepared, REACTION_DOT_KEYS } from "./elemental-reaction-state";
import { getBattleOutcome } from "./battle-outcome";
import { mergeCombatText, emitDamageText } from "./combat-text-events";
import { damageEnemyHealth } from "./health-state";
import { applyHitEpilogue } from "./player-rewards";
import { decayArmorAfterDamage } from "./status-helpers";
import { detonateEnemyStatuses, projectEnemyDotDamage, type EnemyDotStatus } from "./dot-resolve";
import { applyBlockReward } from "./player-rewards";
import { purgeEnemyBenefits, applyPurgeGearRewards } from "./enemy-purge";

type ReactionDamageKey = "shatterDamage" | "frostfireDamage" | "ruptureDamage";
export interface ReactionPayoff {
  id: ReactionId;
  damage: number;
}
const STORED_REACTION_KEYS: Partial<Record<ReactionId, ReactionDamageKey>> = {
  shatter: "shatterDamage",
  frostfire: "frostfireDamage",
  rupture: "ruptureDamage",
};
function announceReaction(texts: CombatTextEvent[], id: ReactionId) {
  const { text, stat } = REACTION_DEFINITIONS[id];
  mergeCombatText(texts, { target: "enemy", kind: "notice", signal: "reaction", reactionId: id, text, stat });
}

export function canInitiateElementalReaction(state: BattleState, context?: CardEffectResolutionContext): boolean {
  return (
    state.reactionSpent !== true &&
    (!state.action || state.action.source === "companion") &&
    (context?.origin === undefined ||
      context.origin === "played-card" ||
      context.origin === "triggered-card" ||
      context.origin === "companion")
  );
}
export function canShatter(state: BattleSnapshot): boolean {
  return state.enemyCC.freezeSkipTurns > 0 && state.reactions.shatterDamage > 0;
}

/** Eligibility precedes riders; only a Freeze packet itself can initiate Frostfire's infliction route. */
export function getPostHitReactionPayoffs(
  before: BattleSnapshot,
  after: BattleSnapshot & { reactionSpent?: boolean },
  damageType: DamageType,
  healthDamage: number,
): ReactionPayoff[] {
  if (after.reactionSpent) return [];
  if (
    damageType === "freeze" &&
    before.enemyCC.freezeSkipTurns === 0 &&
    after.enemyCC.freezeSkipTurns > 0 &&
    isReactionDotPrepared(before, "burn") &&
    after.reactions.frostfireDamage > 0
  )
    return [{ id: "frostfire", damage: after.reactions.frostfireDamage }];
  if (healthDamage <= 0) return [];
  if (
    damageType === "bleed" &&
    before.enemyCC.stunSkipTurns > 0 &&
    before.reactions.ruptureDamage > 0 &&
    isReactionDotPrepared(before, "bleed")
  )
    return [{ id: "rupture", damage: before.reactions.ruptureDamage }];
  if (damageType === "holy" && isReactionDotPrepared(before, "bleed"))
    return [{ id: "consecration", damage: getReactionBonus(before.reactions.naturalBleedDamage) }];
  if (damageType === "burn" && isReactionDotPrepared(before, "poison"))
    return [{ id: "venomflash", damage: getReactionBonus(before.reactions.naturalPoisonDamage) }];
  return [];
}

export function applyShatter(state: BattleState, texts: CombatTextEvent[]): BattleState {
  const { block } = state.enemyMitigation;
  const next = {
    ...state,
    reactionSpent: true,
    enemyMitigation: { ...state.enemyMitigation, block: 0 },
    reactions: { ...state.reactions, shatterDamage: 0 },
  };
  announceReaction(texts, "shatter");
  if (block > 0) emitDamageText(texts, "enemy", "block", block, { impact: false });
  return next;
}

export function consumeReactionOpportunity(state: BattleState, id: ReactionId): BattleState {
  const key = STORED_REACTION_KEYS[id];
  return key ? { ...state, reactions: { ...state.reactions, [key]: 0 } } : state;
}

export function reactionDotIngredients(id: ReactionId): EnemyDotStatus[] {
  switch (id) {
    case "frostfire":
      return ["burn"];
    case "rupture":
    case "consecration":
      return ["bleed"];
    case "toxicShock":
      return ["poison"];
    case "venomflash":
      return ["poison", "burn"];
    case "shatter":
      return [];
  }
}

export function projectReactionDamage(state: BattleState, payoff: ReactionPayoff): number {
  return reactionDotIngredients(payoff.id).reduce(
    (total, status) => total + projectEnemyDotDamage(state, status, "remaining-ticks"),
    payoff.damage,
  );
}

/** Native detonation pays its usual rewards; the additional bonus is already resolved. */
function resolveElementalReactionDamage(
  state: BattleState,
  payoff: ReactionPayoff,
  texts: CombatTextEvent[],
): BattleState {
  if (getBattleOutcome(state) !== null || payoff.damage <= 0 || (state.reactionSpent && payoff.id !== "shatter"))
    return state;
  let marked = { ...consumeReactionOpportunity(state, payoff.id), reactionSpent: true };
  if (payoff.id !== "shatter") announceReaction(texts, payoff.id);
  const ingredients = reactionDotIngredients(payoff.id);
  const reactions = { ...marked.reactions };
  for (const status of ingredients) reactions[REACTION_DOT_KEYS[status]] = 0;
  marked = { ...marked, reactions };
  const detonationTexts: CombatTextEvent[] = [];
  let damage = 0;
  let next = detonateEnemyStatuses(marked, ingredients, detonationTexts, "remaining-ticks", undefined, (amount) => {
    damage = amount;
  });
  for (const event of detonationTexts) {
    if (event.kind === "damage" && event.target === "enemy" && event.detonation) {
      mergeCombatText(texts, { ...event, reactionId: payoff.id, additive: false });
    } else mergeCombatText(texts, event);
  }
  if (getBattleOutcome(next) === null) {
    const hit = damageEnemyHealth(next, payoff.damage);
    damage += hit.healthDamage;
    next = decayArmorAfterDamage(hit.state, payoff.damage, "enemy", texts);
    emitDamageText(texts, "enemy", REACTION_DEFINITIONS[payoff.id].stat, payoff.damage, {
      additive: false,
      reactionId: payoff.id,
      healthLost: hit.healthDamage,
    });
    next = applyHitEpilogue(
      next,
      hit.previousHealth,
      hit.enemyWasAlive,
      texts,
      state.enemyStatuses,
      state.playerStatuses.forge >= 5,
    );
  }
  switch (payoff.id) {
    case "shatter":
      break;
    case "frostfire": {
      const armor = next.enemyMitigation.armor;
      next = { ...next, enemyMitigation: { ...next.enemyMitigation, armor: 0 } };
      if (armor > 0) emitDamageText(texts, "enemy", "armor", armor, { impact: false });
      break;
    }
    case "rupture":
      next = {
        ...next,
        reactions: {
          ...next.reactions,
          healingReductionTurns: Math.max(REACTION_CONFIG.ruptureTurns, next.reactions.healingReductionTurns),
        },
      };
      break;
    case "toxicShock":
      next = { ...next, reactions: { ...next.reactions, weakenNextAttack: true } };
      break;
    case "consecration":
      if (damage > 0 && next.playerHealth > 0)
        next = applyBlockReward(
          next,
          Math.max(1, Math.round(damage * REACTION_CONFIG.consecrationBlockFraction)),
          texts,
        );
      break;
    case "venomflash": {
      const purged = purgeEnemyBenefits(next, 1, texts);
      next = applyPurgeGearRewards(purged.state, purged.removed, texts);
      break;
    }
  }
  return next;
}

export function applyElementalReactionDamage(
  state: BattleState,
  payoff: ReactionPayoff,
  texts: CombatTextEvent[],
): BattleState {
  return resolveReactionAction(state, (current) => ({ state: resolveElementalReactionDamage(current, payoff, texts) }))
    .state;
}
