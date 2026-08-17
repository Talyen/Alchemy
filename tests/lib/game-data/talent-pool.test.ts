import { describe, expect, it } from "vitest";
import type { KeywordId } from "@/lib/game-data";
import {
  talentPool,
  getTalentsForKeyword,
  getAllocatableTalentChoices,
  getTalentRows,
  getTalentRowIndex,
  isTalentRowUnlocked,
  computeTalentEffects,
  canUnlockTalent,
  tryUnlockTalent,
  isTalentPlaceholder,
  keywordDefinitions,
  getTalentTreeKeywordIds,
} from "@/lib/game-data";

const validKeywords = Object.keys(keywordDefinitions);

describe("talentPool data integrity", () => {
  it("all talent IDs are unique", () => {
    const ids = talentPool.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each talent has a valid keywordId", () => {
    for (const talent of talentPool) {
      expect(validKeywords, `Talent "${talent.id}" has invalid keyword "${talent.keywordId}"`).toContain(
        talent.keywordId,
      );
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

  it("each talent keyword has exactly 10 talents", () => {
    const counts: Record<string, number> = {};
    for (const talent of talentPool) {
      counts[talent.keywordId] = (counts[talent.keywordId] ?? 0) + 1;
    }
    const talentKeywords = [...new Set(talentPool.map((talent) => talent.keywordId))];
    for (const kw of talentKeywords) {
      expect(counts[kw], `Keyword "${kw}" has ${counts[kw] ?? 0} talents, expected 10`).toBe(10);
    }
  });

  it("contains talents for all talent-tree keywords", () => {
    for (const kw of getTalentTreeKeywordIds()) {
      expect(getTalentsForKeyword(kw).length).toBeGreaterThan(0);
    }
  });
});

describe("getTalentsForKeyword", () => {
  it("returns only talents matching the keyword", () => {
    const phys = getTalentsForKeyword("physical");
    expect(phys.every((t) => t.keywordId === "physical")).toBe(true);
  });

  it("returns empty array for unknown keyword", () => {
    expect(getTalentsForKeyword("unknown" as unknown as KeywordId)).toEqual([]);
  });
});

describe("talent row layout", () => {
  it("splits a full keyword into rows of 1, 2, 3, 4 in pool order", () => {
    const rows = getTalentRows("physical");
    expect(rows.map((row) => row.length)).toEqual([1, 2, 3, 4]);
    expect(rows.flat().map((t) => t.id)).toEqual(getTalentsForKeyword("physical").map((t) => t.id));
  });

  it("fills authored keywords to the full grid without placeholders", () => {
    const rows = getTalentRows("archery");
    expect(rows.map((row) => row.length)).toEqual([1, 2, 3, 4]);
    expect(rows.flat().filter((t) => isTalentPlaceholder(t))).toHaveLength(0);
  });

  it("reports the row for a grid position", () => {
    expect(getTalentRowIndex(0)).toBe(0);
    expect(getTalentRowIndex(1)).toBe(1);
    expect(getTalentRowIndex(2)).toBe(1);
    expect(getTalentRowIndex(3)).toBe(2);
    expect(getTalentRowIndex(5)).toBe(2);
    expect(getTalentRowIndex(6)).toBe(3);
    expect(getTalentRowIndex(9)).toBe(3);
  });

  it("row 0 is always unlocked", () => {
    expect(isTalentRowUnlocked("physical", [], 0)).toBe(true);
  });

  it("a row is unlocked only when every real talent above it is unlocked", () => {
    const phys = getTalentsForKeyword("physical");
    expect(isTalentRowUnlocked("physical", [], 1)).toBe(false);
    expect(isTalentRowUnlocked("physical", [phys[0]!.id], 1)).toBe(true);
    expect(isTalentRowUnlocked("physical", [phys[0]!.id], 2)).toBe(false);
    expect(isTalentRowUnlocked("physical", [phys[0]!.id, phys[1]!.id, phys[2]!.id], 2)).toBe(true);
  });

  it("placeholder nodes never gate later rows", () => {
    const archery = getTalentsForKeyword("archery");
    const realIds = archery.filter((t) => !isTalentPlaceholder(t)).map((t) => t.id);
    expect(isTalentRowUnlocked("archery", realIds, 3)).toBe(true);
  });

  it("getAllocatableTalentChoices returns only real talents on unlocked rows", () => {
    const phys = getTalentsForKeyword("physical");
    expect(getAllocatableTalentChoices("physical", []).map((t) => t.id)).toEqual([phys[0]!.id]);
    const ids = [phys[0]!.id];
    expect(getAllocatableTalentChoices("physical", ids).map((t) => t.id)).toEqual([1, 2].map((i) => phys[i]!.id));
  });

  it("getAllocatableTalentChoices never returns placeholders", () => {
    expect(getAllocatableTalentChoices("consume", [])).toHaveLength(1);
    expect(getAllocatableTalentChoices("consume", []).every((t) => !isTalentPlaceholder(t))).toBe(true);
  });

  it("includes partial keywords in the talent tree", () => {
    expect(getTalentTreeKeywordIds()).toContain("nature");
    expect(getTalentTreeKeywordIds()).toContain("archery");
    expect(getTalentTreeKeywordIds()).toContain("companion");
    expect(getTalentTreeKeywordIds()).toContain("consume");
  });
});

describe("canUnlockTalent", () => {
  it("rejects unknown talent ids", () => {
    expect(canUnlockTalent("burn", "unknown-talent", { burn: 100 }, {}).ok).toBe(false);
  });

  it("rejects keyword mismatch", () => {
    expect(canUnlockTalent("burn", "physical-brute-force", { physical: 100 }, {}).ok).toBe(false);
  });

  it("rejects unlock without unspent points", () => {
    expect(canUnlockTalent("physical", "physical-brute-force", {}, {}).ok).toBe(false);
  });

  it("allows a real talent on an unlocked row when points are available", () => {
    const phys = getTalentsForKeyword("physical");
    const result = canUnlockTalent("physical", phys[0]!.id, { physical: 10 }, {});
    expect(result.ok).toBe(true);
  });

  it("allows any real talent on an unlocked row, not just the next in order", () => {
    const phys = getTalentsForKeyword("physical");
    const unlocked = { physical: [phys[0]!.id, phys[1]!.id] };
    const result = canUnlockTalent("physical", phys[2]!.id, { physical: 100 }, unlocked);
    expect(result.ok).toBe(true);
  });

  it("rejects talents on rows that are not unlocked yet", () => {
    const phys = getTalentsForKeyword("physical");
    const result = canUnlockTalent("physical", phys[4]!.id, { physical: 100 }, {});
    expect(result).toEqual({ ok: false, reason: "not-eligible-choice" });
  });
});

describe("tryUnlockTalent", () => {
  it("appends only when validation passes", () => {
    const phys = getTalentsForKeyword("physical");
    const applied = tryUnlockTalent("physical", phys[0]!.id, { physical: 10 }, {});
    expect(applied.unlockedTalents?.physical).toEqual([phys[0]!.id]);
  });
});

describe("computeTalentEffects", () => {
  it("returns empty effects with no unlocked talents", () => {
    const effects = computeTalentEffects({});
    expect(effects.flatPhysicalDamage).toBe(0);
    expect(effects.armorToPhysicalDamage).toBe(false);
  });

  it("ignores talent ids saved under the wrong keyword", () => {
    const effects = computeTalentEffects({ burn: ["physical-brute-force"] });
    expect(effects.flatPhysicalDamage).toBe(0);
  });

  it("stacks cross-keyword numeric clones and concatenates armor thresholds", () => {
    const effects = computeTalentEffects({
      physical: ["physical-shield-bash"],
      block: ["block-to-physical"],
      nature: ["nature-verdant-cycle"],
      leech: ["leech-nature-chance"],
      gold: ["gold-on-wish"],
      wish: ["wish-gold"],
      health: ["health-threshold-armor"],
      armor: ["armor-mitigate-stun"],
    });

    expect(effects.blockToPhysicalDamageMultiplier).toBeCloseTo(0.6);
    expect(effects.natureLeechChance).toBe(20);
    expect(effects.goldOnWish).toBe(5);
    expect(effects.healthThresholdArmor).toHaveLength(2);
    expect(effects.healthThresholdArmor).toEqual(
      expect.arrayContaining([
        { threshold: 50, amount: 5 },
        { threshold: 25, amount: 3 },
      ]),
    );
  });
});
