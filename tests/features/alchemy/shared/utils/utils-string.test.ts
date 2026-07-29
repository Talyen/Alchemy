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
    expect(keywordPart?.text).toBe("Physical");
  });

  it("tokenizes multiple keywords", () => {
    const result = tokenizeDescription("Gain 5 Block and 2 Armor");
    const keywordIds = result.filter((p) => p.keywordId).map((p) => p.keywordId);
    expect(keywordIds).toContain("block");
    expect(keywordIds).toContain("armor");
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
