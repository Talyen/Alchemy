/** Core immutable BattleState structures and combat event types. */

import type {
  BattleCard,
  BattleCardEffect,
  BestiaryEntry,
  CompanionDefinition,
  DamageType,
  DifficultyModifier,
  EnemyAttackEffect,
  EnemyStatusId,
  PlayerStatusId,
  TalentEffectManifest,
} from "@/lib/game-data";
import type { GearEffectManifest } from "@/lib/gear";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { ContentSystemId } from "@/lib/content-systems/types";

export interface PendingTurnStartPulse {
  remainingTurns: number;
  effects: BattleCardEffect[];
}

// Both player and enemy use status ID unions. Enemies can gain burnBonus and freezeBonus
// from boss traits (e.g., Iron Bear, Frostwarden). block/armor/forge live in enemyMitigation.
export type PlayerStatusValues = Record<PlayerStatusId, number>;
export type EnemyStatusValues = Record<EnemyStatusId, number>;

export type TurnPhase = "player" | "enemy";

// Enemy mitigation lives outside enemyStatuses: armor reduces incoming damage,
// forge adds physical attack bonus (decays per hit). Burn and freeze bonuses now live in enemyStatuses.
export interface EnemyMitigation {
  armor: number;
  forge: number;
  block: number;
}

export const EMPTY_ENEMY_MITIGATION: EnemyMitigation = { armor: 0, forge: 0, block: 0 };

// Per-side CC state: skip-turn counters and immunity cooldown, grouped to prevent
// update-site drift (was 6 top-level fields before the regroup).
export interface CcState {
  stunSkipTurns: number;
  freezeSkipTurns: number;
  cooldown: number;
}

// Pre-computed bonuses from boons acquired during the run. Follows the same
// pattern as TalentEffectManifest — computed once at battle start, immutable for
// the duration of the battle.
export interface TrinketManifest {
  extraDrawPerBattle: number;
  firstHolyDamageDoubled: boolean;
  firstBurnDoubled: boolean;
  boneCharmHealOnKill: number;
  forgeStunThreshold: number;
  forgeStunAmount: number;
  frozenHeartDamage: number;
  blockToArmorThreshold: number;
  blockToArmorAmount: number;
  runicQuillDrawOnConsume: number;
  sinEaterHealOnHarmfulStatusRemove: number;
  vanguardCrestForgeOnBlockAbsorb: number;
  parasiticBloomLeechChance: number;
  cutpurseGoldOnBleed: number;
  wishingWellGoldOnWish: number;
  plagueDoctorImmunity: boolean;
  mortarPestleFreeFirstPotion: boolean;
  sunderingArmorPiercing: number;
  resonantChimeCardsRequired: number;
  resonantChimeMana: number;
  smugglersMapGoldBonus: number;
  grovesFavorStartHeal: number;
  merchantsFavorDiscount: number;
  companionDamageBonus: number;
  freezeDurationExtension: number;
  thunderstoneDamageOnStun: number;
  luckyCloverGoldChance: number;
}

// Threshold-driven combat flags that reset each battle.
export interface CombatFlags {
  firstHolyCardFreeUsed: boolean;
  firstBurnCardDoubledUsed: boolean;
  firstArmorCardDoubledUsed: boolean;
  firstPoisonCardFreeUsed: boolean;
  firstBleedCardFreeUsed: boolean;
  nextCardCostReduction: number; // temporary mana discount on next card played
  goldOnFirstPoisonThisCombat: boolean;
  firstHolyDamageBonusUsed: boolean;
  firstBurnTrinketDoubledUsed: boolean;
  firstHarmfulStatusPrevented: boolean;
  firstPotionFreeUsed: boolean;
  firstLeechCardDoubledUsed: boolean;
  firstConsumeCardFreeUsed: boolean;
  firstCompanionCardFreeUsed: boolean;
  firstArcheryCardFreeUsed: boolean;
  resonantChimeUsedThisTurn: boolean;
  runicQuillUsedThisTurn: boolean;
  consumeDrawUsedThisTurn: boolean;
  divineAegisTriggered: boolean;
  nextHitCrit: boolean;
  playNextCardTwice: boolean;
}

// Subset of CombatFlags consumed by card play — companion actions must not consume these.
export type FirstTimeFlagKey =
  | "firstHolyCardFreeUsed"
  | "firstBurnCardDoubledUsed"
  | "firstArmorCardDoubledUsed"
  | "firstPoisonCardFreeUsed"
  | "firstBleedCardFreeUsed"
  | "firstHolyDamageBonusUsed"
  | "firstBurnTrinketDoubledUsed"
  | "firstLeechCardDoubledUsed"
  | "firstConsumeCardFreeUsed"
  | "firstCompanionCardFreeUsed"
  | "firstArcheryCardFreeUsed"
  | "firstPotionFreeUsed"
  | "nextCardCostReduction"
  | "resonantChimeUsedThisTurn"
  | "runicQuillUsedThisTurn"
  | "consumeDrawUsedThisTurn";

// The full snapshot of a battle at one point in time. Every mutation returns a new
// BattleState (immutable), enabling the controller to diff states for animation.
export interface BattleState {
  deck: BattleCard[];
  hand: BattleCard[];
  discard: BattleCard[];
  exhausted: BattleCard[]; // consumed cards removed for the battle
  mana: number;
  maxMana: number;
  gold: number;
  turn: number;
  turnPhase: TurnPhase;
  playerHealth: number;
  playerMaxHealth: number; // current max health (can increase from talents)
  deathsDoorUsed: boolean; // one-shot combat survival trigger for this battle
  deathsDoorActive: boolean; // true while lethal hits floor the player at 1 HP (grace turns remaining)
  deathsDoorTriggeredTurn: number | null; // stores player turn when Death's Door first triggered
  deathsDoorGraceTurnsRemaining: number | null; // stores grace turns remaining when Death's Door triggers
  enemyHealth: number;
  enemyMaxHealth: number; // stored so UI can render % even after damage
  enemyAttackEffects: EnemyAttackEffect[]; // scaled per room, applied during enemy phase
  enemyRegeneration: number; // health restored at end of each enemy turn
  roomScalingMultiplier: number; // room scaling factor applied to trait values and regen
  enemyMitigation: EnemyMitigation;
  playerStatuses: PlayerStatusValues;
  enemyStatuses: EnemyStatusValues;
  pendingBleedLeechHealing: number; // bleed leech queued here on damage, paid out in tickBleed — prevents double-dipping if enemy dies before bleed ticks
  pendingEnemyBleedLeechHealing: number;
  enemyPhysicalDamageBonus: number;
  playerCC: CcState;
  enemyCC: CcState;
  wishOptions: BattleCard[] | null; // non-null = Wish selection is active
  wishQueue: BattleCard[][]; // additional Wish selections waiting behind the active modal
  activeCompanion: CompanionDefinition | null; // persistent ally effect for this battle only
  companionDamageBuff: number; // persistent buff from Pack Tactics-style cards
  currentEnemy: BestiaryEntry;
  talentEffects: TalentEffectManifest;
  trinketEffects: TrinketManifest;
  gearEffects: GearEffectManifest;
  flags: CombatFlags;
  pendingTurnStartEffects: PendingTurnStartPulse[];
  discoveredCardIds: string[]; // used by wish undiscovered talent
  cardsPlayedThisTurn: number;
  nextCardUid: number; // battle-owned source for unique rendered card keys
  difficultyModifiers: DifficultyModifier[];
  appliesFightPacing: boolean;
  rng: () => number;
  pendingMaterials: MaterialInventory;
  contentSystemType: ContentSystemId;
}

// Combat texts are emitted by battle functions and consumed by the floating-text
// animation system. They're merged by (target, kind, stat) so rapid-fire damage
// from multi-hit cards shows "-5" instead of "-2 -3".
type CombatTextTarget = "player" | "enemy";
type CombatTextKind = "damage" | "heal" | "status" | "multiply" | "notice";
export type CombatTextStat = DamageType | PlayerStatusId | EnemyStatusId | "health" | "mana" | "gold" | "crystal";

export interface NumericCombatTextEvent {
  target: CombatTextTarget;
  kind: Exclude<CombatTextKind, "notice">;
  stat: CombatTextStat;
  amount: number;
}

interface NoticeCombatTextEvent {
  target: CombatTextTarget;
  kind: "notice";
  stat: CombatTextStat;
  text: string;
}

export type CombatTextEvent = NumericCombatTextEvent | NoticeCombatTextEvent;

export interface BattleResolution {
  state: BattleState;
  combatTexts: CombatTextEvent[];
}
