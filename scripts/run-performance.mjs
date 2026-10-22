#!/usr/bin/env node
import { defineScript } from "./lib/script-run.mjs";
import { runPerformance } from "./lib/performance/performance-runner.mjs";
export { parsePerformanceArgs } from "./lib/performance/performance-runner.mjs";

defineScript(
  import.meta.url,
  () =>
    runPerformance().catch((error) => {
      console.error(error.message);
      return 2;
    }),
  { artifacts: true },
);
