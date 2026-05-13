// Enemy turn processing: wish resolution, companion turn, enemy phase, and turn reset.
// Depends on draw/effect helpers, status ticks, game-data attack shapes, and combat constants.
import { drawCards } from "./draw";
import { applyBoneCharmHeal, applyCardEffects, applyIronwoodBuckler, mergeCombatText } from "./apply-effects";
import { tickEnemyStatuses, tickPlayerStatuses } from "./status-ticks";
import { harmfulPlayerStatusIds, type EnemyAttackEffect, type BattleCard } from "@/lib/game-data";
import { applyPlayerCombatDamage, cardsPerTurn, clampHealth, maxHandSize, type BattleState, type CombatTextEvent, type TurnPhase } from "./types";
import { ENEMY_HEAL_FRACTION, HALF_DIVISOR, PERCENT_DENOMINATOR } from "../game-constants";

export function chooseWishCard(state: BattleState, cardId: string) {
  const chosenCard = state.wishOptions?.find((card) => card.id === cardId);
  if (!chosenCard) {
    return state;
  }

  const [nextWishOptions = null, ...wishQueue] = state.wishQueue;

  if (state.hand.length < maxHandSize) {
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
    template: "nature",
    effects: state.activeCompanion.turnStartEffects.map((e) =>
      e.kind === "damage" ? { ...e, amount: e.amount + state.talentEffects.companionDamage } : e,
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

function advanceToPlayerTurn(state: BattleState, _combatTexts: CombatTextEvent[]) {
  const nextDraw = drawCards(state.deck, state.discard, [], cardsPerTurn, state.nextCardUid);
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

  function applyThreshold(config: { threshold: number; amount: number } | null, stat: "block" | "armor") {
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

  applyThreshold(state.talentEffects.healthThresholdBlock, "block");
  applyThreshold(state.talentEffects.healthThresholdArmor, "armor");
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
  const damageType: string = effect.damageType;
  const actualDamage = damageType === "holy" && state.talentEffects.receiveHalfHolyDamage ? Math.floor(rawDamage / HALF_DIVISOR) : rawDamage;

  if (actualDamage > 0) {
    const stat = effect.damageType === "physical" ? "health" : effect.damageType;
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat, amount: actualDamage });
  }

  const prevHealth = state.playerHealth;
  let st: BattleState = {
    ...state,
    ...applyPlayerCombatDamage(state, actualDamage),
    playerStatuses: {
      ...state.playerStatuses,
      block: state.playerStatuses.block - Math.min(blockAbsorb, state.playerStatuses.block),
    },
  };

  if (st.trinketEffects.vanguardCrestForgeOnBlockAbsorb > 0 && blockAbsorb > 0 && remainingDamage === 0) {
    st = {
      ...st,
      playerStatuses: {
        ...st.playerStatuses,
        forge: st.playerStatuses.forge + st.trinketEffects.vanguardCrestForgeOnBlockAbsorb,
      },
    };
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "forge", amount: st.trinketEffects.vanguardCrestForgeOnBlockAbsorb });
  }

  st = checkHealthThresholds(prevHealth, st.playerHealth, st, combatTexts);

  if (effect.amount > 0 && st.playerStatuses.armor > 0) {
    st = {
      ...st,
      playerStatuses: {
        ...st.playerStatuses,
        armor: st.playerStatuses.armor - 1,
      },
    };
  }

  if (effect.lifesteal && actualDamage > 0) {
    st = { ...st, enemyHealth: clampHealth(st.enemyHealth, actualDamage, st.enemyMaxHealth) };
    mergeCombatText(combatTexts, { target: "enemy", kind: "heal", stat: "health", amount: actualDamage });
  }

  return st;
}

function processEnemyAttack(state: BattleState, combatTexts: CombatTextEvent[]) {
  let nextState = state;

  for (const effect of state.enemyAttackEffects) {
    if (effect.kind === "damage") {
      nextState = processEnemyDamageEffect(nextState, effect, combatTexts);
    } else if (effect.kind === "player-status") {
      const status = effect.status;
      const amount = effect.amount;

      if (nextState.playerStatuses.block > 0) {
        if (status === "bleed" && state.talentEffects.blockPreventsBleed) continue;
        if (status === "poison" && state.talentEffects.blockPreventsPoison) continue;
        if (status === "stun" && state.talentEffects.blockPreventsStun) continue;
      }

      if (harmfulPlayerStatusIds.includes(status) && nextState.trinketEffects.plagueDoctorImmunity && !nextState.flags.firstHarmfulStatusPrevented) {
        nextState = { ...nextState, flags: { ...nextState.flags, firstHarmfulStatusPrevented: true } };
        continue;
      }

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

function finalizePlayerTurn(state: BattleState, combatTexts: CombatTextEvent[]) {
  let nextState = applyIronwoodBuckler(state, combatTexts);
  nextState = resolveDeathsDoorEndOfEnemyTurn(nextState);
  return { state: advanceToPlayerTurn(nextState, combatTexts), combatTexts };
}

export function endPlayerTurn(state: BattleState): { state: BattleState; combatTexts: CombatTextEvent[] } {
  const combatTexts: CombatTextEvent[] = [];

  let nextState: BattleState = {
    ...state,
    turnPhase: "enemy" as TurnPhase,
    hand: [],
    discard: [...state.discard, ...state.hand],
  };

  if (state.playerStatuses.haste > 0) {
    nextState = { ...nextState, playerStatuses: { ...nextState.playerStatuses, haste: nextState.playerStatuses.haste - 1 } };
    nextState = tickPlayerStatuses(nextState, combatTexts);
    return finalizePlayerTurn(nextState, combatTexts);
  }

  if (state.enemyStunSkipTurns + state.enemyFreezeSkipTurns > 0) {
    nextState = reduceSkipTurns(nextState);
    mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: "stun", amount: 0 });

    nextState = tickPlayerStatuses(nextState, combatTexts);

    if (nextState.trinketEffects.frozenHeartDamage > 0) {
      nextState = {
        ...nextState,
        enemyHealth: clampHealth(nextState.enemyHealth, -nextState.trinketEffects.frozenHeartDamage, nextState.enemyMaxHealth),
      };
      mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "stun", amount: nextState.trinketEffects.frozenHeartDamage });
    }

    return finalizePlayerTurn(nextState, combatTexts);
  }

  nextState = processEnemyHealing(nextState, combatTexts);
  nextState = tickEnemyStatuses(nextState, combatTexts);

  if (nextState.enemyHealth <= 0) {
    nextState = applyBoneCharmHeal(nextState, true, combatTexts);
    return finalizePlayerTurn(nextState, combatTexts);
  }

  if (nextState.currentEnemy.traits.some((t) => t.id === "rusting-carapace")) {
    nextState = {
      ...nextState,
      enemyArmor: nextState.enemyArmor + 1,
      enemyForge: nextState.enemyForge + 1,
    };
    mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: "armor", amount: 1 });
  }

  nextState = processEnemyAttack(nextState, combatTexts);
  nextState = tickPlayerStatuses(nextState, combatTexts);
  nextState = processEnemyRegeneration(nextState, combatTexts);

  return finalizePlayerTurn(nextState, combatTexts);
}
