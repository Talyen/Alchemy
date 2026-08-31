#!/usr/bin/env node
import { publishPlaywright, DEFAULT_PLAYWRIGHT_REPORT } from "./ci-summarize.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

function main() {
  publishPlaywright(process.argv[2] ?? DEFAULT_PLAYWRIGHT_REPORT);
}

if (isMainModule(import.meta.url)) main();

export { publishPlaywright };
