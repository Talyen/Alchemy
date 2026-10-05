import { describe, expect, it } from "vitest";

import {
  getCardDisplayKeywords,
  getTrinketShineColors,
  getTrinketTextShineColors,
  SHINE_PALETTES,
} from "@/features/alchemy/shared/config";
import { cardLibrary, keywordDefinitions } from "@/lib/game-data";
import { getKeywordTextShineColors } from "@/lib/keyword-text-shine";

describe("card display keywords", () => {
  it("includes conditional and companion keywords visible in card descriptions", () => {
    const packTactics = cardLibrary.find((card) => card.id === "pack-tactics")!;
    const wolfCompanion = cardLibrary.find((card) => card.id === "wolf-companion")!;

    expect(getCardDisplayKeywords(packTactics)).toEqual(["companion", "wish", "block"]);
    expect(getCardDisplayKeywords(wolfCompanion)).toEqual(["bleed", "physical", "companion"]);
    expect(getCardDisplayKeywords(wolfCompanion)).not.toContain("consume");
  });
});

describe("Trinket text shine", () => {
  it("caps distinct keywords in description order and uses bright/dim pairs", () => {
    expect(getKeywordTextShineColors(["freeze", "burn", "freeze", "poison", "physical"])).toEqual([
      "#67e8f9",
      "color-mix(in srgb, #67e8f9 55%, transparent)",
      "#fb923c",
      "color-mix(in srgb, #fb923c 55%, transparent)",
      "#15803d",
      "color-mix(in srgb, #15803d 55%, transparent)",
    ]);
  });

  it("uses paired title colors without changing the artwork palette", () => {
    expect(getTrinketTextShineColors("meteorite")).toEqual(["#fb923c", "color-mix(in srgb, #fb923c 55%, transparent)"]);
    expect(getTrinketShineColors("meteorite")).toEqual([...keywordDefinitions.burn.shineColors]);
  });

  it("preserves the Boon fallback for titles without keywords", () => {
    expect(getTrinketTextShineColors("tattered-pages")).toEqual([...SHINE_PALETTES.boon]);
    expect(getTrinketTextShineColors("missing-trinket")).toEqual([...SHINE_PALETTES.boon]);
  });
});
