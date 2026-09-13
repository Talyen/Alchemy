import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Absolute path to the bundled electron-builder CLI, avoiding npx resolution and shell quirks. */
export function resolveBuilderBin() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const bin = join(root, "node_modules", "electron-builder", "out", "cli", "cli.js");
  if (!existsSync(bin)) throw new Error(`electron-builder CLI is missing: ${bin} (run npm ci)`);
  return bin;
}
