import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runRelease } from "../../scripts/lib/release-runner.mjs";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, readFileSync: vi.fn(actual.readFileSync) };
});
vi.mock("../../scripts/sync-version-metadata.mjs", () => ({ syncVersionMetadata: async () => false }));

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("release workflow result", () => {
  it("rejects a failed watched workflow after publishing the release", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(readFileSync)
      .mockReturnValueOnce(JSON.stringify({ version: "0.1.0" }))
      .mockReturnValueOnce(JSON.stringify({ version: "0.1.1" }));
    vi.mocked(execFileSync).mockImplementation((_command, args) => {
      const argv = args as string[];
      if (argv[0] === "rev-parse") return "main";
      if (argv[0] === "remote") return "https://github.com/example/alchemy.git";
      if (argv[1] === "list") return "123";
      if (argv[1] === "view") return "failure";
      if (argv[1] === "watch" && argv.includes("--exit-status")) throw new Error("workflow failed");
      return "";
    });
    const result = expect(runRelease({ label: "Release", gates: [] })).rejects.toThrow(
      "Release v0.1.1 failed (failure)",
    );
    await vi.advanceTimersByTimeAsync(5_000);
    await result;
  });
});
