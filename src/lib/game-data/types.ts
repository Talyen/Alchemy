export type KeywordId =
  | "physical"
  | "stun"
  | "block"
  | "forge"
  | "armor"
  | "health"
  | "burn"
  | "gold"
  | "holy"
  | "wish"
  | "ailment"
  | "consume"
  | "poison"
  | "bleed"
  | "leech"
  | "freeze"
  | "mana"
  | "nature"
  | "companion"
  | "trap";

export type CardTemplate = "mechanical" | "nature" | "arcane" | "holy" | "alchemy";

export type DamageType = "physical" | "stun" | "holy" | "burn" | "poison" | "bleed" | "freeze";

export type PlayerStatusId = "block" | "armor" | "forge" | "haste" | "burn" | "poison" | "bleed" | "freeze" | "stun";

export type EnemyStatusId = "burn" | "poison" | "bleed" | "freeze" | "stun";

export type CompanionId = "wolf" | "lizard-scout" | "imp";

export type EnemyAttackEffect =
  | { kind: "damage"; damageType: "physical"; amount: number; lifesteal?: boolean }
  | { kind: "player-status"; status: PlayerStatusId; amount: number };

export type EnemyTrait = {
  id: string;
  title: string;
  description: string;
};

export type BattleCardEffect =
  | { kind: "damage"; damageType: DamageType; amount: number; lifesteal?: boolean; fromBlock?: boolean }
  | { kind: "player-status"; status: Extract<PlayerStatusId, "block" | "armor" | "forge" | "haste">; amount: number }
  | { kind: "heal"; amount: number }
  | { kind: "restore-mana"; amount: number }
  | { kind: "lose-mana"; amount: number }
  | { kind: "lose-max-mana"; amount: number }
  | { kind: "gain-max-mana"; amount: number }
  | { kind: "gain-gold"; amount: number }
  | { kind: "wish"; amount: number }
  | { kind: "summon-companion"; companionId: CompanionId }
  | { kind: "remove-ailment"; mode: "one" | "all" };

export type CompanionDefinition = {
  id: CompanionId;
  title: string;
  art: string;
  turnStartEffects: BattleCardEffect[];
};

export type BattleCard = {
  id: string;
  uid?: number;
  title: string;
  descriptionLines: string[];
  art: string;
  cost: number;
  template: CardTemplate;
  consume?: boolean;
  effects: BattleCardEffect[];
};

export type EnemyType = "normal" | "elite" | "boss";

export type BestiaryEntry = {
  id: string;
  title: string;
  subtitle: string;
  descriptionLines: string[];
  art: string;
  enemyType: EnemyType;
  traits: EnemyTrait[];
  attackEffects: EnemyAttackEffect[];
};

export type TrinketEntry = {
  id: string;
  title: string;
  descriptionLines: string[];
  art: string;
};

export type KeywordDefinition = {
  id: KeywordId;
  label: string;
  description: string;
  colorClass: string;
};

export const ailmentStatusIds: PlayerStatusId[] = ["burn", "poison", "bleed", "freeze", "stun"];
