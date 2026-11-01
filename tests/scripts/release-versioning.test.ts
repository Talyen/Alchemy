import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";

const root = join(import.meta.dirname, "../..");
const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

it.each([
  { args: [], version: "1.1.0" },
  { args: ["--release-as", "patch"], version: "1.0.1" },
])("versions and tags a release without creating a changelog ($version)", ({ args, version }) => {
  const directory = mkdtempSync(join(tmpdir(), "alchemy-release-versioning-"));
  directories.push(directory);
  const git = (...gitArgs: string[]) =>
    execFileSync("git", ["-c", "core.hooksPath=/dev/null", ...gitArgs], { cwd: directory, encoding: "utf8" }).trim();
  git("init", "-q");
  git("config", "user.name", "Release test");
  git("config", "user.email", "release@example.invalid");
  copyFileSync(join(root, ".versionrc.json"), join(directory, ".versionrc.json"));
  writeFileSync(join(directory, "package.json"), JSON.stringify({ name: "release-test", version: "1.0.0" }));
  writeFileSync(
    join(directory, "package-lock.json"),
    JSON.stringify({
      name: "release-test",
      version: "1.0.0",
      lockfileVersion: 3,
      packages: { "": { version: "1.0.0" } },
    }),
  );
  git("add", ".");
  git("commit", "-qm", "chore: initial release");
  git("tag", "v1.0.0");
  writeFileSync(join(directory, "game.txt"), "new feature\n");
  git("add", "game.txt");
  git("commit", "-qm", "feat: add a feature");

  execFileSync(
    process.execPath,
    [join(root, "node_modules/commit-and-tag-version/bin/cli.js"), "--no-verify", ...args],
    {
      cwd: directory,
      stdio: "pipe",
    },
  );

  expect(JSON.parse(readFileSync(join(directory, "package.json"), "utf8")).version).toBe(version);
  expect(JSON.parse(readFileSync(join(directory, "package-lock.json"), "utf8")).version).toBe(version);
  expect(git("rev-parse", `v${version}^{commit}`)).toBe(git("rev-parse", "HEAD"));
  expect(existsSync(join(directory, "CHANGELOG.md"))).toBe(false);
  expect(git("status", "--porcelain")).toBe("");
});
