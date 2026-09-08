import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useAlchemyAutosaveFromStores } from "@/app/use-app-save-state";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setGold, setHasActiveRun } from "@/features/alchemy/shared/stores/run-session-write-port";

import {
  configureSaveBackend,
  clearAlchemySaveData,
  resetStorageIoForTests,
  setWritesDisabled,
} from "@/features/alchemy/shared/storage";
import { resetAllTestStores } from "../helpers/gameplay-store-test";
import { deferred } from "../helpers/deferred";
import type { SaveBackend } from "@/lib/platform-save-backend";

function changeGold(gold: number) {
  act(() => {
    dispatchRunSessionCommand((draft) => setGold(draft, gold));
  });
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function installBackend() {
  const write = vi.fn<SaveBackend["write"]>().mockResolvedValue({ ok: true });
  const writeSync = vi.fn<SaveBackend["writeSync"]>().mockReturnValue({ ok: true });
  configureSaveBackend({
    readCandidates: async () => ({ ok: true, candidates: [] }),
    write,
    writeSync,
    clear: async () => ({ ok: true }),
  });
  return { write, writeSync };
}

const mockStorage: Record<string, string> = {};

function setupLocalStorage() {
  const storage = {
    getItem: (key: string) => mockStorage[key] ?? null,
    setItem: (key: string, value: string) => {
      mockStorage[key] = value;
    },
    removeItem: (key: string) => {
      delete mockStorage[key];
    },
    clear: () => {
      Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    },
    key: (index: number) => Object.keys(mockStorage)[index] ?? null,
    get length() {
      return Object.keys(mockStorage).length;
    },
  } as Storage;

  Object.defineProperty(window, "localStorage", { value: storage, configurable: true });
}

describe("useAlchemyAutosaveFromStores", () => {
  beforeEach(async () => {
    await resetStorageIoForTests();
    resetAllTestStores();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.useFakeTimers();
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    setupLocalStorage();
  });

  afterEach(async () => {
    cleanup();
    await resetStorageIoForTests();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("writes debounced saves through storage io with lastSavedAt", async () => {
    renderHook(() => useAlchemyAutosaveFromStores(true));

    act(() => {
      dispatchRunSessionCommand((draft) => setGold(draft, 77));
    });

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    const keys = Object.keys(mockStorage);
    expect(keys.length).toBeGreaterThan(0);
    const written = JSON.parse(mockStorage[keys[0]!]);
    expect(written.lastSavedAt).toBeGreaterThan(0);
  });

  it("flushes the latest dirty snapshot on pagehide before the debounce expires", () => {
    renderHook(() => useAlchemyAutosaveFromStores(true));

    act(() => {
      dispatchRunSessionCommand((draft) => {
        setHasActiveRun(draft, true);
        setGold(draft, 91);
      });
      window.dispatchEvent(new PageTransitionEvent("pagehide"));
    });

    const keys = Object.keys(mockStorage);
    expect(keys).toHaveLength(1);
    expect(JSON.parse(mockStorage[keys[0]!]!).gold).toBe(91);
  });

  it("flushes within the max wait even when commits keep resetting the debounce", async () => {
    renderHook(() => useAlchemyAutosaveFromStores(true));

    act(() => {
      dispatchRunSessionCommand((draft) => setGold(draft, 1));
    });
    let lastGold = 1;
    for (let i = 0; i < 39; i++) {
      await act(async () => {
        vi.advanceTimersByTime(250);
        lastGold = 2 + i;
        dispatchRunSessionCommand((draft) => setGold(draft, lastGold));
      });
    }
    expect(Object.keys(mockStorage)).toHaveLength(0);

    await act(async () => {
      vi.advanceTimersByTime(250);
      await Promise.resolve();
    });
    const keys = Object.keys(mockStorage);
    expect(keys.length).toBeGreaterThan(0);
    expect(JSON.parse(mockStorage[keys[0]!]!).gold).toBe(lastGold);
  });
  it.each(["reported", "thrown"])("retries a %s failure on exit without another change", async (failure) => {
    const { write, writeSync } = installBackend();
    if (failure === "reported") write.mockResolvedValueOnce({ ok: false, error: "disk" });
    else write.mockRejectedValueOnce(new Error("disk"));
    renderHook(() => useAlchemyAutosaveFromStores());
    changeGold(91);
    await advance(500);
    expect(write).toHaveBeenCalledTimes(1);
    act(() => {
      window.dispatchEvent(new PageTransitionEvent("pagehide"));
    });
    expect(JSON.parse(writeSync.mock.calls[0]![1]).gold).toBe(91);
    await advance(20_000);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("retries automatically after storage recovers without another change", async () => {
    const { write } = installBackend();
    write.mockResolvedValueOnce({ ok: false, error: "disk" });
    renderHook(() => useAlchemyAutosaveFromStores());
    changeGold(42);
    await advance(500);
    await advance(9999);
    expect(write).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(write).toHaveBeenCalledTimes(2);
    expect(JSON.parse(write.mock.calls[1]![1]).gold).toBe(42);
    await advance(20_000);
    expect(write).toHaveBeenCalledTimes(2);
  });

  it("keeps newer changes dirty when an older write finishes", async () => {
    const { write, writeSync } = installBackend();
    const gate = deferred<{ ok: true }>();
    write.mockReturnValueOnce(gate.promise);
    renderHook(() => useAlchemyAutosaveFromStores());
    changeGold(1);
    await advance(500);
    changeGold(2);
    await act(async () => {
      gate.resolve({ ok: true });
    });
    act(() => {
      window.dispatchEvent(new PageTransitionEvent("pagehide"));
    });
    expect(JSON.parse(writeSync.mock.calls[0]![1]).gold).toBe(2);
  });

  it("limits sustained failures even when new changes disable animations", async () => {
    const { write } = installBackend();
    write.mockResolvedValue({ ok: false, error: "disk" });
    renderHook(() => useAlchemyAutosaveFromStores());
    changeGold(1);
    await advance(500);
    mockStorage["alchemy-disable-animations"] = "true";
    for (let i = 0; i < 9; i++) {
      await advance(1000);
      changeGold(i + 2);
    }
    expect(write).toHaveBeenCalledTimes(1);
    await advance(1000);
    expect(write).toHaveBeenCalledTimes(2);
    expect(JSON.parse(write.mock.calls[1]![1]).gold).toBe(10);
    await advance(9999);
    expect(write).toHaveBeenCalledTimes(2);
    await advance(1);
    expect(write).toHaveBeenCalledTimes(3);
  });

  it.each(["clear", "protection", "disabled"])("cancels a scheduled retry on %s", async (action) => {
    const { write, writeSync } = installBackend();
    write.mockResolvedValue({ ok: false, error: "disk" });
    const hook = renderHook(({ enabled }) => useAlchemyAutosaveFromStores(enabled), {
      initialProps: { enabled: true },
    });
    changeGold(1);
    await advance(500);
    if (action === "clear")
      await act(async () => {
        await clearAlchemySaveData();
      });
    if (action === "protection")
      act(() => {
        setWritesDisabled(true);
      });
    if (action === "disabled") hook.rerender({ enabled: false });
    await advance(20_000);
    act(() => {
      window.dispatchEvent(new PageTransitionEvent("pagehide"));
    });
    expect(write).toHaveBeenCalledTimes(1);
    expect(writeSync).not.toHaveBeenCalled();
  });

  it("does not schedule after cleanup and late failed completion", async () => {
    const { write, writeSync } = installBackend();
    const gate = deferred<{ ok: false; error: string }>();
    write.mockReturnValue(gate.promise);
    writeSync.mockReturnValue(null);
    const hook = renderHook(() => useAlchemyAutosaveFromStores());
    changeGold(1);
    await advance(500);
    hook.unmount();
    await act(async () => {
      gate.resolve({ ok: false, error: "disk" });
    });
    const attempts = write.mock.calls.length;
    await advance(30_000);
    expect(write).toHaveBeenCalledTimes(attempts);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("retains a failed synchronous exit for the next lifecycle attempt", async () => {
    const { writeSync } = installBackend();
    writeSync.mockReturnValueOnce({ ok: false, error: "disk" });
    renderHook(() => useAlchemyAutosaveFromStores());
    changeGold(7);
    act(() => {
      window.dispatchEvent(new PageTransitionEvent("pagehide"));
    });
    act(() => {
      window.dispatchEvent(new Event("beforeunload"));
    });
    expect(writeSync).toHaveBeenCalledTimes(2);
    await advance(20_000);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("ignores a pre-clear completion while saving new post-clear progress", async () => {
    const { write } = installBackend();
    const gate = deferred<{ ok: true }>();
    write.mockReturnValueOnce(gate.promise);
    renderHook(() => useAlchemyAutosaveFromStores());
    changeGold(10);
    await advance(500);
    await act(async () => {
      const clearing = clearAlchemySaveData();
      gate.resolve({ ok: true });
      await clearing;
    });
    changeGold(0);
    await advance(500);
    expect(write).toHaveBeenCalledTimes(2);
    expect(JSON.parse(write.mock.calls[1]![1]).gold).toBe(0);
    await advance(20_000);
    expect(write).toHaveBeenCalledTimes(2);
  });

  it("does not acknowledge a pending desktop exit until it succeeds", async () => {
    const { write, writeSync } = installBackend();
    const gate = deferred<{ ok: false; error: string }>();
    write.mockReturnValueOnce(gate.promise);
    writeSync.mockReturnValue(null);
    renderHook(() => useAlchemyAutosaveFromStores());
    changeGold(8);
    act(() => {
      window.dispatchEvent(new PageTransitionEvent("pagehide"));
    });
    await advance(0);
    await act(async () => {
      gate.resolve({ ok: false, error: "disk" });
    });
    await advance(10_000);
    expect(write).toHaveBeenCalledTimes(2);
    expect(JSON.parse(write.mock.calls[1]![1]).gold).toBe(8);
  });
});
