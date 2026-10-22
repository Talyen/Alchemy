import {
  mutateRunForTest,
  setBattleActiveForTest as setHasActiveBattle,
  resetRunDomainStore,
} from "../../../../helpers/run-domain-store-test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGameSession } from "@/features/alchemy/shared/stores/game-session";
import { readGearState } from "@/features/alchemy/shared/stores/gear-store";
import { readProfileStore } from "@/features/alchemy/shared/stores/profile-store";
import { subscribeRunSessionCommits } from "@/features/alchemy/shared/stores/run-session-command";
import { copyForPublication, deepFreeze } from "@/features/alchemy/shared/stores/store-utils";
import { useGameplayStateStore } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-reads";
import { acceptCommand, dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  setFinishedRunCharacters,
  setGold,
  setHasActiveRun,
  setMaterials as setRunProfileMaterials,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { readActiveRun, readBattle, readRunProfile, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { defaultGameSession } from "@/app/application-session";

beforeEach(() => {
  resetRunDomainStore();
});

describe("aggregate read ports", () => {
  it("reads every gameplay lifetime from the authoritative aggregate", () => {
    mutateRunForTest((draft) => {
      setGold(draft, 23);
      setHasActiveRun(draft, true);
      setHasActiveBattle(draft, true);
      setRunProfileMaterials(draft, { wood: 4, iron: 0, herbs: 0, food: 0, gems: 0, stone: 0, hide: 0 });
      setFinishedRunCharacters(draft, ["knight"]);
    });

    expect(readRunProfile(defaultGameSession).gold).toBe(23);
    expect(readRunSession(defaultGameSession).hasActiveRun).toBe(true);
    expect(readBattle(defaultGameSession).hasActiveBattle).toBe(true);
    expect(readRunProfile(defaultGameSession).materialInventory.wood).toBe(4);
    expect(readGameplayState(defaultGameSession).profile.finishedRunCharacters).toEqual(["knight"]);
  });

  it("keeps the aggregate publisher private", () => {
    expect(useGameplayStateStore).not.toHaveProperty("setState");
    expect(useGameplayStateStore).not.toHaveProperty("commit");
  });

  it.each([true, false])("protects fresh and committed gameplay with DEV=%s", async (development) => {
    vi.stubEnv("DEV", development);
    const gameSession = createGameSession({ runtimeInputs: { generateRunSeed: () => 7 } });
    try {
      // The owner must protect the initial aggregate before any projection is read.
      const initial = readGameplayState(gameSession);
      expect(() => {
        initial.revision = 900;
      }).toThrow(TypeError);
      expect(() => {
        initial.runProfile.gold = 900;
      }).toThrow(TypeError);
      expect(() => {
        initial.run.activeRun.rng.counters.world = 900;
      }).toThrow(TypeError);
      expect(() => readActiveRun(gameSession).runDeck.pop()).toThrow(TypeError);
      expect(() => readProfileStore(gameSession).discoveredCardIds.push("slash")).toThrow(TypeError);
      expect(() => readGearState(gameSession).ownedTrinketIds.push("unearned")).toThrow(TypeError);
      expect(() => {
        readRunProfile(gameSession).materialInventory.wood = 900;
      }).toThrow(TypeError);
      expect(() => readRunSession(gameSession).rewardFlow.state.destinations.pop()).toThrow(TypeError);
      expect(readGameplayState(gameSession)).toBe(initial);

      const observed: Array<{ state: ReturnType<typeof readGameplayState>; frozen: boolean; writable: boolean }> = [];
      const stop = subscribeRunSessionCommits(() => {
        const state = readGameplayState(gameSession);
        observed.push({ state, frozen: Object.isFrozen(state), writable: Reflect.set(state, "revision", 900) });
      }, gameSession);
      try {
        dispatchRunSessionCommand((transaction) => acceptCommand(setGold(transaction, 23)), undefined, gameSession);
      } finally {
        stop();
      }
      const committed = readGameplayState(gameSession);
      expect(observed).toEqual([{ state: committed, frozen: true, writable: false }]);
      expect(() => {
        committed.revision = 900;
      }).toThrow(TypeError);
      expect(() => {
        committed.runProfile.gold = 900;
      }).toThrow(TypeError);
      expect(committed.revision).toBe(initial.revision + 1);
      expect(committed.runProfile.gold).toBe(23);
      expect(initial.runProfile.gold).toBe(0);
      expect(committed.gear).toBe(initial.gear);
      expect(readGearState(gameSession).inventories).toBe(committed.gear.inventories);
    } finally {
      await gameSession.dispose();
      vi.unstubAllEnvs();
    }
  });

  it("copies unowned aliases and cycles without trusting shallow Object.freeze", () => {
    const borrowed = deepFreeze({ values: [1] });
    const mutable = { values: [2] };
    const input = { borrowed, first: mutable, second: mutable, self: null as unknown };
    input.self = input;
    Object.freeze(input);
    const copied = deepFreeze(copyForPublication(input));
    expect(copied.borrowed).toBe(borrowed);
    expect(copied.self).toBe(copied);
    expect(copied.first).toBe(copied.second);
    expect(copied.first).not.toBe(mutable);
    mutable.values.push(3);
    expect(copied.first.values).toEqual([2]);
    expect(copyForPublication(copied)).toBe(copied);
  });

  it("traverses shallow-frozen and cyclic shared data", () => {
    const child = { progress: [1] };
    const shallow = Object.freeze({ child });
    const tree = { shallow, self: null as unknown };
    tree.self = tree;
    expect(deepFreeze(tree)).toBe(tree);
    expect(() => child.progress.push(2)).toThrow(TypeError);
    expect(deepFreeze(tree)).toBe(tree);
  });
});
