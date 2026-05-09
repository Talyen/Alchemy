import { describe, expect, it } from "vitest";
import { normalizeActiveRun } from "@/features/alchemy/storage";

describe("normalizeActiveRun", () => {
  it("returns null for null input", () => {
    expect(normalizeActiveRun(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(normalizeActiveRun(undefined)).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(normalizeActiveRun("string")).toBeNull();
    expect(normalizeActiveRun(42)).toBeNull();
  });

  it("maps legacy sorcerer to wizard", () => {
    const result = normalizeActiveRun({ characterId: "sorcerer" });
    expect(result?.characterId).toBe("wizard");
  });

  it("maps legacy warden to ranger", () => {
    const result = normalizeActiveRun({ characterId: "warden" });
    expect(result?.characterId).toBe("ranger");
  });

  it("passes through valid knight characterId", () => {
    const result = normalizeActiveRun({ characterId: "knight" });
    expect(result?.characterId).toBe("knight");
  });

  it("passes through valid ranger characterId", () => {
    const result = normalizeActiveRun({ characterId: "ranger" });
    expect(result?.characterId).toBe("ranger");
  });

  it("passes through valid rogue characterId", () => {
    const result = normalizeActiveRun({ characterId: "rogue" });
    expect(result?.characterId).toBe("rogue");
  });

  it("passes through valid wizard characterId", () => {
    const result = normalizeActiveRun({ characterId: "wizard" });
    expect(result?.characterId).toBe("wizard");
  });

  it("returns null for unknown characterId", () => {
    const result = normalizeActiveRun({ characterId: "bard" });
    expect(result).toBeNull();
  });
});
