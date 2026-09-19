import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { completionCounts, runCompact } from "../../scripts/run-compact.mjs";

const roots: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

it("preserves literal arguments, complete logs and exit codes while bounding failures", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "compact-command-"));
  roots.push(root);
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "compact-command-"));
  roots.push(root);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect(completionCounts("  3 passed (2s)\n  1 skipped\nordinary noise")).toBe("3 passed (2s)\n1 skipped");
  expect(completionCounts("no totals")).toBe("");
  expect(await runCompact([process.execPath, "-e", 'console.log("Tests  2 passed (2)")'], root)).toBe(0);
  expect(await runCompact([path.join(root, "missing-command")], root)).toBe(1);
  await expect(runCompact([], root)).rejects.toThrow("Usage");
});
