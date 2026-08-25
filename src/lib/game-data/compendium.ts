// Public compendium barrel for enemies and trinkets.
import type { EnemyType, TrinketEntry } from "./types";
import { enemyBestiary } from "./compendium/enemies";
import { trinketLibrary } from "./compendium/trinkets";

export { enemyBestiary } from "./compendium/enemies";
export { trinketLibrary } from "./compendium/trinkets";

export type EnemyEntry = (typeof enemyBestiary)[number];
export type EnemyId = EnemyEntry["id"];
export type BossEnemyEntry = Extract<EnemyEntry, { enemyType: "boss" }>;
export type BossEnemyId = BossEnemyEntry["id"];

type EnemyById = { [Entry in EnemyEntry as Entry["id"]]: Entry };

/** Derived catalog views — keep selection code from rebuilding or scanning static pools. */
export const enemyById = Object.fromEntries(enemyBestiary.map((enemy) => [enemy.id, enemy])) as EnemyById;

export function isEnemyId(value: string): value is EnemyId {
  return Object.hasOwn(enemyById, value);
}

export const enemiesByType = Object.fromEntries(
  (["normal", "elite", "boss"] as const).map((type) => [
    type,
    enemyBestiary.filter((enemy) => enemy.enemyType === type),
  ]),
) as { [Type in EnemyType]: Array<Extract<EnemyEntry, { enemyType: Type }>> };

export const bossEnemies = enemiesByType.boss;

/** Room-offer pool: the tutorial skeleton is never selected after the opening fight. */
export const encounterEnemies = enemyBestiary.filter((enemy) => enemy.id !== "skeleton");

/** Id-keyed view of the trinket library — prefer this over scanning `trinketLibrary` by id. */
export const trinketById: Record<string, TrinketEntry> = Object.fromEntries(
  trinketLibrary.map((trinket) => [trinket.id, trinket]),
);
