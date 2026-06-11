import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

function listVersionTags(): string[] {
  try {
    const output = execSync('git tag --list "v*"', { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    if (!output) return [];
    return output.split("\n").map((tag) => tag.replace(/^v/, ""));
  } catch {
    return [];
  }
}

describe("changelog enforcement", () => {
  it("includes CHANGELOG.md in the repository", () => {
    expect(existsSync(join(ROOT, "CHANGELOG.md"))).toBe(true);
  });

  it("documents each release tag in CHANGELOG.md when tags exist", () => {
    const changelog = readFileSync(join(ROOT, "CHANGELOG.md"), "utf8");
    const tags = listVersionTags();
    if (tags.length === 0) {
      expect(changelog.length).toBeGreaterThan(0);
      return;
    }
    for (const version of tags) {
      expect(changelog).toContain(version);
    }
  });
});
