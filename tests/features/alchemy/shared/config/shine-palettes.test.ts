import { describe, expect, it } from "vitest";

import {
  buildSmoothShineGradient,
  getCardKeywordShineColors,
  getCharacterShineColors,
  getShineColorsForKeywords,
  getTrinketShineColors,
  getTrinketTextShineColors,
  SHINE_PALETTES,
  WILDCARD_KEYWORD_SHINE_COLORS,
} from "@/features/alchemy/shared/config";
import { cardLibrary, characters, keywordDefinitions } from "@/lib/game-data";
import { getKeywordTextShineColors } from "@/lib/keyword-text-shine";
import { makeTestCard } from "../../../../fixtures/cards";

describe("getShineColorsForKeywords", () => {
  it("uses one shine stop per hero affinity", () => {
    const colors = getShineColorsForKeywords(characters.knight.keywords);
    expect(colors).toEqual([
      keywordDefinitions.block.shineColors[0],
      keywordDefinitions.armor.shineColors[0],
      keywordDefinitions.stun.shineColors[0],
    ]);
  });

  it("uses a gold and black shine when affinities are empty", () => {
    expect(getShineColorsForKeywords(characters.wildcard.keywords)).toEqual([...SHINE_PALETTES.wildcard]);
  });
});

describe("getCharacterShineColors", () => {
  it("uses knight affinity shine colors", () => {
    expect(getCharacterShineColors("knight")).toEqual([
      keywordDefinitions.block.shineColors[0],
      keywordDefinitions.armor.shineColors[0],
      keywordDefinitions.stun.shineColors[0],
    ]);
  });

  it("keeps gold and black for Wildcard battle shine", () => {
    expect(getCharacterShineColors("wildcard")).toEqual([...SHINE_PALETTES.wildcard]);
  });
});

describe("getCardKeywordShineColors", () => {
  it("returns no colors when the card has no keywords", () => {
    expect(getCardKeywordShineColors(makeTestCard())).toEqual([]);
  });

  it("uses a keyword's 3-stop pulse for a single keyword", () => {
    const card = makeTestCard({
      effects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });
    expect(getCardKeywordShineColors(card)).toEqual([...keywordDefinitions.physical.shineColors]);
  });

  it("normalizes multiple keywords into a smooth loop using primary accent colors", () => {
    const fireArrow = cardLibrary.find((card) => card.id === "fire-arrow");
    expect(fireArrow).toBeDefined();
    expect(getCardKeywordShineColors(fireArrow!)).toEqual([
      keywordDefinitions.burn.shineColors[0],
      keywordDefinitions.armor.shineColors[0],
      keywordDefinitions.archery.shineColors[0],
      keywordDefinitions.burn.shineColors[0],
    ]);
  });
});

describe("getTrinketShineColors", () => {
  it("uses description keywords when the trinket names them", () => {
    const colors = getTrinketShineColors("meteorite");
    expect(colors).toEqual(expect.arrayContaining([...keywordDefinitions.burn.shineColors]));
  });

  it("falls back to the boon palette when no keywords resolve", () => {
    expect(getTrinketShineColors("tattered-pages")).toEqual([...SHINE_PALETTES.boon]);
    expect(getTrinketShineColors("missing-trinket")).toEqual([...SHINE_PALETTES.boon]);
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

describe("buildSmoothShineGradient", () => {
  it.each([
    [["#111111", "#222222"], 2],
    [["#111111"], 2],
  ] as const)("repeats palettes with traveling highlights", (colors, expectedHighlights) => {
    const gradient = buildSmoothShineGradient(colors);
    expect(gradient).not.toBeNull();
    if (gradient === null) return;
    expect(gradient).toMatch(/^linear-gradient\(in oklab/);
    expect(gradient.match(/#ffffff/g)).toHaveLength(expectedHighlights);
    expect(gradient).toContain(colors[0]);
  });
});

describe("WILDCARD_KEYWORD_SHINE_COLORS", () => {
  it("lists one stop per visible keyword for the hero-select cycle", () => {
    expect(WILDCARD_KEYWORD_SHINE_COLORS.length).toBeGreaterThan(3);
    expect(WILDCARD_KEYWORD_SHINE_COLORS).toContain(keywordDefinitions.burn.shineColors[0]);
    expect(WILDCARD_KEYWORD_SHINE_COLORS).toContain(keywordDefinitions.freeze.shineColors[0]);
  });
});
