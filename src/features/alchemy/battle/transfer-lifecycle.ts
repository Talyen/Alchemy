// Cancellation registry for card transfer promises used by the battle controller.
// Depends only on callbacks so animation cancellation stays testable and separate from React state.

export type TransferCancelRegistry = {
  register: (callback: () => void) => () => void;
  cancelAll: () => void;
};

export function createTransferCancelRegistry(): TransferCancelRegistry {
  // A registry lets cleared transfer timers resolve pending animation promises instead of stranding callers.
  const callbacks = new Set<() => void>();

  return {
    register(callback) {
      callbacks.add(callback);
      return () => callbacks.delete(callback);
    },
    cancelAll() {
      const pendingCallbacks = Array.from(callbacks);
      callbacks.clear();
      pendingCallbacks.forEach((callback) => callback());
    },
  };
}
