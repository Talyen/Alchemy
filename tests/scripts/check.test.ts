import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseCheckArgs, runCheck as runFullCheck } from "../../scripts/check.mjs";
import { resolvePushPaths } from "../../scripts/lib/verification/changed-paths.mjs";

vi.mock("../../scripts/lib/verification/changed-paths.mjs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../scripts/lib/verification/changed-paths.mjs")>()),
  resolvePushPaths: vi.fn(),
}));

const runCheck = (...args: Parameters<typeof runFullCheck>) => runFullCheck([...(args[0] ?? []), "--full"], args[1]);

describe("full source-aware completion gate", () => {
  let runId: string;

  beforeEach(() => {
    runId = `check-test-${randomUUID()}`;
    vi.stubEnv("ALCHEMY_RUN_ID", runId);
    vi.stubEnv("ALCHEMY_CHECK_SKIP_BUILD", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(join(process.cwd(), "reports/runs", runId), { recursive: true, force: true });
  });

  it("selects identical package gates regardless of path spelling", () => {
    for (const file of ["./package.json", resolve("package.json"), "scripts/../package.json"]) {
      expect(parseCheckArgs([file])).toEqual(["package.json"]);
    }
  });

  it("requires source freshness for asset helpers and icons while keeping code-only pushes source-free", async () => {
    const read = vi.spyOn(fs, "readFileSync");
    const cases: Array<[string, string]> = [
      ["scripts/check-prepared-assets.mjs", "assets:check"],
      ["scripts/lib/process-helpers.mjs", "assets:check"],
      ["scripts/generate-icons.mjs", "assets:check"],
      ["public/icon-512.png", "assets:check"],
      ["src/App.tsx", "assets:check:outputs"],
    ];
    for (const [file, expected] of cases) {
      read.mockReturnValueOnce("");
      vi.mocked(resolvePushPaths).mockReturnValueOnce([file]);
      const runner = vi.fn((..._args: unknown[]) => 0);
      expect(await runFullCheck(["--pre-push"], { runner, captureDigest: () => ({ head: "abc", hash: "same" }) })).toBe(
        0,
      );
      expect(runner.mock.calls[0]).toEqual([expect.any(String), "npm", ["run", expected], expect.any(Object)]);
    }
  });

  it("runs documentation checks without unit, build, or browser work", async () => {
    const calls: string[] = [];
    const code = await runCheck(
      ["Docs/REFERENCE.md", "scripts/README.md", "src/features/alchemy/shared/storage/MIGRATIONS.md"],
      {
        runner: vi.fn((label: string) => {
          calls.push(label);
          return 0;
        }),
        captureDigest: () => ({ head: "abc", hash: "same" }),
      },
    );
    expect(code).toBe(0);
    expect(calls).toEqual(["changed-path verification", "documentation format"]);
  });

  it("runs static checks plus build and smoke for runtime changes", async () => {
    const calls: string[] = [];
    const code = await runCheck(["src/App.tsx"], {
      runner: vi.fn((label: string) => {
        calls.push(label);
        return 0;
      }),
      captureDigest: () => ({ head: "abc", hash: "same" }),
    });
    expect(code).toBe(0);
    expect(calls).toEqual([
      "changed-path verification",
      "CI static checks",
      "web build",
      "web bundle budget",
      "preview smoke",
    ]);
  });

  it("checks the lockfile only for package changes", async () => {
    const calls: string[] = [];
    await runCheck(["package.json"], {
      runner: vi.fn((label: string) => {
        calls.push(label);
        return 0;
      }),
      captureDigest: () => ({ head: "abc", hash: "same" }),
    });
    expect(calls).toContain("lockfile consistency");
  });

  it.each([
    "package.json",
    "package-lock.json",
    "vite.config.ts",
    "scripts/build-verified.mjs",
    "scripts/lib/vite-chunks.mjs",
    "game-edition.mjs",
    "scripts/lib/release/game-edition.mjs",
  ])("builds both targets for shared build input %s", async (filePath) => {
    const calls: string[] = [];
    const code = await runCheck([filePath], {
      runner: vi.fn((label: string) => {
        calls.push(label);
        return 0;
      }),
      captureDigest: () => ({ head: "abc", hash: "same" }),
    });
    expect(code).toBe(0);
    expect(calls).toContain("web build");
    expect(calls).toContain("preview smoke");
    expect(calls).toContain("desktop build");
    expect(calls[calls.indexOf("web build") + 1]).toBe("web bundle budget");
    expect(calls[calls.indexOf("desktop build") + 1]).toBe("desktop bundle budget");
  });

  it.each(["web bundle budget", "desktop bundle budget"])("stops on a failed %s", async (budget) => {
    const calls: string[] = [];
    const code = await runCheck(["vite.config.ts"], {
      runner: vi.fn((label: string, command: string, args: string[]) => {
        calls.push(label);
        if (label === budget) {
          expect(command).toBe("npm");
          expect(args).toEqual(["run", "check:bundle"]);
          return 1;
        }
        return 0;
      }),
      captureDigest: () => ({ head: "abc", hash: "same" }),
    });
    expect(code).toBe(1);
    expect(calls.at(-1)).toBe(budget);
    if (budget === "web bundle budget") {
      expect(calls).not.toContain("preview smoke");
      expect(calls).not.toContain("desktop build");
    }
  });

  it("skips budgets together with builds", async () => {
    vi.stubEnv("ALCHEMY_CHECK_SKIP_BUILD", "1");
    const calls: string[] = [];
    const code = await runCheck(["vite.config.ts"], {
      runner: vi.fn((label: string) => {
        calls.push(label);
        return 0;
      }),
      captureDigest: () => ({ head: "abc", hash: "same" }),
    });
    expect(code).toBe(0);
    expect(calls).toEqual(["changed-path verification", "CI static checks"]);
  });

  it("lets static checks own docs:check on executable changes only", async () => {
    const executable: unknown[][] = [];
    await runCheck(["src/App.tsx", "Docs/guide.md"], {
      runner: vi.fn((...args: unknown[]) => {
        executable.push(args);
        return 0;
      }),
      captureDigest: () => ({ head: "abc", hash: "same" }),
    });
    const verify = executable.find((args) => args[0] === "changed-path verification");
    expect(verify?.[2]).toContain("--skip-docs-check");

    const docsOnly: unknown[][] = [];
    await runCheck(["Docs/guide.md"], {
      runner: vi.fn((...args: unknown[]) => {
        docsOnly.push(args);
        return 0;
      }),
      captureDigest: () => ({ head: "abc", hash: "same" }),
    });
    expect(docsOnly.find((args) => args[0] === "changed-path verification")?.[2]).not.toContain("--skip-docs-check");
  });

  it("fails when source inputs drift", async () => {
    let reads = 0;
    const code = await runCheck(["Docs/REFERENCE.md"], {
      runner: vi.fn(() => 0),
      captureDigest: () => ({ head: "abc", hash: reads++ === 0 ? "before" : "after" }),
    });
    expect(code).toBe(1);
  });

  it("records bounded evidence for a failed command stage", async () => {
    const code = await runCheck(["src/App.tsx"], {
      runner: vi.fn((label: string) =>
        label === "CI static checks"
          ? { status: 1, elapsedMs: 25, output: "static failure detail" }
          : { status: 0, elapsedMs: 10, output: "ok" },
      ),
      captureDigest: () => ({ head: "abc", hash: "same" }),
    });
    expect(code).toBe(1);
    const record = JSON.parse(readFileSync(join(process.cwd(), "reports/current-run.json"), "utf8")) as {
      artifacts: Array<{ path: string; role: string; existsAtWrite: boolean }>;
      commandExposures: Array<{ key: string; rawBytes: number; exposedBytes: number }>;
      summary: string;
    };
    expect(record.artifacts).toEqual([
      expect.objectContaining({ role: "primary", existsAtWrite: true }),
      expect.objectContaining({ role: "secondary", existsAtWrite: true }),
    ]);
    expect(record.commandExposures).toContainEqual(expect.objectContaining({ key: "ci-static", rawBytes: 21 }));
    const failureExposure = record.commandExposures.find((entry) => entry.key === "ci-static");
    expect(failureExposure?.exposedBytes).toBeGreaterThanOrEqual(21);
    expect(failureExposure?.exposedBytes).toBeLessThanOrEqual(4096);
    const digest = record.artifacts.find((artifact) => artifact.role === "primary");
    const detail = readFileSync(join(process.cwd(), digest?.path ?? ""), "utf8");
    expect(detail).toContain("static failure detail");
    expect(detail).toContain("# Verification failure: CI static checks");
    expect(record.summary).toBe("Check failed at CI static checks.");
    expect(record.commandExposures.map((entry) => entry.key)).toEqual(["verification", "ci-static"]);
  });

  it("rejects ambiguous path selections", () => {
    expect(() => parseCheckArgs(["--diff", "src/App.tsx"])).toThrow("Choose explicit paths or --diff");
  });
});
