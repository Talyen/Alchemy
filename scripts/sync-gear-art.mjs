import { isMainModule } from "./lib/is-main-module.mjs";
import { syncGearArt } from "./sync-generated.mjs";

export { syncGearArt } from "./sync-generated.mjs";

if (isMainModule(import.meta.url)) {
  syncGearArt({ check: process.argv.includes("--check") }).catch((error) => {
    console.error("Gear art sync failed.");
    console.error(error);
    process.exitCode = 1;
  });
}
