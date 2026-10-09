import { setRunProgressActivity } from "@/features/alchemy/shared/stores/run-session-write-port";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useAlchemyAutosaveFromStores } from "@/app/use-app-save-state";
import { acceptCommand, dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setGold, setHasActiveRun } from "@/features/alchemy/shared/stores/run-session-write-port";

import { createSessionPersistence } from "@/features/alchemy/shared/storage";
import { resetAllTestStores } from "../helpers/run-domain-store-test";
import { deferred } from "../helpers/deferred";
import type { SaveBackend } from "@/lib/platform-save-backend";
import { defaultGameSession } from "@/app/application-session";
import * as runLifecycle from "@/features/alchemy/shared/stores/run-lifecycle";
import { AUTOSAVE_RETRY_COOLDOWN_MS } from "@/lib/game-constants";
import { createAlchemyAutosaveLifecycle } from "@/app/autosave-lifecycle";

const persistence = createSessionPersistence(defaultGameSession);

function changeGold(gold: number) {
  act(() => {
    dispatchRunSessionCommand((draft) => acceptCommand(setGold(draft, gold)), undefined, defaultGameSession);
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
  persistence.configure({
    readCandidates: async () => ({ ok: true, candidates: [] }),
    write,
    writeSync,
    clear: async () => ({ ok: true }),
  });
  return { write, writeSync };
}

describe("useAlchemyAutosaveFromStores", () => {
  beforeEach(async () => {
    await persistence.resetForTests();
    resetAllTestStores();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.useFakeTimers();
    window.localStorage.clear();
  });

  afterEach(async () => {
    cleanup();
    await persistence.resetForTests();
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("acknowledges committed progress through storage io with lastSavedAt", async () => {
    const { write } = installBackend();
    renderHook(() => useAlchemyAutosaveFromStores(true));

    changeGold(77);
    await advance(600);

    expect(write).toHaveBeenCalledTimes(1);
    const written = JSON.parse(write.mock.calls[0]![1]);
    expect(written.gold).toBe(77);
    expect(written.lastSavedAt).toBeGreaterThan(0);
  });

  it("backs off snapshot failures and saves the latest progress after recovery", async () => {
    const { write, writeSync } = installBackend();
    const snapshot = vi.spyOn(runLifecycle, "resolveActiveRunForSave").mockImplementation(() => {
      throw new Error("snapshot failed");
    });
    renderHook(() => useAlchemyAutosaveFromStores());
    changeGold(8);
    await advance(500);
    expect(snapshot).toHaveBeenCalledOnce();
    act(() => {
      window.dispatchEvent(new PageTransitionEvent("pagehide"));
      window.dispatchEvent(new Event("beforeunload"));
    });
    expect(snapshot).toHaveBeenCalledTimes(2);
    localStorage.setItem("alchemy-disable-animations", "true");
    changeGold(9);
    await advance(100);
    expect(snapshot).toHaveBeenCalledTimes(2);
    expect(write).not.toHaveBeenCalled();
    expect(writeSync).not.toHaveBeenCalled();

    snapshot.mockRestore();
    await advance(AUTOSAVE_RETRY_COOLDOWN_MS - 100);
    expect(write).toHaveBeenCalledOnce();
    expect(JSON.parse(write.mock.calls[0]![1]).gold).toBe(9);
    await advance(AUTOSAVE_RETRY_COOLDOWN_MS);
    expect(write).toHaveBeenCalledOnce();
  });

  it("ignores cancelled timer callbacks and disposed flushes without losing newer scheduled work", async () => {
    const { write } = installBackend();
    const callbacks: Array<() => void> = [];
    const lifecycle = createAlchemyAutosaveLifecycle(
      undefined,
      {
        now: () => Date.now(),
        setTimeout: (callback) => {
          callbacks.push(callback);
          return 1;
        },
        clearTimeout: vi.fn(),
      },
      defaultGameSession,
    );
    try {
      changeGold(8);
      changeGold(9);
      callbacks[0]!();
      await advance(0);
      expect(write).not.toHaveBeenCalled();
      callbacks[1]!();
      await advance(0);
      expect(write).toHaveBeenCalledOnce();
      expect(JSON.parse(write.mock.calls[0]![1]).gold).toBe(9);
      changeGold(10);
      lifecycle.dispose(false);
      callbacks[2]!();
      lifecycle.flush(true);
      await advance(0);
      expect(write).toHaveBeenCalledOnce();
    } finally {
      lifecycle.dispose(false);
    }
  });

  it("flushes the latest dirty snapshot on pagehide before the debounce expires", () => {
    const { writeSync } = installBackend();
    renderHook(() => useAlchemyAutosaveFromStores(true));

    act(() => {
      dispatchRunSessionCommand(
        (draft) => {
          setHasActiveRun(draft, true);
          setRunProgressActivity(draft, "destination");
          setGold(draft, 91);

          return acceptCommand();
        },
        undefined,
        defaultGameSession,
      );
      window.dispatchEvent(new PageTransitionEvent("pagehide"));
    });

    expect(writeSync).toHaveBeenCalledTimes(1);
    expect(JSON.parse(writeSync.mock.calls[0]![1]).gold).toBe(91);
  });

  it("flushes on visibilitychange to hidden", () => {
    const { writeSync } = installBackend();
    renderHook(() => useAlchemyAutosaveFromStores(true));
    changeGold(5);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(writeSync).toHaveBeenCalledTimes(1);
    expect(JSON.parse(writeSync.mock.calls[0]![1]).gold).toBe(5);
  });

  it("groups synchronous action commits into one checkpoint without waiting for debounce", async () => {
    const { write } = installBackend();
    renderHook(() => useAlchemyAutosaveFromStores(true));
    changeGold(1);
    changeGold(2);
    changeGold(5);
    await advance(0);
    expect(write).toHaveBeenCalledOnce();
    expect(JSON.parse(write.mock.calls[0]![1]).gold).toBe(5);
    await advance(20_000);
    expect(write).toHaveBeenCalledOnce();
  });
  it.each(["reported", "thrown"])("retries a %s failure on exit without another change", async (failure) => {
    const { write, writeSync } = installBackend();
    if (failure === "reported") {
      write.mockResolvedValueOnce({ ok: false, error: "disk" });
      write.mockResolvedValueOnce({ ok: false, error: "recovery disk" });
    } else {
      write.mockRejectedValueOnce(new Error("disk"));
      write.mockRejectedValueOnce(new Error("recovery disk"));
    }
    renderHook(() => useAlchemyAutosaveFromStores());
    changeGold(91);
    await advance(500);
    expect(write).toHaveBeenCalledTimes(2);
    act(() => {
      window.dispatchEvent(new PageTransitionEvent("pagehide"));
    });
    expect(JSON.parse(writeSync.mock.calls[0]![1]).gold).toBe(91);
    await advance(20_000);
    expect(write).toHaveBeenCalledTimes(2);
  });

  it("retries automatically after storage recovers without another change", async () => {
    const { write } = installBackend();
    write.mockResolvedValueOnce({ ok: false, error: "disk" });
    write.mockResolvedValueOnce({ ok: false, error: "recovery disk" });
    renderHook(() => useAlchemyAutosaveFromStores());
    changeGold(42);
    await advance(0);
    await advance(9999);
    expect(write).toHaveBeenCalledTimes(2);
    await advance(1);
    expect(write).toHaveBeenCalledTimes(3);
    expect(JSON.parse(write.mock.calls[2]![1]).gold).toBe(42);
    await advance(20_000);
    expect(write).toHaveBeenCalledTimes(3);
  });

  it("keeps newer changes dirty when an older write finishes", async () => {
    const { write, writeSync } = installBackend();
    const gate = deferred<{ ok: true }>();
    write.mockReturnValueOnce(gate.promise);
    renderHook(() => useAlchemyAutosaveFromStores());
    changeGold(1);
    await advance(0);
    changeGold(2);
    await act(async () => {
      gate.resolve({ ok: true });
    });
    act(() => {
      window.dispatchEvent(new PageTransitionEvent("pagehide"));
    });
    expect(writeSync).not.toHaveBeenCalled();
    expect(JSON.parse(write.mock.calls.at(-1)![1]).gold).toBe(2);
  });

  it("limits sustained failures even when new changes disable animations", async () => {
    const { write } = installBackend();
    write.mockResolvedValue({ ok: false, error: "disk" });
    renderHook(() => useAlchemyAutosaveFromStores());
    changeGold(1);
    await advance(0);
    window.localStorage.setItem("alchemy-disable-animations", "true");
    for (let i = 0; i < 9; i++) {
      await advance(1000);
      changeGold(i + 2);
    }
    expect(write).toHaveBeenCalledTimes(2);
    await advance(1000);
    expect(write).toHaveBeenCalledTimes(4);
    expect(JSON.parse(write.mock.calls[2]![1]).gold).toBe(10);
    await advance(9999);
    expect(write).toHaveBeenCalledTimes(4);
    await advance(1);
    expect(write).toHaveBeenCalledTimes(6);
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
        await persistence.clear();
      });
    if (action === "protection")
      act(() => {
        persistence.setWritesDisabled(true);
      });
    if (action === "disabled") hook.rerender({ enabled: false });
    await advance(20_000);
    act(() => {
      window.dispatchEvent(new PageTransitionEvent("pagehide"));
    });
    expect(write).toHaveBeenCalledTimes(2);
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

  it("writes one exit snapshot across pagehide and beforeunload, retrying a failed sync exit on the timer", async () => {
    const { write, writeSync } = installBackend();
    writeSync.mockReturnValueOnce({ ok: false, error: "disk" });
    writeSync.mockReturnValueOnce({ ok: false, error: "recovery disk" });
    renderHook(() => useAlchemyAutosaveFromStores());
    changeGold(7);
    act(() => {
      window.dispatchEvent(new PageTransitionEvent("pagehide"));
    });
    act(() => {
      window.dispatchEvent(new Event("beforeunload"));
    });
    expect(writeSync).toHaveBeenCalledTimes(2);
    await advance(10_000);
    expect(write).toHaveBeenCalledTimes(1);
    expect(JSON.parse(write.mock.calls[0]![1]).gold).toBe(7);
    await advance(20_000);
    expect(write).toHaveBeenCalledTimes(1);
  });
  it("ignores a pre-clear completion while saving new post-clear progress", async () => {
    const { write } = installBackend();
    const gate = deferred<{ ok: true }>();
    write.mockReturnValueOnce(gate.promise);
    renderHook(() => useAlchemyAutosaveFromStores());
    changeGold(10);
    await advance(500);
    await act(async () => {
      const clearing = persistence.clear();
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
