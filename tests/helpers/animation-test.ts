import { afterEach, beforeEach, vi } from "vitest";

const DISABLE_ANIMATIONS_KEY = "alchemy-disable-animations";

/** Collapse cosmetic JS delays for behavior tests that do not assert animation timing. */
export function installDisabledAnimationsForTests(): void {
  let previousValue: string | null = null;

  beforeEach(() => {
    previousValue = localStorage.getItem(DISABLE_ANIMATIONS_KEY);
    localStorage.setItem(DISABLE_ANIMATIONS_KEY, "true");
  });

  afterEach(() => {
    if (previousValue === null) localStorage.removeItem(DISABLE_ANIMATIONS_KEY);
    else localStorage.setItem(DISABLE_ANIMATIONS_KEY, previousValue);
  });
}

/**
 * Queue-based requestAnimationFrame stub for jsdom tests. Returns the queued
 * callbacks; flush them manually (e.g. `frames.forEach((cb) => cb(16))`).
 * Pair with `vi.unstubAllGlobals()` in afterEach.
 */
export function installRafStub(): FrameRequestCallback[] {
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  return frames;
}
