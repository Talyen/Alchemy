import { resolveNodeCli } from "./command-invocation.mjs";

/** Absolute path to the bundled Vite CLI, avoiding npx resolution and shell quirks. */
export function resolveViteBin() {
  return resolveNodeCli("Vite", "vite", "bin", "vite.js");
}
