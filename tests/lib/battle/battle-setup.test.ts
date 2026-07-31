import { describe, expect, it } from "vitest";
import { defaultGearEffects } from "@/lib/gear";
import { createBattleState } from "@/lib/battle/battle-setup";
import { enemyBestiary, computeTalentEffects } from "@/lib/game-data";
import type { BestiaryEntry, DifficultyModifier } from "@/lib/game-data";
import { BASE_PLAYER_MANA, BOSS_HEALTH_MULTIPLIER, ELITE_HP_MULTIPLIER, MAX_PLAYER_HEALTH } from "@/lib/game-constants";
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
    expect(result.enemyHealth).toBe(30);
    expect(result.hand.length).toBeGreaterThanOrEqual(1);
    expect(result.mana).toBe(BASE_PLAYER_MANA);
    expect(result.activeCompanion).toBeNull();
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
    expect(result.enemyHealth).toBe(38);
    expect(result.enemyAttackEffects[0].amount).toBe(9);
  });

  it("scales elite enemy health by ELITE_HP_MULTIPLIER", () => {
    const elite = enemyBestiary.find((e) => e.enemyType === "elite")!;
    const result = createBattleState({
      runDeck: battleDeck,
      currentEnemy: elite,
      rng: seededRng(42),
    });
    expect(result.enemyMaxHealth).toBe(Math.round(30 * ELITE_HP_MULTIPLIER));
    expect(result.enemyHealth).toBe(result.enemyMaxHealth);
  });

  it("scales boss enemy health by BOSS_HEALTH_MULTIPLIER", () => {
    const boss = enemyBestiary.find((e) => e.enemyType === "boss")!;
    const result = createBattleState({
      runDeck: battleDeck,
      currentEnemy: boss,
      rng: seededRng(42),
    });
    expect(result.enemyMaxHealth).toBe(Math.round(30 * BOSS_HEALTH_MULTIPLIER));
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

    it("increase-enemy-physical-damage boosts matching damage effect", () => {
      const withBoss: BestiaryEntry = {
        ...skeleton,
        attackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }],
      };
      const result = createBattleState({
        runDeck: battleDeck,
        currentEnemy: withBoss,
        difficultyModifiers: [{ kind: "increase-enemy-physical-damage", amount: 3 }],
        rng: seededRng(42),
      });
      const dmgEffect = result.enemyAttackEffects.find((e) => e.kind === "damage")!;
      expect(dmgEffect.amount).toBe(11);
    });

    it("increase-enemy-damage boosts any damage effect", () => {
      const withBoss: BestiaryEntry = {
        ...skeleton,
        attackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }],
      };
      const result = createBattleState({
        runDeck: battleDeck,
        currentEnemy: withBoss,
        difficultyModifiers: [{ kind: "increase-enemy-damage", amount: 4 }],
        rng: seededRng(42),
      });
      const dmgEffect = result.enemyAttackEffects.find((e) => e.kind === "damage")!;
      expect(dmgEffect.amount).toBe(12);
    });

    it("increase-enemy-status boosts matching status effect", () => {
      const withBoss: BestiaryEntry = {
        ...skeleton,
        attackEffects: [
          { kind: "damage", damageType: "physical", amount: 6 },
          { kind: "player-status", status: "poison", amount: 2 },
        ],
      };
      const result = createBattleState({
        runDeck: battleDeck,
        currentEnemy: withBoss,
        difficultyModifiers: [{ kind: "increase-enemy-status", status: "poison", amount: 2 }],
        rng: seededRng(42),
      });
      const poisonEffect = result.enemyAttackEffects.find((e) => e.kind === "player-status" && e.status === "poison")!;
      expect(poisonEffect.amount).toBe(4);
      const dmgEffect = result.enemyAttackEffects.find((e) => e.kind === "damage")!;
      expect(dmgEffect.amount).toBe(6);
    });

    it("increase-enemy-status boosts matching freeze damage effect", () => {
      const withBoss: BestiaryEntry = {
        ...skeleton,
        attackEffects: [
          { kind: "damage", damageType: "physical", amount: 6 },
          { kind: "damage", damageType: "freeze", amount: 2 },
        ],
      };
      const result = createBattleState({
        runDeck: battleDeck,
        currentEnemy: withBoss,
        difficultyModifiers: [{ kind: "increase-enemy-status", status: "freeze", amount: 2 }],
        rng: seededRng(42),
      });
      const freezeEffect = result.enemyAttackEffects.find((e) => e.kind === "damage" && e.damageType === "freeze")!;
      expect(freezeEffect.amount).toBe(4);
    });

    it("enemy-attacks-gain-leech adds lifesteal to damage effects", () => {
      const withBoss: BestiaryEntry = {
        ...skeleton,
        attackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }],
      };
      const result = createBattleState({
        runDeck: battleDeck,
        currentEnemy: withBoss,
        difficultyModifiers: [{ kind: "enemy-attacks-gain-leech" }],
        rng: seededRng(42),
      });
      const dmgEffect = result.enemyAttackEffects.find((e) => e.kind === "damage")!;
      expect((dmgEffect as typeof dmgEffect & { lifesteal: boolean }).lifesteal).toBe(true);
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

    it("increase-enemy-status does not affect non-matching status", () => {
      const withBoss: BestiaryEntry = {
        ...skeleton,
        attackEffects: [
          { kind: "damage", damageType: "physical", amount: 6 },
          { kind: "player-status", status: "burn", amount: 2 },
        ],
      };
      const result = createBattleState({
        runDeck: battleDeck,
        currentEnemy: withBoss,
        difficultyModifiers: [{ kind: "increase-enemy-status", status: "poison", amount: 2 }],
        rng: seededRng(42),
      });
      const burnEffect = result.enemyAttackEffects.find((e) => e.kind === "player-status" && e.status === "burn")!;
      expect(burnEffect.amount).toBe(2);
    });
  });
});
