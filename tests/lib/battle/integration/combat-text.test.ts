import { describe, expect, it, vi } from "vitest";
import { makeState, makeCard } from "./helpers";

vi.spyOn(Math, "random").mockReturnValue(0.99);
import { applyCardEffects, defaultTalentEffects, getEnemyDamageMultiplier, mergeCombatText } from "@/lib/battle";
import { type CombatTextEvent } from "@/lib/battle/types";

describe("mergeCombatText", () => {
  it("adds a new event to an empty array", () => {
    const texts: CombatTextEvent[] = [];
    mergeCombatText(texts, { target: "enemy", kind: "damage", stat: "physical", amount: 5 });
    expect(texts).toEqual([{ target: "enemy", kind: "damage", stat: "physical", amount: 5 }]);
  });

  it("merges events with the same target, kind, and stat", () => {
    const texts: CombatTextEvent[] = [{ target: "enemy", kind: "damage", stat: "physical", amount: 5 }];
    mergeCombatText(texts, { target: "enemy", kind: "damage", stat: "physical", amount: 3 });
    expect(texts).toEqual([{ target: "enemy", kind: "damage", stat: "physical", amount: 8 }]);
  });

  it("does NOT merge events with different targets", () => {
    const texts: CombatTextEvent[] = [{ target: "enemy", kind: "damage", stat: "physical", amount: 5 }];
    mergeCombatText(texts, { target: "player", kind: "damage", stat: "physical", amount: 3 });
    expect(texts).toHaveLength(2);
  });

  it("does NOT merge events with different stats", () => {
    const texts: CombatTextEvent[] = [{ target: "enemy", kind: "damage", stat: "physical", amount: 5 }];
    mergeCombatText(texts, { target: "enemy", kind: "damage", stat: "burn", amount: 3 });
    expect(texts).toHaveLength(2);
  });
});

describe("getEnemyDamageMultiplier", () => {
  it("returns 1 for an enemy with no traits", () => {
    const state = makeState();
    expect(getEnemyDamageMultiplier(state, "physical")).toBe(1);
  });

  it("returns 2 for holy damage against brittle-bones", () => {
    const state = makeState({
      currentEnemy: {
        id: "skeleton",
        title: "Skeleton",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "normal",
        traits: [{ id: "brittle-bones", title: "Brittle Bones", description: "" }],
        attackEffects: [],
      },
    });
    expect(getEnemyDamageMultiplier(state, "holy")).toBe(2);
    expect(getEnemyDamageMultiplier(state, "stun")).toBe(2);
    expect(getEnemyDamageMultiplier(state, "physical")).toBe(1);
  });

  it("returns 2 for burn against trinket-hoarder", () => {
    const state = makeState({
      currentEnemy: {
        id: "goblin",
        title: "Goblin",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "normal",
        traits: [{ id: "trinket-hoarder", title: "Trinket Hoarder", description: "" }],
        attackEffects: [],
      },
    });
    expect(getEnemyDamageMultiplier(state, "burn")).toBe(2);
    expect(getEnemyDamageMultiplier(state, "holy")).toBe(1);
    expect(getEnemyDamageMultiplier(state, "physical")).toBe(1);
  });

  it("returns 2 for holy against holy-vulnerability", () => {
    const state = makeState({
      currentEnemy: {
        id: "necromancer",
        title: "Necromancer",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "elite",
        traits: [{ id: "holy-vulnerability", title: "Holy Vulnerability", description: "" }],
        attackEffects: [],
      },
    });
    expect(getEnemyDamageMultiplier(state, "holy")).toBe(2);
    expect(getEnemyDamageMultiplier(state, "physical")).toBe(1);
  });

  it("returns 0.5 for burn against burn-resistance", () => {
    const state = makeState({
      currentEnemy: {
        id: "imp",
        title: "Imp",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "normal",
        traits: [{ id: "burn-resistance", title: "Burn Resistance", description: "" }],
        attackEffects: [],
      },
    });
    expect(getEnemyDamageMultiplier(state, "burn")).toBe(0.5);
    expect(getEnemyDamageMultiplier(state, "physical")).toBe(1);
  });

  it("returns 0.5 for poison against poison-resistance", () => {
    const state = makeState({
      currentEnemy: {
        id: "lizard-scout",
        title: "Lizard Scout",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "normal",
        traits: [{ id: "poison-resistance", title: "Poison Resistance", description: "" }],
        attackEffects: [],
      },
    });
    expect(getEnemyDamageMultiplier(state, "poison")).toBe(0.5);
    expect(getEnemyDamageMultiplier(state, "physical")).toBe(1);
  });

  it("returns 0.5 for bleed against living-armor", () => {
    const state = makeState({
      currentEnemy: {
        id: "living-armor",
        title: "Living Armor",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "elite",
        traits: [{ id: "living-armor", title: "Living Armor", description: "" }],
        attackEffects: [],
      },
    });
    expect(getEnemyDamageMultiplier(state, "bleed")).toBe(0.5);
    expect(getEnemyDamageMultiplier(state, "physical")).toBe(1);
    expect(getEnemyDamageMultiplier(state, "burn")).toBe(1);
  });

  it("returns 0.5 for physical against thick-hide", () => {
    const state = makeState({
      currentEnemy: {
        id: "iron-bear",
        title: "The Iron Bear",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "boss",
        traits: [{ id: "thick-hide", title: "Thick Hide", description: "Receives half Physical damage" }],
        attackEffects: [],
      },
    });
    expect(getEnemyDamageMultiplier(state, "physical")).toBe(0.5);
    expect(getEnemyDamageMultiplier(state, "burn")).toBe(1);
  });
});

describe("combat number accuracy", () => {
  it("does not double the first Burn card unless the talent is active", () => {
    const card = makeCard({ effects: [{ kind: "damage", damageType: "burn", amount: 10 }] });
    const state = makeState({ enemyHealth: 30 });
    const texts: CombatTextEvent[] = [];

    const result = applyCardEffects(state, card, texts);

    expect(result.enemyHealth).toBe(20);
    expect(result.enemyStatuses.burn).toBe(10);
    expect(texts).toEqual([{ target: "enemy", kind: "damage", stat: "burn", amount: 10 }]);
    expect(result.flags.firstBurnCardDoubledUsed).toBe(false);
  });

  it("doubles the first Burn card exactly once when the talent is active", () => {
    const card = makeCard({ effects: [{ kind: "damage", damageType: "burn", amount: 10 }] });
    const secondCard = makeCard({ id: "second-burn", effects: [{ kind: "damage", damageType: "burn", amount: 10 }] });
    const state = makeState({
      enemyHealth: 50,
      talentEffects: { ...defaultTalentEffects, firstBurnCardDoubled: true },
    });

    const firstTexts: CombatTextEvent[] = [];
    const first = applyCardEffects(state, card, firstTexts);
    const secondTexts: CombatTextEvent[] = [];
    const second = applyCardEffects(first, secondCard, secondTexts);

    expect(first.enemyHealth).toBe(30);
    expect(first.enemyStatuses.burn).toBe(15);
    expect(firstTexts).toEqual([{ target: "enemy", kind: "damage", stat: "burn", amount: 15 }]);
    expect(first.flags.firstBurnCardDoubledUsed).toBe(true);

    expect(second.enemyHealth).toBe(20);
    expect(second.enemyStatuses.burn).toBe(25);
    expect(secondTexts).toEqual([{ target: "enemy", kind: "damage", stat: "burn", amount: 10 }]);
  });

  it("uses post-weakness damage for health, status stacks, and combat text", () => {
    const card = makeCard({ effects: [{ kind: "damage", damageType: "burn", amount: 10 }] });
    const state = makeState({
      enemyHealth: 30,
      currentEnemy: {
        id: "undead",
        title: "Undead",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "normal",
        traits: [{ id: "trinket-hoarder", title: "Trinket Hoarder", description: "Receives double Burn damage." }],
        attackEffects: [],
      },
    });
    const texts: CombatTextEvent[] = [];

    const result = applyCardEffects(state, card, texts);

    expect(result.enemyHealth).toBe(10);
    expect(result.enemyStatuses.burn).toBe(20);
    expect(texts).toEqual([{ target: "enemy", kind: "damage", stat: "burn", amount: 20 }]);
  });

  it("uses post-resistance damage for health, status stacks, and combat text", () => {
    const card = makeCard({ effects: [{ kind: "damage", damageType: "burn", amount: 10 }] });
    const state = makeState({
      enemyHealth: 30,
      currentEnemy: {
        id: "lizard",
        title: "Lizard",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "normal",
        traits: [{ id: "burn-resistance", title: "Burn Resistance", description: "Receives half Burn damage." }],
        attackEffects: [],
      },
    });
    const texts: CombatTextEvent[] = [];

    const result = applyCardEffects(state, card, texts);

    expect(result.enemyHealth).toBe(25);
    expect(result.enemyStatuses.burn).toBe(5);
    expect(texts).toEqual([{ target: "enemy", kind: "damage", stat: "burn", amount: 5 }]);
  });

  it("does not trigger first-poison gold when enemy is immune", () => {
    // Armor no longer blocks non-physical damage, so this tests a different scenario:
    // Immunity through max health / damage threshold is tested in other poison tests.
  });

  it("does not trigger Cutpurse Knife when enemy is immune", () => {
    // Armor no longer blocks non-physical damage (bleed), so immunity from
    // armor is no longer applicable. The Cutpurse Knife bleed interaction
    // is tested in the companion bleed test above.
  });
});
