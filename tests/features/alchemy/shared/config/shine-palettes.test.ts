import { describe, expect, it } from "vitest";

import {
  getCardKeywordShineColors,
  getCharacterShineColors,
  getShineColorsForKeywords,
  getTrinketShineColors,
  getTrinketShineGradient,
  SHINE_PALETTES,
  WILDCARD_KEYWORD_SHINE_COLORS,
} from "@/features/alchemy/shared/config";
import { cardLibrary, characters, keywordDefinitions } from "@/lib/game-data";
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

  it("uses a keyword's shine palette without repeating identical stops", () => {
    const card = makeTestCard({
      effects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });
    expect(getCardKeywordShineColors(card)).toEqual([...new Set(keywordDefinitions.physical.shineColors)]);
  });

  it("mixes unique shine stops across multiple keywords", () => {
    const fireArrow = cardLibrary.find((card) => card.id === "fire-arrow");
    expect(fireArrow).toBeDefined();
    expect(getCardKeywordShineColors(fireArrow!)).toEqual([
      ...new Set([...keywordDefinitions.burn.shineColors, ...keywordDefinitions.archery.shineColors]),
    ]);
  });
});

describe("getTrinketShineColors", () => {
  it("uses description keywords when the trinket names them", () => {
    const colors = getTrinketShineColors("meteorite");
    expect(colors).toEqual(expect.arrayContaining([...keywordDefinitions.burn.shineColors]));
    expect(getTrinketShineGradient("meteorite")).toMatch(/^linear-gradient\(in oklab/);
  });

  it("falls back to the boon palette when no keywords resolve", () => {
    expect(getTrinketShineColors("tattered-pages")).toEqual([...SHINE_PALETTES.boon]);
    expect(getTrinketShineColors("missing-trinket")).toEqual([...SHINE_PALETTES.boon]);
  });
});

describe("WILDCARD_KEYWORD_SHINE_COLORS", () => {
  it("lists one stop per visible keyword for the hero-select cycle", () => {
    expect(WILDCARD_KEYWORD_SHINE_COLORS.length).toBeGreaterThan(3);
    expect(WILDCARD_KEYWORD_SHINE_COLORS).toContain(keywordDefinitions.burn.shineColors[0]);
    expect(WILDCARD_KEYWORD_SHINE_COLORS).toContain(keywordDefinitions.freeze.shineColors[0]);
  });
});
