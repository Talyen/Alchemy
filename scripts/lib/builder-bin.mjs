import { resolveNodeCli } from "./command-invocation.mjs";

/** Absolute path to the bundled electron-builder CLI, avoiding npx resolution and shell quirks. */
export function resolveBuilderBin() {
  return resolveNodeCli("electron-builder", "electron-builder", "out", "cli", "cli.js");
}
