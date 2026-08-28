import { afterEach, beforeEach, vi } from "vitest";

const DISABLE_ANIMATIONS_KEY = "alchemy-disable-animations";

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

export function installRafStub(): FrameRequestCallback[] {
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  return frames;
}
