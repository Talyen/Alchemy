import { afterEach, expect, it, vi } from "vitest";
import { builtinEnvironments } from "vitest/environments";
import environment from "../jsdom-environment";

afterEach(() => vi.restoreAllMocks());

function createNodeGlobal() {
  const global: Record<string, any> = {};
  for (const key of ["localStorage", "sessionStorage"]) {
    Object.defineProperty(global, key, {
      configurable: true,
      enumerable: true,
      get: () => {
        throw new Error("Node storage needs a file");
      },
    });
  }
  return global;
}

it("uses browser storage without reading native getters and restores the Node descriptors after teardown", async () => {
  const global = createNodeGlobal();
  const original = Object.getOwnPropertyDescriptors(global);
  const dom = await environment.setup(global, {});
  try {
    global.localStorage.setItem("save", "local");
    global.sessionStorage.setItem("save", "session");
    expect(global.localStorage.getItem("save")).toBe("local");
    expect(global.sessionStorage.getItem("save")).toBe("session");
    expect(global.localStorage).toBe(global.jsdom.window.localStorage);
  } finally {
    await dom.teardown(global);
  }
  for (const key of ["localStorage", "sessionStorage"])
    expect(Object.getOwnPropertyDescriptor(global, key)).toEqual(original[key]);
});

it("restores native storage even when DOM initialization fails", async () => {
  const global = createNodeGlobal();
  const original = Object.getOwnPropertyDescriptors(global);
  vi.spyOn(builtinEnvironments.jsdom, "setup").mockRejectedValueOnce(new Error("DOM initialization failed"));
  await expect(environment.setup(global, {})).rejects.toThrow("DOM initialization failed");
  expect(Object.getOwnPropertyDescriptors(global)).toEqual(original);
});
