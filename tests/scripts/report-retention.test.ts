import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { reportRetentionPlan, writeRetentionReview } from "../../scripts/lib/report-retention.mjs";
import { pruneTransientArtifacts } from "../../scripts/prune-transient-artifacts.mjs";

const day = 86_400_000,
  now = Date.now(),
  roots: string[] = [];
const fixture = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "alchemy-retention-"));
  roots.push(root);
  return root;
};
function run(root: string, id: string, status: string, age: number, extras = {}) {
  const directory = path.join(root, "reports/runs", id);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, "run.json"),
    JSON.stringify({ runId: id, command: "check", status, generatedAt: new Date(now - age).toISOString(), ...extras }),
  );
  fs.writeFileSync(path.join(directory, "output.log"), id);
  for (const name of fs.readdirSync(directory))
    fs.utimesSync(path.join(directory, name), new Date(now - age), new Date(now - age));
  return directory;
}
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

it("reviews old diagnostics without deleting and protects latest results, owners, pins and referenced baselines", () => {
  const root = fixture();
  const old = run(root, "old-pass", "passed", 2 * day);
  run(root, "old-fail", "failed", 4 * day);
  run(root, "latest-pass", "passed", 0, { artifacts: [{ path: "reports/runs/old-fail/output.log" }] });
  run(root, "latest-fail", "failed", day);
  const pinned = run(root, "pinned", "passed", 5 * day);
  fs.writeFileSync(path.join(pinned, ".retention-keep"), "investigation");
  const owned = run(root, "owned", "passed", 6 * day);
  fs.writeFileSync(path.join(owned, ".retention-owner.json"), "unknown owner");
  const preview = reportRetentionPlan(root, { now, budget: 1 });
  expect(preview.candidates.map((item) => item.path)).toEqual(["reports/runs/old-pass"]);
  expect(preview.permanentDeletionApproved).toBe(false);
  expect(preview.overBudget).toBe(true);
  expect(fs.existsSync(path.join(root, "reports/retention-review.json"))).toBe(false);
  expect(writeRetentionReview(root, { now, budget: 1 })).toEqual(preview);
  expect(fs.readFileSync(path.join(old, "output.log"), "utf8")).toBe("old-pass");
});

it("respects exact age/size boundaries and preserves unknown destinations and symlink roots", () => {
  const root = fixture();
  run(root, "boundary", "passed", day);
  run(root, "new", "passed", 0);
  expect(reportRetentionPlan(root, { now }).candidates).toHaveLength(1);
  expect(reportRetentionPlan(root, { now: now - 1 }).candidates).toHaveLength(0);
  expect(reportRetentionPlan(root, { now, maxEntries: 1 }).incomplete).toContain("limit");
  fs.writeFileSync(path.join(root, "reports/retention-review.json"), "user evidence");
  expect(() => writeRetentionReview(root, { now })).toThrow();
  expect(fs.readFileSync(path.join(root, "reports/retention-review.json"), "utf8")).toBe("user evidence");
  const other = fixture();
  fs.symlinkSync(path.join(root, "reports"), path.join(other, "reports"), "dir");
  expect(reportRetentionPlan(other, { now }).candidates).toEqual([]);
  expect(() => reportRetentionPlan(root, { budget: 0 })).toThrow();
});

it("expires only marked historical runs after the retention period, preserving references and legacy evidence", async () => {
  const root = fixture();
  const expired = run(root, "expired", "passed", 31 * day, { retention: "expiring-v1" });
  const legacy = run(root, "legacy", "passed", 100 * day);
  const referenced = run(root, "referenced", "passed", 40 * day, { retention: "expiring-v1" });
  const failure = run(root, "failure", "failed", 89 * day, { retention: "expiring-v1" });
  const pinned = run(root, "pinned", "passed", 60 * day, { retention: "expiring-v1" });
  fs.writeFileSync(path.join(pinned, ".retention-keep"), "keep");
  run(root, "latest", "passed", 0, {
    retention: "expiring-v1",
    artifacts: [{ path: "reports/runs/referenced/output.log" }],
  });
  run(root, "latest-failure", "failed", 0, { retention: "expiring-v1" });
  const preview = await pruneTransientArtifacts({ rootDir: root, now, dryRun: true });
  expect(preview.removed.map((item) => item.path)).toEqual(["reports/runs/expired"]);
  expect(fs.existsSync(expired)).toBe(true);
  await pruneTransientArtifacts({ rootDir: root, now });
  expect(fs.existsSync(expired)).toBe(false);
  for (const directory of [legacy, referenced, failure, pinned]) expect(fs.existsSync(directory)).toBe(true);
});

it("fails closed when the current run pointer is unreadable", async () => {
  const root = fixture();
  const expired = run(root, "expired", "passed", 40 * day, { retention: "expiring-v1" });
  run(root, "latest", "passed", 0, { retention: "expiring-v1" });
  fs.writeFileSync(path.join(root, "reports/current-run.json"), "invalid");
  expect((await pruneTransientArtifacts({ rootDir: root, now })).removed).toEqual([]);
  expect(fs.existsSync(expired)).toBe(true);
});

it("expires only old recognized verification receipts and leaves unknown files intact", async () => {
  const root = fixture();
  const cache = path.join(root, "reports/verification-cache");
  fs.mkdirSync(cache, { recursive: true });
  const old = path.join(cache, `${"a".repeat(64)}.json`);
  const unknown = path.join(cache, `${"b".repeat(64)}.json`);
  const fresh = path.join(cache, `${"c".repeat(64)}.json`);
  fs.writeFileSync(old, JSON.stringify({ version: 1, status: "passed", completedAt: now - 2 * day }));
  fs.writeFileSync(unknown, "not a receipt");
  fs.writeFileSync(fresh, JSON.stringify({ version: 1, status: "passed", completedAt: now }));
  for (const file of [old, unknown, fresh]) fs.utimesSync(file, new Date(now - 2 * day), new Date(now - 2 * day));
  expect((await pruneTransientArtifacts({ rootDir: root, now })).removed.map((entry) => entry.path)).toEqual([
    `reports/verification-cache/${"a".repeat(64)}.json`,
  ]);
  expect(fs.existsSync(unknown)).toBe(true);
  expect(fs.existsSync(fresh)).toBe(true);
});

it("automatically records known legacy tool environments for review without deleting them", async () => {
  const root = fixture();
  for (const relative of [".cache/lyrics/venv", ".cache/font-tools", "reports/boss-lyrics/venv"]) {
    const directory = path.join(root, relative);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, "keep"), "legacy");
  }
  await pruneTransientArtifacts({ rootDir: root, now });
  const review = JSON.parse(fs.readFileSync(path.join(root, "reports/retention-review.json"), "utf8"));
  expect(review.legacyToolEnvironments.map((entry: { path: string }) => entry.path)).toEqual([
    ".cache/lyrics/venv",
    ".cache/font-tools",
    "reports/boss-lyrics/venv",
  ]);
  for (const entry of review.legacyToolEnvironments)
    expect(fs.readFileSync(path.join(root, entry.path, "keep"), "utf8")).toBe("legacy");
});
