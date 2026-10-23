#!/usr/bin/env node
import { testResourceStatus } from "./lib/verification/local-test-lane.mjs";
import { defineScript, UsageError } from "./lib/script-run.mjs";

defineScript(import.meta.url, () => {
  const args = process.argv.slice(2);
  if (args.length && !(args.length === 1 && args[0] === "--json"))
    throw new UsageError("Usage: npm run test:status -- [--json]");
  const records = testResourceStatus();
  if (args[0] === "--json") console.log(JSON.stringify(records, null, 2));
  else {
    console.log(
      "Budget: one broad test run plus one focused unit run (one worker). Raw/watch commands are outside this budget.",
    );
    for (const record of records)
      console.log(
        `${record.state} ${record.kind} pid=${record.pid} port=${record.port} since=${record.since} cwd=${record.cwd}\n  ${record.command.join(" ").slice(0, 240)}${record.command.join(" ").length > 240 ? "… (use --json for full arguments)" : ""}`,
      );
    if (!records.length) console.log("No managed tests active or waiting.");
  }
});
