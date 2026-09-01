import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  dispatchRunSessionCommand,
  subscribeRunSessionCommits,
} from "@/features/alchemy/shared/stores/run-session-command";
import { resetRunDomainStore, setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
import { mutateGearForTest } from "../../../../helpers/gameplay-store-test";
import { restoreRun, snapshotRun } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { dispatchGearMutationWithRunHealthSync } from "@/features/alchemy/shared/stores/gear-session-command";
import {
  beginBattleTransition,
  initializeActiveBattle,
  commitBattleTransition,
  createDraftRunRandomSource,
  setBattleState,
  setHasActiveBattle,
  setGold,
  withDraftWorldBattleRng,
  withRestingWorldBattleRng,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { setHasActiveRun } from "@/features/alchemy/shared/stores/write-port-session";
import {
  setDiscoveredCardIds,
  setMaterials as setRunProfileMaterials,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { addGearCurrencies } from "@/features/alchemy/shared/stores/gear-actions";
import { readGameplayState, useGameplayStateStore } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { readGearState } from "@/features/alchemy/shared/stores/gear-store";
import { readProfileStore } from "@/features/alchemy/shared/stores/profile-store";
import {
  readActiveRun,
  readActiveRunScreen,
  readHasActiveRun,
  readRunProfile,
} from "@/features/alchemy/shared/stores/run-reads";
import { defaultBattleState } from "@/lib/battle";
import { placeholderRng } from "@/lib/battle/rng";
import { createRunRngState } from "@/lib/run-rng";
import { createEmptyGearInventories, createEmptyGearLoadouts, type GearInstance } from "@/lib/gear";

beforeEach(() => {
  resetRunDomainStore();
});

describe("run-session transaction coordinator", () => {
  it("keeps the root data-only with one region per lifetime", () => {
    const root = readGameplayState();

    expect(root).not.toHaveProperty("activeRun");
    expect(root.run).toHaveProperty("activeRun");
    expect(root.session).toBeDefined();
    expect(root.battle).toBeDefined();
    expect(root.runProfile).toBeDefined();
    expect(root.profile).toBeDefined();
    expect(root.gear).toBeDefined();
    expect(root).not.toHaveProperty("runActions");
    expect(root).not.toHaveProperty("sessionActions");
    expect(root).not.toHaveProperty("gearActions");
  });

  it("executes the public command boundary and runs its effect after commit", () => {
    const effect = vi.fn((gold: number) => {
      expect(readGameplayState().runProfile.gold).toBe(gold);
    });

    const result = dispatchRunSessionCommand(
      (draft) => {
        setGold(draft, 17);
        return 17;
      },
      { afterCommit: effect },
    );

    expect(result).toBe(17);
    expect(effect).toHaveBeenCalledOnce();
  });

  it("publishes one commit after multiple store mutations", () => {
    const commits: Array<{ revision: number; gold: number; hasActiveRun: boolean }> = [];
    const beforeRevision = readGameplayState().revision;
    const unsubscribe = subscribeRunSessionCommits((revision) => {
      commits.push({
        revision,
        gold: readRunProfile().gold,
        hasActiveRun: readHasActiveRun(),
      });
    });

    dispatchRunSessionCommand((draft) => {
      setGold(draft, 125);
      setHasActiveRun(draft, true);
    });

    unsubscribe();

    expect(commits).toHaveLength(1);
    expect(commits[0]).toMatchObject({ gold: 125, hasActiveRun: true });
    expect(commits[0].revision).toBe(beforeRevision + 1);
  });

  it("persists a battle continuation with the intermediate state in one commit", () => {
    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));
    const intermediate = { ...defaultBattleState(), turnPhase: "enemy" as const, hand: [] };
    const resultState = { ...defaultBattleState(), turn: 2, playerHealth: 18 };

    dispatchRunSessionCommand((draft) =>
      beginBattleTransition(
        draft,
        intermediate,
        { kind: "enemy-turn", resultState, playerTurnSkipped: false },
        { hand: [], turnPhase: "enemy" },
      ),
    );

    unsubscribe();

    expect(commits).toHaveLength(1);
    expect(readGameplayState().battle.battleState).toEqual({
      ...intermediate,
      rng: expect.any(Function),
    });
    expect(readGameplayState().battle.pendingBattleTransition).toEqual({
      kind: "enemy-turn",
      resultState: { ...resultState, rng: expect.any(Function) },
      playerTurnSkipped: false,
    });
    expect(readGameplayState().battle.pendingTransitionResumeRequired).toBe(false);
  });

  it("marks hydrated pending transitions for resume without live beginBattleTransition", () => {
    const resultState = { ...defaultBattleState(), turn: 2, playerHealth: 18 };
    const intermediate = { ...defaultBattleState(), turnPhase: "enemy" as const, hand: [] };

    dispatchRunSessionCommand((draft) =>
      initializeActiveBattle(draft, intermediate, {
        kind: "enemy-turn",
        resultState,
        playerTurnSkipped: false,
      }),
    );

    expect(readGameplayState().battle.pendingTransitionResumeRequired).toBe(true);
    const pending = readGameplayState().battle.pendingBattleTransition;
    expect(pending?.kind).toBe("enemy-turn");
    if (pending?.kind === "enemy-turn") {
      expect(pending.resultState.turn).toBe(2);
      expect(pending.resultState.playerHealth).toBe(18);
      expect(pending.playerTurnSkipped).toBe(false);
      expect(pending.resultState.rng).not.toBe(placeholderRng);
    }

    dispatchRunSessionCommand((draft) =>
      commitBattleTransition(
        draft,
        pending?.kind === "enemy-turn" ? pending.resultState : readGameplayState().battle.battleState,
        null,
      ),
    );

    expect(readGameplayState().battle.pendingTransitionResumeRequired).toBe(false);
    expect(readGameplayState().battle.pendingBattleTransition).toBeNull();
  });

  it("rebinds world RNG when hydrating active combat from a stripped save", () => {
    setRunProgress({ rng: createRunRngState(() => 42 / 0x1_0000_0000) });
    const worldBefore = readGameplayState().run.activeRun.rng.counters.world;
    const strippedBattle = JSON.parse(JSON.stringify({ ...defaultBattleState(), turn: 5, playerHealth: 20 }));
    const strippedResult = JSON.parse(JSON.stringify({ ...defaultBattleState(), turn: 6, playerHealth: 19 }));

    dispatchRunSessionCommand((draft) =>
      initializeActiveBattle(draft, strippedBattle, {
        kind: "enemy-turn",
        resultState: strippedResult,
        playerTurnSkipped: false,
      }),
    );

    const battle = readGameplayState().battle;
    expect(battle.battleState.rng).not.toBe(placeholderRng);
    expect(() => battle.battleState.rng()).toThrow(/withDraftWorldBattleRng/);

    dispatchRunSessionCommand((draft) => {
      createDraftRunRandomSource(draft, "world")();
    });
    expect(readGameplayState().run.activeRun.rng.counters.world).toBe(worldBefore + 1);

    const pending = battle.pendingBattleTransition;
    expect(pending?.kind).toBe("enemy-turn");
    if (pending?.kind === "enemy-turn") {
      expect(pending.resultState.rng).not.toBe(placeholderRng);
      expect(() => pending.resultState.rng()).toThrow(/withDraftWorldBattleRng/);
      dispatchRunSessionCommand((draft) => {
        createDraftRunRandomSource(draft, "world")();
      });
      expect(readGameplayState().run.activeRun.rng.counters.world).toBe(worldBefore + 2);
    }
  });

  it("returns resting rng from battle states written inside a command", () => {
    setRunProgress({ rng: createRunRngState(() => 42 / 0x1_0000_0000) });
    const returned = dispatchRunSessionCommand((draft) => {
      const bound = withDraftWorldBattleRng(draft, draft.battle.battleState);
      const next = { ...bound, playerHealth: Math.max(1, bound.playerHealth - 1) };
      setBattleState(draft, next);
      return withRestingWorldBattleRng(draft, next);
    });

    expect(() => returned.rng()).toThrow(/withDraftWorldBattleRng/);
    expect(() => readGameplayState().battle.battleState.rng()).toThrow(/withDraftWorldBattleRng/);
  });

  it("keeps the committed root unchanged until the outer commit", () => {
    const before = useGameplayStateStore.getState();

    dispatchRunSessionCommand((draft) => {
      setGold(draft, 125);
      setHasActiveRun(draft, true);

      expect(draft.runProfile.gold).toBe(125);
      expect(useGameplayStateStore.getState()).toBe(before);
      expect(useGameplayStateStore.getState().runProfile.gold).toBe(0);
      expect(useGameplayStateStore.getState().session.hasActiveRun).toBe(false);
    });

    const after = useGameplayStateStore.getState();
    expect(after).not.toBe(before);
    expect(after.runProfile.gold).toBe(125);
    expect(after.session.hasActiveRun).toBe(true);
  });

  it("runs post-commit effects only after the committed snapshot is published", () => {
    const effect = vi.fn((result: number) => {
      expect(result).toBe(42);
      expect(readGameplayState().runProfile.gold).toBe(42);
    });

    dispatchRunSessionCommand(
      (draft) => {
        setGold(draft, 42);
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
        (draft) => {
          setGold(draft, 42);
          throw new Error("transaction failed");
        },
        { afterCommit: effect },
      ),
    ).toThrow("transaction failed");

    expect(effect).not.toHaveBeenCalled();
  });

  it("publishes one commit for compound draft mutations", () => {
    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));

    dispatchRunSessionCommand((draft) => {
      setGold(draft, 10);
      setHasActiveBattle(draft, true);
      setGold(draft, 20);
    });

    unsubscribe();

    expect(commits).toHaveLength(1);
    expect(readGameplayState().revision).toBeGreaterThanOrEqual(commits[0]);
    expect(readRunProfile().gold).toBe(20);
  });

  it("publishes a direct store mutation as one commit", () => {
    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));

    dispatchRunSessionCommand((draft) => setGold(draft, 7));

    unsubscribe();

    expect(commits).toHaveLength(1);
  });

  it("publishes one commit for command-backed run writes and RNG", () => {
    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));
    dispatchRunSessionCommand((draft) => {
      createDraftRunRandomSource(draft, "rewards")();
      expect(draft.run.activeRun.rng.counters.rewards).toBe(1);
      setGold(draft, 7);
    });

    unsubscribe();

    expect(commits).toHaveLength(1);
    expect(readRunProfile().gold).toBe(7);
    expect(readActiveRun().rng.counters.rewards).toBe(1);
  });

  it("rolls back command-backed RNG together with gameplay state", () => {
    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));
    expect(() =>
      dispatchRunSessionCommand((draft) => {
        createDraftRunRandomSource(draft, "rewards")();
        setGold(draft, 99);
        throw new Error("command failed");
      }),
    ).toThrow("command failed");

    unsubscribe();

    expect(commits).toHaveLength(0);
    expect(readRunProfile().gold).toBe(0);
    expect(readActiveRun().rng.counters.rewards).toBe(0);
  });

  it("does not publish a commit for an unchanged transaction", () => {
    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));
    const before = readGameplayState().revision;

    dispatchRunSessionCommand((draft) => void draft);

    unsubscribe();

    expect(commits).toHaveLength(0);
    expect(readGameplayState().revision).toBe(before);
  });

  it("publishes one commit for all persisted gameplay stores", () => {
    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));

    dispatchRunSessionCommand((draft) => {
      setGold(draft, 125);
      setHasActiveRun(draft, true);
      setRunProfileMaterials(draft, { wood: 1, iron: 0, herbs: 0, food: 0, crystal: 0 });
      setDiscoveredCardIds(draft, ["slash"]);
      addGearCurrencies(draft.gear, { voidstone: 1 });
    });

    unsubscribe();

    expect(commits).toHaveLength(1);
    expect(readRunProfile().gold).toBe(125);
    expect(readHasActiveRun()).toBe(true);
    expect(readRunProfile().materialInventory.wood).toBe(1);
    expect(readProfileStore().discoveredCardIds).toEqual(["slash"]);
    expect(readGearState().craftingCurrencies.voidstone).toBe(1);
  });

  it("publishes Gear and active-run health changes as one aggregate commit", () => {
    const armor: GearInstance = {
      instanceId: "aggregate-health-armor",
      definitionId: "leather-armor-basic",
      affixes: [{ id: "max-health", value: 7 }],
    };
    const inventories = createEmptyGearInventories();
    inventories.knight = [armor];
    mutateGearForTest((gear) => gear.initialize(inventories, createEmptyGearLoadouts()));
    setRunProgress({ runMaxHealth: 30, runPlayerHealth: 30 });
    dispatchRunSessionCommand((draft) => setHasActiveRun(draft, true));

    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));

    dispatchGearMutationWithRunHealthSync({
      mutate: (gear) => gear.equip("knight", "body", armor),
    });

    unsubscribe();

    expect(commits).toHaveLength(1);
    expect(readActiveRun().runMaxHealth).toBe(37);
    expect(readActiveRun().runPlayerHealth).toBe(30);
    expect(readGearState().loadouts.knight.body).toBe(armor.instanceId);
  });

  it("restores every gameplay store and publishes no commit when work throws", () => {
    const initialVoidstone = readGearState().craftingCurrencies.voidstone;
    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));

    expect(() =>
      dispatchRunSessionCommand((draft) => {
        setGold(draft, 999);
        setHasActiveRun(draft, true);
        setRunProfileMaterials(draft, { wood: 9, iron: 0, herbs: 0, food: 0, crystal: 0 });
        setDiscoveredCardIds(draft, ["burn"]);
        addGearCurrencies(draft.gear, { voidstone: 9 });
        throw new Error("transaction failed");
      }),
    ).toThrow("transaction failed");

    unsubscribe();

    expect(commits).toHaveLength(0);
    expect(readRunProfile().gold).toBe(0);
    expect(readHasActiveRun()).toBe(false);
    expect(readRunProfile().materialInventory.wood).toBe(0);
    expect(readProfileStore().discoveredCardIds).toEqual([]);
    expect(readGearState().craftingCurrencies.voidstone).toBe(initialVoidstone);
    expect(readGameplayState().runProfile.gold).toBe(0);
    expect(readGameplayState().session.hasActiveRun).toBe(false);
  });

  it("hydrates the complete active run before publishing its commit", () => {
    dispatchRunSessionCommand((draft) => setGold(draft, 125));
    const savedRun = snapshotRun("shop");
    resetRunDomainStore();

    const commits: Array<{ gold: number; hasActiveRun: boolean; screen: string }> = [];
    const unsubscribe = subscribeRunSessionCommits(() => {
      commits.push({
        gold: readRunProfile().gold,
        hasActiveRun: readHasActiveRun(),
        screen: readActiveRunScreen(),
      });
    });

    restoreRun(savedRun, {}, {});
    unsubscribe();

    expect(commits).toEqual([{ gold: 0, hasActiveRun: true, screen: "shop" }]);
  });

  it("keeps committed session, profile, and gear regions free of command functions", () => {
    setRunProgress({ gold: 11, roomsEncountered: 3 });
    setRunSession({ hasActiveRun: true });
    mutateGearForTest((gear) => gear.addTrinket("bone-charm"));

    const root = readGameplayState();
    for (const [label, region] of [
      ["session", root.session],
      ["runProfile", root.runProfile],
      ["profile", root.profile],
      ["gear", root.gear],
    ] as const) {
      for (const [key, value] of Object.entries(region)) {
        expect(typeof value, `${label}.${key}`).not.toBe("function");
      }
    }
  });
});
