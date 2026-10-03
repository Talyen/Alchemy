import { TRANSMUTATION_ROLES } from "../transmutation-roles";
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
].map(
  (card): BattleCard => ({
    ...card,
    ...(Object.hasOwn(TRANSMUTATION_ROLES, card.id)
      ? { transmutationRole: TRANSMUTATION_ROLES[card.id as keyof typeof TRANSMUTATION_ROLES] }
      : {}),
  }),
);

export const cardById: Record<string, BattleCard> = Object.fromEntries(cardLibrary.map((card) => [card.id, card]));

if (Object.keys(cardById).length !== cardLibrary.length) {
  throw new Error("Duplicate card id in cardLibrary");
}
