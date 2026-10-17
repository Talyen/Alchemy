import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";

const repoRoot = join(import.meta.dirname, "../..");

export function readText(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

let sourceFiles: string[] | undefined;

export function listNonTestSourceFiles(): string[] {
  return (sourceFiles ??= readdirSync(join(repoRoot, "src"), { recursive: true })
    .filter((file) => /\.tsx?$/.test(file) && !file.includes(".test."))
    .map((file) => `src/${file.split(sep).join("/")}`)
    .sort());
}

export function matchingFiles(paths: string[], pattern: RegExp): string[] {
  return paths.filter((filePath) => {
    pattern.lastIndex = 0;
    return pattern.test(readText(filePath));
  });
}
