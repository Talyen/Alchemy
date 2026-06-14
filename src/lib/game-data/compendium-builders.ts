// Factories for compendium enemy and boon entries — reduces repeated field boilerplate.
import type { BestiaryEntry, PlayerStatusId, BoonEntry } from "./types";

const ENEMY_SUBTITLES = { boss: "Boss", normal: "Normal", elite: "Elite" } as const;

export function trait(id: string, title: string, description: string): BestiaryEntry["traits"][number] {
  return { id, title, description };
}

export const poisonResistance = trait("poison-resistance", "Poison Resistance", "Receives half Poison damage");

export function regeneration(title: string): BestiaryEntry["traits"][number] {
  return trait("regeneration", title, "Restores Health each turn");
}

export function phys(amount: number): BestiaryEntry["attackEffects"][number] {
  return { kind: "damage", damageType: "physical", amount };
}

export function playerStatus(status: PlayerStatusId, amount: number): BestiaryEntry["attackEffects"][number] {
  return { kind: "player-status", status, amount };
}

export function defineEnemy(entry: Omit<BestiaryEntry, "subtitle" | "descriptionLines">): BestiaryEntry {
  return {
    ...entry,
    subtitle: ENEMY_SUBTITLES[entry.enemyType],
    descriptionLines: [],
  };
}

export function boon(id: BoonEntry["id"], title: string, description: string, art: string): BoonEntry {
  return { id, title, descriptionLines: [description], art };
}
