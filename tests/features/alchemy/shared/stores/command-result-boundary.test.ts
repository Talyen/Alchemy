import { describe, expect, expectTypeOf, it, vi } from "vitest";
import type { SynchronousResult } from "@/features/alchemy/shared/stores/command-outcome";
import { createGameSession } from "@/features/alchemy/shared/stores/game-session";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-reads";
import {
  acceptCommand,
  dispatchRunSessionCommand,
  rejectCommand,
  subscribeRunSessionCommits,
} from "@/features/alchemy/shared/stores/run-session-command";
import {
  createDraftInstanceIdSource,
  createDraftRunRandomSource,
  setGold,
} from "@/features/alchemy/shared/stores/run-session-write-port";

expectTypeOf<SynchronousResult<{ callback: () => number; pending: Promise<number> }>>().toEqualTypeOf<{
  callback: never;
  pending: never;
}>();
expectTypeOf<SynchronousResult<ReadonlyMap<string, ReadonlySet<() => number>>>>().toEqualTypeOf<
  ReadonlyMap<string, ReadonlySet<never>>
>();

describe("command result and capability lifetimes", () => {
  it.each(["accepted", "rejected"] as const)("rejects executable %s results before publication", async (ending) => {
    const session = createGameSession({ runtimeInputs: { generateRunSeed: () => 42 } });
    const before = readGameplayState(session);
    const commit = vi.fn();
    const afterCommit = vi.fn();
    subscribeRunSessionCommits(commit, session);
    try {
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
    } finally {
      await session.dispose();
    }
  });

  it("rolls back and observes a rejected Promise nested in result data", async () => {
    const session = createGameSession();
    const before = readGameplayState(session);
    try {
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
    } finally {
      await session.dispose();
    }
  });

  it("detaches cyclic data and preserves aliases across container types", async () => {
    const session = createGameSession();
    try {
      const shared = { gold: 7 };
      const value = { shared, map: new Map([[shared, new Set([shared])]]), cycle: null as unknown };
      value.cycle = value;
      const result = dispatchRunSessionCommand(() => acceptCommand(value), undefined, session);
      expect(result.cycle).toBe(result);
      expect(result.map.get(result.shared)?.has(result.shared)).toBe(true);
      result.shared.gold = 99;
      expect(shared.gold).toBe(7);
    } finally {
      await session.dispose();
    }
  });

  it.each(["accepted", "rejected", "thrown"] as const)(
    "expires captured capabilities after a command is %s, including during another command",
    async (ending) => {
      const generateId = vi.fn(() => "instance");
      const session = createGameSession({ runtimeInputs: { generateRunSeed: () => 42, createInstanceId: generateId } });
      let rng!: () => number;
      let id!: () => string;
      try {
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
      } finally {
        await session.dispose();
      }
    },
  );
});
