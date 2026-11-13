import { spawnSync, type SpawnSyncOptionsWithStringEncoding } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach } from "vitest";

/** Register once per suite; every directory is removed even when a test fails. */
export function temporaryDirectories(prefix = "alchemy-test-") {
  const roots: string[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });
  return (name = prefix): string => {
    const root = mkdtempSync(join(tmpdir(), name));
    roots.push(root);
    return root;
  };
}

/** Run a real Node subprocess; failed exits remain results for the caller to assert. */
export function runNode(args: string[], options: Omit<SpawnSyncOptionsWithStringEncoding, "encoding"> = {}) {
  return spawnSync(process.execPath, args, { ...options, encoding: "utf8" });
}

/** Copy only the explicitly requested production files into an isolated project. */
export function copyFixtureFiles(root: string, files: string[]) {
  for (const file of files) {
    const target = join(root, file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(process.cwd(), file), target);
  }
}

/** One-spec reports still use the real Playwright JSON nesting. */
export function playwrightSuite(spec: Record<string, unknown>, tests: unknown[]) {
  return { specs: [{ ...spec, tests }] };
}
