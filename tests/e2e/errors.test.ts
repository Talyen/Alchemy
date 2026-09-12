import { EventEmitter } from "node:events";
import type { Page } from "@playwright/test";
import { expect, it, vi } from "vitest";
import { failOnRuntimeErrors } from "./errors";

it("collects runtime, audio, and React console errors without blanket exclusions", () => {
  const page = new EventEmitter();
  const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
  try {
    const errors = failOnRuntimeErrors(page as unknown as Page);
    const runtimeError = new Error("Uncaught failure");
    page.emit("pageerror", runtimeError);
    for (const text of ["Failed to load or decode sound", "true was passed to the non-boolean attribute"]) {
      page.emit("console", { type: () => "error", text: () => text });
    }
    page.emit("console", { type: () => "warning", text: () => "ordinary warning" });
    expect(errors).toEqual([
      runtimeError.stack,
      "Failed to load or decode sound",
      "true was passed to the non-boolean attribute",
    ]);
  } finally {
    log.mockRestore();
  }
});
