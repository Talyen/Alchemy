import type { EnemyType, TrinketEntry } from "./types";
import { enemyBestiary } from "./compendium/enemies";
import { trinketLibrary } from "./compendium/trinkets";

export { enemyBestiary } from "./compendium/enemies";
export { trinketLibrary } from "./compendium/trinkets";

export type EnemyEntry = (typeof enemyBestiary)[number];
export type EnemyId = EnemyEntry["id"];

type TrinketCatalogEntry = (typeof trinketLibrary)[number];
export type TrinketId = TrinketCatalogEntry["id"];

type EnemyById = { [Entry in EnemyEntry as Entry["id"]]: Entry } & Record<string, EnemyEntry | undefined>;
type TrinketById = { [Entry in TrinketCatalogEntry as Entry["id"]]: Entry } & Record<string, TrinketEntry | undefined>;

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

export const encounterEnemies = enemyBestiary.filter((enemy) => enemy.id !== "skeleton");

export const trinketById = Object.fromEntries(trinketLibrary.map((trinket) => [trinket.id, trinket])) as TrinketById;

export function isTrinketId(value: string): value is TrinketId {
  return Object.hasOwn(trinketById, value);
}
