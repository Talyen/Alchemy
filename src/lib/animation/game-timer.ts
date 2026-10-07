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
  private readonly pending = new Set<() => void>();

  constructor(
    private readonly clock: TimerClock = {
      setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
      clearTimeout: (timer) => globalThis.clearTimeout(timer),
    },
  ) {}

  setTimeout(fn: () => void, ms: number): () => void {
    const id = this.clock.setTimeout(() => {
      if (!this.pending.delete(cancel)) return;
      fn();
    }, ms);
    // Timer IDs may be reused; an old cancellation must not remove new work.
    const cancel = () => {
      if (this.pending.delete(cancel)) this.clock.clearTimeout(id);
    };
    this.pending.add(cancel);
    return cancel;
  }

  setGameTimeout(fn: () => void, ms: number): () => void {
    return this.setTimeout(fn, resolveGameDelay(ms));
  }

  get size(): number {
    return this.pending.size;
  }

  clearAll() {
    for (const cancel of this.pending) cancel();
  }
}
