import { StrictMode } from "react";
import { createGameSession, type GameSession } from "@/features/alchemy/shared/stores/session/game-session";
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
  let session: GameSession;
  beforeEach(() => {
    session = createGameSession();
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

  afterEach(async () => {
    await session.dispose();
    vi.restoreAllMocks();
  });

  it("shares pending bootstrap across Strict Mode and remounts, then retains readiness without replaying restore", async () => {
    const pending = deferred<SaveLoadState>();
    mockPersistence.load.mockReturnValue(pending.promise);
    const first = renderHook(() => useAlchemyBootstrap(session), { wrapper: StrictMode });
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockPersistence.load).toHaveBeenCalledOnce();
    first.unmount();
    const second = renderHook(() => useAlchemyBootstrap(session));
    const loaded: SaveLoadState = {
      data: defaultSaveData,
      status: { kind: "ok" },
      restoreActions: ["abandon-active-run"],
    };
    await act(async () => {
      pending.resolve(loaded);
      await pending.promise;
    });
    expect(second.result.current).toBe(loaded);
    expect(mockPersistence.restore).toHaveBeenCalledExactlyOnceWith(loaded.data, {
      preserveActiveRunIfInitialized: true,
      startAtMenu: true,
      restoreActions: loaded.restoreActions,
    });
    second.unmount();
    const third = renderHook(() => useAlchemyBootstrap(session));
    await act(async () => {
      await Promise.resolve();
    });
    expect(third.result.current).toBe(loaded);
    expect(mockPersistence.configurePlatform).toHaveBeenCalledOnce();
    expect(mockPersistence.load).toHaveBeenCalledOnce();
    expect(mockPersistence.restore).toHaveBeenCalledOnce();
  });

  it("keeps independent careers separate when a hook changes sessions during bootstrap", async () => {
    const first = deferred<SaveLoadState>();
    const second = deferred<SaveLoadState>();
    mockPersistence.load.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const other = createGameSession();
    try {
      const hook = renderHook(({ owner }) => useAlchemyBootstrap(owner), { initialProps: { owner: session } });
      await act(async () => {
        await Promise.resolve();
      });
      hook.rerender({ owner: other });
      expect(hook.result.current).toBeNull();
      const loaded: SaveLoadState = { data: defaultSaveData, status: { kind: "ok" } };
      await act(async () => {
        second.resolve(loaded);
        await second.promise;
      });
      expect(hook.result.current).toBe(loaded);
      await act(async () => {
        first.resolve({ data: defaultSaveData, status: { kind: "unavailable" } });
        await first.promise;
      });
      expect(hook.result.current).toBe(loaded);
      expect(mockPersistence.configurePlatform).toHaveBeenCalledTimes(2);
      expect(mockPersistence.restore).toHaveBeenCalledTimes(2);
      hook.unmount();
    } finally {
      await other.dispose();
    }
  });

  it("revokes bootstrap continuations when the session closes during load", async () => {
    const pending = deferred<SaveLoadState>();
    mockPersistence.load.mockReturnValue(pending.promise);
    const hook = renderHook(() => useAlchemyBootstrap(session));
    await act(async () => {
      await Promise.resolve();
    });
    await session.dispose();
    await act(async () => {
      pending.resolve({ data: defaultSaveData, status: { kind: "ok" } });
      await pending.promise;
    });
    expect(mockPersistence.restore).not.toHaveBeenCalled();
    expect(hook.result.current).toBeNull();
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

    const { result: hook } = renderHook(() => useAlchemyBootstrap(session));
    expect(hook.current).toBeNull();

    await act(async () => {
      pending.resolve(result);
      await pending.promise;
    });

    expect(mockPersistence.restore).toHaveBeenCalledWith(result.data, {
      preserveActiveRunIfInitialized: true,
      startAtMenu: true,
      restoreActions: undefined,
    });
    expect(hook.current).toBe(result);
  });

  it("starts play with defaults and recovery writes when bootstrap fails", async () => {
    mockPersistence.load.mockRejectedValue(new Error("steam down"));

    const { result: hook } = renderHook(() => useAlchemyBootstrap(session));
    expect(hook.current).toBeNull();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockPersistence.routeToRecovery).toHaveBeenCalledOnce();
    expect(mockPersistence.restore).toHaveBeenCalledWith(expect.objectContaining({ activeRun: null }), {
      preserveActiveRunIfInitialized: true,
      startAtMenu: true,
      restoreActions: undefined,
    });
    expect(hook.current?.status).toEqual({ kind: "unavailable" });
    expect(hook.current?.data.activeRun).toBeNull();
  });

  it("configures the backend before the dev wipe so desktop wipes honor cloud sync", async () => {
    vi.mocked(isAlchemyDevBuild).mockReturnValue(true);
    window.history.replaceState({}, "", "/?wipeLocalSave=1");
    const result: SaveLoadState = { data: defaultSaveData, status: { kind: "ok" } };
    mockPersistence.load.mockResolvedValue(result);

    const { result: hook } = renderHook(() => useAlchemyBootstrap(session));
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

    const { result: hook } = renderHook(() => useAlchemyBootstrap(session));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockPersistence.clear).not.toHaveBeenCalled();
    expect(new URL(window.location.href).searchParams.get("wipeLocalSave")).toBe("0");
    expect(hook.current).toBe(result);
  });

  it("preserves the protected-save status while making defaults ready", async () => {
    const result: SaveLoadState = {
      data: defaultSaveData,
      status: { kind: "unsupported-newer-schema", detectedSchemaVersion: 999 },
    };
    mockPersistence.load.mockResolvedValue(result);
    const { result: hook } = renderHook(() => useAlchemyBootstrap(session));
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockPersistence.restore).toHaveBeenCalledWith(defaultSaveData, {
      preserveActiveRunIfInitialized: true,
      startAtMenu: true,
      restoreActions: undefined,
    });
    expect(hook.current).toBe(result);
  });
});
