import { drawCards } from "./draw";
import { applyCardEffects, getEnemyDamageMultiplier, mergeCombatText } from "./effects";
import { ailmentStatusIds, type EnemyAttackEffect, type BattleCard } from "@/lib/game-data";
import { cardsPerTurn, clampHealth, maxHandSize, type BattleResolution, type BattleState, type CombatTextEvent, type TurnPhase } from "./types";
import { ENEMY_HEAL_FRACTION } from "../game-constants";

export function cardHasDamageType(card: BattleCard, damageType: string): boolean {
  return card.effects.some((e) => e.kind === "damage" && e.damageType === damageType);
}

// Entry point for playing a card. Validates mana/wish state, finds the card in hand,
// deducts mana, applies effects, then routes to discard or exhaust.
export function playBattleCardResolved(state: BattleState, cardId: string, index: number): BattleResolution {
  const combatTexts: CombatTextEvent[] = [];

  if (state.wishOptions) {
    return { state, combatTexts };
  }

  const card = state.hand[index];
  if (!card || card.id !== cardId) {
    return { state, combatTexts };
  }

  let effectiveCost = card.cost;

  if (state.flags.nextCardCostReduction > 0) {
    effectiveCost = Math.max(0, effectiveCost - state.flags.nextCardCostReduction);
  }
  if (!state.flags.firstPhysicalCardFreeUsed && state.talentEffects.firstPhysicalCardFree && cardHasDamageType(card, "physical")) {
    effectiveCost = 0;
    state = { ...state, flags: { ...state.flags, firstPhysicalCardFreeUsed: true } };
  }
  if (!state.flags.firstHolyCardFreeUsed && state.talentEffects.firstHolyCardFree && cardHasDamageType(card, "holy")) {
    effectiveCost = 0;
    state = { ...state, flags: { ...state.flags, firstHolyCardFreeUsed: true } };
  }
  if (!state.flags.firstPoisonCardFreeUsed && state.talentEffects.firstPoisonCardFree && cardHasDamageType(card, "poison")) {
    effectiveCost = 0;
    state = { ...state, flags: { ...state.flags, firstPoisonCardFreeUsed: true } };
  }
  if (!state.flags.firstBleedCardFreeUsed && state.talentEffects.firstBleedCardFree && cardHasDamageType(card, "bleed")) {
    effectiveCost = 0;
    state = { ...state, flags: { ...state.flags, firstBleedCardFreeUsed: true } };
  }
  // Mortar and Pestle trinket: first potion is free
  if (!state.flags.firstPotionFreeUsed && state.trinketEffects.mortarPestleFreeFirstPotion && card.id.includes("potion")) {
    effectiveCost = 0;
    state = { ...state, flags: { ...state.flags, firstPotionFreeUsed: true } };
  }

  if (state.mana < effectiveCost) {
    return { state, combatTexts };
  }

  let nextState: BattleState = {
    ...state,
    hand: state.hand.filter((_, i) => i !== index),
    flags: { ...state.flags, nextCardCostReduction: 0 },
    cardsPlayedThisTurn: state.cardsPlayedThisTurn + 1,
  };

  nextState = applyCardEffects(nextState, card, combatTexts);

  nextState = { ...nextState, mana: Math.max(0, nextState.mana - effectiveCost) };

  // Resonant Chime trinket: play N+ cards in a turn → gain mana
  if (nextState.trinketEffects.resonantChimeCardsRequired > 0 && nextState.trinketEffects.resonantChimeMana > 0 && !nextState.flags.resonantChimeUsedThisTurn && nextState.cardsPlayedThisTurn >= nextState.trinketEffects.resonantChimeCardsRequired) {
    nextState = {
      ...nextState,
      mana: nextState.mana + nextState.trinketEffects.resonantChimeMana,
      flags: { ...nextState.flags, resonantChimeUsedThisTurn: true },
    };
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "mana", amount: nextState.trinketEffects.resonantChimeMana });
  }

  if (card.consume) {
    // Runic Quill trinket: draw 1 when consuming a card
    if (nextState.trinketEffects.runicQuillDrawOnConsume > 0) {
      const draw = drawCards(nextState.deck, nextState.discard, nextState.hand, nextState.trinketEffects.runicQuillDrawOnConsume);
      nextState = { ...nextState, deck: draw.deck, discard: draw.discard, hand: draw.hand };
    }
    return { state: { ...nextState, exhausted: [...nextState.exhausted, card] }, combatTexts };
  }

  return { state: { ...nextState, discard: [...nextState.discard, card] }, combatTexts };
}

// ----- Enemy DoT tick functions -----

function tickBurn(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.enemyStatuses.burn;
  if (damage <= 0) return state;
  const multiplier = getEnemyDamageMultiplier(state, "burn");
  const finalDamage = Math.floor(damage * multiplier);
  mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "burn", amount: finalDamage });
  let nextBurn = state.enemyStatuses.burn;
  if (state.talentEffects.burnDoubleChance > 0 && Math.random() * 100 < state.talentEffects.burnDoubleChance) {
    nextBurn *= 2;
  } else {
    nextBurn = Math.floor(nextBurn / 2);
  }
  return { ...state, enemyHealth: clampHealth(state.enemyHealth, -finalDamage, state.enemyMaxHealth), enemyStatuses: { ...state.enemyStatuses, burn: nextBurn } };
}

function tickPoison(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.enemyStatuses.poison;
  if (damage <= 0) return state;
  const multiplier = getEnemyDamageMultiplier(state, "poison");
  const finalDamage = Math.floor(damage * multiplier);
  mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "poison", amount: finalDamage });
  let nextPoison = state.enemyStatuses.poison;
  if (state.talentEffects.poisonGainChance > 0 && Math.random() * 100 < state.talentEffects.poisonGainChance) {
    nextPoison += 1;
  } else {
    nextPoison = Math.max(0, nextPoison - 1);
  }
  let nextState = { ...state, enemyHealth: clampHealth(state.enemyHealth, -finalDamage, state.enemyMaxHealth), enemyStatuses: { ...state.enemyStatuses, poison: nextPoison } };

  // Parasitic Bloom trinket: heal when poison ticks
  if (state.trinketEffects.parasiticBloomHealPerPoisonTick > 0) {
    const healAmount = state.trinketEffects.parasiticBloomHealPerPoisonTick;
    nextState = { ...nextState, playerHealth: clampHealth(nextState.playerHealth, healAmount, nextState.playerMaxHealth) };
    mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: healAmount });
  }

  return nextState;
}

function tickBleed(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.enemyStatuses.bleed;
  if (damage <= 0) return state;
  let nextState = { ...state, enemyHealth: clampHealth(state.enemyHealth, -damage, state.enemyMaxHealth), enemyStatuses: { ...state.enemyStatuses, bleed: 0, bleedLeech: 0 } };
  const leechAmount = state.enemyStatuses.bleedLeech;
  if (leechAmount > 0) {
    nextState.playerHealth = clampHealth(nextState.playerHealth, leechAmount, nextState.playerMaxHealth);
    mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: leechAmount });
  }
  mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "bleed", amount: damage });
  return nextState;
}

function tickEnemyStatuses(state: BattleState, combatTexts: CombatTextEvent[]) {
  let nextState = tickBurn(state, combatTexts);
  nextState = tickPoison(nextState, combatTexts);
  nextState = tickBleed(nextState, combatTexts);
  return nextState;
}

// ----- Player DoT tick functions -----

function tickPlayerBurn(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.playerStatuses.burn;
  if (damage <= 0) return state;
  const actualDamage = state.talentEffects.receiveHalfBurnDamage ? Math.floor(damage / 2) : damage;
  const reducedDamage = Math.max(0, actualDamage - state.talentEffects.armorAilmentReduction);
  if (reducedDamage > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "burn", amount: reducedDamage });
  }
  return {
    ...state,
    playerHealth: Math.max(0, state.playerHealth - reducedDamage),
    playerStatuses: { ...state.playerStatuses, burn: Math.floor(state.playerStatuses.burn / 2) },
  };
}

function tickPlayerPoison(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.playerStatuses.poison;
  if (damage <= 0) return state;
  const actualDamage = state.talentEffects.receiveHalfPoisonDamage ? Math.floor(damage / 2) : damage;
  const reducedDamage = Math.max(0, actualDamage - state.talentEffects.armorAilmentReduction);
  if (reducedDamage > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "poison", amount: reducedDamage });
  }
  const nextPoison = Math.max(0, state.playerStatuses.poison - 1);
  return { ...state, playerHealth: Math.max(0, state.playerHealth - reducedDamage), playerStatuses: { ...state.playerStatuses, poison: nextPoison } };
}

function tickPlayerBleed(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.playerStatuses.bleed;
  if (damage <= 0) return state;
  const reducedDamage = Math.max(0, damage - state.talentEffects.armorAilmentReduction);
  if (reducedDamage > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "bleed", amount: reducedDamage });
  }
  return { ...state, playerHealth: Math.max(0, state.playerHealth - reducedDamage), playerStatuses: { ...state.playerStatuses, bleed: 0 } };
}

function tickPlayerStun(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.playerStatuses.stun;
  if (damage <= 0) return state;
  const reducedDamage = Math.max(0, damage - state.talentEffects.armorAilmentReduction);
  if (reducedDamage > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "stun", amount: reducedDamage });
  }
  return { ...state, playerHealth: Math.max(0, state.playerHealth - reducedDamage), playerStatuses: { ...state.playerStatuses, stun: 0 } };
}

function tickPlayerFreeze(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.playerStatuses.freeze;
  if (damage <= 0) return state;
  const reducedDamage = Math.max(0, damage - state.talentEffects.armorAilmentReduction);
  if (reducedDamage > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "freeze", amount: reducedDamage });
  }
  return { ...state, playerHealth: Math.max(0, state.playerHealth - reducedDamage), playerStatuses: { ...state.playerStatuses, freeze: 0 } };
}

function tickPlayerStatuses(state: BattleState, combatTexts: CombatTextEvent[]) {
  let nextState = tickPlayerBurn(state, combatTexts);
  nextState = tickPlayerPoison(nextState, combatTexts);
  nextState = tickPlayerBleed(nextState, combatTexts);
  nextState = tickPlayerStun(nextState, combatTexts);
  nextState = tickPlayerFreeze(nextState, combatTexts);
  return nextState;
}

// Wish card resolution: finds the chosen card in wishOptions and puts it into
// the player's hand (if there's room) or discard (if hand is full).
export function chooseWishCard(state: BattleState, cardId: string) {
  const chosenCard = state.wishOptions?.find((card) => card.id === cardId);
  if (!chosenCard) {
    return state;
  }

  if (state.hand.length < maxHandSize) {
    return { ...state, hand: [...state.hand, chosenCard], wishOptions: null };
  }

  return { ...state, discard: [...state.discard, chosenCard], wishOptions: null };
}

// ----- Enemy turn helpers -----

export function processCompanionTurnStart(state: BattleState, combatTexts: CombatTextEvent[]) {
  if (!state.activeCompanion) return state;

  const companionCard: BattleCard = {
    id: `companion-${state.activeCompanion.id}`,
    title: state.activeCompanion.title,
    descriptionLines: [],
    art: state.activeCompanion.art,
    cost: 0,
    template: "nature",
    effects: state.activeCompanion.turnStartEffects,
  };

  return applyCardEffects(state, companionCard, combatTexts);
}

function advanceToPlayerTurn(state: BattleState, combatTexts: CombatTextEvent[]) {
  const nextDraw = drawCards(state.deck, state.discard, [], cardsPerTurn);
  return {
    ...state,
    turn: state.turn + 1,
    turnPhase: "player" as TurnPhase,
    deck: nextDraw.deck,
    hand: nextDraw.hand,
    discard: nextDraw.discard,
    mana: state.maxMana,
    playerStatuses: { ...state.playerStatuses, block: Math.floor((state.playerStatuses.block ?? 0) / 2) },
    cardsPlayedThisTurn: 0,
    flags: { ...state.flags, resonantChimeUsedThisTurn: false, nextCardCostReduction: 0 },
  };
}

function processEnemyHealing(state: BattleState, combatTexts: CombatTextEvent[]) {
  if (state.enemyHealth >= state.enemyMaxHealth / 2) return state;
  let healAmount = Math.floor(state.enemyMaxHealth * ENEMY_HEAL_FRACTION);
  if (state.enemyStatuses.poison > 0 && state.talentEffects.poisonHalvesHealing) {
    healAmount = Math.floor(healAmount / 2);
  }
  if (healAmount <= 0) return state;
  mergeCombatText(combatTexts, { target: "enemy", kind: "heal", stat: "health", amount: healAmount });
  return { ...state, enemyHealth: clampHealth(state.enemyHealth, healAmount, state.enemyMaxHealth) };
}

function checkHealthThresholds(prevHealth: number, nextHealth: number, state: BattleState, combatTexts: CombatTextEvent[]) {
  let nextState = state;
  if (state.talentEffects.healthThresholdBlock) {
    const { threshold, amount } = state.talentEffects.healthThresholdBlock;
    const thresholdHp = state.playerMaxHealth * threshold / 100;
    if (prevHealth > thresholdHp && nextHealth <= thresholdHp) {
      nextState = {
        ...nextState,
        playerStatuses: { ...nextState.playerStatuses, block: nextState.playerStatuses.block + amount },
      };
      mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "block", amount });
    }
  }
  if (state.talentEffects.healthThresholdArmor) {
    const { threshold, amount } = state.talentEffects.healthThresholdArmor;
    const thresholdHp = state.playerMaxHealth * threshold / 100;
    if (prevHealth > thresholdHp && nextHealth <= thresholdHp) {
      nextState = {
        ...nextState,
        playerStatuses: { ...nextState.playerStatuses, armor: nextState.playerStatuses.armor + amount },
      };
      mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "armor", amount });
    }
  }
  return nextState;
}

// Processes a single enemy damage effect: reduce by physical talent, absorb with block/armor, apply damage.
function processEnemyDamageEffect(state: BattleState, effect: EnemyAttackEffect & { kind: "damage" }, combatTexts: CombatTextEvent[]) {
  let remainingDamage = effect.amount;

  if (effect.damageType === "physical") {
    remainingDamage = Math.max(0, remainingDamage - state.talentEffects.bleedEnemyDamageReduction);
  }

  let effectiveBlock = state.playerStatuses.block;
  if (effect.damageType === "physical" && state.talentEffects.blockAbsorbPhysicalBonus > 0) {
    effectiveBlock = Math.floor(effectiveBlock * (1 + state.talentEffects.blockAbsorbPhysicalBonus / 100));
  }

  const blockAbsorb = Math.min(remainingDamage, effectiveBlock);
  remainingDamage -= blockAbsorb;

  if (blockAbsorb > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "block", amount: blockAbsorb });
  }

  const actualDamage = Math.max(0, remainingDamage - state.playerStatuses.armor);

  if (actualDamage > 0) {
    const stat = effect.damageType === "physical" ? "health" : effect.damageType;
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat, amount: actualDamage });
  }

  const prevHealth = state.playerHealth;
  let nextState = {
    ...state,
    playerHealth: clampHealth(state.playerHealth, -actualDamage, state.playerMaxHealth),
    playerStatuses: {
      ...state.playerStatuses,
      block: state.playerStatuses.block - Math.min(blockAbsorb, state.playerStatuses.block),
    },
  };

  // Vanguard's Crest trinket: block fully absorbed attack → gain forge
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

  if (effect.lifesteal && actualDamage > 0) {
    nextState = { ...nextState, enemyHealth: clampHealth(nextState.enemyHealth, actualDamage, nextState.enemyMaxHealth) };
    mergeCombatText(combatTexts, { target: "enemy", kind: "heal", stat: "health", amount: actualDamage });
  }

  return nextState;
}

// Enemy attacks the player by iterating through its attack effects.
// Block and armor apply to each damage effect in sequence.
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

      // Plague Doctor's Mask trinket: immune to first ailment each battle
      if (ailmentStatusIds.includes(status) && nextState.trinketEffects.plagueDoctorImmunity && !nextState.flags.firstAilmentPrevented) {
        nextState = { ...nextState, flags: { ...nextState.flags, firstAilmentPrevented: true } };
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

// Decrements stun or freeze skip turns (stun has priority), returns the updated state.
function reduceSkipTurns(state: BattleState): BattleState {
  const newStun = state.enemyStunSkipTurns > 0 ? state.enemyStunSkipTurns - 1 : 0;
  const decFromStun = state.enemyStunSkipTurns - newStun;
  const newFreeze = state.enemyFreezeSkipTurns > 0 ? state.enemyFreezeSkipTurns - (1 - decFromStun) : 0;
  return { ...state, enemyStunSkipTurns: newStun, enemyFreezeSkipTurns: newFreeze };
}

// End-turn resolution: this is called when the player clicks "End Turn".
export function endPlayerTurn(state: BattleState): { state: BattleState; combatTexts: CombatTextEvent[] } {
  const combatTexts: CombatTextEvent[] = [];

  let nextState: BattleState = {
    ...state,
    turnPhase: "enemy" as TurnPhase,
    hand: [],
    discard: [...state.discard, ...state.hand],
  };

  // Haste gives the player an extra turn immediately, skipping the enemy phase.
  if (state.playerStatuses.haste > 0) {
    nextState = { ...nextState, playerStatuses: { ...nextState.playerStatuses, haste: nextState.playerStatuses.haste - 1 } };
    return { state: advanceToPlayerTurn(nextState, combatTexts), combatTexts };
  }

  if (state.enemyStunSkipTurns + state.enemyFreezeSkipTurns > 0) {
    nextState = reduceSkipTurns(nextState);
    mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: "stun", amount: 0 });

    // Frozen Heart: enemy loses turn to stun/freeze → take damage
    if (nextState.trinketEffects.frozenHeartDamage > 0) {
      nextState = {
        ...nextState,
        enemyHealth: clampHealth(nextState.enemyHealth, -nextState.trinketEffects.frozenHeartDamage, nextState.enemyMaxHealth),
      };
      mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "stun", amount: nextState.trinketEffects.frozenHeartDamage });
    }

    // Ironwood Buckler: end of turn, if block >= threshold, gain armor
    if (nextState.trinketEffects.blockToArmorThreshold > 0 && nextState.playerStatuses.block >= nextState.trinketEffects.blockToArmorThreshold) {
      nextState = {
        ...nextState,
        playerStatuses: {
          ...nextState.playerStatuses,
          armor: nextState.playerStatuses.armor + nextState.trinketEffects.blockToArmorAmount,
        },
      };
      mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "armor", amount: nextState.trinketEffects.blockToArmorAmount });
    }

    return { state: advanceToPlayerTurn(nextState, combatTexts), combatTexts };
  }

  nextState = processEnemyHealing(nextState, combatTexts);
  nextState = tickEnemyStatuses(nextState, combatTexts);

  if (nextState.enemyHealth <= 0) {
    // Bone Charm trinket: heal on enemy death
    if (nextState.trinketEffects.boneCharmHealOnKill > 0 && !nextState.flags.boneCharmUsed) {
      nextState = {
        ...nextState,
        playerHealth: clampHealth(nextState.playerHealth, nextState.trinketEffects.boneCharmHealOnKill, nextState.playerMaxHealth),
        flags: { ...nextState.flags, boneCharmUsed: true },
      };
      mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: nextState.trinketEffects.boneCharmHealOnKill });
    }
    // Ironwood Buckler: end of turn block → armor check
    if (nextState.trinketEffects.blockToArmorThreshold > 0 && nextState.playerStatuses.block >= nextState.trinketEffects.blockToArmorThreshold) {
      nextState = {
        ...nextState,
        playerStatuses: {
          ...nextState.playerStatuses,
          armor: nextState.playerStatuses.armor + nextState.trinketEffects.blockToArmorAmount,
        },
      };
      mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "armor", amount: nextState.trinketEffects.blockToArmorAmount });
    }
    return { state: advanceToPlayerTurn(nextState, combatTexts), combatTexts };
  }

  nextState = processEnemyAttack(nextState, combatTexts);
  nextState = tickPlayerStatuses(nextState, combatTexts);
  nextState = processEnemyRegeneration(nextState, combatTexts);

  // Ironwood Buckler: end of turn, if block >= threshold, gain armor
  if (nextState.trinketEffects.blockToArmorThreshold > 0 && nextState.playerStatuses.block >= nextState.trinketEffects.blockToArmorThreshold) {
    nextState = {
      ...nextState,
      playerStatuses: {
        ...nextState.playerStatuses,
        armor: nextState.playerStatuses.armor + nextState.trinketEffects.blockToArmorAmount,
      },
    };
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "armor", amount: nextState.trinketEffects.blockToArmorAmount });
  }

  return { state: advanceToPlayerTurn(nextState, combatTexts), combatTexts };
}
