import { describe, expect, it } from "vitest";
import { tokenizeDescription, getHoverId } from "@/features/alchemy/shared/utils/string";

describe("tokenizeDescription", () => {
  it("returns a plain text part for a sentence with no keywords", () => {
    const result = tokenizeDescription("Just some text");
    expect(result).toEqual([{ text: "Just some text" }]);
  });

  it("tokenizes a single keyword in the middle of text", () => {
    const result = tokenizeDescription("Deal 5 Physical damage");
    expect(result.length).toBeGreaterThanOrEqual(2);
    const keywordPart = result.find((p) => p.keywordId === "physical");
    expect(keywordPart).toBeDefined();
    expect(keywordPart!.text).toBe("Physical");
  });

  it("tokenizes multiple keywords", () => {
    const result = tokenizeDescription("Gain 5 Block and 2 Armor");
    const keywordIds = result.filter((p) => p.keywordId).map((p) => p.keywordId);
    expect(keywordIds).toContain("block");
    expect(keywordIds).toContain("armor");
  });

  it('recognizes "Mana Crystal" before "Mana" as separate keywords', () => {
    const result = tokenizeDescription("Gain 1 Mana Crystal and restore 2 Mana");
    const manaCrystal = result.find((p) => p.text === "Mana Crystal");
    const mana = result.find((p) => p.text === "Mana");
    expect(manaCrystal).toBeDefined();
    expect(mana).toBeDefined();
  });

  it("matches case-insensitively", () => {
    const result = tokenizeDescription("physical STUN Block");
    const keywordIds = result.filter((p) => p.keywordId).map((p) => p.text.toLowerCase());
    expect(keywordIds).toContain("physical");
    expect(keywordIds).toContain("stun");
    expect(keywordIds).toContain("block");
  });

  it('maps "HP" to the health keyword', () => {
    const result = tokenizeDescription("Heal 5 HP");
    const hp = result.find((p) => p.text === "HP");
    expect(hp).toBeDefined();
    expect(hp!.keywordId).toBe("health");
  });

  it("handles an empty string", () => {
    const result = tokenizeDescription("");
    expect(result).toEqual([{ text: "" }]);
  });
});

describe("getHoverId", () => {
  it("joins scope and cardId with a dash", () => {
    expect(getHoverId("hand", "slash")).toBe("hand-slash");
    expect(getHoverId("reward", "fireball")).toBe("reward-fireball");
  });
});
