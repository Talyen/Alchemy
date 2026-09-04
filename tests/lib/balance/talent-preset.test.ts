import { describe, expect, it } from "vitest";
import {
  buildPresetUnlockedTalents,
  countAffinityCombatTalents,
  countUnlockedCombatTalents,
  talentsInTreeOrder,
  LATE_AFFINITY_TALENT_CAP,
} from "@/lib/balance/talent-preset";

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

  it("counts affinity combat talents only for typical HP", () => {
    expect(countAffinityCombatTalents(["poison", "bleed", "gold"], "mid")).toBe(15);
    expect(countAffinityCombatTalents([], "mid")).toBe(15);
    expect(countAffinityCombatTalents([], "late")).toBe(21);
  });
});
