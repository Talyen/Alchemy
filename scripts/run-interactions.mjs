import fs from "node:fs";
import { runStreamCommand } from "./lib/run-command.mjs";
import { REPO_ROOT } from "./lib/repository-paths.mjs";
const families = ["battle", "navigation", "visits", "armory", "overlays", "persistence", "startup"];
const env = { ...process.env };
const args = process.argv.slice(2);
try {
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === "--shrink") {
      env.ALCHEMY_INTERACTION_SHRINK = "1";
      continue;
    }
    const value = args[++index];
    if (!value) throw new Error(`Missing value for ${flag}`);
    if (flag === "--replay") {
      const artifact = JSON.parse(fs.readFileSync(value, "utf8"));
      if (
        !families.includes(artifact.family) ||
        !Number.isSafeInteger(artifact.seed) ||
        artifact.seed < 0 ||
        artifact.seed > 0xffffffff ||
        !Array.isArray(artifact.actions) ||
        artifact.actions.some((action) => typeof action !== "string")
      )
        throw new Error("Invalid interaction replay");
      env.ALCHEMY_INTERACTION_TIER = artifact.tier === "nightly" ? "nightly" : "push";
      env.ALCHEMY_INTERACTION_FAMILY = artifact.family;
      env.ALCHEMY_INTERACTION_SEED = String(artifact.seed);
      env.ALCHEMY_INTERACTION_ACTIONS = JSON.stringify(artifact.actions);
    } else if (flag === "--family" && families.includes(value)) env.ALCHEMY_INTERACTION_FAMILY = value;
    else if (flag === "--seed" && /^\d+$/u.test(value) && Number(value) <= 0xffffffff)
      env.ALCHEMY_INTERACTION_SEED = value;
    else if (flag === "--tier" && ["push", "nightly"].includes(value)) env.ALCHEMY_INTERACTION_TIER = value;
    else if (flag === "--day" && /^\d{4}-\d{2}-\d{2}$/u.test(value) && !Number.isNaN(Date.parse(value)))
      env.ALCHEMY_INTERACTION_DAY = value;
    else throw new Error(`Unknown option or invalid value: ${flag} ${value}`);
  }
  const result = runStreamCommand(
    process.execPath,
    [
      "scripts/run-compact.mjs",
      "vitest",
      "run",
      env.ALCHEMY_INTERACTION_FAMILY
        ? `tests/interaction/${env.ALCHEMY_INTERACTION_FAMILY}.dom.test`
        : "tests/interaction",
      "--maxWorkers=1",
    ],
    { cwd: REPO_ROOT, env },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
