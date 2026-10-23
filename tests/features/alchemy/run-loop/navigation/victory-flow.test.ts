import { readRewardActivity } from "@/lib/active-run-session";
import { computeHomesteadEffects } from "@/lib/homestead/effects";
import {
  mutateGameplayForTest,
  mutateRunForTest,
  setBattleActiveForTest,
  getBattleForTest,
  resetRunDomainStore,
  setRunProgress,
} from "../../../../helpers/run-domain-store-test";
import { readBattle } from "@/features/alchemy/shared/stores/session/run-reads";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeVictoryRewards,
  type VictoryRewardsInput,
  type VictoryRewardsResult,
} from "@/features/alchemy/run-loop/navigation/victory-flow";
import { computeVictoryGold } from "@/features/alchemy/run-loop/navigation/reward-math";
import { createEmptyRewardState } from "@/lib/active-run-session";
import { emptyInventory } from "@/lib/homestead/inventory";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";
import { LABYRINTH_REWARD_CONFIG, SHOP_MIN_GOLD } from "@/lib/game-constants";
import { trinketLibrary } from "@/lib/game-data";
import { gearDefinitions, uniqueItemList } from "@/lib/gear";
import { rollFreshBossId } from "@/features/alchemy/shared/config";
import { createRunRngState, createRunStateRng } from "@/lib/rng";
import type { Destination } from "@/lib/routing";
import { sampleDestinationChoices } from "@/features/alchemy/shared/run-flow/destination-flow";
import { readGameplayState } from "@/features/alchemy/shared/stores/session/gameplay-state-reads";
import { commitVictoryRewards, type CommitVictoryRewardsDeps } from "@/features/alchemy/run-loop/run/victory-commands";
import { defaultGameSession } from "@/app/application-session";
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
    // Fixed-base stand-in for the real pipeline: isolates these tests from material
    // rolls while preserving scavenger/herbalist semantics from live tuning.
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
    materialRewardBand: 1,
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
    destinationEligibility: {
      currentAct: 1,
      destinationIndexInAct: 2,
      completedDestinations: [],
      hasAnyOwnedGear: true,
      hasUnownedTrinkets: true,
    },
    homesteadEffects: { ...defaultHomesteadEffects },
    rollBossEnemyId: () => "mimic",
    destinationOfferState: { lastOfferedDestinations: [], roundsSinceOffered: {} },
    ...overrides,
  };
}

const testRng = () => 0.25;

describe("Fetch victory rewards", () => {
  it.each(["campaign", "labyrinth", "wildwood"])(
    "Wheat Field restores purchased Health after combat in %s and stacks with recovery talents",
    (contentSystemType) => {
      for (const tier of [1, 2, 3, 4]) {
        const input = baseInput({
          contentSystemType,
          battleState: baseBattleState({ playerHealth: 10 }),
          unlockedTalents: { health: ["health-max-per-combat"] },
          homesteadEffects: computeHomesteadEffects({}, { "wheat-field": tier }, {}),
        });
        expect(computeVictoryRewards(input, testRng).playerHealth).toBe(14 + tier);
        expect(
          computeVictoryRewards({ ...input, battleState: baseBattleState({ playerHealth: 29 }) }, testRng).playerHealth,
        ).toBe(30);
      }
    },
  );

  it.each(["campaign", "labyrinth", "wildwood"])(
    "adds Culinary Arts once to positive victory recovery in %s",
    (contentSystemType) => {
      const input = baseInput({
        contentSystemType,
        battleState: baseBattleState({ playerHealth: 10 }),
        unlockedTalents: { health: ["health-max-per-combat"] },
        homesteadEffects: { ...defaultHomesteadEffects, healthRestorePerCombat: 2, homesteadHealing: 3 },
      });
      expect(computeVictoryRewards(input, testRng).playerHealth).toBe(19);
      expect(
        computeVictoryRewards(
          { ...input, unlockedTalents: {}, homesteadEffects: { ...defaultHomesteadEffects, homesteadHealing: 3 } },
          testRng,
        ).playerHealth,
      ).toBe(10);
      expect(
        computeVictoryRewards({ ...input, battleState: baseBattleState({ playerHealth: 29 }) }, testRng).playerHealth,
      ).toBe(30);
    },
  );

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
          rollBossEnemyId: () => rollFreshBossId(createRunStateRng(rngState, "world")),
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
        destinationEligibility: { ...baseInput().destinationEligibility, destinationIndexInAct: 7 },
        rollBossEnemyId: () => rollFreshBossId(createRunStateRng(rngState, "world")),
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

  it.each([
    { purseGold: 7, battleGold: 5, earned: 15, persisted: 22 },
    { purseGold: 10, battleGold: 15, earned: 20, persisted: 30 },
    { purseGold: 10, battleGold: 4, earned: 15, persisted: 25 },
  ])(
    "settles Wildwood Gold without losing the purse ($purseGold, $battleGold)",
    ({ purseGold, battleGold, earned, persisted }) => {
      const result = computeVictoryRewards(
        baseInput({
          contentSystemType: "wildwood",
          purseGold,
          battleState: baseBattleState({ gold: battleGold }),
        }),
        testRng,
      );
      expect(result.goldEarned).toBe(earned);
      expect(result.persistedGold).toBe(persisted);
      expect(result.rewardState.gold).toBe(earned);
      expect(result.rewardState.materials.wood).toBe(1);
      expect(result.rewardState.choices).toHaveLength(3);
    },
  );

  it("uses the same boss Gold and Material payout in Wildwood and Campaign", () => {
    const battleState = baseBattleState({ currentEnemy: { id: "mimic", enemyType: "boss" }, gold: 12 });
    const campaign = computeVictoryRewards(baseInput({ battleState }), testRng);
    const wildwood = computeVictoryRewards(baseInput({ contentSystemType: "wildwood", battleState }), testRng);
    expect(wildwood.goldEarned).toBe(campaign.goldEarned);
    expect(wildwood.persistedGold).toBe(campaign.persistedGold);
    expect(wildwood.rewardState.gold).toBe(campaign.rewardState.gold);
    expect(wildwood.rewardState.materials).toEqual(campaign.rewardState.materials);
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

  it("applies generous Gold to both settlement and rewards", () => {
    const result = computeVictoryRewards(
      baseInput({
        contentSystemType: "labyrinth",
        activeLabyrinthRewardModifiers: ["generous"],
      }),
      testRng,
    );
    expect(result.goldEarned).toBe(23);
    expect(result.rewardState.gold).toBe(23);
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
    expect(result.playerHealth).toBe(30);
  });

  it("awards boon rewards for elite combat victories, excluding run Boons and equipped Trinket", () => {
    const result = computeVictoryRewards(
      baseInput({
        contentSystemType: "labyrinth",
        battleState: baseBattleState({ currentEnemy: { id: "goblin-chief", enemyType: "elite" } }),
        runBoons: trinketLibrary.slice(0, -3).map((entry) => entry.id),
        equippedTrinketId: trinketLibrary.at(-3)!.id,
      }),
      () => 0.8,
    );
    expect(result.rewardState.rewardType).toBe("boon");
    if (result.rewardState.rewardType !== "boon") throw new Error("expected boon reward");
    expect(result.rewardState.choices.map((choice) => choice.id).sort()).toEqual(
      trinketLibrary
        .slice(-2)
        .map((entry) => entry.id)
        .sort(),
    );
  });

  it("offers a Campfire using the post-combat Vitality Health", () => {
    const input = baseInput({
      unlockedTalents: { health: ["health-max-per-combat"] },
      runMaxHealth: 30,
      battleState: baseBattleState({ playerHealth: 18 }),
    });

    computeVictoryRewards(input, testRng);

    expect(sampleDestinationChoices).toHaveBeenLastCalledWith(
      expect.arrayContaining(["Campfire"]),
      expect.anything(),
      expect.any(Function),
    );
  });

  it("uses settled Health and Gold for legal destination offers", () => {
    const purseGold = SHOP_MIN_GOLD - 1;
    const result = computeVictoryRewards(
      baseInput({ purseGold, battleState: baseBattleState({ gold: purseGold }) }),
      testRng,
    );
    expect(result.persistedGold).toBeGreaterThanOrEqual(SHOP_MIN_GOLD);
    const eligible = vi.mocked(sampleDestinationChoices).mock.lastCall?.[0];
    expect(eligible).toContain("Card Shop");
    expect(eligible).toContain("Campfire");
    expect(eligible).not.toContain("Trinket Shop");
    expect(eligible).not.toContain("Boss Combat");
  });

  it.each([
    { label: "labyrinth", overrides: { contentSystemType: "labyrinth" as const } },
    {
      label: "campaign boss",
      overrides: { battleState: baseBattleState({ currentEnemy: { id: "dragon", enemyType: "boss" } }) },
    },
  ])("skips campaign destination sampling for $label victories", ({ overrides }) => {
    vi.mocked(sampleDestinationChoices).mockClear();
    const destinationOfferState = { lastOfferedDestinations: [], roundsSinceOffered: {} };
    const result = computeVictoryRewards(baseInput({ ...overrides, destinationOfferState }), testRng);
    expect(sampleDestinationChoices).not.toHaveBeenCalled();
    expect(result.rewardState.destinations).toEqual([]);
    expect(result.destinationOfferState).toEqual(destinationOfferState);
  });
});

describe("commitVictoryRewards", () => {
  beforeEach(() => mutateGameplayForTest((draft) => getBattleForTest(draft)));
  function victoryResult(overrides: Partial<VictoryRewardsResult> = {}): VictoryRewardsResult {
    return {
      goldEarned: 20,
      persistedGold: 20,
      rewardState: createEmptyRewardState(),
      labyrinthRewardModifiers: [],
      playerHealth: 30,
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
    return mutateRunForTest((draft) => commitVictoryRewards(draft, result, deps, testRng));
  }

  it.each([0, 20])("reports whether %i Gold was earned while committing the payout", (goldEarned) => {
    expect(commit(victoryResult({ goldEarned }))).toBe(goldEarned > 0);
    expect(readGameplayState(defaultGameSession).runProfile.gold).toBe(20);
  });

  it.each(["campaign", "wildwood"] as const)("settles committed pending Gems once for %s", (contentSystemType) => {
    const materials = { ...emptyInventory(), gems: 2 };
    mutateGameplayForTest((draft) => {
      draft.session.activity = { kind: "idle" };
      draft.run.activeRun.contentSystemType = contentSystemType;
      setBattleActiveForTest(draft, true);
      getBattleForTest(draft).battleState.pendingMaterials = materials;
    });
    const deps = commitDeps({ contentSystemType });
    commit(victoryResult(), deps);
    expect(readGameplayState(defaultGameSession).runProfile.materialInventory.gems).toBe(2);
    expect(readGameplayState(defaultGameSession).run.activeRun.runMaterialsEarned.gems).toBe(2);
    expect(readBattle(defaultGameSession).battleState.pendingMaterials).toEqual(emptyInventory());
    const settled = readGameplayState(defaultGameSession);
    expect(() => commit(victoryResult(), deps)).toThrow("active battle");
    expect(readGameplayState(defaultGameSession)).toBe(settled);
  });

  it("persists in-combat gold into the purse for wildwood victories", () => {
    setRunProgress({ gold: 10 });
    const battleState = baseBattleState({ gold: 15, pendingMaterials: emptyInventory() });
    const result = computeVictoryRewards(
      baseInput({ contentSystemType: "wildwood", purseGold: 10, battleState }),
      testRng,
    );
    const goldGained = commit(result, commitDeps({ battleState, contentSystemType: "wildwood" }));
    expect(readGameplayState(defaultGameSession).runProfile.gold).toBe(30);
    expect(goldGained).toBe(true);
  });

  it.each([10, Number.MAX_SAFE_INTEGER - 1, Number.MAX_SAFE_INTEGER])(
    "settles the actual victory payout once onto purse %i",
    (purseGold) => {
      setRunProgress({ gold: purseGold });
      const goldResult = computeVictoryGold({
        battleState: { gold: purseGold },
        purseGold,
        runBoons: [],
        gold: 15,
        eliteBonus: 0,
        generousBonus: 0,
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
      expect(goldResult.persistedGold).toBe(Math.min(Number.MAX_SAFE_INTEGER, purseGold + 30));
      expect(readGameplayState(defaultGameSession).runProfile.gold).toBe(goldResult.persistedGold);
      expect(goldGained).toBe(purseGold < Number.MAX_SAFE_INTEGER);
    },
  );

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
    expect(readRewardActivity(readGameplayState(defaultGameSession).session.activity).state).toMatchObject({
      lastVictoryEnemyType: "boss",
      lastVictoryContentSystem: "labyrinth",
    });
  });
});
