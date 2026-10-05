import { isAnimationDisabled, ANIMATION_DISABLED_DURATION } from "@/lib/animation/animation-prefs";

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, resolveGameDelay(ms));
  });
}

export function resolveGameDelay(ms: number): number {
  return isAnimationDisabled() ? ANIMATION_DISABLED_DURATION : ms;
}

export interface TimerClock {
  setTimeout: (callback: () => void, delay: number) => ReturnType<typeof setTimeout> | number;
  clearTimeout: (timer: ReturnType<typeof setTimeout> | number) => void;
}

export class TimerGroup {
  private ids = new Set<ReturnType<typeof setTimeout> | number>();

  constructor(
    private readonly clock: TimerClock = {
      setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
      clearTimeout: (timer) => globalThis.clearTimeout(timer),
    },
  ) {}

  setTimeout(fn: () => void, ms: number): () => void {
    const id = this.clock.setTimeout(() => {
      this.ids.delete(id);
      fn();
    }, ms);
    this.ids.add(id);
    return () => {
      this.ids.delete(id);
      this.clock.clearTimeout(id);
    };
  }

  setGameTimeout(fn: () => void, ms: number): () => void {
    return this.setTimeout(fn, resolveGameDelay(ms));
  }

  get size(): number {
    return this.ids.size;
  }

  clearAll() {
    for (const id of this.ids) {
      this.clock.clearTimeout(id);
    }
    this.ids.clear();
  }
}
