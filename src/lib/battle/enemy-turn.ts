// Enemy turn processing: wish resolution, companion turn, enemy phase, and turn reset.
// Depends on draw/effect helpers, status ticks, game-data attack shapes, and combat constants.
//
// Turn lifecycle (TurnPhase: "player" | "enemy"):
//   1. Player turn starts: draw cards, process haste (skip enemy phase if hasted),
//      process companion attack, player plays cards.
//   2. End player turn: resolve companion effects, tick player DoTs.
//   3. Enemy turn: tick enemy DoTs, enemy heals (below 50% HP), apply traits
//      (armor/forge/freeze per turn), run attack effects, tick player DoTs again
//      (if enemy hit), check Death's Door (0-HP grace for one full turn).
//   4. Advance to player turn: draw cards, reset cardsPlayedThisTurn.
// Branching: stun/freeze skip enemy attack phase entirely; Wish intercepts player
// card play; haste skips enemy phase and returns to player immediately.
import { drawCards } from "./draw";
import { applyCardEffects } from "./apply-effects";
import { mergeCombatText } from "./combat-text";
import { applyIronwoodBuckler } from "./trinket-effects";
import { tickEnemyStatuses, tickPlayerStatuses } from "./status-ticks";
import { harmfulPlayerStatusIds } from "@/lib/game-data";
import type { BattleCard, EnemyAttackEffect } from "@/lib/game-data/types";
import type { DifficultyModifier } from "@/lib/game-data/difficulties";
import { applyPlayerCombatDamage, clampHealth, type BattleState, type CombatTextEvent, type TurnPhase } from "./types";
import { CARDS_PER_TURN, MAX_HAND_SIZE } from "../game-constants";
import { DIFFICULTY_FORGE_PER_TURN, ENEMY_HEAL_FRACTION, HALF_DIVISOR, PERCENT_DENOMINATOR, TRAIT_ARMOR_PER_TURN, TRAIT_FORGE_PER_TURN, TRAIT_FREEZE_BONUS_PER_TURN } from "../game-constants";

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

  const companionCard: BattleCard = {
    id: `companion-${state.activeCompanion.id}`,
    title: state.activeCompanion.title,
    descriptionLines: [],
    art: state.activeCompanion.art,
    cost: 0,
    effects: state.activeCompanion.turnStartEffects.map((e) =>
      e.kind === "damage"
        ? { ...e, amount: e.amount + state.talentEffects.companionDamage + state.trinketEffects.companionDamageBonus }
        : e,
    ),
  };

  const savedFlags = {
    firstBurnCardDoubledUsed: state.flags.firstBurnCardDoubledUsed,
    firstBurnTrinketDoubledUsed: state.flags.firstBurnTrinketDoubledUsed,
    firstHolyDamageBonusUsed: state.flags.firstHolyDamageBonusUsed,
  };

  const result = applyCardEffects(state, companionCard, combatTexts);

  return { ...result, flags: { ...result.flags, ...savedFlags } };
}

function advanceToPlayerTurn(state: BattleState) {
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
    playerStatuses: { ...state.playerStatuses, block: Math.floor((state.playerStatuses.block ?? 0) / HALF_DIVISOR) },
    cardsPlayedThisTurn: 0,
    flags: { ...state.flags, resonantChimeUsedThisTurn: false, nextCardCostReduction: 0 },
  };
}

function processEnemyHealing(state: BattleState, combatTexts: CombatTextEvent[]) {
  if (state.enemyHealth >= state.enemyMaxHealth / HALF_DIVISOR) return state;
  let healAmount = Math.floor(state.enemyMaxHealth * ENEMY_HEAL_FRACTION);
  if (state.enemyStatuses.poison > 0 && state.talentEffects.poisonHalvesHealing) {
    healAmount = Math.floor(healAmount / HALF_DIVISOR);
  }
  if (healAmount <= 0) return state;
  mergeCombatText(combatTexts, { target: "enemy", kind: "heal", stat: "health", amount: healAmount });
  return { ...state, enemyHealth: clampHealth(state.enemyHealth, healAmount, state.enemyMaxHealth) };
}

function checkHealthThresholds(prevHealth: number, nextHealth: number, state: BattleState, combatTexts: CombatTextEvent[]) {
  let nextState = state;

  function applyHealthThresholdStatBonus(config: { threshold: number; amount: number } | null, stat: "block" | "armor") {
    if (!config) return;
    const thresholdHp = state.playerMaxHealth * config.threshold / PERCENT_DENOMINATOR;
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

function processEnemyDamageEffect(state: BattleState, effect: EnemyAttackEffect & { kind: "damage" }, combatTexts: CombatTextEvent[]) {
  let remainingDamage = effect.amount;

  if (effect.damageType === "physical") {
    remainingDamage = Math.max(0, remainingDamage - state.talentEffects.bleedEnemyDamageReduction);
    remainingDamage += state.enemyForge;
  }

  let effectiveBlock = state.playerStatuses.block;
  if (effect.damageType === "physical" && state.talentEffects.blockAbsorbPhysicalBonus > 0) {
    effectiveBlock = Math.floor(effectiveBlock * (1 + state.talentEffects.blockAbsorbPhysicalBonus / PERCENT_DENOMINATOR));
  }

  const blockAbsorb = Math.min(remainingDamage, effectiveBlock);
  remainingDamage -= blockAbsorb;

  if (blockAbsorb > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "block", amount: blockAbsorb });
  }

  const rawDamage = effect.damageType === "physical"
    ? Math.max(0, remainingDamage - state.playerStatuses.armor)
    : remainingDamage;
  const actualDamage = effect.damageType === "holy" && state.talentEffects.receiveHalfHolyDamage ? Math.floor(rawDamage / HALF_DIVISOR) : rawDamage;

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
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "forge", amount: nextState.trinketEffects.vanguardCrestForgeOnBlockAbsorb });
  }

  nextState = checkHealthThresholds(prevHealth, nextState.playerHealth, nextState, combatTexts);

  if (effect.amount > 0 && nextState.playerStatuses.armor > 0) {
    nextState = {
      ...nextState,
      playerStatuses: {
        ...nextState.playerStatuses,
        armor: nextState.playerStatuses.armor - 1,
      },
    };
  }

  if (effect.lifesteal && actualDamage > 0) {
    nextState = { ...nextState, enemyHealth: clampHealth(nextState.enemyHealth, actualDamage, nextState.enemyMaxHealth) };
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

      if (nextState.playerStatuses.block > 0) {
        if (status === "bleed" && state.talentEffects.blockPreventsBleed) continue;
        if (status === "poison" && state.talentEffects.blockPreventsPoison) continue;
        if (status === "stun" && state.talentEffects.blockPreventsStun) continue;
      }

      if (harmfulPlayerStatusIds.includes(status)) {
        if (nextState.trinketEffects.plagueDoctorImmunity && !nextState.flags.firstHarmfulStatusPrevented) {
          nextState = { ...nextState, flags: { ...nextState.flags, firstHarmfulStatusPrevented: true } };
          continue;
        }
        const newHealth = clampHealth(nextState.playerHealth, -amount, nextState.playerMaxHealth);
        nextState = {
          ...nextState,
          playerHealth: newHealth,
          playerStatuses: {
            ...nextState.playerStatuses,
            [status]: nextState.playerStatuses[status] + amount,
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
  const healAmount = state.enemyRegeneration;
  mergeCombatText(combatTexts, { target: "enemy", kind: "heal", stat: "health", amount: healAmount });
  return { ...state, enemyHealth: clampHealth(state.enemyHealth, healAmount, state.enemyMaxHealth) };
}

function reduceSkipTurns(state: BattleState): BattleState {
  const newStun = state.enemyStunSkipTurns > 0 ? state.enemyStunSkipTurns - 1 : 0;
  const decFromStun = state.enemyStunSkipTurns - newStun;
  const newFreeze = state.enemyFreezeSkipTurns > 0 ? state.enemyFreezeSkipTurns - (1 - decFromStun) : 0;
  return { ...state, enemyStunSkipTurns: newStun, enemyFreezeSkipTurns: newFreeze };
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
      enemyArmor: nextState.enemyArmor + TRAIT_ARMOR_PER_TURN,
      enemyForge: nextState.enemyForge + TRAIT_FORGE_PER_TURN,
    };
    mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: "armor", amount: TRAIT_ARMOR_PER_TURN });
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

  return nextState;
}

function processHasteEarlyTurn(state: BattleState, combatTexts: CombatTextEvent[]) {
  const nextState = {
    ...state,
    playerStatuses: { ...state.playerStatuses, haste: state.playerStatuses.haste - 1 },
  };
  return tickPlayerStatuses(nextState, combatTexts);
}

function processStunSkipTurn(state: BattleState, combatTexts: CombatTextEvent[]) {
  const nextState = reduceSkipTurns(state);
  mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: "stun", amount: 0 });
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

function finalizePlayerTurn(state: BattleState, combatTexts: CombatTextEvent[]) {
  let nextState = applyIronwoodBuckler(state, combatTexts);
  nextState = resolveDeathsDoorEndOfEnemyTurn(nextState);
  return { state: advanceToPlayerTurn(nextState), combatTexts };
}

export function endPlayerTurn(state: BattleState): { state: BattleState; combatTexts: CombatTextEvent[] } {
  const combatTexts: CombatTextEvent[] = [];
  let nextState = beginEnemyPhase(state);

  if (state.playerStatuses.haste > 0) {
    nextState = processHasteEarlyTurn(nextState, combatTexts);
    return finalizePlayerTurn(nextState, combatTexts);
  }

  if (state.enemyStunSkipTurns + state.enemyFreezeSkipTurns > 0) {
    nextState = processStunSkipTurn(nextState, combatTexts);
    return finalizePlayerTurn(nextState, combatTexts);
  }

  nextState = processEnemyHealing(nextState, combatTexts);
  nextState = tickEnemyStatuses(nextState, combatTexts);

  if (nextState.enemyHealth <= 0) {
    return finalizePlayerTurn(nextState, combatTexts);
  }

  nextState = processEnemyTraits(nextState, combatTexts);
  nextState = processEnemyAttack(nextState, combatTexts);
  nextState = tickPlayerStatuses(nextState, combatTexts);
  nextState = processEnemyRegeneration(nextState, combatTexts);

  return finalizePlayerTurn(nextState, combatTexts);
}
