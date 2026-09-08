import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSaveData, type SaveLoadState } from "@/features/alchemy/shared/storage";
import {
  bootstrapAlchemySaveState,
  clearAlchemySaveData,
  hydrateAlchemyPersistenceFields,
} from "@/features/alchemy/shared/storage";
import { restoreRun } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { readRunInitialized } from "@/features/alchemy/shared/stores/run-reads";
import { isAlchemyDevBuild } from "@/features/alchemy/shared/utils";
import { useAlchemyBootstrap } from "@/app/use-alchemy-bootstrap";

vi.mock("@/features/alchemy/shared/storage", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    hydrateAlchemyPersistenceFields: vi.fn(),
    bootstrapAlchemySaveState: vi.fn(),
    clearAlchemySaveData: vi.fn().mockResolvedValue(true),
  };
});

vi.mock("@/features/alchemy/shared/stores/run-session-lifecycle-port", () => ({
  restoreRun: vi.fn(),
}));

vi.mock("@/features/alchemy/shared/stores/run-reads", () => ({
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
    vi.mocked(isAlchemyDevBuild).mockReturnValue(false);
    window.history.replaceState({}, "", "/");
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
    vi.mocked(hydrateAlchemyPersistenceFields).mockImplementation(() => {
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

    expect(hydrateAlchemyPersistenceFields).toHaveBeenCalledWith(defaultSaveData);
    expect(restoreRun).not.toHaveBeenCalled();
    expect(hook.current).toBe(result);
  });

  it("publishes corrupt defaults instead of hanging when bootstrap fails", async () => {
    vi.mocked(bootstrapAlchemySaveState).mockRejectedValue(new Error("steam down"));

    const { result: hook } = renderHook(() => useAlchemyBootstrap());
    expect(hook.current).toBeNull();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(hydrateAlchemyPersistenceFields).toHaveBeenCalledOnce();
    expect(restoreRun).toHaveBeenCalled();
    expect(hook.current?.status).toEqual({ kind: "corrupt" });
    expect(hook.current?.data.activeRun).toBeNull();
  });

  it("clears the local save and drops the query param before bootstrap on dev wipes", async () => {
    vi.mocked(isAlchemyDevBuild).mockReturnValue(true);
    window.history.replaceState({}, "", "/?wipeLocalSave=1");
    const result: SaveLoadState = { data: defaultSaveData, status: { kind: "ok" } };
    vi.mocked(bootstrapAlchemySaveState).mockResolvedValue(result);

    const { result: hook } = renderHook(() => useAlchemyBootstrap());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(clearAlchemySaveData).toHaveBeenCalledOnce();
    expect(new URL(window.location.href).searchParams.has("wipeLocalSave")).toBe(false);
    expect(hook.current).toBe(result);
  });
});
