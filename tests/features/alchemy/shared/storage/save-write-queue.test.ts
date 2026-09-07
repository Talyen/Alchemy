import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SaveWriteQueue,
  setWritesDisabled,
  type SaveWriteOutcome,
} from "@/features/alchemy/shared/storage/save-write-queue";
import { createDefaultSaveData } from "@/features/alchemy/shared/storage/defaults";

function snapshot(gold: number) {
  return { ...createDefaultSaveData(), gold };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

afterEach(() => setWritesDisabled(false));

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
    if (action === "protection") setWritesDisabled(true);
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
});
