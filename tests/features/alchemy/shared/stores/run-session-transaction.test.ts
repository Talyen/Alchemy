import { getBattleForTest } from "../../../../helpers/run-domain-store-test";
import { readBattle } from "@/features/alchemy/shared/stores/run-reads";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptCommand,
  rejectCommand,
  type CommandOutcome,
  dispatchGameplayCommand,
  createGameplayCommand,
  type GameplayDraft,
  subscribeRunSessionCommits,
} from "@/features/alchemy/shared/stores/gameplay-command";
import { resetRunDomainStore, setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
import { mutateGearForTest } from "../../../../helpers/run-domain-store-test";
import { restoreRun, snapshotRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import { dispatchGearMutationWithRunHealthSync } from "@/features/alchemy/shared/stores/gear-session-command";
import {
  createDraftRunRandomSource,
  setHasActiveRun,
  setGold,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import {
  setBattleState,
  withDraftWorldBattleRng,
  snapshotBattleState,
} from "@/features/alchemy/shared/stores/write/run-battle";
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
import { createRunRngState } from "@/lib/rng";
import { createEmptyGearInventories, createEmptyGearLoadouts, type GearInstance } from "@/lib/gear";

beforeEach(() => {
  resetRunDomainStore();
});

describe("run-session transaction coordinator", () => {
  it.each([false, null])("rolls back rejected gameplay and RNG with fallback %s", (fallback) => {
    const before = readGameplayState();
    const onCommit = vi.fn();
    const effect = vi.fn();
    const unsubscribe = subscribeRunSessionCommits(onCommit);
    try {
      const command = createGameplayCommand(
        (draft, gold: number) => {
          setGold(draft, gold);
          setHasActiveRun(draft, true);
          setDiscoveredCardIds(draft, ["slash"]);
          addGearCurrencies(draft.gear, { voidstone: 1 });
          createDraftRunRandomSource(draft, "shops")();
          return rejectCommand("A later validation rejected the action", fallback);
        },
        { afterCommit: effect },
      );

      expect(command(99)).toBe(fallback);
      expect(readGameplayState()).toBe(before);
      expect(onCommit).not.toHaveBeenCalled();
      expect(effect).not.toHaveBeenCalled();

      // Rejection must release the guard and leave the next seeded draw untouched.
      dispatchGameplayCommand(
        (draft) => {
          createDraftRunRandomSource(draft, "shops")();
          setGold(draft, 7);
          return acceptCommand(false);
        },
        { afterCommit: effect },
      );
      expect(readRunProfile().gold).toBe(7);
      expect(readActiveRun().rng.counters.shops).toBe(before.run.activeRun.rng.counters.shops + 1);
      expect(readGameplayState().revision).toBe(before.revision + 1);
      expect(onCommit).toHaveBeenCalledExactlyOnceWith(before.revision + 1);
      expect(effect).toHaveBeenCalledExactlyOnceWith(false);
    } finally {
      unsubscribe();
    }
  });

  it("discards writes from an untyped callback that omits an explicit outcome", () => {
    const before = readGameplayState();
    const effect = vi.fn();
    const invalid = ((draft: GameplayDraft) => {
      setGold(draft, 99);
      return false;
    }) as unknown as Parameters<typeof dispatchGameplayCommand>[0];

    expect(() => dispatchGameplayCommand(invalid, { afterCommit: effect })).toThrow(/explicit accepted or rejected/);
    expect(readGameplayState()).toBe(before);
    expect(effect).not.toHaveBeenCalled();
  });

  it("executes the public command boundary and runs its effect after commit", () => {
    const effect = vi.fn((gold: number) => {
      expect(readGameplayState().runProfile.gold).toBe(gold);
    });

    const result = dispatchGameplayCommand(
      (draft) => {
        setGold(draft, 17);
        return acceptCommand(17);
      },
      { afterCommit: effect },
    );

    expect(result).toBe(17);
    expect(effect).toHaveBeenCalledOnce();
  });

  it.each([
    { name: "resolved Promise", result: () => Promise.resolve(1) },
    { name: "rejected Promise", result: () => Promise.reject(new Error("async failure")) },
    { name: "custom thenable", result: () => ({ then: (resolve: (value: number) => void) => resolve(1) }) },
    {
      name: "callable thenable",
      result: () => Object.assign(() => 1, { then: (resolve: (value: number) => void) => resolve(1) }),
    },
    {
      name: "async draft continuation",
      result: async (draft: GameplayDraft) => {
        await Promise.resolve();
        setGold(draft, 100);
      },
    },
  ])("rolls back a $name even when its return type is erased", async ({ result }) => {
    const before = readGameplayState();
    const onCommit = vi.fn();
    const effect = vi.fn();
    const unsubscribe = subscribeRunSessionCommits(onCommit);
    try {
      const execute = (draft: GameplayDraft): unknown => {
        setGold(draft, 99);
        createDraftRunRandomSource(draft, "world")();
        return result(draft);
      };

      expect(() =>
        dispatchGameplayCommand((...args: Parameters<typeof execute>) => acceptCommand(execute(...args)), {
          afterCommit: effect,
        }),
      ).toThrow(/must be synchronous/);
      expect(readGameplayState()).toBe(before);
      expect(onCommit).not.toHaveBeenCalled();
      expect(effect).not.toHaveBeenCalled();

      dispatchGameplayCommand((draft) => acceptCommand(setGold(draft, 7)));
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });

      expect(readGameplayState().runProfile.gold).toBe(7);
      expect(readGameplayState().revision).toBe(before.revision + 1);
      expect(readActiveRun().rng.counters.world).toBe(before.run.activeRun.rng.counters.world);
      expect(onCommit).toHaveBeenCalledExactlyOnceWith(before.revision + 1);
      expect(effect).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
    }
  });

  it("enforces synchronous results through command factories and gear wrappers", async () => {
    const before = readGameplayState();
    const command = createGameplayCommand((draft, gold: number): CommandOutcome<unknown> => {
      setGold(draft, gold);
      const result: unknown = Promise.resolve(gold);
      return acceptCommand(result);
    });

    expect(() => command(99)).toThrow(/must be synchronous/);
    expect(() =>
      dispatchGearMutationWithRunHealthSync({
        mutate: (gear): unknown => {
          gear.addCurrencies({ voidstone: 1 });
          return Promise.resolve(1);
        },
      }),
    ).toThrow(/must be synchronous/);
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(readGameplayState()).toBe(before);
  });

  it("rolls back nested dispatch and releases the command guard", () => {
    const before = readGameplayState();
    const effect = vi.fn();
    expect(() =>
      dispatchGameplayCommand(
        (draft) => {
          setGold(draft, 99);
          dispatchGameplayCommand((nested) => acceptCommand(setHasActiveRun(nested, true)));

          return acceptCommand();
        },
        { afterCommit: effect },
      ),
    ).toThrow(/nested command/);
    expect(readGameplayState()).toBe(before);
    expect(effect).not.toHaveBeenCalled();

    dispatchGameplayCommand((draft) => acceptCommand(setGold(draft, 7)));
    expect(readGameplayState().revision).toBe(before.revision + 1);
    expect(readRunProfile().gold).toBe(7);
  });

  it("allows a completion effect to dispatch a separate command", () => {
    const before = readGameplayState();
    const effect = vi.fn(() => {
      expect(readRunProfile().gold).toBe(7);
      dispatchGameplayCommand((draft) => acceptCommand(setGold(draft, 8)));
    });
    dispatchGameplayCommand((draft) => acceptCommand(setGold(draft, 7)), { afterCommit: effect });

    expect(effect).toHaveBeenCalledOnce();
    expect(readRunProfile().gold).toBe(8);
    expect(readGameplayState().revision).toBe(before.revision + 2);
  });

  it("retains the commit and releases the guard when a completion effect throws", () => {
    const before = readGameplayState();
    const effect = vi.fn(() => {
      throw new Error("effect failed");
    });
    expect(() => dispatchGameplayCommand((draft) => acceptCommand(setGold(draft, 7)), { afterCommit: effect })).toThrow(
      "effect failed",
    );
    expect(effect).toHaveBeenCalledOnce();
    expect(readRunProfile().gold).toBe(7);
    expect(readGameplayState().revision).toBe(before.revision + 1);

    dispatchGameplayCommand((draft) => acceptCommand(setGold(draft, 8)));
    expect(readRunProfile().gold).toBe(8);
    expect(readGameplayState().revision).toBe(before.revision + 2);
  });

  it("returns serializable battle snapshots from commands", () => {
    setRunProgress({ rng: createRunRngState(() => 42 / 0x1_0000_0000) });
    const returned = dispatchGameplayCommand((draft) => {
      const bound = withDraftWorldBattleRng(draft, getBattleForTest(draft).battleState);
      const next = { ...bound, playerHealth: Math.max(1, bound.playerHealth - 1) };
      setBattleState(draft, next);
      return acceptCommand(snapshotBattleState(next));
    });

    expect(returned).not.toHaveProperty("rng");
    expect(readBattle().battleState).not.toHaveProperty("rng");
  });

  it("keeps the committed root unchanged until the outer commit", () => {
    const before = useGameplayStateStore.getState();

    dispatchGameplayCommand((draft) => {
      setGold(draft, 125);
      setHasActiveRun(draft, true);

      expect(draft.runProfile.gold).toBe(125);
      expect(useGameplayStateStore.getState()).toBe(before);
      expect(useGameplayStateStore.getState().runProfile.gold).toBe(0);
      expect(useGameplayStateStore.getState().session.activity.kind !== "inactive").toBe(false);

      return acceptCommand();
    });

    const after = useGameplayStateStore.getState();
    expect(after).not.toBe(before);
    expect(after.runProfile.gold).toBe(125);
    expect(after.session.activity.kind !== "inactive").toBe(true);
  });

  it("runs completion effects for unchanged commands without publishing a revision", () => {
    const before = readGameplayState();
    const onCommit = vi.fn();
    const unsubscribe = subscribeRunSessionCommits(onCommit);
    const effect = vi.fn();

    const result = dispatchGameplayCommand(
      (draft) => {
        setGold(draft, before.runProfile.gold);
        return acceptCommand("navigate");
      },
      { afterCommit: effect },
    );
    unsubscribe();

    expect(result).toBe("navigate");
    expect(readGameplayState()).toBe(before);
    expect(onCommit).not.toHaveBeenCalled();
    expect(effect).toHaveBeenCalledExactlyOnceWith("navigate");
  });

  it("discards post-commit effects when the transaction rolls back", () => {
    const effect = vi.fn();

    expect(() =>
      dispatchGameplayCommand(
        (draft) => {
          setGold(draft, 42);
          throw new Error("transaction failed");
        },
        { afterCommit: effect },
      ),
    ).toThrow("transaction failed");

    expect(effect).not.toHaveBeenCalled();
  });

  it("publishes one commit for command-backed run writes and RNG", () => {
    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));
    dispatchGameplayCommand((draft) => {
      createDraftRunRandomSource(draft, "rewards")();
      expect(draft.run.activeRun.rng.counters.rewards).toBe(1);
      setGold(draft, 7);

      return acceptCommand();
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
      dispatchGameplayCommand((draft) => {
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

  it("publishes one commit for all persisted gameplay stores", () => {
    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));

    dispatchGameplayCommand((draft) => {
      setGold(draft, 125);
      setHasActiveRun(draft, true);
      setRunProfileMaterials(draft, { wood: 1, iron: 0, herbs: 0, food: 0, gems: 0, stone: 0, hide: 0 });
      setDiscoveredCardIds(draft, ["slash"]);
      addGearCurrencies(draft.gear, { voidstone: 1 });

      return acceptCommand();
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
    dispatchGameplayCommand((draft) => acceptCommand(setHasActiveRun(draft, true)));

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
      dispatchGameplayCommand((draft) => {
        setGold(draft, 999);
        setHasActiveRun(draft, true);
        setRunProfileMaterials(draft, { wood: 9, iron: 0, herbs: 0, food: 0, gems: 0, stone: 0, hide: 0 });
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
    expect(readGameplayState().session.activity.kind !== "inactive").toBe(false);
  });

  it("hydrates the complete active run before publishing its commit", () => {
    dispatchGameplayCommand((draft) => acceptCommand(setGold(draft, 125)));
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
