// Status effect application: damage-type riders, player status effects, stun resolution, and harmful removal.
import { drawCards } from "./draw";
import { harmfulPlayerStatusIds } from "@/lib/game-data";
import type { BattleCardEffect } from "@/lib/game-data/types";
import {
  addEnemyStatus,
  addGold,
  addPlayerStatus,
  adjustEnemyStatusDelta,
  applyPlayerHealing,
  clampHealth,
  isNullFieldActive,
  setEnemyStatus,
  setFlag,
  type BattleState,
  type CombatTextEvent,
} from "./types";
import { mergeCombatText } from "./combat-text";
import { applyLuckyCloverGold } from "./trinket-effects";
import {
  BLEED_STATUS_MULTIPLIER,
  FIRST_EFFECT_MULTIPLIER,
  FREE_CARD_SENTINEL,
  FREEZE_THRESHOLD_FRACTION,
  HALF_DIVISOR,
  PERCENT_DENOMINATOR,
  STUN_THRESHOLD_FRACTION,
  TRAIT_DAMAGE_RESISTANCE,
  TRAIT_DAMAGE_WEAKNESS,
} from "../game-constants";

// Returns the damage multiplier against the current enemy for a given damage type.
// Checks enemy traits (weakness = 2x, resistance = 0.5x) in priority order — first
// matching trait wins. Also checks stun/freeze skip for double-damage talents.
export function getEnemyDamageMultiplier(
  state: Pick<BattleState, "currentEnemy" | "enemyStunSkipTurns" | "enemyFreezeSkipTurns" | "talentEffects">,
  damageType: string,
): number {
  const traitIds = state.currentEnemy.traits.map((t) => t.id);
  if (traitIds.includes("brittle-bones") && (damageType === "holy" || damageType === "stun"))
    return TRAIT_DAMAGE_WEAKNESS;
  if (traitIds.includes("trinket-hoarder") && damageType === "burn") return TRAIT_DAMAGE_WEAKNESS;
  if (traitIds.includes("holy-vulnerability") && damageType === "holy") return TRAIT_DAMAGE_WEAKNESS;
  if (traitIds.includes("burn-resistance") && damageType === "burn") return TRAIT_DAMAGE_RESISTANCE;
  if (traitIds.includes("living-armor") && damageType === "bleed") return TRAIT_DAMAGE_RESISTANCE;
  if (traitIds.includes("thick-hide") && damageType === "physical") return TRAIT_DAMAGE_RESISTANCE;
  if (traitIds.includes("poison-resistance") && damageType === "poison") return TRAIT_DAMAGE_RESISTANCE;
  if (traitIds.includes("glacial-shell") && damageType === "freeze") return TRAIT_DAMAGE_RESISTANCE;
  if (traitIds.includes("glacial-shell") && damageType === "burn") return TRAIT_DAMAGE_WEAKNESS;
  if (state.enemyStunSkipTurns > 0 && state.talentEffects.stunDoubleDamage) return TRAIT_DAMAGE_WEAKNESS;
  if (state.enemyFreezeSkipTurns > 0 && state.talentEffects.freezeDoubleDamage) return TRAIT_DAMAGE_WEAKNESS;
  return 1;
}

// Checks if forge crossed the forge burn burst threshold and applies the burst if so.
// Extracted so the check fires for any forge source (card play, talent procs, etc.).
function applyForgeBurnBurst(state: BattleState, oldForge: number, newForge: number, combatTexts?: CombatTextEvent[]) {
  if (
    state.talentEffects.forgeBurnThreshold > 0 &&
    oldForge < state.talentEffects.forgeBurnThreshold &&
    newForge >= state.talentEffects.forgeBurnThreshold
  ) {
    const burnAmount = isNullFieldActive(state)
      ? Math.max(1, Math.round(state.talentEffects.forgeBurnDamage / 2))
      : state.talentEffects.forgeBurnDamage;
    state = {
      ...state,
      enemyStatuses: {
        ...state.enemyStatuses,
        burn: state.enemyStatuses.burn + burnAmount,
      },
    };
    if (combatTexts) {
      mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "burn", amount: burnAmount });
    }
  }
  return state;
}

// Shared stun trigger: checks if accumulated stun exceeds threshold and resolves
// the stun effect (reset stun, skip turns, draw, free card, thunderstone) when triggered.
export function resolveStunTrigger(state: BattleState, combatTexts?: CombatTextEvent[]) {
  const threshold = STUN_THRESHOLD_FRACTION - state.talentEffects.stunThresholdReduction;
  if (state.enemyHealth <= 0 || state.enemyStatuses.stun < state.enemyHealth * threshold) return state;

  // If CC immunity is active, clear the status without triggering a skip.
  if (state.enemyCCCooldown > 0) {
    return { ...state, enemyStatuses: { ...state.enemyStatuses, stun: 0 } };
  }

  let nextState = {
    ...state,
    enemyStatuses: { ...state.enemyStatuses, stun: 0 },
    enemyStunSkipTurns: state.enemyStunSkipTurns + 1 + state.talentEffects.stunDurationExtension,
    enemyCCCooldown: 2,
  };
  if (combatTexts) {
    mergeCombatText(combatTexts, { target: "enemy", kind: "notice", stat: "stun", text: "Stunned" });
  }
  if (nextState.talentEffects.drawOnStun > 0) {
    const draw = drawCards(
      nextState.deck,
      nextState.discard,
      nextState.hand,
      nextState.talentEffects.drawOnStun,
      nextState.nextCardUid,
    );
    nextState = {
      ...nextState,
      deck: draw.deck,
      discard: draw.discard,
      hand: draw.hand,
      nextCardUid: draw.nextCardUid,
    };
  }
  if (nextState.talentEffects.nextCardFreeOnStun) {
    nextState = setFlag(nextState, "nextCardCostReduction", FREE_CARD_SENTINEL);
  }

  if (nextState.talentEffects.blockOnStun > 0) {
    nextState = addPlayerStatus(nextState, "block", nextState.talentEffects.blockOnStun);
    if (combatTexts) {
      mergeCombatText(combatTexts, {
        target: "player",
        kind: "status",
        stat: "block",
        amount: nextState.talentEffects.blockOnStun,
      });
    }
  }

  if (nextState.talentEffects.forgeOnStun > 0) {
    const oldForge = nextState.playerStatuses.forge;
    const forgeAmount = nextState.talentEffects.forgeOnStun;
    nextState = addPlayerStatus(nextState, "forge", forgeAmount);
    nextState = applyForgeBurnBurst(nextState, oldForge, oldForge + forgeAmount, combatTexts);
    if (combatTexts) {
      mergeCombatText(combatTexts, {
        target: "player",
        kind: "status",
        stat: "forge",
        amount: forgeAmount,
      });
    }
  }

  if (nextState.talentEffects.stunStripArmor && nextState.enemyArmor > 0) {
    nextState = { ...nextState, enemyArmor: 0 };
  }

  if (nextState.talentEffects.manaOnStun > 0) {
    nextState = { ...nextState, mana: nextState.mana + nextState.talentEffects.manaOnStun };
    if (combatTexts) {
      mergeCombatText(combatTexts, {
        target: "player",
        kind: "status",
        stat: "mana",
        amount: nextState.talentEffects.manaOnStun,
      });
    }
  }

  if (nextState.trinketEffects.thunderstoneDamageOnStun > 0) {
    const dmg = nextState.trinketEffects.thunderstoneDamageOnStun;
    nextState = {
      ...nextState,
      enemyHealth: clampHealth(nextState.enemyHealth, -dmg, nextState.enemyMaxHealth),
    };
    if (combatTexts) {
      mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "nature", amount: dmg });
    }
    nextState = applyLuckyCloverGold(nextState, dmg, combatTexts ?? []);
  }

  return nextState;
}

// Applies status riders after an enemy is damaged: burn removes armor, poison adds bonus
// gold on first hit, bleed stacks damage and heals via leech, freeze adds stacks and
// checks for skip, stun checks threshold. Each damage type's rider is applied here.
export function applyDamageStatuses(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  actualDamage: number,
  combatTexts: CombatTextEvent[],
) {
  let nextState = state;
  const statusDamage = adjustEnemyStatusDelta(state, actualDamage);

  switch (effect.damageType) {
    case "burn": {
      nextState = addEnemyStatus(nextState, "burn", actualDamage);
      if (nextState.talentEffects.burnRemovesEnemyArmor) {
        nextState = { ...nextState, enemyArmor: Math.max(0, nextState.enemyArmor - actualDamage) };
      }
      break;
    }
    case "poison": {
      nextState = addEnemyStatus(nextState, "poison", actualDamage);
      if (
        actualDamage > 0 &&
        nextState.talentEffects.goldOnFirstPoison > 0 &&
        !nextState.flags.goldOnFirstPoisonThisCombat
      ) {
        nextState = setFlag(
          addGold(nextState, nextState.talentEffects.goldOnFirstPoison),
          "goldOnFirstPoisonThisCombat",
          true,
        );
        mergeCombatText(combatTexts, {
          target: "player",
          kind: "status",
          stat: "gold",
          amount: nextState.talentEffects.goldOnFirstPoison,
        });
      }
      break;
    }
    case "bleed": {
      const bleedAmount = statusDamage * BLEED_STATUS_MULTIPLIER;
      nextState = setEnemyStatus(nextState, "bleed", nextState.enemyStatuses.bleed + bleedAmount);
      if (
        bleedAmount > 0 &&
        (effect.lifesteal ||
          (nextState.talentEffects.bleedLeechChance > 0 &&
            Math.random() * PERCENT_DENOMINATOR < nextState.talentEffects.bleedLeechChance))
      ) {
        nextState = { ...nextState, pendingBleedLeechHealing: nextState.pendingBleedLeechHealing + bleedAmount };
      }
      if (
        actualDamage > 0 &&
        nextState.talentEffects.bleedPoisonChance > 0 &&
        Math.random() * PERCENT_DENOMINATOR < nextState.talentEffects.bleedPoisonChance
      ) {
        nextState = addEnemyStatus(nextState, "poison", actualDamage);
      }
      if (bleedAmount > 0 && nextState.trinketEffects.cutpurseGoldOnBleed > 0) {
        nextState = addGold(nextState, nextState.trinketEffects.cutpurseGoldOnBleed);
        mergeCombatText(combatTexts, {
          target: "player",
          kind: "status",
          stat: "gold",
          amount: nextState.trinketEffects.cutpurseGoldOnBleed,
        });
      }
      break;
    }
    case "stun": {
      nextState = addEnemyStatus(nextState, "stun", actualDamage);
      nextState = resolveStunTrigger(nextState, combatTexts);
      break;
    }
    case "freeze": {
      nextState = addEnemyStatus(nextState, "freeze", actualDamage);
      const isFreezeImmune = state.currentEnemy.traits.some((t) => t.id === "glacial-shell");
      const freezeThreshold = FREEZE_THRESHOLD_FRACTION - (state.talentEffects.freezeThresholdReduction ?? 0);
      if (
        !isFreezeImmune &&
        state.enemyHealth > 0 &&
        nextState.enemyStatuses.freeze >= state.enemyHealth * freezeThreshold
      ) {
        // If CC immunity is active, clear the status without triggering a skip.
        if (state.enemyCCCooldown > 0) {
          nextState = setEnemyStatus(nextState, "freeze", 0);
          break;
        }
        nextState = {
          ...setEnemyStatus(nextState, "freeze", 0),
          enemyFreezeSkipTurns: nextState.enemyFreezeSkipTurns + 1 + nextState.trinketEffects.freezeDurationExtension,
          enemyCCCooldown: 2,
        };
        mergeCombatText(combatTexts, { target: "enemy", kind: "notice", stat: "freeze", text: "Frozen" });
        if (nextState.trinketEffects.frozenHeartDamage > 0) {
          nextState = {
            ...nextState,
            enemyHealth: clampHealth(
              nextState.enemyHealth,
              -nextState.trinketEffects.frozenHeartDamage,
              nextState.enemyMaxHealth,
            ),
          };
          mergeCombatText(combatTexts, {
            target: "enemy",
            kind: "damage",
            stat: "physical",
            amount: nextState.trinketEffects.frozenHeartDamage,
          });
        }
      }
      break;
    }
  }

  return nextState;
}

// Removes harmful statuses (burn/poison/bleed/freeze/stun) in priority order, up to
// `amount`. Sin-Eater trinket heals the player proportional to the number removed.
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

  if (removed && nextState.trinketEffects.sinEaterHealOnHarmfulStatusRemove > 0) {
    nextState = applyPlayerHealing(nextState, nextState.trinketEffects.sinEaterHealOnHarmfulStatusRemove);
    if (combatTexts) {
      mergeCombatText(combatTexts, {
        target: "player",
        kind: "heal",
        stat: "health",
        amount: nextState.trinketEffects.sinEaterHealOnHarmfulStatusRemove,
      });
    }
  }

  return nextState;
}

export function applyPlayerStatusEffect(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "player-status" }>,
  combatTexts: CombatTextEvent[],
) {
  let amount = effect.amount;

  if (effect.status === "armor") {
    if (state.talentEffects.armorDoubledBelowHalfHealth && state.playerHealth <= state.playerMaxHealth / HALF_DIVISOR) {
      amount *= FIRST_EFFECT_MULTIPLIER;
    }
    if (state.talentEffects.firstArmorCardDoubled && !state.flags.firstArmorCardDoubledUsed) {
      amount *= FIRST_EFFECT_MULTIPLIER;
      state = setFlag(state, "firstArmorCardDoubledUsed", true);
    }
    const newArmor = state.playerStatuses.armor + amount;
    if (
      state.talentEffects.armorBlockThreshold > 0 &&
      state.playerStatuses.armor < state.talentEffects.armorBlockThreshold &&
      newArmor >= state.talentEffects.armorBlockThreshold
    ) {
      state = {
        ...state,
        playerStatuses: {
          ...state.playerStatuses,
          block: state.playerStatuses.block + state.talentEffects.armorBlockAmount,
        },
      };
      mergeCombatText(combatTexts, {
        target: "player",
        kind: "status",
        stat: "block",
        amount: state.talentEffects.armorBlockAmount,
      });
    }
  }

  if (effect.status === "block" && state.talentEffects.forgeToBlock) {
    amount += state.playerStatuses.forge;
  }

  if (effect.status === "forge") {
    const oldForge = state.playerStatuses.forge;
    state = applyForgeBurnBurst(state, oldForge, oldForge + amount, combatTexts);
  }

  mergeCombatText(combatTexts, { target: "player", kind: "status", stat: effect.status, amount });
  return addPlayerStatus(state, effect.status, amount);
}
