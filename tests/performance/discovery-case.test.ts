import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { expect, it } from "vitest";
import { isUsableDiscoveryResult, selectCase } from "../../performance/case-selection.mjs";

it("admits bounded exploratory combat while rejecting failed or otherwise incomplete careers", () => {
  const stalled = { status: "incomplete", error: "Incomplete: battle turn budget exhausted" };
  const discovery = selectCase("seeded-discovery");
  expect(isUsableDiscoveryResult(discovery, stalled)).toBe(true);
  expect(isUsableDiscoveryResult(selectCase("campaign-early"), stalled)).toBe(false);
  expect(isUsableDiscoveryResult(discovery, { status: "incomplete", error: "Invariant violation" })).toBe(false);
  expect(isUsableDiscoveryResult(discovery, { status: "failed" })).toBe(false);
  expect(isUsableDiscoveryResult(discovery, { status: "completed" })).toBe(true);
});

it("prepares a recorded, reachable battle checkpoint from seeded discovery", async () => {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), "alchemy-discovery-case-"));
  try {
    await promisify(execFile)(
      process.execPath,
      ["scripts/prepare-performance-cases.mjs", output, "seeded-discovery", "1182083086"],
      { timeout: 30_000 },
    );
    const generated = JSON.parse(await fs.readFile(path.join(output, "seeded-discovery.case.json"), "utf8"));
    expect(isUsableDiscoveryResult(selectCase("seeded-discovery"), generated.coverage.discovery)).toBe(true);
    expect(generated.initialSave.activeRun.activity.kind).toBe("battle");
    const discovery = JSON.parse(
      await fs.readFile(path.join(output, "case-generation/seeded-discovery/discovery.json"), "utf8"),
    );
    expect(discovery.telemetry.battleSnapshots).toContainEqual(
      expect.objectContaining({
        stage: "start",
        step: generated.checkpointStep,
        enemy: generated.initialSave.activeRun.activity.data.battleState.currentEnemy.id,
      }),
    );
  } finally {
    await fs.rm(output, { recursive: true, force: true });
  }
}, 40_000);
