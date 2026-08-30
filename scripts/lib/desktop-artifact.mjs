import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const packageLayout = require("../../desktop/package-layout.cjs");

export const assertSupportedTargets = packageLayout.assertSupportedTargets;
export const browserSnapshotDirectories = packageLayout.browserSnapshotDirectories;
export const executablePath = packageLayout.executablePath;
export const resolveUnpackedDirectory = packageLayout.resolveUnpackedDirectory;
export const targetFromUnpackedName = packageLayout.targetFromUnpackedName;
export const targetPlatform = packageLayout.targetPlatform;

export function steamContentRoot(root) {
  return path.join(root, "release-desktop", packageLayout.unpackedDirectoryName("win"));
}
