import { describe, expect, it } from "vitest";
import type { BattleCard } from "@/lib/game-data";
import { TRAIT_REQUIRED_TERMS, validateCardDescriptionParity } from "@/lib/content-validation/card-parity";
import { validateEnemyTraitDescriptionParity } from "@/lib/content-validation/card-parity/enemy-trait-parity";
import { enemyBestiary } from "@/lib/game-data";
import { TRAIT_DAMAGE_RULES } from "@/lib/game-constants";

function makeCard(
  overrides: Partial<BattleCard> & Pick<BattleCard, "id" | "descriptionLines" | "effects">,
): BattleCard {
  return { title: overrides.id, art: "", cost: 1, ...overrides };
}

// Synthetic failure cases for card text↔effects parity. The full catalog is
// pinned clean by content-validation.test.ts; these cases pin the failure
// paths (counts, values, warning severities) that a clean catalog never hits.
describe("card parity failure paths", () => {
  it("rejects a heal line with no matching effect", () => {
    const issues = validateCardDescriptionParity(
      makeCard({ id: "heal-missing", descriptionLines: ["Restore 4 Health"], effects: [] }),
    );
    expect(issues.map((issue) => issue.message)).toContain("heal description count 1 does not match effect count 0");
  });

  it("rejects a block line with no matching effect", () => {
    const issues = validateCardDescriptionParity(
      makeCard({ id: "block-missing", descriptionLines: ["Gain 5 Block"], effects: [] }),
    );
    expect(issues.map((issue) => issue.message)).toContain("block description count 1 does not match effect count 0");
  });

  it("rejects a damage amount that does not match the authored value", () => {
    const issues = validateCardDescriptionParity(
      makeCard({
        id: "damage-mismatch",
        descriptionLines: ["Deal 5 physical damage"],
        effects: [{ kind: "damage", damageType: "physical", amount: 3 }],
      }),
    );
    expect(issues.map((issue) => issue.message)).toContain('"Deal 5 physical damage" does not match authored amount 3');
  });

  it("rejects a six-sided die line when the effect range is wrong", () => {
    const issues = validateCardDescriptionParity(
      makeCard({
        id: "die-mismatch",
        descriptionLines: ["Roll a six-sided die", "Draw that many cards"],
        effects: [{ kind: "random-draw", minAmount: 1, maxAmount: 4 }],
      }),
    );
    expect(issues.map((issue) => issue.message)).toContain('"Roll a six-sided die" does not match authored amount 4');
  });

  it("rejects Remove-all-armor text without a removeAll effect", () => {
    const issues = validateCardDescriptionParity(
      makeCard({
        id: "armor-mismatch",
        descriptionLines: ["Remove all enemy Armor"],
        effects: [{ kind: "remove-enemy-armor", amount: 2 }],
      }),
    );
    expect(issues.map((issue) => issue.message)).toContain('"Remove all enemy Armor" has no matching effect');
  });

  it("keeps lifesteal without a Leech line as a warning, not an error", () => {
    const issues = validateCardDescriptionParity(
      makeCard({
        id: "lifesteal-warning",
        descriptionLines: ["Deal 5 physical damage"],
        effects: [{ kind: "damage", damageType: "physical", amount: 5, lifesteal: true }],
      }),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      severity: "warning",
      area: "cards",
      id: "lifesteal-warning",
    });
  });

  it("keeps tag and consume mismatches as warnings", () => {
    const archery = validateCardDescriptionParity(
      makeCard({
        id: "archery-warning",
        descriptionLines: ["Deal 5 physical damage"],
        tags: ["archery"],
        effects: [{ kind: "damage", damageType: "physical", amount: 5 }],
      }),
    );
    expect(archery.map((issue) => issue.severity)).toEqual(["warning"]);

    const consume = validateCardDescriptionParity(
      makeCard({
        id: "consume-warning",
        descriptionLines: ["Draw 1"],
        consume: true,
        effects: [{ kind: "draw-cards", amount: 1 }],
      }),
    );
    expect(consume.map((issue) => issue.severity)).toEqual(["warning"]);

    const companion = validateCardDescriptionParity(
      makeCard({
        id: "companion-warning",
        descriptionLines: ["Deal 5 physical damage"],
        effects: [
          { kind: "damage", damageType: "physical", amount: 5 },
          { kind: "summon-companion", companionId: "wolf" },
        ],
      }),
    );
    expect(companion.map((issue) => issue.severity)).toEqual(["warning"]);
  });

  it("rejects a repeated damage line when the second hit has a different amount", () => {
    const issues = validateCardDescriptionParity(
      makeCard({
        id: "mismatched-repeat",
        descriptionLines: ["Deal 1 Freeze damage, twice"],
        effects: [
          { kind: "damage", damageType: "freeze", amount: 1 },
          { kind: "damage", damageType: "freeze", amount: 2 },
        ],
      }),
    );
    expect(issues.map((issue) => issue.message)).toContain(
      '"Deal 1 Freeze damage, twice" does not match authored amount 2',
    );
  });

  it("accepts a fully described card with no issues", () => {
    const issues = validateCardDescriptionParity(
      makeCard({
        id: "clean-card",
        descriptionLines: ["Deal 5 physical damage", "Gain 3 Block", "Leech"],
        effects: [
          { kind: "damage", damageType: "physical", amount: 5, lifesteal: true },
          { kind: "player-status", status: "block", amount: 3 },
        ],
      }),
    );
    expect(issues).toEqual([]);
  });
});

describe("enemy trait parity failure paths", () => {
  it("rejects a damage trait description that omits its damage type and magnitude", () => {
    const enemy = enemyBestiary.find((entry) => entry.traits.some((trait) => trait.id === "tough-hide"));
    expect(enemy).toBeDefined();
    if (!enemy) return;
    const issues = validateEnemyTraitDescriptionParity({
      ...enemy,
      traits: [{ id: "tough-hide", title: "Tough Hide", description: "Takes less burn damage" }],
    });
    expect(issues).toEqual([
      {
        severity: "error",
        area: "enemies",
        id: enemy.id,
        message: 'Trait "tough-hide" description does not mention 10% less physical damage',
      },
    ]);
  });

  it("rejects a missing second damage effect", () => {
    const enemy = enemyBestiary.find((entry) => entry.id === "frostwarden")!;
    const issues = validateEnemyTraitDescriptionParity({
      ...enemy,
      traits: [{ id: "glacial-body", title: "Glacial Body", description: "Receives half Freeze damage" }],
    });
    expect(issues.map((issue) => issue.message)).toEqual([
      'Trait "glacial-body" description does not mention 30% more burn damage',
    ]);
  });

  it("requires each non-damage effect term", () => {
    const enemy = enemyBestiary.find((entry) => entry.id === "stone-golem")!;
    const issues = validateEnemyTraitDescriptionParity({
      ...enemy,
      traits: [{ id: "stone-golem", title: "Stoneguard", description: "Gains 1 Block each turn" }],
    });
    expect(issues.map((issue) => issue.message)).toEqual(['Trait "stone-golem" description does not mention damage']);
  });

  it("rejects a wrong damage magnitude", () => {
    const enemy = enemyBestiary.find((entry) => entry.id === "frostwarden")!;
    const issues = validateEnemyTraitDescriptionParity({
      ...enemy,
      traits: [
        {
          id: "glacial-body",
          title: "Glacial Body",
          description: "Receives 25% less Freeze damage\nReceives 30% more Burn damage",
        },
      ],
    });
    expect(issues.map((issue) => issue.message)).toEqual([
      'Trait "glacial-body" description does not mention half freeze damage',
    ]);
  });

  it("requires Blood Countess's healing reaction rather than her retired Bleed aura", () => {
    const enemy = enemyBestiary.find((entry) => entry.id === "blood-countess")!;
    const issues = validateEnemyTraitDescriptionParity({
      ...enemy,
      traits: [{ id: "blood-countess", title: "Profane Blood", description: "Receives 30% more Holy damage" }],
    });
    expect(issues.map((issue) => issue.message)).toEqual([
      'Trait "blood-countess" description does not mention restores health',
    ]);
  });

  it("accepts either Health or heal wording for Regeneration", () => {
    const enemy = enemyBestiary.find((entry) => entry.id === "mud-elemental")!;
    for (const description of ["Restores Health each turn", "Heals each turn"]) {
      expect(
        validateEnemyTraitDescriptionParity({
          ...enemy,
          traits: [{ id: "regeneration", title: "Regeneration", description }],
        }),
      ).toEqual([]);
    }
  });

  it("ignores unregistered trait ids", () => {
    const enemy = enemyBestiary[0];
    const issues = validateEnemyTraitDescriptionParity({
      ...enemy,
      traits: [{ id: "unregistered-trait", title: "Mystery", description: "Does something" }],
    });
    expect(issues).toEqual([]);
  });
});

describe("enemy trait parity", () => {
  it("covers every bestiary trait with a term or damage rule", () => {
    const coveredIds = new Set([
      ...Object.keys(TRAIT_REQUIRED_TERMS),
      ...TRAIT_DAMAGE_RULES.map((rule) => rule.traitId),
    ]);
    for (const enemy of enemyBestiary) {
      for (const trait of enemy.traits) {
        expect(trait.id.length).toBeGreaterThan(0);
        expect(trait.title.length).toBeGreaterThan(0);
        expect(trait.description.length).toBeGreaterThan(0);
        expect(coveredIds.has(trait.id), trait.id).toBe(true);
      }
    }
  });

  it("matches every bestiary trait description against parity", () => {
    const issues = enemyBestiary.flatMap((enemy) => validateEnemyTraitDescriptionParity(enemy));
    expect(issues).toEqual([]);
  });
});
