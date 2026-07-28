import { describe, expect, it, vi } from "vitest";

import { armRendererSentryCrashTest, throwControlledRendererCrash } from "@/lib/sentry-crash-test";

describe("renderer Sentry crash verification", () => {
  it("only arms in the desktop renderer and schedules a bundled throw", () => {
    let listener: EventListenerOrEventListenerObject | undefined;
    const target = {
      addEventListener: vi.fn((_event: string, callback: EventListenerOrEventListenerObject) => {
        listener = callback;
      }),
    };
    const scheduler = vi.fn();

    expect(armRendererSentryCrashTest(target, scheduler, false)).toBe(false);
    expect(target.addEventListener).not.toHaveBeenCalled();

    expect(armRendererSentryCrashTest(target, scheduler, true)).toBe(true);
    expect(target.addEventListener).toHaveBeenCalledWith("alchemy-sentry-crash-test", expect.any(Function), {
      once: true,
    });
    expect(typeof listener).toBe("function");
    if (typeof listener === "function") listener(new Event("alchemy-sentry-crash-test"));
    expect(scheduler).toHaveBeenCalledWith(throwControlledRendererCrash, 0);
  });

  it("throws the controlled error from bundled renderer source", () => {
    expect(throwControlledRendererCrash).toThrow("Alchemy controlled Sentry renderer crash");
  });
});
