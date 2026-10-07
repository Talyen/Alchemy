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

it("recognizes inflections and phrases in first occurrence order without matching word fragments", () => {
  expect(
    extractKeywordIds(
      "Dodged and Dodging; dodgeball dodger; physical STUN Block; Mana Crystal, Mana; Burning Poisoned; Consumed unconsumed",
    ),
  ).toEqual(["dodge", "physical", "stun", "block", "mana", "burn", "poison", "consume"]);
  expect(extractKeywordIds("dodgeball dodger unconsumed")).toEqual([]);
});
