import { describe, expect, it, vi } from "vitest";
import { keywordPattern } from "@/features/alchemy/shared/config/keywords";
import { canonicalizeKeywordText, tokenizeDescription } from "@/features/alchemy/shared/utils/string";

describe("tokenizeDescription", () => {
  it("reuses keyword parsing while keeping callers' parts independent", () => {
    const line = "Cache regression: Gain 37 Block.";
    const matchAll = vi.spyOn(keywordPattern, Symbol.matchAll);
    try {
      const first = tokenizeDescription(line);
      const expected = [{ text: "Cache regression: Gain 37 " }, { text: "Block", keywordId: "block" }, { text: "." }];
      expect(first).toEqual(expected);
      first[0]!.text = "changed";
      first.find((part) => part.keywordId)!.keywordId = "burn";
      first.pop();

      expect(tokenizeDescription(line)).toEqual(expected);
      expect(canonicalizeKeywordText(line)).toBe(line);
      expect(matchAll).toHaveBeenCalledOnce();
    } finally {
      matchAll.mockRestore();
    }
  });

  it("uses canonical casing for lowercase, inflected, and multi-word aliases", () => {
    const result = tokenizeDescription("physical consume consumed frozen mana crystal");

    expect(result.filter((part) => part.keywordId).map((part) => part.text)).toEqual([
      "Physical",
      "Consume",
      "Consumed",
      "Frozen",
      "Mana Crystal",
    ]);
    expect(canonicalizeKeywordText("physical consume consumed frozen mana crystal")).toBe(
      "Physical Consume Consumed Frozen Mana Crystal",
    );
  });
});

it("keeps punctuation and word boundaries while canonicalizing multiword aliases", () => {
  const line = "mana crystal, armor; blocked? poison ivy and mana!";
  const expected = [
    { text: "Mana Crystal", keywordId: "mana" },
    { text: ", " },
    { text: "Armor", keywordId: "armor" },
    { text: "; blocked? " },
    { text: "Poison", keywordId: "poison" },
    { text: " ivy and " },
    { text: "Mana", keywordId: "mana" },
    { text: "!" },
  ];
  expect(tokenizeDescription(line)).toEqual(expected);
  expect(canonicalizeKeywordText(line)).toBe("Mana Crystal, Armor; blocked? Poison ivy and Mana!");
});
