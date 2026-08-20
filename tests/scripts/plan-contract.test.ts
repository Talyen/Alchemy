import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parsePlanMetadata } from "../../scripts/check-docs.mjs";
import { planTemplate, safePlanName } from "../../scripts/new-plan.mjs";
import { parsePruneArgs, pruneTransientArtifacts } from "../../scripts/prune-transient-artifacts.mjs";

describe("execution-plan contract", () => {
  it("accepts the scaffold metadata and rejects completed plans", () => {
    const metadata = parsePlanMetadata(planTemplate("ExamplePlan", "2026-08-20", "2026-09-03"));
    expect(metadata.errors).toEqual([]);
    expect(metadata.metadata.status).toBe("active");

    const complete = parsePlanMetadata(
      planTemplate("ExamplePlan", "2026-08-20", "2026-09-03").replace("status: active", "status: complete"),
    );
    expect(complete.errors).toEqual([]);
    expect(complete.metadata.status).toBe("complete");
  });

  it("requires a reason for blocked plans and rejects invalid names", () => {
    const blocked = parsePlanMetadata(
      planTemplate("ExamplePlan", "2026-08-20", "2026-09-03").replace("status: active", "status: blocked"),
    );
    expect(blocked.errors).toContain("blocked plans require reason");
    expect(() => safePlanName("bad plan")).toThrow(/only letters/);
  });

  it("rejects calendar-invalid dates instead of letting JavaScript normalize them", () => {
    const invalid = parsePlanMetadata(planTemplate("ExamplePlan", "2026-02-31", "2026-09-03"));
    expect(invalid.errors).toContain("created must be an ISO date");
  });
});

describe("transient artifact cleanup", () => {
  it("parses a one-day dry-run policy", () => {
    expect(parsePruneArgs(["--dry-run", "--days=2"])).toEqual({ days: 2, dryRun: true });
    expect(() => parsePruneArgs(["--days=-1"])).toThrow(/non-negative/);
  });

  it("removes only stale files and preserves fresh evidence", () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "alchemy-prune-"));
    const reportsDir = path.join(rootDir, "reports");
    const oldPath = path.join(reportsDir, "old.log");
    const freshPath = path.join(reportsDir, "fresh.log");
    const now = Date.parse("2026-08-20T00:00:00Z");
    fs.mkdirSync(reportsDir, { recursive: true });
    fs.writeFileSync(oldPath, "old");
    fs.writeFileSync(freshPath, "fresh");
    fs.utimesSync(oldPath, new Date(now - 2 * 86_400_000), new Date(now - 2 * 86_400_000));
    fs.utimesSync(freshPath, new Date(now), new Date(now));

    try {
      const result = pruneTransientArtifacts({ rootDir, transientDirs: ["reports"], now, days: 1 });
      expect(result.removed.map((entry) => entry.path)).toEqual(["reports/old.log"]);
      expect(fs.existsSync(oldPath)).toBe(false);
      expect(fs.existsSync(freshPath)).toBe(true);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
