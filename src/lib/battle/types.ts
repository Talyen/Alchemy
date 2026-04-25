import type { BattleCard, DamageType, EnemyStatusId, PlayerStatusId } from "@/lib/game-data";

export const cardsPerTurn = 4;
export const maxHandSize = 7;
export const maxPlayerHealth = 36;
export const maxEnemyHealth = 30;

export type PlayerStatusValues = Record<PlayerStatusId, number>;

export type EnemyStatusValues = Record<EnemyStatusId, number> & {
  bleedLeech: number;
};

export type BattleState = {
  deck: BattleCard[];
  hand: BattleCard[];
  discard: BattleCard[];
  exhausted: BattleCard[];
  mana: number;
  maxMana: number;
  gold: number;
  turn: number;
  playerHealth: number;
  enemyHealth: number;
  playerStatuses: PlayerStatusValues;
  enemyStatuses: EnemyStatusValues;
  enemySkipTurns: number;
  wishOptions: BattleCard[] | null;
};

export type CombatTextTarget = "player" | "enemy";
export type CombatTextKind = "damage" | "heal" | "status";
export type CombatTextStat = DamageType | PlayerStatusId | EnemyStatusId | "health";

export type CombatTextEvent = {
  target: CombatTextTarget;
  kind: CombatTextKind;
  stat: CombatTextStat;
  amount: number;
};

export type BattleResolution = {
  state: BattleState;
  combatTexts: CombatTextEvent[];
};

export const emptyPlayerStatuses = (): PlayerStatusValues => ({
  block: 0,
  armor: 0,
  forge: 0,
  haste: 0,
  burn: 0,
  poison: 0,
  bleed: 0,
  freeze: 0,
  stun: 0,
});

export const emptyEnemyStatuses = (): EnemyStatusValues => ({
  burn: 0,
  poison: 0,
  bleed: 0,
  bleedLeech: 0,
  freeze: 0,
  stun: 0,
});
