import { describe, expect, it } from "vitest";
import { SaveWriteQueue } from "@/features/alchemy/shared/storage/save-write-queue";
import { createDefaultSaveData } from "@/features/alchemy/shared/storage/defaults";
import type { SaveData } from "@/features/alchemy/shared/storage/types";

function saveWithTimestamp(lastSavedAt: number): SaveData {
  return { ...createDefaultSaveData(), lastSavedAt };
}

describe("SaveWriteQueue", () => {
  it("coalesces rapid enqueues into a single runner", async () => {
    const queue = new SaveWriteQueue();
    const written: number[] = [];
    const slowWrite = async (data: SaveData) => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 10);
      });
      written.push(data.lastSavedAt);
    };

    await Promise.all([
      queue.enqueue(saveWithTimestamp(1), slowWrite),
      queue.enqueue(saveWithTimestamp(2), slowWrite),
      queue.enqueue(saveWithTimestamp(3), slowWrite),
    ]);

    expect(queue.isIdle).toBe(true);
    expect(written.at(-1)).toBe(3);
    expect(written.length).toBeLessThanOrEqual(2);
  });

  it("stores the exit snapshot even when idle", () => {
    const queue = new SaveWriteQueue();
    expect(queue.isIdle).toBe(true);
    queue.queueExitSnapshot(saveWithTimestamp(9));
    expect(queue.hasPendingTasks).toBe(true);
    expect(queue.isIdle).toBe(false);
  });
});
