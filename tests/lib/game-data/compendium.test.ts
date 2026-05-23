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

  it("has exactly 1 trait", () => {
    expect(ironBear!.traits).toHaveLength(1);
  });

  it("has Iron Hide trait", () => {
    const trait = ironBear!.traits.find((t) => t.id === "iron-hide");
    expect(trait).toBeDefined();
    expect(trait!.description).toContain("Armor");
  });

  it("has attack dealing 3 physical and 1 burn damage", () => {
    expect(ironBear!.attackEffects).toHaveLength(2);
    const phys = ironBear!.attackEffects[0];
    expect(phys.kind).toBe("damage");
    expect(phys.damageType).toBe("physical");
    expect(phys.amount).toBe(3);
    const burn = ironBear!.attackEffects[1];
    expect(burn.kind).toBe("damage");
    expect(burn.damageType).toBe("burn");
    expect(burn.amount).toBe(1);
  });
});
