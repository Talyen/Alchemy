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
} from "@/lib/game-data";
import { getTalentTreeKeywordIds } from "@/lib/game-data";

const validKeywords: string[] = [
  "physical",
  "stun",
  "block",
  "forge",
  "armor",
  "health",
  "burn",
  "gold",
  "holy",
  "wish",
  "poison",
  "bleed",
  "leech",
  "freeze",
  "mana",
  "nature",
  "companion",
  "archery",
  "consume",
];

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

  it("each keyword has exactly 10 talents", () => {
    const counts: Record<string, number> = {};
    for (const talent of talentPool) {
      counts[talent.keywordId] = (counts[talent.keywordId] ?? 0) + 1;
    }
    for (const kw of validKeywords) {
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

  it("pads partial keywords to the full grid with placeholders", () => {
    const rows = getTalentRows("archery");
    expect(rows.map((row) => row.length)).toEqual([1, 2, 3, 4]);
    expect(rows[3]).toHaveLength(4);
    expect(rows.flat().filter((t) => isTalentPlaceholder(t))).toHaveLength(5);
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

  it("rejects placeholder talents", () => {
    expect(canUnlockTalent("nature", "nature-placeholder-1", { nature: 100 }, {}).ok).toBe(false);
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
    expect(effects.physicalCritChance).toBe(0);
  });

  it("counts flat physical damage talents", () => {
    const effects = computeTalentEffects({ physical: ["physical-brute-force"] });
    expect(effects.flatPhysicalDamage).toBe(1);
  });

  it("ignores talent ids saved under the wrong keyword", () => {
    const effects = computeTalentEffects({ burn: ["physical-brute-force"] });
    expect(effects.flatPhysicalDamage).toBe(0);
  });

  it("applies block-to-physical via multiplier field", () => {
    const effects = computeTalentEffects({ block: ["block-to-physical"] });
    expect(effects.blockToPhysicalDamageMultiplier).toBe(0.3);
  });

  it("applies expert blacksmith forge multiplier", () => {
    const effects = computeTalentEffects({ physical: ["physical-expert-blacksmith"] });
    expect(effects.forgeToPhysicalDamageMultiplier).toBe(1.5);
  });

  it("applies implemented effects across multiple keywords", () => {
    const effects = computeTalentEffects({
      block: ["block-start", "block-prevent-poison"],
      gold: ["gold-start", "gold-enemy-drop"],
      holy: ["holy-lifesteal", "holy-block-grant"],
      bleed: ["bleed-execute", "bleed-desperate"],
    });

    expect(effects.startBlock).toBe(5);
    expect(effects.blockPreventsPoison).toBe(true);
    expect(effects.startGold).toBe(20);
    expect(effects.enemyGoldDropBonus).toBe(0.1);
    expect(effects.holyLifestealPercent).toBe(10);
    expect(effects.holyBlockPercentFromDamage).toBe(15);
    expect(effects.bleedExecuteThreshold).toBe(30);
    expect(effects.bleedDesperateMultiplier).toBe(2);
  });

  it("ignores unknown talent IDs", () => {
    const effects = computeTalentEffects({ physical: ["unknown-talent"] });
    expect(effects.flatPhysicalDamage).toBe(0);
  });
});
