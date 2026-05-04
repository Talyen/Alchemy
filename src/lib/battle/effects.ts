import { ailmentStatusIds, cardLibrary, type BattleCard, type BattleCardEffect } from "@/lib/game-data";

import {
  baseEnemyHealth,
  maxPlayerHealth,
  type BattleState,
  type CombatTextEvent,
} from "./types";
import { BLEED_STATUS_MULTIPLIER, CRIT_MULTIPLIER, FREEZE_THRESHOLD_FRACTION, GLOBAL_CRIT_CHANCE, MIN_MAX_MANA_FLOOR, STUN_THRESHOLD_FRACTION, WISH_CHOICE_COUNT } from "../game-constants";

// Deduplicates combat text events by (target, kind, stat) so that three separate
// "physical damage" events from one card become a single "-15" instead of "-5 -5 -5".
// This is purely a display concern — amounts are accumulated in place.
export function mergeCombatText(combatTexts: CombatTextEvent[], nextEvent: CombatTextEvent) {
  const existingEvent = combatTexts.find(
    (event) => event.target === nextEvent.target && event.kind === nextEvent.kind && event.stat === nextEvent.stat,
  );

  if (existingEvent) {
    existingEvent.amount += nextEvent.amount;
    return;
  }

  combatTexts.push(nextEvent);
}

// Computes the raw damage before crit: card base + forge bonus (for physical/stun)
// + talent bonuses. Forge is a player status that accumulates per turn and
// specifically boosts physical and stun — other damage types don't benefit.
// The fromBlock path (Blessed Aegis) replaces the card's amount with the current
// block value, making block a damage source rather than just defense.
function computeBaseDamage(state: BattleState, effect: Extract<BattleCardEffect, { kind: "damage" }>) {
  const forgeBonus = effect.damageType === "physical" || effect.damageType === "stun" ? state.playerStatuses.forge : 0;
  let rawAmount = effect.fromBlock ? state.playerStatuses.block : effect.amount + forgeBonus;

  if (effect.damageType === "physical") {
    rawAmount += state.talentEffects.flatPhysicalDamage;
    if (state.talentEffects.armorToPhysicalDamage) {
      rawAmount += state.playerStatuses.armor;
    }
  }

  return Math.max(0, rawAmount);
}

// All damage has a flat 5% crit chance (doubles damage). Physical damage gets
// an additional chance from the physical-crit talent. We use Math.random here
// rather than a seeded RNG because crits are rare enough that replay
// determinism isn't a practical concern.
function applyCrit(damage: number, damageType: string, state: BattleState) {
  const physCritChance = damageType === "physical" ? state.talentEffects.physicalCritChance : 0;
  const totalChance = GLOBAL_CRIT_CHANCE + physCritChance;
  const isCrit = totalChance > 0 && Math.random() * 100 < totalChance;
  return isCrit ? damage * CRIT_MULTIPLIER : damage;
}

// Lifesteal only triggers on positive damage (edge case: a zero-damage hit with
// lifesteal shouldn't heal). We apply the combat text here so it appears as a
// separate "+X" heal popup alongside the damage number.
function applyLifesteal(state: BattleState, damage: number, combatTexts: CombatTextEvent[]) {
  if (damage <= 0) return state;
  mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: damage });
  return { ...state, playerHealth: Math.max(0, Math.min(maxPlayerHealth, state.playerHealth + damage)) };
}

// Secondary status effects triggered by specific damage types. Each type has
// distinct behavior: burn/poison stack additively (they're ticked separately in
// turns.ts), bleed doubles its stack and can lifesteal separately, and stun/freeze
// check a threshold to skip enemy turns. The threshold check uses the CURRENT
// enemy health (before this damage is applied) to determine if it's exceeded —
// this prevents killing an enemy with the same hit that stuns it.
function applyDamageStatuses(state: BattleState, effect: Extract<BattleCardEffect, { kind: "damage" }>, actualDamage: number) {
  const nextStatuses = { ...state.enemyStatuses };

  switch (effect.damageType) {
    case "burn":
      nextStatuses.burn += actualDamage;
      break;
    case "poison":
      nextStatuses.poison += actualDamage;
      break;
    case "bleed":
      nextStatuses.bleed += actualDamage * BLEED_STATUS_MULTIPLIER;
      if (effect.lifesteal) nextStatuses.bleedLeech += actualDamage * BLEED_STATUS_MULTIPLIER;
      break;
    case "stun":
      nextStatuses.stun += actualDamage;
      if (state.enemyHealth > 0 && nextStatuses.stun > state.enemyHealth * STUN_THRESHOLD_FRACTION) {
        nextStatuses.stun = 0;
        state.enemySkipTurns += 1;
      }
      break;
    case "freeze":
      nextStatuses.freeze += actualDamage;
      if (state.enemyHealth > 0 && nextStatuses.freeze >= state.enemyHealth * FREEZE_THRESHOLD_FRACTION) {
        nextStatuses.freeze = 0;
        state.enemySkipTurns += 1;
      }
      break;
  }

  return { ...state, enemyStatuses: nextStatuses };
}

// Full damage pipeline: base → crit → apply → status → lifesteal → combat text.
// Each step is a pure function that takes and returns BattleState, making the
// pipeline easy to extend with new modifiers (e.g. a "damage +50% this turn" buff).
function dealEnemyDamage(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  combatTexts: CombatTextEvent[],
) {
  const rawDamage = computeBaseDamage(state, effect);
  const finalDamage = applyCrit(rawDamage, effect.damageType, state);

  let nextState: BattleState = {
    ...state,
    enemyHealth: Math.max(0, Math.min(baseEnemyHealth, state.enemyHealth - finalDamage)),
  };

  nextState = applyDamageStatuses(nextState, effect, finalDamage);

  if (effect.lifesteal) {
    nextState = applyLifesteal(nextState, finalDamage, combatTexts);
  }

  if (finalDamage > 0) {
    mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: effect.damageType, amount: finalDamage });
  }

  return nextState;
}

// Ailments are negative player statuses (burn, poison, bleed, freeze, stun).
// remove-ailment can remove one (random first found) or all. The "one" mode
// iterates ailmentStatusIds in order so the first ailment found is removed —
// no player choice is involved for simplicity.
function removePlayerAilments(state: BattleState, mode: "one" | "all") {
  const nextPlayerStatuses = { ...state.playerStatuses };

  if (mode === "all") {
    ailmentStatusIds.forEach((statusId) => {
      nextPlayerStatuses[statusId] = 0;
    });

    return {
      ...state,
      playerStatuses: nextPlayerStatuses,
    };
  }

  const firstAilment = ailmentStatusIds.find((statusId) => nextPlayerStatuses[statusId] > 0);
  if (firstAilment) {
    nextPlayerStatuses[firstAilment] = 0;
  }

  return {
    ...state,
    playerStatuses: nextPlayerStatuses,
  };
}

// Iterates a card's effects and applies each one sequentially. Order matters:
// damage is applied before healing, which matters for lifesteal cards that
// deal damage then (potentially) kill the enemy before a "heal" effect runs.
// Effects are applied via reduce over the BattleState — each step gets the
// output of the previous step, so status interactions within the same card
// resolve left-to-right.
export function applyCardEffects(state: BattleState, card: BattleCard, combatTexts: CombatTextEvent[]) {
  return card.effects.reduce((currentState, effect) => {
    switch (effect.kind) {
      case "damage":
        return dealEnemyDamage(currentState, effect, combatTexts);
      case "player-status": {
        mergeCombatText(combatTexts, { target: "player", kind: "status", stat: effect.status, amount: effect.amount });
        return {
          ...currentState,
          playerStatuses: {
            ...currentState.playerStatuses,
            [effect.status]: currentState.playerStatuses[effect.status] + effect.amount,
          },
        };
      }
      case "heal":
        mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: effect.amount });
        return { ...currentState, playerHealth: Math.max(0, Math.min(maxPlayerHealth, currentState.playerHealth + effect.amount)) };
      case "restore-mana":
        mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "mana", amount: effect.amount });
        return { ...currentState, mana: currentState.mana + effect.amount };
      case "lose-mana":
        mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "mana", amount: effect.amount });
        return { ...currentState, mana: Math.max(0, currentState.mana - effect.amount) };
      case "gain-max-mana":
        mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "mana", amount: effect.amount });
        return { ...currentState, maxMana: currentState.maxMana + effect.amount };
      case "lose-max-mana":
        mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "mana", amount: effect.amount });
        // Floor of 1 prevents a softlock — with 0 max mana no card can ever be played.
        return { ...currentState, maxMana: Math.max(MIN_MAX_MANA_FLOOR, currentState.maxMana - effect.amount) };
      case "gain-gold":
        mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gold", amount: effect.amount });
        return { ...currentState, gold: currentState.gold + effect.amount };
      case "wish":
        // Wish excludes the played card itself (can't wish for a copy of the card
        // you just played) and offers a fixed 3 choices from the full card library.
        return { ...currentState, wishOptions: cardLibrary.filter((candidate) => candidate.id !== card.id).slice(0, WISH_CHOICE_COUNT) };
      case "remove-ailment":
        return removePlayerAilments(currentState, effect.mode);
      default:
        return currentState;
    }
  }, state);
}
