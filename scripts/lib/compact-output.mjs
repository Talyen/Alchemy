import fs from "node:fs";
import path from "node:path";

const ANSI_PATTERN = new RegExp(String.raw`\u001B(?:[@-_][0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001B\\))`, "gu");

// eslint-disable-next-line no-control-regex
const NON_PRINTABLE_PATTERN = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/gu;
export const ROUTINE_EXPOSURE_BUDGET_BYTES = 4_096;

export function sanitizeOutput(output) {
  return output.replace(ANSI_PATTERN, "").replace(NON_PRINTABLE_PATTERN, "");
}

export function outputStats(output) {
  const normalized = sanitizeOutput(String(output ?? ""));
  return {
    bytes: Buffer.byteLength(normalized, "utf8"),
    lines: normalized.length === 0 ? 0 : normalized.split(/\r?\n/u).length,
  };
}

/** Build the compact exposure record persisted with a report-producing run. */
export function commandExposure({
  key,
  label,
  command,
  result,
  exposedOutput = "",
  budgetBytes = ROUTINE_EXPOSURE_BUDGET_BYTES,
}) {
  const raw = outputStats(result?.output);
  const exposed = outputStats(exposedOutput);
  const omittedBytes = Math.max(0, raw.bytes - exposed.bytes);
  const normalizedBudget = budgetBytes == null ? null : Math.max(0, Number(budgetBytes) || 0);
  return {
    key: String(key || command || "command"),
    label: String(label || key || command || "command"),
    command: String(command || "unknown"),
    status: Number.isInteger(result?.status) ? result.status : null,
    durationMs: Math.max(0, Math.round(Number(result?.elapsedMs) || 0)),
    rawBytes: raw.bytes,
    rawLines: raw.lines,
    exposedBytes: exposed.bytes,
    exposedLines: exposed.lines,
    omittedBytes,
    omittedPercent: raw.bytes === 0 ? 0 : Math.round((omittedBytes / raw.bytes) * 1_000) / 10,
    budgetBytes: normalizedBudget,
    overBudget: normalizedBudget !== null && exposed.bytes > normalizedBudget,
  };
}

/**
 * Return the first useful line from a child-process stream.
 * @param {string} output
 * @returns {string}
 */
export function firstOutputLine(output) {
  return (
    sanitizeOutput(output)
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .find(Boolean) ?? "(no diagnostic output)"
  );
}

/**
 * Keep the end of a child-process stream, where compilers and test runners
 * usually place the actionable failure summary.
 * @param {string} output
 * @param {number} [maxBytes]
 * @returns {string}
 */
export function tailOutput(output, maxBytes = 4_000) {
  const normalized = sanitizeOutput(output).trim();
  const rawBytes = Buffer.byteLength(normalized, "utf8");
  if (rawBytes <= maxBytes) return normalized;
  let prefix = `[...${rawBytes} bytes omitted...]\n`;
  let suffix = "";
  for (let pass = 0; pass < 2; pass += 1) {
    let remaining = Math.max(0, maxBytes - Buffer.byteLength(prefix, "utf8"));
    const codePoints = Array.from(normalized);
    let start = codePoints.length;
    while (start > 0) {
      const bytes = Buffer.byteLength(codePoints[start - 1], "utf8");
      if (bytes > remaining) break;
      remaining -= bytes;
      start -= 1;
    }
    suffix = codePoints.slice(start).join("");
    prefix = `[...${rawBytes - Buffer.byteLength(suffix, "utf8")} bytes omitted...]\n`;
  }
  return `${prefix}${suffix}`;
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
