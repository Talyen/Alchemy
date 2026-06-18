// Promotes CHANGELOG ## [Unreleased] to a versioned section after package.json bump.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promoteUnreleasedSection } from "./lib/patch-notes-core.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function promoteChangelog(rootDir = root) {
  const pkg = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"));
  const version = pkg.version;
  const dateIso = new Date().toISOString().slice(0, 10);
  const content = readFileSync(join(rootDir, "CHANGELOG.md"), "utf8");
  const promoted = promoteUnreleasedSection(content, version, dateIso);
  writeFileSync(join(rootDir, "CHANGELOG.md"), promoted, "utf8");
  console.log(`Promoted CHANGELOG ## [Unreleased] to [${version}]`);
}

promoteChangelog();
