import type { ElementalReactionState } from "../elemental-reaction-state";
import type { ReactionId } from "../reaction-definitions";
import type { BattleActionContext } from "../action-context";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import type { ContentSystemId } from "@/lib/content-systems/types";
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
import type { MaterialInventory } from "@/lib/homestead/types";
import type { CombatFlags } from "../combat-flags";
import type { Rng } from "@/lib/rng";
import type { BattleResolutionObserver } from "../resolution-observer";
import type { UniqueGearBattleState } from "../unique-gear-state";

export type { TrinketManifest };

interface PendingTurnStartPulse {
  sourceCard?: Pick<BattleCard, "id" | "consume" | "tags">;
  remainingTurns: number;
  effects: BattleCardEffect[];
}

export type PlayerStatusValues = Record<PlayerStatusId, number>;
export type EnemyStatusValues = Record<EnemyStatusId, number>;

type TurnPhase = "player" | "enemy";

export interface EnemyMitigation {
  armor: number;
  forge: number;
  block: number;
}

export interface CcState {
  stunSkipTurns: number;
  freezeSkipTurns: number;
  cooldown: number;
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
  pendingHandCards: BattleCard[];
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
  /** Subset of pending Bleed Leech supplied by explicit card Leech. */
  pendingCardBleedLeechHealing: number;
  pendingEnemyBleedLeechHealing: number;
  enemyPhysicalDamageBonus: number;
  playerCC: CcState;
  enemyCC: CcState;
  wishOptions: BattleCard[] | null;
  wishQueue: BattleCard[][];
  activeCompanion: CompanionDefinition | null;
  currentEnemy: BestiaryEntry;
  talentEffects: TalentEffectManifest;
  trinketEffects: TrinketManifest;
  gearEffects: GearEffectManifest;
  flags: CombatFlags;
  reactions: ElementalReactionState;
  uniqueGear: UniqueGearBattleState;
  pendingTurnStartEffects: PendingTurnStartPulse[];
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
  | "deathsDoor"
  | "nextHitCrit"
  | "nextHitLeech"
  | "nextHitPoison"
  | "playNextCardTwice"
  | "nextArcheryCardFree"
  | "dodgeNextAttack"
  | "dodgeNextAttackChance"
  | "draw"
  | "companion"
  | "wish"
  | "cleanse"
  | "scheduled"
  | "effect";

interface CombatTextIntent {
  /** Display intent only: authored card outcomes versus costs, riders and triggered rewards. */
  feedback?: "primary" | "secondary";
  /** Resolved Companion action owns playback; never merged with another action. */
  companionActionId?: number;
}

export interface NumericCombatTextEvent extends CombatTextIntent {
  target: CombatTextTarget;
  kind: Exclude<CombatTextKind, "notice">;
  stat: CombatTextStat;
  amount: number;
  impact?: boolean;
  additive?: boolean;
  /** Resolved packet facts for audio; display amounts and combat calculations are unchanged. */
  healthLost?: number;
  absorbedDamage?: number;
  critical?: boolean;
  periodic?: boolean;
  /** Actual consumed DoT payoff, distinct from a natural tick or direct hit. */
  detonation?: true;
  /** Exact earned payoff origin; distinct from its single output damage type and card intent. */
  reactionId?: ReactionId;
}

interface NoticeCombatTextEvent extends CombatTextIntent {
  target: CombatTextTarget;
  kind: "notice";
  stat: CombatTextStat;
  text: string;
  signal?: "prepared" | "cleanse" | "purge" | "immune";
}

interface ReactionCombatTextEvent extends CombatTextIntent {
  target: CombatTextTarget;
  kind: "notice";
  stat: CombatTextStat;
  text: string;
  signal: "reaction";
  reactionId: ReactionId;
}

export type CombatTextEvent = NumericCombatTextEvent | NoticeCombatTextEvent | ReactionCombatTextEvent;

export interface BattleResolution {
  state: BattleState;
  combatTexts: CombatTextEvent[];
}

/** Resolved presentation facts, never part of a saved battle or another RNG draw. */
export interface CompanionActionCue {
  companionId: CompanionDefinition["id"];
  kind: "attack" | "cast";
  resolution?: {
    id: number;
    texts: CombatTextEvent[];
    before: Pick<BattleSnapshot, "playerHealth" | "enemyHealth">;
    after: Pick<BattleSnapshot, "playerHealth" | "enemyHealth">;
  };
}

/** Execution-only dependency; never retained in a committed or saved snapshot. */
export interface BattleResolutionContext {
  rng: Rng;
  /** Fresh deck draws, not created cards or later overflow delivery. Never persisted. */
  onCardsDrawn?: (uids: readonly number[]) => void;
  onCompanionAction?: (cue: CompanionActionCue) => void;
  companionActionSequence?: { current: number };
  observer?: BattleResolutionObserver;
  /** A deferred offer has pending choices but no identities until external input. */
  sampleWishOptions?: (sample: () => BattleCard[]) => { cards: BattleCard[]; deferred: boolean };
  action?: BattleActionContext;
  onEmptyDraw?: (state: BattleState, amount: number, texts: CombatTextEvent[]) => BattleState;
}

export interface BattleState extends BattleSnapshot, BattleResolutionContext {}
