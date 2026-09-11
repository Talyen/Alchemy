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

function diagnosticIndexes(lines) {
  const diagnostic =
    /(?:\bFAIL\s|(?:Assertion|Type|Reference|Syntax)?Error:|error TS\d+|\berror\s{2,}|\d+:\d+\s+(?:error|warning)\b|^\s*(?:Expected|Received)|^\s*[−+-]\s+(?:Expected|Received)|\[warn\]|Unused (?:files|exports|dependencies)|Unlisted dependencies)/u;
  const selected = new Set();
  for (const [offset, { text }] of lines.entries()) {
    if (!diagnostic.test(text)) continue;
    if (/\d+:\d+\s+(?:error|warning)\b/u.test(text)) {
      for (let previous = offset - 1; previous >= 0; previous--) {
        if (
          /^(?:\/|[A-Za-z]:[\\/]|(?:src|tests|scripts)\/).*\.[cm]?[jt]sx?$/u.test(
            lines[previous].text.replace(/^(?:\[[^\]]+\]\s*)*/u, "").trim(),
          )
        ) {
          selected.add(previous);
          break;
        }
      }
    }
    for (let nearby = Math.max(0, offset - 1); nearby <= Math.min(lines.length - 1, offset + 10); nearby++)
      selected.add(nearby);
  }
  return [...selected].sort((a, b) => a - b).map((index) => lines[index]);
}

function diagnosticExcerpt(lines, maxBytes) {
  const result = [];
  // Compiler root errors can follow their downstream failures. Give both ends
  // space, then restore source order so log locations remain easy to follow.
  const prioritized = [];
  for (let first = 0, last = lines.length - 1; first <= last; first++, last--) {
    prioritized.push(lines[first]);
    if (first < last) prioritized.push(lines[last]);
  }
  let omitted = 0;
  for (const { text, index } of prioritized) {
    const excerpt =
      Buffer.byteLength(text) > 700 ? Array.from(text).slice(0, 150).join("") + " […line clipped; see full log]" : text;
    const line = `L${index + 1}: ${excerpt}`;
    if (Buffer.byteLength([...result.map((entry) => entry.line), line].join("\n")) <= maxBytes - 100)
      result.push({ index, line });
    else omitted++;
  }
  const output = result.sort((a, b) => a.index - b.index).map((entry) => entry.line);
  if (omitted) output.push(`${omitted} diagnostic lines omitted; see full log.`);
  return output.join("\n");
}

export function failureSummary(output, maxBytes = 4_000) {
  const rawLines = sanitizeOutput(String(output ?? "")).split(/\r?\n/u);
  const groups = new Map();
  for (const [index, raw] of rawLines.entries()) {
    const prefix = /^(?:\[(?!(?:warn|error|info|debug)\])[^\]]+\]\s*)+/iu.exec(raw)?.[0] ?? "";
    const key = prefix.trim().replace(/\]\s+\[/gu, "]/[");
    const group = groups.get(key) ?? { key, lines: [], failed: false };
    const text = raw.slice(prefix.length);
    group.lines.push({ text, index });
    group.failed ||= /exited with code (?!0\b)\S+/u.test(text);
    groups.set(key, group);
  }
  // concurrently reports aggregate exits too. Prefer failed leaf checkers so
  // wrapper failures cannot crowd out the actual diagnostics.
  const failed = [...groups.values()].filter(
    (group) =>
      group.failed &&
      group.key &&
      ![...groups.values()].some((other) => other.failed && other.key.startsWith(group.key + "/")),
  );
  if (!failed.length) {
    const selected = diagnosticIndexes(rawLines.map((text, index) => ({ text, index })));
    return selected.length ? diagnosticExcerpt(selected, maxBytes) : tailOutput(output, maxBytes);
  }
  const headers = failed.map(
    (group) => `Failed ${group.key} (full log L${group.lines[0].index + 1}–L${group.lines.at(-1).index + 1})`,
  );
  const available = maxBytes - Buffer.byteLength(headers.join("\n")) - failed.length * 2;
  if (available < failed.length * 100) return tailOutput(headers.join("\n"), maxBytes);
  const share = Math.floor(available / failed.length);
  return failed
    .map((group, index) => {
      const selected = diagnosticIndexes(group.lines);
      // An exit identifies the failed checker, not its cause. Unknown formats
      // still need both ends of their output rather than just the exit footer.
      return `${headers[index]}\n${diagnosticExcerpt(selected.length ? selected : group.lines, share)}`;
    })
    .join("\n\n");
}

export function writeFailureDigest(directory, command, result, runId, index) {
  fs.mkdirSync(directory, { recursive: true });
  const stem = `${String(index + 1).padStart(2, "0")}-${command.key}`;
  const logPath = writeDiagnosticLog(directory, stem, result.output);
  const digestPath = path.join(directory, `${stem}.md`);
  const excerpt = failureSummary(result.output).replaceAll("```", "``\u200b`");
  fs.writeFileSync(
    digestPath,
    [
      `# Verification failure: ${command.label}`,
      "",
      `- Run: \`${runId}\``,
      `- Full log: ${path.basename(logPath)} (L numbers refer to this log)`,
      `- Command key: \`${command.key}\``,
      `- Exit: \`${result.status ?? "unknown"}\``,
      `- Duration: \`${(result.elapsedMs / 1000).toFixed(1)}s\``,
      "",
      "## Bounded failure output",
      "",
      "```text",
      excerpt,
      "```",
      "",
    ].join("\n"),
    "utf8",
  );
  return { digestPath, logPath };
}
