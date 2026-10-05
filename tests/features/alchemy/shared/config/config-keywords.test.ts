import { describe, expect, it, vi } from "vitest";
import { keywordDefinitions } from "@/lib/game-data";
import { extractKeywordIds, keywordPattern } from "@/features/alchemy/shared/config/keywords";

describe("keyword extraction cache", () => {
  it("reuses parsing without letting a caller change keyword order or membership", () => {
    const text = "Keyword cache ownership: Frozen, Mana Crystal, Freeze, Bleeding.";
    const matchAll = vi.spyOn(keywordPattern, Symbol.matchAll);
    try {
      const first = extractKeywordIds(text);
      expect(first).toEqual(["freeze", "mana", "bleed"]);
      first.reverse();
      first.push("burn");
      expect(extractKeywordIds(text)).toEqual(["freeze", "mana", "bleed"]);
      expect(matchAll).toHaveBeenCalledOnce();
    } finally {
      matchAll.mockRestore();
    }
  });
});

describe("keywordAliases", () => {
  it("recognizes every keyword label without classifying Phoenix Feather as a keyword", () => {
    for (const definition of Object.values(keywordDefinitions)) {
      expect(extractKeywordIds(definition.label)).toEqual([definition.id]);
    }
    expect(extractKeywordIds("Phoenix Feather")).toEqual([]);
  });
});

describe("keywordPattern", () => {
  it("recognizes Dodge inflections without matching unrelated words", () => {
    expect("Dodge Dodges Dodged Dodging dodgeball dodger".match(keywordPattern)).toEqual([
      "Dodge",
      "Dodges",
      "Dodged",
      "Dodging",
    ]);
    expect(extractKeywordIds("Dodged and Dodging")).toEqual(["dodge"]);
  });
  it("matches case-insensitive phrases and preserves first occurrence order", () => {
    const text = "physical STUN Block; Gain 1 Mana Crystal and 2 Mana; Burning and Poisoned";
    expect(text.match(keywordPattern)).toEqual([
      "physical",
      "STUN",
      "Block",
      "Mana Crystal",
      "Mana",
      "Burning",
      "Poisoned",
    ]);
    expect(extractKeywordIds(text)).toEqual(["physical", "stun", "block", "mana", "burn", "poison"]);
  });
});

it("recognizes Consumed without matching parts of unrelated words", () => {
  expect(extractKeywordIds("Consumed cards Consume, Consumed again; unconsumed")).toEqual(["consume"]);
});
