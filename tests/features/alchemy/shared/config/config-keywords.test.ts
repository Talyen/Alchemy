import { describe, expect, it } from "vitest";
import { keywordAliases, keywordPattern } from "@/features/alchemy/shared/config/keywords";

describe("keywordAliases", () => {
  it("every alias has a match string and keywordId", () => {
    for (const alias of keywordAliases) {
      expect(alias.match).toBeTruthy();
      expect(alias.keywordId).toBeTruthy();
    }
  });
});

describe("keywordPattern", () => {
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
