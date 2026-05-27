import { describe, expect, it } from "vitest";
import { talentPool } from "@/lib/game-data";

const validKeywords: string[] = [
  "physical", "stun", "block", "forge", "armor", "health", "burn", "gold",
  "holy", "wish", "poison", "bleed", "leech", "freeze",
  "mana", "nature", "companion", "archery", "consume",
];

describe("talentPool data integrity", () => {
  it("all talent IDs are unique", () => {
    const ids = talentPool.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each talent has a valid keywordId", () => {
    for (const talent of talentPool) {
      expect(validKeywords, `Talent "${talent.id}" has invalid keyword "${talent.keywordId}"`).toContain(talent.keywordId);
    }
  });

  it("each talent has a non-empty description", () => {
    for (const talent of talentPool) {
      expect(talent.description, `Talent "${talent.id}" has empty description`).toBeTruthy();
    }
  });

  it("each talent has a name", () => {
    for (const talent of talentPool) {
      expect(talent.name, `Talent "${talent.id}" is missing a name`).toBeTruthy();
    }
  });

  it("each keyword has exactly 10 talents", () => {
    const counts: Record<string, number> = {};
    for (const talent of talentPool) {
      counts[talent.keywordId] = (counts[talent.keywordId] ?? 0) + 1;
    }
    for (const kw of validKeywords) {
      expect(counts[kw], `Keyword "${kw}" has ${counts[kw] ?? 0} talents, expected 10`).toBe(10);
    }
  });
});
