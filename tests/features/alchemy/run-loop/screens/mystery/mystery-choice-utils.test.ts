import { expect, it } from "vitest";
import {
  getPlasmaKeywordsForMysteryReward,
  pairMysteryEffectsWithGrants,
} from "@/features/alchemy/run-loop/screens/mystery/mystery-choice-utils";
import { cardById, getCardKeywords } from "@/lib/game-data";
import { getPlasmaKeywordsForGear } from "@/features/alchemy/shared/config";
import { getTrinketKeywords } from "@/features/alchemy/shared/config/game-data-catalog";
import type { MysteryEffect } from "@/lib/mystery";

it("pairs mixed Mystery grants in order so exhausted Boons cannot steal the next Gear reward", () => {
  const gear = { instanceId: "first", definitionId: "emerald-ring-basic", affixes: [] };
  const fallback = { instanceId: "fallback", definitionId: "leather-armor-basic", affixes: [] };
  const lastGear = { instanceId: "last", definitionId: "ruby-ring-basic", affixes: [] };
  const effects: MysteryEffect[] = [
    { kind: "gainXP", keyword: "wish", amount: 1 },
    { kind: "gainTrinket", trinketId: "bone-charm" },
    { kind: "gainRandomTrinket" },
    { kind: "gainRandomGear" },
    { kind: "gainRandomTrinket" },
    { kind: "gainGeneratedGear", baseItemId: "ruby-ring" },
    { kind: "addCard", cardId: "slash" },
    { kind: "chooseCard" },
  ];
  const grantedGearInstances = [gear, fallback, lastGear];
  const grantedTrinketIds = ["lucky-clover"];
  const paired = pairMysteryEffectsWithGrants(effects, grantedTrinketIds, grantedGearInstances);
  expect(paired.map(({ grantedTrinketId }) => grantedTrinketId)).toEqual([
    undefined,
    undefined,
    "lucky-clover",
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
  ]);
  expect(paired.map(({ grantedGear }) => grantedGear?.instanceId)).toEqual([
    undefined,
    undefined,
    undefined,
    "first",
    "fallback",
    "last",
    undefined,
    undefined,
  ]);
  const keywords = getPlasmaKeywordsForMysteryReward({
    choice: { label: "Mixed rewards", effects },
    grantedTrinketIds,
    grantedGearInstances,
    chosenCardId: "block",
    findCard: (id) => cardById[id],
  });
  expect(keywords).toEqual([
    ...new Set([
      "wish",
      ...getTrinketKeywords("bone-charm"),
      ...getTrinketKeywords("lucky-clover"),
      ...grantedGearInstances.flatMap(getPlasmaKeywordsForGear),
      ...getCardKeywords(cardById.slash!),
      ...getCardKeywords(cardById.block!),
    ]),
  ]);
  expect(effects).toEqual(paired.map(({ effect }) => effect));
  expect(grantedGearInstances).toEqual([gear, fallback, lastGear]);
});
