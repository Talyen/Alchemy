import { afterEach, expect, it, vi } from "vitest";
import { advance, installFrames } from "./timing";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("fails callback churn before a zero-delay loop can hang discovery", async () => {
  installFrames();
  const loop = () => {
    setTimeout(loop, 0);
  };
  loop();
  await expect(advance(5000)).rejects.toMatchObject({ invariant: "scheduler-callback-churn" });
});
