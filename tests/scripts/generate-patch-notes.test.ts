import { execFileSync, execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { generatePatchNotesMarkdown, parseGeneratePatchNotesArgs } from "../../scripts/generate-patch-notes.mjs";
import { parseReleaseArgs } from "../../scripts/lib/release/release-runner.mjs";
import {
  buildPatchNotesMarkdown,
  extractPlayerFacingLines,
  isUserFacing,
} from "../../scripts/lib/release/patch-notes-core.mjs";

describe("generate-patch-notes", () => {
  it("omits case-insensitive and indented coauthor trailers from player notes", () => {
    const lines = extractPlayerFacingLines({
      subject: "fix: repair the battle",
      body: "Players can finish the battle.\n\n  co-authored-by: Contributor <contributor@example.com>",
    });
    expect(lines).toEqual(["Players can finish the battle."]);
  });

  it("treats colocated TSX and JavaScript test files as infrastructure", () => {
    for (const file of ["src/ui/widget.test.tsx", "src/ui/widget.spec.jsx", "src/lib/logic.test.mjs"])
      expect(isUserFacing({ subject: "fix: improve coverage", body: "", files: [file] }), file).toBe(false);
    expect(isUserFacing({ subject: "fix: improve widget", body: "", files: ["src/ui/widget.tsx"] })).toBe(true);
  });

  it("handles inherited object property names as unknown commit types", () => {
    const commits = [{ subject: "constructor: improve the game", body: "User-Facing: yes" }];
    expect(buildPatchNotesMarkdown("1.2.3", commits)).toContain("improve the game");
  });

  it("rejects misspelled options instead of writing during an intended preview", () => {
    expect(() => parseGeneratePatchNotesArgs(["--dryrun"], {})).toThrow("Unknown patch-note option");
    expect(parseGeneratePatchNotesArgs(["--dry-run"], {})).toMatchObject({ dryRun: true });
  });
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

  it("extracts first sentence from prose commit bodies", () => {
    const lines = extractPlayerFacingLines({
      subject: "feat(ui): add crafting currencies, armory apply flows, and coverage",
      body: [
        "Introduce six salvage crafting currencies with store persistence and armory application UI.",
        "Add save migrations plus E2E and unit tests for crafting.",
        "",
        "Co-authored-by: Contributor <contributor@example.com>",
      ].join("\n"),
    });
    expect(lines).toContain(
      "**ui:** Introduce six salvage crafting currencies with store persistence and armory application UI.",
    );
    expect(lines).toContain("**ui:** Add save migrations plus E2E and unit tests for crafting.");
    expect(lines.some((line) => line.includes("Co-authored-by"))).toBe(false);
    expect(extractPlayerFacingLines({ subject: "fix: subject fallback", body: "Short one. Short two." })).toEqual([
      "Short one.",
    ]);
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

  it("drops infra-only feat commits from player notes", () => {
    for (const file of [
      "eslint.config.js",
      "eslint/session-ownership.js",
      "oxlint.config.ts",
      "lint/session-ownership.js",
    ]) {
      expect(isUserFacing({ subject: "fix: preserve architecture checks", body: "", files: [file] }), file).toBe(false);
    }
    expect(
      isUserFacing({
        subject: "feat(ci): enable strict test config",
        body: "",
        files: ["scripts/check-docs.mjs", ".github/workflows/ci.yml"],
      }),
    ).toBe(false);
    const markdown = buildPatchNotesMarkdown("1.2.3", [
      {
        subject: "feat(ci): enable strict test config",
        body: "",
        files: ["scripts/check-docs.mjs", ".github/workflows/ci.yml"],
      },
      {
        subject: "feat(cards): add meteor shower",
        body: "- Rain meteors across a chosen enemy row.",
        files: ["src/lib/game-data/cards.ts"],
      },
    ]);
    expect(markdown).toContain("Rain meteors across a chosen enemy row.");
    expect(markdown).not.toContain("strict test config");
  });

  it("honors User-Facing trailers over type and path inference", () => {
    expect(
      isUserFacing({
        subject: "feat(content): reshuffle internal catalog ids",
        body: "User-Facing: no",
        files: ["src/lib/game-data/cards.ts"],
      }),
    ).toBe(false);
    expect(
      isUserFacing({
        subject: "chore: surface a player-visible options default",
        body: "User-Facing: yes",
        files: ["scripts/release.mjs"],
      }),
    ).toBe(true);

    const markdown = buildPatchNotesMarkdown("1.2.3", [
      {
        subject: "feat(content): reshuffle internal catalog ids",
        body: "User-Facing: no",
        files: ["src/lib/game-data/cards.ts"],
      },
      {
        subject: "chore: surface a player-visible options default",
        body: "- Options now default to windowed mode.\n\nUser-Facing: yes",
        files: ["scripts/release.mjs"],
      },
    ]);
    expect(markdown).toContain("Options now default to windowed mode.");
    expect(markdown).not.toContain("catalog ids");
  });

  it("prefers body bullets over the subject and skips implementation lines", () => {
    const lines = extractPlayerFacingLines({
      subject: "feat(battle): retarget when a hero dies mid-turn",
      body: "- Enemies now pick a new target if the current one dies mid-turn.\n- update tests for retarget coverage",
      files: ["src/lib/battle/retarget.ts"],
    });
    expect(lines).toEqual(["**battle:** Enemies now pick a new target if the current one dies mid-turn."]);
  });

  it("parses generate and release dry-run flags", () => {
    expect(parseGeneratePatchNotesArgs(["--dry-run"], { RELEASE_VERSION: "v1.4.0" })).toEqual({
      dryRun: true,
      releaseVersion: "1.4.0",
    });
    expect(parseReleaseArgs(["--dry-run"])).toEqual({ dryRun: true, hotfix: false });
    expect(parseReleaseArgs([])).toEqual({ dryRun: false, hotfix: false });
    expect(parseReleaseArgs(["--hotfix", "--dry-run"])).toEqual({ dryRun: true, hotfix: true });
    expect(() => parseReleaseArgs(["--dryrun"])).toThrow("Unknown release argument");
    expect(() => parseReleaseArgs(["patch"])).toThrow("Unknown release argument");
  });
});

describe("generate-patch-notes from git", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("bumps and tags a release without a changelog while preserving player notes", () => {
    const root = mkdtempSync(join(tmpdir(), "alchemy-release-without-changelog-"));
    tempDirs.push(root);
    const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
    git("init", "-q");
    git("config", "user.email", "test@example.com");
    git("config", "user.name", "Test");
    copyFileSync(join(process.cwd(), ".versionrc.json"), join(root, ".versionrc.json"));
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "release-test", version: "1.0.0" }));
    mkdirSync(join(root, "src"));
    writeFileSync(join(root, "src/game.ts"), "before\n");
    git("add", ".");
    git("commit", "-qm", "chore: seed");
    git("tag", "v1.0.0");
    writeFileSync(join(root, "src/game.ts"), "after\n");
    git("add", ".");
    git("commit", "-qm", "fix: repair the battle");

    execFileSync(
      process.execPath,
      [join(process.cwd(), "node_modules/commit-and-tag-version/bin/cli.js"), "--release-as", "patch"],
      {
        cwd: root,
        stdio: "pipe",
      },
    );

    expect(JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version).toBe("1.0.1");
    expect(git("rev-parse", "v1.0.1^{commit}")).toBe(git("rev-parse", "HEAD"));
    expect(existsSync(join(root, "CHANGELOG.md"))).toBe(false);
    expect(generatePatchNotesMarkdown(root, { releaseVersion: "1.0.1" }).markdown).toContain("repair the battle");
  });

  it("writes sectioned notes from git commits and omits infra-only feats", () => {
    const root = mkdtempSync(join(tmpdir(), "alchemy-patch-notes-"));
    tempDirs.push(root);
    execSync("git init -q && git config user.email test@example.com && git config user.name test", {
      cwd: root,
      shell: "/bin/sh",
    });
    mkdirSync(join(root, "src"), { recursive: true });
    mkdirSync(join(root, "scripts"), { recursive: true });
    writeFileSync(join(root, "src/game.ts"), "seed\n", "utf8");
    execSync("git add . && git commit -qm 'chore: seed' && git tag v0.1.0", { cwd: root, shell: "/bin/sh" });
    writeFileSync(join(root, "src/game.ts"), "meteor\n", "utf8");
    execSync("git add . && git commit -qm 'feat(cards): add meteor shower'", { cwd: root, shell: "/bin/sh" });
    writeFileSync(join(root, "scripts/lint.mjs"), "export {}\n", "utf8");
    execSync("git add . && git commit -qm 'feat(ci): enable strict test config'", { cwd: root, shell: "/bin/sh" });

    const result = generatePatchNotesMarkdown(root);
    expect(result.version).toBe("Unreleased");
    expect(result.markdown).toContain("# Alchemy vUnreleased");
    expect(result.markdown).toContain("## Features");
    expect(result.markdown).toContain("add meteor shower");
    expect(result.markdown).not.toContain("strict test config");
  });
});
