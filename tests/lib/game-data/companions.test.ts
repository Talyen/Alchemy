import { describe, expect, it } from "vitest";
import {
  BattleCardEffectSchema,
  companionLibrary,
  getCompanionKeywords,
  getModifiedCompanionEffects,
  keywordDefinitions,
  type CompanionId,
} from "@/lib/game-data";
import { getCompanionShineColors } from "@/features/alchemy/shared/config";
import { getKeywordBorderShineColors } from "@/lib/keyword-border-shine";

describe("companionLibrary data integrity", () => {
  it("has all expected companions", () => {
    const expectedIds = [
      "wolf",
      "lizard-scout",
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
      "fox",
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

  it("each companion has at least one turn-start effect", () => {
    for (const companion of Object.values(companionLibrary)) {
      expect(companion.turnStartEffects.length).toBeGreaterThan(0);
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
          case "chance":
            expect(effect.probability).toBeGreaterThan(0);
            expect(effect.successEffects.length).toBeGreaterThan(0);
            expect(effect.failureEffects.length).toBeGreaterThan(0);
            break;
          default:
            throw new Error(`Unsupported companion effect: ${(effect as { kind: string }).kind}`);
        }
      }
    }
  });

  it("all companion baseline effects are distinct", () => {
    const signatures = Object.values(companionLibrary).map((companion) => JSON.stringify(companion.turnStartEffects));
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it("all companion IDs are unique", () => {
    const ids = Object.keys(companionLibrary);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("Panther has the highest baseline damage among damage-dealing companions", () => {
    const phoenix = companionLibrary.panther;
    const damageTotals = Object.values(companionLibrary)
      .filter((c) => c.turnStartEffects[0]?.kind === "damage")
      .map((c) => c.turnStartEffects.reduce((sum, e) => sum + (e.kind === "damage" ? e.amount : 0), 0));
    const phoenixDamage = phoenix.turnStartEffects.reduce((sum, e) => sum + (e.kind === "damage" ? e.amount : 0), 0);
    expect(phoenixDamage).toBe(Math.max(...damageTotals));
  });

  describe("companion keywords and shine colors", () => {
    it("derives bleed keyword for wolf and panther", () => {
      expect(getCompanionKeywords(companionLibrary.wolf)).toEqual(["bleed", "block"]);
      expect(getCompanionKeywords(companionLibrary.panther)).toEqual(["bleed"]);
      expect(getCompanionShineColors(companionLibrary.wolf)).toEqual(getKeywordBorderShineColors(["bleed", "block"]));
    });

    it("derives poison keyword for lizard-scout", () => {
      expect(getCompanionKeywords(companionLibrary["lizard-scout"])).toEqual(["poison"]);
      expect(getCompanionShineColors(companionLibrary["lizard-scout"])).toEqual(
        getKeywordBorderShineColors(["poison"]),
      );
    });

    it("derives freeze keyword for frost-whelp", () => {
      expect(getCompanionKeywords(companionLibrary["frost-whelp"])).toEqual(["freeze"]);
      expect(getCompanionShineColors(companionLibrary["frost-whelp"])).toEqual(getKeywordBorderShineColors(["freeze"]));
    });

    it("derives stun keyword for bear", () => {
      expect(getCompanionKeywords(companionLibrary.bear)).toEqual(["stun"]);
      expect(getCompanionShineColors(companionLibrary.bear)).toEqual(getKeywordBorderShineColors(["stun"]));
    });

    it("derives burn keyword for phoenix", () => {
      expect(getCompanionKeywords(companionLibrary.phoenix)).toEqual(["burn"]);
      expect(getCompanionShineColors(companionLibrary.phoenix)).toEqual(getKeywordBorderShineColors(["burn"]));
    });

    it("derives physical keyword for skeleton", () => {
      expect(getCompanionKeywords(companionLibrary.skeleton)).toEqual(["physical"]);
      expect(getCompanionShineColors(companionLibrary.skeleton)).toEqual(getKeywordBorderShineColors(["physical"]));
    });

    it("derives health keyword for pixie", () => {
      expect(getCompanionKeywords(companionLibrary.pixie)).toEqual(["health"]);
      expect(getCompanionShineColors(companionLibrary.pixie)).toEqual(getKeywordBorderShineColors(["health"]));
    });

    it("derives mana keyword for mana-moth", () => {
      expect(getCompanionKeywords(companionLibrary["mana-moth"])).toEqual(["mana"]);
      expect(getCompanionShineColors(companionLibrary["mana-moth"])).toEqual(getKeywordBorderShineColors(["mana"]));
    });

    it("derives gold keyword for golden-retriever", () => {
      expect(getCompanionKeywords(companionLibrary["golden-retriever"])).toEqual(["gold"]);
      expect(getCompanionShineColors(companionLibrary["golden-retriever"])).toEqual(
        getKeywordBorderShineColors(["gold"]),
      );
    });

    it("derives block keyword for shield-scarab", () => {
      expect(getCompanionKeywords(companionLibrary["shield-scarab"])).toEqual(["block"]);
      expect(getCompanionShineColors(companionLibrary["shield-scarab"])).toEqual(
        getKeywordBorderShineColors(["block"]),
      );
    });

    it("derives bleed and gold keywords for fox", () => {
      expect(getCompanionKeywords(companionLibrary.fox)).toEqual(["bleed", "gold"]);
      expect(getCompanionShineColors(companionLibrary.fox)).toEqual(getKeywordBorderShineColors(["bleed", "gold"]));
    });

    it("falls back to companion keyword palette for non-keyword utility companions", () => {
      expect(getCompanionKeywords(companionLibrary["will-o-wisp"])).toEqual([]);
      expect(getCompanionShineColors(companionLibrary["will-o-wisp"])).toEqual(
        keywordDefinitions.companion.shineColors,
      );

      expect(getCompanionKeywords(companionLibrary["library-owl"])).toEqual([]);
      expect(getCompanionShineColors(companionLibrary["library-owl"])).toEqual(
        keywordDefinitions.companion.shineColors,
      );
    });
  });

  describe("bonded bonus-trigger chance", () => {
    const noModifiers = { damageBonus: 0, bleedDamageBonus: 0, damageMultiplier: 1 };

    it.each(["mana-moth", "library-owl"] as const)(
      "bonded %s appends a bonus-trigger chance with an empty failure branch",
      (id) => {
        const effects = getModifiedCompanionEffects(companionLibrary[id], 2, noModifiers);
        expect(effects).toHaveLength(2);
        const bonus = effects[1];
        expect(bonus).toMatchObject({ kind: "chance", probability: 0.5, failureEffects: [] });
        expect(bonus?.kind === "chance" && bonus.successEffects).toEqual(companionLibrary[id].turnStartEffects);
      },
    );

    it("bonded bonus-trigger effects satisfy the effect schema", () => {
      for (const id of ["mana-moth", "library-owl"] as const) {
        for (const effect of getModifiedCompanionEffects(companionLibrary[id], 3, noModifiers)) {
          expect(BattleCardEffectSchema.safeParse(effect).success).toBe(true);
        }
      }
    });
  });
});
