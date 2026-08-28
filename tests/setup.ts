if (typeof globalThis.window === "undefined") {
  Object.defineProperty(globalThis, "window", {
    value: { alchemyDesktop: undefined },
    writable: true,
    configurable: true,
  });
}
