import { describe, expect, it } from "vitest";
import { getTalentsForKeyword, sampleTalentChoices, computeTalentEffects, talentPool } from "@/features/alchemy/talent-pool";

describe("talentPool", () => {
  it("contains talents for all keywords", () => {
    const keywords = ["physical", "stun", "block", "forge", "armor", "health", "burn", "gold", "holy", "wish", "ailment", "consume", "poison", "bleed", "leech", "freeze", "mana"];
    for (const kw of keywords) {
      expect(getTalentsForKeyword(kw as any).length).toBeGreaterThan(0);
    }
  });
});

describe("getTalentsForKeyword", () => {
  it("returns only talents matching the keyword", () => {
    const phys = getTalentsForKeyword("physical");
    expect(phys.every((t) => t.keywordId === "physical")).toBe(true);
  });

  it("returns empty array for unknown keyword", () => {
    expect(getTalentsForKeyword("unknown" as any)).toEqual([]);
  });
});

describe("sampleTalentChoices", () => {
  it("excludes already unlocked talents", () => {
    const unlocked = ["physical-dmg-1", "physical-dmg-2"];
    const available = sampleTalentChoices("physical", unlocked, 10);
    expect(available.every((t) => !unlocked.includes(t.id))).toBe(true);
  });

  it("returns the requested number of choices", () => {
    const choices = sampleTalentChoices("physical", [], 3);
    expect(choices).toHaveLength(3);
  });

  it("does not include already unlocked talents", () => {
    const allPhys = getTalentsForKeyword("physical");
    const allIds = allPhys.map((t) => t.id);
    const choices = sampleTalentChoices("physical", allIds, 3);
    expect(choices).toHaveLength(0);
  });

  it("returns fewer choices if not enough available", () => {
    const allPhys = getTalentsForKeyword("physical");
    const unlocked = allPhys.slice(0, -1).map((t) => t.id);
    const choices = sampleTalentChoices("physical", unlocked, 10);
    expect(choices.length).toBeLessThanOrEqual(1);
  });
});

describe("computeTalentEffects", () => {
  it("returns empty effects with no unlocked talents", () => {
    const effects = computeTalentEffects({});
    expect(effects).toEqual({ flatPhysicalDamage: 0, armorToPhysicalDamage: false, physicalCritChance: 0 });
  });

  it("counts flat physical damage talents", () => {
    const effects = computeTalentEffects({ physical: ["physical-dmg-1", "physical-dmg-3"] });
    expect(effects.flatPhysicalDamage).toBe(2);
  });

  it("detects armor synergy talent", () => {
    const withArmor = computeTalentEffects({ physical: ["physical-armor"] });
    expect(withArmor.armorToPhysicalDamage).toBe(true);

    const without = computeTalentEffects({ physical: ["physical-dmg-1"] });
    expect(without.armorToPhysicalDamage).toBe(false);
  });

  it("detects crit talent", () => {
    const withCrit = computeTalentEffects({ physical: ["physical-crit"] });
    expect(withCrit.physicalCritChance).toBe(5);

    const without = computeTalentEffects({ physical: [] });
    expect(without.physicalCritChance).toBe(0);
  });
});
