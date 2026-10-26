import type { SessionClock } from "./game-session-types";
import { createCleanup } from "@/lib/cleanup";

/** Resource ownership is independent of the consumers that schedule work. */
export function createSessionLifetime() {
  let disposed = false;
  const cleanups = new Set<{ cleanup: () => void }>();
  const assertActive = () => {
    if (disposed) throw new Error("Game session is disposed or invalid");
  };
  const track = (cleanup: () => void) => {
    assertActive();
    const registration = { cleanup };
    cleanups.add(registration);
    return createCleanup(() => {
      if (cleanups.delete(registration)) cleanup();
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
          let cancelled = false;
          let timer: { id: ReturnType<SessionClock["setTimeout"]> } | undefined;
          const release = track(() => {
            if (timer && timers.get(timer.id) === release) timers.delete(timer.id);
            if (active) {
              active = false;
              cancelled = true;
              if (timer) source.clearTimeout(timer.id);
            }
          });
          try {
            timer = {
              id: source.setTimeout(() => {
                if (!active || disposed) return;
                active = false;
                release();
                callback();
              }, delay),
            };
            // A synchronous callback can schedule a new timer with the same ID.
            // Never replace that timer's ownership with this completed timer.
            if (active) timers.set(timer.id, release);
            else if (cancelled) source.clearTimeout(timer.id);
            return timer.id;
          } catch (error) {
            release();
            throw error;
          }
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
      for (const registration of [...cleanups]) {
        // A previous cleanup may already have released this peer.
        if (!cleanups.delete(registration)) continue;
        try {
          registration.cleanup();
        } catch (error) {
          failures.push(error);
        }
      }
      return failures;
    },
  };
}
