import { describe, expect, it } from "vitest";
import {
  bossEnemies,
  encounterEnemies,
  enemiesByType,
  enemyBestiary,
  enemyById,
  isEnemyId,
  isTrinketId,
  trinketById,
  trinketLibrary,
  type EnemyAttackEffect,
} from "@/lib/game-data";
import { defineEnemy, trinket } from "@/lib/game-data/compendium-builders";
import {
  combineTrinketEffectIds,
  computeTrinketManifest,
  defaultTrinketEffects,
  isDefaultTrinketManifest,
} from "@/lib/trinkets";

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

describe("Compendium indexed maps and guards", () => {
  it("indexes all enemies in enemyById matching enemyBestiary", () => {
    expect(Object.keys(enemyById)).toHaveLength(enemyBestiary.length);
    for (const enemy of enemyBestiary) {
      expect(enemyById[enemy.id]).toBe(enemy);
    }
  });

  it("indexes all trinkets in trinketById matching trinketLibrary", () => {
    expect(Object.keys(trinketById)).toHaveLength(trinketLibrary.length);
    for (const item of trinketLibrary) {
      expect(trinketById[item.id]).toBe(item);
    }
  });

  it("identifies valid and invalid enemy IDs via isEnemyId", () => {
    expect(isEnemyId("forge-golem")).toBe(true);
    expect(isEnemyId("frostwarden")).toBe(true);
    expect(isEnemyId("skeleton")).toBe(true);
    expect(isEnemyId("non-existent-enemy")).toBe(false);
    expect(isEnemyId("")).toBe(false);
  });

  it("identifies valid and invalid trinket IDs via isTrinketId", () => {
    expect(isTrinketId("brass-censer")).toBe(true);
    expect(isTrinketId("bone-charm")).toBe(true);
    expect(isTrinketId("non-existent-trinket")).toBe(false);
    expect(isTrinketId("")).toBe(false);
  });
});

describe("Compendium pool partitioning", () => {
  it("partitions enemiesByType accurately without omissions or duplicates", () => {
    const normal = enemiesByType.normal;
    const elite = enemiesByType.elite;
    const boss = enemiesByType.boss;

    expect(normal.length + elite.length + boss.length).toBe(enemyBestiary.length);
    expect(boss).toEqual(bossEnemies);
    expect(normal.every((e) => e.enemyType === "normal")).toBe(true);
    expect(elite.every((e) => e.enemyType === "elite")).toBe(true);
    expect(boss.every((e) => e.enemyType === "boss")).toBe(true);
  });

  it("excludes the tutorial skeleton from encounterEnemies pool", () => {
    expect(encounterEnemies.some((e) => (e.id as string) === "skeleton")).toBe(false);
    expect(encounterEnemies.length).toBe(enemyBestiary.length - 1);
  });
});

describe("Compendium builders", () => {
  it("defineEnemy fills default subtitle and empty descriptionLines", () => {
    const enemy = defineEnemy({
      id: "test-boss",
      title: "Test Boss",
      art: "",
      enemyType: "boss",
      traits: [],
      attackEffects: [],
    });
    expect(enemy.subtitle).toBe("Boss");
    expect(enemy.descriptionLines).toEqual([]);
  });

  it("trinket builder wraps single description into descriptionLines", () => {
    const entry = trinket("test-trinket", "Test Trinket", "A test description", "art-ref", {
      extraDrawPerBattle: 2,
    });
    expect(entry.id).toBe("test-trinket");
    expect(entry.title).toBe("Test Trinket");
    expect(entry.descriptionLines).toEqual(["A test description"]);
    expect(entry.effects.extraDrawPerBattle).toBe(2);
  });
});

describe("Trinket manifest engine", () => {
  it("computes manifest with fast-path for empty trinket lists", () => {
    const emptyManifest = computeTrinketManifest([]);
    expect(emptyManifest).toEqual(defaultTrinketEffects);
    expect(isDefaultTrinketManifest(emptyManifest)).toBe(true);
  });

  it("merges active trinket effects correctly", () => {
    const manifest = computeTrinketManifest(["brass-censer", "tattered-pages"]);
    expect(manifest.firstHolyDamageDoubled).toBe(true);
    expect(manifest.extraDrawPerBattle).toBe(1);
    expect(isDefaultTrinketManifest(manifest)).toBe(false);
  });

  it("combines boons and equipped trinket without duplicates", () => {
    expect(combineTrinketEffectIds(["bone-charm"], "brass-censer")).toEqual(["bone-charm", "brass-censer"]);
    expect(combineTrinketEffectIds(["bone-charm", "brass-censer"], "brass-censer")).toEqual([
      "bone-charm",
      "brass-censer",
    ]);
    expect(combineTrinketEffectIds(["bone-charm"], null)).toEqual(["bone-charm"]);
  });
});
