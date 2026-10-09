import { act } from "@testing-library/react";
import { vi } from "vitest";
import { requireProgress } from "./sequence";

let callbackDeliveries = 0;

export function installFrames() {
  vi.useFakeTimers({ loopLimit: 1000, now: new Date("2026-01-01T00:00:00Z") });
  const schedule = globalThis.setTimeout;
  vi.stubGlobal("setTimeout", (callback: (...args: unknown[]) => void, ms?: number, ...args: unknown[]) =>
    schedule(() => {
      callbackDeliveries++;
      requireProgress(callbackDeliveries <= 2000, "scheduler-callback-churn", { callbackDeliveries, ms });
      callback(...args);
    }, ms),
  );
  let paused = false;
  let nextFrame = 0;
  const waiting = new Map<number, FrameRequestCallback>();
  const scheduled = new Map<number, ReturnType<typeof setTimeout>>();
  const deliver = (id: number, callback: FrameRequestCallback) => {
    scheduled.set(
      id,
      setTimeout(() => {
        scheduled.delete(id);
        if (paused) waiting.set(id, callback);
        else callback(performance.now());
      }, 16),
    );
  };
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = ++nextFrame;
    if (paused) waiting.set(id, callback);
    else deliver(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    const timer = scheduled.get(id);
    if (timer !== undefined) clearTimeout(timer);
    scheduled.delete(id);
    waiting.delete(id);
  });
  return {
    pauseFrames: () => {
      paused = true;
    },
    resumeFrames: () => {
      paused = false;
      for (const [id, callback] of waiting) deliver(id, callback);
      waiting.clear();
    },
  };
}
export async function advance(ms = 2000) {
  callbackDeliveries = 0;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** Deliver preference changes through the platform seam, retaining real hook subscriptions. */
export function installMotionPreference(initial = false) {
  let reduced = initial;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        media: query,
        get matches() {
          return query === "(prefers-reduced-motion: reduce)" && reduced;
        },
        onchange: null,
        addListener: (listener: (event: MediaQueryListEvent) => void) => {
          listeners.add(listener);
        },
        removeListener: (listener: (event: MediaQueryListEvent) => void) => {
          listeners.delete(listener);
        },
        addEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => {
          listeners.add(listener);
        },
        removeEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => {
          listeners.delete(listener);
        },
        dispatchEvent: () => true,
      }) as MediaQueryList,
  );
  return (value: boolean) => {
    reduced = value;
    const event = Object.assign(new Event("change"), { matches: reduced, media: "(prefers-reduced-motion: reduce)" });
    for (const listener of listeners) listener(event as MediaQueryListEvent);
  };
}
