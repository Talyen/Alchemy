import type {
  BattleCard,
  BattleCardEffect,
  BestiaryEntry,
  CompanionDefinition,
  DamageType,
  DifficultyModifier,
  EnemyStatusId,
  PlayerStatusId,
  TalentEffectManifest,
  TrinketManifest,
} from "@/lib/game-data";
import type { GearEffectManifest } from "@/lib/gear";

export type { TrinketManifest };
import type { MaterialInventory } from "@/lib/homestead/types";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { CombatFlags } from "../combat-flags";
import type { UniqueGearBattleState } from "../unique-gear-state";

interface PendingTurnStartPulse {
  sourceCard?: Pick<BattleCard, "id" | "consume" | "tags">;
  remainingTurns: number;
  effects: BattleCardEffect[];
}

export type PlayerStatusValues = Record<PlayerStatusId, number>;
export type EnemyStatusValues = Record<EnemyStatusId, number>;

export type TurnPhase = "player" | "enemy";

export interface EnemyMitigation {
  armor: number;
  forge: number;
  block: number;
}

export const EMPTY_ENEMY_MITIGATION: EnemyMitigation = { armor: 0, forge: 0, block: 0 };

export interface CcState {
  stunSkipTurns: number;
  freezeSkipTurns: number;
  cooldown: number;
}

function hasActiveCc(cc: CcState): boolean {
  return cc.stunSkipTurns > 0 || cc.freezeSkipTurns > 0;
}

export function isStunFreezeBuildupBlocked(cc: CcState): boolean {
  return hasActiveCc(cc) || cc.cooldown > 0;
}

export type { CombatFlags } from "../combat-flags";

export interface BattleSnapshot {
  battleMetrics?: {
    enemyAttackActions: number;
    enemyAbilityActivations: Record<string, number>;
    enemyAbilityUses?: Record<string, number>;
  };
  deck: BattleCard[];
  hand: BattleCard[];
  discard: BattleCard[];
  exhausted: BattleCard[];
  mana: number;
  maxMana: number;
  gold: number;
  turn: number;
  turnPhase: TurnPhase;
  playerHealth: number;
  playerMaxHealth: number;
  playerDodgeCount: number;
  dodgeChanceFromDamage: number;
  deathsDoorUsed: boolean;
  deathsDoorActive: boolean;
  deathsDoorTriggeredTurn: number | null;
  deathsDoorGraceTurnsRemaining: number | null;
  enemyHealth: number;
  enemyMaxHealth: number;
  lastEnemyAbilityId: string | null;
  enemyRegeneration: number;
  roomScalingMultiplier: number;
  enemyMitigation: EnemyMitigation;
  playerStatuses: PlayerStatusValues;
  enemyStatuses: EnemyStatusValues;
  pendingBleedLeechHealing: number;
  pendingEnemyBleedLeechHealing: number;
  enemyPhysicalDamageBonus: number;
  playerCC: CcState;
  enemyCC: CcState;
  wishOptions: BattleCard[] | null;
  wishQueue: BattleCard[][];
  activeCompanion: CompanionDefinition | null;
  companionDamageBuff: number;
  currentEnemy: BestiaryEntry;
  talentEffects: TalentEffectManifest;
  trinketEffects: TrinketManifest;
  gearEffects: GearEffectManifest;
  flags: CombatFlags;
  uniqueGear: UniqueGearBattleState;
  pendingTurnStartEffects: PendingTurnStartPulse[];
  pendingForgeThresholds: Array<{ previousForge: number; nextForge: number }>;
  discoveredCardIds: string[];
  cardsPlayedThisTurn: number;
  nextCardUid: number;
  difficultyModifiers: DifficultyModifier[];
  appliesFightPacing: boolean;
  pendingMaterials: MaterialInventory;
  contentSystemType: ContentSystemId;
  encounterBenefits: EncounterRewardTraitId[];
}

type CombatTextTarget = "player" | "enemy";
type CombatTextKind = "damage" | "heal" | "status" | "multiply" | "notice";
export type CombatTextStat =
  | DamageType
  | PlayerStatusId
  | EnemyStatusId
  | "health"
  | "mana"
  | "gold"
  | "gems"
  | "dodge"
  | "deathsDoor";

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

/** Execution-only dependency; never retained in a committed or saved snapshot. */
export interface BattleResolutionContext {
  rng: () => number;
}

export interface BattleState extends BattleSnapshot, BattleResolutionContext {}

export function battleSnapshot(state: BattleSnapshot & Partial<BattleResolutionContext>): BattleSnapshot {
  // eslint-disable-next-line no-restricted-syntax -- Serialization removes the execution dependency without drawing it.
  const { rng: _rng, ...snapshot } = state;
  return snapshot;
}
