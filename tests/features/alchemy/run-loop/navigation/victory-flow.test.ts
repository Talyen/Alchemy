import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeVictoryRewardState,
  computeVictoryRewards,
  type VictoryRewardsInput,
  type VictoryRewardsResult,
} from "@/features/alchemy/run-loop/navigation/victory-flow";
import { commitVictoryRewards, type CommitVictoryRewardsDeps } from "@/features/alchemy/run-loop/run/run-flow-victory";
import { createEmptyRewardState } from "@/lib/active-run-session";
import { emptyInventory } from "@/lib/homestead/inventory";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";
import type { Destination } from "@/lib/routing";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { resetRunDomainStore } from "../../../../helpers/gameplay-store-test";
import { setRunProgress } from "../../../../helpers/run-domain-store-test";

beforeEach(() => resetRunDomainStore());

vi.mock("@/features/alchemy/shared/run-flow/destination-flow", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/alchemy/shared/run-flow/destination-flow")>();
  return {
    ...actual,
    sampleDestinationChoices: vi.fn((dests: Destination[]) => ({
      choices: dests.slice(0, 3),
      offerState: { lastOfferedDestinations: dests.slice(0, 3), roundsSinceOffered: {} },
    })),
  };
});

vi.mock("@/lib/homestead/loot", () => ({
  getEnemyMaterialLoot: vi.fn(() => ({ wood: 1, iron: 0, herbs: 0, food: 0, crystal: 0 })),
  applyMaterialFindBonus: vi.fn((mats: unknown) => mats),
}));

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

// Base gold roll is inline in rollVictoryGold: floor(rng() * 21 + 10) over [10, 30].
// 0.25 yields the deterministic 15 base gold the gold assertions below rely on.
const testRng = () => 0.25;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("computeVictoryRewardState", () => {
  it("creates a gear boss reward for boss enemies", () => {
    const result = computeVictoryRewardState(
      {
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
      },
      () => 0.25,
    );
    expect(result.rewardType).toBe("gear");
    expect(result.gold).toBe(25);
  });

  it("creates combat reward state for normal enemies", () => {
    const result = computeVictoryRewardState(
      {
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
      },
      () => 0.25,
    );
    expect(result.rewardType).toBe("card");
    expect(result.destinations).toEqual(["Normal Combat", "Campfire"]);
    expect(result.gold).toBe(15);
  });

  it("always awards card rewards for normal enemies", () => {
    const result = computeVictoryRewardState(
      {
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
      },
      () => 0.25,
    );
    expect(result.rewardType).toBe("card");
  });

  it("always awards trinket rewards for elite enemies", () => {
    const result = computeVictoryRewardState(
      {
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
      },
      () => 0.01,
    );
    expect(result.rewardType).toBe("trinket");
  });

  it("always awards gear rewards for boss enemies", () => {
    const input = {
      characterId: "knight" as const,
      selectedDifficulty: null,
      unlockedTalents: {},
      runDeck: [],
      runTrinkets: [],
      contentSystemType: "campaign" as const,
      activeLabyrinthRewardModifiers: [],
      battleState: baseBattleState({ currentEnemy: { id: "dragon", enemyType: "boss" } }),
      gold: 15,
      eliteBonus: 0,
      generousBonus: 0,
      bossBonus: 7,
      materials: emptyInventory(),
      destinations: [],
    };
    const gearReward = computeVictoryRewardState(input, () => 0.25);
    expect(gearReward.rewardType).toBe("gear");
    expect(gearReward.choices.every((choice) => "instanceId" in choice)).toBe(true);
    expect(gearReward.choices.every((choice) => "affixes" in choice)).toBe(true);
  });
});

describe("computeVictoryRewards", () => {
  it("awards no gold or materials for Wildwood Draft victories", () => {
    const result = computeVictoryRewards(baseInput({ contentSystemType: "wildwood", runGold: 7 }), () => 0.25);

    expect(result.newGold).toBe(7);
    expect(result.goldEarned).toBe(0);
    expect(result.materials).toEqual(emptyInventory());
    expect(result.rewardState.gold).toBe(0);
    expect(result.rewardState.choices).toHaveLength(3);
  });

  it("persists in-combat gold for Wildwood victories without a victory gold roll", () => {
    const result = computeVictoryRewards(
      baseInput({
        contentSystemType: "wildwood",
        runGold: 10,
        battleState: baseBattleState({ gold: 15 }),
      }),
      () => 0.25,
    );

    expect(result.goldEarned).toBe(5);
    expect(result.newGold).toBe(15);
    expect(result.baseGold).toBe(0);
    expect(result.materials).toEqual(emptyInventory());
  });

  it("computes combat victory rewards for normal enemy", () => {
    const result = computeVictoryRewards(baseInput(), testRng);
    expect(result.goldEarned).toBe(15);
    expect(result.rewardState.rewardType).toBe("card");
    expect(result.playerHealth).toBe(30);
    expect(result.maxHealthDelta).toBe(0);
    expect(result.bossBonus).toBe(0);
    expect(result.eliteBonus).toBe(0);
  });

  it("applies elite gold bonus for elite enemies", () => {
    const result = computeVictoryRewards(
      baseInput({
        battleState: baseBattleState({ currentEnemy: { id: "goblin-chief", enemyType: "elite" } }),
      }),
      () => 0.25,
    );
    expect(result.eliteBonus).toBe(4);
    expect(result.goldEarned).toBe(19);
  });

  it("doubles gold reward when enemy has gold-trove trait", () => {
    const normal = computeVictoryRewards(
      baseInput({
        battleState: baseBattleState({ currentEnemy: { id: "goblin-chief", enemyType: "elite" } }),
      }),
      testRng,
    );
    const mimic = computeVictoryRewards(
      baseInput({
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
      }),
      testRng,
    );
    expect(mimic.goldEarned).toBeGreaterThan(normal.goldEarned);
    expect(mimic.eliteBonus).toBeGreaterThan(normal.eliteBonus);
    expect(mimic.goldEarned).toBeCloseTo(normal.goldEarned * 2, -1);
  });

  it("applies boss gold bonus and a boss reward for boss enemies", () => {
    const result = computeVictoryRewards(
      baseInput({
        battleState: baseBattleState({ currentEnemy: { id: "dragon", enemyType: "boss" } }),
      }),
      testRng,
    );
    expect(result.bossBonus).toBe(7);
    expect(result.goldEarned).toBe(22);
    expect(result.rewardState.rewardType).toBe("gear");
  });

  it("applies generous labyrinth modifier gold bonus", () => {
    const result = computeVictoryRewards(
      baseInput({
        contentSystemType: "labyrinth",
        activeLabyrinthRewardModifiers: ["generous"],
      }),
      testRng,
    );
    expect(result.generousBonus).toBe(7);
    expect(result.goldEarned).toBe(22);
  });

  it("applies labyrinth scavenger reward modifier to materials", () => {
    const result = computeVictoryRewards(
      baseInput({
        contentSystemType: "labyrinth",
        activeLabyrinthRewardModifiers: ["scavenger"],
      }),
      testRng,
    );
    expect(result.materials.wood).toBeGreaterThanOrEqual(1);
  });

  it("awards trinket rewards for elite combat victories", () => {
    const result = computeVictoryRewards(
      baseInput({
        contentSystemType: "labyrinth",
        battleState: baseBattleState({ currentEnemy: { id: "goblin-chief", enemyType: "elite" } }),
      }),
      () => 0.25,
    );
    expect(result.rewardState.rewardType).toBe("trinket");
  });

  it("applies companion gold find when talent is active and companion present", () => {
    const withoutTalent = computeVictoryRewards(
      baseInput({
        battleState: baseBattleState({
          activeCompanion: {
            id: "wolf",
            title: "Wolf",
            health: 5,
            maxHealth: 5,
            shield: 0,
            statuses: [],
            damage: 3,
            damageType: "physical",
            abilities: [],
          },
        }),
      }),
      () => 0.01,
    );
    const withTalent = computeVictoryRewards(
      baseInput({
        unlockedTalents: { companion: ["companion-gold-find"] },
        battleState: baseBattleState({
          activeCompanion: {
            id: "wolf",
            title: "Wolf",
            health: 5,
            maxHealth: 5,
            shield: 0,
            statuses: [],
            damage: 3,
            damageType: "physical",
            abilities: [],
          },
        }),
      }),
      () => 0.01,
    );
    expect(withTalent.goldEarned).toBeGreaterThan(withoutTalent.goldEarned);
  });

  it("applies max health talent", () => {
    const result = computeVictoryRewards(
      baseInput({
        unlockedTalents: { health: ["health-max-per-combat"] },
      }),
      testRng,
    );
    expect(result.maxHealthDelta).toBe(1);
  });

  it("computes destinations via getAvailableDestinations", () => {
    const getAvailableDestinations = vi.fn(() => ["Normal Combat", "Campfire", "Mystery"] as Destination[]);
    const result = computeVictoryRewards(baseInput({ getAvailableDestinations }), testRng);
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
  function victoryResult(overrides: Partial<VictoryRewardsResult> = {}): VictoryRewardsResult {
    return {
      newGold: 25,
      goldEarned: 20,
      rewardState: createEmptyRewardState(),
      labyrinthRewardModifiers: [],
      destinations: ["Normal Combat"],
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

  function commitDeps(overrides: Partial<CommitVictoryRewardsDeps> = {}): CommitVictoryRewardsDeps {
    return {
      battleState: baseBattleState({ gold: 5, pendingMaterials: emptyInventory() }),
      contentSystemType: "campaign",
      ...overrides,
    };
  }

  function commit(result: VictoryRewardsResult = victoryResult(), deps = commitDeps()) {
    return dispatchRunSessionCommand((draft) => commitVictoryRewards(draft, result, deps, testRng));
  }

  it("reports gold gain when gold was earned", () => {
    expect(commit()).toBe(true);
  });

  it("reports no gold gain when gold did not increase", () => {
    expect(commit(victoryResult({ newGold: 5, goldEarned: 0 }))).toBe(false);
  });

  it("reports gold gain when earned gold matches battle gold", () => {
    expect(
      commit(
        victoryResult({ newGold: 15, goldEarned: 5 }),
        commitDeps({ battleState: baseBattleState({ gold: 15, pendingMaterials: emptyInventory() }) }),
      ),
    ).toBe(true);
  });

  it("adds pending crystal materials to homestead", () => {
    const materials = { ...emptyInventory(), crystal: 2 };
    commit(
      victoryResult(),
      commitDeps({
        battleState: baseBattleState({ pendingMaterials: materials }),
      }),
    );
    expect(readGameplayState().runProfile.materialInventory.crystal).toBe(2);
  });

  it("does not award pending crystal materials for wildwood victories", () => {
    const materials = { ...emptyInventory(), crystal: 2 };
    commit(
      victoryResult(),
      commitDeps({
        battleState: baseBattleState({ pendingMaterials: materials }),
        contentSystemType: "wildwood",
      }),
    );
    // The wish engine never generates crystal in wildwood (it grants gold
    // instead); the commit guard also refuses to award materials.
    expect(readGameplayState().runProfile.materialInventory.crystal).toBe(0);
  });

  it("persists in-combat gold into runGold for wildwood victories", () => {
    setRunProgress({ runGold: 10 });
    const battleState = baseBattleState({ gold: 15, pendingMaterials: emptyInventory() });
    const result = computeVictoryRewards(
      baseInput({ contentSystemType: "wildwood", runGold: 10, battleState }),
      testRng,
    );
    const goldGained = commit(result, commitDeps({ battleState, contentSystemType: "wildwood" }));
    expect(readGameplayState().runProfile.gold).toBe(15);
    expect(goldGained).toBe(true);
  });

  it("stamps victory routing context onto reward state", () => {
    const battleState = baseBattleState({
      currentEnemy: { id: "boss", enemyType: "boss" },
      pendingMaterials: emptyInventory(),
    });
    commit(
      victoryResult(),
      commitDeps({
        battleState,
        contentSystemType: "labyrinth",
      }),
    );
    expect(readGameplayState().session.rewardState).toMatchObject({
      lastVictoryEnemyType: "boss",
      lastVictoryContentSystem: "labyrinth",
    });
  });
});
