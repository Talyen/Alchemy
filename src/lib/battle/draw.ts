// Deck drawing and battle-state creation for new encounters.
// Depends on game data, combat constants, talent manifests, and trinket manifests.
// Used by turn logic and battle controllers whenever cards or fresh battles are needed.
import { companionLibrary, createEmptyTalentManifest, enemyBestiary } from "@/lib/game-data";
import type { BattleCard, BestiaryEntry, EnemyAttackEffect } from "@/lib/game-data/types";
import type { DifficultyModifier } from "@/lib/game-data/difficulties";

import { shuffle } from "../utils";
import {
  BASE_ENEMY_HEALTH,
  BASE_PLAYER_MANA,
  CARDS_PER_TURN,
  FALLBACK_ENEMY_ATTACK,
  LIVING_ARMOR_STARTING_ARMOR,
  MAX_HAND_SIZE,
  MAX_PLAYER_HEALTH,
  ROOM_SCALING_INCREMENT,
  ELITE_STAT_MULTIPLIER,
  BOSS_HP_MULTIPLIER,
  BOSS_ATTACK_MULTIPLIER,
  ACT_SCALING_INCREMENT,
  STARTING_TURN,
  ENEMY_BASE_REGENERATION,
  ENEMY_BOSS_REGENERATION,
} from "../game-constants";
import {
  type BattleState,
  type EnemyStatusValues,
  type PlayerStatusValues,
  type TalentEffectManifest,
  type TurnPhase,
} from "./types";
import { computeTrinketManifest } from "../trinkets";

// Default talent manifest used when no talents are unlocked. Every field must have a safe
// zero/false value so battle logic can read talentEffects without existence checks.
// Defined via the shared factory so new manifest fields are caught at compile time.
export const defaultTalentEffects: TalentEffectManifest = createEmptyTalentManifest();

const skeletonEnemy = { id: "skeleton", title: "Skeleton", subtitle: "", descriptionLines: [""], art: "", enemyType: "normal" as const, traits: [], attackEffects: [] };

export function defaultBattleState(): BattleState {
  return {
    deck: [], hand: [], discard: [], exhausted: [], mana: 0, maxMana: 0, gold: 0,
    turn: 1, turnPhase: "player", playerHealth: 30, playerMaxHealth: 30,
    deathsDoorUsed: false, deathsDoorActive: false, deathsDoorTriggeredTurn: null,
    enemyHealth: 30, enemyMaxHealth: 30, enemyAttackEffects: [], enemyArmor: 0,
    enemyForge: 0, enemyFreezeBonus: 0, enemyRegeneration: 0,
    playerStatuses: { block: 0, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
    enemyStatuses: { burn: 0, poison: 0, bleed: 0, bleedLeech: 0, freeze: 0, stun: 0 },
    enemyStunSkipTurns: 0, enemyFreezeSkipTurns: 0, wishOptions: null, wishQueue: [], activeCompanion: null,
    currentEnemy: skeletonEnemy,
    talentEffects: defaultTalentEffects,
    trinketEffects: { extraDrawPerBattle: 0, firstHolyDamageDoubled: false, firstBurnDoubled: false, boneCharmHealOnKill: 0, forgeStunThreshold: 0, forgeStunAmount: 0, frozenHeartDamage: 0, blockToArmorThreshold: 0, blockToArmorAmount: 0, runicQuillDrawOnConsume: 0, sinEaterHealOnHarmfulStatusRemove: 0, vanguardCrestForgeOnBlockAbsorb: 0, parasiticBloomLeechChance: 0, cutpurseGoldOnBleed: 0, wishingWellGoldOnWish: 0, plagueDoctorImmunity: false, mortarPestleFreeFirstPotion: false, sunderingArmorPiercing: 0, resonantChimeCardsRequired: 0, resonantChimeMana: 0, smugglersMapGoldBonus: 0, grovesFavorStartHeal: 0, merchantsFavorDiscount: 0, companionDamageBonus: 0, freezeDurationExtension: 0, thunderstoneDamageOnStun: 0, luckyCloverGoldChance: 0 },
    flags: {
      firstPhysicalCardFreeUsed: false, firstHolyCardFreeUsed: false, firstBurnCardDoubledUsed: false,
      firstArmorCardDoubledUsed: false, firstPoisonCardFreeUsed: false, firstBleedCardFreeUsed: false,
      nextCardCostReduction: 0, goldOnFirstPoisonThisCombat: false, firstHolyDamageBonusUsed: false,
      firstBurnTrinketDoubledUsed: false, firstHarmfulStatusPrevented: false, firstPotionFreeUsed: false,
      resonantChimeUsedThisTurn: false,
    },
    discoveredCardIds: [],
    cardsPlayedThisTurn: 0,
    nextCardUid: 0,
    difficultyModifiers: [],
  };
}

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

  for (let i = 0; i < amount && nextHand.length < MAX_HAND_SIZE; i++) {
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
  const scaledEnemyHealth = Math.floor(BASE_ENEMY_HEALTH * hpMultiplier * hpTypeMul);
  const scaleAmount = (amount: number) => Math.floor(amount * hpMultiplier * atkTypeMul);

  const baseEffects = enemy.attackEffects.length > 0
    ? enemy.attackEffects
    : [{ kind: "damage" as const, damageType: "physical" as const, amount: FALLBACK_ENEMY_ATTACK }];
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

function setupOpeningHand(deck: BattleCard[], trinketEffects: ReturnType<typeof computeTrinketManifest>) {
  const openingHand = drawCards(shuffleCards(deck), [], [], CARDS_PER_TURN, 0);
  if (trinketEffects.extraDrawPerBattle <= 0) return { ...openingHand, extraHand: null };
  const extraHand = drawCards(openingHand.deck, openingHand.discard, openingHand.hand, trinketEffects.extraDrawPerBattle, openingHand.nextCardUid);
  return { deck: extraHand.deck, hand: extraHand.hand, discard: extraHand.discard, nextCardUid: extraHand.nextCardUid, extraHand };
}

function applyDifficultyAttackModifiers(effects: EnemyAttackEffect[], modifiers: DifficultyModifier[]) {
  let modified = [...effects];
  for (const mod of modifiers) {
    if (mod.kind === "increase-enemy-physical-damage" || mod.kind === "increase-enemy-damage") {
      modified = modified.map((e) =>
        e.kind === "damage" ? { ...e, amount: e.amount + mod.amount } : e,
      );
    }
    if (mod.kind === "increase-enemy-status") {
      modified = modified.map((e) =>
        e.kind === "player-status" && e.status === mod.status ? { ...e, amount: e.amount + mod.amount } : e,
      );
    }
    if (mod.kind === "enemy-attacks-gain-leech") {
      modified = modified.map((e) =>
        e.kind === "damage" ? { ...e, lifesteal: true } : e,
      );
    }
  }
  return modified;
}

function computeStartingStatuses(modifiers: DifficultyModifier[], enemy: BestiaryEntry) {
  const startingArmor = modifiers.find((m) => m.kind === "enemy-starting-armor")?.amount ?? 0;
  const traitStartingArmor = enemy.traits.some((t) => t.id === "living-armor") ? LIVING_ARMOR_STARTING_ARMOR : 0;
  const startBlock = modifiers.find((m) => m.kind === "start-block")?.amount ?? 0;
  const manaBonus = modifiers.find((m) => m.kind === "start-max-mana")?.amount ?? 0;
  const startCompanion = modifiers.some((m) => m.kind === "start-companion");
  return { startingArmor: startingArmor + traitStartingArmor, startBlock, manaBonus, startCompanion };
}

function createInitialFlags() {
  return {
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
    resonantChimeUsedThisTurn: false,
  };
}

// Creates the initial BattleState for a fresh encounter. Enemy HP and attack
// scale per destination within an act (multiplicative by 1.1x per slot after the
// first) and per act baseline (1.2x per act). Boss-type enemies get an additional
// 1.8x multiplier. Delegates to focused helpers for opening hand, enemy scaling,
// difficulty modifiers, and initial status setup.
export function createBattleState(
  runDeck: BattleCard[],
  gold = 0,
  _roomsEncountered = 0,
  currentEnemy?: BestiaryEntry,
  playerHealth = MAX_PLAYER_HEALTH,
  talentEffects: TalentEffectManifest = defaultTalentEffects,
  discoveredCardIds: string[] = [],
  maxHealth = MAX_PLAYER_HEALTH,
  trinketIds: string[] = [],
  destinationIndexInAct = 0,
  currentAct = 1,
  difficultyModifiers: DifficultyModifier[] = [],
): BattleState {
  const trinketEffects = computeTrinketManifest(trinketIds);
  const { deck, hand, discard, nextCardUid } = setupOpeningHand(runDeck, trinketEffects);

  const enemy = currentEnemy ?? enemyBestiary[0];
  const { scaledEnemyHealth, scaledEnemyAttackEffects, enemyRegeneration } = buildScaledEnemy(enemy, destinationIndexInAct, currentAct);
  const modifiedEffects = applyDifficultyAttackModifiers(scaledEnemyAttackEffects, difficultyModifiers);
  const { startingArmor, startBlock, manaBonus, startCompanion } = computeStartingStatuses(difficultyModifiers, enemy);
  const startingHealth = Math.min(maxHealth, playerHealth + talentEffects.startHealth);

  return {
    deck,
    hand,
    discard,
    exhausted: [],
    mana: BASE_PLAYER_MANA + manaBonus,
    maxMana: BASE_PLAYER_MANA + manaBonus,
    gold,
    turn: STARTING_TURN,
    turnPhase: "player" as TurnPhase,
    playerHealth: startingHealth,
    playerMaxHealth: maxHealth,
    deathsDoorUsed: false,
    deathsDoorActive: false,
    deathsDoorTriggeredTurn: null,
    enemyHealth: scaledEnemyHealth,
    enemyMaxHealth: scaledEnemyHealth,
    enemyAttackEffects: modifiedEffects,
    enemyRegeneration,
    enemyArmor: startingArmor,
    enemyForge: 0,
    enemyFreezeBonus: 0,
    playerStatuses: { block: talentEffects.startBlock + startBlock, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 } as PlayerStatusValues,
    enemyStatuses: { burn: 0, poison: 0, bleed: 0, bleedLeech: 0, freeze: 0, stun: 0 } as EnemyStatusValues,
    enemyStunSkipTurns: 0,
    enemyFreezeSkipTurns: 0,
    wishOptions: null,
    wishQueue: [],
    activeCompanion: startCompanion ? companionLibrary["wolf"] : null,
    currentEnemy: enemy,
    talentEffects,
    trinketEffects,
    flags: createInitialFlags(),
    discoveredCardIds,
    cardsPlayedThisTurn: 0,
    nextCardUid,
    difficultyModifiers,
  };
}

export function shuffleCards(cards: BattleCard[]) {
  return shuffle(cards);
}
