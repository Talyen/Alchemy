import { createEmptyRewardState } from "@/lib/active-run-session";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import type { SynchronousResult } from "@/features/alchemy/shared/stores/commands/command-outcome";
import { createGameSession } from "@/features/alchemy/shared/stores/session/game-session";
import { readGameplayState } from "@/features/alchemy/shared/stores/session/gameplay-state-reads";
import {
  acceptCommand,
  dispatchRunSessionCommand,
  rejectCommand,
  subscribeRunSessionCommits,
  snapshotTransactionValue,
} from "@/features/alchemy/shared/stores/commands/run-session-command";
import {
  createDraftInstanceIdSource,
  createDraftRunRandomSource,
  setGold,
  setRewardState,
} from "@/features/alchemy/shared/stores/commands/run-session-write-port";

expectTypeOf<SynchronousResult<{ callback: () => number; pending: Promise<number> }>>().toEqualTypeOf<{
  callback: never;
  pending: never;
}>();
expectTypeOf<SynchronousResult<ReadonlyMap<string, ReadonlySet<() => number>>>>().toEqualTypeOf<
  ReadonlyMap<string, ReadonlySet<never>>
>();

expectTypeOf<SynchronousResult<Date & { callback: () => number }>>().toEqualTypeOf<Date & { callback: never }>();
expectTypeOf<SynchronousResult<Map<string, number> & { callback: () => number }>>().toEqualTypeOf<
  ReadonlyMap<string, number> & { callback: never }
>();

describe("command result and capability lifetimes", () => {
  it.each(["accepted", "rejected"] as const)("rejects executable %s results before publication", async (ending) => {
    await using session = createGameSession({ runtimeInputs: { generateRunSeed: () => 42 } });
    const before = readGameplayState(session);
    const commit = vi.fn();
    const afterCommit = vi.fn();
    subscribeRunSessionCommits(commit, session);

    expect(() =>
      dispatchRunSessionCommand(
        (transaction) => {
          setGold(transaction, 99);
          const rng = createDraftRunRandomSource(transaction, "world");
          rng();
          const result: unknown = { nested: new Map([["capability", new Set([rng])]]) };
          return ending === "accepted" ? acceptCommand(result) : rejectCommand("cancelled", result);
        },
        { afterCommit },
        session,
      ),
    ).toThrow(/data.*function/i);
    expect(readGameplayState(session)).toBe(before);
    expect(commit).not.toHaveBeenCalled();
    expect(afterCommit).not.toHaveBeenCalled();
    dispatchRunSessionCommand((transaction) => acceptCommand(setGold(transaction, 7)), undefined, session);
    expect(readGameplayState(session).runProfile.gold).toBe(7);
  });

  it("rolls back and observes a rejected Promise nested in result data", async () => {
    await using session = createGameSession();
    const before = readGameplayState(session);

    expect(() =>
      dispatchRunSessionCommand(
        (transaction) => {
          setGold(transaction, 99);
          const value: unknown = { result: [Promise.reject(new Error("nested failure"))] };
          return acceptCommand(value);
        },
        undefined,
        session,
      ),
    ).toThrow(/must be synchronous/);
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(readGameplayState(session)).toBe(before);
  });

  it("detaches cyclic data and preserves aliases across container types", async () => {
    await using session = createGameSession();

    const shared = { gold: 7 };
    const value = { shared, map: new Map([[shared, new Set([shared])]]), cycle: null as unknown };
    value.cycle = value;
    const result = dispatchRunSessionCommand(() => acceptCommand(value), undefined, session);
    expect(result.cycle).toBe(result);
    expect(result.map.get(result.shared)?.has(result.shared)).toBe(true);
    result.shared.gold = 99;
    expect(shared.gold).toBe(7);
  });

  it("preserves one graph across built-in metadata, ordinary data, and containers", async () => {
    await using session = createGameSession();

    const reward = { gold: 7 };
    const metadataKey = Symbol("reward");
    const when = Object.assign(new Date(42), { reward, owner: null as unknown });
    Object.defineProperty(when, metadataKey, { value: reward });
    const pattern = Object.assign(/reward/g, { when });
    pattern.lastIndex = 3;
    const value = { reward, when, pattern, map: new Map([[when, reward]]) };
    when.owner = value;
    const result = dispatchRunSessionCommand(() => acceptCommand(value), undefined, session);
    expect(result.when).toBeInstanceOf(Date);
    expect(result.when.getTime()).toBe(42);
    expect(result.when.reward).toBe(result.reward);
    expect(Reflect.get(result.when, metadataKey)).toBe(result.reward);
    expect(result.when.owner).toBe(result);
    expect(result.pattern.when).toBe(result.when);
    expect(result.pattern.lastIndex).toBe(3);
    expect(result.map.get(result.when)).toBe(result.reward);
    result.when.reward.gold = 99;
    expect(reward.gold).toBe(7);
  });

  it.each(["accepted", "rejected"] as const)(
    "rejects hidden capabilities in %s result metadata atomically",
    async (ending) => {
      await using session = createGameSession();
      const before = readGameplayState(session);
      const commit = vi.fn();
      const afterCommit = vi.fn();
      subscribeRunSessionCommits(commit, session);

      expect(() =>
        dispatchRunSessionCommand(
          (transaction) => {
            setGold(transaction, 99);
            const rng = createDraftRunRandomSource(transaction, "world");
            rng();
            const metadata = new Map();
            Object.defineProperty(metadata, "capability", { value: rng });
            const result: unknown = { metadata };
            return ending === "accepted" ? acceptCommand(result) : rejectCommand("cancelled", result);
          },
          { afterCommit },
          session,
        ),
      ).toThrow(/data.*function/i);
      expect(readGameplayState(session)).toBe(before);
      expect(commit).not.toHaveBeenCalled();
      expect(afterCommit).not.toHaveBeenCalled();
    },
  );

  it("rejects unsupported instances and accessors rather than silently changing their meaning", async () => {
    await using session = createGameSession();
    class Reward {
      constructor(readonly gold: number) {}
    }
    const getter = vi.fn(() => 7);
    const accessor = Object.defineProperty({}, "gold", { get: getter, enumerable: true });

    const before = readGameplayState(session);
    for (const value of [new Reward(7), accessor]) {
      expect(() =>
        dispatchRunSessionCommand(
          (transaction) => {
            setGold(transaction, 99);
            const result: unknown = value;
            return acceptCommand(result);
          },
          undefined,
          session,
        ),
      ).toThrow(/unsupported.*prototype|accessor/i);
      expect(readGameplayState(session)).toBe(before);
    }
    expect(getter).not.toHaveBeenCalled();
  });

  it("applies the same data ownership contract to setter inputs and explicit snapshots", async () => {
    await using session = createGameSession();
    const getter = vi.fn(() => []);
    const accessor = Object.defineProperty(createEmptyRewardState(), "choices", { get: getter, enumerable: true });
    const instance = Object.assign(new (class Reward {})(), createEmptyRewardState());

    const before = readGameplayState(session);
    for (const input of [accessor, instance]) {
      expect(() =>
        dispatchRunSessionCommand(
          (transaction) => {
            setGold(transaction, 99);
            setRewardState(transaction, input);
            return acceptCommand();
          },
          undefined,
          session,
        ),
      ).toThrow(/unsupported.*prototype|accessor/i);
      expect(readGameplayState(session)).toBe(before);
      expect(() => snapshotTransactionValue(input)).toThrow(/unsupported.*prototype|accessor/i);
    }
    expect(getter).not.toHaveBeenCalled();
  });

  it.each(["accepted", "rejected", "thrown"] as const)(
    "expires captured capabilities after a command is %s, including during another command",
    async (ending) => {
      const generateId = vi.fn(() => "instance");
      await using session = createGameSession({
        runtimeInputs: { generateRunSeed: () => 42, createInstanceId: generateId },
      });
      let rng!: () => number;
      let id!: () => string;

      const execute = () =>
        dispatchRunSessionCommand(
          (transaction) => {
            rng = createDraftRunRandomSource(transaction, "world");
            id = createDraftInstanceIdSource(transaction);
            expect(id()).toBe("instance");
            rng();
            if (ending === "thrown") throw new Error("abort");
            return ending === "accepted" ? acceptCommand() : rejectCommand("cancelled", undefined);
          },
          undefined,
          session,
        );
      if (ending === "thrown") expect(execute).toThrow("abort");
      else execute();
      const committed = readGameplayState(session);
      for (const invoke of [id, rng]) expect(invoke).toThrow(/open command draft/);
      dispatchRunSessionCommand(
        () => {
          for (const invoke of [id, rng]) expect(invoke).toThrow(/open command draft/);
          return acceptCommand();
        },
        undefined,
        session,
      );
      expect(generateId).toHaveBeenCalledTimes(1);
      expect(readGameplayState(session)).toBe(committed);
    },
  );
});
