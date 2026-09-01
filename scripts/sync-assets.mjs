import { isMainModule } from "./lib/is-main-module.mjs";
import { syncAssets } from "./sync-generated.mjs";

export { syncAssets } from "./sync-generated.mjs";

if (isMainModule(import.meta.url)) {
  syncAssets({ check: process.argv.includes("--check") }).catch((error) => {
    console.error("Failed to sync assets:", error);
    process.exitCode = 1;
  });
}
