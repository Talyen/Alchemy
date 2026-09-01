import type { BattleCard } from "../../types";
import { archeryCards } from "./archery";
import { companionCards } from "./companions";
import { consumableCards } from "./consumables";
import { coreCards } from "./core";
import { defenseCards } from "./defense";

export const cardLibrary: BattleCard[] = [
  ...coreCards,
  ...archeryCards,
  ...consumableCards,
  ...companionCards,
  ...defenseCards,
] satisfies BattleCard[];

export const cardById: Record<string, BattleCard> = Object.fromEntries(cardLibrary.map((card) => [card.id, card]));

if (Object.keys(cardById).length !== cardLibrary.length) {
  throw new Error("Duplicate card id in cardLibrary");
}
