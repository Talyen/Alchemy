#!/usr/bin/env node
/** Release gate: tag matches package.json version + packaged desktop integrity. */
import { verifyDesktopPackage, verifyReleaseVersionTag } from "./lib/release/release-checks.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";
import { readRepoPackageJson } from "./lib/repo-package.mjs";

export async function verifyRelease({ skipPackage = false } = {}) {
  const pkg = readRepoPackageJson();
  const tag = process.env.RELEASE_TAG ?? process.env.GITHUB_REF_NAME ?? "";
  console.log("\n== release tag ==");
  verifyReleaseVersionTag(tag, pkg.version);
  console.log(`Release tag matches package.json version ${pkg.version}`);
  if (skipPackage) return;
  console.log("\n== desktop package ==");
  await verifyDesktopPackage();
}

if (isMainModule(import.meta.url)) {
  const skipPackage = process.argv.includes("--skip-package");
  verifyRelease({ skipPackage }).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
