import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { reportRetentionPlan, writeRetentionReview } from "../../scripts/lib/report-retention.mjs";

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
