import { describe, expect, it } from "vitest";
import {
  buildPresetUnlockedTalents,
  countUnlockedCombatTalents,
  isCombatTalent,
  talentsInTreeOrder,
  LATE_AFFINITY_TALENT_CAP,
  META_ONLY_TALENT_FIELDS,
} from "@/lib/balance/talent-preset";
import { talentPool } from "@/lib/game-data";

describe("isCombatTalent", () => {
  it("excludes gold shop-discount talents", () => {
    const haggle = talentPool.find((talent) => talent.id === "gold-shop-discount");
    expect(haggle).toBeDefined();
    expect(isCombatTalent(haggle!)).toBe(false);
  });

  it("includes holy gold-scaling (Prosperity)", () => {
    const prosperity = talentPool.find((talent) => talent.id === "holy-gold-scaling");
    expect(prosperity).toBeDefined();
    expect(isCombatTalent(prosperity!)).toBe(true);
  });

  it("treats startGold as combat-eligible so Seed Money can feed battle gold", () => {
    const seedMoney = talentPool.find((talent) => talent.id === "gold-start");
    expect(seedMoney).toBeDefined();
    expect(isCombatTalent(seedMoney!)).toBe(true);
    expect(META_ONLY_TALENT_FIELDS.has("startGold")).toBe(false);
  });
});

describe("buildPresetUnlockedTalents", () => {
  it("uses an empty unlock set for early", () => {
    expect(buildPresetUnlockedTalents(["gold"], "early")).toEqual({});
  });

  it("picks talents in tree order for mid rogue affinity", () => {
    const unlocked = buildPresetUnlockedTalents(["poison", "bleed", "gold"], "mid");
    const goldIds = unlocked.gold ?? [];
    const expectedGold = talentsInTreeOrder("gold")
      .slice(0, 5)
      .map((talent) => talent.id);
    expect(goldIds).toEqual(expectedGold);
    expect(goldIds).toContain("gold-shop-discount");
  });

  it("caps late affinity combat talents", () => {
    const unlocked = buildPresetUnlockedTalents(["holy"], "late");
    expect((unlocked.holy ?? []).length).toBeLessThanOrEqual(LATE_AFFINITY_TALENT_CAP);
    expect(unlocked.holy).toContain("holy-gold-scaling");
  });

  it("counts every unlocked combat talent as a spent point", () => {
    expect(countUnlockedCombatTalents(["poison", "bleed", "gold"], "early")).toBe(0);
    expect(countUnlockedCombatTalents(["poison", "bleed", "gold"], "mid")).toBeGreaterThan(5);
  });
});
