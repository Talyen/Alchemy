import type { EnemyAttackEffect } from "@/lib/game-data";
import { logError } from "../error-logger";
import { addGoldWithCombatText, addPlayerStatusWithCombatText, applyHealingWithCombatText } from "./combat-text";
import { processCompanionTurnStart } from "./companion";
import { takeRandomCardFromDeck } from "./draw";
import { tryDodgeEnemyAttackPacket } from "./dodge";
import { applyCardEffects } from "./effect-handlers";
import {
  applyEnemyLeechHealing,
  computeIncomingEnemyAttackDamage,
  processEnemyDamageEffect,
  type EnemyDamageOptions,
} from "./enemy-attack-damage";
import { getEnemyTraitSet, hasEnemyTrait, scaleByRoomMultiplier } from "./enemy-turn-rules";
import { handlePostPlayCardDestination } from "./card-play";
import { dealPlayerTypedHit } from "./player-typed-hit";
import { applyPlayerStatusFromAttack, type DirectPlayerStatusAttackEffect } from "./status-player";
import { getBattleRng, rollPercent } from "./status-helpers";
import { type BattleState, type CombatTextEvent } from "./types";
import { setEnemyStatus, setFlag } from "./types/state-helpers";
import {
  BANDIT_FIRST_HIT_MULTIPLIER,
  BRAWLER_PENALTY_MULTIPLIER,
  CONDITIONAL_FLAT_BONUS,
  GIANT_SNAKE_EXTRA_BLOCK_STRIP,
  HELLHOUND_BURN_MULTIPLIER,
  ICE_WRAITH_FROZEN_PENALTY,
  NEXT_ATTACK_CRIT_MULTIPLIER,
  OGRE_BLOCK_BREAK_MULTIPLIER,
  VAMPIRE_LEECH_CHANCE,
} from "../game-constants";

function isDirectPlayerStatusAttack(
  effect: Extract<EnemyAttackEffect, { kind: "player-status" }>,
): effect is DirectPlayerStatusAttackEffect {
  return effect.status !== "stun" && effect.status !== "freeze";
}

interface ResolvedDamageModifiers {
  amountMultiplier: number;
  flatBonus: number;
}

function resolveEnemyDamageModifiers(
  state: BattleState,
  traitSet: ReadonlySet<string>,
  isFirstDamage: boolean,
  nextAttackCrit: boolean,
  nextAttackBonus: number,
): ResolvedDamageModifiers {
  let amountMultiplier = 1;
  let flatBonus = 0;
  if (hasEnemyTrait(state, "hellhound", traitSet) && state.playerStatuses.burn > 0)
    amountMultiplier *= HELLHOUND_BURN_MULTIPLIER;
  if (hasEnemyTrait(state, "dire-wolf", traitSet) && state.playerStatuses.bleed > 0)
    flatBonus += CONDITIONAL_FLAT_BONUS;
  if (hasEnemyTrait(state, "stone-golem", traitSet) && state.enemyMitigation.block > 0)
    flatBonus += CONDITIONAL_FLAT_BONUS;
  if (hasEnemyTrait(state, "ice-wraith", traitSet) && state.enemyStatuses.freeze > 0)
    flatBonus -= ICE_WRAITH_FROZEN_PENALTY;
  if (isFirstDamage && nextAttackCrit) amountMultiplier *= NEXT_ATTACK_CRIT_MULTIPLIER;
  if (isFirstDamage && nextAttackBonus > 0) flatBonus += nextAttackBonus;
  return { amountMultiplier, flatBonus };
}

function playerPacketLanded(before: BattleState, after: BattleState): boolean {
  const changedStatus = (["burn", "poison", "bleed", "freeze", "stun"] as const).some(
    (status) => after.playerStatuses[status] > before.playerStatuses[status],
  );
  return (
    after.playerHealth < before.playerHealth ||
    after.playerStatuses.block < before.playerStatuses.block ||
    after.playerStatuses.armor < before.playerStatuses.armor ||
    changedStatus
  );
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

interface AttackDamageOptions extends EnemyDamageOptions {
  canDodge: boolean;
}

function processAttackDamageEffect(
  state: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  combatTexts: CombatTextEvent[],
  options: AttackDamageOptions,
): BattleState {
  const { canDodge, ...damageOptions } = options;
  const incomingDamage = computeIncomingEnemyAttackDamage(state, effect, damageOptions);
  const dodged = tryDodgeEnemyDamagePacket(state, combatTexts, canDodge, incomingDamage);
  if (dodged) return dodged;
  return processEnemyDamageEffect(state, effect, combatTexts, { ...damageOptions, incomingDamage });
}

export function processEnemyAttack(state: BattleState, combatTexts: CombatTextEvent[]) {
  let nextState = state;
  let damageDealtToHealth = 0;
  let attackPacketLanded = false;
  let firstDamageEffect = true;
  const brawlerPenalty = state.flags.enemyBrawlerDamagePenalty;
  const nextAttackCrit = state.flags.enemyNextAttackCrit;
  const nextAttackBonus = state.flags.enemyNextAttackBonus;
  const nextAttackHolyBonus = state.flags.enemyNextAttackHolyBonus;
  const originalLength = state.enemyAttackEffects.length;
  const appendedBonusIndex = nextAttackHolyBonus > 0 ? originalLength : -1;
  const attackEffects: EnemyAttackEffect[] =
    nextAttackHolyBonus > 0
      ? [...state.enemyAttackEffects, { kind: "damage", damageType: "holy", amount: nextAttackHolyBonus }]
      : state.enemyAttackEffects;
  const traitSet = getEnemyTraitSet(state);

  if (nextAttackHolyBonus > 0) nextState = setFlag(nextState, "enemyNextAttackHolyBonus", 0);
  if (brawlerPenalty) nextState = setFlag(nextState, "enemyBrawlerDamagePenalty", false);

  for (let idx = 0; idx < attackEffects.length; idx++) {
    const effect = attackEffects[idx] as EnemyAttackEffect;
    try {
      if (effect.kind === "damage") {
        const previousState = nextState;
        const isFirstDamage = firstDamageEffect;
        const resolved = resolveEnemyDamageModifiers(
          nextState,
          traitSet,
          isFirstDamage,
          nextAttackCrit,
          nextAttackBonus,
        );
        let amountMultiplier = resolved.amountMultiplier * (brawlerPenalty ? BRAWLER_PENALTY_MULTIPLIER : 1);
        const flatBonus = resolved.flatBonus;

        const banditFirstHit = hasEnemyTrait(nextState, "bandit", traitSet) && !nextState.flags.enemyFirstHitDoubleUsed;
        if (banditFirstHit) {
          amountMultiplier *= BANDIT_FIRST_HIT_MULTIPLIER;
        }
        if (isFirstDamage && (nextAttackCrit || nextAttackBonus > 0)) {
          nextState = setFlag(nextState, "enemyNextAttackCrit", false);
          nextState = setFlag(nextState, "enemyNextAttackBonus", 0);
        }
        const isBonusHolyEffect = idx === appendedBonusIndex;

        const damageOptions: AttackDamageOptions = {
          canDodge: true,
          amountMultiplier,
          flatBonus,
          skipTraitReactions: isBonusHolyEffect,
          traitSet,
          ...(hasEnemyTrait(nextState, "pyromancer", traitSet) && effect.damageType === "burn"
            ? { ignorePlayerMitigation: true }
            : {}),
          ...(hasEnemyTrait(nextState, "ogre", traitSet) && effect.damageType === "physical"
            ? { physicalBlockBreakMultiplier: OGRE_BLOCK_BREAK_MULTIPLIER }
            : {}),
          ...(hasEnemyTrait(nextState, "giant-snake", traitSet) && effect.damageType === "poison"
            ? { extraPoisonBlockStrip: GIANT_SNAKE_EXTRA_BLOCK_STRIP }
            : {}),
        };
        nextState = processAttackDamageEffect(nextState, effect, combatTexts, damageOptions);
        if (playerPacketLanded(previousState, nextState)) {
          attackPacketLanded = true;
          damageDealtToHealth += previousState.playerHealth - nextState.playerHealth;
          if (banditFirstHit) nextState = setFlag(nextState, "enemyFirstHitDoubleUsed", true);
        }
        firstDamageEffect = false;
      } else if (effect.status === "stun" || effect.status === "freeze") {
        const previousState = nextState;
        const isFirstDamage = firstDamageEffect;
        const resolved = resolveEnemyDamageModifiers(
          nextState,
          traitSet,
          isFirstDamage,
          nextAttackCrit,
          nextAttackBonus,
        );
        const amountMultiplier = resolved.amountMultiplier * (brawlerPenalty ? BRAWLER_PENALTY_MULTIPLIER : 1);
        const flatBonus = resolved.flatBonus;
        if (isFirstDamage && (nextAttackCrit || nextAttackBonus > 0)) {
          nextState = setFlag(nextState, "enemyNextAttackCrit", false);
          nextState = setFlag(nextState, "enemyNextAttackBonus", 0);
        }
        nextState = processAttackDamageEffect(
          nextState,
          { kind: "damage", damageType: effect.status, amount: effect.amount },
          combatTexts,
          { canDodge: true, amountMultiplier, flatBonus, traitSet },
        );
        if (playerPacketLanded(previousState, nextState)) {
          attackPacketLanded = true;
          damageDealtToHealth += previousState.playerHealth - nextState.playerHealth;
        }
        firstDamageEffect = false;
      } else if (isDirectPlayerStatusAttack(effect)) {
        nextState = applyPlayerStatusFromAttack(nextState, effect, combatTexts);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logError(`Enemy attack effect failed: ${message}`, "battle", { effect });
      if (import.meta.env.DEV) throw err;
    }
  }

  const hasSuccessfulHealthDamage = damageDealtToHealth > 0 && nextState.playerHealth > 0;
  if (hasSuccessfulHealthDamage) {
    if (hasEnemyTrait(nextState, "fire-imp", traitSet)) {
      nextState = applyPlayerStatusFromAttack(
        nextState,
        { kind: "player-status", status: "burn", amount: 1 },
        combatTexts,
      );
    }
    if (hasEnemyTrait(nextState, "giant-spider", traitSet)) {
      nextState = applyPlayerStatusFromAttack(
        nextState,
        { kind: "player-status", status: "poison", amount: 1 },
        combatTexts,
      );
    }
    if (hasEnemyTrait(nextState, "winter-wolf", traitSet)) {
      nextState = processAttackDamageEffect(
        nextState,
        { kind: "damage", damageType: "freeze", amount: 1 },
        combatTexts,
        { canDodge: false, traitSet },
      );
    }
    if (hasEnemyTrait(nextState, "vampire", traitSet) && rollPercent(VAMPIRE_LEECH_CHANCE, getBattleRng(nextState))) {
      nextState = applyEnemyLeechHealing(nextState, damageDealtToHealth, combatTexts);
    }
  }

  if (hasEnemyTrait(nextState, "banshee", traitSet) && attackPacketLanded) {
    const statuses: Array<keyof BattleState["playerStatuses"]> = ["block", "armor", "forge", "haste"];
    const purgeTarget = statuses.find((stat) => nextState.playerStatuses[stat] > 0);
    if (purgeTarget) {
      nextState = {
        ...nextState,
        playerStatuses: { ...nextState.playerStatuses, [purgeTarget]: 0 },
      };
      combatTexts.push({ target: "player", kind: "notice", stat: purgeTarget, text: "Purged" });
    }
  }

  if (nextState.enemyStatuses.onAttackBleed > 0) {
    const bleedAmount = nextState.enemyStatuses.onAttackBleed;
    nextState = setEnemyStatus(nextState, "onAttackBleed", 0);
    nextState = dealPlayerTypedHit(nextState, "bleed", bleedAmount, combatTexts);
  }

  return nextState;
}

export function processEnemyTraitActionStart(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  let nextState = state;
  const traitSet = getEnemyTraitSet(state);
  const traitDamage = (traitId: string, damageType: "holy" | "bleed" | "stun") => {
    if (!hasEnemyTrait(nextState, traitId, traitSet) || nextState.playerHealth <= 0) return;
    nextState = processAttackDamageEffect(
      nextState,
      { kind: "damage", damageType, amount: scaleByRoomMultiplier(nextState, 1) },
      combatTexts,
      { canDodge: false, traitSet },
    );
  };
  traitDamage("seraph", "holy");
  traitDamage("stone-titan", "stun");
  return nextState;
}
