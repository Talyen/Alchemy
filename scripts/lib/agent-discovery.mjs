import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { readExposure } from "./agent-events.mjs";

const require = createRequire(import.meta.url);
const EXCLUSIONS = [
  "Raw Assets/**",
  "reports/**",
  "dist/**",
  "CHANGELOG.md",
  "**/package-lock.json",
  "**/pnpm-lock.yaml",
  "**/yarn.lock",
  "**/bun.lock",
  "**/bun.lockb",
  "node_modules/**",
  ".git/**",
  ".worktrees/**",
];

export function repositorySearch(
  root,
  { pattern, paths = ["."], excerpts = false, includeExcluded = false, regex = false } = {},
) {
  const args = ["--hidden", "--color", "never"];
  if (includeExcluded) args.push("--no-ignore");
  else for (const glob of EXCLUSIONS) args.push("-g", `!${glob}`);
  if (pattern === undefined) args.push("--files", "-0");
  else {
    args.push(...(excerpts ? ["--json"] : ["--files-with-matches", "-0"]));
    if (!regex) args.push("--fixed-strings");
    args.push("-e", pattern);
  }
  args.push("--", ...paths);
  const result = spawnSync("rg", args, { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (result.error || ![0, 1].includes(result.status))
    throw new Error(result.error?.message ?? result.stderr.trim() ?? "Repository search failed");
  if (!excerpts || pattern === undefined)
    return [
      ...new Set(
        result.stdout
          .split("\0")
          .filter(Boolean)
          .map((file) => file.replace(/^\.\//u, "")),
      ),
    ].sort();
  return result.stdout
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((event) => event.type === "match" && event.data.path.text && event.data.lines.text)
    .map(({ data }) => ({
      path: data.path.text.replace(/^\.\//u, ""),
      start: data.line_number,
      end: data.line_number,
      text: data.lines.text.replace(/\r?\n$/u, ""),
    }))
    .sort((a, b) => a.path.localeCompare(b.path) || a.start - b.start);
}

export function incrementalContext(root, session, sections, { refresh = false } = {}) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/u.test(session)) throw new Error("Invalid context session ID");
  const filename = path.join(root, "reports/agent-context", `${session}.json`);
  let seen = {};
  if (!refresh) {
    try {
      const record = JSON.parse(fs.readFileSync(filename, "utf8"));
      if (record.version === 1 && record.seen && typeof record.seen === "object") seen = record.seen;
    } catch {}
  }
  const key = (section) => JSON.stringify([section.path, section.heading ?? null, section.start, section.end]);
  const pending = sections.filter((section) => seen[key(section)] !== readExposure(section).contentHash);
  return {
    sections: pending,
    omitted: sections.length - pending.length,
    remember(included) {
      for (const section of included) seen[key(section)] = readExposure(section).contentHash;
      fs.mkdirSync(path.dirname(filename), { recursive: true });
      fs.writeFileSync(filename, JSON.stringify({ version: 1, seen }) + "\n");
    },
  };
}

export function relatedLocations(root, selectedPaths, limit = 6) {
  const ts = require("typescript");
  const configPath = ts.findConfigFile(root, ts.sys.fileExists);
  const config = configPath ? ts.readConfigFile(configPath, ts.sys.readFile).config : {};
  const options = ts.parseJsonConfigFileContent(config, ts.sys, root).options;
  const files = repositorySearch(root).filter((file) => /\.(?:[cm]?[jt]sx?)$/u.test(file));
  const known = new Set(files);
  const dependencies = new Map();
  const consumers = new Map();
  for (const file of files) {
    const fullPath = path.join(root, file);
    const imports = ts.preProcessFile(fs.readFileSync(fullPath, "utf8"), true, true).importedFiles;
    const resolved = imports.flatMap(({ fileName }) => {
      const target = ts.resolveModuleName(fileName, fullPath, { ...options, allowJs: true }, ts.sys).resolvedModule;
      const relative = target && path.relative(root, target.resolvedFileName).replaceAll(path.sep, "/");
      return relative && known.has(relative) ? [relative] : [];
    });
    dependencies.set(file, resolved);
    for (const target of resolved) consumers.set(target, [...(consumers.get(target) ?? []), file]);
  }
  const selected = selectedPaths.map((file) => path.relative(root, path.resolve(root, file)).replaceAll(path.sep, "/"));
  const seeds = new Set(
    files.filter((file) => selected.some((entry) => file === entry || file.startsWith(`${entry}/`))),
  );
  const distances = new Map();
  let frontier = [...seeds];
  for (let distance = 1; distance <= 2; distance++) {
    const next = [];
    for (const file of frontier)
      for (const consumer of consumers.get(file) ?? []) {
        if (seeds.has(consumer) || distances.has(consumer)) continue;
        distances.set(consumer, distance);
        next.push(consumer);
      }
    frontier = next;
  }
  const ranked = [...distances].sort(([a, da], [b, db]) => da - db || a.localeCompare(b));
  const isTest = (file) => /\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(file);
  const tests = [...seeds]
    .filter(isTest)
    .concat(ranked.filter(([file]) => isTest(file)).map(([file]) => file))
    .slice(0, limit);
  const fixtures = [
    ...new Set(
      tests
        .flatMap((file) => dependencies.get(file) ?? [])
        .filter((file) => /(?:fixture|test-utils|test-helpers|testing|playwright-shared)/u.test(file)),
    ),
  ]
    .sort()
    .slice(0, limit);
  return {
    consumers: ranked
      .filter(([file]) => !isTest(file))
      .slice(0, limit)
      .map(([file]) => file),
    tests,
    fixtures,
  };
}
