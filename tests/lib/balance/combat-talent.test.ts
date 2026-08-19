import { describe, expect, it } from "vitest";
import { isCombatTalent, META_ONLY_TALENT_FIELDS } from "@/lib/balance/combat-talent";
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
