import { describe, expect, it } from "vitest";
import {
  applyAutosaveCompletion,
  createAutosaveScheduler,
  computeAutosaveDelay,
  shouldAttemptFlush,
} from "@/app/autosave-scheduler";

describe("computeAutosaveDelay", () => {
  it("uses the debounce when max wait is far away and no retry is pending", () => {
    expect(
      computeAutosaveDelay({ debounceMs: 500, maxWaitMs: 10_000, now: 1_000, dirtySince: 1_000, retryAt: 0 }),
    ).toBe(500);
  });

  it("caps the delay at the remaining max wait", () => {
    expect(
      computeAutosaveDelay({ debounceMs: 500, maxWaitMs: 10_000, now: 10_500, dirtySince: 1_000, retryAt: 0 }),
    ).toBe(500);
    expect(
      computeAutosaveDelay({ debounceMs: 500, maxWaitMs: 10_000, now: 10_900, dirtySince: 1_000, retryAt: 0 }),
    ).toBe(100);
  });

  it("honors a pending retry even when it exceeds the debounce", () => {
    expect(
      computeAutosaveDelay({ debounceMs: 500, maxWaitMs: 10_000, now: 1_000, dirtySince: 1_000, retryAt: 11_000 }),
    ).toBe(10_000);
  });

  it("ignores an expired retry in the past", () => {
    expect(
      computeAutosaveDelay({ debounceMs: 500, maxWaitMs: 10_000, now: 5_000, dirtySince: 1_000, retryAt: 2_000 }),
    ).toBe(500);
  });

  it("starts immediately when animations are disabled", () => {
    expect(computeAutosaveDelay({ debounceMs: 0, maxWaitMs: 10_000, now: 1_000, dirtySince: 1_000, retryAt: 0 })).toBe(
      0,
    );
  });
});

describe("shouldAttemptFlush", () => {
  it("blocks clean and already-submitted revisions", () => {
    expect(
      shouldAttemptFlush({
        revision: 1,
        acknowledgedRevision: 1,
        submittedRevision: 1,
        terminal: false,
      }),
    ).toBe(false);
    expect(
      shouldAttemptFlush({
        revision: 2,
        acknowledgedRevision: 1,
        submittedRevision: 2,
        terminal: false,
      }),
    ).toBe(false);
  });

  it("allows terminal flushes past the submitted revision", () => {
    expect(shouldAttemptFlush({ revision: 2, acknowledgedRevision: 1, submittedRevision: 2, terminal: true })).toBe(
      true,
    );
  });

  it("blocks terminal flushes with nothing new to acknowledge", () => {
    expect(shouldAttemptFlush({ revision: 1, acknowledgedRevision: 1, submittedRevision: 1, terminal: true })).toBe(
      false,
    );
  });
});

describe("applyAutosaveCompletion", () => {
  it("acknowledges saved revisions and clears the retry", () => {
    expect(
      applyAutosaveCompletion({
        revision: 2,
        acknowledgedRevision: 1,
        submittedRevision: 2,
        retryAt: 9_999,
        savingRevision: 2,
        outcome: "saved",
        now: 2_000,
        maxWaitMs: 10_000,
      }),
    ).toMatchObject({ acknowledgedRevision: 2, retryAt: 0, action: "cancel" });
  });

  it("keeps newer revisions dirty after an older save lands", () => {
    expect(
      applyAutosaveCompletion({
        revision: 3,
        acknowledgedRevision: 1,
        submittedRevision: 2,
        retryAt: 0,
        savingRevision: 2,
        outcome: "saved",
        now: 2_000,
        maxWaitMs: 10_000,
      }),
    ).toMatchObject({ acknowledgedRevision: 2, action: "schedule" });
  });

  it("rewinds to the acknowledged revision and retries after failure", () => {
    expect(
      applyAutosaveCompletion({
        revision: 2,
        acknowledgedRevision: 1,
        submittedRevision: 2,
        retryAt: 0,
        savingRevision: 2,
        outcome: "failed",
        now: 2_000,
        maxWaitMs: 10_000,
      }),
    ).toMatchObject({ submittedRevision: 1, retryAt: 12_000, action: "schedule" });
  });

  it("ignores a stale failed completion for a superseded revision", () => {
    expect(
      applyAutosaveCompletion({
        revision: 3,
        acknowledgedRevision: 1,
        submittedRevision: 3,
        retryAt: 0,
        savingRevision: 2,
        outcome: "failed",
        now: 2_000,
        maxWaitMs: 10_000,
      }),
    ).toMatchObject({ action: "ignore", retryAt: 0 });
  });
});

describe("autosave subscription lifecycle", () => {
  it("invalidates skipped and cancelled submissions without acknowledging new progress", () => {
    const scheduler = createAutosaveScheduler(10_000);
    scheduler.markDirty(100);
    const old = scheduler.submit(false)!;
    expect(scheduler.complete(old, "skipped", 200)).toBe("cancel");
    scheduler.markDirty(300);
    expect(scheduler.complete(old, "saved", 400)).toBe("ignore");
    const next = scheduler.submit(false)!;
    scheduler.cancel();
    scheduler.markDirty(500);
    expect(scheduler.complete(next, "failed", 600)).toBe("ignore");
    expect(scheduler.nextDelay(600, 500)).toBe(500);
    expect(scheduler.submit(false)).not.toBeNull();
  });

  it("submits one exit write per revision across back-to-back exit events", () => {
    const scheduler = createAutosaveScheduler(10_000);
    scheduler.markDirty(100);
    expect(scheduler.submit(true)).not.toBeNull();
    expect(scheduler.submit(true)).toBeNull();
    scheduler.markDirty(200);
    expect(scheduler.submit(true)).not.toBeNull();
  });

  it("preserves the max-wait window across re-schedules without new dirt", () => {
    const scheduler = createAutosaveScheduler(10_000);
    scheduler.markDirty(1_000);
    // Rapid re-schedules without markDirty keep dirtySince, so the cap shrinks.
    expect(scheduler.nextDelay(1_000, 500)).toBe(500);
    expect(scheduler.nextDelay(10_500, 500)).toBe(500);
    expect(scheduler.nextDelay(10_900, 500)).toBe(100);
  });
});
