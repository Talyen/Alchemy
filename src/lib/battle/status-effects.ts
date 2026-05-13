// Status effect application: damage-type riders, player status effects, stun resolution, and harmful removal.
import { drawCards } from "./draw";
import { harmfulPlayerStatusIds, type BattleCardEffect } from "@/lib/game-data";
import {
  type BattleState,
  type CombatTextEvent,
} from "./types";
import { mergeCombatText } from "./combat-text";
import {
  BLEED_STATUS_MULTIPLIER,
  FIRST_EFFECT_MULTIPLIER,
  FREE_CARD_SENTINEL,
  FREEZE_THRESHOLD_FRACTION,
  HALF_DIVISOR,
  PERCENT_DENOMINATOR,
  STUN_THRESHOLD_FRACTION,
} from "../game-constants";

export function getEnemyDamageMultiplier(state: BattleState, damageType: string): number {
  const traitIds = state.currentEnemy.traits.map((t) => t.id);
  if (traitIds.includes("brittle-bones") && (damageType === "holy" || damageType === "stun")) return 2;
  if (traitIds.includes("fear-the-light") && (damageType === "burn" || damageType === "holy")) return 2;
  if (traitIds.includes("holy-vulnerability") && damageType === "holy") return 2;
  if (traitIds.includes("burn-resistance") && damageType === "burn") return 0.5;
  if (traitIds.includes("poison-resistance") && damageType === "poison") return 0.5;
  if (traitIds.includes("glacial-shell") && damageType === "burn") return 2;
  return 1;
}

// Shared stun trigger: checks if accumulated stun exceeds threshold and resolves
// the stun effect (reset stun, skip turns, draw, free card) when triggered.
export function resolveStunTrigger(state: BattleState) {
  const threshold = STUN_THRESHOLD_FRACTION - state.talentEffects.stunThresholdReduction;
  if (state.enemyHealth <= 0 || state.enemyStatuses.stun <= state.enemyHealth * threshold) return state;

  let nextState = {
    ...state,
    enemyStatuses: { ...state.enemyStatuses, stun: 0 },
    enemyStunSkipTurns: state.enemyStunSkipTurns + 1 + state.talentEffects.stunDurationExtension,
  };
  if (nextState.talentEffects.drawOnStun > 0) {
    const draw = drawCards(nextState.deck, nextState.discard, nextState.hand, nextState.talentEffects.drawOnStun, nextState.nextCardUid);
    nextState = { ...nextState, deck: draw.deck, discard: draw.discard, hand: draw.hand, nextCardUid: draw.nextCardUid };
  }
  if (nextState.talentEffects.nextCardFreeOnStun) {
    nextState = { ...nextState, flags: { ...nextState.flags, nextCardCostReduction: FREE_CARD_SENTINEL } };
  }
  return nextState;
}

export function applyDamageStatuses(state: BattleState, effect: Extract<BattleCardEffect, { kind: "damage" }>, actualDamage: number, combatTexts: CombatTextEvent[]) {
  const nextStatuses = { ...state.enemyStatuses };
  let nextState: BattleState = { ...state, enemyStatuses: nextStatuses };

  switch (effect.damageType) {
    case "burn": {
      nextStatuses.burn += actualDamage;
      if (nextState.talentEffects.burnRemovesEnemyArmor) {
        nextState = { ...nextState, enemyArmor: Math.max(0, nextState.enemyArmor - actualDamage) };
      }
      break;
    }
    case "poison": {
      nextStatuses.poison += actualDamage;
      if (actualDamage > 0 && nextState.talentEffects.goldOnFirstPoison > 0 && !nextState.flags.goldOnFirstPoisonThisCombat) {
        nextState = {
          ...nextState,
          gold: nextState.gold + nextState.talentEffects.goldOnFirstPoison,
          flags: { ...nextState.flags, goldOnFirstPoisonThisCombat: true },
        };
        mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gold", amount: nextState.talentEffects.goldOnFirstPoison });
      }
      break;
    }
    case "bleed": {
      const bleedAmount = actualDamage * BLEED_STATUS_MULTIPLIER;
      nextStatuses.bleed += bleedAmount;
      if (bleedAmount > 0 && (effect.lifesteal || (nextState.talentEffects.bleedLeechChance > 0 && Math.random() * PERCENT_DENOMINATOR < nextState.talentEffects.bleedLeechChance))) {
        nextStatuses.bleedLeech += bleedAmount;
      }
      if (actualDamage > 0 && nextState.talentEffects.bleedPoisonChance > 0 && Math.random() * PERCENT_DENOMINATOR < nextState.talentEffects.bleedPoisonChance) {
        nextStatuses.poison += actualDamage;
      }
      if (bleedAmount > 0 && nextState.trinketEffects.cutpurseGoldOnBleed > 0) {
        nextState = {
          ...nextState,
          gold: nextState.gold + nextState.trinketEffects.cutpurseGoldOnBleed,
          enemyStatuses: nextStatuses,
        };
        mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gold", amount: nextState.trinketEffects.cutpurseGoldOnBleed });
      }
      break;
    }
    case "stun": {
      nextStatuses.stun += actualDamage;
      nextState = { ...nextState, enemyStatuses: nextStatuses };
      nextState = resolveStunTrigger(nextState);
      break;
    }
    case "freeze": {
      nextStatuses.freeze += actualDamage;
      const isFreezeImmune = state.currentEnemy.traits.some((t) => t.id === "glacial-shell");
      if (!isFreezeImmune && state.enemyHealth > 0 && nextStatuses.freeze >= state.enemyHealth * FREEZE_THRESHOLD_FRACTION) {
        nextStatuses.freeze = 0;
        nextState = { ...nextState, enemyStatuses: nextStatuses, enemyFreezeSkipTurns: nextState.enemyFreezeSkipTurns + 1 };
      }
      break;
    }
  }

  return nextState;
}

export function removeHarmfulPlayerStatuses(state: BattleState, amount: number, combatTexts?: CombatTextEvent[]) {
  const nextPlayerStatuses = { ...state.playerStatuses };
  let removed = 0;

  for (const statusId of harmfulPlayerStatusIds) {
    if (removed >= amount) break;
    if (nextPlayerStatuses[statusId] > 0) {
      nextPlayerStatuses[statusId] = 0;
      removed++;
    }
  }

  let nextState = {
    ...state,
    playerStatuses: nextPlayerStatuses,
  };

  if (removed && nextState.trinketEffects.sinEaterGoldOnHarmfulStatusRemove > 0) {
    nextState = {
      ...nextState,
      gold: nextState.gold + nextState.trinketEffects.sinEaterGoldOnHarmfulStatusRemove,
    };
    if (combatTexts) {
      mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gold", amount: nextState.trinketEffects.sinEaterGoldOnHarmfulStatusRemove });
    }
  }

  return nextState;
}

export function applyPlayerStatusEffect(state: BattleState, effect: Extract<BattleCardEffect, { kind: "player-status" }>, combatTexts: CombatTextEvent[]) {
  let amount = effect.amount;

  if (effect.status === "armor") {
    if (state.talentEffects.armorDoubledBelowHalfHealth && state.playerHealth <= state.playerMaxHealth / HALF_DIVISOR) {
      amount *= FIRST_EFFECT_MULTIPLIER;
    }
    if (state.talentEffects.firstArmorCardDoubled && !state.flags.firstArmorCardDoubledUsed) {
      amount *= FIRST_EFFECT_MULTIPLIER;
      state = { ...state, flags: { ...state.flags, firstArmorCardDoubledUsed: true } };
    }
    const newArmor = state.playerStatuses.armor + amount;
    if (state.talentEffects.armorBlockThreshold > 0 && state.playerStatuses.armor < state.talentEffects.armorBlockThreshold && newArmor >= state.talentEffects.armorBlockThreshold) {
      state = {
        ...state,
        playerStatuses: {
          ...state.playerStatuses,
          block: state.playerStatuses.block + state.talentEffects.armorBlockAmount,
        },
      };
      mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "block", amount: state.talentEffects.armorBlockAmount });
    }
  }

  if (effect.status === "block" && state.talentEffects.forgeToBlock) {
    amount += state.playerStatuses.forge;
  }

  if (effect.status === "forge") {
    const newForge = state.playerStatuses.forge + amount;
    if (state.talentEffects.forgeBurnThreshold > 0 && state.playerStatuses.forge < state.talentEffects.forgeBurnThreshold && newForge >= state.talentEffects.forgeBurnThreshold) {
      state = {
        ...state,
        enemyStatuses: {
          ...state.enemyStatuses,
          burn: state.enemyStatuses.burn + state.talentEffects.forgeBurnDamage,
        },
      };
      mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "burn", amount: state.talentEffects.forgeBurnDamage });
    }
  }

  mergeCombatText(combatTexts, { target: "player", kind: "status", stat: effect.status, amount });
  return {
    ...state,
    playerStatuses: {
      ...state.playerStatuses,
      [effect.status]: state.playerStatuses[effect.status] + amount,
    },
  };
}
