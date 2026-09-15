import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";

export const repoRoot = join(import.meta.dirname, "../..");

export function readText(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

const sourceFileCache = new Map<string, string[]>();

function walkTsFiles(relativeDir: string): string[] {
  const cached = sourceFileCache.get(relativeDir);
  if (cached) return cached;
  const out: string[] = [];
  const stack = [join(repoRoot, relativeDir)];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(abs);
      } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
        out.push(
          abs
            .slice(repoRoot.length + 1)
            .split(sep)
            .join("/"),
        );
      }
    }
  }
  out.sort();
  sourceFileCache.set(relativeDir, out);
  return out;
}

/** Repo-relative .ts/.tsx paths under the given dirs (default: src). Results are cached per process. */
export function listSourceFiles(dirs: string | string[] = "src"): string[] {
  const list = Array.isArray(dirs) ? dirs : [dirs];
  return list.flatMap((dir) => walkTsFiles(dir));
}

/** Repo-relative .ts/.tsx paths excluding vitest test files. */
export function listNonTestSourceFiles(dirs: string | string[] = "src"): string[] {
  return listSourceFiles(dirs).filter((path) => !path.includes(".test."));
}

/** Paths whose file contents match the pattern. Reads each file once. */
export function matchingFiles(paths: string[], pattern: RegExp): string[] {
  return paths.filter((filePath) => {
    // RegExp.test is stateful for global/sticky patterns; reset so reuse is safe.
    pattern.lastIndex = 0;
    return pattern.test(readText(filePath));
  });
}
