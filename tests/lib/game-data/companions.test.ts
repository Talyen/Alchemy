import { describe, expect, it } from "vitest";
import { companionLibrary, type CompanionId } from "@/lib/game-data";

describe("companionLibrary data integrity", () => {
  it("has all expected companions", () => {
    const expectedIds = [
      "wolf",
      "lizard-scout",
      "imp",
      "frost-whelp",
      "bear",
      "panther",
      "phoenix",
      "skeleton",
      "pixie",
      "mana-moth",
      "will-o-wisp",
      "golden-retriever",
      "shield-scarab",
      "library-owl",
    ];
    for (const id of expectedIds) {
      expect(companionLibrary[id as CompanionId]).toBeDefined();
    }
  });

  it("each companion has non-empty title and art", () => {
    for (const companion of Object.values(companionLibrary)) {
      expect(companion.title).toBeTruthy();
      expect(companion.art).toBeTruthy();
    }
  });

  it("each companion has exactly one turnStartEffect (summon cards assume a single line)", () => {
    for (const companion of Object.values(companionLibrary)) {
      expect(companion.turnStartEffects).toHaveLength(1);
    }
  });

  it("each turnStartEffect uses a supported companion effect kind", () => {
    const validDamageTypes = ["physical", "stun", "holy", "burn", "poison", "bleed", "freeze", "nature"];
    for (const companion of Object.values(companionLibrary)) {
      for (const effect of companion.turnStartEffects) {
        switch (effect.kind) {
          case "damage":
            expect(validDamageTypes).toContain(effect.damageType);
            expect(effect.amount).toBeGreaterThan(0);
            break;
          case "heal":
          case "restore-mana":
          case "remove-harmful-status":
          case "gain-gold":
          case "draw-cards":
            expect(effect.amount).toBeGreaterThan(0);
            break;
          case "player-status":
            expect(effect.status).toBe("block");
            expect(effect.amount).toBeGreaterThan(0);
            break;
          default:
            throw new Error(`Unsupported companion effect: ${(effect as { kind: string }).kind}`);
        }
      }
    }
  });

  it("all companion IDs are unique", () => {
    const ids = Object.keys(companionLibrary);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("Phoenix ties for highest damage among damage-dealing companions", () => {
    const phoenix = companionLibrary.phoenix;
    const damageTotals = Object.values(companionLibrary)
      .filter((c) => c.turnStartEffects[0]?.kind === "damage")
      .map((c) => c.turnStartEffects.reduce((sum, e) => sum + (e.kind === "damage" ? e.amount : 0), 0));
    const phoenixDamage = phoenix.turnStartEffects.reduce((sum, e) => sum + (e.kind === "damage" ? e.amount : 0), 0);
    expect(phoenixDamage).toBe(Math.max(...damageTotals));
  });
});
