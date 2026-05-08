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

  it("maps legacy wizard to sorcerer", () => {
    const result = normalizeActiveRun({ characterId: "wizard", characterGender: "male" });
    expect(result?.characterId).toBe("sorcerer");
  });

  it("maps legacy warden to ranger", () => {
    const result = normalizeActiveRun({ characterId: "warden", characterGender: "female" });
    expect(result?.characterId).toBe("ranger");
  });

  it("passes through valid knight characterId", () => {
    const result = normalizeActiveRun({ characterId: "knight", characterGender: "male" });
    expect(result?.characterId).toBe("knight");
  });

  it("passes through valid ranger characterId", () => {
    const result = normalizeActiveRun({ characterId: "ranger", characterGender: "female" });
    expect(result?.characterId).toBe("ranger");
  });

  it("passes through valid rogue characterId", () => {
    const result = normalizeActiveRun({ characterId: "rogue", characterGender: "male" });
    expect(result?.characterId).toBe("rogue");
  });

  it("passes through valid sorcerer characterId", () => {
    const result = normalizeActiveRun({ characterId: "sorcerer", characterGender: "female" });
    expect(result?.characterId).toBe("sorcerer");
  });

  it("returns null for unknown characterId", () => {
    const result = normalizeActiveRun({ characterId: "bard", characterGender: "male" });
    expect(result).toBeNull();
  });

  it("normalizes male gender", () => {
    const result = normalizeActiveRun({ characterId: "knight", characterGender: "male" });
    expect(result?.characterGender).toBe("male");
  });

  it("normalizes female gender", () => {
    const result = normalizeActiveRun({ characterId: "knight", characterGender: "female" });
    expect(result?.characterGender).toBe("female");
  });

  it("defaults any non-male/non-female gender to female", () => {
    const result = normalizeActiveRun({ characterId: "knight", characterGender: "other" as any });
    expect(result?.characterGender).toBe("female");
  });
});
