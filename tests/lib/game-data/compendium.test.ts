import { describe, expect, it } from "vitest";
import { enemyBestiary, type EnemyAttackEffect } from "@/lib/game-data";

describe("Iron Bear", () => {
  const ironBear = enemyBestiary.find((e) => e.id === "iron-bear")!;

  it("has the correct title", () => {
    expect(ironBear.title).toBe("The Iron Bear");
  });

  it("has enemyType boss", () => {
    expect(ironBear.enemyType).toBe("boss");
  });

  it("has exactly 1 trait", () => {
    expect(ironBear.traits).toHaveLength(1);
  });

  it("has Iron Hide trait", () => {
    const trait = ironBear.traits.find((t) => t.id === "iron-hide");
    expect(trait).toBeDefined();
    expect(trait!.description).toContain("Armor");
  });

  it("has attack dealing 3 physical and 1 burn damage", () => {
    expect(ironBear.attackEffects).toHaveLength(2);
    const phys = ironBear.attackEffects[0] as EnemyAttackEffect & { kind: "damage" };
    expect(phys.kind).toBe("damage");
    expect(phys.damageType).toBe("physical");
    expect(phys.amount).toBe(3);
    const burn = ironBear.attackEffects[1] as EnemyAttackEffect & { kind: "damage" };
    expect(burn.kind).toBe("damage");
    expect(burn.damageType).toBe("burn");
    expect(burn.amount).toBe(1);
  });
});

describe("Compendium indexed maps", () => {
  it("indexes all enemies in enemyById matching enemyBestiary", async () => {
    const { enemyById, enemyBestiary } = await import("@/lib/game-data");
    expect(Object.keys(enemyById)).toHaveLength(enemyBestiary.length);
    for (const enemy of enemyBestiary) {
      expect(enemyById[enemy.id]).toBe(enemy);
    }
  });

  it("indexes all trinkets in trinketById matching trinketLibrary", async () => {
    const { trinketById, trinketLibrary } = await import("@/lib/game-data");
    expect(Object.keys(trinketById)).toHaveLength(trinketLibrary.length);
    for (const trinket of trinketLibrary) {
      expect(trinketById[trinket.id]).toBe(trinket);
    }
  });
});
