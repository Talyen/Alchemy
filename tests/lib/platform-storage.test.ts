import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { platform } from "@/lib/platform";

function createMockStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => data.clear(),
  };
}

describe("platform.storage", () => {
  const originalDesktop = window.alchemyDesktop;
  const originalLocalStorage = window.localStorage;

  beforeEach(() => {
    window.alchemyDesktop = undefined;
    Object.defineProperty(window, "localStorage", {
      value: createMockStorage(),
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    window.alchemyDesktop = originalDesktop;
    Object.defineProperty(window, "localStorage", {
      value: originalLocalStorage,
      configurable: true,
      writable: true,
    });
  });

  it("reads and writes via localStorage on web", async () => {
    const write = await platform.storage.writeLocal("alchemy-test", '{"ok":true}');
    expect(write.ok).toBe(true);
    const read = await platform.storage.readLocal("alchemy-test");
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.data).toBe('{"ok":true}');
  });

  it("reads via localStorage on web", async () => {
    window.localStorage.setItem("test", '{"web":true}');
    const read = await platform.storage.readLocal("test");
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.data).toBe('{"web":true}');
  });
});
