import { describe, expect, it } from "vitest";
import { gearBaseItems } from "@/lib/gear/base-items";
import { gearDefinitions, missingGearArtDefinitionIds } from "@/lib/gear/definitions";
import { uniqueItemList } from "@/lib/gear/unique-catalog";

describe("gear definitions and art", () => {
  it("builds the complete ordinary and Unique catalog", () => {
    const expected = [
      ...Object.keys(gearBaseItems).flatMap((id) => [`${id}-basic`, `${id}-astral`]),
      ...uniqueItemList.map((item) => item.id),
    ];
    expect(Object.keys(gearDefinitions).sort()).toEqual(expected.sort());
  });
  it("resolves art for every definition without missing-art fallbacks", () => {
    expect(missingGearArtDefinitionIds).toEqual([]);
  });
});
