#!/usr/bin/env node
import { createRequire } from "node:module";
import path from "node:path";
import { constants, setPriority } from "node:os";
import { runTaskCommand } from "./lib/run-command.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

if (isMainModule(import.meta.url)) {
  if (process.argv.length > 2) throw new Error("Local smoke is fixed. Use test:unit for full or focused unit tests.");
  console.log(
    "Scope: npm test runs 3 Node smoke suites only. Use npm run test:unit -- <test-paths> for focused units, or npm run check -- <task-paths> for task completion.",
  );
  setPriority(0, constants.priority.PRIORITY_BELOW_NORMAL);
  const require = createRequire(import.meta.url);
  const result = await runTaskCommand(
    process.execPath,
    [
      path.join(path.dirname(require.resolve("vitest/package.json")), "vitest.mjs"),
      "run",
      "--config",
      "vitest.local.config.ts",
    ],
    {
      cwd: ROOT,
      label: "Local Node smoke",
      timeout: 30_000,
      env: {
        ...process.env,
        NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --max-old-space-size=512`.trim(),
        RAYON_NUM_THREADS: "1",
      },
    },
  );
  process.exitCode = result.status ?? 1;
}
