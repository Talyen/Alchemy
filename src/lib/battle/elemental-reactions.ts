import type { CardEffectResolutionContext } from "./effect-handlers/handler-types";
import type { BattleSnapshot, BattleState, CombatTextEvent } from "./types";
import type { DamageType } from "@/lib/game-data";
import { REACTION_DEFINITIONS, type ReactionId } from "./reaction-definitions";
import { getReactionBonus } from "./elemental-reaction-state";
import { getBattleOutcome } from "./battle-outcome";
import { mergeCombatText } from "./combat-text-events";
import { damageEnemyHealth } from "./health-state";
import { applyHitEpilogue } from "./player-rewards";
import { decayArmorAfterDamage } from "./status-helpers";

type ReactionDamageKey = "shatterDamage" | "frostfireDamage" | "thunderclapDamage" | "wildfireDamage";
export interface ReactionPayoff {
  id: ReactionId;
  damage: number;
}
const STORED_REACTION_KEYS: Partial<Record<ReactionId, ReactionDamageKey>> = {
  shatter: "shatterDamage",
  frostfire: "frostfireDamage",
  thunderclap: "thunderclapDamage",
  wildfire: "wildfireDamage",
};
function announceReaction(texts: CombatTextEvent[], id: ReactionId) {
  const { text, stat } = REACTION_DEFINITIONS[id];
  mergeCombatText(texts, { target: "enemy", kind: "notice", signal: "reaction", reactionId: id, text, stat });
}

export function canInitiateElementalReaction(state: BattleState, context?: CardEffectResolutionContext): boolean {
  return (
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
  after: BattleSnapshot,
  damageType: DamageType,
  healthDamage: number,
): ReactionPayoff[] {
  const payoffs: ReactionPayoff[] = [];
  const frozenBefore = before.enemyCC.freezeSkipTurns > 0;
  if (
    (damageType === "burn" && frozenBefore && healthDamage > 0) ||
    (damageType === "freeze" && !frozenBefore && after.enemyCC.freezeSkipTurns > 0 && before.enemyStatuses.burn > 0)
  ) {
    const damage = damageType === "freeze" ? after.reactions.frostfireDamage : before.reactions.frostfireDamage;
    if (damage > 0) payoffs.push({ id: "frostfire", damage });
  }
  if (damageType === "nature" && healthDamage > 0) {
    if (before.enemyCC.stunSkipTurns > 0 && before.reactions.thunderclapDamage > 0)
      payoffs.push({ id: "thunderclap", damage: before.reactions.thunderclapDamage });
    if (before.reactions.wildfireDamage > 0) payoffs.push({ id: "wildfire", damage: before.reactions.wildfireDamage });
  }
  if (damageType === "burn" && healthDamage > 0 && before.enemyStatuses.burn === 0 && before.enemyStatuses.poison > 0)
    // A positive Burn hit adds buildup before its riders; Combustion can consume it again.
    payoffs.push({ id: "venomflash", damage: getReactionBonus(before.enemyStatuses.poison) });
  return payoffs;
}

export function applyShatter(state: BattleState, texts: CombatTextEvent[]): BattleState {
  const { block, armor } = state.enemyMitigation;
  const next = {
    ...state,
    enemyMitigation: { ...state.enemyMitigation, block: 0, armor: 0 },
    reactions: { ...state.reactions, shatterDamage: 0 },
  };
  announceReaction(texts, "shatter");
  if (block > 0)
    mergeCombatText(texts, { target: "enemy", kind: "damage", stat: "block", amount: block, impact: false });
  if (armor > 0)
    mergeCombatText(texts, { target: "enemy", kind: "damage", stat: "armor", amount: armor, impact: false });
  return next;
}

export function consumeReactionOpportunity(state: BattleState, id: ReactionId): BattleState {
  const key = STORED_REACTION_KEYS[id];
  return key ? { ...state, reactions: { ...state.reactions, [key]: 0 } } : state;
}

/** An already-scaled bonus: no mitigation, Critical, buildup, or attack riders. */
export function applyElementalReactionDamage(
  state: BattleState,
  payoff: ReactionPayoff,
  texts: CombatTextEvent[],
): BattleState {
  if (getBattleOutcome(state) !== null || payoff.damage <= 0) return state;
  const marked = consumeReactionOpportunity(state, payoff.id);
  const feedback = REACTION_DEFINITIONS[payoff.id];
  if (payoff.id !== "shatter") announceReaction(texts, payoff.id);
  const hit = damageEnemyHealth(marked, payoff.damage);
  const damaged = decayArmorAfterDamage(hit.state, payoff.damage, "enemy", texts);
  mergeCombatText(texts, {
    target: "enemy",
    kind: "damage",
    stat: feedback.stat,
    amount: payoff.damage,
    additive: false,
    reactionId: payoff.id,
    ...(hit.healthDamage !== payoff.damage ? { healthLost: hit.healthDamage } : {}),
  });
  return applyHitEpilogue(
    damaged,
    hit.previousHealth,
    hit.enemyWasAlive,
    texts,
    state.enemyStatuses,
    state.playerStatuses.forge >= 5,
  );
}
