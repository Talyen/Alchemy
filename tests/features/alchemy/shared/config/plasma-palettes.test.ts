import { describe, expect, it } from "vitest";

import {
  getBossShineColors,
  getPlasmaColorPair,
  getPlasmaColorPairFromColors,
  getPlasmaColorPairForCharacter,
  getPlasmaColorPairForEnemy,
  getPlasmaColorPairForGear,
  getPlasmaColorPairForUnique,
  getEnemyKeywordShineColors,
  getPlasmaKeywordsForCharacter,
  getPlasmaKeywordsForEnemy,
  getPlasmaKeywordsForGear,
} from "@/features/alchemy/shared/config/plasma-palettes";
import { parsePlasmaHexColor } from "@/lib/animation/plasma-colors";
import { SHINE_PALETTES, WILDCARD_KEYWORD_SHINE_COLORS, getBossById } from "@/features/alchemy/shared/config";
import { getKeywordBorderShineColors } from "@/lib/keyword-border-shine";
import { characters, keywordDefinitions, type BestiaryEntry } from "@/lib/game-data";

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
    expect(pair).toEqual({ primary: "#e6c58e", secondary: "#cd9b51" });
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

  it("uses visible trait keywords for the enemy shine palette", () => {
    const entry: BestiaryEntry = {
      ...baseEntry,
      traits: [{ id: "t1", title: "Spores", description: "Applies Poison to the hero." }],
      abilityIds: ["frostbolt"],
    };

    expect(getEnemyKeywordShineColors(entry)).toEqual(getKeywordBorderShineColors(["poison"]));
    expect(getEnemyKeywordShineColors({ ...baseEntry, abilityIds: ["frostbolt"] })).toEqual([
      ...SHINE_PALETTES.bossVictoryFallback,
    ]);
    expect(getEnemyKeywordShineColors(entry, ["tempered"])).toEqual(getKeywordBorderShineColors(["poison", "forge"]));
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

describe("getBossShineColors", () => {
  it("collects boss border colors from visible traits, excluding ability-only keywords", () => {
    const frostwarden = getBossById("frostwarden");
    expect(frostwarden).toBeDefined();

    const colors = getBossShineColors(frostwarden!);

    expect(colors).toContain(keywordDefinitions.freeze.shineColors[0]);
    expect(colors).toContain(keywordDefinitions.burn.shineColors[0]);
    expect(colors).not.toContain(keywordDefinitions.block.shineColors[0]);
  });
});
