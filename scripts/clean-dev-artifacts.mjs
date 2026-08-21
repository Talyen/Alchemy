#!/usr/bin/env node
// Removes local Alchemy build/test artifacts and optionally stops stale E2E preview servers.
// Depends on scripts/lib/clean-dev-artifacts.mjs and scripts/stop-dev-server.mjs ownership guards.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isMainModule } from "./lib/is-main-module.mjs";
import { stopDevServer } from "./stop-dev-server.mjs";
import {
  BUILD_ARTIFACT_DIRS,
  DEFAULT_ARTIFACT_DIRS,
  STALE_TEST_PORTS,
  formatBytes,
  listArtifactDirsToRemove,
  measurePath,
  removePath,
} from "./lib/clean-dev-artifacts.mjs";

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), "..");
/**
 * @param {string[]} argv
 */
export function parseCleanArgs(argv) {
  const flags = new Set(argv.filter((arg) => arg.startsWith("--")));
  const unknown = argv.filter((arg) => !arg.startsWith("--"));
  if (unknown.length > 0) {
    throw new Error(`Unexpected arguments: ${unknown.join(", ")}`);
  }

  const help = flags.has("--help") || flags.has("-h");
  const builds = flags.has("--builds") || flags.has("--all");
  const processes = flags.has("--processes") || flags.has("--all");
  const includeDevPort = flags.has("--include-dev-port");
  const dryRun = flags.has("--dry-run");

  const unsupported = [...flags].filter(
    (flag) => !["--help", "-h", "--builds", "--all", "--processes", "--include-dev-port", "--dry-run"].includes(flag),
  );
  if (unsupported.length > 0) {
    throw new Error(`Unknown flags: ${unsupported.join(", ")}`);
  }

  return { help, builds, processes, includeDevPort, dryRun };
}

function printHelp() {
  console.log(`Usage: node scripts/clean-dev-artifacts.mjs [options]

Removes gitignored Alchemy local artifacts so leftover reports/builds do not accumulate.

Options:
  --builds             Also remove ${BUILD_ARTIFACT_DIRS.join(" + ")}
  --processes          Stop Alchemy-owned listeners on ports ${STALE_TEST_PORTS.join(", ")}
  --include-dev-port   With --processes, also stop the Vite dev port (ALCHEMY_DEV_PORT / 5173)
  --all                Shorthand for --builds --processes
  --dry-run            Print what would be removed without deleting
  -h, --help           Show this help

Default targets:
  ${DEFAULT_ARTIFACT_DIRS.join(", ")}
`);
}

/**
 * @param {number} port
 * @param {{ dryRun: boolean }} options
 */
async function stopPort(port, options) {
  if (options.dryRun) {
    console.log(`[dry-run] Would stop Alchemy-owned process on port ${port} (if any).`);
    return;
  }

  await stopDevServer({ port, projectRoot: rootDir });
}

/**
 * @param {{ builds?: boolean, processes?: boolean, includeDevPort?: boolean, dryRun?: boolean }} options
 */
export async function runClean(options = {}) {
  const builds = options.builds === true;
  const processes = options.processes === true;
  const includeDevPort = options.includeDevPort === true;
  const dryRun = options.dryRun === true;

  const targets = listArtifactDirsToRemove(rootDir, { builds });
  let freedBytes = 0;

  if (targets.length === 0) {
    console.log("No matching artifact directories present.");
  } else {
    for (const absolutePath of targets) {
      const measured = measurePath(absolutePath);
      freedBytes += measured.bytes;
      const relative = path.relative(rootDir, absolutePath) || absolutePath;
      if (dryRun) {
        console.log(`[dry-run] Would remove ${relative} (${formatBytes(measured.bytes)})`);
        continue;
      }
      removePath(absolutePath);
      console.log(`Removed ${relative} (${formatBytes(measured.bytes)})`);
    }
  }

  if (processes) {
    const ports = [...STALE_TEST_PORTS];
    if (includeDevPort) {
      const devPort = Number.parseInt(process.env.ALCHEMY_DEV_PORT ?? "5173", 10);
      if (Number.isInteger(devPort) && devPort > 0 && !ports.includes(devPort)) {
        ports.push(devPort);
      }
    }
    for (const port of ports) {
      await stopPort(port, { dryRun });
    }
  }

  if (!dryRun && targets.length > 0) {
    console.log(`Freed about ${formatBytes(freedBytes)}.`);
  }

  return { removed: targets, freedBytes };
}

async function main() {
  const options = parseCleanArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  await runClean(options);
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
