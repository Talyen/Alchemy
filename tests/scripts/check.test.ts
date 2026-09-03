import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { captureSourceDigest, parseCheckArgs, runCheck } from "../../scripts/check.mjs";

describe("source-aware completion gate", () => {
  it("runs documentation checks without unit, build, or browser work", async () => {
    const calls: string[] = [];
    const code = await runCheck(["docs/REFERENCE.md"], {
      runner: vi.fn((label: string) => {
        calls.push(label);
        return 0;
      }),
      captureDigest: () => ({ head: "abc", hash: "same" }),
    });
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
    expect(calls).toEqual(["changed-path verification", "CI static checks", "web build", "preview smoke"]);
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

  it("fails when source inputs drift", async () => {
    let reads = 0;
    const code = await runCheck(["docs/REFERENCE.md"], {
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
      artifacts: Array<{ role: string; existsAtWrite: boolean }>;
      commandExposures: Array<{ key: string; rawBytes: number; exposedBytes: number }>;
      summary: string;
    };
    expect(record.artifacts).toEqual([
      expect.objectContaining({ role: "primary", existsAtWrite: true }),
      expect.objectContaining({ role: "secondary", existsAtWrite: true }),
    ]);
    expect(record.commandExposures).toContainEqual(
      expect.objectContaining({ key: "ci-static", rawBytes: 21, exposedBytes: 21 }),
    );
    expect(record.summary).toBe("Check failed at CI static checks.");
  });

  it("parses selections and captures a source digest", () => {
    expect(parseCheckArgs(["src/App.tsx"])).toEqual(["src/App.tsx"]);
    expect(() => parseCheckArgs(["--diff", "src/App.tsx"])).toThrow("Choose explicit paths or --diff");
    expect(captureSourceDigest().hash).toMatch(/^[0-9a-f]{16}$/u);
  });
});
