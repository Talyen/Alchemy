// Unit tests for Wildwood boss definitions — data integrity and accessor.
import { describe, expect, it } from "vitest";
import { WILDWOOD_BOSSES, getWildwoodBoss } from "@/lib/content-systems/wildwood/bosses";
import { enemyBestiary } from "@/lib/game-data";

describe("WILDWOOD_BOSSES", () => {
  it("contains exactly 4 entries", () => {
    expect(WILDWOOD_BOSSES).toHaveLength(4);
  });

  it("each bossId exists in enemyBestiary", () => {
    for (const entry of WILDWOOD_BOSSES) {
      const enemy = enemyBestiary.find((e) => e.id === entry.bossId);
      expect(enemy).toBeDefined();
      expect(enemy!.title).toBe(entry.title);
    }
  });

  it("each entry has non-empty title, subtitle, and descriptionLines", () => {
    for (const entry of WILDWOOD_BOSSES) {
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.subtitle.length).toBeGreaterThan(0);
      expect(entry.descriptionLines.length).toBeGreaterThan(0);
    }
  });
});

describe("getWildwoodBoss", () => {
  it("returns the correct boss by ID", () => {
    const boss = getWildwoodBoss("iron-bear");
    expect(boss).toBeDefined();
    expect(boss!.title).toBe("The Iron Bear");
  });

  it("returns undefined for unknown boss ID", () => {
    expect(getWildwoodBoss("nonexistent")).toBeUndefined();
  });
});
