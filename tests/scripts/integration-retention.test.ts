import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { pruneIntegratedRuns } from "../../scripts/lib/integration-retention.mjs";
import { pruneTransientArtifacts } from "../../scripts/prune-transient-artifacts.mjs";

const DAY = 86400_000;
const NOW = Date.now();

function bundle(root: string, name: string, marked = true) {
  const directory = path.join(root, "reports/integrations", name);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, "integration.json"),
    JSON.stringify({
      branch: `agent/${name}`,
      commit: "a".repeat(40),
      originalCheckout: `/checkout/${name}`,
      evidence: ["reports"],
      ...(marked ? { retentionPolicy: "managed-runs-v1" } : {}),
    }),
  );
  return directory;
}

function run(root: string, name: string, age: number, options: Record<string, unknown> = {}) {
  const directory = path.join(root, "reports/runs", name);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, "run.json"),
    JSON.stringify({
      runId: name,
      command: "check",
      status: "passed",
      generatedAt: new Date(NOW - age).toISOString(),
      retention: "expiring-v1",
      ...options,
    }),
  );
  fs.writeFileSync(path.join(directory, "evidence.txt"), name);
  for (const file of fs.readdirSync(directory))
    fs.utimesSync(path.join(directory, file), new Date(NOW - age), new Date(NOW - age));
  return directory;
}

it("expires only sealed non-trailer runs and protects current, referenced, pinned and legacy evidence", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "alchemy-integrated-retention-"));
  try {
    const live = bundle(root, "normal");
    const expired = run(live, "expired", 31 * DAY);
    const referenced = run(live, "referenced", 32 * DAY);
    const pinned = run(live, "pinned", 33 * DAY);
    const current = run(live, "current", 34 * DAY);
    fs.writeFileSync(path.join(live, "reports/current-run.json"), JSON.stringify({ runId: "current" }));
    fs.writeFileSync(path.join(pinned, ".retention-keep"), "keep");
    run(live, "latest", 0, { artifacts: [{ path: "reports/runs/referenced/evidence.txt" }] });
    const legacy = bundle(root, "legacy", false);
    const legacyOld = run(legacy, "old", 50 * DAY);
    run(legacy, "new", 0);
    const trailer = bundle(root, "trailer-job");
    const trailerOld = run(trailer, "old", 50 * DAY);
    run(trailer, "new", 0);
    const preview = pruneIntegratedRuns(root, { now: NOW, dryRun: true });
    expect(preview.map((entry) => entry.path)).toEqual(["reports/integrations/normal/reports/runs/expired"]);
    expect(fs.existsSync(expired)).toBe(true);
    expect((await pruneTransientArtifacts({ rootDir: root, now: NOW })).removed).toEqual(preview);
    expect(fs.existsSync(expired)).toBe(false);
    for (const directory of [referenced, pinned, current, legacyOld, trailerOld])
      expect(fs.existsSync(directory)).toBe(true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
