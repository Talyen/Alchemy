import { describe, expect, it } from "vitest";
import { runContentValidation } from "@/lib/content-validation";
import { collectTrinketParityIssues } from "@/lib/content-validation/validators";
import type { ContentValidationArea } from "@/lib/content-validation";

const ALL_AREAS: ContentValidationArea[] = [
  "art",
  "balance",
  "cards",
  "companions",
  "encounter-traits",
  "enemies",
  "gear",
  "keywords",
  "rewards",
  "statuses",
  "talents",
  "trinkets",
];

describe("content authoring validation", () => {
  const PLACEHOLDER_ENEMY_IDS = [
    "bandit",
    "banshee",
    "blood-countess",
    "blood-cultist",
    "brawler",
    "cleric",
    "dire-wolf",
    "earth-elemental",
    "fire-imp",
    "giant-snake",
    "giant-spider",
    "hellhound",
    "ice-wraith",
    "inquisitor",
    "ogre",
    "paladin",
    "pyromancer",
    "seraph",
    "stone-golem",
    "stone-titan",
    "vampire",
    "winter-wolf",
    "yeti",
    "zealot",
  ];

  it("has no structural content errors", () => {
    const result = runContentValidation();
    const messages = result.errors.map((issue) => `[${issue.area}] ${issue.id}: ${issue.message}`);
    expect(messages).toEqual([]);
  });

  it("has no unexpected content warnings", () => {
    const result = runContentValidation();
    for (const area of ALL_AREAS) {
      const areaWarnings = result.warnings.filter((w) => w.area === area);
      if (area === "art") {
        expect(areaWarnings.map((warning) => warning.id)).toEqual(PLACEHOLDER_ENEMY_IDS);
      } else {
        expect(areaWarnings, `${area} warnings`).toEqual([]);
      }
    }
  });
});

describe("collectTrinketParityIssues", () => {
  const baseTrinket = {
    id: "test-charm",
    descriptionLines: ["Gain 3 Block whenever you play 2 cards."],
    effects: { blockPerCardsPlayed: 3, cardsRequired: 2 },
  };

  it("passes when every numeric effect appears in the prose", () => {
    expect(collectTrinketParityIssues(baseTrinket)).toEqual([]);
  });

  it("rejects a value satisfied only as a substring of a larger number", () => {
    const trinket = { ...baseTrinket, descriptionLines: ["Gain 13 Block on turn start."], effects: { block: 3 } };
    expect(collectTrinketParityIssues(trinket)).toEqual(["Effect block value 3 does not appear in description"]);
  });

  it("does not match digits inside decimals", () => {
    const trinket = { ...baseTrinket, descriptionLines: ["Heals 1.5x your level."], effects: { heal: 1 } };
    expect(collectTrinketParityIssues(trinket)).toEqual(["Effect heal value 1 does not appear in description"]);
  });

  it("flags a trinket that declares no combat effects", () => {
    expect(collectTrinketParityIssues({ ...baseTrinket, effects: {} })).toEqual(["declares no combat effects"]);
  });
});
