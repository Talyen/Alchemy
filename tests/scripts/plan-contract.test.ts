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

  it("preserves prose and reference link destinations when archiving plans together", () => {
    const plansDir = fs.mkdtempSync(path.join(os.tmpdir(), "alchemy-plan-links-"));
    const content =
      planTemplate("First", "2026-09-11").replace("status: active", "status: complete") +
      '\n[Second](Second.md#notes)\n![Picture](../../image.png "caption")\n[Guide][ref]\n[ref]: ../../CONTRIBUTING.md#checks\n' +
      "[Web](https://example.com) [Anchor](#notes) `[Example](./code.md)`\n```md\n[Example](./code.md)\n```\n";
    try {
      fs.writeFileSync(path.join(plansDir, "First.md"), content);
      fs.writeFileSync(path.join(plansDir, "Second.md"), content);
      archiveTerminalPlans({ plansDir, dryRun: true });
      expect(fs.readFileSync(path.join(plansDir, "First.md"), "utf8")).toBe(content);
      archiveTerminalPlans({ plansDir });
      const archived = fs.readFileSync(path.join(plansDir, "Archived/First.md"), "utf8");
      expect(archived).toContain("../../../CONTRIBUTING.md#what-to-run-when-you-change");
      expect(archived).toContain("../README.md#task-handoff");
      expect(archived).toContain("[Second](Second.md#notes)");
      expect(archived).toContain('![Picture](../../../image.png "caption")');
      expect(archived).toContain("[ref]: ../../../CONTRIBUTING.md#checks");
      expect(archived).toContain("[Web](https://example.com) [Anchor](#notes) `[Example](./code.md)`");
      expect(archived).toContain("```md\n[Example](./code.md)\n```");
    } finally {
      fs.rmSync(plansDir, { recursive: true, force: true });
    }
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
  it("preflights and archives only selected plans without inspecting another task's metadata", () => {
    const plansDir = fs.mkdtempSync(path.join(os.tmpdir(), "alchemy-plans-"));
    const complete = planTemplate("Complete", "2026-08-20").replace("status: active", "status: complete");
    fs.writeFileSync(path.join(plansDir, "Mine.md"), complete);
    fs.writeFileSync(path.join(plansDir, "Theirs.md"), "unfinished metadata");
    try {
      expect(() => archiveTerminalPlans({ plansDir, names: ["Mine.md", "Missing.md"] })).toThrow("Plan not found");
      expect(() => archiveTerminalPlans({ plansDir, names: ["../Mine.md"] })).toThrow("Expected a plan filename");
      expect(archiveTerminalPlans({ plansDir, names: ["Mine.md"], dryRun: true })).toEqual([
        "docs/Plans/Archived/Mine.md",
      ]);
      expect(fs.existsSync(path.join(plansDir, "Mine.md"))).toBe(true);
      fs.mkdirSync(path.join(plansDir, "Archived"));
      fs.writeFileSync(path.join(plansDir, "Archived", "Mine.md"), "retained history");
      expect(() => archiveTerminalPlans({ plansDir, names: ["Mine.md"] })).toThrow("Archive already contains");
      expect(fs.readFileSync(path.join(plansDir, "Archived", "Mine.md"), "utf8")).toBe("retained history");
      fs.unlinkSync(path.join(plansDir, "Archived", "Mine.md"));
      expect(archiveTerminalPlans({ plansDir, names: ["Mine.md"] })).toEqual(["docs/Plans/Archived/Mine.md"]);
      expect(fs.readFileSync(path.join(plansDir, "Theirs.md"), "utf8")).toBe("unfinished metadata");
    } finally {
      fs.rmSync(plansDir, { recursive: true, force: true });
    }
  });
});

describe("transient artifact cleanup", () => {
  it("never traverses a symlinked transient root, including during dry runs", () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "alchemy-prune-"));
    const external = fs.mkdtempSync(path.join(os.tmpdir(), "alchemy-retained-"));
    try {
      const retained = path.join(external, "keep.log");
      fs.writeFileSync(retained, "retained evidence");
      fs.utimesSync(retained, new Date(0), new Date(0));
      fs.symlinkSync(external, path.join(rootDir, "reports"), process.platform === "win32" ? "junction" : "dir");
      for (const dryRun of [true, false]) {
        expect(pruneTransientArtifacts({ rootDir, dryRun }).removed).toEqual([]);
        expect(fs.readFileSync(retained, "utf8")).toBe("retained evidence");
      }
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
      fs.rmSync(external, { recursive: true, force: true });
    }
  });

  it("parses a one-day dry-run policy", () => {
    expect(parsePruneArgs(["--dry-run", "--days=2"])).toEqual({ days: 2, dryRun: true });
    expect(() => parsePruneArgs(["--days=-1"])).toThrow(/non-negative/);
    expect(() => parsePruneArgs(["--days="])).toThrow(/non-negative/);
    expect(() => parsePruneArgs(["--days= "])).toThrow(/non-negative/);
    expect(parsePruneArgs(["--days=0"])).toEqual({ days: 0, dryRun: false });
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
