import fs from "node:fs";
import { writeCurrentRun } from "./current-run.mjs";

function appendCiSummary(markdown) {
  const output = process.env.GITHUB_STEP_SUMMARY;
  if (output) {
    fs.appendFileSync(output, markdown);
  } else {
    process.stdout.write(markdown);
  }
}

export function publishCiSummary({ rootDir = process.cwd(), markdown, status, command, artifacts, summary }) {
  writeCurrentRun({ rootDir, status, command, artifacts, summary });
  appendCiSummary(`${markdown}\n_Current run: \`reports/current-run.md\`_\n`);
}
