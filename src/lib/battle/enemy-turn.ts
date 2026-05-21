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
// Branching: stun/freeze skip enemy attack phase entirely; Wish intercepts player
// card play; haste skips enemy phase and returns to player immediately.
import { drawCards } from "./draw";
import { applyCardEffects } from "./apply-effects";
import { mergeCombatText } from "./combat-text";
import { applyIronwoodBuckler } from "./trinket-effects";
import { decayHalvedStatus, tickEnemyStatuses, tickPlayerStatuses } from "./status-ticks";
import { harmfulPlayerStatusIds } from "@/lib/game-data";
import type { BattleCard, EnemyAttackEffect } from "@/lib/game-data/types";
import type { DifficultyModifier } from "@/lib/game-data/difficulties";
import { applyPlayerCombatDamage, clampHealth, type BattleState, type CombatTextEvent, type TurnPhase } from "./types";
import { CARDS_PER_TURN, MAX_HAND_SIZE } from "../game-constants";
import {
  DIFFICULTY_FORGE_PER_TURN,
  HALF_DIVISOR,
  IRON_HIDE_ARMOR_PER_TURN,
  LABYRINTH_BURNING_GROUND_DAMAGE,
  LABYRINTH_LEECH_HEAL,
  PERCENT_DENOMINATOR,
  TRAIT_FORGE_PER_TURN,
  TRAIT_FREEZE_BONUS_PER_TURN,
} from "../game-constants";

export function chooseWishCard(state: BattleState, cardId: string) {
  const chosenCard = state.wishOptions?.find((card) => card.id === cardId);
  if (!chosenCard) {
    return state;
  }

  const [nextWishOptions = null, ...wishQueue] = state.wishQueue;

  if (state.hand.length < MAX_HAND_SIZE) {
    return { ...state, hand: [...state.hand, chosenCard], wishOptions: nextWishOptions, wishQueue };
  }

  return { ...state, discard: [...state.discard, chosenCard], wishOptions: nextWishOptions, wishQueue };
}

export function processCompanionTurnStart(state: BattleState, combatTexts: CombatTextEvent[]) {
  if (!state.activeCompanion || state.enemyHealth <= 0) return state;
  const companionBondLevel = state.talentEffects.companionBondLevels[state.activeCompanion.id] ?? 0;

  const companionCard: BattleCard = {
    id: `companion-${state.activeCompanion.id}`,
    title: state.activeCompanion.title,
    descriptionLines: [],
    art: state.activeCompanion.art,
    cost: 0,
    effects: state.activeCompanion.turnStartEffects.map((e) =>
      e.kind === "damage"
        ? {
            ...e,
            amount:
              e.amount +
              companionBondLevel +
              state.talentEffects.companionDamage +
              state.trinketEffects.companionDamageBonus +
              state.companionDamageBuff,
          }
        : e,
    ),
  };

  const savedFlags = {
    firstBurnCardDoubledUsed: state.flags.firstBurnCardDoubledUsed,
    firstBurnTrinketDoubledUsed: state.flags.firstBurnTrinketDoubledUsed,
    firstHolyDamageBonusUsed: state.flags.firstHolyDamageBonusUsed,
    goldOnFirstPoisonThisCombat: state.flags.goldOnFirstPoisonThisCombat,
  };

  const result = applyCardEffects(state, companionCard, combatTexts);

  return { ...result, flags: { ...result.flags, ...savedFlags } };
}

function advanceToPlayerTurn(state: BattleState) {
  // If the player is stunned or frozen, skip their turn — don't draw, don't refill mana,
  // and immediately go back to enemy phase.
  const deathsDoorNeedsRecoveryTurn = state.deathsDoorActive && state.playerHealth <= 0;
  if (!deathsDoorNeedsRecoveryTurn && state.playerStunSkipTurns + state.playerFreezeSkipTurns > 0) {
    return {
      ...state,
      turn: state.turn + 1,
      turnPhase: "enemy" as TurnPhase,
      playerStunSkipTurns: Math.max(0, state.playerStunSkipTurns - 1),
      playerFreezeSkipTurns: Math.max(0, state.playerFreezeSkipTurns - 1),
      playerCCCooldown: Math.max(0, state.playerCCCooldown - 1),
      enemyCCCooldown: Math.max(0, state.enemyCCCooldown - 1),
      playerStatuses: { ...state.playerStatuses, block: decayHalvedStatus(state.playerStatuses.block ?? 0) },
      cardsPlayedThisTurn: 0,
      flags: { ...state.flags, resonantChimeUsedThisTurn: false, nextCardCostReduction: 0 },
    };
  }

  const nextDraw = drawCards(state.deck, state.discard, [], CARDS_PER_TURN, state.nextCardUid);
  return {
    ...state,
    turn: state.turn + 1,
    turnPhase: "player" as TurnPhase,
    deck: nextDraw.deck,
    hand: nextDraw.hand,
    discard: nextDraw.discard,
    nextCardUid: nextDraw.nextCardUid,
    mana: state.maxMana,
    playerStunSkipTurns: deathsDoorNeedsRecoveryTurn ? 0 : state.playerStunSkipTurns,
    playerFreezeSkipTurns: deathsDoorNeedsRecoveryTurn ? 0 : state.playerFreezeSkipTurns,
    playerCCCooldown: Math.max(0, state.playerCCCooldown - 1),
    enemyCCCooldown: Math.max(0, state.enemyCCCooldown - 1),
    playerStatuses: { ...state.playerStatuses, block: decayHalvedStatus(state.playerStatuses.block ?? 0) },
    cardsPlayedThisTurn: 0,
    flags: { ...state.flags, resonantChimeUsedThisTurn: false, nextCardCostReduction: 0 },
  };
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

function processEnemyDamageEffect(
  state: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  combatTexts: CombatTextEvent[],
) {
  let remainingDamage = effect.amount;

  if (effect.damageType === "physical") {
    remainingDamage = Math.max(0, remainingDamage - state.talentEffects.bleedEnemyDamageReduction);
    remainingDamage += state.enemyForge;
  }

  let effectiveBlock = state.playerStatuses.block;
  if (effect.damageType === "physical" && state.talentEffects.blockAbsorbPhysicalBonus > 0) {
    effectiveBlock = Math.round(
      effectiveBlock * (1 + state.talentEffects.blockAbsorbPhysicalBonus / PERCENT_DENOMINATOR),
    );
  }

  const blockAbsorb = Math.min(remainingDamage, effectiveBlock);
  remainingDamage -= blockAbsorb;

  if (blockAbsorb > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "block", amount: blockAbsorb });
  }

  const rawDamage =
    effect.damageType === "physical" ? Math.max(0, remainingDamage - state.playerStatuses.armor) : remainingDamage;
  const actualDamage =
    effect.damageType === "holy" && state.talentEffects.receiveHalfHolyDamage
      ? Math.round(rawDamage / HALF_DIVISOR)
      : rawDamage;

  if (actualDamage > 0) {
    const stat = effect.damageType === "physical" ? "health" : effect.damageType;
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat, amount: actualDamage });
  }

  const prevHealth = state.playerHealth;
  let nextState: BattleState = {
    ...state,
    ...applyPlayerCombatDamage(state, actualDamage),
    playerStatuses: {
      ...state.playerStatuses,
      block: state.playerStatuses.block - Math.min(blockAbsorb, state.playerStatuses.block),
    },
  };

  if (nextState.trinketEffects.vanguardCrestForgeOnBlockAbsorb > 0 && blockAbsorb > 0 && remainingDamage === 0) {
    nextState = {
      ...nextState,
      playerStatuses: {
        ...nextState.playerStatuses,
        forge: nextState.playerStatuses.forge + nextState.trinketEffects.vanguardCrestForgeOnBlockAbsorb,
      },
    };
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "status",
      stat: "forge",
      amount: nextState.trinketEffects.vanguardCrestForgeOnBlockAbsorb,
    });
  }

  nextState = checkHealthThresholds(prevHealth, nextState.playerHealth, nextState, combatTexts);

  if (actualDamage > 0 && nextState.playerStatuses.armor > 0) {
    nextState = {
      ...nextState,
      playerStatuses: {
        ...nextState.playerStatuses,
        armor: nextState.playerStatuses.armor - 1,
      },
    };
  }

  // Enemy forge decays by 1 per physical attack that deals damage (mirrors player forge consumption).
  if (actualDamage > 0 && effect.damageType === "physical" && nextState.enemyForge > 0) {
    nextState = { ...nextState, enemyForge: nextState.enemyForge - 1 };
  }

  if (effect.lifesteal && actualDamage > 0) {
    nextState = {
      ...nextState,
      enemyHealth: clampHealth(nextState.enemyHealth, actualDamage, nextState.enemyMaxHealth),
    };
    mergeCombatText(combatTexts, { target: "enemy", kind: "heal", stat: "health", amount: actualDamage });
  }

  return nextState;
}

function processEnemyAttack(state: BattleState, combatTexts: CombatTextEvent[]) {
  let nextState = state;

  for (const effect of state.enemyAttackEffects) {
    if (effect.kind === "damage") {
      nextState = processEnemyDamageEffect(nextState, effect, combatTexts);
    } else if (effect.kind === "player-status") {
      const status = effect.status;
      const baseAmount = effect.amount;
      const extraFreeze = status === "freeze" ? state.enemyFreezeBonus : 0;
      const amount = baseAmount + extraFreeze;

      const blockPreventsStatus =
        nextState.playerStatuses.block > 0 &&
        ((status === "bleed" && state.talentEffects.blockPreventsBleed) ||
          (status === "poison" && state.talentEffects.blockPreventsPoison) ||
          (status === "stun" && state.talentEffects.blockPreventsStun));

      if (harmfulPlayerStatusIds.includes(status)) {
        if (
          !blockPreventsStatus &&
          nextState.trinketEffects.plagueDoctorImmunity &&
          !nextState.flags.firstHarmfulStatusPrevented
        ) {
          nextState = { ...nextState, flags: { ...nextState.flags, firstHarmfulStatusPrevented: true } };
          continue;
        }
        nextState = {
          ...nextState,
          playerStatuses: {
            ...nextState.playerStatuses,
            ...(blockPreventsStatus ? {} : { [status]: nextState.playerStatuses[status] + amount }),
          },
        };
        mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: status, amount });
      } else {
        nextState = {
          ...nextState,
          playerStatuses: {
            ...nextState.playerStatuses,
            [status]: nextState.playerStatuses[status] + amount,
          },
        };
        mergeCombatText(combatTexts, { target: "player", kind: "status", stat: status, amount });
      }
    }
  }

  return nextState;
}

function processEnemyRegeneration(state: BattleState, combatTexts: CombatTextEvent[]) {
  if (state.enemyRegeneration <= 0) return state;
  let healAmount = state.enemyRegeneration;
  if (state.enemyStatuses.poison > 0 && state.talentEffects.poisonHalvesHealing) {
    healAmount = Math.round(healAmount / HALF_DIVISOR);
  }
  if (healAmount <= 0) return state;
  mergeCombatText(combatTexts, { target: "enemy", kind: "heal", stat: "health", amount: healAmount });
  return { ...state, enemyHealth: clampHealth(state.enemyHealth, healAmount, state.enemyMaxHealth) };
}

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
  if (state.deathsDoorTriggeredTurn === state.turn) return state;
  return { ...state, deathsDoorActive: false, deathsDoorTriggeredTurn: null };
}

function processEnemyTraits(state: BattleState, combatTexts: CombatTextEvent[]) {
  let nextState = state;

  if (nextState.currentEnemy.traits.some((t) => t.id === "rusting-carapace")) {
    nextState = {
      ...nextState,
      enemyForge: nextState.enemyForge + TRAIT_FORGE_PER_TURN,
    };
  }

  if (nextState.currentEnemy.traits.some((t) => t.id === "iron-hide")) {
    nextState = {
      ...nextState,
      enemyArmor: nextState.enemyArmor + IRON_HIDE_ARMOR_PER_TURN,
    };
    mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: "armor", amount: IRON_HIDE_ARMOR_PER_TURN });
  }

  if (nextState.currentEnemy.traits.some((t) => t.id === "glacial-shell")) {
    nextState = { ...nextState, enemyFreezeBonus: nextState.enemyFreezeBonus + TRAIT_FREEZE_BONUS_PER_TURN };
  }

  if (nextState.difficultyModifiers.some((m: DifficultyModifier) => m.kind === "enemy-gains-forge-each-turn")) {
    nextState = {
      ...nextState,
      enemyForge: nextState.enemyForge + DIFFICULTY_FORGE_PER_TURN,
    };
    mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: "forge", amount: DIFFICULTY_FORGE_PER_TURN });
  }

  if (nextState.difficultyModifiers.some((m: DifficultyModifier) => m.kind === "labyrinth-leeching")) {
    nextState = {
      ...nextState,
      enemyHealth: clampHealth(nextState.enemyHealth, LABYRINTH_LEECH_HEAL, nextState.enemyMaxHealth),
    };
    mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: "health", amount: LABYRINTH_LEECH_HEAL });
  }

  if (nextState.difficultyModifiers.some((m: DifficultyModifier) => m.kind === "labyrinth-burning-ground")) {
    nextState = {
      ...nextState,
      playerStatuses: {
        ...nextState.playerStatuses,
        burn: nextState.playerStatuses.burn + LABYRINTH_BURNING_GROUND_DAMAGE,
      },
    };
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "status",
      stat: "burn",
      amount: LABYRINTH_BURNING_GROUND_DAMAGE,
    });
  }

  return nextState;
}

function processHasteEarlyTurn(state: BattleState, _combatTexts: CombatTextEvent[]) {
  return {
    ...state,
    playerStatuses: { ...state.playerStatuses, haste: state.playerStatuses.haste - 1 },
  };
}

function processStunSkipTurn(state: BattleState, combatTexts: CombatTextEvent[]) {
  const nextState = reduceSkipTurns(state);
  return tickPlayerStatuses(nextState, combatTexts);
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
};

function finalizePlayerTurn(state: BattleState, combatTexts: CombatTextEvent[]) {
  let nextState = applyIronwoodBuckler(state, combatTexts);
  nextState = resolveDeathsDoorEndOfEnemyTurn(nextState);
  const finalState = advanceToPlayerTurn(nextState);
  return { state: finalState, combatTexts, playerTurnSkipped: finalState.turnPhase === "enemy" };
}

export function endPlayerTurn(state: BattleState): EndPlayerTurnResolution {
  const combatTexts: CombatTextEvent[] = [];
  const enemyTurnStartCombatTexts: CombatTextEvent[] = [];
  const enemyResolutionCombatTexts: CombatTextEvent[] = [];
  let nextState = beginEnemyPhase(state);

  if (state.playerStatuses.haste > 0) {
    nextState = processHasteEarlyTurn(nextState, combatTexts);
    return { ...finalizePlayerTurn(nextState, combatTexts), enemyTurnStartCombatTexts, enemyResolutionCombatTexts };
  }

  if (state.enemyStunSkipTurns + state.enemyFreezeSkipTurns > 0) {
    nextState = processStunSkipTurn(nextState, combatTexts);
    return { ...finalizePlayerTurn(nextState, combatTexts), enemyTurnStartCombatTexts, enemyResolutionCombatTexts };
  }

  nextState = tickEnemyStatuses(nextState, enemyTurnStartCombatTexts);
  combatTexts.push(...enemyTurnStartCombatTexts);
  const enemyTurnStartState = nextState;

  if (nextState.enemyHealth <= 0) {
    return {
      ...finalizePlayerTurn(nextState, combatTexts),
      enemyTurnStartState,
      enemyTurnStartCombatTexts,
      enemyResolutionCombatTexts,
    };
  }

  nextState = processEnemyTraits(nextState, enemyResolutionCombatTexts);
  nextState = processEnemyAttack(nextState, enemyResolutionCombatTexts);
  nextState = tickPlayerStatuses(nextState, enemyResolutionCombatTexts);
  nextState = processEnemyRegeneration(nextState, enemyResolutionCombatTexts);
  combatTexts.push(...enemyResolutionCombatTexts);

  return {
    ...finalizePlayerTurn(nextState, combatTexts),
    enemyTurnStartState,
    enemyTurnStartCombatTexts,
    enemyResolutionCombatTexts,
  };
}
