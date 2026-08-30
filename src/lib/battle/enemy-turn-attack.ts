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
import { checkHealthThresholds, isFreezeActiveForAspect, scaleByRoomMultiplier } from "./enemy-turn-utils";
import { decayArmorAfterDamage, getBattleRng, rollPercent } from "./status-helpers";
import { paceCombatMagnitude } from "./fight-pacing";
import { dealPlayerTypedHit } from "./player-typed-hit";
import { addEnemyMitigation, setEnemyStatus, setFlag } from "./types/state-helpers";
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

const HELLHOUND_BURN_MULTIPLIER = 1.25;
const BRAWLER_PENALTY_MULTIPLIER = 0.5;
const BANDIT_FIRST_HIT_MULTIPLIER = 2;
const NEXT_ATTACK_CRIT_MULTIPLIER = 2;
const CONDITIONAL_FLAT_BONUS = 1;
const OGRE_BLOCK_BREAK_MULTIPLIER = 2;
const GIANT_SNAKE_EXTRA_BLOCK_STRIP = 1;
const VAMPIRE_LEECH_CHANCE = 10;
const ICE_WRAITH_FROZEN_PENALTY = 1;

export function hasEnemyTrait(state: BattleState, traitId: string, traitSet?: ReadonlySet<string>): boolean {
  if (traitSet) return traitSet.has(traitId);
  return state.currentEnemy.traits.some((trait) => trait.id === traitId);
}

export function getEnemyTraitSet(state: BattleState): ReadonlySet<string> {
  return new Set(state.currentEnemy.traits.map((trait) => trait.id));
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
  if (hasEnemyTrait(state, "banshee", traitSet) && state.playerStatuses.stun > 0) flatBonus += CONDITIONAL_FLAT_BONUS;
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

interface EnemyDamageOptions {
  canDodge?: boolean;
  amountMultiplier?: number;
  flatBonus?: number;
  ignorePlayerMitigation?: boolean;
  physicalBlockBreakMultiplier?: number;
  extraPoisonBlockStrip?: number;
  skipTraitReactions?: boolean;
}

function computeMitigatedDamage(
  state: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  remainingDamage: number,
  ignorePlayerMitigation: boolean,
) {
  const armorMitigatesDamage = effect.damageType === "physical" || effect.damageType === "stun";
  const rawDamage = armorMitigatesDamage ? Math.max(0, remainingDamage - state.playerStatuses.armor) : remainingDamage;
  return ignorePlayerMitigation
    ? rawDamage
    : scaleReceivedPlayerDamage(rawDamage, state.talentEffects, effect.damageType);
}

function computeIncomingEnemyAttackDamage(
  state: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  options: EnemyDamageOptions = {},
) {
  let remainingDamage = applyPhysicalForgeBonus(state, effect);
  if (!options.ignorePlayerMitigation && state.gearEffects.damageReductionPerMana > 0) {
    const absorb = state.gearEffects.damageReductionPerMana * state.mana;
    remainingDamage = Math.max(0, remainingDamage - absorb);
  }
  if (!options.ignorePlayerMitigation && state.enemyStatuses.poison > 0) {
    remainingDamage = Math.max(0, remainingDamage - state.talentEffects.poisonReducesEnemyDamage);
  }
  if (effect.damageType === "burn") {
    remainingDamage += state.enemyStatuses.burnBonus;
  }
  if (effect.damageType === "freeze") {
    remainingDamage += state.enemyStatuses.freezeBonus;
  }
  remainingDamage = Math.max(0, remainingDamage + (options.flatBonus ?? 0));
  remainingDamage = Math.round(remainingDamage * (options.amountMultiplier ?? 1));
  return paceCombatMagnitude(state, remainingDamage, "enemy");
}

function calculateBlockAndArmorMitigation(
  state: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  incomingDamage: number,
  combatTexts: CombatTextEvent[],
  options: EnemyDamageOptions,
) {
  let remainingDamage = incomingDamage;
  const effectiveBlock = options.ignorePlayerMitigation ? 0 : computeEffectiveBlock(state, effect);
  const blockAbsorb = Math.min(remainingDamage, effectiveBlock);
  remainingDamage -= blockAbsorb;
  if (blockAbsorb > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "block", amount: blockAbsorb });
  }
  const extraPhysicalBlock =
    effect.damageType === "physical" && (options.physicalBlockBreakMultiplier ?? 1) > 1
      ? Math.min(
          Math.max(0, effectiveBlock - blockAbsorb),
          Math.round(blockAbsorb * ((options.physicalBlockBreakMultiplier ?? 1) - 1)),
        )
      : 0;
  const extraPoisonBlock =
    effect.damageType === "poison" && !options.ignorePlayerMitigation
      ? Math.min(Math.max(0, effectiveBlock - blockAbsorb), options.extraPoisonBlockStrip ?? 0)
      : 0;
  const totalExtraBlock = Math.max(extraPhysicalBlock, extraPoisonBlock);
  if (totalExtraBlock > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "block", amount: totalExtraBlock });
  }
  const armorMitigatesDamage = effect.damageType === "physical" || effect.damageType === "stun";
  const armorAbsorb = armorMitigatesDamage ? Math.min(remainingDamage, state.playerStatuses.armor) : 0;
  const actualDamage = computeMitigatedDamage(state, effect, remainingDamage, options.ignorePlayerMitigation === true);
  return { remainingDamage, blockAbsorb, totalExtraBlock, armorAbsorb, actualDamage };
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

function healEnemyWithCombatText(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  const healed = Math.min(amount, Math.max(0, state.enemyMaxHealth - state.enemyHealth));
  if (healed <= 0) return state;
  mergeCombatText(combatTexts, { target: "enemy", kind: "heal", stat: "health", amount: healed });
  return { ...state, enemyHealth: state.enemyHealth + healed };
}

function applyEnemyDamageTraitReactions(
  state: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  actualDamage: number,
  combatTexts: CombatTextEvent[],
  traitSet?: ReadonlySet<string>,
): BattleState {
  if (actualDamage <= 0) return state;
  let nextState = state;
  if (effect.damageType === "holy") {
    if (hasEnemyTrait(nextState, "cleric", traitSet)) nextState = healEnemyWithCombatText(nextState, 1, combatTexts);
    if (hasEnemyTrait(nextState, "zealot-enemy", traitSet) || hasEnemyTrait(nextState, "inquisitor", traitSet)) {
      nextState = setFlag(nextState, "enemyNextAttackHolyBonus", nextState.flags.enemyNextAttackHolyBonus + 1);
    }
  }
  if ((effect.damageType === "stun" || effect.damageType === "holy") && hasEnemyTrait(nextState, "paladin", traitSet)) {
    mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: "block", amount: 1 });
    nextState = addEnemyMitigation(nextState, "block", 1);
  }
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
  const nextHealth = clampHealth(state.enemyHealth, healAmount, state.enemyMaxHealth);
  let nextState: BattleState = {
    ...state,
    enemyHealth: nextHealth,
  };
  if (
    hasEnemyTrait(nextState, "vampire") &&
    state.enemyHealth < state.enemyMaxHealth &&
    nextHealth >= state.enemyMaxHealth
  ) {
    nextState = setFlag(nextState, "enemyNextAttackBonus", nextState.flags.enemyNextAttackBonus + 1);
  }
  return nextState;
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
  options: EnemyDamageOptions & { traitSet?: ReadonlySet<string> } = {},
) {
  const incomingDamage = computeIncomingEnemyAttackDamage(state, effect, options);
  const dodged = tryDodgeEnemyDamagePacket(state, combatTexts, options.canDodge === true, incomingDamage);
  if (dodged) return dodged;

  const { remainingDamage, blockAbsorb, totalExtraBlock, actualDamage } = calculateBlockAndArmorMitigation(
    state,
    effect,
    incomingDamage,
    combatTexts,
    options,
  );

  const prevHealth = state.playerHealth;
  const damagedState = applyPlayerCombatDamage(state, actualDamage, effect.damageType, {
    ignoreMitigation: options.ignorePlayerMitigation === true,
  });
  let nextState: BattleState = {
    ...damagedState,
    playerStatuses: {
      ...damagedState.playerStatuses,
      block: Math.max(
        0,
        damagedState.playerStatuses.block - Math.min(blockAbsorb + totalExtraBlock, damagedState.playerStatuses.block),
      ),
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

  const preventStunBuildup = effect.damageType === "stun" && shouldBlockPreventStunBuildup(state);
  if (!preventStunBuildup) {
    nextState = applyPlayerDamageStatuses(nextState, effect, actualDamage);
  }
  nextState = resolvePlayerCrowdControlTriggers(nextState, combatTexts);

  if (effect.lifesteal && actualDamage > 0) {
    nextState = applyEnemyLeechHealing(nextState, actualDamage, combatTexts);
  }

  if (!options.skipTraitReactions) {
    const traitSet = options.traitSet ?? getEnemyTraitSet(nextState);
    nextState = applyEnemyDamageTraitReactions(nextState, effect, actualDamage, combatTexts, traitSet);
    if (
      hasEnemyTrait(nextState, "earth-elemental", traitSet) &&
      state.playerStatuses.block > 0 &&
      nextState.playerStatuses.block <= 0 &&
      nextState.playerHealth > 0
    ) {
      nextState = processEnemyDamageEffect(
        nextState,
        { kind: "damage", damageType: "physical", amount: scaleByRoomMultiplier(nextState, 1) },
        combatTexts,
        { skipTraitReactions: true, traitSet },
      );
    }
  }

  return nextState;
}

export function processEnemyAttack(state: BattleState, combatTexts: CombatTextEvent[]) {
  let nextState = state;
  let damageDealtToHealth = 0;
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

        const damageOptions: EnemyDamageOptions & { traitSet?: ReadonlySet<string> } = {
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
        nextState = processEnemyDamageEffect(nextState, effect, combatTexts, damageOptions);
        if (playerPacketLanded(previousState, nextState)) {
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
        nextState = processEnemyDamageEffect(
          nextState,
          { kind: "damage", damageType: effect.status, amount: effect.amount },
          combatTexts,
          { canDodge: true, amountMultiplier, flatBonus, traitSet },
        );
        if (playerPacketLanded(previousState, nextState)) {
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
      nextState = processEnemyDamageEffect(
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
    nextState = processEnemyDamageEffect(
      nextState,
      { kind: "damage", damageType, amount: scaleByRoomMultiplier(nextState, 1) },
      combatTexts,
      { canDodge: false, traitSet },
    );
  };
  traitDamage("blood-countess", "bleed");
  traitDamage("seraph", "holy");
  traitDamage("stone-titan", "stun");
  return nextState;
}
