import { afterEach, expect, it, vi } from "vitest";
import { createGameSession } from "@/features/alchemy/shared/stores/game-session";
import { createSessionPersistence } from "@/features/alchemy/shared/storage";
import { createSaveBackend } from "../../../../helpers/save-backend";

afterEach(() => vi.restoreAllMocks());

it.each(["detach", "throw"] as const)("recovers a pending action when its retry driver %s fails", async (failure) => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  let fail = true;
  const session = createGameSession({
    saveBackend: createSaveBackend({ write: async () => (fail ? { ok: false, error: "disk full" } : { ok: true }) }),
  });
  const persistence = createSessionPersistence(session);
  const completed = vi.fn();
  const release = persistence.trackProgress(() => {
    throw new Error("retry owner failed");
  });
  let unsubscribe = () => {};
  try {
    expect(await persistence.checkpoint()).toBe("failed");
    persistence.afterProgressSaved(completed);
    fail = false;
    if (failure === "detach") {
      unsubscribe = persistence.subscribeProgress(() => {
        if (persistence.readProgress().kind === "saving") release();
      });
    }
    expect(() => persistence.retryProgress()).not.toThrow();
    await persistence.waitForWrites();
    expect(persistence.readProgress().kind).toBe("idle");
    expect(completed).toHaveBeenCalledOnce();
  } finally {
    unsubscribe();
    release();
    await session.dispose();
  }
});

it("does not retry the replaced career when a retry observer restores another save", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const writes: string[] = [];
  let fail = true;
  const session = createGameSession({
    saveBackend: createSaveBackend({
      write: async (_key, value) => {
        writes.push(value);
        return fail ? { ok: false, error: "disk full" } : { ok: true };
      },
    }),
  });
  const persistence = createSessionPersistence(session);
  const retry = vi.fn();
  const release = persistence.trackProgress(retry);
  let unsubscribe = () => {};
  try {
    const replacement = persistence.snapshot();
    replacement.gold = 321;
    expect(await persistence.checkpoint()).toBe("failed");
    const cancelled = vi.fn();
    persistence.afterProgressSaved(cancelled);
    const count = writes.length;
    fail = false;
    unsubscribe = persistence.subscribeProgress(() => {
      if (persistence.readProgress().kind === "saving") {
        unsubscribe();
        persistence.restore(replacement);
      }
    });
    persistence.retryProgress();
    await persistence.waitForWrites();
    expect(retry).not.toHaveBeenCalled();
    expect(writes).toHaveLength(count);
    expect(cancelled).not.toHaveBeenCalled();
    expect(await persistence.checkpoint()).toBe("saved");
    expect(JSON.parse(writes.at(-1)!).gold).toBe(321);
  } finally {
    unsubscribe();
    release();
    await session.dispose();
  }
});
