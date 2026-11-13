import { temporaryDirectories } from "../helpers/script-fixtures";
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { runCommand } from "../../scripts/lib/run-command.mjs";
import { completionCounts, runCompact } from "../../scripts/run-compact.mjs";
import { acquireTestResources, testResourceStatus } from "../../scripts/lib/verification/local-test-lane.mjs";
import { unitSelection } from "../../scripts/lib/verification/unit-selection.mjs";

vi.mock("../../scripts/lib/verification/local-test-lane.mjs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../scripts/lib/verification/local-test-lane.mjs")>();
  return { ...actual, acquireTestResources: vi.fn(actual.acquireTestResources) };
});

beforeEach(() => vi.stubEnv("ALCHEMY_OUTPUT_CAPTURED", undefined));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const createTemporaryDirectory = temporaryDirectories();

it("preserves literal arguments, complete logs and exit codes while bounding failures", async () => {
  const root = createTemporaryDirectory("compact-command-");

  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const arg = "spaces and $(touch surprise)";
  const status = await runCompact(
    [
      process.execPath,
      "-e",
      'console.log(process.argv[1]); console.log("noise\\n".repeat(5000)); console.error("AssertionError: distinct failure"); console.log("Tests  1 failed | 2 passed (3)"); process.exit(7)',
      arg,
    ],
    root,
  );
  expect(status).toBe(7);
  const exposed = [...log.mock.calls, ...error.mock.calls].flat().join("\n");
  expect(exposed).toContain("1 failed | 2 passed");
  expect(exposed).toContain("AssertionError: distinct failure");
  expect(Buffer.byteLength(exposed)).toBeLessThan(4096);
  const logs = fs.readdirSync(path.join(root, "reports/compact"));
  const raw = fs.readFileSync(path.join(root, "reports/compact", logs[0] ?? "", "output.log"), "utf8");
  expect(raw).toContain(arg);
  expect(raw.length).toBeGreaterThan(20_000);
  expect(fs.existsSync(path.join(root, "surprise"))).toBe(false);
});

it("prints known counts and handles successful, missing and invalid commands", async () => {
  const root = createTemporaryDirectory("compact-command-");

  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect(completionCounts("  3 passed (2s)\n  1 skipped\nordinary noise")).toBe("3 passed (2s)\n1 skipped");
  expect(completionCounts("no totals")).toBe("");
  expect(await runCompact([process.execPath, "-e", 'console.log("Tests  2 passed (2)")'], root)).toBe(0);
  expect(await runCompact([path.join(root, "missing-command")], root)).toBe(1);
  await expect(runCompact([], root)).rejects.toThrow("Usage");
});

it("lets an outer capture retain raw diagnostics without nesting compact logs", () => {
  const root = createTemporaryDirectory("compact-nested-");

  vi.stubEnv("ALCHEMY_COMPACT_PARENT_ONLY", "parent");
  const env = { ...process.env };
  delete env.ALCHEMY_COMPACT_PARENT_ONLY;
  const runner = path.resolve("scripts/run-compact.mjs");
  const output = runCommand(
    process.execPath,
    [
      runner,
      process.execPath,
      "-e",
      'console.error("raw diagnostic"); console.log(process.env.ALCHEMY_COMPACT_PARENT_ONLY ?? "isolated"); process.exit(7)',
    ],
    {
      cwd: root,
      logPath: path.join(root, "outer.log"),
      env,
    },
  );
  expect(output.status).toBe(7);
  expect(output.output).toContain("raw diagnostic");
  expect(output.output).toContain("isolated");
  expect(output.output).not.toContain("Full log:");
  expect(fs.existsSync(path.join(root, "reports"))).toBe(false);
});

it("streams explicit live output without changing the child arguments or exit status", async () => {
  const root = createTemporaryDirectory("compact-live-");

  expect(
    await runCompact(
      ["--live", process.execPath, "-e", 'process.exit(process.argv[1] === "--literal" ? 7 : 9)', "--", "--literal"],
      root,
    ),
  ).toBe(7);
  expect(fs.existsSync(path.join(root, "reports/compact"))).toBe(false);
});

it("rejects a missing path in a mixed unit selection before starting a process or reserving a lane", async () => {
  const root = createTemporaryDirectory("compact-unit-selection-");

  fs.mkdirSync(path.join(root, "tests"));
  fs.writeFileSync(path.join(root, "tests/real.test.ts"), "");
  for (const command of [["vitest"], ["npx", "vitest"], ["/bin/npx", "vitest"]]) {
    await expect(runCompact([...command, "run", "tests/real.test.ts", "tests/typo.test.ts"], root)).rejects.toThrow(
      "Unit test path does not exist: tests/typo.test.ts",
    );
  }
  expect(fs.existsSync(path.join(root, "reports"))).toBe(false);
  expect(
    unitSelection(["run", "tests/real.test.ts", "--exclude", "tests/missing.test.ts", "-t", "name / filter"], root)
      .selectors,
  ).toEqual(["tests/real.test.ts"]);
  expect(unitSelection(["run", "real.test.ts"], root)).toEqual({ selectors: ["real.test.ts"], focused: false });
});

it("runs local broad and browser commands through managed scheduling without an opt-in", async () => {
  vi.stubEnv("GITHUB_ACTIONS", undefined);
  vi.stubEnv("ALCHEMY_ALLOW_HEAVY_LOCAL", undefined);
  const root = createTemporaryDirectory("compact-local-policy-");
  const directory = path.join(root, "lanes");
  const actual = await vi.importActual<typeof import("../../scripts/lib/verification/local-test-lane.mjs")>(
    "../../scripts/lib/verification/local-test-lane.mjs",
  );
  const kinds: string[] = [];
  for (let index = 0; index < 2; index++) {
    vi.mocked(acquireTestResources).mockImplementationOnce(async (command, args, cwd) => {
      const lane = await actual.acquireTestResources(command, args, cwd, { directory, broadPort: 0, focusedPort: 0 });
      kinds.push(lane.kind);
      return lane;
    });
  }
  for (const name of ["vitest", "playwright"]) {
    const binary = path.join(root, name);
    fs.writeFileSync(binary, "#!/usr/bin/env node\nprocess.exit(0);\n", { mode: 0o755 });
    const args = name === "vitest" ? ["run"] : ["test"];
    expect(await runCompact([binary, ...args], root)).toBe(0);
  }
  expect(kinds).toEqual(["broad", "broad"]);
  expect(testResourceStatus(directory)).toEqual([]);
});
