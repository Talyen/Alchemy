#!/usr/bin/env node
/** Non-mutating verified build: validate generated outputs then invoke Vite directly without lifecycle preparation. */
import { syncGenerated } from "./sync-generated.mjs";
import { runTaskCommand } from "./lib/run-command.mjs";
import { defineScript, UsageError } from "./lib/script-run.mjs";
import { validateDesktopBuildConfig } from "./lib/release/desktop-build-config.mjs";
import { REPO_ROOT } from "./lib/repository-paths.mjs";

async function main(argv = process.argv.slice(2)) {
  const modes = [];
  let live = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--live" || arg === "--verbose") {
      live = true;
      continue;
    }
    if (arg === "--mode" || arg === "-m") {
      const mode = argv[++index];
      if (!mode || mode.startsWith("-")) throw new UsageError("Build mode requires a value.");
      modes.push(mode);
    } else if (arg.startsWith("--mode=") || arg.startsWith("-m=")) {
      const mode = arg.slice(arg.indexOf("=") + 1);
      if (!mode) throw new UsageError("Build mode requires a value.");
      modes.push(mode);
    }
  }
  const isDesktop = argv.includes("--desktop") || modes.includes("desktop");
  if (new Set(modes).size > 1 || (isDesktop && modes.some((mode) => mode !== "desktop"))) {
    throw new UsageError("Conflicting build modes: desktop builds require mode desktop.");
  }
  // Strip our own --desktop selector plus only leading vite/build positionals
  // (e.g. `npm run build -- vite build`). Filtering every occurrence would drop
  // legitimate user args such as `--mode build-preview`; the exact-match break
  // this guards against is a user `--mode build` value colliding with positionals.
  const viteForward = argv.filter((a) => !["--desktop", "--live", "--verbose"].includes(a));
  while (viteForward.length > 0 && (viteForward[0] === "vite" || viteForward[0] === "build")) {
    viteForward.shift();
  }

  if (isDesktop) validateDesktopBuildConfig();

  // Validate all generated outputs without mutating. Throws if stale.
  await syncGenerated({ check: true });

  const viteArgs = ["build"];
  if (isDesktop && modes.length === 0) {
    viteArgs.push("--mode", "desktop");
  }
  if (viteForward.length > 0) {
    viteArgs.push(...viteForward);
  }

  const result = await runTaskCommand("npx", ["vite", ...viteArgs], {
    cwd: REPO_ROOT,
    env: { ...process.env },
    label: isDesktop ? "desktop build" : "web build",
    live,
  });
  if (result.error) {
    console.error(`Failed to run vite ${viteArgs.join(" ")}:`, result.error.message);
  }
  return result.status ?? 1;
}

export { main as runBuildVerified };
defineScript(import.meta.url, () => main());
