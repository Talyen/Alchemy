import { createCleanup } from "@/lib/cleanup";

/** Synchronous publication in FIFO order, including changes triggered by observers. */
export function createNotificationChannel<Args extends unknown[]>(
  onError: (error: unknown) => void,
  isActive: () => boolean = () => true,
) {
  type Listener = (...args: Args) => void;
  const listeners = new Set<Listener>();
  const pending: Array<{ args: Args; listeners: Listener[] }> = [];
  let publishing = false;
  return {
    subscribe(this: void, listener: Listener) {
      // Each registration owns its cleanup, even when callers share a callback.
      const subscription: Listener = (...args) => listener(...args);
      listeners.add(subscription);
      return createCleanup(() => {
        listeners.delete(subscription);
      });
    },
    publish(this: void, ...args: Args) {
      if (!isActive()) return;
      pending.push({ args, listeners: [...listeners] });
      if (publishing) return;
      publishing = true;
      try {
        for (let index = 0; index < pending.length; index++) {
          const event = pending[index]!;
          for (const listener of event.listeners) {
            // Ordinary unsubscribe preserves this publication's snapshot. Closing
            // its owner revokes even callbacks already captured or queued.
            if (!isActive()) return;
            try {
              listener(...event.args);
            } catch (error) {
              try {
                onError(error);
              } catch {
                // A failed diagnostic must not abort delivery or discard queued publications.
              }
            }
          }
        }
      } finally {
        pending.length = 0;
        publishing = false;
      }
    },
    clear(this: void) {
      listeners.clear();
    },
  };
}
