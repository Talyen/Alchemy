import { readFileSync } from "node:fs";
import path from "node:path";

/** Parsed contents of the repository package.json. */
export function readRepoPackageJson() {
  const repoRoot = path.resolve(import.meta.dirname, "../..");
  return JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
}
