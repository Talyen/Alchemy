// Deck drawing and battle-state creation for new encounters.
// Depends on game data, combat constants, talent manifests, and trinket manifests.
// Used by turn logic and battle controllers whenever cards or fresh battles are needed.
import { createEmptyTalentManifest, enemyBestiary, type BattleCard, type BestiaryEntry, type EnemyAttackEffect } from "@/lib/game-data";

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
  type TurnPhase,
} from "./types";
import { ROOM_SCALING_INCREMENT, ELITE_STAT_MULTIPLIER, BOSS_HP_MULTIPLIER, BOSS_ATTACK_MULTIPLIER, ACT_SCALING_INCREMENT, STARTING_TURN, ENEMY_BASE_REGENERATION, ENEMY_BOSS_REGENERATION } from "../game-constants";
import { computeTrinketManifest } from "../trinkets";

// Default talent manifest used when no talents are unlocked. Every field must have a safe
// zero/false value so battle logic can read talentEffects without existence checks.
// Defined via the shared factory so new manifest fields are caught at compile time.
export const defaultTalentEffects: TalentEffectManifest = createEmptyTalentManifest();

// Returns a fresh (deck, discard) pair after possibly reshuffling discard into deck.
function refillDeck(deck: BattleCard[], discard: BattleCard[]) {
  if (deck.length > 0) return { deck, discard };
  if (discard.length === 0) return null;
  return { deck: shuffleCards(discard), discard: [] };
}

// Draws cards from the deck into the hand. If the deck runs out, the discard pile
// is shuffled back into the deck. Stops at maxHandSize.
export function drawCards(deck: BattleCard[], discard: BattleCard[], hand: BattleCard[], amount: number, nextCardUid = 0) {
  let nextDeck = [...deck];
  let nextDiscard = [...discard];
  const nextHand = [...hand];
  let uid = nextCardUid;

  for (let i = 0; i < amount && nextHand.length < maxHandSize; i++) {
    const refilled = refillDeck(nextDeck, nextDiscard);
    if (!refilled) break;
    nextDeck = refilled.deck;
    nextDiscard = refilled.discard;

    const card = nextDeck.shift();
    if (card) {
      nextHand.push({ ...card, uid });
      uid += 1;
    }
  }

  return { deck: nextDeck, discard: nextDiscard, hand: nextHand, nextCardUid: uid };
}

// Enemy scaling is centralized so every battle start uses the same act, room, and type
// multipliers. The fallback physical attack keeps malformed/new bestiary entries playable
// instead of crashing combat with an enemy that has no action.
function buildScaledEnemy(enemy: BestiaryEntry, destinationIndexInAct = 0, currentAct = 1) {
  const scaler = Math.max(0, destinationIndexInAct - 1);
  const roomMul = 1 + scaler * ROOM_SCALING_INCREMENT;
  const actMul = 1 + (currentAct - 1) * ACT_SCALING_INCREMENT;
  const hpMultiplier = actMul * roomMul;
  const eliteMul = enemy.enemyType === "elite" ? ELITE_STAT_MULTIPLIER : 1;
  const bossHpMul = enemy.enemyType === "boss" ? BOSS_HP_MULTIPLIER : 1;
  const bossAtkMul = enemy.enemyType === "boss" ? BOSS_ATTACK_MULTIPLIER : 1;
  const hpTypeMul = Math.max(1, eliteMul, bossHpMul);
  const atkTypeMul = Math.max(1, eliteMul, bossAtkMul);
  const scaledEnemyHealth = Math.floor(baseEnemyHealth * hpMultiplier * hpTypeMul);
  const scaleAmount = (amount: number) => Math.floor(amount * hpMultiplier * atkTypeMul);

  const baseEffects = enemy.attackEffects.length > 0
    ? enemy.attackEffects
    : [{ kind: "damage" as const, damageType: "physical" as const, amount: 8 }];
  const scaledEnemyAttackEffects: EnemyAttackEffect[] = baseEffects.map((effect) => {
    if (effect.kind === "damage") {
      return { kind: "damage", damageType: effect.damageType, amount: scaleAmount(effect.amount), ...("lifesteal" in effect ? { lifesteal: effect.lifesteal } : {}) };
    }
    return { kind: "player-status", status: effect.status, amount: scaleAmount(effect.amount) };
  });
  const regenBase = enemy.traits.some((t) => t.id === "regeneration")
    ? (enemy.enemyType === "boss" ? ENEMY_BOSS_REGENERATION : ENEMY_BASE_REGENERATION)
    : 0;
  const enemyRegeneration = regenBase > 0 ? Math.floor(regenBase * hpMultiplier) : 0;

  return { enemy, scaledEnemyHealth, scaledEnemyAttackEffects, enemyRegeneration, hpMultiplier, typeMul: atkTypeMul };
}

// Creates the initial BattleState for a fresh encounter. Enemy HP and attack
// scale per destination within an act (multiplicative by 1.1x per slot after the
// first) and per act baseline (1.2x per act). Boss-type enemies get an additional
// 1.8x multiplier. `roomsEncountered` tracks total rooms across all acts for
// talent bonuses.
export function createBattleState(
  runDeck: BattleCard[],
  gold = 0,
  _roomsEncountered = 0,
  currentEnemy?: BestiaryEntry,
  playerHealth = maxPlayerHealth,
  talentEffects: TalentEffectManifest = defaultTalentEffects,
  discoveredCardIds: string[] = [],
  maxHealth = maxPlayerHealth,
  trinketIds: string[] = [],
  destinationIndexInAct = 0,
  currentAct = 1,
): BattleState {
  const openingHand = drawCards(shuffleCards(runDeck), [], [], cardsPerTurn, 0);

  const trinketEffects = computeTrinketManifest(trinketIds);

  // Tattered Pages: draw extra cards after the initial opening hand
  const extraHand = trinketEffects.extraDrawPerBattle > 0
    ? drawCards(openingHand.deck, openingHand.discard, openingHand.hand, trinketEffects.extraDrawPerBattle, openingHand.nextCardUid)
    : null;

  const enemy = currentEnemy ?? enemyBestiary[0];
  const { scaledEnemyHealth, scaledEnemyAttackEffects, enemyRegeneration } = buildScaledEnemy(enemy, destinationIndexInAct, currentAct);

  const effectiveMaxHealth = maxHealth;
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
    deathsDoorUsed: false,
    deathsDoorActive: false,
    deathsDoorTriggeredTurn: null,
    enemyHealth: scaledEnemyHealth,
    enemyMaxHealth: scaledEnemyHealth,
    enemyAttackEffects: scaledEnemyAttackEffects,
    enemyRegeneration,
    enemyArmor: 0,
    enemyForge: 0,
    playerStatuses: { block: talentEffects.startBlock, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 } as PlayerStatusValues,
    enemyStatuses: { burn: 0, poison: 0, bleed: 0, bleedLeech: 0, freeze: 0, stun: 0 } as EnemyStatusValues,
    enemyStunSkipTurns: 0,
    enemyFreezeSkipTurns: 0,
    wishOptions: null,
    wishQueue: [],
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
      firstHarmfulStatusPrevented: false,
      firstPotionFreeUsed: false,
      boneCharmUsed: false,
      resonantChimeUsedThisTurn: false,
    },
    discoveredCardIds,
    cardsPlayedThisTurn: 0,
    nextCardUid: extraHand ? extraHand.nextCardUid : openingHand.nextCardUid,
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
