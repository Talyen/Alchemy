import { expect, it } from "vitest";
import { enemyBestiary, type BattleCard, type BattleCardEffect } from "@/lib/game-data";
import { TRAIT_REQUIRED_TERMS, validateCardDescriptionParity } from "@/lib/content-validation/card-parity";
import { TRAIT_DAMAGE_RULES } from "@/lib/game-constants";
import { validateEnemyTraitDescriptionParity } from "@/lib/content-validation/card-parity/enemy-trait-parity";

function card(effects: BattleCardEffect[], descriptionLines: string[], extra: Partial<BattleCard> = {}): BattleCard {
  return { id: "parity-probe", title: "Parity probe", art: "", cost: 1, effects, descriptionLines, ...extra };
}

it.each<{ name: string; effects: BattleCardEffect[]; lines: string[]; message: string }>([
  {
    name: "extra mechanic",
    effects: [],
    lines: ["Restore 4 Health"],
    message: '"Restore 4 Health" has no matching effect',
  },
  {
    name: "missing mechanic",
    effects: [{ kind: "heal", amount: 4 }],
    lines: [],
    message: 'missing expected description line "Restore 4 Health"',
  },
  {
    name: "wrong magnitude",
    effects: [{ kind: "damage", damageType: "physical", amount: 3 }],
    lines: ["Deal 5 Physical damage"],
    message: '"Deal 5 Physical damage" does not match expected "Deal 3 Physical damage"',
  },
  {
    name: "wrong range",
    effects: [{ kind: "random-draw", minAmount: 1, maxAmount: 4 }],
    lines: ["Roll a six-sided die", "Draw that many cards"],
    message: '"Roll a six-sided die" does not match expected "Draw 1–4 cards"',
  },
  {
    name: "unequal repeated hits",
    effects: [
      { kind: "damage", damageType: "freeze", amount: 1 },
      { kind: "damage", damageType: "freeze", amount: 2 },
    ],
    lines: ["Deal 1 Freeze damage twice"],
    message: '"Deal 1 Freeze damage twice" does not match expected "Deal 1 Freeze damage"',
  },
])("rejects $name", ({ effects, lines, message }) => {
  expect(validateCardDescriptionParity(card(effects, lines))).toContainEqual({
    severity: "error",
    area: "cards",
    id: "parity-probe",
    message,
  });
});

it("validates summon summaries together with additional mechanics and normalizes both sides of Gold aliases", () => {
  const summon: BattleCardEffect = { kind: "summon-companion", companionId: "golden-retriever" };
  expect(validateCardDescriptionParity(card([summon], ["Steals 2 Gold each turn", "Companion"]))).toEqual([]);
  expect(
    validateCardDescriptionParity(
      card([summon, { kind: "heal", amount: 2 }], ["Steals 2 Gold each turn", "Restore 99 Health", "Companion"]),
    ),
  ).toEqual([
    {
      severity: "error",
      area: "cards",
      id: "parity-probe",
      message: '"Restore 99 Health" does not match expected "Restore 2 Health"',
    },
  ]);
  expect(validateCardDescriptionParity(card([{ kind: "gain-gold", amount: 2 }], ["Steal 2 Gold"]))).toEqual([]);
});

it("reports an unrenderable mechanic instead of accepting its description", () => {
  expect(validateCardDescriptionParity(card([{ kind: "remove-harmful-status" }], ["Cleanse everything"]))).toEqual([
    { severity: "error", area: "cards", id: "parity-probe", message: "Cannot describe card effects" },
  ]);
});

it.each<BattleCardEffect>([
  { kind: "damage", damageType: "physical", amount: 5, lifesteal: true },
  { kind: "random-damage", minAmount: 1, maxAmount: 4, lifesteal: true },
  { kind: "cleanse-player-status-to-damage", status: "burn", damageType: "holy", lifesteal: true },
])("warns about missing Leech for $kind", (effect) => {
  const issues = validateCardDescriptionParity(card([effect], []));
  expect(issues.filter(({ severity }) => severity === "warning")).toEqual([
    {
      severity: "warning",
      area: "cards",
      id: "parity-probe",
      message: "Lifesteal effect is missing Leech description line",
    },
  ]);
});

it("accepts scheduled Leech and keeps missing keyword tags as warnings", () => {
  const hit: BattleCardEffect = { kind: "damage", damageType: "physical", amount: 5, lifesteal: true };
  expect(
    validateCardDescriptionParity(
      card(
        [{ kind: "repeat-over-turns", remainingTurns: 2, effects: [hit] }],
        ["Deal 5 Physical damage for the next 2 turns", "Leech for the next 2 turns"],
      ),
    ),
  ).toEqual([]);
  expect(
    validateCardDescriptionParity(
      card(
        [{ kind: "chance", probability: 0.5, successEffects: [hit], failureEffects: [] }],
        ["50% chance: Deal 5 Physical damage; Leech"],
      ),
    ),
  ).toEqual([]);
  const base = card([{ kind: "draw-cards", amount: 1 }], ["Draw a card"], { consume: true, tags: ["archery"] });
  expect(validateCardDescriptionParity(base).map(({ severity }) => severity)).toEqual(["warning", "warning"]);
  const summon = card(
    [{ kind: "summon-companion", companionId: "wolf" }],
    ["Deals 1 Bleed or Physical damage each turn"],
  );
  expect(validateCardDescriptionParity(summon).map(({ severity }) => severity)).toEqual(["warning"]);
});

it.each([
  ["stone-golem", "stone-golem", "Gains 1 Block each turn", ["damage"]],
  ["bandit", "bandit", "Deals double damage on its first attack", ["landed", "hit"]],
  ["blood-countess", "blood-countess", "Receives 30% more Holy damage", ["restores health"]],
  ["frostwarden", "glacial-body", "Receives half Freeze damage", ["30% more burn damage"]],
  [
    "frostwarden",
    "glacial-body",
    "Receives 25% less Freeze damage\nReceives 30% more Burn damage",
    ["half freeze damage"],
  ],
] as const)("checks %s's %s wording", (id, traitId, description, missing) => {
  const enemy = enemyBestiary.find((entry) => entry.id === id)!;
  expect(
    validateEnemyTraitDescriptionParity({ ...enemy, traits: [{ id: traitId, title: "Probe", description }] }),
  ).toEqual(
    missing.map((term) => ({
      severity: "error",
      area: "enemies",
      id,
      message: `Trait "${traitId}" description does not mention ${term}`,
    })),
  );
});

it("allows supported healing synonyms and safely skips unregistered trait IDs", () => {
  for (const [id, description] of [
    ["regeneration", "Restores Health each turn"],
    ["regeneration", "Heals each turn"],
    ["unknown", "Unknown"],
    ["constructor", "Unknown"],
    ["__proto__", "Unknown"],
    ["toString", "Unknown"],
  ] as const)
    expect(
      validateEnemyTraitDescriptionParity({
        ...enemyBestiary[0],
        traits: [{ id, title: "Probe", description }],
      }),
    ).toEqual([]);
});

it("covers every native trait with a description rule", () => {
  const covered = new Set([...Object.keys(TRAIT_REQUIRED_TERMS), ...TRAIT_DAMAGE_RULES.map(({ traitId }) => traitId)]);
  const missing = enemyBestiary.flatMap((enemy) =>
    enemy.traits.filter(({ id }) => !covered.has(id)).map(({ id }) => `${enemy.id}/${id}`),
  );
  expect(missing).toEqual([]);
});
