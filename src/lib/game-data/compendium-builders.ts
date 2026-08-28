import type { BestiaryEntry, PlayerStatusId, TrinketEntry } from "./types";

const ENEMY_SUBTITLES = { boss: "Boss", normal: "Normal", elite: "Elite" } as const;

export function trait(id: string, title: string, description: string): BestiaryEntry["traits"][number] {
  return { id, title, description };
}

export const poisonResistance = trait("poison-resistance", "Poison Resistance", "Receives 25% less Poison damage");

export function regeneration(title: string): BestiaryEntry["traits"][number] {
  return trait("regeneration", title, "Restores Health each turn");
}

export function phys(amount: number): BestiaryEntry["attackEffects"][number] {
  return { kind: "damage", damageType: "physical", amount };
}

export function playerStatus(status: PlayerStatusId, amount: number): BestiaryEntry["attackEffects"][number] {
  return { kind: "player-status", status, amount };
}

type EnemyDefinition = Omit<BestiaryEntry, "subtitle" | "descriptionLines">;

export function defineEnemy<const T extends EnemyDefinition>(entry: T): BestiaryEntry & T {
  return {
    ...entry,
    subtitle: ENEMY_SUBTITLES[entry.enemyType],
    descriptionLines: [],
  };
}

export function trinket<const Id extends string>(
  id: Id,
  title: string,
  description: string,
  art: string,
  effects: TrinketEntry["effects"] = {},
): TrinketEntry & { id: Id } {
  return { id, title, descriptionLines: [description], art, effects };
}
