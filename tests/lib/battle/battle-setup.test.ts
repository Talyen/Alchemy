import { computeHomesteadEffects, mergeIntoManifest } from "@/lib/homestead/effects";
import { describe, expect, it } from "vitest";
import { defaultBattleState } from "@/lib/battle/battle-setup-defaults";
import { defaultGearEffects } from "@/lib/gear";
import { createBattleStartState, createBattleState, drawOpeningHand } from "@/lib/battle/battle-setup";
import { enemyBestiary, computeTalentEffects } from "@/lib/game-data";
import type { BestiaryEntry, DifficultyModifier } from "@/lib/game-data";
import { BASE_PLAYER_MANA } from "@/lib/game-constants";
import { defaultTrinketEffects } from "@/lib/trinkets";
import { makeTestCard, seededRng } from "../../fixtures/battle";

describe("createBattleState", () => {
  const skeleton = enemyBestiary.find((e) => e.id === "skeleton")!;
  const battleDeck = [makeTestCard({ id: "slash" }), makeTestCard({ id: "block" })];

  it("grants the thorns trait holder a thorns stack at battle start", () => {
    const thorny: BestiaryEntry = {
      ...skeleton,
      traits: [...skeleton.traits, { id: "thorns", title: "Thorns", description: "Thorns" }],
    };
    const start = createBattleStartState({ runDeck: battleDeck, currentEnemy: thorny, rng: seededRng(42) });
    expect(start.enemyStatuses.thorns).toBe(1);

    const plain = createBattleStartState({ runDeck: battleDeck, currentEnemy: skeleton, rng: seededRng(42) });
    expect(plain.enemyStatuses.thorns).toBe(0);
  });

  it.each([1, 2, 3, 4])("Orchard tier %i adds Thorns alongside gear and encounter benefits", (tier) => {
    const result = createBattleStartState({
      runDeck: battleDeck,
      currentEnemy: skeleton,
      rng: seededRng(42),
      talentEffects: mergeIntoManifest(computeTalentEffects({}), computeHomesteadEffects({}, { orchard: tier }, {})),
      gearEffects: { ...defaultGearEffects, startThorns: 2 },
      encounterBenefits: ["bramblecoat"],
      contentSystemType: "labyrinth",
    });
    const plain = createBattleStartState({
      runDeck: battleDeck,
      currentEnemy: skeleton,
      rng: seededRng(42),
      encounterBenefits: ["bramblecoat"],
      contentSystemType: "labyrinth",
    });
    expect(plain.playerStatuses.thorns).toBeGreaterThan(0);
    expect(result.playerStatuses.thorns).toBe(plain.playerStatuses.thorns + 2 + tier);
  });

  it("stages battle start with an empty hand before resolving the opening draw", () => {
    const runDeck = Array.from({ length: 8 }, (_, index) => makeTestCard({ id: `card-${index}` }));
    const start = createBattleStartState({
      runDeck,
      currentEnemy: skeleton,
      trinketIds: ["tattered-pages"],
      rng: seededRng(42),
    });

    expect(start.hand).toEqual([]);
    expect(start.deck).toHaveLength(8);
    expect(start.nextCardUid).toBe(0);

    const opened = drawOpeningHand(start);
    expect(opened.hand).toHaveLength(4);
    expect(opened.deck).toHaveLength(4);
    expect(opened.hand.map((card) => card.uid)).toEqual([0, 1, 2, 3]);
    expect([...opened.hand, ...opened.deck].map((card) => card.id).sort()).toEqual(
      runDeck.map((card) => card.id).sort(),
    );
  });

  it("throws when no enemy is provided", () => {
    expect(() =>
      createBattleState({ runDeck: battleDeck, rng: seededRng(42) } as Parameters<typeof createBattleState>[0]),
    ).toThrow("createBattleState requires currentEnemy");
  });

  it("scales enemy stats by cumulative rooms in run", () => {
    const result = createBattleState({
      runDeck: battleDeck,
      totalRooms: 5,
      currentEnemy: skeleton,
      rng: seededRng(42),
    });
    expect(result.enemyHealth).toBe(83);
    expect(result.currentEnemy.abilityIds).toEqual(skeleton.abilityIds);
    expect(result.lastEnemyAbilityId).toBeNull();
  });

  it("wires boon and talent manifests from inputs", () => {
    const talents = computeTalentEffects({ physical: ["physical-heavy-blows"] });
    const result = createBattleState({
      runDeck: battleDeck,
      currentEnemy: skeleton,
      talentEffects: talents,
      trinketIds: ["lucky-clover"],
      rng: seededRng(42),
    });
    expect(result.talentEffects).toEqual(talents);
    expect(result.trinketEffects).not.toEqual(defaultTrinketEffects);
    expect(result.trinketEffects.luckyCloverGoldChance).toBeGreaterThan(0);
    expect(result.talentEffects.physicalStunChance).toBe(10);
  });

  it("wires gear effects separately from talent effects", () => {
    const talents = computeTalentEffects({});
    const result = createBattleState({
      runDeck: battleDeck,
      currentEnemy: skeleton,
      talentEffects: talents,
      gearEffects: { ...defaultGearEffects, flatPhysicalDamage: 2 },
      rng: seededRng(42),
    });
    expect(result.gearEffects).toEqual({ ...defaultGearEffects, flatPhysicalDamage: 2 });
    expect(result.talentEffects.flatPhysicalDamage).toBe(talents.flatPhysicalDamage);
  });

  it("uses run maxHealth without double-counting gear maxHealth", () => {
    const result = createBattleState({
      runDeck: battleDeck,
      currentEnemy: skeleton,
      maxHealth: 40,
      gearEffects: { ...defaultGearEffects, maxHealth: 5 },
      rng: seededRng(42),
    });
    expect(result.playerMaxHealth).toBe(40);
  });

  it("applies gear start bonuses at battle setup", () => {
    const result = createBattleState({
      runDeck: battleDeck,
      currentEnemy: skeleton,
      playerHealth: 25,
      maxHealth: 30,
      gearEffects: {
        ...defaultGearEffects,
        startHeal: 2,
        startBlock: 3,
        startForge: 1,
        startFreeze: 1,
        flatBlockGained: 2,
      },
      rng: seededRng(42),
    });
    expect(result.playerHealth).toBe(27);
    expect(result.playerStatuses.block).toBe(5);
    expect(result.playerStatuses.forge).toBeGreaterThanOrEqual(1);
    expect(result.enemyHealth).toBeLessThan(result.enemyMaxHealth);
    expect(result.enemyStatuses.freeze).toBeGreaterThanOrEqual(1);
  });

  describe("difficulty modifiers", () => {
    it("Ranger Novice (d1): start-companion spawns wolf", () => {
      const result = createBattleState({
        runDeck: battleDeck,
        currentEnemy: skeleton,
        difficultyModifiers: [{ kind: "start-companion" }],
        rng: seededRng(42),
      });
      expect(result.activeCompanion).not.toBeNull();
      expect(result.activeCompanion?.id).toBe("wolf");
    });

    it("multiple modifiers apply simultaneously", () => {
      const mods: DifficultyModifier[] = [
        { kind: "start-block", amount: 5 },
        { kind: "enemy-starting-armor", amount: 2 },
        { kind: "start-max-mana", amount: 1 },
      ];
      const result = createBattleState({
        runDeck: battleDeck,
        currentEnemy: skeleton,
        difficultyModifiers: mods,
        rng: seededRng(42),
      });
      expect(result.playerStatuses.block).toBe(5);
      expect(result.enemyMitigation.armor).toBe(2);
      expect(result.mana).toBe(BASE_PLAYER_MANA + 1);
      expect(result.maxMana).toBe(BASE_PLAYER_MANA + 1);
    });
  });

  describe("opening resource gains", () => {
    it("Last Stand strengthens opening Bulwark and Plated Armor", () => {
      const state = createBattleStartState({
        runDeck: [],
        currentEnemy: skeleton,
        playerHealth: 10,
        maxHealth: 40,
        talentEffects: computeTalentEffects({ armor: ["armor-start-combat", "armor-desperate-double"] }),
        gearEffects: { ...defaultGearEffects, startArmor: 2, flatArmorGained: 1 },
        rng: () => 0.99,
      });
      expect(state.playerStatuses.armor).toBe(6);
    });

    it("Desperate Forge strengthens opening Forge Mastery and Tempered Forge", () => {
      const state = createBattleStartState({
        runDeck: [],
        currentEnemy: skeleton,
        playerHealth: 10,
        maxHealth: 40,
        talentEffects: computeTalentEffects({ forge: ["forge-strength-1", "forge-strength-5"] }),
        gearEffects: { ...defaultGearEffects, startForge: 2, forgeReadiesPhysicalRepeat: 1 },
        rng: () => 0,
      });
      expect(state.playerStatuses.forge).toBe(4);
      expect(state.uniqueGear.everkeenReady).toBe(true);
    });

    it("Tempered Guard and Ironwood Buckler reward Bastioned opening Block", () => {
      const state = createBattleStartState({
        runDeck: [],
        currentEnemy: skeleton,
        talentEffects: computeTalentEffects({ forge: ["forge-to-block"] }),
        trinketIds: ["ironwood-buckler"],
        gearEffects: { ...defaultGearEffects, startForge: 4, startBlock: 4, flatBlockGained: 1 },
        rng: () => 0.99,
      });
      expect(state.playerStatuses.block).toBe(6);
      expect(state.playerStatuses.thorns).toBe(1);
    });
  });
});

it("keeps every mutable default independent between battles", () => {
  const first = defaultBattleState();
  const expected = structuredClone(first.currentEnemy);
  first.currentEnemy.title = "Changed";
  first.currentEnemy.abilityIds.splice(0);
  first.currentEnemy.descriptionLines.push("Changed");
  first.currentEnemy.traits.push({ id: "changed", title: "Changed", description: "Changed" });
  first.playerStatuses.block = 99;
  first.enemyStatuses.burn = 99;
  const second = defaultBattleState();
  expect(second.currentEnemy).toEqual(expected);
  expect(second.playerStatuses.block).toBe(0);
  expect(second.enemyStatuses.burn).toBe(0);
});
