import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { isMainModule } from "./lib/is-main-module.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SKIP_SOURCE = [/\.generated\.(?:ts|tsx)$/u, /(?:^|\/)types\.ts$/u, /\.d\.ts$/u, /\/screens\//u];

/**
 * @param {string} relativePath
 * @returns {boolean}
 */
export function isCheckableSourceFile(relativePath) {
  const normalized = relativePath.replaceAll("\\", "/");
  if (!normalized.startsWith("src/") || !/\.(?:ts|tsx)$/u.test(normalized)) return false;
  return !SKIP_SOURCE.some((pattern) => pattern.test(normalized));
}

/**
 * @param {string} relativePath
 * @param {string} [rootDir]
 * @returns {boolean}
 */
export function hasTestOwner(relativePath, rootDir = ROOT) {
  const normalized = relativePath.replaceAll("\\", "/");
  const withoutSrc = normalized.replace(/^src\//u, "").replace(/\.(?:ts|tsx)$/u, "");
  for (const extension of [".test.ts", ".test.tsx"]) {
    if (existsSync(path.join(rootDir, "tests", `${withoutSrc}${extension}`))) return true;
  }
  // Engine modules must name their own suite; a sibling battle test is not ownership.
  if (normalized.startsWith("src/lib/")) return false;
  const mirroredDir = path.join(rootDir, "tests", path.posix.dirname(withoutSrc));
  if (!existsSync(mirroredDir)) return false;
  return readdirSync(mirroredDir).some((entry) => /\.test\.(?:ts|tsx)$/u.test(entry));
}

/**
 * @param {readonly string[]} addedPaths
 * @param {string} [rootDir]
 * @returns {string[]}
 */
export function unownedAddedSourceFiles(addedPaths, rootDir = ROOT) {
  return addedPaths.filter((filePath) => isCheckableSourceFile(filePath) && !hasTestOwner(filePath, rootDir));
}

/**
 * @param {string[]} argv
 * @returns {{ base: string | null, head: string, help: boolean }}
 */
export function parseTestOwnerArgs(argv) {
  let base = null;
  let head = "HEAD";
  let help = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") help = true;
    else if (arg === "--base") {
      base = argv[index + 1] ?? null;
      index += 1;
    } else if (arg === "--head") {
      head = argv[index + 1] ?? "HEAD";
      index += 1;
    } else if (arg.startsWith("--base=")) base = arg.slice("--base=".length) || null;
    else if (arg.startsWith("--head=")) head = arg.slice("--head=".length) || "HEAD";
  }
  return { base, head, help };
}

/**
 * @param {string} base
 * @param {string} head
 * @param {string} [rootDir]
 * @returns {string[] | null}
 */
export function gitAddedPaths(base, head, rootDir = ROOT) {
  if (!base || /^0+$/u.test(base)) return null;
  const result = spawnSync("git", ["diff", "--diff-filter=A", "--name-only", `${base}...${head}`], {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) return null;
  return (result.stdout ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function main() {
  const { base, head, help } = parseTestOwnerArgs(process.argv.slice(2));
  if (help) {
    console.log("Usage: npm run check:test-owners -- --base <sha> [--head <sha>]");
    return;
  }
  const added = gitAddedPaths(base ?? "HEAD~1", head);
  if (!added) {
    console.log("Test-owner check skipped (no diff base).");
    return;
  }
  const unowned = unownedAddedSourceFiles(added);
  if (unowned.length === 0) {
    console.log(`Test-owner check passed (${added.filter(isCheckableSourceFile).length} new source files).`);
    return;
  }
  console.error(
    "New source files have no mirrored test owner (tests/<path>.test.ts; src/lib requires that basename match, other source may use tests/<dir>/*.test.ts):",
  );
  for (const filePath of unowned) console.error(`- ${filePath}`);
  process.exitCode = 1;
}

if (isMainModule(import.meta.url)) main();
