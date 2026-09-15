#!/usr/bin/env node
/** Validate the short-lived execution-plan contract under docs/Plans/. */
import { checkPlans, parsePlanMetadata, planFiles, reportPlanChecks } from "./lib/plan-checks.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

export { checkPlans, parsePlanMetadata, planFiles, reportPlanChecks };

function main(argv = process.argv.slice(2)) {
  const flags = new Set(argv);
  if (flags.has("--help") || flags.has("-h")) {
    console.log("Usage: npm run plans:check [-- --final]");
    return 0;
  }
  const unknown = [...flags].filter((flag) => flag !== "--final");
  if (unknown.length > 0) {
    console.error(`Unknown argument(s): ${unknown.join(", ")}`);
    return 2;
  }
  return reportPlanChecks({ final: flags.has("--final") }) ? 0 : 1;
}

if (isMainModule(import.meta.url)) {
  process.exitCode = main();
}
