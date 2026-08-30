import { describe, expect, it } from "vitest";
import {
  WILDWOOD_BOSS_IDS,
  sanitizeWildwoodBossId,
  sanitizeWildwoodBossIds,
} from "@/lib/content-systems/wildwood/bosses";
import { enemyById } from "@/lib/game-data";

describe("WILDWOOD_BOSS_IDS", () => {
  it("contains the explicit gauntlet allowlist and every entry is a boss", () => {
    expect(WILDWOOD_BOSS_IDS).toEqual([
      "forge-golem",
      "frostwarden",
      "blight-treant",
      "iron-bear",
      "blood-countess",
      "seraph",
      "stone-titan",
    ]);
    for (const bossId of WILDWOOD_BOSS_IDS) {
      expect(enemyById[bossId].enemyType).toBe("boss");
      expect(enemyById[bossId].traits.length).toBeGreaterThan(0);
      expect(enemyById[bossId].attackEffects.length).toBeGreaterThan(0);
    }
  });

  it("drops unknown boss ids without failing closed", () => {
    expect(sanitizeWildwoodBossIds(["forge-golem", "retired-boss", "iron-bear"])).toEqual(["forge-golem", "iron-bear"]);
    expect(sanitizeWildwoodBossId("retired-boss")).toBeNull();
    expect(sanitizeWildwoodBossId("frostwarden")).toBe("frostwarden");
  });
});
