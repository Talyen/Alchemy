// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSaveData, type SaveLoadState } from "@/features/alchemy/shared/storage";
import {
  applySaveDataToStores,
  bootstrapAlchemySaveState,
} from "@/features/alchemy/shared/storage/bootstrap-save-state";
import { restoreRun } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { readRunInitialized } from "@/features/alchemy/shared/stores/run-session-read-port";
import { useAlchemyBootstrap } from "@/app/use-alchemy-bootstrap";

vi.mock("@/features/alchemy/shared/storage/bootstrap-save-state", () => ({
  applySaveDataToStores: vi.fn(),
  bootstrapAlchemySaveState: vi.fn(),
}));

vi.mock("@/features/alchemy/shared/stores/run-session-lifecycle-port", () => ({
  restoreRun: vi.fn(),
}));

vi.mock("@/features/alchemy/shared/stores/run-session-read-port", () => ({
  readRunInitialized: vi.fn(),
}));

vi.mock("@/features/alchemy/shared/utils", () => ({
  isAlchemyDevBuild: vi.fn(() => false),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("useAlchemyBootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readRunInitialized).mockReturnValue(false);
  });

  it("publishes readiness only after persistence owners and the active run are restored", async () => {
    const pending = deferred<SaveLoadState>();
    const result: SaveLoadState = {
      data: {
        ...defaultSaveData,
        activeRun: null,
        talentXP: { armor: 12 },
      },
      status: { kind: "ok" },
    };
    vi.mocked(bootstrapAlchemySaveState).mockReturnValue(pending.promise);
    const calls: string[] = [];
    vi.mocked(applySaveDataToStores).mockImplementation(() => {
      calls.push("stores");
    });
    vi.mocked(restoreRun).mockImplementation(() => {
      calls.push("run");
    });

    const { result: hook } = renderHook(() => useAlchemyBootstrap());
    expect(hook.current).toBeNull();

    await act(async () => {
      pending.resolve(result);
      await pending.promise;
    });

    expect(calls).toEqual(["stores", "run"]);
    expect(hook.current).toBe(result);
    expect(restoreRun).toHaveBeenCalledWith(
      null,
      { armor: 12 },
      defaultSaveData.unlockedTalents,
      defaultSaveData.parkedRuns,
      defaultSaveData.runRecency,
    );
  });

  it("does not replace an aggregate that was initialized before bootstrap completed", async () => {
    vi.mocked(readRunInitialized).mockReturnValue(true);
    const result: SaveLoadState = { data: defaultSaveData, status: { kind: "ok" } };
    vi.mocked(bootstrapAlchemySaveState).mockResolvedValue(result);

    const { result: hook } = renderHook(() => useAlchemyBootstrap());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(applySaveDataToStores).toHaveBeenCalledWith(defaultSaveData);
    expect(restoreRun).not.toHaveBeenCalled();
    expect(hook.current).toBe(result);
  });
});
