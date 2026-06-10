// Ensures every implemented talent declares at least one manifest effect operation.
import { describe, expect, it } from "vitest";
import { talentPool, isTalentPlaceholder } from "@/lib/game-data";

describe("talents match effects", () => {
  it("every non-placeholder talent has at least one effect", () => {
    const missing = talentPool.filter(
      (talent) => !isTalentPlaceholder(talent) && (!talent.effects || talent.effects.length === 0),
    );
    expect(
      missing.map((t) => t.id),
      `Implemented talents missing effects: ${missing.map((t) => t.id).join(", ")}`,
    ).toEqual([]);
  });

  it("placeholder talents never declare effects", () => {
    const invalid = talentPool.filter(
      (talent) => isTalentPlaceholder(talent) && talent.effects && talent.effects.length > 0,
    );
    expect(invalid.map((t) => t.id)).toEqual([]);
  });
});
