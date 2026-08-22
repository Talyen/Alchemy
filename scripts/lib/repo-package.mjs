import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Parsed contents of the repository package.json. */
export function readRepoPackageJson() {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  return JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
}
