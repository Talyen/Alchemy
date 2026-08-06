// Vercel / CI web entry: typecheck + vite build with committed assets (skip prep).
import { spawnSync } from "node:child_process";
import { isMainModule } from "./lib/is-main-module.mjs";

/**
 * @param {string} script
 */
function runNpm(script) {
  const result = spawnSync("npm", ["run", script], {
    stdio: "inherit",
    env: { ...process.env, ALCHEMY_SKIP_ASSETS: "1" },
    shell: true,
  });
  if (result.error) throw result.error;
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}

if (isMainModule(import.meta.url)) {
  runNpm("typecheck");
  runNpm("build");
}
