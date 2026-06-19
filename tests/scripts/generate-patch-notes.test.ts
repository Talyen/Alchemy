import { describe, expect, it } from "vitest";
import {
  buildChangelogUnreleased,
  buildPatchNotesMarkdown,
  extractChangelogSection,
  extractPlayerFacingLines,
  parseChangelogCommits,
  parseConventionalCommit,
  promoteUnreleasedSection,
  replaceChangelogUnreleased,
} from "../../scripts/lib/patch-notes-core.mjs";

describe("generate-patch-notes", () => {
  it("includes player-facing conventional commits only", () => {
    const markdown = buildPatchNotesMarkdown("1.2.3", [
      { subject: "feat(cards): add meteor shower", body: "" },
      { subject: "fix(save): repair corrupt deck", body: "" },
      { subject: "chore: update deps", body: "" },
      { subject: "balance: reduce goblin HP", body: "" },
    ]);
    expect(markdown).toContain("add meteor shower");
    expect(markdown).toContain("repair corrupt deck");
    expect(markdown).toContain("reduce goblin HP");
    expect(markdown).not.toContain("update deps");
    expect(markdown).toContain("## Known issues");
  });

  it("parses conventional commit headers", () => {
    const parsed = parseConventionalCommit("feat(steam): enable cloud saves");
    expect(parsed.type).toBe("feat");
    expect(parsed.scope).toBe("steam");
    expect(parsed.include).toBe(true);
  });

  it("extracts first sentence from prose commit bodies", () => {
    const lines = extractPlayerFacingLines({
      subject: "feat(ui): add crafting currencies, armory apply flows, and coverage",
      body: [
        "Introduce six salvage crafting currencies with store persistence and armory application UI.",
        "Add save migrations plus E2E and unit tests for crafting.",
        "",
        "Co-authored-by: Cursor <cursoragent@cursor.com>",
      ].join("\n"),
    });
    expect(lines).toContain(
      "**ui:** Introduce six salvage crafting currencies with store persistence and armory application UI.",
    );
    expect(lines).toContain("**ui:** Add save migrations plus E2E and unit tests for crafting.");
    expect(lines.some((line) => line.includes("Co-authored-by"))).toBe(false);
  });

  it("extracts markdown bullets from commit bodies", () => {
    const lines = extractPlayerFacingLines({
      subject: "feat(armory): crafting update",
      body: "- Add currency drag-and-drop\n- Add apply-to-gear flows",
    });
    expect(lines).toEqual(["**armory:** Add currency drag-and-drop", "**armory:** Add apply-to-gear flows"]);
  });

  it("falls back to subject when body is empty", () => {
    const lines = extractPlayerFacingLines({
      subject: "fix(save): repair corrupt deck",
      body: "",
    });
    expect(lines).toEqual(["**save:** repair corrupt deck"]);
  });

  it("builds grouped unreleased changelog sections", () => {
    const markdown = buildChangelogUnreleased([
      { subject: "feat(ui): add armory", body: "Replace placeholder gear with affix rolls." },
      { subject: "fix(ci): repair Electron download", body: "" },
      { subject: "Abstract encounter traits across Labyrinth and Wildwood", body: "" },
    ]);
    expect(markdown).toContain("## [Unreleased]");
    expect(markdown).toContain("### Features");
    expect(markdown).toContain("- feat(ui): add armory");
    expect(markdown).toContain("Replace placeholder gear with affix rolls.");
    expect(markdown).toContain("### Bug Fixes");
    expect(markdown).toContain("### Other");
  });

  it("parses changelog commits with indented bodies", () => {
    const section = [
      "### Features",
      "",
      "- feat(ui): add armory",
      "  Replace placeholder gear with affix rolls.",
      "",
      "- fix(save): repair deck",
    ].join("\n");
    const commits = parseChangelogCommits(section);
    expect(commits).toEqual([
      { subject: "feat(ui): add armory", body: "Replace placeholder gear with affix rolls." },
      { subject: "fix(save): repair deck", body: "" },
    ]);
  });

  it("promotes unreleased changelog content into a versioned section", () => {
    const source = [
      "# Changelog",
      "",
      "All notable changes to Alchemy are documented here.",
      "",
      "## [Unreleased]",
      "",
      "### Features",
      "",
      "- feat(ui): add armory",
      "",
      "## [0.1.0] (2026-06-11)",
      "",
      "### Features",
      "",
      "- Initial release",
    ].join("\n");

    const promoted = promoteUnreleasedSection(source, "0.2.0", "2026-06-17");
    expect(promoted).toContain("## [0.2.0] (2026-06-17)");
    expect(promoted).toContain("- feat(ui): add armory");
    expect(promoted).toContain("## [Unreleased]");
    expect(promoted).toContain("_No changes yet._");
    expect(promoted).toContain("## [0.1.0] (2026-06-11)");
  });

  it("replaces only the unreleased block", () => {
    const source = [
      "# Changelog",
      "",
      "Header text.",
      "",
      "## [Unreleased]",
      "",
      "old",
      "",
      "## [0.1.0] (2026-06-11)",
      "",
      "versioned",
    ].join("\n");
    const next = replaceChangelogUnreleased(source, "## [Unreleased]\n\nnew\n");
    expect(next).toContain("## [Unreleased]\n\nnew");
    expect(next).toContain("## [0.1.0] (2026-06-11)");
    expect(next).not.toContain("old");
  });

  it("extracts changelog sections by heading", () => {
    const content = [
      "## [Unreleased]",
      "",
      "### Features",
      "",
      "- feat(ui): add armory",
      "",
      "## [0.1.0] (2026-06-11)",
    ].join("\n");
    expect(extractChangelogSection(content, "## [Unreleased]")).toContain("feat(ui): add armory");
  });

  it("extracts versioned changelog sections with release dates", () => {
    const content = ["## [0.1.0] (2026-06-11)", "", "### Features", "", "- Initial release"].join("\n");
    expect(extractChangelogSection(content, "## [0.1.0]")).toContain("Initial release");
  });
});
