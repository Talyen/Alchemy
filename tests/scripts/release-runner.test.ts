import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runRelease } from "../../scripts/lib/release-runner.mjs";
import { verifyReleaseVersionTag } from "../../scripts/lib/release-checks.mjs";

const ROOT = join(import.meta.dirname, "../..");

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return { ...actual, execFileSync: vi.fn() };
});
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
  it("stops after a rejected atomic push without retrying refs or monitoring", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(readFileSync)
      .mockReturnValueOnce(JSON.stringify({ version: "0.1.0" }))
      .mockReturnValueOnce(JSON.stringify({ version: "0.1.1" }));
    vi.mocked(execFileSync).mockImplementation((_command, args) => {
      const argv = args as string[];
      if (argv[0] === "rev-parse") return "main";
      if (argv[0] === "push") throw new Error("atomic push rejected");
      return "";
    });
    await expect(runRelease({ label: "Release", gates: [] })).rejects.toThrow("atomic push rejected");
    const pushes = vi.mocked(execFileSync).mock.calls.filter(([, args]) => args?.[0] === "push");
    expect(pushes).toHaveLength(1);
    expect(pushes[0][1]).toEqual(["push", "--atomic", "--no-verify", "origin", "main", "v0.1.1"]);
    expect(vi.mocked(execFileSync).mock.calls.some(([command]) => command === "gh")).toBe(false);
  });

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

describe("verifyReleaseVersionTag", () => {
  it("returns the tag when it matches the version", () => {
    expect(verifyReleaseVersionTag("v0.1.0", "0.1.0")).toBe("v0.1.0");
  });

  it("throws when the tag is missing", () => {
    expect(() => verifyReleaseVersionTag("", "0.1.0")).toThrow(/RELEASE_TAG or GITHUB_REF_NAME is required/);
  });

  it("throws when the tag mismatches the version", () => {
    expect(() => verifyReleaseVersionTag("v0.2.0", "0.1.0")).toThrow(/does not match package\.json version/);
  });
});

describe("verify-release --skip-package CLI", () => {
  it("passes when tag matches package.json", () => {
    const result = spawnSync("node", ["scripts/verify-release.mjs", "--skip-package"], {
      cwd: ROOT,
      env: { ...process.env, RELEASE_TAG: "v0.1.0" },
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
  });

  it("fails when tag mismatches package.json", () => {
    const result = spawnSync("node", ["scripts/verify-release.mjs", "--skip-package"], {
      cwd: ROOT,
      env: { ...process.env, RELEASE_TAG: "v9.9.9" },
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
  });
});
