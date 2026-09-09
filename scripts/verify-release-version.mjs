// Fails when a release git tag does not match package.json version.
import { verifyReleaseVersionTag } from "./lib/release-checks.mjs";
import { readRepoPackageJson } from "./lib/repo-package.mjs";

const pkg = readRepoPackageJson();
const tag = process.env.RELEASE_TAG ?? process.env.GITHUB_REF_NAME ?? "";

try {
  verifyReleaseVersionTag(tag, pkg.version);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

console.log(`Release tag matches package.json version ${pkg.version}`);
