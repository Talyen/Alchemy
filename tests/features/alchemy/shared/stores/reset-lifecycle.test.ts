import { expect, it, vi } from "vitest";
import { createScreenNavigation } from "@/features/alchemy/shell/screen-navigation";
import { createSessionPersistence } from "@/features/alchemy/shared/storage/session-persistence";
import type { UnstampedSaveData } from "@/features/alchemy/shared/storage/types";
import { createDefaultSaveData } from "@/features/alchemy/shared/storage/defaults";
import { createGameSession } from "@/features/alchemy/shared/stores/game-session";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-reads";
import { clearAllPersistentGameData } from "@/features/alchemy/shared/stores/reset";
import { sessionRuntime } from "@/features/alchemy/shared/stores/session-runtime";
import { createSaveBackend } from "../../../../helpers/save-backend";
import { deferred } from "../../../../helpers/deferred";

it("publishes a wiped career atomically and revokes snapshots captured during deletion", async () => {
  let duringDeletion: UnstampedSaveData | undefined;
  await using session = createGameSession({
    initialSave: { ...createDefaultSaveData(), gold: 725, musicVolume: 7 },
    saveBackend: createSaveBackend({
      clear: async () => {
        duringDeletion = persistence.snapshot();
        return { ok: true };
      },
    }),
  });
  const persistence = createSessionPersistence(session);
  const runtime = sessionRuntime(session);
  const snapshots: UnstampedSaveData[] = [];
  const observe = () => snapshots.push(persistence.snapshot());
  persistence.trackProgress(() => {});
  persistence.subscribe(observe);
  runtime.settings.subscribe(observe);
  runtime.gameplay.reads.subscribe(observe);

  expect(await clearAllPersistentGameData(session)).toBe(true);
  expect(snapshots.length).toBeGreaterThan(0);
  for (const snapshot of snapshots) {
    expect(snapshot.gold).toBe(0);
    expect(snapshot.musicVolume).toBe(createDefaultSaveData().musicVolume);
    expect(snapshot.activeRun).toBeNull();
  }
  expect(duringDeletion?.gold).toBe(725);
  expect(await persistence.write(duringDeletion!)).toBe("skipped");
  expect(await persistence.checkpoint()).toBe("saved");
  expect(persistence.readProgress().kind).toBe("idle");
});

it.each([true, false])("cancels outgoing navigation only when disk deletion succeeds (%s)", async (ok) => {
  vi.useFakeTimers();
  const session = createGameSession({
    saveBackend: createSaveBackend({ clear: async () => (ok ? { ok: true } : { ok: false, error: "denied" }) }),
  });
  const showScreen = vi.fn();
  const navigation = createScreenNavigation({ readScreen: () => "menu", showScreen }, session);
  const before = readGameplayState(session);
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    navigation.navigateTo("collection");
    expect(await clearAllPersistentGameData(session)).toBe(ok);
    vi.runAllTimers();
    if (ok) expect(showScreen).not.toHaveBeenCalled();
    else {
      expect(showScreen).toHaveBeenCalledExactlyOnceWith("collection");
      expect(readGameplayState(session)).toBe(before);
    }
  } finally {
    await session.dispose();
    errors.mockRestore();
    vi.useRealTimers();
  }
});

it("finishes disk deletion without publishing into a session disposed during the wipe", async () => {
  const started = deferred<void>();
  const disk = deferred<{ ok: true }>();
  const clearSaveConfirmation = vi.fn();
  const session = createGameSession({
    feedback: { clearSaveConfirmation },
    saveBackend: createSaveBackend({
      clear: () => {
        started.resolve();
        return disk.promise;
      },
    }),
  });
  const clearing = clearAllPersistentGameData(session);
  await started.promise;
  const disposal = session.dispose();
  disk.resolve({ ok: true });
  await expect(clearing).resolves.toBe(true);
  await disposal;
  expect(clearSaveConfirmation).not.toHaveBeenCalled();
});
