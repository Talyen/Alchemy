import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { expect, it } from "vitest";

it("prepares a reachable checkpoint when exploratory combat reaches a legal stalemate", async () => {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), "alchemy-discovery-case-"));
  try {
    // Nightly run 104: Consume leaves this Druid with Pack Tactics against the
    // Blight Treant. The career stays incomplete; its reachable battle is usable.
    await promisify(execFile)(
      process.execPath,
      ["scripts/prepare-performance-cases.mjs", output, "seeded-discovery", "1182083086"],
      { timeout: 30_000 },
    );
    const generated = JSON.parse(await fs.readFile(path.join(output, "seeded-discovery.case.json"), "utf8"));
    expect(generated.coverage.discovery).toEqual({
      status: "incomplete",
      error: "Incomplete: battle turn budget exhausted",
    });
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
