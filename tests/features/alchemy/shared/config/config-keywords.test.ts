import { describe, expect, it, vi } from "vitest";
import { keywordDefinitions } from "@/lib/game-data";
import { extractKeywordIds, keywordAliases, keywordPattern } from "@/features/alchemy/shared/config/keywords";

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

  it("bounds retention of numeric variants and bypasses oversized input", () => {
    const text = "Keyword cache eviction: Gain 1001 Block.";
    const oversized = "Oversized keyword description ".repeat(64) + "Apply Poison.";
    const matchAll = vi.spyOn(keywordPattern, Symbol.matchAll);
    try {
      expect(extractKeywordIds(text)).toEqual(["block"]);
      for (let amount = 0; amount < 512; amount++) extractKeywordIds(`Keyword cache churn: Gain ${amount} Block.`);
      expect(extractKeywordIds(text)).toEqual(["block"]);
      expect(matchAll.mock.calls.filter(([input]) => input === text)).toHaveLength(2);
      expect(extractKeywordIds(oversized)).toEqual(["poison"]);
      expect(extractKeywordIds(oversized)).toEqual(["poison"]);
      expect(matchAll.mock.calls.filter(([input]) => input === oversized)).toHaveLength(2);
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

  it("every alias has a match string and keywordId", () => {
    for (const alias of keywordAliases) {
      expect(alias.match).toBeTruthy();
      expect(alias.keywordId).toBeTruthy();
    }
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
  it("matches 'Physical' in a sentence", () => {
    const text = "Deal 5 Physical damage";
    const matches = text.match(keywordPattern);
    expect(matches).not.toBeNull();
    expect(matches![0].toLowerCase()).toBe("physical");
  });

  it("matches 'Bleed' as standalone word", () => {
    const text = "Apply 3 Bleed";
    const matches = text.match(keywordPattern);
    expect(matches).not.toBeNull();
    expect(matches!.some((m) => m.toLowerCase() === "bleed")).toBe(true);
  });

  it("matches 'Mana Crystal' when both present", () => {
    const text = "Gain 1 Mana Crystal and restore 2 Mana";
    const matches = text.match(keywordPattern);
    expect(matches).not.toBeNull();
    expect(matches!.some((m) => m === "Mana Crystal")).toBe(true);
  });

  it("matches case-insensitively", () => {
    const text = "physical STUN Block";
    const matches = text.match(keywordPattern);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(3);
  });

  it("matches multiple distinct keywords in one string", () => {
    const text = "Burn deals 5 damage and applies Poison";
    const matches = text.match(keywordPattern);
    expect(matches).not.toBeNull();
    expect(matches!.some((m) => m.toLowerCase() === "burn")).toBe(true);
    expect(matches!.some((m) => m.toLowerCase() === "poison")).toBe(true);
  });
});

it("recognizes Consumed without matching parts of unrelated words", () => {
  expect(extractKeywordIds("Consumed cards Consume, Consumed again; unconsumed")).toEqual(["consume"]);
});
