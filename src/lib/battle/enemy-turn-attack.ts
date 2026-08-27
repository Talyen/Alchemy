// Enemy attack resolution: damage, block, armor, and attack effect dispatch.
import {
  applyHealingWithCombatText,
  addPlayerStatusWithCombatText,
  addGoldWithCombatText,
  mergeCombatText,
} from "./combat-text";
import {
  applyPlayerStatusFromAttack,
  applyPlayerDamageStatuses,
  shouldBlockPreventStunBuildup,
  type DirectPlayerStatusAttackEffect,
} from "./status-player";
import { resolvePlayerCrowdControlTriggers } from "./status-cc";
import type { EnemyAttackEffect } from "@/lib/game-data";
import { logError } from "../error-logger";
import {
  applyPlayerCombatDamage,
  clampHealth,
  scaleReceivedPlayerDamage,
  type BattleState,
  type CombatTextEvent,
  type CombatTextStat,
} from "./types";
import { BATTLE_CONFIG, PERCENT_DENOMINATOR } from "../game-constants";
import { computeLeechHeal } from "./leech-heal";
import { checkHealthThresholds, isFreezeActiveForAspect } from "./enemy-turn-utils";
import { decayArmorAfterDamage } from "./status-helpers";
import { paceCombatMagnitude } from "./fight-pacing";
import { dealPlayerTypedHit } from "./player-typed-hit";
import { setEnemyStatus } from "./types/state-helpers";
import { takeRandomCardFromDeck } from "./draw";
import { applyCardEffects } from "./effect-handlers";
import { handlePostPlayCardDestination } from "./card-play";
import { tryDodgeEnemyAttackPacket } from "./dodge";
import { processCompanionTurnStart } from "./companion";

function isDirectPlayerStatusAttack(
  effect: Extract<EnemyAttackEffect, { kind: "player-status" }>,
): effect is DirectPlayerStatusAttackEffect {
  return effect.status !== "stun" && effect.status !== "freeze";
}

function applyPhysicalForgeBonus(state: BattleState, effect: EnemyAttackEffect & { kind: "damage" }) {
  if (effect.damageType !== "physical") return effect.amount;
  return effect.amount + state.enemyMitigation.forge + state.enemyPhysicalDamageBonus;
}

function computeEffectiveBlock(state: BattleState, effect: EnemyAttackEffect & { kind: "damage" }) {
  let effectiveBlock = state.playerStatuses.block;
  if (effect.damageType === "physical" && state.talentEffects.blockAbsorbPhysicalBonus > 0) {
    effectiveBlock = Math.round(
      effectiveBlock * (1 + state.talentEffects.blockAbsorbPhysicalBonus / PERCENT_DENOMINATOR),
    );
  }
  return effectiveBlock;
}

function computeMitigatedDamage(
  state: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  remainingDamage: number,
) {
  const armorMitigatesDamage = effect.damageType === "physical" || effect.damageType === "stun";
  const rawDamage = armorMitigatesDamage ? Math.max(0, remainingDamage - state.playerStatuses.armor) : remainingDamage;
  return scaleReceivedPlayerDamage(rawDamage, state.talentEffects, effect.damageType);
}

function computeIncomingEnemyAttackDamage(state: BattleState, effect: EnemyAttackEffect & { kind: "damage" }) {
  let remainingDamage = applyPhysicalForgeBonus(state, effect);
  if (state.gearEffects.damageReductionPerMana > 0) {
    const absorb = state.gearEffects.damageReductionPerMana * state.mana;
    remainingDamage = Math.max(0, remainingDamage - absorb);
  }
  if (state.enemyStatuses.poison > 0) {
    remainingDamage = Math.max(0, remainingDamage - state.talentEffects.poisonReducesEnemyDamage);
  }
  if (effect.damageType === "burn") {
    remainingDamage += state.enemyStatuses.burnBonus;
  }
  if (effect.damageType === "freeze") {
    remainingDamage += state.enemyStatuses.freezeBonus;
  }
  return paceCombatMagnitude(state, remainingDamage, "enemy");
}

function calculateBlockAndArmorMitigation(
  state: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  incomingDamage: number,
  combatTexts: CombatTextEvent[],
) {
  let remainingDamage = incomingDamage;
  const effectiveBlock = computeEffectiveBlock(state, effect);
  const blockAbsorb = Math.min(remainingDamage, effectiveBlock);
  remainingDamage -= blockAbsorb;
  if (blockAbsorb > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "block", amount: blockAbsorb });
  }
  const armorMitigatesDamage = effect.damageType === "physical" || effect.damageType === "stun";
  const armorAbsorb = armorMitigatesDamage ? Math.min(remainingDamage, state.playerStatuses.armor) : 0;
  const actualDamage = computeMitigatedDamage(state, effect, remainingDamage);
  return { remainingDamage, blockAbsorb, armorAbsorb, actualDamage };
}

function applyVanguardCrestAfterBlock(
  state: BattleState,
  blockAbsorb: number,
  remainingDamage: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (state.trinketEffects.vanguardCrestForgeOnBlockAbsorb <= 0 || blockAbsorb <= 0 || remainingDamage !== 0) {
    return state;
  }
  mergeCombatText(combatTexts, {
    target: "player",
    kind: "status",
    stat: "forge",
    amount: state.trinketEffects.vanguardCrestForgeOnBlockAbsorb,
  });
  return {
    ...state,
    playerStatuses: {
      ...state.playerStatuses,
      forge: state.playerStatuses.forge + state.trinketEffects.vanguardCrestForgeOnBlockAbsorb,
    },
  };
}

function applyEnemyForgeDecayOnHit(state: BattleState, actualDamage: number, damageType: string): BattleState {
  if (actualDamage <= 0 || damageType !== "physical" || state.enemyMitigation.forge <= 0) return state;
  return {
    ...state,
    enemyMitigation: {
      ...state.enemyMitigation,
      forge: Math.max(0, state.enemyMitigation.forge - BATTLE_CONFIG.FORGE_DECAY_AMOUNT),
    },
  };
}

function resolvePostDamageThresholds(
  state: BattleState,
  prevHealth: number,
  blockAbsorb: number,
  remainingDamage: number,
  actualDamage: number,
  damageType: string,
  combatTexts: CombatTextEvent[],
): BattleState {
  let nextState = applyVanguardCrestAfterBlock(state, blockAbsorb, remainingDamage, combatTexts);
  nextState = checkHealthThresholds(prevHealth, nextState.playerHealth, nextState, combatTexts);
  nextState = decayArmorAfterDamage(nextState, actualDamage, "player", combatTexts);
  nextState = applyEnemyForgeDecayOnHit(nextState, actualDamage, damageType);
  return nextState;
}

function applyDodgeDrawAndPlay(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (state.gearEffects.dodgeDrawAndPlay <= 0) return state;
  if (state.enemyHealth <= 0 || state.playerHealth <= 0) return state;

  const drawn = takeRandomCardFromDeck(state);
  if (!drawn) return state;

  let nextState: BattleState = {
    ...state,
    deck: drawn.deck,
    discard: drawn.discard,
    nextCardUid: drawn.nextCardUid,
  };

  const playContext = {
    manaAtStart: nextState.mana,
    enemyFreezeSkipTurnsAtStart: nextState.enemyCC.freezeSkipTurns,
  };

  nextState = applyCardEffects(nextState, drawn.card, combatTexts, playContext);
  nextState = handlePostPlayCardDestination(nextState, drawn.card, true, combatTexts);
  return nextState;
}

function applyOnPlayerDodge(state: BattleState, combatTexts: CombatTextEvent[], dodgedAmount: number): BattleState {
  let nextState = state;
  if (nextState.gearEffects.blockOnDodge > 0) {
    nextState = addPlayerStatusWithCombatText(nextState, "block", nextState.gearEffects.blockOnDodge, combatTexts);
  }
  if (nextState.talentEffects.blockOnDodgeEqualToAttack && dodgedAmount > 0) {
    nextState = addPlayerStatusWithCombatText(nextState, "block", dodgedAmount, combatTexts);
  }
  if (nextState.gearEffects.armorOnDodge > 0) {
    nextState = addPlayerStatusWithCombatText(nextState, "armor", nextState.gearEffects.armorOnDodge, combatTexts);
  }
  if (nextState.gearEffects.healOnDodge > 0) {
    nextState = applyHealingWithCombatText(nextState, nextState.gearEffects.healOnDodge, combatTexts);
  }
  if (nextState.gearEffects.physicalOnDodge > 0 && nextState.enemyHealth > 0) {
    nextState = dealPlayerTypedHit(nextState, "physical", nextState.gearEffects.physicalOnDodge, combatTexts);
  }
  if (nextState.talentEffects.physicalOnDodgeEqualToAttack && dodgedAmount > 0 && nextState.enemyHealth > 0) {
    nextState = dealPlayerTypedHit(nextState, "physical", dodgedAmount, combatTexts);
  }
  if (nextState.gearEffects.bleedOnDodge > 0 && nextState.enemyHealth > 0) {
    nextState = dealPlayerTypedHit(nextState, "bleed", nextState.gearEffects.bleedOnDodge, combatTexts);
  }
  if (nextState.talentEffects.goldOnDodge > 0) {
    nextState = addGoldWithCombatText(nextState, nextState.talentEffects.goldOnDodge, combatTexts);
  }
  if (nextState.gearEffects.nextAttackPhysicalOnDodge > 0) {
    nextState = {
      ...nextState,
      flags: {
        ...nextState.flags,
        nextHitPhysicalBonus: nextState.flags.nextHitPhysicalBonus + nextState.gearEffects.nextAttackPhysicalOnDodge,
      },
    };
  }
  if (nextState.gearEffects.nextAttackCritOnDodge > 0) {
    nextState = {
      ...nextState,
      flags: { ...nextState.flags, nextHitCrit: true },
    };
  }
  if (nextState.talentEffects.partingCutOnDodge) {
    nextState = { ...nextState, flags: { ...nextState.flags, nextPhysicalDealsBleed: true } };
  }
  if (nextState.talentEffects.nextArcheryCardFreeOnDodge) {
    nextState = { ...nextState, flags: { ...nextState.flags, nextArcheryCardFree: true } };
  }
  if (nextState.talentEffects.nextNatureCardFreeOnDodge) {
    nextState = { ...nextState, flags: { ...nextState.flags, nextNatureCardFree: true } };
  }
  if (nextState.talentEffects.companionAttacksOnDodge) {
    nextState = processCompanionTurnStart(nextState, combatTexts);
  }
  return applyDodgeDrawAndPlay(nextState, combatTexts);
}

function tryDodgeEnemyDamagePacket(
  state: BattleState,
  combatTexts: CombatTextEvent[],
  canDodge: boolean,
  dodgedAmount: number,
): BattleState | null {
  const dodged = tryDodgeEnemyAttackPacket(state, combatTexts, canDodge);
  if (!dodged) return null;
  return applyOnPlayerDodge(dodged, combatTexts, dodgedAmount);
}

export function applyEnemyLeechHealing(
  state: BattleState,
  actualDamage: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (isFreezeActiveForAspect(state, "regen")) return state;
  if (state.talentEffects.blockEnemyLeech) return state;
  const healAmount = computeLeechHeal(actualDamage);
  if (healAmount <= 0) return state;
  mergeCombatText(combatTexts, { target: "enemy", kind: "heal", stat: "health", amount: healAmount });
  return {
    ...state,
    enemyHealth: clampHealth(state.enemyHealth, healAmount, state.enemyMaxHealth),
  };
}

function recordPlayerHealthLost(
  prevHealth: number,
  nextState: BattleState,
  damageType: CombatTextStat,
  combatTexts: CombatTextEvent[],
) {
  const healthLost = prevHealth - nextState.playerHealth;
  if (healthLost > 0) {
    const stat = damageType === "physical" ? "health" : damageType;
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat, amount: healthLost });
  }
}

function applyBlockDepletedHeal(
  prevState: BattleState,
  nextState: BattleState,
  combatTexts: CombatTextEvent[],
): BattleState {
  let finalState = nextState;
  const healAmount = prevState.talentEffects.blockDepletedHeal + prevState.gearEffects.blockDepletedHeal;
  const isBlockDepleted = prevState.playerStatuses.block > 0 && nextState.playerStatuses.block <= 0;

  if (isBlockDepleted && healAmount > 0) {
    finalState = applyHealingWithCombatText(finalState, healAmount, combatTexts);
  }

  if (isBlockDepleted && prevState.gearEffects.stunOnBlockDepleted > 0 && finalState.enemyHealth > 0) {
    finalState = dealPlayerTypedHit(finalState, "stun", prevState.gearEffects.stunOnBlockDepleted, combatTexts);
  }

  if (
    isBlockDepleted &&
    prevState.gearEffects.saintfallRetribution > 0 &&
    !prevState.flags.saintfallRetributionTriggered &&
    finalState.enemyHealth > 0
  ) {
    finalState = {
      ...finalState,
      flags: {
        ...finalState.flags,
        saintfallRetributionTriggered: true,
      },
    };
    finalState = dealPlayerTypedHit(finalState, "holy", prevState.gearEffects.saintfallRetribution, combatTexts);
    finalState = dealPlayerTypedHit(finalState, "stun", prevState.gearEffects.saintfallRetribution, combatTexts);
    finalState = applyHealingWithCombatText(finalState, prevState.gearEffects.saintfallRetribution, combatTexts);
  }

  return finalState;
}

export function processEnemyDamageEffect(
  state: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  combatTexts: CombatTextEvent[],
  options?: { canDodge?: boolean },
) {
  const incomingDamage = computeIncomingEnemyAttackDamage(state, effect);
  const dodged = tryDodgeEnemyDamagePacket(state, combatTexts, options?.canDodge === true, incomingDamage);
  if (dodged) return dodged;

  const { remainingDamage, blockAbsorb, actualDamage } = calculateBlockAndArmorMitigation(
    state,
    effect,
    incomingDamage,
    combatTexts,
  );

  const prevHealth = state.playerHealth;
  const damagedState = applyPlayerCombatDamage(state, actualDamage, effect.damageType);
  let nextState: BattleState = {
    ...damagedState,
    playerStatuses: {
      ...damagedState.playerStatuses,
      block: damagedState.playerStatuses.block - Math.min(blockAbsorb, damagedState.playerStatuses.block),
    },
  };

  recordPlayerHealthLost(prevHealth, nextState, effect.damageType, combatTexts);
  nextState = applyBlockDepletedHeal(state, nextState, combatTexts);

  nextState = resolvePostDamageThresholds(
    nextState,
    prevHealth,
    blockAbsorb,
    remainingDamage,
    actualDamage,
    effect.damageType,
    combatTexts,
  );

  // Status rider: status-linked damage types (burn, poison, bleed, freeze, stun)
  // apply their status to the player equal to the actual damage dealt,
  // mirroring how player-side damage riders work (damage.ts applyDamageStatuses).
  // Grounding checks pre-hit block so a hit that spends the last Block still
  // suppresses stun buildup.
  const preventStunBuildup = effect.damageType === "stun" && shouldBlockPreventStunBuildup(state);
  if (!preventStunBuildup) {
    nextState = applyPlayerDamageStatuses(nextState, effect, actualDamage);
  }
  nextState = resolvePlayerCrowdControlTriggers(nextState, combatTexts);

  if (effect.lifesteal && actualDamage > 0) {
    nextState = applyEnemyLeechHealing(nextState, actualDamage, combatTexts);
  }

  return nextState;
}

export function processEnemyAttack(state: BattleState, combatTexts: CombatTextEvent[]) {
  let nextState = state;

  for (const effect of state.enemyAttackEffects) {
    try {
      if (effect.kind === "damage") {
        nextState = processEnemyDamageEffect(nextState, effect, combatTexts, { canDodge: true });
      } else if (effect.status === "stun" || effect.status === "freeze") {
        nextState = processEnemyDamageEffect(
          nextState,
          { kind: "damage", damageType: effect.status, amount: effect.amount },
          combatTexts,
        );
      } else if (isDirectPlayerStatusAttack(effect)) {
        nextState = applyPlayerStatusFromAttack(nextState, effect, combatTexts);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logError(`Enemy attack effect failed: ${message}`, "battle", { effect });
      if (import.meta.env.DEV) throw err;
    }
  }

  if (nextState.enemyStatuses.onAttackBleed > 0) {
    const bleedAmount = nextState.enemyStatuses.onAttackBleed;
    nextState = setEnemyStatus(nextState, "onAttackBleed", 0);
    nextState = dealPlayerTypedHit(nextState, "bleed", bleedAmount, combatTexts);
  }

  return nextState;
}
