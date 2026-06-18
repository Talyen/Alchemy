import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeSyncedChangelog } from "../../scripts/sync-changelog.mjs";

describe("sync-changelog", () => {
  it("inserts an unreleased block before versioned sections", () => {
    const root = mkdtempSync(join(tmpdir(), "alchemy-changelog-"));
    const changelog = [
      "# Changelog",
      "",
      "All notable changes to Alchemy are documented here.",
      "",
      "## [0.1.0] (2026-06-11)",
      "",
      "### Features",
      "",
      "- Initial release",
      "",
    ].join("\n");
    writeFileSync(join(root, "CHANGELOG.md"), changelog, "utf8");

    const synced = computeSyncedChangelog(changelog, root);
    expect(synced).toContain("## [Unreleased]");
    expect(synced.indexOf("## [Unreleased]")).toBeLessThan(synced.indexOf("## [0.1.0]"));
    expect(synced).toContain("## [0.1.0] (2026-06-11)");
  });

  it("preserves versioned changelog sections while updating unreleased", () => {
    const root = mkdtempSync(join(tmpdir(), "alchemy-changelog-"));
    const changelog = [
      "# Changelog",
      "",
      "Header",
      "",
      "## [Unreleased]",
      "",
      "_No changes yet._",
      "",
      "## [0.1.0] (2026-06-11)",
      "",
      "### Features",
      "",
      "- Initial release",
      "",
    ].join("\n");
    writeFileSync(join(root, "CHANGELOG.md"), changelog, "utf8");

    const synced = computeSyncedChangelog(changelog, root);
    expect(readFileSync(join(root, "CHANGELOG.md"), "utf8")).toBe(changelog);
    expect(synced).toContain("- Initial release");
    expect(synced).toContain("## [0.1.0] (2026-06-11)");
  });
});
