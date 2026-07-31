import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getRunSessionRevision,
  runSessionTransaction,
  subscribeRunSessionCommits,
  useRunSessionCommitStore,
} from "@/features/alchemy/shared/stores/run-session-transaction";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { getRunDomainStore, resetRunDomainStore } from "@/features/alchemy/shared/stores/run-domain-store";
import { getRunTransientStore } from "@/features/alchemy/shared/stores/run-transient-store";
import { getRunProfileStore } from "@/features/alchemy/shared/stores/run-profile-store";
import { useProfileStore } from "@/features/alchemy/shared/stores/profile-store";
import { useGearStore } from "@/features/alchemy/shared/stores/gear-store";
import { restoreRun, snapshotRun } from "@/features/alchemy/shared/stores/run-transitions";
import { dispatchGearMutationWithRunHealthSync } from "@/features/alchemy/shared/stores/gear-session-command";
import { createEmptyGearInventories, createEmptyGearLoadouts, type GearInstance } from "@/lib/gear";

beforeEach(() => {
  resetRunDomainStore();
  useProfileStore.setState(useProfileStore.getInitialState(), true);
  useGearStore.setState(useGearStore.getInitialState(), true);
});

describe("run-session transaction coordinator", () => {
  it("executes the public command boundary and runs its effect after commit", () => {
    const effect = vi.fn((gold: number) => {
      expect(useRunSessionCommitStore.getState().snapshot.domain.activeRun.runGold).toBe(gold);
    });

    const result = dispatchRunSessionCommand({
      execute: () => {
        getRunDomainStore().setRunGold(17);
        return 17;
      },
      afterCommit: effect,
    });

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

    runSessionTransaction(() => {
      getRunDomainStore().setRunGold(125);
      getRunTransientStore().setHasActiveRun(true);
    });

    unsubscribe();

    expect(commits).toHaveLength(1);
    expect(commits[0]).toMatchObject({ gold: 125, hasActiveRun: true });
    expect(commits[0].revision).toBeGreaterThan(0);
  });

  it("keeps the React-facing snapshot unchanged until the outer commit", () => {
    const before = useRunSessionCommitStore.getState().snapshot;

    runSessionTransaction(() => {
      getRunDomainStore().setRunGold(125);
      getRunTransientStore().setHasActiveRun(true);

      expect(useRunSessionCommitStore.getState().snapshot).toBe(before);
      expect(useRunSessionCommitStore.getState().snapshot.domain.activeRun.runGold).toBe(0);
      expect(useRunSessionCommitStore.getState().snapshot.transient.hasActiveRun).toBe(false);
    });

    const after = useRunSessionCommitStore.getState().snapshot;
    expect(after).not.toBe(before);
    expect(after.domain.activeRun.runGold).toBe(125);
    expect(after.transient.hasActiveRun).toBe(true);
  });

  it("runs post-commit effects only after the committed snapshot is published", () => {
    const effect = vi.fn((result: number) => {
      expect(result).toBe(42);
      expect(useRunSessionCommitStore.getState().snapshot.domain.activeRun.runGold).toBe(42);
    });

    runSessionTransaction(
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
      runSessionTransaction(
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

    runSessionTransaction(() => {
      getRunDomainStore().setRunGold(42);
      runSessionTransaction(() => getRunTransientStore().setHasActiveRun(true), { afterCommit: effect });
      expect(effect).not.toHaveBeenCalled();
    });

    expect(effect).toHaveBeenCalledOnce();
  });

  it("collapses nested transactions into the outer commit", () => {
    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));

    runSessionTransaction(() => {
      getRunDomainStore().setRunGold(10);
      runSessionTransaction(() => {
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

  it("does not publish a commit for an unchanged transaction", () => {
    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));
    const before = getRunSessionRevision();

    runSessionTransaction(() => {});

    unsubscribe();

    expect(commits).toHaveLength(0);
    expect(getRunSessionRevision()).toBe(before);
  });

  it("publishes one commit for all persisted gameplay stores", () => {
    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));

    runSessionTransaction(() => {
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
      runSessionTransaction(() => {
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
    expect(useRunSessionCommitStore.getState().snapshot.domain.activeRun.runGold).toBe(0);
    expect(useRunSessionCommitStore.getState().snapshot.transient.hasActiveRun).toBe(false);
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
