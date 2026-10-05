import path from "node:path";
import { registerArtifactSession } from "./artifact-guard.mjs";
import { pruneExpiredArtifacts } from "../prune-transient-artifacts.mjs";
import { isMainModule } from "./is-main-module.mjs";

/**
 * Usage errors (exit 2) vs runtime failures (exit 1). Throw UsageError for
 * bad flags/modes so hand-rolled entries and defineScript agree:
 * 0 = pass, 1 = check failed, 2 = bad invocation.
 */
export class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = "UsageError";
  }
}

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
export function defineScript(importMetaUrl, fn, { artifacts = false } = {}) {
  if (!isMainModule(importMetaUrl)) return;
  const report = (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = error instanceof UsageError ? 2 : 1;
  };
  const handleResult = (res) => {
    if (typeof res === "number") process.exitCode = res;
  };
  try {
    const rootDir = path.resolve(import.meta.dirname, "../..");
    const result = artifacts
      ? registerArtifactSession(rootDir, () => pruneExpiredArtifacts({ rootDir })).then(fn)
      : fn();
    if (result && typeof result.then === "function") {
      result.then(handleResult, report);
    } else {
      handleResult(result);
    }
  } catch (error) {
    report(error);
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
