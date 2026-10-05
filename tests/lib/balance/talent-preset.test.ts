import { describe, expect, it } from "vitest";
import {
  buildPresetUnlockedTalents,
  buildPresetManifest,
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
});

it.each(["early", "late"] as const)("keeps %s simulation manifests isolated from earlier callers", (preset) => {
  const first = buildPresetManifest(["health"], preset);
  const expected = structuredClone(first);
  first.flatPhysicalDamage = 999;
  first.companionBondLevels.wolf = 999;
  first.cardHealBonus.apple = 999;
  first.cardHealMultipliers.apple = 999;
  if (preset === "late") {
    expect(first.healthThresholdBlockOnce).toEqual({ threshold: 50, amount: 6 });
    first.healthThresholdBlockOnce!.amount = 999;
  }
  first.healthThresholdArmor.push({ threshold: 0.5, amount: 999 });
  expect(buildPresetManifest(["health"], preset)).toEqual(expected);
});
