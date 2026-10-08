import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSaveData, type SaveLoadState } from "@/features/alchemy/shared/storage";
import { isAlchemyDevBuild } from "@/features/alchemy/shared/utils";
import { useAlchemyBootstrap } from "@/app/use-alchemy-bootstrap";

const mockPersistence = {
  configurePlatform: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn().mockResolvedValue(true),
  load: vi.fn(),
  routeToRecovery: vi.fn(),
  restore: vi.fn().mockReturnValue(true),
  write: vi.fn().mockResolvedValue("saved"),
  snapshot: vi.fn().mockReturnValue(defaultSaveData),
};

vi.mock("@/features/alchemy/shared/storage", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createSessionPersistence: vi.fn(() => mockPersistence),
  };
});

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
    mockPersistence.configurePlatform.mockResolvedValue(undefined);
    mockPersistence.clear.mockResolvedValue(true);
    mockPersistence.restore.mockReturnValue(true);
    mockPersistence.write.mockResolvedValue("saved");
    mockPersistence.snapshot.mockReturnValue(defaultSaveData);
    vi.spyOn(console, "error").mockImplementation(() => {});
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
    mockPersistence.load.mockReturnValue(pending.promise);

    const { result: hook } = renderHook(() => useAlchemyBootstrap());
    expect(hook.current).toBeNull();

    await act(async () => {
      pending.resolve(result);
      await pending.promise;
    });

    expect(mockPersistence.restore).toHaveBeenCalledWith(result.data, { preserveActiveRunIfInitialized: true });
    expect(hook.current).toBe(result);
  });

  it("starts play with defaults and recovery writes when bootstrap fails", async () => {
    mockPersistence.load.mockRejectedValue(new Error("steam down"));

    const { result: hook } = renderHook(() => useAlchemyBootstrap());
    expect(hook.current).toBeNull();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockPersistence.routeToRecovery).toHaveBeenCalledOnce();
    expect(mockPersistence.restore).toHaveBeenCalledWith(expect.objectContaining({ activeRun: null }), {
      preserveActiveRunIfInitialized: true,
    });
    expect(hook.current?.status).toEqual({ kind: "unavailable" });
    expect(hook.current?.data.activeRun).toBeNull();
  });

  it("configures the backend before the dev wipe so desktop wipes honor cloud sync", async () => {
    vi.mocked(isAlchemyDevBuild).mockReturnValue(true);
    window.history.replaceState({}, "", "/?wipeLocalSave=1");
    const result: SaveLoadState = { data: defaultSaveData, status: { kind: "ok" } };
    mockPersistence.load.mockResolvedValue(result);

    const { result: hook } = renderHook(() => useAlchemyBootstrap());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockPersistence.clear).toHaveBeenCalledExactlyOnceWith("localWipe");
    expect(new URL(window.location.href).searchParams.has("wipeLocalSave")).toBe(false);
    expect(mockPersistence.configurePlatform).toHaveBeenCalledOnce();
    // Backend configuration precedes the wipe, which precedes the load.
    expect(mockPersistence.configurePlatform.mock.invocationCallOrder[0]).toBeLessThan(
      mockPersistence.clear.mock.invocationCallOrder[0],
    );
    expect(mockPersistence.clear.mock.invocationCallOrder[0]).toBeLessThan(
      mockPersistence.load.mock.invocationCallOrder[0],
    );
    expect(hook.current).toBe(result);
  });

  it("ignores non-1 wipeLocalSave values so stray flags never clear progress", async () => {
    vi.mocked(isAlchemyDevBuild).mockReturnValue(true);
    window.history.replaceState({}, "", "/?wipeLocalSave=0");
    const result: SaveLoadState = { data: defaultSaveData, status: { kind: "ok" } };
    mockPersistence.load.mockResolvedValue(result);

    const { result: hook } = renderHook(() => useAlchemyBootstrap());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockPersistence.clear).not.toHaveBeenCalled();
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
      mockPersistence.load.mockResolvedValue(result);

      const { result: hook } = renderHook(() => useAlchemyBootstrap());
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockPersistence.restore).toHaveBeenCalledWith(defaultSaveData, { preserveActiveRunIfInitialized: true });
      expect(hook.current).toBe(result);
    },
  );
});
