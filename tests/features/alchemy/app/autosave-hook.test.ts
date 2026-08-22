// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAlchemyAutosaveFromStores } from "@/app/use-app-save-state";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setRunGold } from "@/features/alchemy/shared/stores/run-session-write-port";
import { useRunTransientStore } from "../../../helpers/gameplay-store-test";

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
  beforeEach(() => {
    vi.useFakeTimers();
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    setupLocalStorage();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes debounced saves through storage io with lastSavedAt", async () => {
    renderHook(() => useAlchemyAutosaveFromStores(true));

    act(() => {
      dispatchRunSessionCommand((draft) => setRunGold(draft, 77));
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
      useRunTransientStore.getState().setHasActiveRun(true);
      dispatchRunSessionCommand((draft) => setRunGold(draft, 91));
      window.dispatchEvent(new PageTransitionEvent("pagehide"));
    });

    const keys = Object.keys(mockStorage);
    expect(keys).toHaveLength(1);
    expect(JSON.parse(mockStorage[keys[0]!]!).gold).toBe(91);
  });

  it("flushes within the max wait even when commits keep resetting the debounce", async () => {
    renderHook(() => useAlchemyAutosaveFromStores(true));

    // Commits every 250ms never leave a 500ms quiet gap, so only the max-wait
    // can produce a write while play continues.
    act(() => {
      dispatchRunSessionCommand((draft) => setRunGold(draft, 1));
    });
    let lastGold = 1;
    for (let i = 0; i < 39; i++) {
      await act(async () => {
        vi.advanceTimersByTime(250);
        lastGold = 2 + i;
        dispatchRunSessionCommand((draft) => setRunGold(draft, lastGold));
      });
    }
    expect(Object.keys(mockStorage)).toHaveLength(0);

    // AUTOSAVE_MAX_WAIT_MS (10s) after the first dirty commit elapses and the
    // pending forced flush finally fires with the freshest committed value.
    await act(async () => {
      vi.advanceTimersByTime(250);
      await Promise.resolve();
    });
    const keys = Object.keys(mockStorage);
    expect(keys.length).toBeGreaterThan(0);
    expect(JSON.parse(mockStorage[keys[0]!]!).gold).toBe(lastGold);
  });
});
