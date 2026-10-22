import { makeTestCard } from "../../../../../fixtures/cards";
import "../../../../../helpers/mock-audio";
import "../../../../../helpers/mock-flush-save";
import {
  mutateGameplayForTest,
  bindGameplayMutationForTest,
  initializeBattleForTest as initializeActiveBattle,
  mutateGearForTest,
  resetRunDomainStore,
  setRunProgress,
  setRunSession,
} from "../../../../../helpers/run-domain-store-test";
import { beforeEach, describe, expect, it } from "vitest";
import {
  restoreRun,
  snapshotRun,
  finalizeRunEndSession,
} from "@/features/alchemy/shared/stores/commands/run-lifecycle";
import {
  applyRunStartSnapshot as mutateRunStartSnapshot,
  awardCardXP as mutateAwardCardXP,
  awardMysteryXP as mutateAwardMysteryXP,
  clearPermanentData as mutateClearPermanentData,
  unlockAllTalents as mutateUnlockAllTalents,
  unlockTalent as mutateUnlockTalent,
  resetUnlockedTalents as mutateResetUnlockedTalents,
  initializeActiveRun as mutateInitializeActiveRun,
  resetProgress as mutateResetProgress,
  resetRunXP as mutateResetRunXP,
  rebindLiveRunMeta,
} from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import { createEmptyGearInventories, createEmptyGearLoadouts, type GearInstance } from "@/lib/gear";
import { patchBattleState } from "../../../../../fixtures/battle";
import { cardById, computeTalentPoints, type BattleCard } from "@/lib/game-data";
import { purchaseTalent } from "@/features/alchemy/shared/stores/commands/navigation-commands";
import { readGameplayState } from "@/features/alchemy/shared/stores/session/gameplay-state-reads";
import {
  readActiveRun,
  readBattle,
  readActiveRunScreen,
  readRunProfile,
  readRunSession,
} from "@/features/alchemy/shared/stores/session/run-reads";
import { createCompleteActiveRunData, makeActiveRunData } from "../session/active-run-data-fixture";
import { createEmptyRewardState, serializePendingReward } from "@/lib/active-run-session";
import { defaultGameSession } from "@/app/application-session";
import { finalizeRunXP as mutateFinalizeRunXP } from "@/features/alchemy/shared/stores/commands/write/run-meta";
import { savedActivityFixture } from "../../../../../fixtures/run-activity";

const syncGearRunHealth = bindGameplayMutationForTest(rebindLiveRunMeta);
const applyRunStartSnapshot = bindGameplayMutationForTest(mutateRunStartSnapshot);
const finalizeRunXP = bindGameplayMutationForTest(mutateFinalizeRunXP);
const unlockAllTalents = bindGameplayMutationForTest(mutateUnlockAllTalents);
const initializeActiveRun = bindGameplayMutationForTest(mutateInitializeActiveRun);
const awardCardXP = bindGameplayMutationForTest(mutateAwardCardXP);
const awardMysteryXP = bindGameplayMutationForTest(mutateAwardMysteryXP);
const unlockTalent = bindGameplayMutationForTest(mutateUnlockTalent);
const resetUnlockedTalents = bindGameplayMutationForTest(mutateResetUnlockedTalents);
const resetRunXP = bindGameplayMutationForTest(mutateResetRunXP);
const resetProgress = bindGameplayMutationForTest(mutateResetProgress);
const clearPermanentData = bindGameplayMutationForTest(mutateClearPermanentData);

beforeEach(() => {
  resetRunDomainStore();
});

describe("initialize", () => {
  it("restores valid completed destination labels", () => {
    const activeRun = makeActiveRunData({
      characterId: "rogue",
      runPlayerHealth: 25,
      runMaxHealth: 30,
      roomsEncountered: 3,
      destinationIndexInAct: 2,
      completedDestinations: ["Normal Combat", "Corruption"],
    });

    initializeActiveRun(activeRun);

    expect(readActiveRun(defaultGameSession).completedDestinations).toEqual(["Normal Combat", "Corruption"]);
  });

  it("restores navigation screen via restoreRun", () => {
    const activeRun = makeActiveRunData({ activity: savedActivityFixture("shop") });
    restoreRun(activeRun, {}, {}, defaultGameSession);
    expect(readActiveRunScreen(defaultGameSession)).toBe("shop");
  });

  it("round-trips every active-run persistence region through the aggregate", () => {
    const activeRun = createCompleteActiveRunData();
    activeRun.activity = {
      kind: "rewards",
      data: serializePendingReward({
        ...createEmptyRewardState(["Mystery", "Card Shop"]),
        gold: 7,
        lastVictoryEnemyType: "elite",
        lastVictoryContentSystem: "labyrinth",
      })!,
    };

    restoreRun(activeRun, { armor: 21 }, { armor: ["armor-1"] }, defaultGameSession);
    const snapshot = snapshotRun(defaultGameSession);

    expect(Object.keys(snapshot).sort()).toEqual(Object.keys(activeRun).sort());
    expect(snapshot).toMatchObject({
      characterId: activeRun.characterId,
      runDeck: activeRun.runDeck,
      runPlayerHealth: activeRun.runPlayerHealth,
      roomsEncountered: activeRun.roomsEncountered,
      currentAct: activeRun.currentAct,
      destinationIndexInAct: activeRun.destinationIndexInAct,
      completedDestinations: activeRun.completedDestinations,
      lastOfferedDestinations: activeRun.lastOfferedDestinations,
      destinationRoundsSinceOffered: activeRun.destinationRoundsSinceOffered,
      runBoons: activeRun.runBoons,
      encounteredRunEnemyIds: activeRun.encounteredRunEnemyIds,
      selectedDifficulty: activeRun.selectedDifficulty,
      contentSystemType: activeRun.contentSystemType,
      labyrinthMap: activeRun.labyrinthMap,
      labyrinthPendingNode: activeRun.labyrinthPendingNode,
      runTalentXP: activeRun.runTalentXP,
      runMaterialsEarned: activeRun.runMaterialsEarned,
      runObtainedItems: activeRun.runObtainedItems,
      activity: activeRun.activity,
    });
    expect(snapshot.rng).toEqual(activeRun.rng);
    if (snapshot.activity.kind !== "rewards") {
      throw new Error("Expected unclaimed Gold to survive as a primary-reward interruption");
    }
    expect(snapshot.activity.data.gold).toBe(7);
    expect(snapshot.activity.data.destinations).toEqual(["Mystery", "Card Shop"]);
    expect(snapshot.activeLabyrinthModifiers).toEqual(activeRun.activeLabyrinthModifiers);
    expect(snapshot.activeLabyrinthRewardModifiers).toEqual(activeRun.activeLabyrinthRewardModifiers);
  });
});

describe("gear max health sync", () => {
  const maxHealthArmor: GearInstance = {
    instanceId: "max-health-armor",
    definitionId: "leather-armor-basic",
    affixes: [{ id: "max-health", value: 7 }],
  };

  it("rebinds max health from currently equipped gear", () => {
    const inventories = createEmptyGearInventories();
    inventories.knight = [maxHealthArmor];
    const loadouts = createEmptyGearLoadouts();
    loadouts.knight.body = maxHealthArmor.instanceId;
    mutateGearForTest((gear) => gear.initialize(inventories, loadouts));
    setRunProgress({
      characterId: "knight",
      runMaxHealth: 30,
      runPlayerHealth: 30,
      runMetaMaxHealth: 30,
    });
    setRunSession({ hasActiveRun: true });

    syncGearRunHealth();

    expect(readActiveRun(defaultGameSession).runMaxHealth).toBe(37);
    expect(readActiveRun(defaultGameSession).runPlayerHealth).toBe(30);
  });

  it("rebinds max health when equipped gear is removed", () => {
    mutateGearForTest((gear) => gear.initialize(createEmptyGearInventories(), createEmptyGearLoadouts()));
    setRunProgress({
      characterId: "knight",
      runMaxHealth: 37,
      runPlayerHealth: 35,
      runMetaMaxHealth: 37,
    });
    setRunSession({ hasActiveRun: true });

    syncGearRunHealth();

    expect(readActiveRun(defaultGameSession).runMaxHealth).toBe(30);
    expect(readActiveRun(defaultGameSession).runPlayerHealth).toBe(30);
  });
});

it("awardCardXP awards and accumulates all resource-card keywords in run XP without changing permanent XP", () => {
  awardCardXP(cardById["burning-blade"]!);
  awardCardXP(cardById["mana-shield"]!);
  awardCardXP(cardById["crystal-bulwark"]!);
  expect(readActiveRun(defaultGameSession).runTalentXP).toEqual({ burn: 1, forge: 1, block: 2, mana: 2, armor: 1 });
  expect(readRunProfile(defaultGameSession).talentXP).toEqual({});
});

describe("awardMysteryXP", () => {
  it("awards XP directly to a keyword runTalentXP", () => {
    awardMysteryXP("burn", 50);
    expect(readActiveRun(defaultGameSession).runTalentXP.burn).toBe(50);
    expect(readRunProfile(defaultGameSession).talentXP.burn).toBeUndefined();
  });

  it("accumulates with existing runTalentXP", () => {
    awardMysteryXP("burn", 30);
    awardMysteryXP("burn", 20);
    expect(readActiveRun(defaultGameSession).runTalentXP.burn).toBe(50);
  });

  it("awards XP to all visible keywords", () => {
    awardMysteryXP("consume", 50);
    expect(readActiveRun(defaultGameSession).runTalentXP.consume).toBe(50);
  });
});

describe("unlockTalent", () => {
  it("appends the next eligible talent when points are available", () => {
    setRunProgress({ talentXP: { burn: 20 } });
    unlockTalent("burn", "burn-dmg-1");
    expect(readRunProfile(defaultGameSession).unlockedTalents.burn).toEqual(["burn-dmg-1"]);
  });

  it("preserves existing unlocks for sequential choices", () => {
    setRunProgress({ talentXP: { burn: 60 } });
    unlockTalent("burn", "burn-dmg-1");
    unlockTalent("burn", "burn-dmg-2");
    expect(readRunProfile(defaultGameSession).unlockedTalents.burn).toEqual(["burn-dmg-1", "burn-dmg-2"]);
  });

  it("ignores duplicate unlock of the same talentId", () => {
    setRunProgress({ talentXP: { burn: 20 } });
    unlockTalent("burn", "burn-dmg-1");
    unlockTalent("burn", "burn-dmg-1");
    expect(readRunProfile(defaultGameSession).unlockedTalents.burn).toEqual(["burn-dmg-1"]);
  });

  it("rejects unlock without unspent points", () => {
    setRunSession({ hasActiveRun: true });
    const before = readGameplayState(defaultGameSession);
    purchaseTalent("burn", "burn-dmg-1", defaultGameSession);
    expect(readGameplayState(defaultGameSession)).toBe(before);
  });

  it("rejects out-of-order unlocks", () => {
    setRunProgress({ talentXP: { burn: 20 } });
    unlockTalent("burn", "burn-dmg-5");
    expect(readRunProfile(defaultGameSession).unlockedTalents.burn).toBeUndefined();
  });

  it("rejects unknown talent ids", () => {
    setRunProgress({ talentXP: { nature: 100 } });
    unlockTalent("nature", "nature-not-a-real-talent");
    expect(readRunProfile(defaultGameSession).unlockedTalents.nature).toBeUndefined();
  });
});

it("unlockAllTalents unlocks every talent from the pool", () => {
  unlockAllTalents();
  const unlocked = readRunProfile(defaultGameSession).unlockedTalents;
  const allKeywordIds = Object.keys(unlocked);
  expect(allKeywordIds.length).toBeGreaterThan(0);
  for (const talents of Object.values(unlocked)) {
    expect(Array.isArray(talents)).toBe(true);
    expect(talents.length).toBeGreaterThan(0);
  }
});

it("resetUnlockedTalents refunds allocations and removes live combat bonuses while preserving XP and Homestead effects", () => {
  setRunProgress({ talentXP: { health: 100 }, unlockedTalents: { health: ["health-heal-boost"] } });
  setRunSession({ hasActiveRun: true });
  mutateGameplayForTest((draft) => {
    draft.runProfile.effects.homesteadHealing = 2;
    initializeActiveBattle(draft, patchBattleState({ playerHealth: 15 }));
    rebindLiveRunMeta(draft);
  });
  expect(readBattle(defaultGameSession).battleState.talentEffects.healMultiplier).toBe(1.1);
  const before = readBattle(defaultGameSession).battleState;
  resetUnlockedTalents();
  expect(readRunProfile(defaultGameSession).unlockedTalents).toEqual({});
  expect(readRunProfile(defaultGameSession).talentXP).toEqual({ health: 100 });
  expect(readBattle(defaultGameSession).battleState.talentEffects).toMatchObject({
    healMultiplier: 1,
    homesteadHealing: 2,
  });
  expect(readBattle(defaultGameSession).battleState.playerHealth).toBe(before.playerHealth);
  expect(readBattle(defaultGameSession).battleState.hand).toEqual(before.hand);
});

it("resetRunXP clears runTalentXP but preserves talentXP after finalize", () => {
  awardMysteryXP("burn", 50);
  finalizeRunXP();
  resetRunXP();
  expect(readRunProfile(defaultGameSession).talentXP.burn).toBe(50);
  expect(readActiveRun(defaultGameSession).runTalentXP).toEqual({});
});

it("clearPermanentData clears talentXP, runTalentXP, and unlockedTalents", () => {
  awardMysteryXP("burn", 50);
  finalizeRunXP();
  unlockTalent("burn", "burn-dmg-1");
  clearPermanentData();
  expect(readRunProfile(defaultGameSession).talentXP).toEqual({});
  expect(readActiveRun(defaultGameSession).runTalentXP).toEqual({});
  expect(readRunProfile(defaultGameSession).unlockedTalents).toEqual({});
});

it("reset preserves talentXP and unlockedTalents while clearing run state", () => {
  awardMysteryXP("burn", 50);
  finalizeRunXP();
  unlockTalent("burn", "burn-dmg-1");
  setRunProgress({ gold: 100, runPlayerHealth: 15 });
  resetProgress();
  expect(readRunProfile(defaultGameSession).talentXP.burn).toBe(50);
  expect(readRunProfile(defaultGameSession).unlockedTalents.burn).toEqual(["burn-dmg-1"]);
  expect(readActiveRun(defaultGameSession).runTalentXP).toEqual({});
  expect(readRunProfile(defaultGameSession).gold).toBe(100);
  expect(readActiveRun(defaultGameSession).runPlayerHealth).toBeGreaterThan(0);
  expect(readGameplayState(defaultGameSession).run.initialized).toBe(false);
});

it("talent XP accumulation through run end awards card XP to runTalentXP then merges into permanent talentXP and points", () => {
  const card: BattleCard = makeTestCard({
    id: "slash",
    title: "Slash",
    effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
  });
  setRunProgress({ selectedDifficulty: "difficulty-1" });

  for (let i = 0; i < 20; i++) {
    awardCardXP(card);
  }
  expect(readActiveRun(defaultGameSession).runTalentXP.physical).toBe(20);
  expect(computeTalentPoints(readRunProfile(defaultGameSession).talentXP.physical ?? 0)).toBe(0);

  finalizeRunXP();

  expect(readActiveRun(defaultGameSession).runTalentXP).toEqual({});
  expect(readRunProfile(defaultGameSession).talentXP.physical).toBe(20);
  expect(computeTalentPoints(readRunProfile(defaultGameSession).talentXP.physical ?? 0)).toBe(1);
  expect(readRunSession(defaultGameSession).runEndTalentXP.physical).toBe(20);
});

it("applyRunStartSnapshot clears runTalentXP and run-end snapshots when starting a fresh run", () => {
  awardMysteryXP("burn", 5);
  setRunSession({
    runEndTalentXP: { burn: 5 },
    runEndItems: [{ kind: "trinket", trinketId: "bone-charm" }],
  });
  setRunProgress({ runObtainedItems: [{ kind: "trinket", trinketId: "bone-charm" }] });
  applyRunStartSnapshot({
    characterId: "knight",
    contentSystemType: "campaign",
    freshDeck: [],
    selectedDifficulty: "difficulty-1",
    runPlayerHealth: 80,
    runMaxHealth: 80,
    roomsEncountered: 0,
    currentAct: 1,
    destinationIndexInAct: 0,
    completedDestinations: [],
    runBoons: [],
    hasActiveRun: true,
  });
  expect(readActiveRun(defaultGameSession).runTalentXP).toEqual({});
  expect(readActiveRun(defaultGameSession).runObtainedItems).toEqual([]);
  expect(readRunSession(defaultGameSession).runEndTalentXP).toEqual({});
  expect(readRunSession(defaultGameSession).runEndItems).toEqual([]);
  expect(readRunSession(defaultGameSession).hasActiveRun).toBe(true);
});

it("applyRunStartSnapshot reseeds run RNG instead of reusing the previous run", () => {
  setRunProgress({
    rng: { seed: 123, counters: { rewards: 5, destinations: 5, events: 5, shops: 5, world: 5 } },
  });
  applyRunStartSnapshot({
    characterId: "knight",
    contentSystemType: "campaign",
    freshDeck: [],
    selectedDifficulty: "difficulty-1",
    runPlayerHealth: 80,
    runMaxHealth: 80,
    roomsEncountered: 0,
    currentAct: 1,
    destinationIndexInAct: 0,
    completedDestinations: [],
    runBoons: [],
    hasActiveRun: true,
  });
  expect(readActiveRun(defaultGameSession).rng.counters).toEqual({
    rewards: 0,
    destinations: 0,
    events: 0,
    shops: 0,
    world: 0,
  });
  expect(Number.isFinite(readActiveRun(defaultGameSession).rng.seed)).toBe(true);
});

describe("finalizeRunEndSession", () => {
  it("copies obtained items onto the run-end session snapshot", () => {
    const obtained = [
      {
        kind: "gear" as const,
        instance: { instanceId: "end-armor", definitionId: "leather-armor-basic", affixes: [] },
      },
      { kind: "trinket" as const, trinketId: "bone-charm" },
    ];
    setRunSession({ hasActiveRun: true });
    setRunProgress({ runObtainedItems: obtained });

    finalizeRunEndSession(defaultGameSession);

    const recap = readRunSession(defaultGameSession).runEndItems;
    expect(recap).toEqual(obtained);
    expect(recap[0]).not.toBe(obtained[0]);
    if (recap[0]?.kind === "gear" && obtained[0]?.kind === "gear") {
      expect(recap[0].instance).not.toBe(obtained[0].instance);
    }
    expect(readRunSession(defaultGameSession).hasActiveRun).toBe(false);
  });

  it("keeps run progress for the recap screens until teardown", () => {
    setRunSession({ hasActiveRun: true });
    setRunProgress({ runBoons: ["test-boon"], roomsEncountered: 4 });

    finalizeRunEndSession(defaultGameSession);

    expect(readRunSession(defaultGameSession).hasActiveRun).toBe(false);
    expect(readActiveRun(defaultGameSession).runBoons).toEqual(["test-boon"]);
    expect(readActiveRun(defaultGameSession).roomsEncountered).toBe(4);
  });
});
