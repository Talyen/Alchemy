import { isMainModule } from "./is-main-module.mjs";

/**
 * Single CLI lifecycle owner for scripts.
 * Owns `isMainModule` gating plus top-level error reporting / exit codes
 * so entry files stay declarative. Supports sync and async entry functions.
 *
 * @param {string} importMetaUrl `import.meta.url` of the calling module
 * @param {() => unknown} fn entry function
 */
export function defineScript(importMetaUrl, fn) {
  if (!isMainModule(importMetaUrl)) return;
  try {
    const result = fn();
    if (result && typeof result.catch === "function") {
      result.catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
      });
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
