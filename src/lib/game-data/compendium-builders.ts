import { getCatalogArt } from "./assets";
import type { BestiaryEntry } from "./types";

const ENEMY_SUBTITLES = { boss: "Boss", normal: "Normal", elite: "Elite" } as const;

export function trait(
  id: string,
  title: string,
  description: string,
  polarity: "positive" | "negative" = "positive",
): BestiaryEntry["traits"][number] {
  return { id, title, description, polarity };
}

type EnemyDefinition = Omit<BestiaryEntry, "subtitle" | "descriptionLines" | "art"> & { art?: string };

export function defineEnemy<const T extends EnemyDefinition>(entry: T): BestiaryEntry & T {
  return {
    ...entry,
    art: entry.art ?? getCatalogArt(entry.id),
    subtitle: ENEMY_SUBTITLES[entry.enemyType],
    descriptionLines: [],
  };
}
