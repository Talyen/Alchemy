import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { finished } from "node:stream/promises";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");
const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8")) as {
  packages: Record<string, { version?: string }>;
};
const copies = (name: string, version: string) =>
  Object.entries(lock.packages)
    .filter(([location, entry]) => location.endsWith(`node_modules/${name}`) && entry.version === version)
    .map(([location]) => path.join(root, location));
const load = (directory: string) => createRequire(path.join(directory, "package.json"))(directory);
const tempDirs: string[] = [];
function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "alchemy-dependency-compat-"));
  tempDirs.push(directory);
  fs.mkdirSync(path.join(directory, "nested"));
  fs.writeFileSync(path.join(directory, "a.txt"), "alpha");
  fs.writeFileSync(path.join(directory, "nested", "b.txt"), "bravo");
  fs.writeFileSync(path.join(directory, "nested", "addon.node"), "native");
  fs.writeFileSync(path.join(directory, ".hidden.txt"), "hidden");
  return directory;
}
afterEach(() => {
  for (const directory of tempDirs.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe("patched dependency consumers", () => {
  it.each(copies("glob", "7.2.3"))("traverses, filters and calls back with legacy glob at %s", async (directory) => {
    const glob = load(directory);
    const cwd = fixture();
    const options = { cwd, ignore: "nested/b.txt" };
    const callbackResult = await new Promise<string[]>((resolve, reject) => {
      glob("**/*.txt", options, (error: Error | null, matches: string[]) => (error ? reject(error) : resolve(matches)));
    });
    expect(callbackResult.sort()).toEqual(["a.txt"]);
    expect(glob.sync("**/*.txt", { cwd }).sort()).toEqual(["a.txt", "nested/b.txt"]);
    expect(glob.sync(".*", { cwd })).toEqual([".hidden.txt"]);
    expect(glob.sync("{a,nested/b}.txt", { cwd }).sort()).toEqual(["a.txt", "nested/b.txt"]);
  });

  it.each([...copies("@electron/asar", "3.4.1"), ...copies("@electron/asar", "4.3.1")])(
    "creates and unpacks an ASAR at %s",
    async (directory) => {
      const asar =
        directory === path.join(root, "node_modules/@electron/asar")
          ? await import(pathToFileURL(path.join(directory, "lib/asar.js")).href)
          : load(directory);
      const cwd = fixture();
      const archive = path.join(cwd, "..", `${path.basename(cwd)}.asar`);
      tempDirs.push(archive, `${archive}.unpacked`);
      const stream = await asar.createPackageWithOptions(cwd, archive, { unpack: "*.node" });
      if (stream && !stream.closed) await finished(stream);
      expect(asar.extractFile(archive, "a.txt").toString()).toBe("alpha");
      expect(asar.extractFile(archive, "nested/b.txt").toString()).toBe("bravo");
      expect(fs.readFileSync(path.join(`${archive}.unpacked`, "nested", "addon.node"), "utf8")).toBe("native");
    },
  );

  it("rejects an unexpected legacy package source during installation", () => {
    const cwd = fixture();
    fs.mkdirSync(path.join(cwd, "scripts"));
    fs.mkdirSync(path.join(cwd, "node_modules"));
    fs.copyFileSync(
      path.join(root, "scripts/patch-dependency-compat.mjs"),
      path.join(cwd, "scripts/patch-dependency-compat.mjs"),
    );
    fs.cpSync(copies("glob", "7.2.3")[0]!, path.join(cwd, "node_modules/glob"), { recursive: true });
    fs.cpSync(path.join(root, "node_modules/minimatch"), path.join(cwd, "node_modules/minimatch"), { recursive: true });
    fs.writeFileSync(
      path.join(cwd, "package-lock.json"),
      JSON.stringify({ packages: { "node_modules/glob": { version: "7.2.3" } } }),
    );
    fs.writeFileSync(path.join(cwd, "node_modules/glob/glob.js"), "changed upstream source");
    const result = spawnSync(process.execPath, [path.join(cwd, "scripts/patch-dependency-compat.mjs")], {
      encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Cannot safely patch");
  });

  it("uses modern glob cancellation and the legacy file list and removal paths", async () => {
    const cwd = fixture();
    const modern = load(path.join(root, "node_modules/glob"));
    expect((await modern.glob("**/*.txt", { cwd })).sort()).toEqual(["a.txt", "nested/b.txt"]);
    const controller = new AbortController();
    controller.abort();
    await expect(modern.glob("**/*", { cwd, signal: controller.signal })).rejects.toThrow();
    const filelist = load(path.join(root, "node_modules/filelist"));
    expect(new filelist.FileList().include(path.join(cwd, "**/*.txt")).toArray().sort()).toEqual(
      [path.join(cwd, "a.txt"), path.join(cwd, "nested/b.txt")].map((file) => file.replaceAll("\\", "/")).sort(),
    );
    const rimraf = load(path.join(root, "node_modules/rimraf"));
    await new Promise<void>((resolve, reject) => {
      rimraf(path.join(cwd, "**/*.txt").replaceAll("\\", "/"), (error: Error | null) =>
        error ? reject(error) : resolve(),
      );
    });
    expect(fs.existsSync(path.join(cwd, "a.txt"))).toBe(false);
    expect(fs.existsSync(path.join(cwd, "nested/b.txt"))).toBe(false);
    expect(fs.existsSync(path.join(cwd, ".hidden.txt"))).toBe(true);
  });

  it("applies ESLint file and ignore patterns with the patched matcher", async () => {
    const cwd = fixture();
    fs.writeFileSync(path.join(cwd, "check.js"), "const value = 1\n");
    fs.mkdirSync(path.join(cwd, "ignored"));
    fs.writeFileSync(path.join(cwd, "ignored", "skip.js"), "const value = 1\n");
    const { ESLint } = load(path.join(root, "node_modules/eslint"));
    const eslint = new ESLint({
      cwd,
      overrideConfigFile: true,
      overrideConfig: [{ ignores: ["**/ignored/**"] }, { files: ["**/*.js"], rules: { semi: ["error", "always"] } }],
    });
    const results = await eslint.lintFiles(["**/*.js"]);
    expect(results.map((result: { filePath: string }) => path.basename(result.filePath))).toEqual(["check.js"]);
    expect(results[0].messages[0].ruleId).toBe("semi");
  });

  it("filters files for universal packaging and resolves release ignore rules", () => {
    const cwd = fixture();
    const compare = load(path.join(root, "node_modules/dir-compare"));
    const result = compare.compareSync(cwd, cwd, { includeFilter: "*.txt", excludeFilter: ".*" });
    expect(result.diffSet.some((item: { name1?: string }) => item.name1 === "a.txt")).toBe(true);
    expect(result.diffSet.some((item: { name1?: string }) => item.name1 === "addon.node")).toBe(false);
    fs.writeFileSync(path.join(cwd, ".gitignore"), "*.tmp\n!important.tmp\n/root.txt\n# comment\n");
    const ignore = load(path.join(root, "node_modules/dotgitignore"))({ cwd });
    expect(ignore.ignore("dir/cache.tmp")).toBe(true);
    expect(ignore.ignore("important.tmp")).toBe(false);
    expect(ignore.ignore("root.txt")).toBe(true);
    expect(ignore.ignore("dir/root.txt")).toBe(false);
    expect(ignore.ignore("comment")).toBe(false);
  });
});
