import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeVictoryRewardState,
  computeVictoryRewards,
  type VictoryRewardsInput,
  type VictoryRewardsResult,
} from "@/features/alchemy/run-loop/navigation/victory-flow";
import { computeVictoryGold } from "@/features/alchemy/run-loop/navigation/reward-math";
import { createEmptyRewardState } from "@/lib/active-run-session";
import { emptyInventory } from "@/lib/homestead/inventory";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";
import { LABYRINTH_REWARD_CONFIG } from "@/lib/game-constants";
import { trinketLibrary } from "@/lib/game-data";
import { gearDefinitions, uniqueItemList } from "@/lib/gear";
import { rollFreshBossId } from "@/features/alchemy/shared/config";
import { createRunRngState, stepRunRng } from "@/lib/rng";
import type { Destination } from "@/lib/routing";
import { getAvailableDestinations } from "@/lib/routing/destination-availability";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { resetRunDomainStore } from "../../../../helpers/run-domain-store-test";
import { setRunProgress } from "../../../../helpers/run-domain-store-test";
import { commitVictoryRewards, type CommitVictoryRewardsDeps } from "@/features/alchemy/run-loop/run/victory-commands";
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

vi.mock("@/lib/homestead/material-rewards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/homestead/material-rewards")>();
  return {
    ...actual,
    getEnemyMaterialLoot: vi.fn(() => ({ wood: 1, stone: 0, iron: 0, food: 0, herbs: 0, hide: 0, gems: 0 })),
    applyMaterialFindBonus: vi.fn((mats: unknown) => mats),
    // Fixed-base stand-in for the real pipeline: isolates these tests from material
    // tables while preserving scavenger/herbalist semantics from live tuning.
    computeCombatMaterialReward: vi.fn((input: { scavenger: boolean; herbalist: boolean }) => ({
      wood: input.scavenger ? Math.round(1 * LABYRINTH_REWARD_CONFIG.scavengerMaterialMultiplier) : 1,
      stone: 0,
      iron: 0,
      food: 0,
      herbs: input.herbalist ? LABYRINTH_REWARD_CONFIG.herbalistHerbBonus : 0,
      hide: 0,
      gems: 0,
    })),
  };
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
    lootProgress: { depth: 24, highestCompletedDifficulty: null },
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
    rollBossEnemyId: () => "mimic",
    destinationOfferState: { lastOfferedDestinations: [], roundsSinceOffered: {} },
    ...overrides,
  };
}

const testRng = () => 0.25;

describe("Fetch victory rewards", () => {
  it("applies a Labyrinth Hoard to the actual victory choices", () => {
    const result = computeVictoryRewards(
      baseInput({ contentSystemType: "labyrinth", activeLabyrinthRewardModifiers: ["ring-hoard"] }),
      testRng,
    );
    expect(result.rewardState.rewardType).toBe("gear");
    if (result.rewardState.rewardType !== "gear") throw new Error("expected Gear choices");
    expect(result.rewardState.choices.length).toBeGreaterThan(0);
    expect(
      result.rewardState.choices.every((choice) => gearDefinitions[choice.definitionId].baseItemId.endsWith("-ring")),
    ).toBe(true);
  });

  it.each(["campaign", "labyrinth", "wildwood"])("grants three Gold with a Companion in %s", (contentSystemType) => {
    const input = baseInput({ contentSystemType, battleState: baseBattleState({ activeCompanion: { id: "wolf" } }) });
    const original = computeVictoryRewards(input, testRng);
    const fetched = computeVictoryRewards(
      { ...input, unlockedTalents: { companion: ["companion-gold-find"] } },
      testRng,
    );
    expect(fetched.goldEarned - original.goldEarned).toBe(3);
    expect(fetched.persistedGold - original.persistedGold).toBe(3);
    const absent = computeVictoryRewards(
      { ...input, battleState: baseBattleState(), unlockedTalents: { companion: ["companion-gold-find"] } },
      testRng,
    );
    expect(absent.goldEarned).toBe(original.goldEarned);
  });
});

describe("computeVictoryRewardState", () => {
  const rewardInput = {
    ...baseInput(),
    goldPayout: 19,
    materials: { ...emptyInventory(), wood: 2 },
    destinations: ["Campfire"] as Destination[],
  };

  it("forwards ordinary reward amounts, materials, and destinations", () => {
    const result = computeVictoryRewardState(rewardInput, () => 0.25);
    expect(result.rewardType).toBe("card");
    expect(result.gold).toBe(19);
    expect(result.materials.wood).toBe(2);
    expect(result.destinations).toEqual(["Campfire"]);
  });

  it("routes bosses to boss rewards and forwards permanent Trinket ownership", () => {
    const unowned = trinketLibrary.slice(-2);
    const result = computeVictoryRewardState(
      {
        ...rewardInput,
        goldPayout: 22,
        battleState: baseBattleState({ currentEnemy: { id: "dragon", enemyType: "boss" } }),
        ownedTrinketIds: trinketLibrary.slice(0, -2).map((entry) => entry.id),
      },
      () => 0.8,
    );
    expect(result.rewardType).toBe("trinket");
    if (result.rewardType !== "trinket") throw new Error("expected permanent trinket reward");
    expect(result.gold).toBe(22);
    expect(result.choices.map((choice) => choice.id).sort()).toEqual(unowned.map((entry) => entry.id).sort());
  });

  it("excludes both run Boons and the equipped Trinket from elite Boon offers", () => {
    const result = computeVictoryRewardState(
      {
        ...rewardInput,
        battleState: baseBattleState({ currentEnemy: { id: "goblin-chief", enemyType: "elite" } }),
        runBoons: trinketLibrary.slice(0, -3).map((entry) => entry.id),
        equippedTrinketId: trinketLibrary.at(-3)!.id,
      },
      () => 0.8,
    );
    expect(result.rewardType).toBe("boon");
    if (result.rewardType !== "boon") throw new Error("expected boon reward");
    expect(result.choices.map((choice) => choice.id).sort()).toEqual(
      trinketLibrary
        .slice(-2)
        .map((entry) => entry.id)
        .sort(),
    );
  });
});

describe("computeVictoryRewards", () => {
  it.each([
    ["campaign", "normal"],
    ["campaign", "elite"],
    ["campaign", "boss"],
    ["labyrinth", "normal"],
    ["labyrinth", "elite"],
    ["labyrinth", "boss"],
    ["wildwood", "normal"],
    ["wildwood", "elite"],
    ["wildwood", "boss"],
  ] as const)("uses the settled Gold payout for %s %s rewards", (contentSystemType, enemyType) => {
    const purseGold = 10;
    const input = baseInput({
      contentSystemType,
      purseGold,
      battleState: baseBattleState({
        gold: 14,
        currentEnemy: { id: enemyType, enemyType },
      }),
    });
    const withoutTrinket = computeVictoryRewards(input, testRng);
    const result = computeVictoryRewards({ ...input, equippedTrinketId: "smugglers-map" }, testRng);

    expect(result.rewardState.gold).toBe(result.persistedGold - purseGold);
    expect(result.rewardState.gold - withoutTrinket.rewardState.gold).toBe(2);
  });

  it.each(["campaign", "labyrinth", "wildwood"] as const)(
    "does not draw a boss after an ordinary %s victory",
    (contentSystemType) => {
      const rngState = createRunRngState(42);
      const result = computeVictoryRewards(
        baseInput({
          contentSystemType,
          rollBossEnemyId: () => rollFreshBossId(() => stepRunRng(rngState, "world")),
        }),
        testRng,
      );
      expect(result.rewardState.selectedBossId).toBeNull();
      expect(rngState.counters.world).toBe(0);
    },
  );

  it("draws one boss when victory offers Boss Combat alone", () => {
    const rngState = createRunRngState(42);
    const result = computeVictoryRewards(
      baseInput({
        getAvailableDestinations: () => ["Boss Combat"],
        rollBossEnemyId: () => rollFreshBossId(() => stepRunRng(rngState, "world")),
      }),
      testRng,
    );
    expect(result.rewardState.destinations).toEqual(["Boss Combat"]);
    expect(result.rewardState.selectedBossId).toBeTruthy();
    expect(rngState.counters.world).toBe(1);
  });

  it("passes owned uniques through campaign boss victory rewards", () => {
    const ownedUniqueIds = new Set(uniqueItemList.map((unique) => unique.id));
    const result = computeVictoryRewards(
      baseInput({
        ownedTrinketIds: trinketLibrary.map((entry) => entry.id),
        ownedUniqueIds,
        battleState: baseBattleState({ currentEnemy: { id: "dragon", enemyType: "boss" } }),
      }),
      () => 0.9,
    );

    expect(result.rewardState.rewardType).toBe("gear");
    if (result.rewardState.rewardType !== "gear") throw new Error("expected gear reward");
    for (const choice of result.rewardState.choices) {
      expect(ownedUniqueIds.has(choice.definitionId)).toBe(false);
      expect(gearDefinitions[choice.definitionId]?.rarity).toBe("astral");
    }
  });

  it("awards the normal victory Gold and Materials with Wildwood reward choices", () => {
    const result = computeVictoryRewards(baseInput({ contentSystemType: "wildwood", purseGold: 7 }), () => 0.25);

    expect(result.goldEarned).toBe(15);
    expect(result.persistedGold).toBe(22);
    expect(result.rewardState.materials.wood).toBe(1);
    expect(result.rewardState.gold).toBe(15);
    expect(result.rewardState.choices).toHaveLength(3);
  });

  it("uses the same boss Gold and Material payout in Wildwood and Campaign", () => {
    const battleState = baseBattleState({ currentEnemy: { id: "mimic", enemyType: "boss" }, gold: 12 });
    const campaign = computeVictoryRewards(baseInput({ battleState }), testRng);
    const wildwood = computeVictoryRewards(baseInput({ contentSystemType: "wildwood", battleState }), testRng);
    expect(wildwood.goldEarned).toBe(campaign.goldEarned);
    expect(wildwood.persistedGold).toBe(campaign.persistedGold);
    expect(wildwood.rewardState.gold).toBe(campaign.rewardState.gold);
    expect(wildwood.rewardState.materials).toEqual(campaign.rewardState.materials);
  });

  it("adds in-combat Gold to Wildwood victory Gold", () => {
    const result = computeVictoryRewards(
      baseInput({
        contentSystemType: "wildwood",
        purseGold: 10,
        battleState: baseBattleState({ gold: 15 }),
      }),
      () => 0.25,
    );

    expect(result.goldEarned).toBe(20);
    expect(result.persistedGold).toBe(30);
    expect(result.rewardState.materials.wood).toBe(1);
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

    expect(result.goldEarned).toBe(15);
    expect(result.persistedGold).toBe(25);
  });

  it("computes combat victory rewards for normal enemy", () => {
    const result = computeVictoryRewards(baseInput(), testRng);
    expect(result.goldEarned).toBe(15);
    expect(result.persistedGold).toBe(20);
    expect(result.rewardState.rewardType).toBe("card");
    expect(result.playerHealth).toBe(30);
    expect(result.maxHealthDelta).toBe(0);
  });

  it("synchronizes rewardState.gold with net purse gold when in-combat gold is earned", () => {
    const result = computeVictoryRewards(
      baseInput({
        purseGold: 10,
        battleState: baseBattleState({ gold: 18 }),
      }),
      testRng,
    );
    expect(result.persistedGold).toBe(33);
    expect(result.rewardState.gold).toBe(23);
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
            abilityIds: ["slash", "bash", "block"],
          },
        }),
      }),
      testRng,
    );
    expect(mimic.goldEarned).toBeGreaterThan(normal.goldEarned);
    expect(mimic.goldEarned).toBeCloseTo(normal.goldEarned * 2, -1);
  });

  it("applies boss gold bonus and a boss reward for boss enemies", () => {
    let call = 0;
    const result = computeVictoryRewards(
      baseInput({
        battleState: baseBattleState({ currentEnemy: { id: "dragon", enemyType: "boss" } }),
      }),
      () => {
        call += 1;
        return call === 1 ? 0.25 : 0.8;
      },
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

  it("applies Vitality healing without changing maximum Health", () => {
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
    expect(result.maxHealthDelta).toBe(0);
    expect(result.playerHealth).toBe(30);
  });

  it("awards boon rewards for elite combat victories", () => {
    const result = computeVictoryRewards(
      baseInput({
        contentSystemType: "labyrinth",
        battleState: baseBattleState({ currentEnemy: { id: "goblin-chief", enemyType: "elite" } }),
      }),
      () => 0.8,
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

  it("offers a Campfire using the post-combat Vitality Health", () => {
    const input = baseInput({
      unlockedTalents: { health: ["health-max-per-combat"] },
      runMaxHealth: 30,
      battleState: baseBattleState({ playerHealth: 18 }),
      getAvailableDestinations: ({
        currentHealth,
        currentGold,
        maxHealth,
      }: {
        currentHealth: number;
        currentGold: number;
        maxHealth: number;
      }) => getAvailableDestinations(currentHealth, currentGold, maxHealth).filter((entry) => entry === "Campfire"),
    });

    const result = computeVictoryRewards(input, testRng);

    expect(result.maxHealthDelta).toBe(0);
    expect(result.rewardState.destinations).toContain("Campfire");
  });

  it("applies Vitality after combat", () => {
    const result = computeVictoryRewards(
      baseInput({
        unlockedTalents: { health: ["health-max-per-combat"] },
        battleState: baseBattleState({ playerHealth: 20 }),
      }),
      testRng,
    );
    expect(result.maxHealthDelta).toBe(0);
    expect(result.playerHealth).toBe(24);
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

  it("awards pending Gems for Wildwood victories", () => {
    const materials = { ...emptyInventory(), gems: 2 };
    commit(
      victoryResult(),
      commitDeps({
        battleState: baseBattleState({ pendingMaterials: materials }),
        contentSystemType: "wildwood",
      }),
    );

    expect(readGameplayState().runProfile.materialInventory.gems).toBe(2);
  });

  it("persists in-combat gold into the purse for wildwood victories", () => {
    setRunProgress({ gold: 10 });
    const battleState = baseBattleState({ gold: 15, pendingMaterials: emptyInventory() });
    const result = computeVictoryRewards(
      baseInput({ contentSystemType: "wildwood", purseGold: 10, battleState }),
      testRng,
    );
    const goldGained = commit(result, commitDeps({ battleState, contentSystemType: "wildwood" }));
    expect(readGameplayState().runProfile.gold).toBe(30);
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
    expect(readGameplayState().session.rewardFlow.state).toMatchObject({
      lastVictoryEnemyType: "boss",
      lastVictoryContentSystem: "labyrinth",
    });
  });
});
