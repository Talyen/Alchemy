import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Absolute path to the bundled Vite CLI, avoiding npx resolution and shell quirks. */
export function resolveViteBin() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const bin = join(root, "node_modules", "vite", "bin", "vite.js");
  if (!existsSync(bin)) throw new Error(`Vite CLI is missing: ${bin} (run npm ci)`);
  return bin;
}
