import { describe, expect, it, vi } from "vitest";
import { createGameSession } from "@/features/alchemy/shared/stores/game-session";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-reads";
import { acceptCommand, dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setRunDeck } from "@/features/alchemy/shared/stores/run-session-write-port";
import { sessionClock, sessionFeedback } from "@/features/alchemy/shared/stores/session-capabilities";
import { sessionGameplayStore } from "@/features/alchemy/shared/stores/session-gameplay-store";
import { sessionRuntime } from "@/features/alchemy/shared/stores/session-runtime";
import { createNotificationChannel } from "@/features/alchemy/shared/stores/notification-channel";
import { createSettingsStore } from "@/features/alchemy/shared/stores/settings-state";
import { readSessionSettings } from "@/features/alchemy/shared/stores/session-settings";
import { createSessionPersistence } from "@/features/alchemy/shared/storage/session-persistence";
import { makeTestCard } from "../../../../fixtures/cards";
import { createCleanup } from "@/lib/cleanup";

it.each([false, true])("releases scoped resources after failure, including early release = %s", async (early) => {
  const session = createGameSession();
  const release = vi.fn();
  const failure = new Error("scope failed");
  await expect(async () => {
    await using _ownedSession = session;
    using cleanup = createCleanup(release);
    if (early) cleanup();
    throw failure;
  }).rejects.toBe(failure);
  expect(release).toHaveBeenCalledOnce();
  expect(() => readGameplayState(session)).toThrow(/disposed/);
});

describe("session architecture invariants", () => {
  it.each([() => () => 1, () => new Date(), () => new Map([["gold", 1]])])(
    "rejects non-data gameplay before publishing any revision",
    async (metadata) => {
      await using session = createGameSession();
      const before = readGameplayState(session);
      const card = Object.assign(makeTestCard(), { metadata: metadata() });

      expect(() =>
        dispatchRunSessionCommand(
          (transaction) => {
            setRunDeck(transaction, [card]);
            return acceptCommand();
          },
          undefined,
          session,
        ),
      ).toThrow(/plain|data/);
      expect(readGameplayState(session)).toBe(before);
      expect(Object.isFrozen(card)).toBe(false);
    },
  );

  it("delivers reentrant settings changes to all observers in publication order", () => {
    const store = createSettingsStore();
    const observed: number[] = [];
    store.subscribe((state) => {
      if (state.masterVolume === 60) state.setMasterVolume(80);
    });
    store.subscribe((state) => observed.push(state.masterVolume));
    store.getState().setMasterVolume(60);
    expect(observed).toEqual([60, 80]);
    expect(store.getState().masterVolume).toBe(80);
  });

  it("isolates observer failures and captures subscription changes per publication", () => {
    const failed = vi.fn();
    const channel = createNotificationChannel<[number]>(failed);
    const delivered: string[] = [];
    let remove = () => {};
    channel.subscribe((revision) => {
      delivered.push(`first:${revision}`);
      if (revision === 1) {
        remove();
        channel.subscribe((next) => delivered.push(`new:${next}`));
        channel.publish(2);
        throw new Error("observer failed");
      }
    });
    remove = channel.subscribe((revision) => delivered.push(`original:${revision}`));
    channel.publish(1);
    expect(delivered).toEqual(["first:1", "original:1", "first:2", "new:2"]);
    expect(failed).toHaveBeenCalledOnce();
  });

  it("keeps settings reads immutable so writes cannot bypass notifications and saving", () => {
    const store = createSettingsStore();
    expect(store).not.toHaveProperty("setState");
    const notify = vi.fn();
    store.subscribe(notify);
    const before = store.getState();
    expect(Reflect.set(before, "masterVolume", 123)).toBe(false);
    expect(store.getState().masterVolume).toBe(before.masterVolume);
    expect(notify).not.toHaveBeenCalled();
  });

  it("revokes borrowed reads and feedback and releases progress subscriptions on disposal", async () => {
    const sound = vi.fn();
    const session = createGameSession({ feedback: { playGoldGain: sound } });
    const feedback = sessionFeedback(session);
    const reads = sessionGameplayStore(session).committed;
    const settings = sessionRuntime(session).settings;
    const borrowedSettings = readSessionSettings(session);
    const progress = sessionRuntime(session).progressCompletion;
    const persistence = createSessionPersistence(session);
    const notify = vi.fn();
    persistence.subscribeProgress(notify);
    await session.dispose();
    expect(() => feedback.playGoldGain()).toThrow(/disposed/);
    expect(() => reads.getState()).toThrow(/disposed/);
    expect(() => reads.subscribe(() => {})).toThrow(/disposed/);
    expect(() => borrowedSettings.setMasterVolume(0)).toThrow(/disposed/);
    expect(() => settings.getState()).toThrow(/disposed/);
    expect(() => settings.subscribe(() => {})).toThrow(/disposed/);
    notify.mockClear();
    progress.mark(10);
    expect(notify).not.toHaveBeenCalled();
    expect(sound).not.toHaveBeenCalled();
  });

  it("checks the current save gate when previously borrowed feedback executes", async () => {
    const sound = vi.fn();
    await using session = createGameSession({ feedback: { playGoldGain: sound } });

    const feedback = sessionFeedback(session);
    const progress = sessionRuntime(session).progressCompletion;
    progress.mark(10);
    feedback.playGoldGain();
    expect(sound).not.toHaveBeenCalled();
    progress.complete(progress.token(10), "saved");
    expect(sound).toHaveBeenCalledOnce();
  });

  it("owns every timer and suppresses callbacks that race with session disposal", async () => {
    const callbacks = new Map<number, () => void>();
    const clear = vi.fn((id) => callbacks.delete(Number(id)));
    const session = createGameSession({
      runtimeInputs: {
        clock: {
          now: () => 0,
          setTimeout: (callback) => {
            callbacks.set(1, callback);
            return 1;
          },
          clearTimeout: clear,
        },
      },
    });
    const clock = sessionClock(session);
    const callback = vi.fn();
    clock.setTimeout(callback, 10);
    const racingCallback = callbacks.get(1)!;
    await session.dispose();
    expect(clear).toHaveBeenCalledWith(1);
    racingCallback();
    expect(callback).not.toHaveBeenCalled();
    expect(() => clock.setTimeout(callback, 10)).toThrow(/disposed/);
  });
  it("cancels only owned timers and suppresses callbacks delivered after cancellation", async () => {
    let nextId = 0;
    const callbacks = new Map<number, () => void>();
    const clock = {
      now: () => 0,
      setTimeout: (callback: () => void) => {
        callbacks.set(++nextId, callback);
        return nextId;
      },
      clearTimeout: (timer: ReturnType<typeof setTimeout> | number) => {
        callbacks.delete(Number(timer));
      },
    };
    await using a = createGameSession({ runtimeInputs: { clock } });
    await using b = createGameSession({ runtimeInputs: { clock } });
    const called = vi.fn();

    const timer = sessionClock(b).setTimeout(called, 10);
    const racingCallback = callbacks.get(Number(timer))!;
    sessionClock(a).clearTimeout(timer);
    expect(callbacks.has(Number(timer))).toBe(true);
    sessionClock(b).clearTimeout(timer);
    racingCallback();
    expect(called).not.toHaveBeenCalled();
  });
});
