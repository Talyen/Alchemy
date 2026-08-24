#!/usr/bin/env node
/** Run repository-wide documentation contracts plus active-plan validation. */
import { reportDocumentationContracts } from "./check-documentation-contract.mjs";
import { reportPlanChecks } from "./check-plans.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

function main(argv = process.argv.slice(2)) {
  const flags = new Set(argv);
  if (flags.has("--help") || flags.has("-h")) {
    console.log("Usage: npm run docs:check [-- --final]");
    return 0;
  }
  const unknown = [...flags].filter((flag) => flag !== "--final");
  if (unknown.length > 0) {
    console.error(`Unknown argument(s): ${unknown.join(", ")}`);
    return 2;
  }

  const documentationPassed = reportDocumentationContracts();
  const plansPassed = reportPlanChecks({ final: flags.has("--final") });
  return documentationPassed && plansPassed ? 0 : 1;
}

if (isMainModule(import.meta.url)) {
  process.exitCode = main();
}
