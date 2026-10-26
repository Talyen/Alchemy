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
    let timer: { id: ReturnType<TimerClock["setTimeout"]> } | undefined;
    let cancelled = false;
    // Register ownership before invoking the clock, which may fire or cancel
    // synchronously. Timer IDs may also be reused by later registrations.
    const cancel = () => {
      if (!this.pending.delete(cancel)) return;
      cancelled = true;
      if (timer) this.clock.clearTimeout(timer.id);
    };
    this.pending.add(cancel);
    try {
      timer = {
        id: this.clock.setTimeout(() => {
          if (!this.pending.delete(cancel)) return;
          fn();
        }, ms),
      };
      if (cancelled) this.clock.clearTimeout(timer.id);
    } catch (error) {
      this.pending.delete(cancel);
      throw error;
    }
    return cancel;
  }

  setGameTimeout(fn: () => void, ms: number): () => void {
    return this.setTimeout(fn, resolveGameDelay(ms));
  }

  get size(): number {
    return this.pending.size;
  }

  clearAll() {
    const errors: unknown[] = [];
    for (const cancel of this.pending) {
      try {
        cancel();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) throw new AggregateError(errors, "Game timer cancellation failed");
  }
}
