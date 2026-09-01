import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeVictoryRewardState,
  computeVictoryRewards,
  type VictoryRewardsInput,
  type VictoryRewardsResult,
} from "@/features/alchemy/run-loop/navigation/victory-flow";
import { commitVictoryRewards, type CommitVictoryRewardsDeps } from "@/features/alchemy/run-loop/run/run-flow-victory";
import { computeVictoryGold } from "@/features/alchemy/run-loop/navigation/reward-flow";
import { createEmptyRewardState } from "@/lib/active-run-session";
import { emptyInventory } from "@/lib/homestead/inventory";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";
import { LABYRINTH_REWARD_CONFIG } from "@/lib/game-constants";
import { trinketLibrary } from "@/lib/game-data";
import { gearDefinitions, uniqueItemList } from "@/lib/gear";
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
  getEnemyMaterialLoot: vi.fn(() => ({ wood: 1, iron: 0, herbs: 0, food: 0, gems: 0 })),
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
    runBoons: [],
    contentSystemType: "campaign",
    activeLabyrinthRewardModifiers: [],
    battleState: baseBattleState(),
    purseGold: 5,
    runMaxHealth: 30,
    destinationIndexInAct: 2,
    homesteadEffects: { ...defaultHomesteadEffects },
    getAvailableDestinations: vi.fn(() => ["Normal Combat", "Campfire", "Mystery"] as Destination[]),
    bossEnemyId: "mimic",
    destinationOfferState: { lastOfferedDestinations: [], roundsSinceOffered: {} },
    ...overrides,
  };
}

const testRng = () => 0.25;

describe("computeVictoryRewardState", () => {
  it("rolls a permanent trinket instead of gear one third of the time", () => {
    const result = computeVictoryRewardState(
      {
        characterId: "knight",
        selectedDifficulty: null,
        unlockedTalents: {},
        runDeck: [],
        runBoons: [],
        contentSystemType: "campaign",
        activeLabyrinthRewardModifiers: [],
        battleState: baseBattleState({ currentEnemy: { id: "dragon", enemyType: "boss" } }),
        gold: 15,
        eliteBonus: 0,
        generousBonus: 0,
        wealthyBonus: 0,
        bossBonus: 10,
        materials: emptyInventory(),
        destinations: [],
      },
      () => 0.25,
    );
    expect(result.rewardType).toBe("trinket");
    expect(result.gold).toBe(25);
  });

  it("creates combat reward state for normal enemies", () => {
    const result = computeVictoryRewardState(
      {
        characterId: "knight",
        selectedDifficulty: null,
        unlockedTalents: {},
        runDeck: [],
        runBoons: [],
        contentSystemType: "campaign",
        activeLabyrinthRewardModifiers: [],
        battleState: baseBattleState({ currentEnemy: { id: "goblin", enemyType: "normal" } }),
        gold: 15,
        eliteBonus: 0,
        generousBonus: 0,
        wealthyBonus: 0,
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
        runBoons: [],
        contentSystemType: "labyrinth",
        activeLabyrinthRewardModifiers: [],
        battleState: baseBattleState({ currentEnemy: { id: "goblin", enemyType: "normal" } }),
        gold: 15,
        eliteBonus: 0,
        generousBonus: 0,
        wealthyBonus: 0,
        bossBonus: 0,
        materials: emptyInventory(),
        destinations: ["Normal Combat"],
      },
      () => 0.25,
    );
    expect(result.rewardType).toBe("card");
  });

  it("always awards boon rewards for elite enemies", () => {
    const result = computeVictoryRewardState(
      {
        characterId: "knight",
        selectedDifficulty: null,
        unlockedTalents: {},
        runDeck: [],
        runBoons: [],
        contentSystemType: "campaign",
        activeLabyrinthRewardModifiers: [],
        battleState: baseBattleState({ currentEnemy: { id: "goblin-chief", enemyType: "elite" } }),
        gold: 15,
        eliteBonus: 4,
        generousBonus: 0,
        wealthyBonus: 0,
        bossBonus: 0,
        materials: emptyInventory(),
        destinations: ["Normal Combat"],
      },
      () => 0.01,
    );
    expect(result.rewardType).toBe("boon");
  });

  it("awards gear for a boss when the permanent trinket roll misses", () => {
    const input = {
      characterId: "knight" as const,
      selectedDifficulty: null,
      unlockedTalents: {},
      runDeck: [],
      runBoons: [],
      contentSystemType: "campaign" as const,
      activeLabyrinthRewardModifiers: [],
      battleState: baseBattleState({ currentEnemy: { id: "dragon", enemyType: "boss" } }),
      gold: 15,
      eliteBonus: 0,
      generousBonus: 0,
      wealthyBonus: 0,
      bossBonus: 7,
      materials: emptyInventory(),
      destinations: [],
    };
    const gearReward = computeVictoryRewardState(input, () => 0.5);
    expect(gearReward.rewardType).toBe("gear");
    expect(gearReward.choices.every((choice) => "instanceId" in choice)).toBe(true);
    expect(gearReward.choices.every((choice) => "affixes" in choice)).toBe(true);
  });

  it("filters owned permanent trinkets and reduces the choice count", () => {
    const unowned = trinketLibrary.slice(-2);
    const result = computeVictoryRewardState(
      {
        characterId: "knight",
        selectedDifficulty: null,
        unlockedTalents: {},
        runDeck: [],
        runBoons: [],
        ownedTrinketIds: trinketLibrary.slice(0, -2).map((entry) => entry.id),
        contentSystemType: "campaign",
        activeLabyrinthRewardModifiers: [],
        battleState: baseBattleState({ currentEnemy: { id: "dragon", enemyType: "boss" } }),
        gold: 15,
        eliteBonus: 0,
        generousBonus: 0,
        wealthyBonus: 0,
        bossBonus: 7,
        materials: emptyInventory(),
        destinations: [],
      },
      () => 0,
    );

    expect(result.rewardType).toBe("trinket");
    if (result.rewardType !== "trinket") throw new Error("expected permanent trinket reward");
    expect(result.choices.map((choice) => choice.id).sort()).toEqual(unowned.map((entry) => entry.id).sort());
  });

  it("falls back to gear when every permanent trinket is owned", () => {
    const result = computeVictoryRewardState(
      {
        characterId: "knight",
        selectedDifficulty: null,
        unlockedTalents: {},
        runDeck: [],
        runBoons: [],
        ownedTrinketIds: trinketLibrary.map((entry) => entry.id),
        contentSystemType: "campaign",
        activeLabyrinthRewardModifiers: [],
        battleState: baseBattleState({ currentEnemy: { id: "dragon", enemyType: "boss" } }),
        gold: 15,
        eliteBonus: 0,
        generousBonus: 0,
        wealthyBonus: 0,
        bossBonus: 7,
        materials: emptyInventory(),
        destinations: [],
      },
      () => 0,
    );

    expect(result.rewardType).toBe("gear");
  });

  it("excludes owned uniques from campaign boss gear rewards", () => {
    const ownedUniqueIds = new Set(uniqueItemList.map((unique) => unique.id));
    const result = computeVictoryRewardState(
      {
        characterId: "knight",
        selectedDifficulty: null,
        unlockedTalents: {},
        runDeck: [],
        runBoons: [],
        ownedTrinketIds: trinketLibrary.map((entry) => entry.id),
        ownedUniqueIds,
        contentSystemType: "campaign",
        activeLabyrinthRewardModifiers: [],
        battleState: baseBattleState({ currentEnemy: { id: "dragon", enemyType: "boss" } }),
        gold: 15,
        eliteBonus: 0,
        generousBonus: 0,
        wealthyBonus: 0,
        bossBonus: 7,
        materials: emptyInventory(),
        destinations: [],
      },
      () => 0,
    );

    expect(result.rewardType).toBe("gear");
    if (result.rewardType !== "gear") throw new Error("expected gear reward");
    expect(result.choices).toHaveLength(3);
    for (const choice of result.choices) {
      expect(ownedUniqueIds.has(choice.definitionId)).toBe(false);
      expect(gearDefinitions[choice.definitionId]?.rarity).toBe("astral");
    }
  });
});

describe("computeVictoryRewards", () => {
  it("passes owned uniques through campaign boss victory rewards", () => {
    const ownedUniqueIds = new Set(uniqueItemList.map((unique) => unique.id));
    const result = computeVictoryRewards(
      baseInput({
        ownedTrinketIds: trinketLibrary.map((entry) => entry.id),
        ownedUniqueIds,
        battleState: baseBattleState({ currentEnemy: { id: "dragon", enemyType: "boss" } }),
      }),
      () => 0,
    );

    expect(result.rewardState.rewardType).toBe("gear");
    if (result.rewardState.rewardType !== "gear") throw new Error("expected gear reward");
    for (const choice of result.rewardState.choices) {
      expect(ownedUniqueIds.has(choice.definitionId)).toBe(false);
      expect(gearDefinitions[choice.definitionId]?.rarity).toBe("astral");
    }
  });

  it("awards no gold or materials for Wildwood Draft victories", () => {
    const result = computeVictoryRewards(baseInput({ contentSystemType: "wildwood", purseGold: 7 }), () => 0.25);

    expect(result.goldEarned).toBe(0);
    expect(result.persistedGold).toBe(7);
    expect(result.rewardState.materials).toEqual(emptyInventory());
    expect(result.rewardState.gold).toBe(0);
    expect(result.rewardState.choices).toHaveLength(3);
  });

  it("persists in-combat gold for Wildwood victories without a victory gold roll", () => {
    const result = computeVictoryRewards(
      baseInput({
        contentSystemType: "wildwood",
        purseGold: 10,
        battleState: baseBattleState({ gold: 15 }),
      }),
      () => 0.25,
    );

    expect(result.goldEarned).toBe(5);
    expect(result.persistedGold).toBe(15);
    expect(result.rewardState.materials).toEqual(emptyInventory());
  });

  it("does not shrink the purse when Wildwood combat gold is below the purse", () => {
    const result = computeVictoryRewards(
      baseInput({
        contentSystemType: "wildwood",
        purseGold: 10,
        battleState: baseBattleState({ gold: 4 }),
      }),
      () => 0.25,
    );

    expect(result.goldEarned).toBe(0);
    expect(result.persistedGold).toBe(10);
  });

  it("computes combat victory rewards for normal enemy", () => {
    const result = computeVictoryRewards(baseInput(), testRng);
    expect(result.goldEarned).toBe(15);
    expect(result.persistedGold).toBe(20);
    expect(result.rewardState.rewardType).toBe("card");
    expect(result.playerHealth).toBe(30);
    expect(result.maxHealthDelta).toBe(0);
  });

  it("applies elite gold bonus for elite enemies", () => {
    const result = computeVictoryRewards(
      baseInput({
        battleState: baseBattleState({ currentEnemy: { id: "goblin-chief", enemyType: "elite" } }),
      }),
      () => 0.25,
    );

    expect(result.goldEarned).toBe(20);
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
    expect(mimic.goldEarned).toBeCloseTo(normal.goldEarned * 2, -1);
  });

  it("applies boss gold bonus and a boss reward for boss enemies", () => {
    const result = computeVictoryRewards(
      baseInput({
        battleState: baseBattleState({ currentEnemy: { id: "dragon", enemyType: "boss" } }),
      }),
      testRng,
    );

    expect(result.goldEarned).toBe(23);
    expect(result.rewardState.rewardType).toBe("trinket");
  });

  it("applies generous labyrinth modifier gold bonus", () => {
    const result = computeVictoryRewards(
      baseInput({
        contentSystemType: "labyrinth",
        activeLabyrinthRewardModifiers: ["generous"],
      }),
      testRng,
    );

    expect(result.goldEarned).toBe(23);
  });

  it("applies wealthy labyrinth modifier gold bonus", () => {
    const result = computeVictoryRewards(
      baseInput({
        contentSystemType: "labyrinth",
        activeLabyrinthRewardModifiers: ["wealthy"],
      }),
      testRng,
    );
    expect(result.goldEarned).toBe(15 + LABYRINTH_REWARD_CONFIG.wealthyGoldBonus);
    expect(result.rewardState.gold).toBe(15 + LABYRINTH_REWARD_CONFIG.wealthyGoldBonus);
  });

  it("applies labyrinth scavenger reward modifier to materials", () => {
    const result = computeVictoryRewards(
      baseInput({
        contentSystemType: "labyrinth",
        activeLabyrinthRewardModifiers: ["scavenger"],
      }),
      testRng,
    );
    expect(result.rewardState.materials.wood).toBeGreaterThanOrEqual(1);
  });

  it("applies herbalist labyrinth modifier herb bonus", () => {
    const result = computeVictoryRewards(
      baseInput({
        contentSystemType: "labyrinth",
        activeLabyrinthRewardModifiers: ["herbalist"],
      }),
      testRng,
    );
    expect(result.rewardState.materials.herbs).toBe(LABYRINTH_REWARD_CONFIG.herbalistHerbBonus);
  });

  it("adds herbalist herbs after scavenger doubling in victory rewards", () => {
    const result = computeVictoryRewards(
      baseInput({
        contentSystemType: "labyrinth",
        activeLabyrinthRewardModifiers: ["scavenger", "herbalist"],
      }),
      testRng,
    );
    expect(result.rewardState.materials.wood).toBe(2);
    expect(result.rewardState.materials.herbs).toBe(LABYRINTH_REWARD_CONFIG.herbalistHerbBonus);
  });

  it("heals with well-provisioned after victory", () => {
    const result = computeVictoryRewards(
      baseInput({
        contentSystemType: "labyrinth",
        activeLabyrinthRewardModifiers: ["wellProvisioned"],
        runMaxHealth: 100,
        battleState: baseBattleState({ playerHealth: 20 }),
      }),
      testRng,
    );
    expect(result.playerHealth).toBe(20 + Math.round(100 * LABYRINTH_REWARD_CONFIG.wellProvisionedHealFraction));
  });

  it("caps well-provisioned healing using max health plus talent delta", () => {
    const result = computeVictoryRewards(
      baseInput({
        contentSystemType: "labyrinth",
        activeLabyrinthRewardModifiers: ["wellProvisioned"],
        unlockedTalents: { health: ["health-max-per-combat"] },
        runMaxHealth: 30,
        battleState: baseBattleState({ playerHealth: 30 }),
      }),
      testRng,
    );
    expect(result.maxHealthDelta).toBe(1);
    expect(result.playerHealth).toBe(31);
  });

  it("awards boon rewards for elite combat victories", () => {
    const result = computeVictoryRewards(
      baseInput({
        contentSystemType: "labyrinth",
        battleState: baseBattleState({ currentEnemy: { id: "goblin-chief", enemyType: "elite" } }),
      }),
      () => 0.25,
    );
    expect(result.rewardState.rewardType).toBe("boon");
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
      currentGold: 20,
      destinationIndexInAct: 2,
      maxHealth: 30,
    });
    expect(result.persistedGold).toBe(20);
    expect(result.rewardState.destinations).toEqual(["Normal Combat", "Campfire", "Mystery"]);
  });

  it("skips campaign destination sampling for labyrinth victories", () => {
    const getAvailableDestinations = vi.fn();
    const destinationOfferState = { lastOfferedDestinations: [], roundsSinceOffered: {} };
    const result = computeVictoryRewards(
      baseInput({ contentSystemType: "labyrinth", getAvailableDestinations, destinationOfferState }),
      testRng,
    );
    expect(getAvailableDestinations).not.toHaveBeenCalled();
    expect(result.rewardState.destinations).toEqual([]);
    expect(result.destinationOfferState).toEqual(destinationOfferState);
  });
});

describe("commitVictoryRewards", () => {
  function victoryResult(overrides: Partial<VictoryRewardsResult> = {}): VictoryRewardsResult {
    return {
      goldEarned: 20,
      persistedGold: 20,
      rewardState: createEmptyRewardState(),
      labyrinthRewardModifiers: [],
      playerHealth: 30,
      maxHealthDelta: 0,
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

  it("applies max health before writing healed player health", () => {
    setRunProgress({ runPlayerHealth: 30, runMaxHealth: 30 });
    commit(victoryResult({ playerHealth: 31, maxHealthDelta: 1 }));
    const run = readGameplayState().run.activeRun;
    expect(run.runMaxHealth).toBe(31);
    expect(run.runPlayerHealth).toBe(31);
  });

  it("reports gold gain when gold was earned", () => {
    expect(commit()).toBe(true);
  });

  it("reports no gold gain when gold did not increase", () => {
    expect(commit(victoryResult({ goldEarned: 0 }))).toBe(false);
  });

  it("reports gold gain when earned gold matches battle gold", () => {
    expect(
      commit(
        victoryResult({ goldEarned: 5 }),
        commitDeps({ battleState: baseBattleState({ gold: 15, pendingMaterials: emptyInventory() }) }),
      ),
    ).toBe(true);
  });

  it("adds pending gems materials to homestead", () => {
    const materials = { ...emptyInventory(), gems: 2 };
    commit(
      victoryResult(),
      commitDeps({
        battleState: baseBattleState({ pendingMaterials: materials }),
      }),
    );
    expect(readGameplayState().runProfile.materialInventory.gems).toBe(2);
  });

  it("does not award pending gems materials for wildwood victories", () => {
    const materials = { ...emptyInventory(), gems: 2 };
    commit(
      victoryResult(),
      commitDeps({
        battleState: baseBattleState({ pendingMaterials: materials }),
        contentSystemType: "wildwood",
      }),
    );

    expect(readGameplayState().runProfile.materialInventory.gems).toBe(0);
  });

  it("persists in-combat gold into the purse for wildwood victories", () => {
    setRunProgress({ gold: 10 });
    const battleState = baseBattleState({ gold: 15, pendingMaterials: emptyInventory() });
    const result = computeVictoryRewards(
      baseInput({ contentSystemType: "wildwood", purseGold: 10, battleState }),
      testRng,
    );
    const goldGained = commit(result, commitDeps({ battleState, contentSystemType: "wildwood" }));
    expect(readGameplayState().runProfile.gold).toBe(15);
    expect(goldGained).toBe(true);
  });

  it("writes persistedGold without re-applying the gold multiplier", () => {
    setRunProgress({ gold: 10 });
    const goldResult = computeVictoryGold({
      battleState: { gold: 10 },
      purseGold: 10,
      runBoons: [],
      gold: 15,
      eliteBonus: 0,
      generousBonus: 0,
      wealthyBonus: 0,
      bossBonus: 0,
      talentGoldPerCombat: 0,
      goldMultiplier: 2,
    });
    const goldGained = commit(
      victoryResult({
        goldEarned: goldResult.earnedBeforeMultiplier,
        persistedGold: goldResult.persistedGold,
      }),
    );
    expect(goldResult.persistedGold).toBe(40);
    expect(readGameplayState().runProfile.gold).toBe(goldResult.persistedGold);
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
