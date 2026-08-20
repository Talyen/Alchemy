import fs from "node:fs";
import path from "node:path";

/**
 * Return the first useful line from a child-process stream.
 * @param {string} output
 * @returns {string}
 */
export function firstOutputLine(output) {
  return (
    output
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .find(Boolean) ?? "(no diagnostic output)"
  );
}

/**
 * Keep the end of a child-process stream, where compilers and test runners
 * usually place the actionable failure summary.
 * @param {string} output
 * @param {number} [maxChars]
 * @returns {string}
 */
export function tailOutput(output, maxChars = 4_000) {
  const normalized = output.trim();
  if (normalized.length <= maxChars) return normalized;
  return `[...${normalized.length - maxChars} chars omitted...]\n${normalized.slice(-maxChars)}`;
}

/**
 * Persist the complete stream only when a caller explicitly asks for it or a
 * command fails. The path is intentionally under reports/, which is already
 * treated as diagnostic evidence rather than default agent context.
 * @param {string} reportsDir
 * @param {string} name
 * @param {string} output
 * @returns {string}
 */
export function writeDiagnosticLog(reportsDir, name, output) {
  fs.mkdirSync(reportsDir, { recursive: true });
  const filePath = path.join(reportsDir, `${name}.log`);
  fs.writeFileSync(filePath, output, "utf8");
  return filePath;
}
