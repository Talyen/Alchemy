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
import type { EnemyAttackEffect } from "@/lib/game-data/types";
import type { DifficultyModifier } from "@/lib/game-data/difficulties";
import { logError } from "../error-logger";
import {
  applyPlayerCombatDamage,
  applyPlayerHealing,
  clampHealth,
  type BattleState,
  type CombatTextEvent,
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

function isFreezeBlockingRegen(state: BattleState): boolean {
  return state.enemyFreezeSkipTurns > 0 && state.talentEffects.freezeBlocksRegen;
}

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
    turnPhase: "enemy",
    playerStunSkipTurns: Math.max(0, state.playerStunSkipTurns - 1),
    playerFreezeSkipTurns: Math.max(0, state.playerFreezeSkipTurns - 1),
  };
}

function performDrawAndResetPhase(state: BattleState, deathsDoorNeedsRecoveryTurn: boolean): BattleState {
  // Hand is cleared by moving all cards to discard before drawing a fresh hand.
  const nextDraw = drawCards(state.deck, state.discard, [], CARDS_PER_TURN, state.nextCardUid);
  const nextState = resetPlayerTurnState(state);
  const hadUnspentMana = state.mana > 0;
  const wellspringBonus =
    hadUnspentMana && state.talentEffects.wellspringKeepMana > 0 ? state.talentEffects.wellspringKeepMana : 0;
  return {
    ...nextState,
    turnPhase: "player",
    deck: nextDraw.deck,
    hand: nextDraw.hand,
    discard: nextDraw.discard,
    nextCardUid: nextDraw.nextCardUid,
    mana: nextState.maxMana + wellspringBonus,
    playerStunSkipTurns: deathsDoorNeedsRecoveryTurn ? 0 : nextState.playerStunSkipTurns,
    playerFreezeSkipTurns: deathsDoorNeedsRecoveryTurn ? 0 : nextState.playerFreezeSkipTurns,
  };
}

function advanceToPlayerTurn(state: BattleState) {
  // If Death's Door is active and player at 0 HP, override CC — they get one full turn.
  // CC skip turns are zeroed to prevent dying to DoT ticks while CC'd.
  const deathsDoorNeedsRecoveryTurn = state.deathsDoorActive && state.playerHealth <= 0;

  let nextState = state;
  if (deathsDoorNeedsRecoveryTurn) {
    let remaining = state.deathsDoorGraceTurnsRemaining;
    if (remaining === null || remaining === undefined) {
      if (state.deathsDoorTriggeredTurn !== null) {
        const graceTurns = 1 + Math.max(0, state.talentEffects.deathsDoorExtension ?? 0);
        remaining = graceTurns - (state.turn - state.deathsDoorTriggeredTurn);
      } else {
        remaining = 1 + Math.max(0, state.talentEffects.deathsDoorExtension ?? 0);
      }
    }
    nextState = {
      ...state,
      deathsDoorGraceTurnsRemaining: remaining - 1,
    };
  }

  if (!deathsDoorNeedsRecoveryTurn && state.playerStunSkipTurns + state.playerFreezeSkipTurns > 0) {
    return handleCCSkipTurn(nextState);
  }

  return performDrawAndResetPhase(nextState, deathsDoorNeedsRecoveryTurn);
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
  if (effect.damageType !== "physical") return effect.amount;
  return effect.amount + state.enemyMitigation.forge;
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
  if (state.enemyStatuses.poison > 0) {
    remainingDamage = Math.max(0, remainingDamage - state.talentEffects.poisonReducesEnemyDamage);
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
      armor: Math.max(0, state.playerStatuses.armor - BATTLE_CONFIG.ARMOR_DECAY_AMOUNT),
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
  nextState = applyArmorDecayOnHit(nextState, actualDamage, combatTexts);
  nextState = applyEnemyForgeDecayOnHit(nextState, actualDamage, damageType);
  return nextState;
}

function applyEnemyAttackLifesteal(
  state: BattleState,
  actualDamage: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (isFreezeBlockingRegen(state)) return state;
  if (state.talentEffects.blockEnemyLeech) return state;
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
    ...applyPlayerCombatDamage(state, actualDamage, effect.damageType),
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
    } else {
      logError(`Unknown enemy attack effect kind: ${(effect as { kind: string }).kind}`, "battle", {
        state: nextState,
      });
    }
  }

  return nextState;
}

function processEnemyRegeneration(state: BattleState, combatTexts: CombatTextEvent[]) {
  if (state.enemyRegeneration <= 0) return state;
  if (isFreezeBlockingRegen(state)) return state;
  let healAmount = state.enemyRegeneration;
  if (state.enemyStatuses.poison > 0 && state.talentEffects.poisonHalvesHealing) {
    healAmount = Math.round(healAmount / HALF_DIVISOR);
  }
  if (state.enemyStatuses.bleed > 0 && state.talentEffects.bleedHalvesEnemyHealing) {
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
    const scaledArmor = Math.round(IRON_HIDE_ARMOR_PER_TURN * state.roomScalingMultiplier);
    const scaledForge = Math.round(TRAIT_FORGE_PER_TURN * state.roomScalingMultiplier);
    const scaledBurn = Math.round(IRON_HIDE_BURN_BONUS_PER_TURN * state.roomScalingMultiplier);
    const roll = options?.traitRoll ?? state.rng();
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
    if (isFreezeBlockingRegen(state)) return state;
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
  // Reduced AFTER traits so isScalingBlocked still sees the pre-reduction freeze
  // count for one more turn — the enemy doesn't benefit from freeze reduction in the
  // same turn freeze was applied.
  return {
    ...state,
    enemyStunSkipTurns: Math.max(0, state.enemyStunSkipTurns - 1),
    enemyFreezeSkipTurns: Math.max(0, state.enemyFreezeSkipTurns - 1),
  };
}

// Death's Door grants a grace period of (1 + extension) full player turns after hitting 0 HP.
// The grace turns counter is initialized on trigger and decremented when a player recovery turn begins.
// resolveDeathsDoorEndOfEnemyTurn runs at the end of the enemy phase and deactivates the grace window
// once the remaining turns counter reaches 0 or less.
function resolveDeathsDoorEndOfEnemyTurn(state: BattleState): BattleState {
  if (!state.deathsDoorActive) return state;
  if (state.playerHealth > 0) {
    return {
      ...state,
      deathsDoorActive: false,
      deathsDoorTriggeredTurn: null,
      deathsDoorGraceTurnsRemaining: null,
    };
  }

  let remaining = state.deathsDoorGraceTurnsRemaining;
  if (remaining === null || remaining === undefined) {
    if (state.deathsDoorTriggeredTurn !== null) {
      const graceTurns = 1 + Math.max(0, state.talentEffects.deathsDoorExtension ?? 0);
      remaining = graceTurns - (state.turn - state.deathsDoorTriggeredTurn);
    } else {
      return state;
    }
  }

  if (remaining <= 0) {
    return {
      ...state,
      deathsDoorActive: false,
      deathsDoorTriggeredTurn: null,
      deathsDoorGraceTurnsRemaining: null,
    };
  }
  return state;
}

// Traits whose behavior is purely passive (damage multipliers, one-time setup, etc.)
// and intentionally have no turn-start handler. Excludes warnings to reduce noise.
const PASSIVE_ONLY_TRAITS = new Set([
  "brittle-bones",
  "trinket-hoarder",
  "holy-vulnerability",
  "burn-resistance",
  "burn-vulnerability",
  "living-armor",
  "thick-hide",
  "poison-resistance",
  "gold-trove",
  "starting-block",
  "regeneration",
]);

function processEnemyTraits(state: BattleState, combatTexts: CombatTextEvent[], options?: { traitRoll?: number }) {
  let nextState = state;
  const scalingBlocked = isScalingBlocked(nextState);
  const traitRoll = options?.traitRoll ?? nextState.rng();

  if (!scalingBlocked) {
    for (const trait of nextState.currentEnemy.traits) {
      const handler = enemyTraitTurnStartHandlers[trait.id];
      if (handler) {
        nextState = handler(nextState, combatTexts, { traitRoll });
      } else if (!PASSIVE_ONLY_TRAITS.has(trait.id)) {
        logError(`No turn-start handler for trait: ${trait.id}`, "battle", { state: nextState });
      }
    }
  }

  for (const modifier of nextState.difficultyModifiers) {
    const handler = difficultyTurnStartHandlers[modifier.kind];
    if (!handler) continue;
    if (modifier.kind === "enemy-gains-forge-each-turn" && scalingBlocked) continue;
    nextState = handler(nextState, combatTexts);
  }

  return nextState;
}

function processHasteEarlyTurn(state: BattleState): BattleState {
  return {
    ...state,
    playerStatuses: { ...state.playerStatuses, haste: Math.max(0, state.playerStatuses.haste - 1) },
  };
}

function beginEnemyPhase(state: BattleState): BattleState {
  return {
    ...state,
    turnPhase: "enemy",
    hand: [],
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
  /** Battle state immediately after the enemy attack but before player DoT ticks.
   *  Used by the balance sim's anomaly detector to capture peak player status values
   *  (e.g., bleed) that are consumed by tickPlayerStatuses in the same resolution step. */
  afterAttackState?: BattleState;
};

function finalizePlayerTurn(state: BattleState, combatTexts: CombatTextEvent[]) {
  let nextState = applyIronwoodBuckler(state, combatTexts);
  nextState = resolveDeathsDoorEndOfEnemyTurn(nextState);
  const finalState = advanceToPlayerTurn(nextState);
  return { state: finalState, combatTexts, playerTurnSkipped: finalState.turnPhase === "enemy" };
}

type CombatTextResult = { state: BattleState; texts: CombatTextEvent[] };

function resolveHasteTurn(state: BattleState) {
  const combatTexts: CombatTextEvent[] = [];
  const nextState = processHasteEarlyTurn(state);
  return {
    ...finalizePlayerTurn(nextState, combatTexts),
    enemyTurnStartCombatTexts: [] as CombatTextEvent[],
    enemyResolutionCombatTexts: [] as CombatTextEvent[],
    enemyPerformedAttack: false,
  };
}

function resolveSkippedEnemyTurn(state: BattleState, options?: { traitRoll?: number }) {
  const enemyTurnStartCombatTexts: CombatTextEvent[] = [];
  const enemyResolutionCombatTexts: CombatTextEvent[] = [];
  let nextState = state;

  // Turn start: tick enemy DoTs (burn/poison/bleed)
  nextState = tickEnemyStatuses(nextState, enemyTurnStartCombatTexts);
  const enemyTurnStartState = nextState;

  // Resolution: traits, player DoTs, regen — but skip the attack.
  nextState = processEnemyTraits(nextState, enemyResolutionCombatTexts, options);
  nextState = reduceSkipTurns(nextState);
  nextState = tickPlayerStatuses(nextState, enemyResolutionCombatTexts);
  nextState = processEnemyRegeneration(nextState, enemyResolutionCombatTexts);

  const combatTexts = [...enemyTurnStartCombatTexts, ...enemyResolutionCombatTexts];

  return {
    ...finalizePlayerTurn(nextState, combatTexts),
    enemyTurnStartState,
    enemyTurnStartCombatTexts,
    enemyResolutionCombatTexts,
    enemyPerformedAttack: false,
  };
}

function resolveEnemyTurnStart(state: BattleState): CombatTextResult {
  const texts: CombatTextEvent[] = [];
  const nextState = tickEnemyStatuses(state, texts);
  return { state: nextState, texts };
}

function resolveEnemyAction(
  state: BattleState,
  options?: { traitRoll?: number },
): CombatTextResult & { afterAttackState: BattleState } {
  const texts: CombatTextEvent[] = [];
  let nextState = processEnemyTraits(state, texts, options);
  nextState = processEnemyAttack(nextState, texts);
  const afterAttackState = nextState;
  nextState = tickPlayerStatuses(nextState, texts);
  nextState = processEnemyRegeneration(nextState, texts);
  return { state: nextState, texts, afterAttackState };
}

export function endPlayerTurn(state: BattleState, options?: { traitRoll?: number }): EndPlayerTurnResolution {
  const nextState = beginEnemyPhase(state);

  if (state.playerStatuses.haste > 0) {
    return resolveHasteTurn(nextState);
  }

  if (state.enemyStunSkipTurns + state.enemyFreezeSkipTurns > 0) {
    return resolveSkippedEnemyTurn(nextState, options);
  }

  const startResult = resolveEnemyTurnStart(nextState);
  const enemyTurnStartState = startResult.state;
  const enemyTurnStartCombatTexts = startResult.texts;

  if (enemyTurnStartState.enemyHealth <= 0) {
    return {
      ...finalizePlayerTurn(enemyTurnStartState, []),
      enemyTurnStartState,
      enemyTurnStartCombatTexts,
      enemyResolutionCombatTexts: [],
      enemyPerformedAttack: false,
    };
  }

  const actionResult = resolveEnemyAction(enemyTurnStartState, options);
  const combatTexts = [...enemyTurnStartCombatTexts, ...actionResult.texts];

  return {
    ...finalizePlayerTurn(actionResult.state, combatTexts),
    enemyTurnStartState,
    enemyTurnStartCombatTexts,
    enemyResolutionCombatTexts: actionResult.texts,
    enemyPerformedAttack: true,
    afterAttackState: actionResult.afterAttackState,
  };
}
