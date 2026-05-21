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
import { applyPlayerStatusFromAttack } from "./status-application";
import { decayHalvedStatus } from "./status-helpers";
import { tickEnemyStatuses, tickPlayerStatuses } from "./status-ticks";
import type { BattleCard, EnemyAttackEffect, TalentEffectManifest } from "@/lib/game-data/types";
import type { DifficultyModifier } from "@/lib/game-data/difficulties";
import {
  applyPlayerCombatDamage,
  applyPlayerHealing,
  clampHealth,
  type BattleState,
  type CombatTextEvent,
  type TurnPhase,
} from "./types";
import { CARDS_PER_TURN, MAX_HAND_SIZE, BATTLE_CONFIG } from "../game-constants";
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

function buildCompanionCard(
  activeCompanion: NonNullable<BattleState["activeCompanion"]>,
  talentEffects: TalentEffectManifest,
  trinketEffects: BattleState["trinketEffects"],
  companionDamageBuff: number,
  companionBondLevel: number,
): BattleCard {
  return {
    id: `companion-${activeCompanion.id}`,
    title: activeCompanion.title,
    descriptionLines: [],
    art: activeCompanion.art,
    cost: 0,
    effects: activeCompanion.turnStartEffects.map((e) =>
      e.kind === "damage"
        ? {
            ...e,
            amount:
              e.amount +
              companionBondLevel +
              talentEffects.companionDamage +
              trinketEffects.companionDamageBonus +
              companionDamageBuff,
          }
        : e,
    ),
  };
}

export function processCompanionTurnStart(state: BattleState, combatTexts: CombatTextEvent[]) {
  if (!state.activeCompanion || state.enemyHealth <= 0) return state;
  const companionBondLevel = state.talentEffects.companionBondLevels[state.activeCompanion.id] ?? 0;

  const companionCard = buildCompanionCard(
    state.activeCompanion,
    state.talentEffects,
    state.trinketEffects,
    state.companionDamageBuff,
    companionBondLevel,
  );

  const savedFlags = {
    firstBurnCardDoubledUsed: state.flags.firstBurnCardDoubledUsed,
    firstBurnTrinketDoubledUsed: state.flags.firstBurnTrinketDoubledUsed,
    firstHolyDamageBonusUsed: state.flags.firstHolyDamageBonusUsed,
    goldOnFirstPoisonThisCombat: state.flags.goldOnFirstPoisonThisCombat,
  };

  const result = applyCardEffects(state, companionCard, combatTexts);

  return { ...result, flags: { ...result.flags, ...savedFlags } };
}

function handleCCSkipTurn(state: BattleState): BattleState {
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

function performDrawAndResetPhase(state: BattleState, deathsDoorNeedsRecoveryTurn: boolean): BattleState {
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
  combatTexts: CombatTextEvent[],
) {
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
  return actualDamage;
}

function calculateBlockAndArmorMitigation(
  state: BattleState,
  effect: EnemyAttackEffect & { kind: "damage" },
  combatTexts: CombatTextEvent[],
) {
  let remainingDamage = applyPhysicalForgeBonus(state, effect);
  const effectiveBlock = computeEffectiveBlock(state, effect);
  const blockAbsorb = Math.min(remainingDamage, effectiveBlock);
  remainingDamage -= blockAbsorb;
  if (blockAbsorb > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "block", amount: blockAbsorb });
  }
  const actualDamage = computeMitigatedDamage(state, effect, remainingDamage, combatTexts);
  return { remainingDamage, blockAbsorb, actualDamage };
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
  let nextState = state;

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
    const armorBefore = nextState.playerStatuses.armor;
    nextState = {
      ...nextState,
      playerStatuses: {
        ...nextState.playerStatuses,
        armor: nextState.playerStatuses.armor - BATTLE_CONFIG.ARMOR_DECAY_AMOUNT,
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
  }

  // Enemy forge decays by 1 per physical attack that deals damage (mirrors player forge consumption).
  if (actualDamage > 0 && damageType === "physical" && nextState.enemyMitigation.forge > 0) {
    nextState = {
      ...nextState,
      enemyMitigation: {
        ...nextState.enemyMitigation,
        forge: nextState.enemyMitigation.forge - BATTLE_CONFIG.FORGE_DECAY_AMOUNT,
      },
    };
  }

  return nextState;
}

function applyEnemyAttackLifesteal(
  state: BattleState,
  actualDamage: number,
  combatTexts: CombatTextEvent[],
): BattleState {
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

  if (
    state.talentEffects.blockDepletedHeal > 0 &&
    state.playerStatuses.block > 0 &&
    nextState.playerStatuses.block <= 0
  ) {
    nextState = applyPlayerHealing(nextState, state.talentEffects.blockDepletedHeal);
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
  let healAmount = state.enemyRegeneration;
  if (state.enemyStatuses.poison > 0 && state.talentEffects.poisonHalvesHealing) {
    healAmount = Math.round(healAmount / HALF_DIVISOR);
  }
  if (healAmount <= 0) return state;
  mergeCombatText(combatTexts, { target: "enemy", kind: "heal", stat: "health", amount: healAmount });
  return { ...state, enemyHealth: clampHealth(state.enemyHealth, healAmount, state.enemyMaxHealth) };
}

type EnemyTurnStartHandler = (state: BattleState, combatTexts: CombatTextEvent[]) => BattleState;

const enemyTraitTurnStartHandlers: Record<string, EnemyTurnStartHandler> = {
  "rusting-carapace": (state) => ({
    ...state,
    enemyMitigation: {
      ...state.enemyMitigation,
      forge: state.enemyMitigation.forge + TRAIT_FORGE_PER_TURN,
    },
  }),
  "iron-hide": (state, combatTexts) => {
    mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: "armor", amount: IRON_HIDE_ARMOR_PER_TURN });
    return {
      ...state,
      enemyMitigation: {
        ...state.enemyMitigation,
        armor: state.enemyMitigation.armor + IRON_HIDE_ARMOR_PER_TURN,
      },
    };
  },
  "glacial-shell": (state) => ({
    ...state,
    enemyMitigation: {
      ...state.enemyMitigation,
      freezeBonus: state.enemyMitigation.freezeBonus + TRAIT_FREEZE_BONUS_PER_TURN,
    },
  }),
};

const difficultyTurnStartHandlers: Record<DifficultyModifier["kind"], EnemyTurnStartHandler | undefined> = {
  "enemy-gains-forge-each-turn": (state, combatTexts) => {
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
  "increase-enemy-physical-damage": undefined,
  "increase-enemy-damage": undefined,
  "increase-enemy-status": undefined,
  "enemy-attacks-gain-leech": undefined,
  "enemy-starting-armor": undefined,
  "start-block": undefined,
  "start-max-mana": undefined,
  "start-companion": undefined,
  "gold-multiplier": undefined,
  "labyrinth-sturdy": undefined,
  "labyrinth-null-field": undefined,
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
  if (state.deathsDoorTriggeredTurn === state.turn) return state;
  return { ...state, deathsDoorActive: false, deathsDoorTriggeredTurn: null };
}

function processEnemyTraits(state: BattleState, combatTexts: CombatTextEvent[]) {
  let nextState = state;

  for (const trait of nextState.currentEnemy.traits) {
    const handler = enemyTraitTurnStartHandlers[trait.id];
    if (handler) nextState = handler(nextState, combatTexts);
  }

  for (const modifier of nextState.difficultyModifiers) {
    const handler = difficultyTurnStartHandlers[modifier.kind];
    if (handler) nextState = handler(nextState, combatTexts);
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

function resolveHasteTurn(
  state: BattleState,
  combatTexts: CombatTextEvent[],
  enemyTurnStartCombatTexts: CombatTextEvent[],
  enemyResolutionCombatTexts: CombatTextEvent[],
) {
  const nextState = processHasteEarlyTurn(state, combatTexts);
  return { ...finalizePlayerTurn(nextState, combatTexts), enemyTurnStartCombatTexts, enemyResolutionCombatTexts };
}

function resolveSkippedEnemyTurn(
  state: BattleState,
  combatTexts: CombatTextEvent[],
  enemyTurnStartCombatTexts: CombatTextEvent[],
  enemyResolutionCombatTexts: CombatTextEvent[],
) {
  const nextState = processStunSkipTurn(state, combatTexts);
  return { ...finalizePlayerTurn(nextState, combatTexts), enemyTurnStartCombatTexts, enemyResolutionCombatTexts };
}

function resolveEnemyTurnStart(state: BattleState, combatTexts: CombatTextEvent[], phaseTexts: CombatTextEvent[]) {
  const nextState = tickEnemyStatuses(state, phaseTexts);
  combatTexts.push(...phaseTexts);
  return nextState;
}

function resolveEnemyAction(state: BattleState, combatTexts: CombatTextEvent[], phaseTexts: CombatTextEvent[]) {
  let nextState = processEnemyTraits(state, phaseTexts);
  nextState = processEnemyAttack(nextState, phaseTexts);
  nextState = tickPlayerStatuses(nextState, phaseTexts);
  nextState = processEnemyRegeneration(nextState, phaseTexts);
  combatTexts.push(...phaseTexts);
  return nextState;
}

export function endPlayerTurn(state: BattleState): EndPlayerTurnResolution {
  const combatTexts: CombatTextEvent[] = [];
  const enemyTurnStartCombatTexts: CombatTextEvent[] = [];
  const enemyResolutionCombatTexts: CombatTextEvent[] = [];
  let nextState = beginEnemyPhase(state);

  if (state.playerStatuses.haste > 0) {
    return resolveHasteTurn(nextState, combatTexts, enemyTurnStartCombatTexts, enemyResolutionCombatTexts);
  }

  if (state.enemyStunSkipTurns + state.enemyFreezeSkipTurns > 0) {
    return resolveSkippedEnemyTurn(nextState, combatTexts, enemyTurnStartCombatTexts, enemyResolutionCombatTexts);
  }

  nextState = resolveEnemyTurnStart(nextState, combatTexts, enemyTurnStartCombatTexts);
  const enemyTurnStartState = nextState;

  if (nextState.enemyHealth <= 0) {
    return {
      ...finalizePlayerTurn(nextState, combatTexts),
      enemyTurnStartState,
      enemyTurnStartCombatTexts,
      enemyResolutionCombatTexts,
    };
  }

  nextState = resolveEnemyAction(nextState, combatTexts, enemyResolutionCombatTexts);

  return {
    ...finalizePlayerTurn(nextState, combatTexts),
    enemyTurnStartState,
    enemyTurnStartCombatTexts,
    enemyResolutionCombatTexts,
  };
}
