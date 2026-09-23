import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSaveData, type SaveLoadState } from "@/features/alchemy/shared/storage";
import {
  configureAlchemySaveBackend,
  clearAlchemySaveData,
  hydrateAlchemyPersistenceFields,
  loadAlchemySaveState,
  routeWritesToRecovery,
} from "@/features/alchemy/shared/storage";
import { restoreRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import { readRunInitialized } from "@/features/alchemy/shared/stores/run-reads";
import { isAlchemyDevBuild } from "@/features/alchemy/shared/utils";
import { useAlchemyBootstrap } from "@/app/use-alchemy-bootstrap";

vi.mock("@/features/alchemy/shared/storage", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    hydrateAlchemyPersistenceFields: vi.fn(),
    configureAlchemySaveBackend: vi.fn().mockResolvedValue(undefined),
    loadAlchemySaveState: vi.fn(),
    routeWritesToRecovery: vi.fn(),
    clearAlchemySaveData: vi.fn().mockResolvedValue(true),
  };
});

vi.mock("@/features/alchemy/shared/stores/run-lifecycle", () => ({
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
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(readRunInitialized).mockReturnValue(false);
    vi.mocked(isAlchemyDevBuild).mockReturnValue(false);
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
    vi.mocked(loadAlchemySaveState).mockReturnValue(pending.promise);
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
    expect(restoreRun).toHaveBeenCalledWith(null, { armor: 12 }, defaultSaveData.unlockedTalents);
  });

  it("does not replace an aggregate that was initialized before bootstrap completed", async () => {
    vi.mocked(readRunInitialized).mockReturnValue(true);
    const result: SaveLoadState = { data: defaultSaveData, status: { kind: "ok" } };
    vi.mocked(loadAlchemySaveState).mockResolvedValue(result);

    const { result: hook } = renderHook(() => useAlchemyBootstrap());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(hydrateAlchemyPersistenceFields).toHaveBeenCalledWith(defaultSaveData);
    expect(restoreRun).not.toHaveBeenCalled();
    expect(hook.current).toBe(result);
  });

  it("starts play with defaults and recovery writes when bootstrap fails", async () => {
    vi.mocked(loadAlchemySaveState).mockRejectedValue(new Error("steam down"));

    const { result: hook } = renderHook(() => useAlchemyBootstrap());
    expect(hook.current).toBeNull();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(hydrateAlchemyPersistenceFields).toHaveBeenCalledWith(defaultSaveData);
    expect(restoreRun).toHaveBeenCalled();
    expect(routeWritesToRecovery).toHaveBeenCalledOnce();
    expect(hook.current?.status).toEqual({ kind: "unavailable" });
    expect(hook.current?.data.activeRun).toBeNull();
  });

  it("configures the backend before the dev wipe so desktop wipes honor cloud sync", async () => {
    vi.mocked(isAlchemyDevBuild).mockReturnValue(true);
    window.history.replaceState({}, "", "/?wipeLocalSave=1");
    const result: SaveLoadState = { data: defaultSaveData, status: { kind: "ok" } };
    vi.mocked(loadAlchemySaveState).mockResolvedValue(result);

    const { result: hook } = renderHook(() => useAlchemyBootstrap());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(clearAlchemySaveData).toHaveBeenCalledExactlyOnceWith("localWipe");
    expect(new URL(window.location.href).searchParams.has("wipeLocalSave")).toBe(false);
    expect(configureAlchemySaveBackend).toHaveBeenCalledOnce();
    // Backend configuration precedes the wipe, which precedes the load.
    expect(vi.mocked(configureAlchemySaveBackend).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(clearAlchemySaveData).mock.invocationCallOrder[0],
    );
    expect(vi.mocked(clearAlchemySaveData).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(loadAlchemySaveState).mock.invocationCallOrder[0],
    );
    expect(hook.current).toBe(result);
  });

  it("ignores non-1 wipeLocalSave values so stray flags never clear progress", async () => {
    vi.mocked(isAlchemyDevBuild).mockReturnValue(true);
    window.history.replaceState({}, "", "/?wipeLocalSave=0");
    const result: SaveLoadState = { data: defaultSaveData, status: { kind: "ok" } };
    vi.mocked(loadAlchemySaveState).mockResolvedValue(result);

    const { result: hook } = renderHook(() => useAlchemyBootstrap());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(clearAlchemySaveData).not.toHaveBeenCalled();
    expect(new URL(window.location.href).searchParams.get("wipeLocalSave")).toBe("0");
    expect(hook.current).toBe(result);
  });
  it.each(["unsupported-newer-schema", "unsupported-newer-content", "unavailable"] as const)(
    "starts play from available defaults for %s",
    async (kind) => {
      const result: SaveLoadState = {
        data: defaultSaveData,
        status:
          kind === "unavailable"
            ? { kind }
            : kind === "unsupported-newer-schema"
              ? { kind, detectedSchemaVersion: 999 }
              : { kind, detectedContentVersion: 999 },
      };
      vi.mocked(loadAlchemySaveState).mockResolvedValue(result);

      const { result: hook } = renderHook(() => useAlchemyBootstrap());
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(hydrateAlchemyPersistenceFields).toHaveBeenCalledWith(defaultSaveData);
      expect(restoreRun).toHaveBeenCalled();
      expect(hook.current).toBe(result);
    },
  );
});
