import { describe, expect, it } from "vitest";
import { keywordDefinitions } from "@/lib/game-data";
import { getKeywordBorderShineColors } from "@/lib/keyword-border-shine";
import { gearAffixCatalog } from "@/lib/gear/affix-catalog";
import { gearDefinitions } from "@/lib/gear/definitions";
import {
  getAstralShineColors,
  getGearAffixTextShineColors,
  getGearDefinitionShineColors,
  getGearDefinitionTextShineColors,
  getGearInstanceKeywordIds,
  getGearInstanceShineColors,
  getGearInstanceTextShineColors,
  getUniqueGearShineColors,
  getUniqueGearTextShineColors,
  selectTextShineKeywordIds,
} from "@/lib/gear/gear-shine";
import type { GearInstance } from "@/lib/gear/types";

function instance(overrides: Partial<GearInstance> & Pick<GearInstance, "instanceId" | "definitionId">): GearInstance {
  return {
    affixes: [],
    ...overrides,
  };
}

describe("gear shine", () => {
  it("collects unique sorted keywords from affixes including secondary keywords", () => {
    const keywordIds = getGearInstanceKeywordIds(
      instance({
        instanceId: "shine-1",
        definitionId: "longsword-astral",
        affixes: [
          { id: "poison-leech", value: 5 },
          { id: "flat-burn", value: 2 },
        ],
      }),
    );

    expect(keywordIds).toEqual(["burn", "leech", "poison"]);
  });

  it("uses described keywords instead of hidden affix tags", () => {
    expect(getGearAffixTextShineColors(gearAffixCatalog["dance-of-blades"])).toEqual([
      "#bef264",
      "color-mix(in srgb, #bef264 55%, transparent)",
    ]);
  });

  it("does not add green from Leather Armor affinity without a green affix keyword", () => {
    const gear = instance({
      instanceId: "leather-no-green",
      definitionId: "leather-armor-astral",
      affixes: [
        { id: "armor-on-cc", value: 4 },
        { id: "flat-physical", value: 4 },
        { id: "flat-burn", value: 4 },
        { id: "flat-bleed", value: 4 },
      ],
    });
    expect(getGearInstanceKeywordIds(gear)).toEqual(["armor", "bleed", "burn", "freeze", "physical", "stun"]);
    for (const keywordId of ["dodge", "poison", "nature", "archery"] as const) {
      expect(getGearInstanceTextShineColors(gear)).not.toContain(keywordDefinitions[keywordId].shineColors[0]);
      expect(getGearInstanceShineColors(gear)).not.toContain(keywordDefinitions[keywordId].shineColors[0]);
    }
  });

  it("recognizes Nourishing and excludes the Consume card keyword from Blackfletch", () => {
    expect(getGearAffixTextShineColors(gearAffixCatalog["consume-heal-bonus"])).toEqual([
      "#f87171",
      "color-mix(in srgb, #f87171 55%, transparent)",
      "#a78bfa",
      "color-mix(in srgb, #a78bfa 55%, transparent)",
    ]);
    const gear = instance({
      instanceId: "blackfletch",
      definitionId: "blackfletch",
      affixes: [{ id: "blackfletch", value: 1 }],
    });
    expect(getGearInstanceKeywordIds(gear)).not.toContain("consume");
    expect(getGearAffixTextShineColors({ descriptionTemplate: "Physical Physical Stunned Frozen Poison" })).toEqual([
      "#cbd5e1",
      "color-mix(in srgb, #cbd5e1 55%, transparent)",
      "#fcd34d",
      "color-mix(in srgb, #fcd34d 55%, transparent)",
      "#67e8f9",
      "color-mix(in srgb, #67e8f9 55%, transparent)",
    ]);
  });

  it("returns no shine colors for basic gear", () => {
    expect(
      getGearInstanceShineColors(
        instance({
          instanceId: "basic-1",
          definitionId: "longsword-basic",
          affixes: [{ id: "flat-burn", value: 2 }],
        }),
      ),
    ).toEqual([]);
  });

  it("normalizes multi-affix astral border shine colors into a 3-4 stop loop", () => {
    const gear = instance({
      instanceId: "astral-multi",
      definitionId: "longsword-astral",
      affixes: [
        { id: "flat-burn", value: 2 },
        { id: "gold-on-kill", value: 1 },
      ],
    });

    const colors = getGearInstanceShineColors(gear);
    expect(colors).toEqual([
      keywordDefinitions.burn.shineColors[0],
      keywordDefinitions.gold.shineColors[0],
      keywordDefinitions.burn.shineColors[0],
    ]);
  });

  it("returns astral shine colors only for astral definitions", () => {
    expect(
      getAstralShineColors(
        instance({
          instanceId: "basic-1",
          definitionId: "longsword-basic",
          affixes: [],
        }),
      ),
    ).toBeUndefined();
    expect(
      getAstralShineColors(
        instance({
          instanceId: "astral-1",
          definitionId: "longsword-astral",
          affixes: [],
        }),
      ),
    ).toEqual(expect.arrayContaining(["#cbd5e1"]));
  });

  it("uses effect keywords for unique gear borders instead of the gold palette", () => {
    const unique = instance({
      instanceId: "unique-1",
      definitionId: "wardbreaker",
      affixes: [{ id: "flat-stun", value: 4 }],
    });
    const gold = ["#e6c58e", "#cd9b51", "#986b32", "#f3e4ca", "#e6c58e"];
    const keywordIds = getGearInstanceKeywordIds(unique);
    const expectedBorder = getKeywordBorderShineColors(keywordIds);
    expect(expectedBorder.length).toBeGreaterThan(0);
    expect(getGearInstanceShineColors(unique)).toEqual(expectedBorder);
    expect(getAstralShineColors(unique)).toEqual(expectedBorder);
    expect(getGearInstanceShineColors(unique)).not.toEqual(gold);
    expect(getGearDefinitionShineColors(gearDefinitions.wardbreaker!)).toEqual([
      keywordDefinitions.physical.shineColors[0],
      keywordDefinitions.stun.shineColors[0],
      keywordDefinitions.physical.shineColors[0],
    ]);
    expect(getGearInstanceTextShineColors(unique)).toEqual(["#f3e4ca", "color-mix(in srgb, #f3e4ca 55%, transparent)"]);
    expect(getGearDefinitionTextShineColors(gearDefinitions.wardbreaker!)).toEqual([
      "#f3e4ca",
      "color-mix(in srgb, #f3e4ca 55%, transparent)",
    ]);
  });

  it("keeps the gold palette for unique titles and hover backgrounds", () => {
    expect(getUniqueGearTextShineColors()).toEqual(["#f3e4ca", "color-mix(in srgb, #f3e4ca 55%, transparent)"]);
    expect(getUniqueGearShineColors()).toEqual(["#e6c58e", "#cd9b51", "#986b32", "#f3e4ca", "#e6c58e"]);
  });

  it("prefers base affinity keywords when selecting text shine keywords", () => {
    expect(
      selectTextShineKeywordIds(["bleed", "burn", "freeze", "physical", "poison"], ["physical", "forge", "holy"]),
    ).toEqual(["physical", "bleed", "burn"]);
  });

  it("caps instance text shine at three keywords with affinity first", () => {
    const gear = instance({
      instanceId: "astral-crowded",
      definitionId: "longsword-astral",
      affixes: [
        { id: "flat-physical", value: 2 },
        { id: "flat-burn", value: 2 },
        { id: "flat-freeze", value: 2 },
        { id: "flat-poison", value: 2 },
        { id: "flat-bleed", value: 2 },
      ],
    });

    const expected = ["physical", "bleed", "burn"].flatMap((keywordId) => [
      keywordDefinitions[keywordId as keyof typeof keywordDefinitions].shineColors[0],
      `color-mix(in srgb, ${keywordDefinitions[keywordId as keyof typeof keywordDefinitions].shineColors[0]} 55%, transparent)`,
    ]);
    expect(getGearInstanceTextShineColors(gear)).toEqual(expected);
    expect(getGearInstanceTextShineColors(gear)).not.toContain(keywordDefinitions.freeze.shineColors[0]!);
    expect(getGearInstanceTextShineColors(gear)).not.toContain(keywordDefinitions.poison.shineColors[0]!);
  });

  it("caps definition text shine at the first three affinity keywords", () => {
    const definition = {
      ...gearDefinitions["longsword-astral"]!,
      affinityKeywords: ["physical", "bleed", "poison", "dodge"],
    } as (typeof gearDefinitions)["longsword-astral"];

    const expected = ["physical", "bleed", "poison"].flatMap((keywordId) => [
      keywordDefinitions[keywordId as keyof typeof keywordDefinitions].shineColors[0],
      `color-mix(in srgb, ${keywordDefinitions[keywordId as keyof typeof keywordDefinitions].shineColors[0]} 55%, transparent)`,
    ]);
    expect(getGearDefinitionTextShineColors(definition)).toEqual(expected);
    expect(getGearDefinitionTextShineColors(definition)).not.toContain(keywordDefinitions.dodge.shineColors[0]!);
  });
});
