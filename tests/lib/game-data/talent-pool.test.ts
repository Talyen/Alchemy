import { describe, expect, it } from "vitest";
import type { KeywordId } from "@/lib/game-data";
import {
  talentPool,
  getTalentsForKeyword,
  getNextTalentChoices,
  computeTalentEffects,
  canUnlockTalent,
  tryUnlockTalent,
  isTalentPlaceholder,
  countImplementedTalents,
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

describe("getNextTalentChoices", () => {
  it("excludes already unlocked talents", () => {
    const allPhys = getTalentsForKeyword("physical");
    const unlocked = allPhys.slice(0, 2).map((t) => t.id);
    const available = getNextTalentChoices("physical", unlocked, 10);
    expect(available.every((t) => !unlocked.includes(t.id))).toBe(true);
  });

  it("excludes placeholder talents", () => {
    const choices = getNextTalentChoices("nature", [], 10);
    expect(choices).toHaveLength(0);
    expect(getTalentsForKeyword("nature").every(isTalentPlaceholder)).toBe(true);
  });

  it("excludes placeholder-only keywords from the talent tree", () => {
    expect(countImplementedTalents("nature")).toBe(0);
    expect(getTalentTreeKeywordIds()).not.toContain("nature");
  });

  it("returns the requested number of choices", () => {
    const choices = getNextTalentChoices("physical", [], 3);
    expect(choices).toHaveLength(3);
  });

  it("returns fewer choices if not enough available", () => {
    const implemented = getTalentsForKeyword("archery").filter((t) => !isTalentPlaceholder(t));
    const unlocked = implemented.slice(0, -1).map((t) => t.id);
    const choices = getNextTalentChoices("archery", unlocked, 10);
    expect(choices).toHaveLength(1);
    expect(countImplementedTalents("archery")).toBe(1);
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

  it("allows the next implemented choice when points are available", () => {
    const next = getNextTalentChoices("physical", [], 1)[0]!;
    const result = canUnlockTalent("physical", next.id, { physical: 10 }, {});
    expect(result.ok).toBe(true);
  });
});

describe("tryUnlockTalent", () => {
  it("appends only when validation passes", () => {
    const next = getNextTalentChoices("physical", [], 1)[0]!;
    const applied = tryUnlockTalent("physical", next.id, { physical: 10 }, {});
    expect(applied.unlockedTalents?.physical).toEqual([next.id]);
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
