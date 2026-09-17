import fs from "node:fs";
import path from "node:path";

/**
 * Shared report-summary model for the Vitest and Playwright CI summaries.
 *
 * Two models share this skeleton on purpose:
 * - `summarize*Report` headers are stats-authoritative: the runner's totals
 *   cover interrupted runs whose suite lists are partial.
 * - `collectPlaywrightTests` is the walked audit model (per-test durations
 *   for slowest-tables). On inconsistent reports its counts can differ from
 *   the header, which is intended — tables reflect parsed tests.
 */
export const MAX_SUMMARY_FAILURES = 5;
const SUMMARY_MESSAGE_CHARS = 240;

/** First display line of a failure message, capped for summaries. */
export function firstSummaryLine(message) {
  return String(message ?? "")
    .split("\n")[0]
    .slice(0, SUMMARY_MESSAGE_CHARS);
}

/**
 * Shared markdown skeleton: `heading`, total lines, runner errors, failures
 * rendered by `renderFailure`, an "…and N more" overflow line, and an empty
 * note. Per-tool adapters own headings, totals, and failure lines so existing
 * report wording never changes implicitly.
 */
export function formatSummaryMarkdown({
  heading,
  totals,
  runnerErrors = [],
  failures = [],
  renderFailure,
  overflowCount = 0,
  emptyNote,
}) {
  const lines = [heading, "", ...totals];
  if (runnerErrors.length > 0)
    lines.push("", "### Runner errors", "", ...runnerErrors.map((message) => `- ${message}`));
  if (failures.length === 0) {
    lines.push("", emptyNote ?? "_Failures present but not listed in JSON._");
    return `${lines.join("\n")}\n`;
  }
  lines.push("", "### Failures", "");
  for (const failure of failures) lines.push(...renderFailure(failure));
  if (overflowCount > 0) lines.push("", `_…and ${overflowCount} more._`);
  return `${lines.join("\n")}\n`;
}

/** Read-and-parse a JSON report file; null when the file is absent. */
export function readJsonReport(reportPath) {
  const resolved = path.resolve(reportPath);
  if (!fs.existsSync(resolved)) return null;
  try {
    return { resolved, data: JSON.parse(fs.readFileSync(resolved, "utf8")) };
  } catch (error) {
    throw new SyntaxError(
      `Invalid JSON in report ${resolved}: ${error instanceof Error ? error.message : String(error)}`,
      {
        cause: error,
      },
    );
  }
}

/** Missing-report markdown shared by file summarizers and CI publishing. */
export function missingReportMarkdown(heading, reportPath) {
  return `${heading}\n\n_No report at \`${reportPath}\`._\n`;
}
