import { isMainModule } from "./is-main-module.mjs";

/**
 * Single CLI lifecycle owner for scripts.
 * Owns `isMainModule` gating plus top-level error reporting / exit codes
 * so entry files stay declarative. Supports sync and async entry functions.
 *
 * Simple entries use `defineScript`; asset transform pipelines use
 * `runPipelineScript` for their shared `{ ok, error }` result convention.
 * Entries with custom usage/exit-code flows (path selection, plan metadata)
 * stay hand-rolled on `isMainModule` instead of bending these two shapes.
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

/**
 * Pipeline lifecycle over the same gating/exit-code contract: runs `scriptFn`
 * only as a CLI entry and maps a falsy `{ ok }` result to a labeled failure.
 */
export function runPipelineScript(importMetaUrl, label, scriptFn) {
  defineScript(importMetaUrl, async () => {
    const result = await scriptFn();
    if (!result || result.ok !== true) {
      if (result?.error) console.error(result.error);
      throw new Error(`${label} failed.`);
    }
  });
}
