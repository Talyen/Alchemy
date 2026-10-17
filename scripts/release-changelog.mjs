// Promotes CHANGELOG ## [Unreleased] to a versioned section after package.json bump.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promoteUnreleasedSection } from "./lib/release/patch-notes-core.mjs";
import { defineScript, UsageError } from "./lib/script-run.mjs";
import { parseKnownFlags } from "./lib/cli-args.mjs";
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

defineScript(import.meta.url, () => {
  const { flags, rest } = parseKnownFlags(process.argv.slice(2), { help: { short: "h" } });
  if (rest.length) throw new UsageError(`Unexpected changelog promotion arguments: ${rest.join(", ")}`);
  if (flags.has("help")) {
    console.log("Usage: node scripts/release-changelog.mjs (promote Unreleased to the current package version)");
    return;
  }
  return promoteChangelog();
});
