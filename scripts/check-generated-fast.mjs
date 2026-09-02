#!/usr/bin/env node
import { syncGenerated } from "./sync-generated.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

async function checkGeneratedFast() {
  await syncGenerated({ check: true });
  console.log("Fast generated check passed (barrels only, no transform).");
}

if (isMainModule(import.meta.url)) {
  checkGeneratedFast().catch((error) => {
    console.error("Fast generated check failed.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
