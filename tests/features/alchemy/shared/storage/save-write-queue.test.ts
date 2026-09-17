import { describe, expect, it, vi } from "vitest";
import { SaveWriteQueue, type SaveWriteOutcome } from "@/features/alchemy/shared/storage/save-write-queue";
import { createDefaultSaveData } from "@/features/alchemy/shared/storage/defaults";
import { deferred } from "../../../../helpers/deferred";

function snapshot(gold: number) {
  return { ...createDefaultSaveData(), gold };
}

describe("SaveWriteQueue", () => {
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

  it("coalesces requests before the runner starts", async () => {
    const queue = new SaveWriteQueue();
    const write = vi.fn().mockResolvedValue("saved");
    const first = queue.enqueue(snapshot(1), write);
    const second = queue.enqueue(snapshot(2), write);
    expect(await first).toBe("saved");
    expect(await second).toBe("saved");
    expect(write).toHaveBeenCalledExactlyOnceWith(snapshot(2));
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
    const write = vi.fn().mockResolvedValue("saved");
    expect(await queue.enqueue(snapshot(1), write)).toBe("skipped");
    gate.resolve({ ok: true });
    await second;
    expect(await queue.enqueue(snapshot(2), write)).toBe("saved");
  });

  it.each(["reported", "thrown"])("reports a %s clear failure and keeps the queue usable", async (failure) => {
    const queue = new SaveWriteQueue();
    const error = new Error("clear denied");
    const onError = vi.fn();
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
    expect(await queue.enqueue(snapshot(1), async () => "saved")).toBe("saved");
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

  it("returns skipped for uncloneable payloads while writes are disabled", async () => {
    const queue = new SaveWriteQueue();
    queue.setWritesDisabled(true);
    const write = vi.fn().mockResolvedValue("saved" as const);
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(await queue.enqueue(circular as unknown as ReturnType<typeof snapshot>, write)).toBe("skipped");
    expect(write).not.toHaveBeenCalled();
  });
});
