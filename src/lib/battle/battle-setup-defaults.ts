/**
 * Default placeholder battle state and empty status/flag factories.
 * Depends on: @/lib/game-data, ../game-constants, ./types, ../trinkets.
 */
import { createEmptyTalentEffectManifest, type TalentEffectManifest } from "@/lib/game-data";
import { emptyInventory } from "@/lib/homestead/inventory";
import { BASE_ENEMY_HEALTH, FALLBACK_ENEMY_ATTACK, MAX_PLAYER_HEALTH } from "../game-constants";
import {
  EMPTY_ENEMY_MITIGATION,
  type BattleState,
  type CombatFlags,
  type EnemyStatusValues,
  type PlayerStatusValues,
} from "./types";
import { defaultTrinketEffects } from "../trinkets";
import { defaultGearEffects } from "@/lib/gear";
import { placeholderRng } from "./rng";

export const defaultTalentEffects: TalentEffectManifest = createEmptyTalentEffectManifest();

const skeletonEnemy = {
  id: "skeleton",
  title: "Skeleton",
  subtitle: "Placeholder — no battle should render this",
  descriptionLines: ["This enemy should never appear in an active battle."],
  art: "",
  enemyType: "normal" as const,
  traits: [],
  attackEffects: [{ kind: "damage" as const, damageType: "physical" as const, amount: FALLBACK_ENEMY_ATTACK }],
};

function createEmptyPlayerStatuses(): PlayerStatusValues {
  return {
    block: 0,
    armor: 0,
    forge: 0,
    haste: 0,
    phoenixFeather: 0,
    burn: 0,
    poison: 0,
    bleed: 0,
    freeze: 0,
    stun: 0,
  } satisfies PlayerStatusValues;
}

function createEmptyEnemyStatuses(): EnemyStatusValues {
  return { burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0, burnBonus: 0, freezeBonus: 0 } satisfies EnemyStatusValues;
}

function createInitialFlags(): CombatFlags {
  return {
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
    firstLeechCardDoubledUsed: false,
    firstConsumeCardFreeUsed: false,
    firstCompanionCardFreeUsed: false,
    firstArcheryCardFreeUsed: false,
    resonantChimeUsedThisTurn: false,
    runicQuillUsedThisTurn: false,
    consumeDrawUsedThisTurn: false,
    divineAegisTriggered: false,
    nextHitCrit: false,
    playNextCardTwice: false,
  };
}

export function defaultBattleState(): BattleState {
  return {
    deck: [],
    hand: [],
    discard: [],
    exhausted: [],
    mana: 0,
    maxMana: 0,
    gold: 0,
    turn: 1,
    turnPhase: "player",
    playerHealth: MAX_PLAYER_HEALTH,
    playerMaxHealth: MAX_PLAYER_HEALTH,
    deathsDoorUsed: false,
    deathsDoorActive: false,
    deathsDoorTriggeredTurn: null,
    deathsDoorGraceTurnsRemaining: null,
    enemyHealth: BASE_ENEMY_HEALTH,
    enemyMaxHealth: BASE_ENEMY_HEALTH,
    enemyAttackEffects: [],
    enemyMitigation: { ...EMPTY_ENEMY_MITIGATION },
    enemyRegeneration: 0,
    roomScalingMultiplier: 1,
    playerStatuses: createEmptyPlayerStatuses(),
    enemyStatuses: createEmptyEnemyStatuses(),
    pendingBleedLeechHealing: 0,
    pendingEnemyBleedLeechHealing: 0,
    enemyPhysicalDamageBonus: 0,
    playerCC: { stunSkipTurns: 0, freezeSkipTurns: 0, cooldown: 0 },
    enemyCC: { stunSkipTurns: 0, freezeSkipTurns: 0, cooldown: 0 },
    wishOptions: null,
    wishQueue: [],
    activeCompanion: null,
    companionDamageBuff: 0,
    currentEnemy: skeletonEnemy,
    talentEffects: defaultTalentEffects,
    trinketEffects: { ...defaultTrinketEffects },
    gearEffects: { ...defaultGearEffects },
    flags: createInitialFlags(),
    pendingTurnStartEffects: [],
    discoveredCardIds: [],
    cardsPlayedThisTurn: 0,
    nextCardUid: 0,
    difficultyModifiers: [],
    appliesFightPacing: true,
    rng: placeholderRng,
    pendingMaterials: emptyInventory(),
    contentSystemType: "campaign",
  };
}
