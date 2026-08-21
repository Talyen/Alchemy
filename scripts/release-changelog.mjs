// Promotes CHANGELOG ## [Unreleased] to a versioned section after package.json bump.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promoteUnreleasedSection } from "./lib/patch-notes-core.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";
import { writeTextIfChanged } from "./lib/write-text-if-changed.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export async function promoteChangelog(rootDir = root) {
  const pkg = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"));
  const version = pkg.version;
  const dateIso = new Date().toISOString().slice(0, 10);
  const content = readFileSync(join(rootDir, "CHANGELOG.md"), "utf8");
  const promoted = promoteUnreleasedSection(content, version, dateIso);
  const wrote = await writeTextIfChanged(join(rootDir, "CHANGELOG.md"), promoted);
  console.log(wrote ? `Promoted CHANGELOG ## [Unreleased] to [${version}]` : "CHANGELOG.md already promoted");
}

if (isMainModule(import.meta.url)) {
  promoteChangelog().catch((error) => {
    console.error("Failed to promote CHANGELOG.md.", error);
    process.exitCode = 1;
  });
}
