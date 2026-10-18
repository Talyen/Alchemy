import { expect, it } from "vitest";
import { getGearInstanceAffixes } from "@/lib/gear/affixes";
import { getUniqueAffixes } from "@/lib/gear/unique-catalog";
import { getGearInstanceKeywordIds } from "@/lib/gear/gear-shine";
import type { GearInstance } from "@/lib/gear/types";

it("resolves canonical Unique affixes for combat and inspection regardless of stored rolls", () => {
  const first: GearInstance = { instanceId: "unique-read-1", definitionId: "wardbreaker", affixes: [] };
  const second: GearInstance = {
    instanceId: "unique-read-2",
    definitionId: "wardbreaker",
    affixes: [{ id: "flat-burn", value: 999 }],
  };
  const expected = getUniqueAffixes("wardbreaker")!;
  expect(getGearInstanceAffixes(first)).toEqual(expected);
  expect(getGearInstanceAffixes(second)).toEqual(expected);
  expect(getGearInstanceKeywordIds(first)).toEqual(getGearInstanceKeywordIds(second));
});

it("filters Gear by the same accepted affixes its tooltip and combat use", () => {
  const item: GearInstance = {
    instanceId: "filtered",
    definitionId: "dagger-astral",
    affixes: [
      { id: "flat-physical", value: 0 },
      { id: "flat-burn", value: NaN },
      { id: "flat-freeze", value: -1 },
      { id: "flat-poison", value: Infinity },
      { id: "flat-holy", value: 3 },
    ],
  };
  expect(getGearInstanceKeywordIds(item)).toEqual(["holy"]);
});
