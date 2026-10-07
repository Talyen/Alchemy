import { describe, expect, it } from "vitest";
import { createAutosaveScheduler } from "@/app/autosave-scheduler";

describe("autosave scheduler", () => {
  it("blocks clean and submitted work without advancing on a peek", () => {
    const scheduler = createAutosaveScheduler(10_000);
    expect(scheduler.canSubmit(false)).toBe(false);
    expect(scheduler.submit(true)).toBeNull();
    expect(scheduler.nextDelay(100, 500)).toBeNull();
    scheduler.markDirty(100);
    expect(scheduler.canSubmit(false)).toBe(true);
    expect(scheduler.canSubmit(false)).toBe(true);
    const submission = scheduler.submit(false)!;
    expect(scheduler.submit(false)).toBeNull();
    expect(scheduler.nextDelay(200, 500)).toBeNull();
    expect(scheduler.complete(submission, "saved", 200)).toBe("cancel");
    expect(scheduler.submit(true)).toBeNull();
  });

  it("caps repeated changes at the original max wait and allows an immediate debounce", () => {
    const scheduler = createAutosaveScheduler(10_000);
    scheduler.markDirty(1_000);
    expect(scheduler.nextDelay(1_000, 500)).toBe(500);
    scheduler.markDirty(10_500);
    expect(scheduler.nextDelay(10_500, 500)).toBe(500);
    expect(scheduler.nextDelay(10_900, 500)).toBe(100);
    expect(scheduler.nextDelay(11_000, 500)).toBe(0);
    expect(scheduler.nextDelay(11_100, 500)).toBe(0);
    expect(scheduler.nextDelay(10_500, 0)).toBe(0);
  });

  it("keeps the retry cooldown despite new changes, an expired max wait, and disabled animations", () => {
    const scheduler = createAutosaveScheduler(10_000);
    scheduler.markDirty(1_000);
    expect(scheduler.complete(scheduler.submit(false)!, "failed", 2_000)).toBe("schedule");
    scheduler.markDirty(3_000);
    expect(scheduler.nextDelay(3_000, 500)).toBe(9_000);
    expect(scheduler.nextDelay(3_000, 0)).toBe(9_000);
    expect(scheduler.nextDelay(11_900, 500)).toBe(100);
    expect(scheduler.nextDelay(12_000, 500)).toBe(0);
    expect(scheduler.nextDelay(12_100, 500)).toBe(0);
    expect(scheduler.complete(scheduler.submit(false)!, "saved", 12_100)).toBe("cancel");
    expect(scheduler.nextDelay(12_100, 500)).toBeNull();
    scheduler.markDirty(13_000);
    expect(scheduler.nextDelay(13_000, 500)).toBe(500);
  });

  it("uses a separately configured retry cooldown without replacing the debounce", () => {
    const scheduler = createAutosaveScheduler(10_000, 100);
    scheduler.markDirty(1_000);
    scheduler.complete(scheduler.submit(false)!, "failed", 1_500);
    expect(scheduler.nextDelay(1_500, 500)).toBe(500);
    expect(scheduler.nextDelay(1_500, 0)).toBe(100);
    expect(scheduler.nextDelay(1_700, 500)).toBe(500);
  });

  it("keeps newer changes dirty when an older save succeeds", () => {
    const scheduler = createAutosaveScheduler(10_000);
    scheduler.markDirty(1_000);
    const older = scheduler.submit(false)!;
    scheduler.markDirty(2_000);
    expect(scheduler.complete(older, "saved", 3_000)).toBe("schedule");
    expect(scheduler.nextDelay(11_900, 500)).toBe(100);
    expect(scheduler.complete(scheduler.submit(false)!, "saved", 12_000)).toBe("cancel");
    expect(scheduler.nextDelay(12_000, 500)).toBeNull();
  });

  it.each(["write", "snapshot"])("does not let an older success clear a newer %s failure's cooldown", (failure) => {
    const scheduler = createAutosaveScheduler(10_000);
    scheduler.markDirty(1_000);
    const older = scheduler.submit(false)!;
    scheduler.markDirty(2_000);
    if (failure === "write") expect(scheduler.complete(scheduler.submit(false)!, "failed", 3_000)).toBe("schedule");
    else scheduler.failSnapshot(3_000, false);
    expect(scheduler.complete(older, "saved", 4_000)).toBe("schedule");
    expect(scheduler.nextDelay(4_000, 0)).toBe(9_000);
    expect(scheduler.submit(false)).not.toBeNull();
  });

  it("ignores older failures while a newer submission is pending or saved", () => {
    const scheduler = createAutosaveScheduler(10_000);
    scheduler.markDirty(1_000);
    const older = scheduler.submit(false)!;
    scheduler.markDirty(2_000);
    const newer = scheduler.submit(false)!;
    expect(scheduler.complete(older, "failed", 3_000)).toBe("ignore");
    expect(scheduler.nextDelay(3_000, 500)).toBeNull();
    expect(scheduler.complete(newer, "saved", 4_000)).toBe("cancel");
    expect(scheduler.complete(older, "failed", 5_000)).toBe("ignore");
    expect(scheduler.submit(false)).toBeNull();
  });

  it.each(["saved", "failed", "skipped"] as const)("ignores late %s completions after cancellation", (outcome) => {
    const scheduler = createAutosaveScheduler(10_000);
    scheduler.markDirty(100);
    const older = scheduler.submit(false)!;
    scheduler.cancel();
    expect(scheduler.nextDelay(200, 500)).toBeNull();
    scheduler.markDirty(300);
    const newer = scheduler.submit(false)!;
    expect(scheduler.complete(older, outcome, 400)).toBe("ignore");
    expect(scheduler.complete(newer, "saved", 500)).toBe("cancel");
  });

  it("drops skipped work and starts a fresh deadline for subsequent progress", () => {
    const scheduler = createAutosaveScheduler(10_000);
    scheduler.markDirty(100);
    const older = scheduler.submit(true)!;
    expect(scheduler.complete(older, "skipped", 200)).toBe("cancel");
    expect(scheduler.submit(false)).toBeNull();
    scheduler.markDirty(20_000);
    expect(scheduler.complete(older, "saved", 20_100)).toBe("ignore");
    expect(scheduler.nextDelay(20_100, 500)).toBe(500);
    expect(scheduler.submit(true)).not.toBeNull();
  });

  it("allows an exit to cover pending work once per revision", () => {
    const scheduler = createAutosaveScheduler(10_000);
    scheduler.markDirty(100);
    const ordinary = scheduler.submit(false)!;
    const exit = scheduler.submit(true)!;
    expect(exit).not.toBeNull();
    expect(scheduler.submit(true)).toBeNull();
    expect(scheduler.complete(exit, "saved", 200)).toBe("cancel");
    expect(scheduler.complete(ordinary, "failed", 300)).toBe("ignore");
    expect(scheduler.nextDelay(300, 500)).toBeNull();
    scheduler.markDirty(400);
    expect(scheduler.submit(true)).not.toBeNull();
  });

  it.each(["timer", "pending write"])(
    "recovers a failed exit using %s while repeated exit signals stay latched",
    (recovery) => {
      const scheduler = createAutosaveScheduler(10_000);
      scheduler.markDirty(100);
      const pending = recovery === "pending write" ? scheduler.submit(false)! : null;
      expect(scheduler.complete(scheduler.submit(true)!, "failed", 200)).toBe("schedule");
      expect(scheduler.submit(true)).toBeNull();
      expect(scheduler.nextDelay(200, 0)).toBe(10_000);
      expect(scheduler.complete(pending ?? scheduler.submit(false)!, "saved", 10_200)).toBe("cancel");
      expect(scheduler.nextDelay(10_200, 500)).toBeNull();
      scheduler.markDirty(20_000);
      expect(scheduler.nextDelay(20_000, 500)).toBe(500);
    },
  );
});
