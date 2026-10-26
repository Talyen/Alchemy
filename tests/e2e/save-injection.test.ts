import type { Page } from "@playwright/test";
import { expect, it, vi } from "vitest";
import { withSavedGame } from "./save-injection";
import { resumeInjectedRun } from "./navigation";

vi.mock("./navigation", () => ({ resumeInjectedRun: vi.fn() }));
vi.mock("./errors", () => ({ failOnRuntimeErrors: () => [] }));

function pages(activeRun: unknown = {}) {
  const events: string[] = [];
  const resumed = {
    goto: vi.fn(async () => events.push("boot")),
    evaluate: vi.fn(async () => ({ activeRun })),
    close: vi.fn(async () => events.push("close resume")),
  };
  const source = {
    url: () => "http://127.0.0.1:4173/",
    isClosed: () => false,
    close: vi.fn(async () => events.push("close source")),
    context: () => ({ newPage: async () => resumed }),
  };
  return { source: source as unknown as Page, resumed, events };
}

it("exits the seeded renderer before an unseeded translated resume can advance progress", async () => {
  const { source, resumed, events } = pages();
  await withSavedGame(
    source,
    async () => {
      events.push("play");
    },
    "Continuer",
  );
  expect(events).toEqual(["close source", "boot", "play", "close resume"]);
  expect(resumed.goto).toHaveBeenCalledExactlyOnceWith("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
  expect(resumeInjectedRun).toHaveBeenLastCalledWith(resumed, "Continuer");
});

it("closes a failed meta-only resume and preserves the source only when explicitly requested", async () => {
  const { source, resumed, events } = pages(null);
  vi.mocked(resumeInjectedRun).mockClear();
  const failure = new Error("missing purchased tier");
  await expect(
    withSavedGame(
      source,
      async () => {
        throw failure;
      },
      "Continue",
      { keepSource: true },
    ),
  ).rejects.toBe(failure);
  expect(events).toEqual(["boot", "close resume"]);
  expect(resumeInjectedRun).not.toHaveBeenCalled();
  expect(resumed.close).toHaveBeenCalledOnce();
});
