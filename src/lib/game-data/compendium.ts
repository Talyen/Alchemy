// Public compendium barrel for enemies and trinkets.
import type { BestiaryEntry, TrinketEntry } from "./types";
import { enemyBestiary } from "./compendium/enemies";
import { trinketLibrary } from "./compendium/trinkets";

export { enemyBestiary } from "./compendium/enemies";
export { trinketLibrary } from "./compendium/trinkets";

/** Id-keyed view of the bestiary — prefer this over scanning `enemyBestiary` by id. */
export const enemyById: Record<string, BestiaryEntry> = Object.fromEntries(
  enemyBestiary.map((enemy) => [enemy.id, enemy]),
);

/** Id-keyed view of the trinket library — prefer this over scanning `trinketLibrary` by id. */
export const trinketById: Record<string, TrinketEntry> = Object.fromEntries(
  trinketLibrary.map((trinket) => [trinket.id, trinket]),
);
