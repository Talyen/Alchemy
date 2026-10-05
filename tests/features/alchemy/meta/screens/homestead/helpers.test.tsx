import { expect, it } from "vitest";
import { getHomesteadUpgradeShineColors, type GoalItem } from "@/features/alchemy/meta/screens/homestead/helpers";
import { buildings } from "@/lib/homestead/data";
import { keywordDefinitions } from "@/lib/game-data";

it("derives palettes from the current upgrade tiers even when catalog identities are reused", () => {
  const upgrade = (benefitDescription: string): GoalItem => ({
    kind: "building",
    data: {
      ...buildings[0]!,
      tiers: [{ ...buildings[0]!.tiers[0]!, benefitDescription, nonCombatBenefitDescription: "" }],
    },
  });
  const physical = upgrade("Gain 1 Physical damage");
  const burning = upgrade("Gain 1 Burn damage");
  expect(physical.data.id).toBe(burning.data.id);
  expect(getHomesteadUpgradeShineColors(physical)).toEqual(keywordDefinitions.physical.shineColors);
  expect(getHomesteadUpgradeShineColors(burning)).toEqual(keywordDefinitions.burn.shineColors);
  expect(getHomesteadUpgradeShineColors(physical)).toEqual(keywordDefinitions.physical.shineColors);
});
