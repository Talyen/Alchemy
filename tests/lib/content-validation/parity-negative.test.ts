import { describe, expect, it } from "vitest";
import type { BattleCard } from "@/lib/game-data";
import { validateCardDescriptionParity } from "@/lib/content-validation/card-parity";
import { validateEnemyTraitDescriptionParity } from "@/lib/content-validation/card-parity/enemy-trait-parity";
import { enemyBestiary } from "@/lib/game-data";

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
  it("rejects a trait description that omits its required term", () => {
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
        message: 'Trait "tough-hide" description does not mention physical',
      },
    ]);
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
