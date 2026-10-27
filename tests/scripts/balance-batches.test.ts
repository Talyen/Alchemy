import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

it("resumes completed groups and rejects incompatible or concurrent checkpoints", () => {
  const checkpoint = mkdtempSync(join(tmpdir(), "alchemy-balance-batch-"));
  const run = (overrides: Record<string, string> = {}) =>
    spawnSync(process.execPath, ["scripts/run-balance-batches.mjs"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ALCHEMY_BALANCE_CHECKPOINT: checkpoint,
        ALCHEMY_BALANCE_BATCH_GROUPS: "1",
        ALCHEMY_BALANCE_ITERATIONS: "1",
        ...overrides,
      },
      encoding: "utf8",
      timeout: 12000,
    });
  try {
    const first = run();
    expect(first.status, first.stderr).toBe(0);
    const firstPath = join(checkpoint, "core", "0.json");
    const firstBytes = readFileSync(firstPath, "utf8");
    expect(existsSync(join(checkpoint, "core", "1.json"))).toBe(false);
    const second = run();
    expect(second.status, second.stderr).toBe(0);
    expect(readFileSync(firstPath, "utf8")).toBe(firstBytes);
    expect(existsSync(join(checkpoint, "core", "1.json"))).toBe(true);
    const mismatch = run({ ALCHEMY_BALANCE_ITERATIONS: "2" });
    expect(mismatch.status).not.toBe(0);
    expect(mismatch.stderr).toContain("Checkpoint source or options differ");
    writeFileSync(join(checkpoint, ".lock"), JSON.stringify({ pid: process.pid }));
    const locked = run();
    expect(locked.status).not.toBe(0);
    expect(locked.stderr).toContain("Checkpoint is locked");
    expect(readFileSync(firstPath, "utf8")).toBe(firstBytes);
  } finally {
    rmSync(checkpoint, { recursive: true, force: true });
  }
}, 25000);
