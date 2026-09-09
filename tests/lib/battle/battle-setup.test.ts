import { describe, expect, it } from "vitest";
import { defaultGearEffects } from "@/lib/gear";
import { createBattleStartState, createBattleState, drawOpeningHand } from "@/lib/battle/battle-setup";
import { enemyBestiary, computeTalentEffects } from "@/lib/game-data";
import type { BestiaryEntry, DifficultyModifier } from "@/lib/game-data";
import { BASE_PLAYER_MANA, MAX_PLAYER_HEALTH } from "@/lib/game-constants";
import { defaultTrinketEffects } from "@/lib/trinkets";
import { makeTestCard, seededRng } from "../../fixtures/battle";

describe("createBattleState", () => {
  const skeleton = enemyBestiary.find((e) => e.id === "skeleton")!;
  const battleDeck = [makeTestCard({ id: "slash" }), makeTestCard({ id: "block" })];

  it("creates a valid battle state with starting hand", () => {
    const result = createBattleState({
      runDeck: battleDeck,
      currentEnemy: skeleton,
      rng: seededRng(42),
    });
    expect(result.turn).toBe(1);
    expect(result.playerHealth).toBe(MAX_PLAYER_HEALTH);
    expect(result.enemyHealth).toBe(54);
    expect(result.hand.length).toBeGreaterThanOrEqual(1);
    expect(result.mana).toBe(BASE_PLAYER_MANA);
    expect(result.activeCompanion).toBeNull();
  });

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
    expect(opened.hand).toHaveLength(5);
    expect(opened.deck).toHaveLength(3);
    expect(opened.hand.map((card) => card.uid)).toEqual([0, 1, 2, 3, 4]);
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
    expect(result.enemyHealth).toBe(88);
    expect(result.currentEnemy.abilityIds).toEqual(skeleton.abilityIds);
    expect(result.lastEnemyAbilityId).toBeNull();
  });

  it("initializes the calibrated elite Health pool", () => {
    const elite = enemyBestiary.find((e) => e.enemyType === "elite")!;
    const result = createBattleState({
      runDeck: battleDeck,
      currentEnemy: elite,
      rng: seededRng(42),
    });
    expect(result.enemyMaxHealth).toBe(95);
    expect(result.enemyHealth).toBe(result.enemyMaxHealth);
  });

  it("initializes the calibrated Frostwarden Health pool", () => {
    const boss = enemyBestiary.find((e) => e.enemyType === "boss")!;
    const result = createBattleState({
      runDeck: battleDeck,
      currentEnemy: boss,
      rng: seededRng(42),
    });
    expect(result.enemyMaxHealth).toBe(96);
    expect(result.enemyHealth).toBe(result.enemyMaxHealth);
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
    it("Knight Novice (d1): start-block 5 adds to player block", () => {
      const result = createBattleState({
        runDeck: battleDeck,
        currentEnemy: skeleton,
        difficultyModifiers: [{ kind: "start-block", amount: 5 }],
        rng: seededRng(42),
      });
      expect(result.playerStatuses.block).toBe(5);
      expect(result.enemyMitigation.armor).toBe(0);
    });

    it("Knight Adventurer (d2): enemy-starting-armor 2", () => {
      const result = createBattleState({
        runDeck: battleDeck,
        currentEnemy: skeleton,
        difficultyModifiers: [{ kind: "enemy-starting-armor", amount: 2 }],
        rng: seededRng(42),
      });
      expect(result.enemyMitigation.armor).toBe(2);
    });

    it("Iron Bear starts combat with 0 starting armor", () => {
      const ironBear = enemyBestiary.find((e) => e.id === "iron-bear")!;
      const result = createBattleState({
        runDeck: battleDeck,
        currentEnemy: ironBear,
        rng: seededRng(42),
      });
      expect(result.enemyMitigation.armor).toBe(0);
    });

    it("Knight Legend (d3): enemy-gains-forge-each-turn is stored in difficultyModifiers", () => {
      const mods: DifficultyModifier[] = [{ kind: "enemy-gains-forge-each-turn" }];
      const result = createBattleState({
        runDeck: battleDeck,
        currentEnemy: skeleton,
        difficultyModifiers: mods,
        rng: seededRng(42),
      });
      expect(result.difficultyModifiers).toEqual(mods);
    });

    it("Wizard Novice (d1): start-max-mana 1 adds extra mana", () => {
      const result = createBattleState({
        runDeck: battleDeck,
        currentEnemy: skeleton,
        difficultyModifiers: [{ kind: "start-max-mana", amount: 1 }],
        rng: seededRng(42),
      });
      expect(result.mana).toBe(BASE_PLAYER_MANA + 1);
      expect(result.maxMana).toBe(BASE_PLAYER_MANA + 1);
    });

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
});
