import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { archiveTerminalPlans } from "../../scripts/archive-plans.mjs";
import { parsePlanMetadata } from "../../scripts/check-plans.mjs";
import { planTemplate, safePlanName } from "../../scripts/new-plan.mjs";
import { parsePruneArgs, pruneTransientArtifacts } from "../../scripts/prune-transient-artifacts.mjs";

describe("execution-plan contract", () => {
  it("accepts scaffold metadata", () => {
    const template = planTemplate("ExamplePlan", "2026-08-20");
    const metadata = parsePlanMetadata(template);
    expect(metadata.errors).toEqual([]);
    expect(metadata.metadata.status).toBe("active");
    expect(metadata.updated?.toISOString().slice(0, 10)).toBe("2026-08-20");
  });

  it("requires a reason for blocked plans and rejects invalid names", () => {
    const blocked = parsePlanMetadata(
      planTemplate("ExamplePlan", "2026-08-20").replace("status: active", "status: blocked"),
    );
    expect(blocked.errors).toContain("blocked plans require reason");
    expect(() => safePlanName("bad plan")).toThrow(/only letters/);
  });

  it("rejects calendar-invalid dates instead of letting JavaScript normalize them", () => {
    const invalid = parsePlanMetadata(planTemplate("ExamplePlan", "2026-02-31"));
    expect(invalid.errors).toContain("updated must be an ISO date");
  });

  it("rejects terminal statuses in the active plans directory", () => {
    const complete = parsePlanMetadata(
      planTemplate("ExamplePlan", "2026-08-20").replace("status: active", "status: complete"),
    );
    expect(complete.errors).toEqual([]);
    expect(complete.metadata.status).toBe("complete");
  });

  it("archives terminal plans and leaves active plans in place", () => {
    const plansDir = fs.mkdtempSync(path.join(os.tmpdir(), "alchemy-plans-"));
    fs.writeFileSync(
      path.join(plansDir, "Complete.md"),
      planTemplate("Complete", "2026-08-20").replace("status: active", "status: complete"),
    );
    fs.writeFileSync(path.join(plansDir, "Active.md"), planTemplate("Active", "2026-08-20"));

    try {
      expect(archiveTerminalPlans({ plansDir })).toEqual(["docs/Plans/Archived/Complete.md"]);
      expect(fs.existsSync(path.join(plansDir, "Archived", "Complete.md"))).toBe(true);
      expect(fs.existsSync(path.join(plansDir, "Active.md"))).toBe(true);
    } finally {
      fs.rmSync(plansDir, { recursive: true, force: true });
    }
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
