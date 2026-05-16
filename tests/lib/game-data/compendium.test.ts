// Unit tests for compendium data — specifically the Iron Bear boss entry.
import { describe, expect, it } from "vitest";
import { enemyBestiary } from "@/lib/game-data";

describe("Iron Bear", () => {
  const ironBear = enemyBestiary.find((e) => e.id === "iron-bear");

  it("exists in enemyBestiary", () => {
    expect(ironBear).toBeDefined();
  });

  it("has the correct title", () => {
    expect(ironBear!.title).toBe("The Iron Bear");
  });

  it("has enemyType boss", () => {
    expect(ironBear!.enemyType).toBe("boss");
  });

  it("has exactly 3 traits", () => {
    expect(ironBear!.traits).toHaveLength(3);
  });

  it("has Forge Regeneration trait", () => {
    const trait = ironBear!.traits.find((t) => t.id === "forge-regeneration");
    expect(trait).toBeDefined();
    expect(trait!.description).toContain("Gains 2 Forge");
  });

  it("has Iron Hide trait", () => {
    const trait = ironBear!.traits.find((t) => t.id === "iron-hide");
    expect(trait).toBeDefined();
    expect(trait!.description).toContain("Gains 2 Armor");
  });

  it("has Thick Hide trait (half physical)", () => {
    const trait = ironBear!.traits.find((t) => t.id === "thick-hide");
    expect(trait).toBeDefined();
    expect(trait!.description).toContain("half Physical");
  });

  it("has attack dealing 10 physical damage", () => {
    expect(ironBear!.attackEffects).toHaveLength(1);
    const attack = ironBear!.attackEffects[0];
    expect(attack.kind).toBe("damage");
    expect(attack.damageType).toBe("physical");
    expect(attack.amount).toBe(10);
  });
});
