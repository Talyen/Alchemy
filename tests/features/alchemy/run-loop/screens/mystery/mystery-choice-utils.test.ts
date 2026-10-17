import { expect, it } from "vitest";
import {
  getPlasmaKeywordsForMysteryReward,
  pairMysteryEffectsWithGrants,
} from "@/features/alchemy/run-loop/screens/mystery/mystery-choice-utils";
import { cardById, getCardKeywords } from "@/lib/game-data";
import { getPlasmaKeywordsForGear } from "@/features/alchemy/shared/config";
import { getTrinketKeywords } from "@/features/alchemy/shared/config/game-data-catalog";
import type { MysteryEffect } from "@/lib/mystery";

it("pairs Mystery gear grants in order and collects reward plasma keywords", () => {
  const gear = { instanceId: "first", definitionId: "emerald-ring-basic", affixes: [] };
  const lastGear = { instanceId: "last", definitionId: "ruby-ring-basic", affixes: [] };
  const effects: MysteryEffect[] = [
    { kind: "gainXP", keyword: "wish", amount: 1 },
    { kind: "gainTrinket", trinketId: "bone-charm" },
    { kind: "gainRandomGear" },
    { kind: "gainGeneratedGear", baseItemId: "ruby-ring" },
    { kind: "addCard", cardId: "slash" },
    { kind: "chooseCard" },
  ];
  const grantedGearInstances = [gear, lastGear];
  const paired = pairMysteryEffectsWithGrants(effects, grantedGearInstances);
  expect(paired.map(({ grantedGear }) => grantedGear?.instanceId)).toEqual([
    undefined,
    undefined,
    "first",
    "last",
    undefined,
    undefined,
  ]);
  const keywords = getPlasmaKeywordsForMysteryReward({
    choice: { label: "Mixed rewards", effects },
    grantedGearInstances,
    chosenCardId: "block",
    findCard: (id) => cardById[id],
  });
  expect(keywords).toEqual([
    ...new Set([
      "wish",
      ...getTrinketKeywords("bone-charm"),
      ...grantedGearInstances.flatMap(getPlasmaKeywordsForGear),
      ...getCardKeywords(cardById.slash!),
      ...getCardKeywords(cardById.block!),
    ]),
  ]);
  expect(effects).toEqual(paired.map(({ effect }) => effect));
  expect(grantedGearInstances).toEqual([gear, lastGear]);
});
