// Runs the ship-gate unit suites while guarding against silent coverage loss:
// every entry below must resolve to at least one test file, otherwise vitest
// would quietly run a narrower (or empty) selection and the ship gate would
// stop protecting what it claims to. Failing loudly here turns a renamed or
// retyped path into an error instead of a silent gap.
//
// Keep this list in sync with the suites that must pass before shipping a
// save-affecting change: storage/persistence, autosave, validation, the
// architecture invariants, and the bespoke scripts.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateRouteCatalog } from "./lib/change-routes.mjs";
import { TEST_SUITES, validateTestSuitePaths } from "./lib/test-suites.mjs";

const root = dirname(fileURLToPath(import.meta.url));
/** Resolve a dir/file path against the repo root. */
const at = (...segments) => join(root, "..", ...segments);

const SUITES = TEST_SUITES.shipUnit;

const routeErrors = validateRouteCatalog({ rootDir: at() });
if (routeErrors.length > 0) {
  console.error(`Route catalog is stale:\n${routeErrors.map((error) => `  - ${error}`).join("\n")}`);
  process.exit(1);
}

const missing = validateTestSuitePaths(at(), SUITES);

if (missing.length > 0) {
  console.error(
    `The ship unit suite matches no test files for:\n${missing.map((m) => `  - ${m}`).join("\n")}\n` +
      "A path above is stale — vitest would silently run a narrower gate. Fix the path or remove " +
      "it from the SUITES list in scripts/run-ship-unit.mjs.",
  );
  process.exit(1);
}

const result = spawnSync(
  join(root, "..", "node_modules", ".bin", process.platform === "win32" ? "vitest.cmd" : "vitest"),
  ["run", "--maxWorkers=4", ...SUITES],
  { stdio: "inherit", shell: process.platform === "win32" },
);
process.exit(result.status ?? (result.error ? 1 : 0));
