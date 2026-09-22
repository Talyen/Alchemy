// Runs the ship-gate unit suites while guarding against silent coverage loss:
// every entry below must resolve to at least one test file, otherwise vitest
// would quietly run a narrower (or empty) selection and the ship gate would
// stop protecting what it claims to. Failing loudly here turns a renamed or
// retyped path into an error instead of a silent gap.
//
// Keep this list in sync with the suites that must pass before shipping a
// save-affecting change: storage/persistence, autosave, validation, the
// architecture invariants, and the bespoke scripts.
import { runTaskCommand } from "./lib/run-command.mjs";
import { VITEST_MAX_WORKERS } from "./lib/verification/test-concurrency.mjs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateRouteCatalog } from "./lib/verification/change-routes.mjs";
import { TEST_SUITES, validateTestSuitePaths } from "./lib/verification/test-commands.mjs";

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
      "it from TEST_SUITES in scripts/lib/verification/test-commands.mjs.",
  );
  process.exit(1);
}

const live = process.argv.includes("--live") || process.argv.includes("--verbose");
const result = await runTaskCommand("npx", ["vitest", "run", `--maxWorkers=${VITEST_MAX_WORKERS}`, ...SUITES], {
  label: "ship unit suite",
  live,
});
process.exit(result.status ?? 1);
