/** Synchronous publication in FIFO order, including changes triggered by observers. */
export function createNotificationChannel<Args extends unknown[]>(onError: (error: unknown) => void) {
  type Listener = (...args: Args) => void;
  const listeners = new Set<Listener>();
  const pending: Array<{ args: Args; listeners: Listener[] }> = [];
  let publishing = false;
  return {
    subscribe(this: void, listener: Listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    publish(this: void, ...args: Args) {
      pending.push({ args, listeners: [...listeners] });
      if (publishing) return;
      publishing = true;
      try {
        for (let index = 0; index < pending.length; index++) {
          const event = pending[index]!;
          for (const listener of event.listeners) {
            try {
              listener(...event.args);
            } catch (error) {
              onError(error);
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
