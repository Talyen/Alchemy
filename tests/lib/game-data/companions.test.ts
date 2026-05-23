import { describe, expect, it } from "vitest";
import { companionLibrary } from "@/lib/game-data/companions";
import type { CompanionDefinition } from "@/lib/game-data/types";

describe("companionLibrary data integrity", () => {
  it("has all expected companions", () => {
    const expectedIds = ["wolf", "lizard-scout", "imp", "frost-whelp", "bear", "panther", "phoenix"];
    for (const id of expectedIds) {
      expect(companionLibrary[id]).toBeDefined();
    }
  });

  it("each companion has non-empty title and art", () => {
    for (const companion of Object.values(companionLibrary)) {
      expect(companion.title).toBeTruthy();
      expect(companion.art).toBeTruthy();
    }
  });

  it("each companion has at least one turnStartEffect", () => {
    for (const companion of Object.values(companionLibrary)) {
      expect(companion.turnStartEffects.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("each turnStartEffect is a damage kind with a valid damageType", () => {
    const validTypes = ["physical", "stun", "holy", "burn", "poison", "bleed", "freeze", "nature"];
    for (const companion of Object.values(companionLibrary)) {
      for (const effect of companion.turnStartEffects) {
        expect(effect.kind).toBe("damage");
        expect(validTypes).toContain(effect.damageType);
        expect(effect.amount).toBeGreaterThan(0);
      }
    }
  });

  it("all companion IDs are unique", () => {
    const ids = Object.keys(companionLibrary);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("Phoenix has the highest base damage", () => {
    const phoenix = companionLibrary.phoenix;
    const allMaxDamages = Object.values(companionLibrary).map(
      (c) => c.turnStartEffects.reduce((sum, e) => sum + e.amount, 0),
    );
    const phoenixDamage = phoenix.turnStartEffects.reduce((sum, e) => sum + e.amount, 0);
    expect(phoenixDamage).toBe(Math.max(...allMaxDamages));
  });
});
