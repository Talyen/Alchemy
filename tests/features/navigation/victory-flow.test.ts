import { afterEach, describe, expect, it, vi } from "vitest";
import {
  computeVictoryRewardState,
  withSelectedBossForDestinations,
  createDestinationRewardState,
  computeVictoryRewards,
  commitVictoryRewards,
  type VictoryRewardsInput,
} from "@/features/alchemy/run-loop/navigation/victory-flow";
import { createEmptyRewardState } from "@/features/alchemy/run-loop/navigation/reward-flow";
import { emptyInventory } from "@/lib/homestead/inventory";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";
import { playGoldGain } from "@/lib/audio";
import type { Destination } from "@/features/alchemy/shared/types";

vi.mock("@/lib/utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/utils")>("@/lib/utils");
  return { ...actual, randomInt: vi.fn(() => 15) };
});

vi.mock("@/features/alchemy/run-loop/navigation/destination-flow", () => ({
  sampleDestinationChoices: vi.fn((dests: Destination[]) => ({
    choices: dests.slice(0, 3),
    offerState: { lastOfferedDestinations: dests.slice(0, 3), roundsSinceOffered: {} },
  })),
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
    homesteadEffects: { ...defaultHomesteadEffects },
    getAvailableDestinations: vi.fn(() => ["Normal Combat", "Campfire", "Mystery"] as Destination[]),
    bossEnemyId: "mimic",
    destinationOfferState: { lastOfferedDestinations: [], roundsSinceOffered: {} },
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
    expect(result.selectedBossId).toBe("mimic");
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
    expect(result.selectedBossId).toBe("mimic");
    expect(result.destinations).toEqual(["Boss Combat"]);
  });
});

describe("computeVictoryRewardState", () => {
  it("creates a gear boss reward for boss enemies", () => {
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
    }, () => 0.99);
    expect(result.rewardType).toBe("gear");
    expect(result.gold).toBe(25);
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
    }, () => 0.99);
    expect(result.rewardType).toBe("card");
    expect(result.destinations).toEqual(["Normal Combat", "Campfire"]);
    expect(result.gold).toBe(15);
  });

  it("always awards card rewards for normal enemies", () => {
    const result = computeVictoryRewardState({
      characterId: "knight",
      selectedDifficulty: null,
      unlockedTalents: {},
      runDeck: [],
      runTrinkets: [],
      contentSystemType: "labyrinth",
      activeLabyrinthRewardModifiers: [],
      battleState: baseBattleState({ currentEnemy: { id: "goblin", enemyType: "normal" } }),
      gold: 15,
      eliteBonus: 0,
      generousBonus: 0,
      bossBonus: 0,
      materials: emptyInventory(),
      destinations: ["Normal Combat"],
    }, () => 0.99);
    expect(result.rewardType).toBe("card");
  });

  it("always awards trinket rewards for elite enemies", () => {
    const result = computeVictoryRewardState({
      characterId: "knight",
      selectedDifficulty: null,
      unlockedTalents: {},
      runDeck: [],
      runTrinkets: [],
      contentSystemType: "campaign",
      activeLabyrinthRewardModifiers: [],
      battleState: baseBattleState({ currentEnemy: { id: "goblin-chief", enemyType: "elite" } }),
      gold: 15,
      eliteBonus: 4,
      generousBonus: 0,
      bossBonus: 0,
      materials: emptyInventory(),
      destinations: ["Normal Combat"],
    }, () => 0.01);
    expect(result.rewardType).toBe("trinket");
  });

  it("always awards gear rewards for boss enemies", () => {
    const input = {
      characterId: "knight" as const, selectedDifficulty: null, unlockedTalents: {}, runDeck: [], runTrinkets: [], contentSystemType: "campaign" as const,
      activeLabyrinthRewardModifiers: [], battleState: baseBattleState({ currentEnemy: { id: "dragon", enemyType: "boss" } }),
      gold: 15, eliteBonus: 0, generousBonus: 0, bossBonus: 7, materials: emptyInventory(), destinations: [],
    };
    const gearReward = computeVictoryRewardState(input, () => 0.99);
    expect(gearReward.rewardType).toBe("gear");
    expect(gearReward.choices.every((choice) => "instanceId" in choice)).toBe(true);
    expect(gearReward.choices.every((choice) => "affixes" in choice)).toBe(true);
  });
});

describe("computeVictoryRewards", () => {
  it("awards no gold or materials for Wildwood Draft victories", () => {
    const result = computeVictoryRewards(
      baseInput({ contentSystemType: "wildwood", runGold: 7 }),
      () => 0.25,
    );

    expect(result.newGold).toBe(7);
    expect(result.goldEarned).toBe(0);
    expect(result.materials).toEqual(emptyInventory());
    expect(result.rewardState.gold).toBe(0);
    expect(result.rewardState.choices).toHaveLength(3);
  });

  it("computes combat victory rewards for normal enemy", () => {
    const result = computeVictoryRewards(baseInput());
    expect(result.goldEarned).toBe(15);
    expect(result.rewardState.rewardType).toBe("card");
    expect(result.playerHealth).toBe(30);
    expect(result.maxHealthDelta).toBe(0);
    expect(result.bossBonus).toBe(0);
    expect(result.eliteBonus).toBe(0);
  });

  it("applies elite gold bonus for elite enemies", () => {
    const result = computeVictoryRewards(baseInput({
      battleState: baseBattleState({ currentEnemy: { id: "goblin-chief", enemyType: "elite" } }),
    }), () => 0.99);
    expect(result.eliteBonus).toBe(4);
    expect(result.goldEarned).toBe(19);
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

  it("applies boss gold bonus and a boss reward for boss enemies", () => {
    const result = computeVictoryRewards(baseInput({
      battleState: baseBattleState({ currentEnemy: { id: "dragon", enemyType: "boss" } }),
    }));
    expect(result.bossBonus).toBe(7);
    expect(result.goldEarned).toBe(22);
    expect(result.rewardState.rewardType).toBe("gear");
  });

  it("applies generous labyrinth modifier gold bonus", () => {
    const result = computeVictoryRewards(baseInput({
      contentSystemType: "labyrinth",
      activeLabyrinthRewardModifiers: ["generous"],
    }));
    expect(result.generousBonus).toBe(7);
    expect(result.goldEarned).toBe(22);
  });

  it("applies labyrinth scavenger reward modifier to materials", () => {
    const result = computeVictoryRewards(baseInput({
      contentSystemType: "labyrinth",
      activeLabyrinthRewardModifiers: ["scavenger"],
    }));
    expect(result.materials.wood).toBeGreaterThanOrEqual(1);
  });

  it("awards trinket rewards for elite combat victories", () => {
    const result = computeVictoryRewards(baseInput({
      contentSystemType: "labyrinth",
      battleState: baseBattleState({ currentEnemy: { id: "goblin-chief", enemyType: "elite" } }),
    }), () => 0.99);
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
    expect(getAvailableDestinations).toHaveBeenCalledWith({
      currentHealth: 30,
      currentGold: result.newGold,
      destinationIndexInAct: 2,
      maxHealth: 30,
    });
    expect(result.destinations).toEqual(["Normal Combat", "Campfire", "Mystery"]);
    expect(result.newGold).toBeGreaterThan(5);
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
      destinationOfferState: { lastOfferedDestinations: [], roundsSinceOffered: {} },
      ...overrides,
    };
  }

  function commitDeps(overrides: Record<string, unknown> = {}) {
    return {
      battleState: baseBattleState({ gold: 5, pendingMaterials: emptyInventory() }),
      contentSystemType: "campaign" as const,
      addHomesteadMaterials: vi.fn(),
      addRunGold: vi.fn(),
      setRunMaxHealth: vi.fn(),
      setRewardState: vi.fn(),
      setCompanionRewardCards: vi.fn(),
      setDestinationOfferState: vi.fn(),
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

  it("stamps victory routing context onto reward state", () => {
    const setRewardState = vi.fn();
    const battleState = baseBattleState({
      currentEnemy: { id: "boss", enemyType: "boss" },
      pendingMaterials: emptyInventory(),
    });
    commitVictoryRewards(victoryResult(), commitDeps({
      battleState,
      contentSystemType: "labyrinth",
      setRewardState,
    }));
    expect(setRewardState).toHaveBeenCalledWith(
      expect.objectContaining({
        lastVictoryEnemyType: "boss",
        lastVictoryContentSystem: "labyrinth",
      }),
    );
  });
});
