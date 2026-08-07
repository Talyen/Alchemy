import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  dispatchRunSessionCommand,
  getRunSessionRevision,
  subscribeRunSessionCommits,
} from "@/features/alchemy/shared/stores/run-session-command";
import {
  getRunDomainStore,
  getRunProfileStore,
  getRunTransientStore,
  resetRunDomainStore,
} from "../../../../helpers/gameplay-store-test";
import { useGearStore, useProfileStore } from "../../../../helpers/gameplay-store-test";
import { restoreRun, snapshotRun } from "@/features/alchemy/shared/stores/run-transitions";
import { dispatchGearMutationWithRunHealthSync } from "@/features/alchemy/shared/stores/gear-session-command";
import {
  beginBattleTransition,
  initializeActiveBattle,
  commitBattleTransition,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { createRunRandomSource, setRunGold } from "@/features/alchemy/shared/stores/run-session-write-port";
import { readGameplayState, useGameplayStateStore } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { defaultBattleState } from "@/lib/battle";
import { placeholderRng } from "@/lib/battle/rng";
import { createRunRngState } from "@/lib/run-rng";
import { setRunProgress } from "../../../../helpers/run-domain-store-test";
import { createEmptyGearInventories, createEmptyGearLoadouts, type GearInstance } from "@/lib/gear";

beforeEach(() => {
  resetRunDomainStore();
  useProfileStore.setState(useProfileStore.getInitialState());
  useGearStore.setState(useGearStore.getInitialState());
});

describe("run-session transaction coordinator", () => {
  it("keeps the root nested with action groups beside each lifetime", () => {
    const root = readGameplayState();

    expect(root).not.toHaveProperty("activeRun");
    expect(root.run).toHaveProperty("activeRun");
    expect(root.runActions).toBeDefined();
    expect(root.sessionActions).toBeDefined();
    expect(root.battleActions).toBeDefined();
    expect(root.runProfileActions).toBeDefined();
    expect(root.profileActions).toBeDefined();
    expect(root.gearActions).toBeDefined();
  });

  it("executes the public command boundary and runs its effect after commit", () => {
    const effect = vi.fn((gold: number) => {
      expect(readGameplayState().run.activeRun.runGold).toBe(gold);
    });

    const result = dispatchRunSessionCommand(
      () => {
        getRunDomainStore().setRunGold(17);
        return 17;
      },
      { afterCommit: effect },
    );

    expect(result).toBe(17);
    expect(effect).toHaveBeenCalledOnce();
  });

  it("publishes one commit after multiple store mutations", () => {
    const commits: Array<{ revision: number; gold: number; hasActiveRun: boolean }> = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => {
      commits.push({
        revision,
        gold: getRunDomainStore().activeRun.runGold,
        hasActiveRun: getRunTransientStore().hasActiveRun,
      });
    });

    dispatchRunSessionCommand(() => {
      getRunDomainStore().setRunGold(125);
      getRunTransientStore().setHasActiveRun(true);
    });

    unsubscribe();

    expect(commits).toHaveLength(1);
    expect(commits[0]).toMatchObject({ gold: 125, hasActiveRun: true });
    expect(commits[0].revision).toBeGreaterThan(0);
  });

  it("persists a battle continuation with the intermediate state in one commit", () => {
    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));
    const intermediate = { ...defaultBattleState(), turnPhase: "enemy" as const, hand: [] };
    const resultState = { ...defaultBattleState(), turn: 2, playerHealth: 18 };

    beginBattleTransition(
      intermediate,
      { kind: "enemy-turn", resultState, playerTurnSkipped: false },
      { hand: [], turnPhase: "enemy" },
    );

    unsubscribe();

    expect(commits).toHaveLength(1);
    expect(readGameplayState().battle.battleState).toEqual(intermediate);
    expect(readGameplayState().battle.pendingBattleTransition).toEqual({
      kind: "enemy-turn",
      resultState,
      playerTurnSkipped: false,
    });
    expect(readGameplayState().battle.pendingTransitionResumeRequired).toBe(false);
  });

  it("marks hydrated pending transitions for resume without live beginBattleTransition", () => {
    const resultState = { ...defaultBattleState(), turn: 2, playerHealth: 18 };
    const intermediate = { ...defaultBattleState(), turnPhase: "enemy" as const, hand: [] };

    initializeActiveBattle(intermediate, {
      kind: "enemy-turn",
      resultState,
      playerTurnSkipped: false,
    });

    expect(readGameplayState().battle.pendingTransitionResumeRequired).toBe(true);
    const pending = readGameplayState().battle.pendingBattleTransition;
    expect(pending?.kind).toBe("enemy-turn");
    if (pending?.kind === "enemy-turn") {
      expect(pending.resultState.turn).toBe(2);
      expect(pending.resultState.playerHealth).toBe(18);
      expect(pending.playerTurnSkipped).toBe(false);
      expect(pending.resultState.rng).not.toBe(placeholderRng);
    }

    commitBattleTransition(
      pending?.kind === "enemy-turn" ? pending.resultState : readGameplayState().battle.battleState,
      null,
    );

    expect(readGameplayState().battle.pendingTransitionResumeRequired).toBe(false);
    expect(readGameplayState().battle.pendingBattleTransition).toBeNull();
  });

  it("rebinds world RNG when hydrating active combat from a stripped save", () => {
    setRunProgress({ rng: createRunRngState(() => 42 / 0x1_0000_0000) });
    const worldBefore = readGameplayState().run.activeRun.rng.counters.world;
    const strippedBattle = JSON.parse(JSON.stringify({ ...defaultBattleState(), turn: 5, playerHealth: 20 }));
    const strippedResult = JSON.parse(JSON.stringify({ ...defaultBattleState(), turn: 6, playerHealth: 19 }));

    initializeActiveBattle(strippedBattle, {
      kind: "enemy-turn",
      resultState: strippedResult,
      playerTurnSkipped: false,
    });

    const battle = readGameplayState().battle;
    expect(battle.battleState.rng).not.toBe(placeholderRng);
    battle.battleState.rng();
    expect(readGameplayState().run.activeRun.rng.counters.world).toBe(worldBefore + 1);

    const pending = battle.pendingBattleTransition;
    expect(pending?.kind).toBe("enemy-turn");
    if (pending?.kind === "enemy-turn") {
      expect(pending.resultState.rng).not.toBe(placeholderRng);
      pending.resultState.rng();
      expect(readGameplayState().run.activeRun.rng.counters.world).toBe(worldBefore + 2);
    }
  });

  it("keeps the committed root unchanged until the outer commit", () => {
    const before = useGameplayStateStore.getState();

    dispatchRunSessionCommand(() => {
      getRunDomainStore().setRunGold(125);
      getRunTransientStore().setHasActiveRun(true);

      expect(readGameplayState().run.activeRun.runGold).toBe(125);
      expect(useGameplayStateStore.getState()).toBe(before);
      expect(useGameplayStateStore.getState().run.activeRun.runGold).toBe(0);
      expect(useGameplayStateStore.getState().session.hasActiveRun).toBe(false);
    });

    const after = useGameplayStateStore.getState();
    expect(after).not.toBe(before);
    expect(after.run.activeRun.runGold).toBe(125);
    expect(after.session.hasActiveRun).toBe(true);
  });

  it("runs post-commit effects only after the committed snapshot is published", () => {
    const effect = vi.fn((result: number) => {
      expect(result).toBe(42);
      expect(readGameplayState().run.activeRun.runGold).toBe(42);
    });

    dispatchRunSessionCommand(
      () => {
        getRunDomainStore().setRunGold(42);
        return 42;
      },
      { afterCommit: effect },
    );

    expect(effect).toHaveBeenCalledOnce();
  });

  it("discards post-commit effects when the transaction rolls back", () => {
    const effect = vi.fn();

    expect(() =>
      dispatchRunSessionCommand(
        () => {
          getRunDomainStore().setRunGold(42);
          throw new Error("transaction failed");
        },
        { afterCommit: effect },
      ),
    ).toThrow("transaction failed");

    expect(effect).not.toHaveBeenCalled();
  });

  it("defers nested post-commit effects until the outer transaction commits", () => {
    const effect = vi.fn();

    dispatchRunSessionCommand(() => {
      getRunDomainStore().setRunGold(42);
      dispatchRunSessionCommand(() => getRunTransientStore().setHasActiveRun(true), { afterCommit: effect });
      expect(effect).not.toHaveBeenCalled();
    });

    expect(effect).toHaveBeenCalledOnce();
  });

  it("collapses nested transactions into the outer commit", () => {
    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));

    dispatchRunSessionCommand(() => {
      getRunDomainStore().setRunGold(10);
      dispatchRunSessionCommand(() => {
        getRunTransientStore().setHasActiveRun(true);
      });
      getRunDomainStore().setRunGold(20);
    });

    unsubscribe();

    expect(commits).toHaveLength(1);
    expect(getRunSessionRevision()).toBeGreaterThanOrEqual(commits[0]);
  });

  it("publishes a direct store mutation as one commit", () => {
    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));

    getRunDomainStore().setRunGold(7);

    unsubscribe();

    expect(commits).toHaveLength(1);
  });

  it("publishes one commit for command-backed run writes and RNG", () => {
    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));
    const rewardsRng = createRunRandomSource("rewards");

    dispatchRunSessionCommand(() => {
      rewardsRng();
      setRunGold(7);
    });

    unsubscribe();

    expect(commits).toHaveLength(1);
    expect(getRunDomainStore().activeRun.runGold).toBe(7);
    expect(getRunDomainStore().activeRun.rng.counters.rewards).toBe(1);
  });

  it("rolls back command-backed RNG together with gameplay state", () => {
    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));
    const rewardsRng = createRunRandomSource("rewards");

    expect(() =>
      dispatchRunSessionCommand(() => {
        rewardsRng();
        setRunGold(99);
        throw new Error("command failed");
      }),
    ).toThrow("command failed");

    unsubscribe();

    expect(commits).toHaveLength(0);
    expect(getRunDomainStore().activeRun.runGold).toBe(0);
    expect(getRunDomainStore().activeRun.rng.counters.rewards).toBe(0);
  });

  it("does not publish a commit for an unchanged transaction", () => {
    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));
    const before = getRunSessionRevision();

    dispatchRunSessionCommand(() => {});

    unsubscribe();

    expect(commits).toHaveLength(0);
    expect(getRunSessionRevision()).toBe(before);
  });

  it("publishes one commit for all persisted gameplay stores", () => {
    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));

    dispatchRunSessionCommand(() => {
      getRunDomainStore().setRunGold(125);
      getRunTransientStore().setHasActiveRun(true);
      getRunProfileStore().setMaterials({ wood: 1, iron: 0, herbs: 0, food: 0, crystal: 0 });
      useProfileStore.getState().setDiscoveredCardIds(["slash"]);
      useGearStore.getState().addCurrencies({ voidstone: 1 });
    });

    unsubscribe();

    expect(commits).toHaveLength(1);
    expect(getRunDomainStore().activeRun.runGold).toBe(125);
    expect(getRunTransientStore().hasActiveRun).toBe(true);
    expect(getRunProfileStore().materialInventory.wood).toBe(1);
    expect(useProfileStore.getState().discoveredCardIds).toEqual(["slash"]);
    expect(useGearStore.getState().craftingCurrencies.voidstone).toBe(1);
  });

  it("publishes Gear and active-run health changes as one aggregate commit", () => {
    const helm: GearInstance = {
      instanceId: "aggregate-health-helm",
      definitionId: "leather-helm-basic",
      affixes: [{ id: "max-health", value: 7 }],
    };
    const inventories = createEmptyGearInventories();
    inventories.knight = [helm];
    useGearStore.getState().initialize(inventories, createEmptyGearLoadouts());
    getRunDomainStore().setRunMaxHealth(30);
    getRunDomainStore().setRunPlayerHealth(30);
    getRunTransientStore().setHasActiveRun(true);

    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));

    dispatchGearMutationWithRunHealthSync({
      characterId: "knight",
      mutate: (gear) => gear.equip("knight", "helm", helm),
    });

    unsubscribe();

    expect(commits).toHaveLength(1);
    expect(getRunDomainStore().activeRun.runMaxHealth).toBe(37);
    expect(getRunDomainStore().activeRun.runPlayerHealth).toBe(30);
    expect(useGearStore.getState().loadouts.knight.helm).toBe(helm.instanceId);
  });

  it("restores every gameplay store and publishes no commit when work throws", () => {
    const initialVoidstone = useGearStore.getState().craftingCurrencies.voidstone;
    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));

    expect(() =>
      dispatchRunSessionCommand(() => {
        getRunDomainStore().setRunGold(999);
        getRunTransientStore().setHasActiveRun(true);
        getRunProfileStore().setMaterials({ wood: 9, iron: 0, herbs: 0, food: 0, crystal: 0 });
        useProfileStore.getState().setDiscoveredCardIds(["burn"]);
        useGearStore.getState().addCurrencies({ voidstone: 9 });
        throw new Error("transaction failed");
      }),
    ).toThrow("transaction failed");

    unsubscribe();

    expect(commits).toHaveLength(0);
    expect(getRunDomainStore().activeRun.runGold).toBe(0);
    expect(getRunTransientStore().hasActiveRun).toBe(false);
    expect(getRunProfileStore().materialInventory.wood).toBe(0);
    expect(useProfileStore.getState().discoveredCardIds).toEqual([]);
    expect(useGearStore.getState().craftingCurrencies.voidstone).toBe(initialVoidstone);
    expect(readGameplayState().run.activeRun.runGold).toBe(0);
    expect(readGameplayState().session.hasActiveRun).toBe(false);
  });

  it("hydrates the complete active run before publishing its commit", () => {
    getRunDomainStore().setRunGold(125);
    const savedRun = snapshotRun("shop");
    resetRunDomainStore();

    const commits: Array<{ gold: number; hasActiveRun: boolean; screen: string }> = [];
    const unsubscribe = subscribeRunSessionCommits(() => {
      commits.push({
        gold: getRunDomainStore().activeRun.runGold,
        hasActiveRun: getRunTransientStore().hasActiveRun,
        screen: getRunDomainStore().navigation.screen,
      });
    });

    restoreRun(savedRun, {}, {});
    unsubscribe();

    expect(commits).toEqual([{ gold: 125, hasActiveRun: true, screen: "shop" }]);
  });
});
