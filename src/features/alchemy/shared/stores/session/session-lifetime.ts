import type { SessionClock } from "./game-session-types";
import { createCleanup } from "@/lib/cleanup";

/** Resource ownership is independent of the consumers that schedule work. */
export function createSessionLifetime() {
  let disposed = false;
  const cleanups = new Set<() => void>();
  const assertActive = () => {
    if (disposed) throw new Error("Game session is disposed or invalid");
  };
  const track = (cleanup: () => void) => {
    assertActive();
    cleanups.add(cleanup);
    return createCleanup(() => {
      if (cleanups.delete(cleanup)) cleanup();
    });
  };
  return {
    track,
    isActive: () => !disposed,
    get disposed() {
      return disposed;
    },
    ownClock(source: SessionClock): SessionClock {
      const timers = new Map<ReturnType<SessionClock["setTimeout"]>, () => void>();
      return Object.freeze<SessionClock>({
        now: () => {
          assertActive();
          return source.now();
        },
        setTimeout(callback, delay) {
          assertActive();
          let active = true;
          let release: () => void = () => {};
          const timer = source.setTimeout(() => {
            if (!active || disposed) return;
            active = false;
            release();
            callback();
          }, delay);
          // An injected clock can finish (and even close this owner) before
          // returning its ID. Completed work needs no cleanup registration.
          if (!active) return timer;
          if (disposed) {
            active = false;
            source.clearTimeout(timer);
            return timer;
          }
          release = track(() => {
            timers.delete(timer);
            if (active) {
              active = false;
              source.clearTimeout(timer);
            }
          });
          timers.set(timer, release);
          return timer;
        },
        clearTimeout(timer) {
          // Cleanup remains safe and idempotent after disposal.
          timers.get(timer)?.();
        },
      });
    },
    close() {
      if (disposed) return [];
      disposed = true;
      const failures: unknown[] = [];
      for (const cleanup of [...cleanups]) {
        // A previous cleanup may already have released this peer.
        if (!cleanups.delete(cleanup)) continue;
        try {
          cleanup();
        } catch (error) {
          failures.push(error);
        }
      }
      return failures;
    },
  };
}
