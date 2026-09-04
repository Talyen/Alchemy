import { describe, expect, it } from "vitest";

import {
  DEATHS_DOOR_PLASMA_PAIR,
  getPlasmaColorPair,
  getPlasmaColorPairFromColors,
  getPlasmaColorPairForCard,
  getPlasmaColorPairForCharacter,
  getPlasmaColorPairForEnemy,
  getPlasmaColorPairForGear,
  getPlasmaColorPairForTalent,
  getPlasmaColorPairForTrinket,
  getPlasmaKeywordsForCharacter,
  getPlasmaKeywordsForEnemy,
  getPlasmaKeywordsForGear,
  getPlasmaKeywordsForTalent,
  lerpPlasmaColor,
} from "@/features/alchemy/shared/config/plasma-palettes";
import { parsePlasmaHexColor } from "@/lib/animation/plasma-colors";
import { SHINE_PALETTES, WILDCARD_KEYWORD_SHINE_COLORS } from "@/features/alchemy/shared/config";
import {
  cardById,
  characters,
  getCardKeywords,
  keywordDefinitions,
  trinketById,
  type BestiaryEntry,
} from "@/lib/game-data";
import { getTrinketKeywords } from "@/features/alchemy/shared/config/game-data-catalog";

describe("getPlasmaColorPair", () => {
  it("uses first keyword bright stop as primary and second keyword bright stop as secondary", () => {
    expect(getPlasmaColorPair(["block", "armor"])).toEqual({
      primary: keywordDefinitions.block.shineColors[0],
      secondary: keywordDefinitions.armor.shineColors[0],
    });
  });

  it("uses mid stop as secondary when only one keyword is present", () => {
    expect(getPlasmaColorPair(["burn"])).toEqual({
      primary: keywordDefinitions.burn.shineColors[0],
      secondary: keywordDefinitions.burn.shineColors[1],
    });
  });

  it("uses wildcard cycle colors when affinities are empty", () => {
    expect(getPlasmaColorPair([])).toEqual({
      primary: WILDCARD_KEYWORD_SHINE_COLORS[0],
      secondary: WILDCARD_KEYWORD_SHINE_COLORS[1],
    });
  });
});

describe("getPlasmaColorPairFromColors", () => {
  it("uses the first two distinct palette stops", () => {
    expect(getPlasmaColorPairFromColors(["#111111", "#111111", "#222222"])).toEqual({
      primary: "#111111",
      secondary: "#222222",
    });
  });
});

describe("getPlasmaKeywordsForCharacter", () => {
  it("returns knight affinity keywords in catalog order", () => {
    expect(getPlasmaKeywordsForCharacter("knight")).toEqual(characters.knight.keywords);
  });

  it("returns empty list for wildcard", () => {
    expect(getPlasmaKeywordsForCharacter("wildcard")).toEqual([]);
  });
});

describe("getPlasmaColorPairForCharacter", () => {
  it("maps knight affinities to plasma stops", () => {
    expect(getPlasmaColorPairForCharacter("knight")).toEqual({
      primary: keywordDefinitions.block.shineColors[0],
      secondary: keywordDefinitions.armor.shineColors[0],
    });
  });
});

describe("getPlasmaColorPairForCard", () => {
  it("maps card keywords to plasma color pair", () => {
    const card = Object.values(cardById).find((c) => getCardKeywords(c).length > 0);
    if (card) {
      expect(getPlasmaColorPairForCard(card)).toEqual(getPlasmaColorPair(getCardKeywords(card)));
    }
  });
});

describe("getPlasmaColorPairForTrinket", () => {
  it("maps trinket description keywords to plasma color pair", () => {
    const trinket = Object.values(trinketById)[0];
    if (trinket) {
      const keywords = getTrinketKeywords(trinket.id);
      expect(getPlasmaColorPairForTrinket(trinket)).toEqual(getPlasmaColorPair(keywords));
    }
  });
});

describe("getPlasmaKeywordsForGear", () => {
  it("extracts keywords from gear affixes and definition", () => {
    const gear = {
      instanceId: "test-gear",
      definitionId: "broadsword-basic",
      affixes: [{ id: "flat-physical" as const, value: 5 }],
    };
    const keywords = getPlasmaKeywordsForGear(gear);
    expect(Array.isArray(keywords)).toBe(true);
    expect(keywords).toContain("physical");
    expect(getPlasmaColorPairForGear(gear)).toEqual(getPlasmaColorPair(keywords));
  });
});

describe("getPlasmaKeywordsForTalent", () => {
  it("uses the talent's keyword only", () => {
    const talent = {
      id: "test-talent",
      keywordId: "burn" as const,
      description: "When you apply Burn, also apply 2 Bleed.",
    };
    const keywords = getPlasmaKeywordsForTalent(talent);
    expect(keywords).toEqual(["burn"]);
    expect(getPlasmaColorPairForTalent(talent)).toEqual(getPlasmaColorPair(["burn"]));
  });
});

describe("getPlasmaKeywordsForEnemy", () => {
  const baseEntry: BestiaryEntry = {
    id: "test-enemy",
    title: "Test Enemy",
    subtitle: "",
    descriptionLines: [],
    art: "",
    enemyType: "normal",
    traits: [],
    attackEffects: [],
  };

  it("collects damage types from attack effects", () => {
    const entry: BestiaryEntry = {
      ...baseEntry,
      attackEffects: [{ kind: "damage", damageType: "burn", amount: 3 }],
    };
    expect(getPlasmaKeywordsForEnemy(entry)).toEqual(["burn"]);
  });

  it("collects keywords from trait descriptions", () => {
    const entry: BestiaryEntry = {
      ...baseEntry,
      traits: [{ id: "t1", title: "Spores", description: "Applies Poison to the hero." }],
    };
    expect(getPlasmaKeywordsForEnemy(entry)).toEqual(["poison"]);
  });

  it("honors the live attack-effects override", () => {
    const entry: BestiaryEntry = {
      ...baseEntry,
      attackEffects: [{ kind: "damage", damageType: "burn", amount: 3 }],
    };
    expect(getPlasmaKeywordsForEnemy(entry, [{ kind: "damage", damageType: "freeze", amount: 2 }])).toEqual(["freeze"]);
  });

  it("maps enemy keywords to a plasma pair with wildcard fallback", () => {
    const entry: BestiaryEntry = {
      ...baseEntry,
      attackEffects: [
        { kind: "damage", damageType: "burn", amount: 2 },
        { kind: "damage", damageType: "poison", amount: 1 },
      ],
    };
    expect(getPlasmaColorPairForEnemy(entry)).toEqual(getPlasmaColorPair(["burn", "poison"]));
    expect(getPlasmaColorPairForEnemy(baseEntry)).toEqual(getPlasmaColorPair([]));
  });
});

describe("DEATHS_DOOR_PLASMA_PAIR", () => {
  it("uses death's door shine colors for defeat", () => {
    expect(DEATHS_DOOR_PLASMA_PAIR).toEqual({
      primary: SHINE_PALETTES.deathsDoorArt[1],
      secondary: SHINE_PALETTES.deathsDoorArt[0],
    });
  });
});

describe("plasma color utilities", () => {
  it("parses six-digit hex colors", () => {
    expect(parsePlasmaHexColor("#ff8040")).toEqual([1, 128 / 255, 64 / 255]);
  });

  it("lerps between hex colors", () => {
    expect(lerpPlasmaColor("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
});
