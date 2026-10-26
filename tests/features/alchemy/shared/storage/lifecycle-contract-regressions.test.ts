import { describe, expect, it, vi } from "vitest";
import { ProgressCompletion } from "@/features/alchemy/shared/storage/progress-completion";
import { createSessionLifetime } from "@/features/alchemy/shared/stores/session/session-lifetime";
import { getTalentsForKeyword } from "@/lib/game-data/talents/talent-pool-definitions";

describe("lifecycle contracts", () => {
  it("does not let an older progress mark release a newer unsaved revision", () => {
    const progress = new ProgressCompletion();
    const feedback = vi.fn();
    progress.mark(10);
    progress.afterSaved(feedback);
    const older = progress.token(9);
    progress.mark(9);
    progress.complete(older, "saved");
    expect(progress.read()).toEqual({ kind: "saving", revision: 10 });
    expect(feedback).not.toHaveBeenCalled();
    progress.complete(progress.token(10), "saved");
    expect(feedback).toHaveBeenCalledOnce();
  });

  it("allows a synchronous injected timer to close its owner without registering departed work", () => {
    const lifetime = createSessionLifetime();
    const clearTimeout = vi.fn();
    const clock = lifetime.ownClock({
      now: () => 0,
      setTimeout: (callback) => {
        callback();
        return 1;
      },
      clearTimeout,
    });
    expect(() => clock.setTimeout(() => lifetime.close(), 0)).not.toThrow();
    expect(lifetime.disposed).toBe(true);
    expect(clearTimeout).not.toHaveBeenCalled();
  });

  it("owns the returned talent list so one consumer cannot remove another career's unlocks", () => {
    const list = getTalentsForKeyword("physical");
    const before = [...list];
    try {
      list.splice(0);
      expect(getTalentsForKeyword("physical")).toEqual(before);
    } finally {
      list.push(...before);
    }
  });
});
