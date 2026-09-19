import { describe, expect, it } from "vitest";

import {
  DEATHS_DOOR_PLASMA_PAIR,
  getBossShineColors,
  getBossTextShineColors,
  getPlasmaColorPair,
  getPlasmaColorPairFromColors,
  getPlasmaColorPairForCard,
  getPlasmaColorPairForCharacter,
  getPlasmaColorPairForEnemy,
  getPlasmaColorPairForGear,
  getPlasmaColorPairForUnique,
  getPlasmaColorPairForTalent,
  getPlasmaColorPairForTrinket,
  getEnemyKeywordShineColors,
  getPlasmaKeywordsForCharacter,
  getPlasmaKeywordsForEnemy,
  getPlasmaKeywordsForGear,
  getPlasmaKeywordsForTalent,
  lerpPlasmaColor,
} from "@/features/alchemy/shared/config/plasma-palettes";
import { parsePlasmaHexColor } from "@/lib/animation/plasma-colors";
import { SHINE_PALETTES, WILDCARD_KEYWORD_SHINE_COLORS, getBossById } from "@/features/alchemy/shared/config";
import { getKeywordBorderShineColors } from "@/lib/keyword-border-shine";
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

describe("character plasma mapping", () => {
  it("returns knight affinities in catalog order and wildcard has no affinities", () => {
    expect(getPlasmaKeywordsForCharacter("knight")).toEqual(characters.knight.keywords);
    expect(getPlasmaKeywordsForCharacter("wildcard")).toEqual([]);
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
  it("excludes absent base affinities and uses neutral gray for gear without keywords", () => {
    const gear = {
      instanceId: "leather",
      definitionId: "leather-armor-astral",
      affixes: [{ id: "flat-physical" as const, value: 4 }],
    };
    expect(getPlasmaKeywordsForGear(gear)).toEqual(["physical"]);
    expect(getPlasmaColorPairForGear(gear)).toEqual({ primary: "#cbd5e1", secondary: "#64748b" });
    expect(getPlasmaColorPairForGear({ ...gear, affixes: [] })).toEqual({ primary: "#cbd5e1", secondary: "#64748b" });
  });

  it("shares a valid gold hex pair between owned Unique gear and the collection", () => {
    const pair = getPlasmaColorPairForUnique();
    expect(pair).toEqual({ primary: "#fbbf24", secondary: "#f59e0b" });
    expect(
      getPlasmaColorPairForGear({
        instanceId: "dance",
        definitionId: "dance-of-blades",
        affixes: [{ id: "dance-of-blades", value: 1 }],
      }),
    ).toEqual(pair);
    for (const color of Object.values(pair!)) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(parsePlasmaHexColor(color)).not.toEqual([0.8, 0.8, 0.8]);
      expect(parsePlasmaHexColor(color).every(Number.isFinite)).toBe(true);
    }
  });

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
    abilityIds: [],
  };

  it("collects trait and all canonical ability keywords", () => {
    const entry: BestiaryEntry = {
      ...baseEntry,
      traits: [{ id: "t1", title: "Spores", description: "Applies Poison to the hero." }],
      abilityIds: ["frostbolt", "fireball"],
    };
    expect(getPlasmaKeywordsForEnemy(entry)).toEqual(["poison", "freeze", "burn"]);
  });

  it("maps trait and ability keywords to the enemy shine palette", () => {
    const entry: BestiaryEntry = {
      ...baseEntry,
      traits: [{ id: "t1", title: "Spores", description: "Applies Poison to the hero." }],
      abilityIds: ["frostbolt"],
    };

    expect(getEnemyKeywordShineColors(entry)).toEqual(getKeywordBorderShineColors(["poison", "freeze"]));
  });

  it("maps enemy keywords to a plasma pair with wildcard fallback", () => {
    const entry: BestiaryEntry = {
      ...baseEntry,
      abilityIds: ["fireball", "venom-fangs"],
    };
    expect(getPlasmaColorPairForEnemy(entry)).toEqual(getPlasmaColorPair(["burn", "poison", "leech"]));
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

describe("getBossShineColors", () => {
  function makeBoss(overrides: Partial<BestiaryEntry> = {}): BestiaryEntry {
    return {
      id: "test-boss",
      title: "Test Boss",
      subtitle: "",
      descriptionLines: [],
      art: "",
      enemyType: "boss",
      traits: [],
      abilityIds: [],
      ...overrides,
    };
  }

  it("collects keyword shine colors from boss traits and ability cards", () => {
    const frostwarden = getBossById("frostwarden");
    expect(frostwarden).toBeDefined();

    const colors = getBossShineColors(frostwarden!);

    expect(colors).toContain(keywordDefinitions.freeze.shineColors[0]);
    expect(colors).toContain(keywordDefinitions.burn.shineColors[0]);
    expect(colors).toContain(keywordDefinitions.block.shineColors[0]);
  });

  it("falls back when no combat keywords match", () => {
    const colors = getBossShineColors(makeBoss());
    expect(colors).toEqual([...SHINE_PALETTES.bossVictoryFallback]);
  });

  it("removes repeated palette stops for broader text bands", () => {
    expect(getBossTextShineColors(makeBoss())).toEqual(["#cbd5e1", "#64748b"]);
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
