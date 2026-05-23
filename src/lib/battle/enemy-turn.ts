// Enemy turn processing: wish resolution, companion turn, enemy phase, and turn reset.
// Depends on draw/effect helpers, status ticks, game-data attack shapes, and combat constants.
//
// Turn lifecycle (TurnPhase: "player" | "enemy"):
//   1. Player turn starts: draw cards, process haste (skip enemy phase if hasted),
//      process companion attack, player plays cards.
//   2. End player turn: resolve companion effects, tick player DoTs.
//   3. Enemy turn: tick enemy DoTs, apply traits (armor/forge/freeze per turn),
//      run attack effects, tick player DoTs again (if enemy hit), check Death's Door
//      (0-Health grace for one full turn).
//   4. Advance to player turn: draw cards, reset cardsPlayedThisTurn.
// Branching: stun/freeze still tick enemy DoTs, traits, player DoTs, and regen
// but skip the attack phase entirely (enemyPerformedAttack=false).  Haste skips
// enemy phase entirely and returns to player immediately.  Wish intercepts player
// card play during the player turn.
import { drawCards } from "./draw";
import { emitOverhealBlockText, mergeCombatText } from "./combat-text";
import { applyIronwoodBuckler } from "./trinket-effects";
import { applyPlayerStatusFromAttack } from "./status-application";
import { decayHalvedStatus } from "./status-helpers";
import { tickEnemyStatuses, tickPlayerStatuses } from "./status-ticks";
import { applyPlayerDamageStatuses } from "./status-effects";
import type { BattleCard, EnemyAttackEffect } from "@/lib/game-data/types";
import type { DifficultyModifier } from "@/lib/game-data/difficulties";
import {
  applyPlayerCombatDamage,
  applyPlayerHealing,
  clampHealth,
  type BattleState,
  type CombatTextEvent,
  type TurnPhase,
} from "./types";
import { CARDS_PER_TURN, BATTLE_CONFIG } from "../game-constants";
import {
  DIFFICULTY_FORGE_PER_TURN,
  HALF_DIVISOR,
  IRON_HIDE_ARMOR_PER_TURN,
  IRON_HIDE_BURN_BONUS_PER_TURN,
  LABYRINTH_BURNING_GROUND_DAMAGE,
  LABYRINTH_LEECH_HEAL,
  PERCENT_DENOMINATOR,
  TRAIT_FORGE_PER_TURN,
  TRAIT_FREEZE_BONUS_PER_TURN,
} from "../game-constants";

export { chooseWishCard } from "./wish";
export { processCompanionTurnStart } from "./companion";

function resetPlayerTurnState(state: BattleState): BattleState {
  return {
    ...state,
    turn: state.turn + 1,
    playerCCCooldown: Math.max(0, state.playerCCCooldown - 1),
    enemyCCCooldown: Math.max(0, state.enemyCCCooldown - 1),
    playerStatuses: { ...state.playerStatuses, block: decayHalvedStatus(state.playerStatuses.block ?? 0) },
    cardsPlayedThisTurn: 0,
    flags: {
      ...state.flags,
      resonantChimeUsedThisTurn: false,
      runicQuillUsedThisTurn: false,
      nextCardCostReduction: 0,
    },
  };
}

function handleCCSkipTurn(state: BattleState): BattleState {
  const nextState = resetPlayerTurnState(state);
  return {
    ...nextState,
    turnPhase: "enemy" as TurnPhase,
    playerStunSkipTurns: Math.max(0, state.playerStunSkipTurns - 1),
    playerFreezeSkipTurns: Math.max(0, state.playerFreezeSkipTurns - 1),
  };
}

function performDrawAndResetPhase(state: BattleState, deathsDoorNeedsRecoveryTurn: boolean): BattleState {
  const nextDraw = drawCards(state.deck, state.discard, [], CARDS_PER_TURN, state.nextCardUid);
  const nextState = resetPlayerTurnState(state);
  return {
    ...nextState,
    turnPhase: "player" as TurnPhase,
    deck: nextDraw.deck,
    hand: nextDraw.hand,
    discard: nextDraw.discard,
    nextCardUid: nextDraw.nextCardUid,
    mana: state.maxMana,
    playerStunSkipTurns: deathsDoorNeedsRecoveryTurn ? 0 : state.playerStunSkipTurns,
    playerFreezeSkipTurns: deathsDoorNeedsRecoveryTurn ? 0 : state.playerFreezeSkipTurns,
  };
}

function advanceToPlayerTurn(state: BattleState) {
  // If the player is stunned or frozen, skip their turn — don't draw, don't refill mana,
  // and immediately go back to enemy phase.
  const deathsDoorNeedsRecoveryTurn = state.deathsDoorActive && state.playerHealth <= 0;
  if (!deathsDoorNeedsRecoveryTurn && state.playerStunSkipTurns + state.playerFreezeSkipTurns > 0) {
    return handleCCSkipTurn(state);
  }

  return performDrawAndResetPhase(state, deathsDoorNeedsRecoveryTurn);
}

function checkHealthThresholds(
  prevHealth: number,
  nextHealth: number,
  state: BattleState,
  combatTexts: CombatTextEvent[],
) {
  let nextState = state;

  function applyHealthThresholdStatBonus(
    config: { threshold: number; amount: number } | null,
    stat: "block" | "armor",
  ) {
    if (!config) return;
    const thresholdHp = (state.playerMaxHealth * config.threshold) / PERCENT_DENOMINATOR;
    if (prevHealth > thresholdHp && nextHealth <= thresholdHp) {
      nextState = {
        ...nextState,
        playerStatuses: { ...nextState.playerStatuses, [stat]: nextState.playerStatuses[stat] + config.amount },
      };
      mergeCombatText(combatTexts, { target: "player", kind: "status", stat, amount: config.amount });
    }
  }

  applyHealthThresholdStatBonus(state.talentEffects.healthThresholdBlock, "block");
  applyHealthThresholdStatBonus(state.talentEffects.healthThresholdArmor, "armor");
  return nextState;
}

function applyPhysicalForgeBonus(state: BattleState, effect: EnemyAttackEffect & { kind: "damage" }) {
  let remainingDamage = effect.amount;
  if (effect.damageType !== "physical") return remainingDamage;
  remainingDamage = Math.max(0, remainingDamage - state.talentEffects.bleedEnemyDamageReduction);
  return remainingDamage + state.enemyMitigation.forge;
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
  const rawDamage =
    effect.damageType === "physical" ? Math.max(0, remainingDamage - state.playerStatuses.armor) : remainingDamage;
  const actualDamage =
    effect.damageType === "holy" && state.talentEffects.receiveHalfHolyDamage
      ? Math.round(rawDamage / HALF_DIVISOR)
      : rawDamage;
  return actualDamage;
}

function calculateBlockAndArmorMitigation(
  state: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  combatTexts: CombatTextEvent[],
) {
  let remainingDamage = applyPhysicalForgeBonus(state, effect);
  if (state.enemyStatuses.burn > 0) {
    remainingDamage = Math.max(0, remainingDamage - state.talentEffects.burnReducesEnemyDamage);
  }
  if (effect.damageType === "burn") {
    remainingDamage += state.enemyMitigation.burnBonus;
  }
  const effectiveBlock = computeEffectiveBlock(state, effect);
  const blockAbsorb = Math.min(remainingDamage, effectiveBlock);
  remainingDamage -= blockAbsorb;
  if (blockAbsorb > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "block", amount: blockAbsorb });
  }
  const actualDamage = computeMitigatedDamage(state, effect, remainingDamage);
  return { remainingDamage, blockAbsorb, actualDamage };
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

function applyArmorDecayOnHit(state: BattleState, actualDamage: number, combatTexts: CombatTextEvent[]): BattleState {
  if (actualDamage <= 0 || state.playerStatuses.armor <= 0) return state;
  const armorBefore = state.playerStatuses.armor;
  let nextState = {
    ...state,
    playerStatuses: {
      ...state.playerStatuses,
      armor: state.playerStatuses.armor - BATTLE_CONFIG.ARMOR_DECAY_AMOUNT,
    },
  };
  if (armorBefore > 0 && nextState.playerStatuses.armor === 0 && nextState.talentEffects.armorBreakBlock > 0) {
    nextState = {
      ...nextState,
      playerStatuses: {
        ...nextState.playerStatuses,
        block: nextState.playerStatuses.block + nextState.talentEffects.armorBreakBlock,
      },
    };
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "status",
      stat: "block",
      amount: nextState.talentEffects.armorBreakBlock,
    });
  }
  return nextState;
}

function applyEnemyForgeDecayOnHit(state: BattleState, actualDamage: number, damageType: string): BattleState {
  if (actualDamage <= 0 || damageType !== "physical" || state.enemyMitigation.forge <= 0) return state;
  return {
    ...state,
    enemyMitigation: {
      ...state.enemyMitigation,
      forge: state.enemyMitigation.forge - BATTLE_CONFIG.FORGE_DECAY_AMOUNT,
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
  nextState = applyArmorDecayOnHit(nextState, actualDamage, combatTexts);
  nextState = applyEnemyForgeDecayOnHit(nextState, actualDamage, damageType);
  return nextState;
}

function applyEnemyAttackLifesteal(
  state: BattleState,
  actualDamage: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (state.enemyFreezeSkipTurns > 0 && state.talentEffects.freezeBlocksRegen) return state;
  mergeCombatText(combatTexts, { target: "enemy", kind: "heal", stat: "health", amount: actualDamage });
  return {
    ...state,
    enemyHealth: clampHealth(state.enemyHealth, actualDamage, state.enemyMaxHealth),
  };
}

function processEnemyDamageEffect(
  state: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  combatTexts: CombatTextEvent[],
) {
  const { remainingDamage, blockAbsorb, actualDamage } = calculateBlockAndArmorMitigation(state, effect, combatTexts);

  const prevHealth = state.playerHealth;
  let nextState: BattleState = {
    ...state,
    ...applyPlayerCombatDamage(state, actualDamage),
    playerStatuses: {
      ...state.playerStatuses,
      block: state.playerStatuses.block - Math.min(blockAbsorb, state.playerStatuses.block),
    },
  };

  const healthLost = prevHealth - nextState.playerHealth;
  if (healthLost > 0) {
    const stat = effect.damageType === "physical" ? "health" : effect.damageType;
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat, amount: healthLost });
  }

  if (
    state.talentEffects.blockDepletedHeal > 0 &&
    state.playerStatuses.block > 0 &&
    nextState.playerStatuses.block <= 0
  ) {
    const prevState = nextState;
    nextState = applyPlayerHealing(nextState, state.talentEffects.blockDepletedHeal);
    emitOverhealBlockText(prevState, nextState, combatTexts);
  }

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
  nextState = applyPlayerDamageStatuses(nextState, effect, actualDamage);

  if (effect.lifesteal && actualDamage > 0) {
    nextState = applyEnemyAttackLifesteal(nextState, actualDamage, combatTexts);
  }

  return nextState;
}

function processEnemyAttack(state: BattleState, combatTexts: CombatTextEvent[]) {
  let nextState = state;

  for (const effect of state.enemyAttackEffects) {
    if (effect.kind === "damage") {
      nextState = processEnemyDamageEffect(nextState, effect, combatTexts);
    } else if (effect.kind === "player-status") {
      nextState = applyPlayerStatusFromAttack(nextState, effect, combatTexts);
    }
  }

  return nextState;
}

function processEnemyRegeneration(state: BattleState, combatTexts: CombatTextEvent[]) {
  if (state.enemyRegeneration <= 0) return state;
  if (state.enemyFreezeSkipTurns > 0 && state.talentEffects.freezeBlocksRegen) return state;
  let healAmount = state.enemyRegeneration;
  if (state.enemyStatuses.poison > 0 && state.talentEffects.poisonHalvesHealing) {
    healAmount = Math.round(healAmount / HALF_DIVISOR);
  }
  if (healAmount <= 0) return state;
  mergeCombatText(combatTexts, { target: "enemy", kind: "heal", stat: "health", amount: healAmount });
  return { ...state, enemyHealth: clampHealth(state.enemyHealth, healAmount, state.enemyMaxHealth) };
}

type EnemyTurnStartHandler = (
  state: BattleState,
  combatTexts: CombatTextEvent[],
  options?: { traitRoll?: number },
) => BattleState;

function isScalingBlocked(state: BattleState): boolean {
  return state.enemyFreezeSkipTurns > 0 && state.talentEffects.freezePreventsEnemyScaling;
}

const enemyTraitTurnStartHandlers: Record<string, EnemyTurnStartHandler> = {
  "rusting-carapace": (state) => {
    if (isScalingBlocked(state)) return state;
    const scaledForge = Math.round(TRAIT_FORGE_PER_TURN * state.roomScalingMultiplier);
    return {
      ...state,
      enemyMitigation: {
        ...state.enemyMitigation,
        forge: state.enemyMitigation.forge + scaledForge,
      },
    };
  },
  "iron-hide": (state, combatTexts, options) => {
    if (isScalingBlocked(state)) return state;
    const scaledArmor = Math.round(IRON_HIDE_ARMOR_PER_TURN * state.roomScalingMultiplier);
    const scaledForge = Math.round(TRAIT_FORGE_PER_TURN * state.roomScalingMultiplier);
    const scaledBurn = Math.round(IRON_HIDE_BURN_BONUS_PER_TURN * state.roomScalingMultiplier);
    const roll = options?.traitRoll ?? Math.random();
    const choice = Math.trunc(roll * 3);
    if (choice === 0) {
      mergeCombatText(combatTexts, {
        target: "enemy",
        kind: "status",
        stat: "armor",
        amount: scaledArmor,
      });
      return {
        ...state,
        enemyMitigation: {
          ...state.enemyMitigation,
          armor: state.enemyMitigation.armor + scaledArmor,
        },
      };
    } else if (choice === 1) {
      mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: "forge", amount: scaledForge });
      return {
        ...state,
        enemyMitigation: {
          ...state.enemyMitigation,
          forge: state.enemyMitigation.forge + scaledForge,
        },
      };
    }
    mergeCombatText(combatTexts, {
      target: "enemy",
      kind: "notice",
      stat: "burn",
      text: `+${scaledBurn} Burn Dmg`,
    });
    return {
      ...state,
      enemyMitigation: {
        ...state.enemyMitigation,
        burnBonus: state.enemyMitigation.burnBonus + scaledBurn,
      },
    };
  },
  "glacial-shell": (state) => {
    if (isScalingBlocked(state)) return state;
    const scaledFreeze = Math.round(TRAIT_FREEZE_BONUS_PER_TURN * state.roomScalingMultiplier);
    return {
      ...state,
      enemyMitigation: {
        ...state.enemyMitigation,
        freezeBonus: state.enemyMitigation.freezeBonus + scaledFreeze,
      },
    };
  },
};

const difficultyTurnStartHandlers: Partial<Record<DifficultyModifier["kind"], EnemyTurnStartHandler>> = {
  "enemy-gains-forge-each-turn": (state, combatTexts) => {
    if (isScalingBlocked(state)) return state;
    mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: "forge", amount: DIFFICULTY_FORGE_PER_TURN });
    return {
      ...state,
      enemyMitigation: {
        ...state.enemyMitigation,
        forge: state.enemyMitigation.forge + DIFFICULTY_FORGE_PER_TURN,
      },
    };
  },
  "labyrinth-leeching": (state, combatTexts) => {
    if (state.enemyFreezeSkipTurns > 0 && state.talentEffects.freezeBlocksRegen) return state;
    mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: "health", amount: LABYRINTH_LEECH_HEAL });
    return {
      ...state,
      enemyHealth: clampHealth(state.enemyHealth, LABYRINTH_LEECH_HEAL, state.enemyMaxHealth),
    };
  },
  "labyrinth-burning-ground": (state, combatTexts) => {
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "status",
      stat: "burn",
      amount: LABYRINTH_BURNING_GROUND_DAMAGE,
    });
    return {
      ...state,
      playerStatuses: {
        ...state.playerStatuses,
        burn: state.playerStatuses.burn + LABYRINTH_BURNING_GROUND_DAMAGE,
      },
    };
  },
};

function reduceSkipTurns(state: BattleState): BattleState {
  return {
    ...state,
    enemyStunSkipTurns: Math.max(0, state.enemyStunSkipTurns - 1),
    enemyFreezeSkipTurns: Math.max(0, state.enemyFreezeSkipTurns - 1),
  };
}

function resolveDeathsDoorEndOfEnemyTurn(state: BattleState): BattleState {
  if (!state.deathsDoorActive) return state;
  if (state.playerHealth > 0) return { ...state, deathsDoorActive: false, deathsDoorTriggeredTurn: null };
  if (state.deathsDoorTriggeredTurn === null) return state;
  const graceTurns = 1 + (state.talentEffects.deathsDoorExtension ?? 0);
  if (state.turn - state.deathsDoorTriggeredTurn < graceTurns) return state;
  return { ...state, deathsDoorActive: false, deathsDoorTriggeredTurn: null };
}

function processEnemyTraits(state: BattleState, combatTexts: CombatTextEvent[], options?: { traitRoll?: number }) {
  let nextState = state;

  for (const trait of nextState.currentEnemy.traits) {
    const handler = enemyTraitTurnStartHandlers[trait.id];
    if (handler) nextState = handler(nextState, combatTexts, options);
  }

  for (const modifier of nextState.difficultyModifiers) {
    const handler = difficultyTurnStartHandlers[modifier.kind];
    if (handler) nextState = handler(nextState, combatTexts, options);
  }

  return nextState;
}

function processHasteEarlyTurn(state: BattleState): BattleState {
  return {
    ...state,
    playerStatuses: { ...state.playerStatuses, haste: state.playerStatuses.haste - 1 },
  };
}

function beginEnemyPhase(state: BattleState): BattleState {
  return {
    ...state,
    turnPhase: "enemy" as TurnPhase,
    hand: [] as BattleCard[],
    discard: [...state.discard, ...state.hand],
  };
}

export type EndPlayerTurnResolution = {
  state: BattleState;
  combatTexts: CombatTextEvent[];
  playerTurnSkipped: boolean;
  enemyTurnStartState?: BattleState;
  enemyTurnStartCombatTexts: CombatTextEvent[];
  enemyResolutionCombatTexts: CombatTextEvent[];
  enemyPerformedAttack: boolean;
};

function finalizePlayerTurn(state: BattleState, combatTexts: CombatTextEvent[]) {
  let nextState = applyIronwoodBuckler(state, combatTexts);
  nextState = resolveDeathsDoorEndOfEnemyTurn(nextState);
  const finalState = advanceToPlayerTurn(nextState);
  return { state: finalState, combatTexts, playerTurnSkipped: finalState.turnPhase === "enemy" };
}

function resolveHasteTurn(
  state: BattleState,
  combatTexts: CombatTextEvent[],
  enemyTurnStartCombatTexts: CombatTextEvent[],
  enemyResolutionCombatTexts: CombatTextEvent[],
) {
  const nextState = processHasteEarlyTurn(state);
  return {
    ...finalizePlayerTurn(nextState, combatTexts),
    enemyTurnStartCombatTexts,
    enemyResolutionCombatTexts,
    enemyPerformedAttack: false,
  };
}

function resolveSkippedEnemyTurn(
  state: BattleState,
  combatTexts: CombatTextEvent[],
  enemyTurnStartCombatTexts: CombatTextEvent[],
  enemyResolutionCombatTexts: CombatTextEvent[],
  options?: { traitRoll?: number },
) {
  let nextState = state;

  // Turn start: tick enemy DoTs (burn/poison/bleed)
  nextState = tickEnemyStatuses(nextState, enemyTurnStartCombatTexts);
  combatTexts.push(...enemyTurnStartCombatTexts);
  const enemyTurnStartState = nextState;

  // Resolution: traits, player DoTs, regen — but skip the attack
  // Reduce skip turns AFTER processing traits so isScalingBlocked
  // still sees the pre-reduction freeze skip count.
  nextState = processEnemyTraits(nextState, enemyResolutionCombatTexts, options);
  nextState = reduceSkipTurns(nextState);
  nextState = tickPlayerStatuses(nextState, enemyResolutionCombatTexts);
  nextState = processEnemyRegeneration(nextState, enemyResolutionCombatTexts);
  combatTexts.push(...enemyResolutionCombatTexts);

  return {
    ...finalizePlayerTurn(nextState, combatTexts),
    enemyTurnStartState,
    enemyTurnStartCombatTexts,
    enemyResolutionCombatTexts,
    enemyPerformedAttack: false,
  };
}

function resolveEnemyTurnStart(state: BattleState, combatTexts: CombatTextEvent[], phaseTexts: CombatTextEvent[]) {
  const nextState = tickEnemyStatuses(state, phaseTexts);
  combatTexts.push(...phaseTexts);
  return nextState;
}

function resolveEnemyAction(
  state: BattleState,
  combatTexts: CombatTextEvent[],
  phaseTexts: CombatTextEvent[],
  options?: { traitRoll?: number },
) {
  let nextState = processEnemyTraits(state, phaseTexts, options);
  nextState = processEnemyAttack(nextState, phaseTexts);
  nextState = tickPlayerStatuses(nextState, phaseTexts);
  nextState = processEnemyRegeneration(nextState, phaseTexts);
  combatTexts.push(...phaseTexts);
  return nextState;
}

export function endPlayerTurn(state: BattleState, options?: { traitRoll?: number }): EndPlayerTurnResolution {
  const combatTexts: CombatTextEvent[] = [];
  const enemyTurnStartCombatTexts: CombatTextEvent[] = [];
  const enemyResolutionCombatTexts: CombatTextEvent[] = [];
  let nextState = beginEnemyPhase(state);

  if (state.playerStatuses.haste > 0) {
    return resolveHasteTurn(nextState, combatTexts, enemyTurnStartCombatTexts, enemyResolutionCombatTexts);
  }

  if (state.enemyStunSkipTurns + state.enemyFreezeSkipTurns > 0) {
    return resolveSkippedEnemyTurn(
      nextState,
      combatTexts,
      enemyTurnStartCombatTexts,
      enemyResolutionCombatTexts,
      options,
    );
  }

  nextState = resolveEnemyTurnStart(nextState, combatTexts, enemyTurnStartCombatTexts);
  const enemyTurnStartState = nextState;

  if (nextState.enemyHealth <= 0) {
    return {
      ...finalizePlayerTurn(nextState, combatTexts),
      enemyTurnStartState,
      enemyTurnStartCombatTexts,
      enemyResolutionCombatTexts,
      enemyPerformedAttack: false,
    };
  }

  nextState = resolveEnemyAction(nextState, combatTexts, enemyResolutionCombatTexts, options);

  return {
    ...finalizePlayerTurn(nextState, combatTexts),
    enemyTurnStartState,
    enemyTurnStartCombatTexts,
    enemyResolutionCombatTexts,
    enemyPerformedAttack: true,
  };
}
