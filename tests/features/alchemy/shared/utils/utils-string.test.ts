import { describe, expect, it, vi } from "vitest";
import { keywordPattern } from "@/features/alchemy/shared/config/keywords";
import {
  canonicalizeKeywordText,
  tokenizeDescription,
  extractKeywordIds,
  getHoverId,
} from "@/features/alchemy/shared/utils/string";

describe("tokenizeDescription", () => {
  it("reuses keyword parsing while keeping callers' parts independent", () => {
    const line = "Cache regression: Gain 37 Block.";
    const matchAll = vi.spyOn(keywordPattern, Symbol.matchAll);
    try {
      const first = tokenizeDescription(line);
      const expected = first.map((part) => ({ ...part }));
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

  it("evicts old numeric variants and leaves oversized descriptions uncached", () => {
    const line = "Eviction regression: Gain 999 Block.";
    const oversized = "Long description ".repeat(128) + "Gain 7 Block.";
    const matchAll = vi.spyOn(keywordPattern, Symbol.matchAll);
    try {
      const expected = tokenizeDescription(line);
      for (let amount = 0; amount < 512; amount++) tokenizeDescription(`Cache churn: Gain ${amount} Block.`);
      expect(tokenizeDescription(line)).toEqual(expected);
      expect(matchAll.mock.calls.filter(([text]) => text === line)).toHaveLength(2);

      expect(tokenizeDescription(oversized)).toEqual(tokenizeDescription(oversized));
      expect(matchAll.mock.calls.filter(([text]) => text === oversized)).toHaveLength(2);
    } finally {
      matchAll.mockRestore();
    }
  });

  it("returns a plain text part for a sentence with no keywords", () => {
    const result = tokenizeDescription("Just some text");
    expect(result).toEqual([{ text: "Just some text" }]);
  });

  it("tokenizes a single keyword in the middle of text", () => {
    const result = tokenizeDescription("Deal 5 Physical damage");
    expect(result.length).toBeGreaterThanOrEqual(2);
    const keywordPart = result.find((p) => p.keywordId === "physical");
    expect(keywordPart?.text).toBe("Physical");
  });

  it("tokenizes multiple keywords", () => {
    const result = tokenizeDescription("Gain 5 Block and 2 Armor");
    const keywordIds = result.filter((p) => p.keywordId).map((p) => p.keywordId);
    expect(keywordIds).toContain("block");
    expect(keywordIds).toContain("armor");
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

  it("handles an empty string", () => {
    const result = tokenizeDescription("");
    expect(result).toEqual([{ text: "" }]);
  });
});

describe("extractKeywordIds", () => {
  it("returns unique keyword ids in description order of first appearance", () => {
    expect(extractKeywordIds("Gain 5 Block and 2 Armor")).toEqual(["block", "armor"]);
  });

  it("returns an empty array when no keywords match", () => {
    expect(extractKeywordIds("Just some text")).toEqual([]);
  });
});

describe("getHoverId", () => {
  it("joins scope and cardId with a dash", () => {
    expect(getHoverId("hand", "slash")).toBe("hand-slash");
    expect(getHoverId("reward", "fireball")).toBe("reward-fireball");
  });
});
