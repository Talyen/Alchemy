import { describe, expect, it, vi } from "vitest";
import { SaveWriteQueue, type SaveWriteOutcome } from "@/features/alchemy/shared/storage/save-write-queue";
import { createDefaultSaveData } from "@/features/alchemy/shared/storage/defaults";
import { deferred } from "../../../../helpers/deferred";

function snapshot(gold: number) {
  return { ...createDefaultSaveData(), gold };
}

describe("SaveWriteQueue", () => {
  it("still clears and cancels autosave when another cancellation listener throws", async () => {
    const queue = new SaveWriteQueue();
    queue.subscribeCancellation(() => {
      throw new Error("subscriber failed");
    });
    const cancelled = vi.fn();
    queue.subscribeCancellation(cancelled);
    const clear = vi.fn(async () => ({ ok: true }));
    await expect(queue.enqueueClear(clear)).resolves.toBe(true);
    expect(clear).toHaveBeenCalledOnce();
    expect(cancelled).toHaveBeenCalledOnce();
    expect(queue.isClearPending).toBe(false);
    await expect(queue.enqueue(snapshot(2), async () => "saved")).resolves.toBe("saved");
  });

  it.each(["saved", "failed"] as const)("coalesced callers share the replacement's %s outcome", async (outcome) => {
    const queue = new SaveWriteQueue();
    const gate = deferred<SaveWriteOutcome>();
    const write = vi.fn().mockReturnValueOnce(gate.promise).mockResolvedValue(outcome);
    const first = queue.enqueue(snapshot(1), write);
    await Promise.resolve();
    const second = queue.enqueue(snapshot(2), write);
    const third = queue.enqueue(snapshot(3), write);
    expect(second).toBe(third);
    let resolved = false;
    void second.then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(resolved).toBe(false);
    gate.resolve("saved");
    expect(await first).toBe("saved");
    expect(await second).toBe(outcome);
    expect(await third).toBe(outcome);
    expect(write.mock.calls.map(([data]) => data.gold)).toEqual([1, 3]);
    expect(queue.isIdle).toBe(true);
  });

  it("owns its snapshot so caller mutations after enqueue cannot corrupt the write", async () => {
    const queue = new SaveWriteQueue();
    const write = vi.fn().mockResolvedValue("saved");
    const data = snapshot(1);
    const outcome = queue.enqueue(data, write);
    data.gold = 999;
    expect(await outcome).toBe("saved");
    expect(write).toHaveBeenCalledExactlyOnceWith(snapshot(1));
  });

  it("coalesces each pending snapshot with its own writer, including replacements during a write", async () => {
    const queue = new SaveWriteQueue();
    const gate = deferred<SaveWriteOutcome>();
    const firstWrite = vi.fn(() => gate.promise);
    const replacedWrite = vi.fn().mockResolvedValue("failed");
    const latestWrite = vi.fn().mockResolvedValue("saved");
    const first = queue.enqueue(snapshot(1), replacedWrite);
    const replacement = queue.enqueue(snapshot(2), firstWrite);
    expect(first).toBe(replacement);
    await Promise.resolve();
    expect(firstWrite).toHaveBeenCalledExactlyOnceWith(snapshot(2));
    const next = queue.enqueue(snapshot(3), replacedWrite);
    expect(queue.enqueue(snapshot(4), latestWrite)).toBe(next);
    gate.resolve("saved");
    await expect(first).resolves.toBe("saved");
    await expect(next).resolves.toBe("saved");
    expect(latestWrite).toHaveBeenCalledExactlyOnceWith(snapshot(4));
    expect(replacedWrite).not.toHaveBeenCalled();
  });

  it.each(["clear", "protection"])("%s cancels in-flight acknowledgement and pending writes", async (action) => {
    const queue = new SaveWriteQueue();
    const gate = deferred<SaveWriteOutcome>();
    const write = vi.fn().mockReturnValue(gate.promise);
    const first = queue.enqueue(snapshot(1), write);
    await Promise.resolve();
    const second = queue.enqueue(snapshot(2), write);
    const clear = action === "clear" ? queue.enqueueClear(async () => ({ ok: true })) : undefined;
    if (action === "protection") queue.setWritesDisabled(true);
    gate.resolve("saved");
    expect(await first).toBe("skipped");
    expect(await second).toBe("skipped");
    await clear;
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("recovers its runner after a thrown write", async () => {
    const queue = new SaveWriteQueue();
    expect(
      await queue.enqueue(snapshot(1), async () => {
        throw new Error("unavailable");
      }),
    ).toBe("failed");
    expect(await queue.enqueue(snapshot(2), async () => "saved")).toBe("saved");
  });

  it("blocks writes until all overlapping clears finish", async () => {
    const queue = new SaveWriteQueue();
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

  it("keeps write protection isolated per queue instance", async () => {
    const protectedQueue = new SaveWriteQueue();
    const openQueue = new SaveWriteQueue();
    protectedQueue.setWritesDisabled(true);
    expect(protectedQueue.areWritesDisabled()).toBe(true);
    expect(openQueue.areWritesDisabled()).toBe(false);
    expect(await openQueue.enqueue(snapshot(1), async () => "saved")).toBe("saved");
    expect(await protectedQueue.enqueue(snapshot(2), async () => "saved")).toBe("skipped");
  });

  it.each(["reported", "thrown"])("survives a throwing notification for a %s clear failure", async (failure) => {
    const queue = new SaveWriteQueue();
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

  it("clears protection and listeners on reset", async () => {
    const queue = new SaveWriteQueue();
    const listener = vi.fn();
    queue.subscribeCancellation(listener);
    queue.setWritesDisabled(true);
    await queue.reset();
    expect(queue.areWritesDisabled()).toBe(false);
    expect(await queue.enqueue(snapshot(1), async () => "saved")).toBe("saved");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("rejects uncloneable snapshots without blocking later saves", async () => {
    const queue = new SaveWriteQueue();
    const write = vi.fn().mockResolvedValue("saved" as const);
    const invalid = { ...snapshot(1), unexpected: () => {} };
    expect(await queue.enqueue(invalid, write)).toBe("failed");
    expect(write).not.toHaveBeenCalled();
    expect(await queue.enqueue(snapshot(2), write)).toBe("saved");
  });
});
