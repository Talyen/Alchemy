import { afterEach, describe, expect, it, vi } from "vitest";
import {
  computeVictoryRewardState,
  withSelectedBossForDestinations,
  createDestinationRewardState,
  computeVictoryRewards,
  commitVictoryRewards,
  type VictoryRewardsInput,
} from "@/features/alchemy/navigation/victory-flow";
import { createEmptyRewardState } from "@/features/alchemy/navigation/reward-flow";
import { emptyInventory } from "@/lib/homestead/inventory";
import { playGoldGain } from "@/lib/audio";
import type { Destination } from "@/features/alchemy/types";

vi.mock("@/lib/utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/utils")>("@/lib/utils");
  return { ...actual, randomInt: vi.fn(() => 15) };
});

vi.mock("@/features/alchemy/navigation/destination-flow", () => ({
  sampleDestinationChoices: vi.fn((dests: Destination[]) => dests.slice(0, 3)),
}));

vi.mock("@/lib/homestead/loot", () => ({
  getEnemyMaterialLoot: vi.fn(() => ({ wood: 1, iron: 0, herbs: 0, food: 0, crystal: 0 })),
  applyMaterialFindBonus: vi.fn((mats: unknown) => mats),
}));

vi.mock("@/lib/audio", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audio")>("@/lib/audio");
  return { ...actual, playGoldGain: vi.fn() };
});

function baseBattleState(overrides: Record<string, unknown> = {}) {
  return {
    gold: 5,
    playerHealth: 30,
    currentEnemy: { id: "goblin", enemyType: "normal" },
    activeCompanion: null,
    ...overrides,
  } as never;
}

function baseInput(overrides: Record<string, unknown> = {}): VictoryRewardsInput {
  return {
    characterId: "knight",
    selectedDifficulty: null,
    unlockedTalents: {},
    runDeck: [],
    runTrinkets: [],
    contentSystemType: "campaign",
    activeLabyrinthRewardModifiers: [],
    battleState: baseBattleState(),
    runGold: 5,
    runPlayerHealth: 30,
    runMaxHealth: 30,
    destinationIndexInAct: 2,
    completedDestinations: ["Normal Combat", "Normal Combat"],
    homesteadEffects: {
      flatPhysicalDamage: 0,
      companionDamage: 0,
      companionBondLevels: {},
      potionHealMultiplier: 1,
      potionDiscount: 0,
      potionPotency: 0,
      herbFindBonus: 0,
      startGold: 0,
      startBlock: 0,
      campfireHealBonus: 0,
      physicalCritChance: 0,
      startMaxHealthBonus: 0,
      forgeToBurn: false,
    },
    getAvailableDestinations: vi.fn(() => ["Normal Combat", "Campfire", "Mystery"] as Destination[]),
    bossEnemyId: "mimic",
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("withSelectedBossForDestinations", () => {
  it("sets selectedBossId when only Boss Combat is available", () => {
    const reward = createEmptyRewardState(["Boss Combat"]);
    const result = withSelectedBossForDestinations(["Boss Combat"], reward, "mimic");
    expect(result.selectedBossId).toBeTruthy();
  });

  it("clears selectedBossId when multiple destinations are available", () => {
    const reward = { ...createEmptyRewardState(["Normal Combat", "Campfire"]), selectedBossId: "dragon" };
    const result = withSelectedBossForDestinations(["Normal Combat", "Campfire"], reward);
    expect(result.selectedBossId).toBeNull();
  });

  it("preserves existing selectedBossId for single boss destination", () => {
    const reward = { ...createEmptyRewardState(["Boss Combat"]), selectedBossId: "dragon" };
    const result = withSelectedBossForDestinations(["Boss Combat"], reward, "mimic");
    expect(result.selectedBossId).toBe("dragon");
  });
});

describe("createDestinationRewardState", () => {
  it("returns empty reward state with destinations", () => {
    const result = createDestinationRewardState(["Normal Combat", "Campfire"]);
    expect(result.destinations).toEqual(["Normal Combat", "Campfire"]);
    expect(result.gold).toBe(0);
    expect(result.choices).toEqual([]);
  });

  it("sets selectedBossId for single boss destination", () => {
    const result = createDestinationRewardState(["Boss Combat"], "mimic");
    expect(result.selectedBossId).toBeTruthy();
    expect(result.destinations).toEqual(["Boss Combat"]);
  });
});

describe("computeVictoryRewardState", () => {
  it("creates boss reward state (trinket) for boss enemies", () => {
    const result = computeVictoryRewardState({
      characterId: "knight",
      selectedDifficulty: null,
      unlockedTalents: {},
      runDeck: [],
      runTrinkets: [],
      contentSystemType: "campaign",
      activeLabyrinthRewardModifiers: [],
      battleState: baseBattleState({ currentEnemy: { id: "dragon", enemyType: "boss" } }),
      gold: 15,
      eliteBonus: 0,
      generousBonus: 0,
      bossBonus: 10,
      materials: emptyInventory(),
      destinations: [],
    });
    expect(result.rewardType).toBe("trinket");
    expect(result.gold).toBeGreaterThan(0);
  });

  it("creates combat reward state for normal enemies", () => {
    const result = computeVictoryRewardState({
      characterId: "knight",
      selectedDifficulty: null,
      unlockedTalents: {},
      runDeck: [],
      runTrinkets: [],
      contentSystemType: "campaign",
      activeLabyrinthRewardModifiers: [],
      battleState: baseBattleState({ currentEnemy: { id: "goblin", enemyType: "normal" } }),
      gold: 15,
      eliteBonus: 0,
      generousBonus: 0,
      bossBonus: 0,
      materials: emptyInventory(),
      destinations: ["Normal Combat", "Campfire"],
    });
    expect(["card", "trinket"]).toContain(result.rewardType);
    expect(result.destinations).toEqual(["Normal Combat", "Campfire"]);
    expect(result.gold).toBeGreaterThan(0);
  });

  it("forces trinket reward when collector modifier is active", () => {
    const result = computeVictoryRewardState({
      characterId: "knight",
      selectedDifficulty: null,
      unlockedTalents: {},
      runDeck: [],
      runTrinkets: [],
      contentSystemType: "labyrinth",
      activeLabyrinthRewardModifiers: ["collector"],
      battleState: baseBattleState({ currentEnemy: { id: "goblin", enemyType: "normal" } }),
      gold: 15,
      eliteBonus: 0,
      generousBonus: 0,
      bossBonus: 0,
      materials: emptyInventory(),
      destinations: ["Normal Combat"],
    });
    expect(result.rewardType).toBe("trinket");
  });
});

describe("computeVictoryRewards", () => {
  it("computes combat victory rewards for normal enemy", () => {
    const result = computeVictoryRewards(baseInput());
    expect(result.goldEarned).toBeGreaterThan(0);
    expect(["card", "trinket"]).toContain(result.rewardState.rewardType);
    expect(result.playerHealth).toBe(30);
    expect(result.maxHealthDelta).toBe(0);
    expect(result.bossBonus).toBe(0);
    expect(result.eliteBonus).toBe(0);
  });

  it("applies elite gold bonus for elite enemies", () => {
    const result = computeVictoryRewards(baseInput({
      battleState: baseBattleState({ currentEnemy: { id: "goblin-chief", enemyType: "elite" } }),
    }));
    expect(result.eliteBonus).toBeGreaterThan(0);
  });

  it("doubles gold reward when enemy has gold-trove trait", () => {
    const normal = computeVictoryRewards(baseInput({
      battleState: baseBattleState({ currentEnemy: { id: "goblin-chief", enemyType: "elite" } }),
    }));
    const mimic = computeVictoryRewards(baseInput({
      battleState: baseBattleState({
        currentEnemy: {
          id: "mimic",
          title: "Mimic",
          subtitle: "Elite",
          descriptionLines: [],
          art: "",
          enemyType: "elite",
          traits: [{ id: "gold-trove", title: "Gold Trove", description: "Drops Double Gold on Defeat" }],
          attackEffects: [{ kind: "damage", damageType: "physical", amount: 7 }],
        },
      }),
    }));
    expect(mimic.goldEarned).toBeGreaterThan(normal.goldEarned);
    expect(mimic.eliteBonus).toBeGreaterThan(normal.eliteBonus);
    expect(mimic.goldEarned).toBeCloseTo(normal.goldEarned * 2, -1);
  });

  it("applies boss gold bonus and trinket reward for boss enemies", () => {
    const result = computeVictoryRewards(baseInput({
      battleState: baseBattleState({ currentEnemy: { id: "dragon", enemyType: "boss" } }),
    }));
    expect(result.bossBonus).toBeGreaterThan(0);
    expect(result.rewardState.rewardType).toBe("trinket");
  });

  it("applies generous labyrinth modifier gold bonus", () => {
    const result = computeVictoryRewards(baseInput({
      contentSystemType: "labyrinth",
      activeLabyrinthRewardModifiers: ["generous"],
    }));
    expect(result.generousBonus).toBeGreaterThan(0);
  });

  it("applies labyrinth scavenger reward modifier to materials", () => {
    const result = computeVictoryRewards(baseInput({
      contentSystemType: "labyrinth",
      activeLabyrinthRewardModifiers: ["scavenger"],
    }));
    expect(result.materials.wood).toBeGreaterThanOrEqual(1);
  });

  it("applies labyrinth collector modifier forcing trinket reward", () => {
    const result = computeVictoryRewards(baseInput({
      contentSystemType: "labyrinth",
      activeLabyrinthRewardModifiers: ["collector"],
      battleState: baseBattleState({ currentEnemy: { id: "goblin", enemyType: "normal" } }),
    }));
    expect(result.rewardState.rewardType).toBe("trinket");
  });

  it("applies companion gold find when talent is active and companion present", () => {
    const withoutTalent = computeVictoryRewards(baseInput({
      battleState: baseBattleState({ activeCompanion: { id: "wolf", title: "Wolf", health: 5, maxHealth: 5, shield: 0, statuses: [], damage: 3, damageType: "physical", abilities: [] } }),
    }), () => 0.01);
    const withTalent = computeVictoryRewards(baseInput({
      unlockedTalents: { companion: ["companion-gold-find"] },
      battleState: baseBattleState({ activeCompanion: { id: "wolf", title: "Wolf", health: 5, maxHealth: 5, shield: 0, statuses: [], damage: 3, damageType: "physical", abilities: [] } }),
    }), () => 0.01);
    expect(withTalent.goldEarned).toBeGreaterThan(withoutTalent.goldEarned);
  });

  it("applies max health talent", () => {
    const result = computeVictoryRewards(baseInput({
      unlockedTalents: { health: ["health-max-per-combat"] },
    }));
    expect(result.maxHealthDelta).toBe(1);
  });

  it("computes destinations via getAvailableDestinations", () => {
    const getAvailableDestinations = vi.fn(() => ["Normal Combat", "Campfire", "Mystery"] as Destination[]);
    const result = computeVictoryRewards(baseInput({ getAvailableDestinations }));
    expect(getAvailableDestinations).toHaveBeenCalled();
    expect(result.destinations.length).toBeGreaterThan(0);
  });
});

describe("commitVictoryRewards", () => {
  function victoryResult(overrides: Record<string, unknown> = {}) {
    return {
      newGold: 25,
      goldEarned: 20,
      rewardState: createEmptyRewardState(),
      labyrinthRewardModifiers: [],
      destinations: ["Normal Combat"] as Destination[],
      materials: emptyInventory(),
      playerHealth: 30,
      maxHealthDelta: 0,
      baseGold: 10,
      eliteBonus: 0,
      bossBonus: 0,
      generousBonus: 0,
      ...overrides,
    };
  }

  function commitDeps(overrides: Record<string, unknown> = {}) {
    return {
      battleState: baseBattleState({ gold: 5, pendingMaterials: emptyInventory() }),
      addHomesteadMaterials: vi.fn(),
      addRunGold: vi.fn(),
      setRunPlayerHealth: vi.fn(),
      setRunMaxHealth: vi.fn(),
      setRewardState: vi.fn(),
      setCompanionRewardCards: vi.fn(),
      clearCombatState: vi.fn(),
      ...overrides,
    };
  }

  it("plays gold gain when post-reward gold exceeds battle gold", () => {
    vi.mocked(playGoldGain).mockClear();
    commitVictoryRewards(victoryResult(), commitDeps());
    expect(playGoldGain).toHaveBeenCalled();
  });

  it("does not play gold gain when gold did not increase", () => {
    vi.mocked(playGoldGain).mockClear();
    commitVictoryRewards(victoryResult({ newGold: 5, goldEarned: 0 }), commitDeps());
    expect(playGoldGain).not.toHaveBeenCalled();
  });

  it("adds pending crystal materials to homestead", () => {
    const addHomesteadMaterials = vi.fn();
    const materials = { ...emptyInventory(), crystal: 2 };
    commitVictoryRewards(victoryResult(), commitDeps({
      battleState: baseBattleState({ pendingMaterials: materials }),
      addHomesteadMaterials,
    }));
    expect(addHomesteadMaterials).toHaveBeenCalledWith(materials);
  });
});
