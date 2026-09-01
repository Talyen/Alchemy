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
  TrinketManifest,
} from "@/lib/game-data";
import type { GearEffectManifest } from "@/lib/gear";

export type { TrinketManifest };
import type { MaterialInventory } from "@/lib/homestead/types";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { CombatFlags } from "../combat-flags";

export interface PendingTurnStartPulse {
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

export type { CombatFlags, FlagId, FirstTimeFlagKey, PreservedFlagKey } from "../combat-flags";
export { FLAG_DEFINITIONS, PRESERVED_FLAG_VALUES, PRESERVED_FLAG_KEYS, createInitialFlags } from "../combat-flags";

export interface BattleState {
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
  deathsDoorUsed: boolean;
  deathsDoorActive: boolean;
  deathsDoorTriggeredTurn: number | null;
  deathsDoorGraceTurnsRemaining: number | null;
  enemyHealth: number;
  enemyMaxHealth: number;
  enemyAttackEffects: EnemyAttackEffect[];
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
  pendingTurnStartEffects: PendingTurnStartPulse[];
  discoveredCardIds: string[];
  cardsPlayedThisTurn: number;
  nextCardUid: number;
  difficultyModifiers: DifficultyModifier[];
  appliesFightPacing: boolean;
  rng: () => number;
  pendingMaterials: MaterialInventory;
  contentSystemType: ContentSystemId;
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
  | "dodge";

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
