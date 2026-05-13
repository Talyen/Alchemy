// Turn sequencing for the battle engine: card play, enemy phases, status ticks, and turn reset.
// Depends on draw/effect helpers, game-data attack shapes, and combat tuning constants.
// Used by the React battle controller as the only way to advance combat state.
import { drawCards } from "./draw";
import { applyBoneCharmHeal, applyCardEffects, applyIronwoodBuckler, getEnemyDamageMultiplier, mergeCombatText } from "./effects";
import { harmfulPlayerStatusIds, type EnemyAttackEffect, type BattleCard } from "@/lib/game-data";
import { applyPlayerCombatDamage, applyPlayerHealing, cardsPerTurn, clampHealth, maxHandSize, type BattleResolution, type BattleState, type CombatTextEvent, type TurnPhase } from "./types";
import { ENEMY_HEAL_FRACTION, HALF_DIVISOR, PERCENT_DENOMINATOR, POTION_CARD_ID_FRAGMENT } from "../game-constants";

export function cardHasDamageType(card: BattleCard, damageType: string): boolean {
  return card.effects.some((e) => e.kind === "damage" && e.damageType === damageType);
}

function resolveCardPlayCost(state: BattleState, card: BattleCard) {
  // One-shot free-card effects consume flags during cost resolution, before effects run.
  let effectiveCost = card.cost;
  let nextState = state;

  if (nextState.flags.nextCardCostReduction > 0) {
    effectiveCost = Math.max(0, effectiveCost - nextState.flags.nextCardCostReduction);
  }
  if (!nextState.flags.firstPhysicalCardFreeUsed && nextState.talentEffects.firstPhysicalCardFree && cardHasDamageType(card, "physical")) {
    effectiveCost = 0;
    nextState = { ...nextState, flags: { ...nextState.flags, firstPhysicalCardFreeUsed: true } };
  }
  if (!nextState.flags.firstHolyCardFreeUsed && nextState.talentEffects.firstHolyCardFree && cardHasDamageType(card, "holy")) {
    effectiveCost = 0;
    nextState = { ...nextState, flags: { ...nextState.flags, firstHolyCardFreeUsed: true } };
  }
  if (!nextState.flags.firstPoisonCardFreeUsed && nextState.talentEffects.firstPoisonCardFree && cardHasDamageType(card, "poison")) {
    effectiveCost = 0;
    nextState = { ...nextState, flags: { ...nextState.flags, firstPoisonCardFreeUsed: true } };
  }
  if (!nextState.flags.firstBleedCardFreeUsed && nextState.talentEffects.firstBleedCardFree && cardHasDamageType(card, "bleed")) {
    effectiveCost = 0;
    nextState = { ...nextState, flags: { ...nextState.flags, firstBleedCardFreeUsed: true } };
  }
  if (!nextState.flags.firstPotionFreeUsed && nextState.trinketEffects.mortarPestleFreeFirstPotion && card.id.includes(POTION_CARD_ID_FRAGMENT)) {
    effectiveCost = 0;
    nextState = { ...nextState, flags: { ...nextState.flags, firstPotionFreeUsed: true } };
  }

  return { state: nextState, effectiveCost };
}

// Card play is intentionally funneled through one gateway so cost prediction, one-shot
// free-card flags, immutable hand movement, effect order, and consume/discard routing
// cannot drift across UI paths or future automation.
export function playBattleCardResolved(state: BattleState, cardId: string, index: number): BattleResolution {
  const combatTexts: CombatTextEvent[] = [];

  if (state.wishOptions) {
    return { state, combatTexts };
  }

  const card = state.hand[index];
  if (!card || card.id !== cardId) {
    return { state, combatTexts };
  }

  const costResolution = resolveCardPlayCost(state, card);
  state = costResolution.state;
  const effectiveCost = costResolution.effectiveCost;

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
      const draw = drawCards(nextState.deck, nextState.discard, nextState.hand, nextState.trinketEffects.runicQuillDrawOnConsume, nextState.nextCardUid);
      nextState = { ...nextState, deck: draw.deck, discard: draw.discard, hand: draw.hand, nextCardUid: draw.nextCardUid };
    }
    return { state: { ...nextState, exhausted: [...nextState.exhausted, card] }, combatTexts };
  }

  return { state: { ...nextState, discard: [...nextState.discard, card] }, combatTexts };
}

// ----- Enemy DoT tick functions -----
// Enemy harmful statuses are split because each stack decays differently: burn halves or doubles,
// poison usually drains by one and can feed healing, and bleed is a one-shot delayed hit.

function tickBurn(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.enemyStatuses.burn;
  if (damage <= 0) return state;
  const multiplier = getEnemyDamageMultiplier(state, "burn");
  const finalDamage = Math.floor(damage * multiplier);
  mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "burn", amount: finalDamage });
  let nextBurn = state.enemyStatuses.burn;
  if (state.talentEffects.burnDoubleChance > 0 && Math.random() * PERCENT_DENOMINATOR < state.talentEffects.burnDoubleChance) {
    nextBurn *= HALF_DIVISOR;
  } else {
    nextBurn = Math.floor(nextBurn / HALF_DIVISOR);
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
  if (state.talentEffects.poisonGainChance > 0 && Math.random() * PERCENT_DENOMINATOR < state.talentEffects.poisonGainChance) {
    nextPoison += 1;
  } else {
    nextPoison = Math.max(0, nextPoison - 1);
  }
  let nextState = { ...state, enemyHealth: clampHealth(state.enemyHealth, -finalDamage, state.enemyMaxHealth), enemyStatuses: { ...state.enemyStatuses, poison: nextPoison } };

  // Parasitic Bloom trinket: heal when poison ticks
  if (state.trinketEffects.parasiticBloomHealPerPoisonTick > 0) {
    const healAmount = state.trinketEffects.parasiticBloomHealPerPoisonTick;
    nextState = applyPlayerHealing(nextState, healAmount);
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
    nextState = applyPlayerHealing(nextState, leechAmount);
    mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: leechAmount });
  }
  mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "bleed", amount: damage });
  return nextState;
}

function tickEnemyStatuses(state: BattleState, combatTexts: CombatTextEvent[]) {
  // Tick order is a balance contract: burn/poison can kill before bleed leech resolves,
  // and changing the order would alter rewards, healing, and death timing.
  let nextState = tickBurn(state, combatTexts);
  nextState = tickPoison(nextState, combatTexts);
  nextState = tickBleed(nextState, combatTexts);
  return nextState;
}

// ----- Player DoT tick functions -----
// Player-side harmful statuses stay separate from enemy ticks because armor mitigation and
// half-damage talents apply only here, while stun/freeze are damaging statuses, not turn skips.

function decayArmorAfterHarmfulStatusDamage(state: BattleState, damage: number) {
  // Harmful statuses chip armor once per damage tick, so each tick delegates that rule here.
  if (damage <= 0 || state.playerStatuses.armor <= 0) return state;
  return {
    ...state,
    playerStatuses: {
      ...state.playerStatuses,
      armor: state.playerStatuses.armor - 1,
    },
  };
}

function tickPlayerBurn(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.playerStatuses.burn;
  if (damage <= 0) return state;
  const actualDamage = state.talentEffects.receiveHalfBurnDamage ? Math.floor(damage / HALF_DIVISOR) : damage;
  const reducedDamage = state.talentEffects.armorMitigatesBurn
    ? Math.max(0, actualDamage - state.playerStatuses.armor)
    : actualDamage;
  if (reducedDamage > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "burn", amount: reducedDamage });
  }
  const nextState = { ...applyPlayerCombatDamage(state, reducedDamage), playerStatuses: { ...state.playerStatuses, burn: Math.floor(state.playerStatuses.burn / HALF_DIVISOR) } };
  return decayArmorAfterHarmfulStatusDamage(nextState, reducedDamage);
}

function tickPlayerPoison(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.playerStatuses.poison;
  if (damage <= 0) return state;
  const reducedDamage = state.talentEffects.receiveHalfPoisonDamage ? Math.floor(damage / HALF_DIVISOR) : damage;
  if (reducedDamage > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "poison", amount: reducedDamage });
  }
  const nextPoison = Math.max(0, state.playerStatuses.poison - 1);
  const nextState = { ...applyPlayerCombatDamage(state, reducedDamage), playerStatuses: { ...state.playerStatuses, poison: nextPoison } };
  return decayArmorAfterHarmfulStatusDamage(nextState, reducedDamage);
}

function tickPlayerBleed(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.playerStatuses.bleed;
  if (damage <= 0) return state;
  mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "bleed", amount: damage });
  const nextState = { ...applyPlayerCombatDamage(state, damage), playerStatuses: { ...state.playerStatuses, bleed: 0 } };
  return decayArmorAfterHarmfulStatusDamage(nextState, damage);
}

function tickPlayerStun(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.playerStatuses.stun;
  if (damage <= 0) return state;
  mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "stun", amount: damage });
  const nextState = { ...applyPlayerCombatDamage(state, damage), playerStatuses: { ...state.playerStatuses, stun: 0 } };
  return decayArmorAfterHarmfulStatusDamage(nextState, damage);
}

function tickPlayerFreeze(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.playerStatuses.freeze;
  if (damage <= 0) return state;
  mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "freeze", amount: damage });
  const nextState = { ...applyPlayerCombatDamage(state, damage), playerStatuses: { ...state.playerStatuses, freeze: 0 } };
  return decayArmorAfterHarmfulStatusDamage(nextState, damage);
}

function tickPlayerStatuses(state: BattleState, combatTexts: CombatTextEvent[]) {
  // This fixed order keeps simultaneous harmful statuses deterministic for combat text merging
  // and for edge cases where the player dies during end-of-turn cleanup.
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

  const [nextWishOptions = null, ...wishQueue] = state.wishQueue;

  if (state.hand.length < maxHandSize) {
    return { ...state, hand: [...state.hand, chosenCard], wishOptions: nextWishOptions, wishQueue };
  }

  return { ...state, discard: [...state.discard, chosenCard], wishOptions: nextWishOptions, wishQueue };
}

// ----- Enemy turn helpers -----

export function processCompanionTurnStart(state: BattleState, combatTexts: CombatTextEvent[]) {
  if (!state.activeCompanion || state.enemyHealth <= 0) return state;

  // Companions masquerade as a zero-cost card so their turn-start powers reuse the
  // normal card-effect pipeline, including combat text merging and status side effects.
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

  // Save first-hit flags so the companion's attack doesn't consume player card/tinker bonuses
  const savedFlags = {
    firstBurnCardDoubledUsed: state.flags.firstBurnCardDoubledUsed,
    firstBurnTrinketDoubledUsed: state.flags.firstBurnTrinketDoubledUsed,
    firstHolyDamageBonusUsed: state.flags.firstHolyDamageBonusUsed,
  };

  const result = applyCardEffects(state, companionCard, combatTexts);

  return { ...result, flags: { ...result.flags, ...savedFlags } };
}

function advanceToPlayerTurn(state: BattleState, _combatTexts: CombatTextEvent[]) {
  // All player-turn reset work happens here so haste, skipped enemy turns, and normal
  // enemy turns draw cards, restore mana, decay block, and clear per-turn flags identically.
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
  // Enemy self-heal is an early enemy-phase pressure valve: poison can halve it before
  // DoTs tick, so poison decks can counter sustain instead of only racing damage.
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
  // Threshold talents trigger only when crossing downward from above; otherwise a player
  // who stays below the threshold would re-trigger block/armor on every later hit.
  let nextState = state;
  if (state.talentEffects.healthThresholdBlock) {
    const { threshold, amount } = state.talentEffects.healthThresholdBlock;
    const thresholdHp = state.playerMaxHealth * threshold / PERCENT_DENOMINATOR;
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
    const thresholdHp = state.playerMaxHealth * threshold / PERCENT_DENOMINATOR;
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

// Per-hit enemy damage order is gameplay-significant: bleed mitigation first, then block
// absorption, armor, damage-type mitigation, HP threshold triggers, lifesteal, and trinkets.
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
  let nextState = {
    ...state,
    ...applyPlayerCombatDamage(state, actualDamage),
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

  // Taking damage removes 1 Armor
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

// Enemy attacks resolve effect-by-effect so multi-part attacks can spend block, have
// status riders prevented by remaining block, and consume first-harmful-status immunity once.
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

      // Plague Doctor's Mask trinket: immune to first harmful status each battle.
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
  // Regeneration is isolated after enemy actions so it cannot save an enemy from DoT
  // death earlier in the same phase, but still rewards survival through the attack step.
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

function resolveDeathsDoorEndOfEnemyTurn(state: BattleState): BattleState {
  // The grace window expires only after a later enemy turn, not the turn that triggered it.
  if (!state.deathsDoorActive) return state;
  if (state.playerHealth > 0) return { ...state, deathsDoorActive: false, deathsDoorTriggeredTurn: null };
  if (state.deathsDoorTriggeredTurn === state.turn) return state;
  return { ...state, deathsDoorActive: false, deathsDoorTriggeredTurn: null };
}

// Canonical enemy-phase pipeline: discard hand, handle haste/skips, heal, enemy DoTs,
// enemy attack, player harmful statuses, regeneration, trinket cleanup, then return to player.
// Keeping this order centralized prevents UI timing from changing combat outcomes.
export function endPlayerTurn(state: BattleState): { state: BattleState; combatTexts: CombatTextEvent[] } {
  const combatTexts: CombatTextEvent[] = [];

  let nextState: BattleState = {
    ...state,
    turnPhase: "enemy" as TurnPhase,
    hand: [],
    discard: [...state.discard, ...state.hand],
  };

  // Haste gives the player an extra turn immediately, skipping the enemy phase.
  // Player status ticks still apply so haste doesn't freeze harmful statuses.
  if (state.playerStatuses.haste > 0) {
    nextState = { ...nextState, playerStatuses: { ...nextState.playerStatuses, haste: nextState.playerStatuses.haste - 1 } };
    nextState = tickPlayerStatuses(nextState, combatTexts);
    nextState = applyIronwoodBuckler(nextState, combatTexts);
    nextState = resolveDeathsDoorEndOfEnemyTurn(nextState);
    return { state: advanceToPlayerTurn(nextState, combatTexts), combatTexts };
  }

  if (state.enemyStunSkipTurns + state.enemyFreezeSkipTurns > 0) {
    nextState = reduceSkipTurns(nextState);
    mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: "stun", amount: 0 });

    // Player status ticks still apply during skipped enemy turns so harmful statuses
    // don't pause when the enemy can't act.
    nextState = tickPlayerStatuses(nextState, combatTexts);

    // Frozen Heart: enemy loses turn to stun/freeze → take damage
    if (nextState.trinketEffects.frozenHeartDamage > 0) {
      nextState = {
        ...nextState,
        enemyHealth: clampHealth(nextState.enemyHealth, -nextState.trinketEffects.frozenHeartDamage, nextState.enemyMaxHealth),
      };
      mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "stun", amount: nextState.trinketEffects.frozenHeartDamage });
    }

    nextState = applyIronwoodBuckler(nextState, combatTexts);
    nextState = resolveDeathsDoorEndOfEnemyTurn(nextState);
    return { state: advanceToPlayerTurn(nextState, combatTexts), combatTexts };
  }

  nextState = processEnemyHealing(nextState, combatTexts);
  nextState = tickEnemyStatuses(nextState, combatTexts);

  if (nextState.enemyHealth <= 0) {
    nextState = applyBoneCharmHeal(nextState, true, combatTexts);
    nextState = applyIronwoodBuckler(nextState, combatTexts);
    return { state: advanceToPlayerTurn(nextState, combatTexts), combatTexts };
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

  nextState = applyIronwoodBuckler(nextState, combatTexts);
  nextState = resolveDeathsDoorEndOfEnemyTurn(nextState);

  return { state: advanceToPlayerTurn(nextState, combatTexts), combatTexts };
}
