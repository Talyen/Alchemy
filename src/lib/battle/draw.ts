import { enemyBestiary, starterDeck, type BattleCard, type BestiaryEntry, type EnemyAttackEffect } from "@/lib/game-data";

import {
  baseEnemyHealth,
  basePlayerMana,
  cardsPerTurn,
  maxHandSize,
  maxPlayerHealth,
  type BattleState,
  type EnemyStatusValues,
  type PlayerStatusValues,
  type TalentEffectManifest,
  type TrinketManifest,
  type TurnPhase,
} from "./types";
import { ROOM_SCALING_INCREMENT, ELITE_STAT_MULTIPLIER, BOSS_STAT_MULTIPLIER, ACT_SCALING_INCREMENT, STARTING_TURN, ENEMY_BASE_REGENERATION } from "../game-constants";
import { computeTrinketManifest, defaultTrinketEffects } from "../trinkets";

let cardUidCounter = 0;

// Default talent manifest used when no talents are unlocked.
// Every field must have a safe zero/false value so battle logic can read
// talentEffects without existence checks.
export const defaultTalentEffects: TalentEffectManifest = {
  flatPhysicalDamage: 0,
  armorToPhysicalDamage: false,
  physicalCritChance: 0,
  firstPhysicalCardFree: false,
  physicalVsStunnedMultiplier: 0,
  physicalVsFrozenMultiplier: 0,

  stunThresholdReduction: 0,
  drawOnStun: 0,
  nextCardFreeOnStun: false,

  startBlock: 0,
  blockToPhysicalDamage: false,
  blockPreventsBleed: false,
  blockPreventsPoison: false,
  blockPreventsStun: false,
  blockAbsorbPhysicalBonus: 0,

  forgeToBurn: false,
  forgeToHoly: false,
  forgeToBlock: false,
  forgeBurnThreshold: 0,
  forgeBurnDamage: 0,

  armorAilmentReduction: 0,
  armorBlockThreshold: 0,
  armorBlockAmount: 0,
  armorDoubledBelowHalfHealth: false,
  firstArmorCardDoubled: false,

  campfireHealBonus: 0,
  healthThresholdBlock: null,
  maxHealthPerCombat: 0,
  startHealth: 0,
  healMultiplier: 1,
  healthThresholdArmor: null,

  firstBurnCardDoubled: false,
  burnRemovesEnemyArmor: false,
  burnDoubleChance: 0,
  receiveHalfBurnDamage: false,

  shopCardDiscount: 0,
  shopFreeRefresh: false,
  startGold: 0,
  goldPerCombat: 0,
  potionDiscount: 0,
  removeCardDiscount: 0,
  enemyGoldDropBonus: 0,
  goldOnWish: 0,
  mixPotionDiscount: 0,

  holyLifestealPercent: 0,
  firstHolyCardFree: false,
  holyGoldPercent: 0,
  holyBurnChance: 0,
  receiveHalfHolyDamage: false,
  holyBlockPercent: 0,
  holyWishChance: 0,
  holyBlockPercentFromDamage: 0,
  holyVsBurnMultiplier: 0,

  goldOnWishAmount: 0,
  wishUndiscoveredCards: false,
  healthOnWish: 0,
  removeAilmentOnWish: false,
  wishExtraChoiceChance: 0,
  wishDrawsCard: false,

  firstPoisonCardFree: false,
  poisonPhysicalBonus: 0,
  poisonGainChance: 0,
  receiveHalfPoisonDamage: false,
  goldOnFirstPoison: 0,
  poisonHalvesHealing: false,

  firstBleedCardFree: false,
  bleedPhysicalBonus: 0,
  bleedLeechChance: 0,
  bleedEnemyDamageReduction: 0,
  bleedPhysicalTakenBonus: 0,
  bleedExecuteThreshold: 0,
  bleedDesperateMultiplier: 1,
  bleedPoisonChance: 0,
};

// Returns a fresh (deck, discard) pair after possibly reshuffling discard into deck.
function refillDeck(deck: BattleCard[], discard: BattleCard[]) {
  if (deck.length > 0) return { deck, discard };
  if (discard.length === 0) return null;
  return { deck: shuffleCards(discard), discard: [] };
}

// Draws cards from the deck into the hand. If the deck runs out, the discard pile
// is shuffled back into the deck. Stops at maxHandSize.
export function drawCards(deck: BattleCard[], discard: BattleCard[], hand: BattleCard[], amount: number) {
  let nextDeck = [...deck];
  let nextDiscard = [...discard];
  const nextHand = [...hand];

  for (let i = 0; i < amount && nextHand.length < maxHandSize; i++) {
    const refilled = refillDeck(nextDeck, nextDiscard);
    if (!refilled) break;
    nextDeck = refilled.deck;
    nextDiscard = refilled.discard;

    const card = nextDeck.shift();
    if (card) {
      nextHand.push({ ...card, uid: cardUidCounter++ });
    }
  }

  return { deck: nextDeck, discard: nextDiscard, hand: nextHand };
}

// Builds scaled enemy data for a given room. Uses destinationIndexInAct for
// room-to-room scaling (resets each act) and currentAct for act baseline difficulty.
// Boss-type enemies get an additional BOSS_STAT_MULTIPLIER on top of the act scaling.
function buildScaledEnemy(roomsEncountered: number, enemy: BestiaryEntry, destinationIndexInAct = 0, currentAct = 1) {
  const scaler = Math.max(0, destinationIndexInAct - 1);
  const roomMul = 1 + scaler * ROOM_SCALING_INCREMENT;
  const actMul = 1 + (currentAct - 1) * ACT_SCALING_INCREMENT;
  const hpMultiplier = actMul * roomMul;
  const eliteMul = enemy.enemyType === "elite" ? ELITE_STAT_MULTIPLIER : 1;
  const bossMul = enemy.enemyType === "boss" ? BOSS_STAT_MULTIPLIER : 1;
  const typeMul = Math.max(1, eliteMul, bossMul);
  const scaledEnemyHealth = Math.floor(baseEnemyHealth * hpMultiplier * typeMul);
  const scaleAmount = (amount: number) => Math.floor(amount * hpMultiplier * typeMul);

  const baseEffects = enemy.attackEffects.length > 0
    ? enemy.attackEffects
    : [{ kind: "damage" as const, damageType: "physical" as const, amount: 8 }];
  const scaledEnemyAttackEffects: EnemyAttackEffect[] = baseEffects.map((effect) => {
    if (effect.kind === "damage") {
      return { kind: "damage", damageType: effect.damageType, amount: scaleAmount(effect.amount), lifesteal: effect.lifesteal };
    }
    return { kind: "player-status", status: effect.status, amount: scaleAmount(effect.amount) };
  });
  const enemyRegeneration = enemy.traits.some((t) => t.id === "regeneration") ? scaleAmount(ENEMY_BASE_REGENERATION) : 0;

  return { enemy, scaledEnemyHealth, scaledEnemyAttackEffects, enemyRegeneration, hpMultiplier, typeMul };
}

// Creates the initial BattleState for a fresh encounter. Enemy HP and attack
// scale per destination within an act (multiplicative by 1.1x per slot after the
// first) and per act baseline (1.2x per act). Boss-type enemies get an additional
// 1.8x multiplier. `roomsEncountered` tracks total rooms across all acts for
// talent bonuses.
export function createBattleState(
  runDeck: BattleCard[] = starterDeck,
  gold = 0,
  roomsEncountered = 0,
  currentEnemy?: BestiaryEntry,
  playerHealth = maxPlayerHealth,
  talentEffects: TalentEffectManifest = defaultTalentEffects,
  discoveredCardIds: string[] = [],
  maxHealth = maxPlayerHealth,
  trinketIds: string[] = [],
  destinationIndexInAct = 0,
  currentAct = 1,
): BattleState {
  const openingHand = drawCards(shuffleCards(runDeck), [], [], cardsPerTurn);

  const trinketEffects = computeTrinketManifest(trinketIds);

  // Tattered Pages: draw extra cards after the initial opening hand
  const extraHand = trinketEffects.extraDrawPerBattle > 0
    ? drawCards(openingHand.deck, openingHand.discard, openingHand.hand, trinketEffects.extraDrawPerBattle)
    : null;

  const enemy = currentEnemy ?? enemyBestiary[0];
  const { scaledEnemyHealth, scaledEnemyAttackEffects, enemyRegeneration } = buildScaledEnemy(roomsEncountered, enemy, destinationIndexInAct, currentAct);

  const effectiveMaxHealth = maxHealth + talentEffects.maxHealthPerCombat * roomsEncountered;
  const startingHealth = Math.min(effectiveMaxHealth, playerHealth + talentEffects.startHealth);

  return {
    deck: extraHand ? extraHand.deck : openingHand.deck,
    hand: extraHand ? extraHand.hand : openingHand.hand,
    discard: extraHand ? extraHand.discard : openingHand.discard,
    exhausted: [],
    mana: basePlayerMana,
    maxMana: basePlayerMana,
    gold,
    turn: STARTING_TURN,
    turnPhase: "player" as TurnPhase,
    playerHealth: startingHealth,
    playerMaxHealth: effectiveMaxHealth,
    enemyHealth: scaledEnemyHealth,
    enemyMaxHealth: scaledEnemyHealth,
    enemyAttackEffects: scaledEnemyAttackEffects,
    enemyRegeneration,
    enemyArmor: 0,
    playerStatuses: { block: talentEffects.startBlock, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 } as PlayerStatusValues,
    enemyStatuses: { burn: 0, poison: 0, bleed: 0, bleedLeech: 0, freeze: 0, stun: 0 } as EnemyStatusValues,
    enemyStunSkipTurns: 0,
    enemyFreezeSkipTurns: 0,
    wishOptions: null,
    activeCompanion: null,
    currentEnemy: enemy,
    talentEffects,
    trinketEffects,
    flags: {
      firstPhysicalCardFreeUsed: false,
      firstHolyCardFreeUsed: false,
      firstBurnCardDoubledUsed: false,
      firstArmorCardDoubledUsed: false,
      firstPoisonCardFreeUsed: false,
      firstBleedCardFreeUsed: false,
      nextCardCostReduction: 0,
      goldOnFirstPoisonThisCombat: false,
      firstHolyDamageBonusUsed: false,
      firstBurnTrinketDoubledUsed: false,
      firstAilmentPrevented: false,
      firstPotionFreeUsed: false,
      boneCharmUsed: false,
      resonantChimeUsedThisTurn: false,
    },
    discoveredCardIds,
    cardsPlayedThisTurn: 0,
  };
}

// Fisher-Yates shuffle — O(n), unbiased, in-place on a clone.
export function shuffleCards(cards: BattleCard[]) {
  const shuffled = [...cards];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}
