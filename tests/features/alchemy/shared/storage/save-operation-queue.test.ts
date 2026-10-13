import { describe, expect, it, vi } from "vitest";
import { SaveOperationQueue, type SaveWriteOutcome } from "@/features/alchemy/shared/storage/save-operation-queue";
import { createDefaultSaveData } from "@/features/alchemy/shared/storage/defaults";
import type { UnstampedSaveData } from "@/features/alchemy/shared/storage/types";
import { deferred } from "../../../../helpers/deferred";

function snapshot(gold: number) {
  return { ...createDefaultSaveData(), gold };
}

describe("SaveOperationQueue", () => {
  it("keeps a load between its preceding save and a later save without coalescing across it", async () => {
    const queue = new SaveOperationQueue();
    let gold = 0;
    const write = async (data: UnstampedSaveData) => {
      gold = data.gold;
      return "saved" as const;
    };
    const preceding = queue.enqueue(snapshot(1), write);
    const loaded = queue.enqueueLoad(async () => gold);
    const following = queue.enqueue(snapshot(2), write);
    expect(await preceding).toBe("saved");
    expect(await loaded).toBe(1);
    expect(await following).toBe("saved");
    expect(gold).toBe(2);
  });

  it("rejects a failed load while allowing the next write to complete", async () => {
    const queue = new SaveOperationQueue();
    const failure = new Error("load failed");
    const loading = queue.enqueueLoad(async () => {
      throw failure;
    });
    const saving = queue.enqueue(snapshot(1), async () => "saved");
    await expect(loading).rejects.toBe(failure);
    await expect(saving).resolves.toBe("saved");
    await queue.waitForIdle();
    expect(queue.isIdle).toBe(true);
  });

  it("drains pending loads and initialization writes before reporting idle", async () => {
    const queue = new SaveOperationQueue();
    const gate = deferred<void>();
    let gold = 0;
    const loading = queue.enqueueLoad(async () => {
      await gate.promise;
      gold = 31;
    });
    let drained = false;
    const draining = queue.waitForIdle().then(() => {
      drained = true;
    });
    await Promise.resolve();
    expect(drained).toBe(false);
    gate.resolve();
    await Promise.all([loading, draining]);
    expect(gold).toBe(31);
    expect(drained).toBe(true);
  });

  it("still clears and cancels autosave when another cancellation listener throws", async () => {
    const queue = new SaveOperationQueue();
    queue.subscribeCancellation(() => {
      throw new Error("subscriber failed");
    });
    const cancelled = vi.fn();
    queue.subscribeCancellation(cancelled);
    let present = true;
    let reloaded: Promise<boolean> | undefined;
    queue.subscribeCancellation(() => {
      reloaded = queue.enqueueLoad(async () => present);
    });
    const clear = vi.fn(async () => {
      present = false;
      return { ok: true };
    });
    await expect(queue.enqueueClear(clear)).resolves.toBe(true);
    expect(await reloaded).toBe(false);
    expect(clear).toHaveBeenCalledOnce();
    expect(cancelled).toHaveBeenCalledOnce();
    expect(queue.isClearPending).toBe(false);
    await expect(queue.enqueue(snapshot(2), async () => "saved")).resolves.toBe("saved");
  });

  it.each(["saved", "failed"] as const)(
    "superseded callers never inherit a replacement that is %s",
    async (outcome) => {
      const queue = new SaveOperationQueue();
      const gate = deferred<SaveWriteOutcome>();
      const write = vi.fn().mockReturnValueOnce(gate.promise).mockResolvedValue(outcome);
      const discardedWrite = vi.fn();
      const initial = queue.enqueue(snapshot(0), discardedWrite);
      const first = queue.enqueue(snapshot(1), write);
      await Promise.resolve();
      expect(await initial).toBe("superseded");
      expect(discardedWrite).not.toHaveBeenCalled();
      const second = queue.enqueue(snapshot(2), write);
      const third = queue.enqueue(snapshot(3), write);
      expect(second).not.toBe(third);
      let resolved = false;
      void second.then(() => {
        resolved = true;
      });
      await Promise.resolve();
      expect(resolved).toBe(true);
      gate.resolve("saved");
      expect(await first).toBe("saved");
      expect(await second).toBe("superseded");
      expect(await third).toBe(outcome);
      expect(write.mock.calls.map(([data]) => data.gold)).toEqual([1, 3]);
      expect(queue.isIdle).toBe(true);
    },
  );

  it("owns its snapshot so caller mutations after enqueue cannot corrupt the write", async () => {
    const queue = new SaveOperationQueue();
    const write = vi.fn().mockResolvedValue("saved");
    const data = snapshot(1);
    const outcome = queue.enqueue(data, write);
    data.gold = 999;
    expect(await outcome).toBe("saved");
    expect(write).toHaveBeenCalledExactlyOnceWith(snapshot(1));
  });

  it.each(["clear", "protection"])("%s cancels in-flight acknowledgement and pending writes", async (action) => {
    const queue = new SaveOperationQueue();
    const gate = deferred<SaveWriteOutcome>();
    const write = vi.fn().mockReturnValue(gate.promise);
    const first = queue.enqueue(snapshot(1), write);
    await Promise.resolve();
    const second = queue.enqueue(snapshot(2), write);
    const loading = queue.enqueueLoad(async () => undefined);
    const third = queue.enqueue(snapshot(3), write);
    const clear = action === "clear" ? queue.enqueueClear(async () => ({ ok: true })) : undefined;
    if (action === "protection") queue.setWritesDisabled(true);
    gate.resolve("saved");
    expect(await first).toBe("skipped");
    expect(await second).toBe("skipped");
    expect(await third).toBe("skipped");
    await loading;
    await clear;
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("recovers its runner after a thrown write", async () => {
    const queue = new SaveOperationQueue();
    expect(
      await queue.enqueue(snapshot(1), async () => {
        throw new Error("unavailable");
      }),
    ).toBe("failed");
    expect(await queue.enqueue(snapshot(2), async () => "saved")).toBe("saved");
  });

  it("blocks writes until all overlapping clears finish", async () => {
    const queue = new SaveOperationQueue();
    const gate = deferred<{ ok: boolean }>();
    const first = queue.enqueueClear(async () => ({ ok: true }));
    const second = queue.enqueueClear(() => gate.promise);
    await first;
    expect(queue.isIdle).toBe(false);
    let idle = false;
    const settled = queue.waitForIdle().then(() => {
      idle = true;
    });
    await Promise.resolve();
    expect(idle).toBe(false);
    const write = vi.fn().mockResolvedValue("saved");
    expect(await queue.enqueue(snapshot(1), write)).toBe("skipped");
    gate.resolve({ ok: true });
    await second;
    await settled;
    expect(queue.isIdle).toBe(true);
    expect(await queue.enqueue(snapshot(2), write)).toBe("saved");
  });

  it.each(["reported", "thrown"])("survives a throwing notification for a %s clear failure", async (failure) => {
    const queue = new SaveOperationQueue();
    const error = new Error("clear denied");
    const onError = vi.fn(() => {
      throw new Error("notification failed");
    });
    await expect(
      queue.enqueueClear(
        async () => {
          if (failure === "thrown") throw error;
          return { ok: false, error };
        },
        { onError },
      ),
    ).resolves.toBe(false);
    expect(onError).toHaveBeenCalledExactlyOnceWith(error);
    expect(queue.isClearPending).toBe(false);
    await expect(queue.enqueue(snapshot(2), async () => "saved")).resolves.toBe("saved");
    await expect(queue.enqueueClear(async () => ({ ok: true }))).resolves.toBe(true);
    await queue.waitForIdle();
  });

  it("rejects uncloneable snapshots without blocking later saves", async () => {
    const queue = new SaveOperationQueue();
    const write = vi.fn().mockResolvedValue("saved" as const);
    const invalid = { ...snapshot(1), unexpected: () => {} };
    expect(await queue.enqueue(invalid, write)).toBe("failed");
    expect(write).not.toHaveBeenCalled();
    expect(await queue.enqueue(snapshot(2), write)).toBe("saved");
  });
});
