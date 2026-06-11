// Fails when a release git tag does not match package.json version.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const tag = process.env.RELEASE_TAG ?? process.env.GITHUB_REF_NAME ?? "";

const expected = `v${pkg.version}`;
if (!tag) {
  console.error("RELEASE_TAG or GITHUB_REF_NAME is required");
  process.exit(1);
}

if (tag !== expected) {
  console.error(`Release tag ${tag} does not match package.json version ${pkg.version} (expected ${expected})`);
  process.exit(1);
}

console.log(`Release tag matches package.json version ${pkg.version}`);
