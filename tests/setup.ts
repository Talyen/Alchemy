// Shared vitest setup for all unit tests.
if (typeof globalThis.window === "undefined") {
  Object.defineProperty(globalThis, "window", {
    value: { alchemyDesktop: undefined },
    writable: true,
    configurable: true,
  });
}
