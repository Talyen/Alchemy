import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ensureRunId, normalizeRunId } from "./current-run.mjs";

export const MAX_DIAGNOSTIC_BYTES = 16 * 1024;
const MAX_LOG_ENTRIES = 40;
const MAX_LOG_BYTES = 5 * 1024;
const MAX_MESSAGE_BYTES = 1_000;
const MAX_CONTEXT_BYTES = 8 * 1024;

function truncateUtf8(value, maxBytes) {
  if (Buffer.byteLength(value, "utf8") <= maxBytes) return value;
  let low = 0;
  let high = value.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (Buffer.byteLength(value.slice(0, middle), "utf8") <= maxBytes) low = middle;
    else high = middle - 1;
  }
  return value.slice(0, low);
}

function normalizedFile(rootDir, file) {
  const relative = path.relative(rootDir, path.resolve(rootDir, file)).replaceAll(path.sep, "/");
  return relative.startsWith("../") ? path.basename(file) : relative;
}

export function diagnosticIdentity({ rootDir = process.cwd(), file, line = 0, project = "unknown", title }) {
  const relativeFile = normalizedFile(rootDir, file);
  const key = `${relativeFile}:${line}:${project}:${title}`;
  const hash = createHash("sha256").update(key).digest("hex").slice(0, 10);
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 48);
  return { id: `${slug || "failure"}-${hash}`, file: relativeFile, line, project, title };
}

export function failureDigestRelativePath(runId, diagnosticId) {
  const normalizedRunId = normalizeRunId(runId);
  if (!normalizedRunId) throw new Error("failureDigestRelativePath requires a valid runId");
  return `test-results/failures/${normalizedRunId}/${diagnosticId}.md`;
}

function boundedLogs(logs) {
  const selected = logs.slice(-MAX_LOG_ENTRIES).map((message) => truncateUtf8(String(message), MAX_MESSAGE_BYTES));
  const kept = [];
  let bytes = 0;
  for (let index = selected.length - 1; index >= 0; index -= 1) {
    const line = `- ${selected[index]}`;
    const lineBytes = Buffer.byteLength(`${line}\n`, "utf8");
    if (bytes + lineBytes > MAX_LOG_BYTES) break;
    kept.unshift(line);
    bytes += lineBytes;
  }
  return { lines: kept, omitted: logs.length - kept.length };
}

export function buildFailureDiagnostic(input, options = {}) {
  const maxBytes = options.maxBytes ?? MAX_DIAGNOSTIC_BYTES;
  const runId = normalizeRunId(input.runId ?? ensureRunId("playwright"));
  const identity = diagnosticIdentity(input);
  const logs = boundedLogs(input.logs ?? []);
  const errorMessage = truncateUtf8(input.errorMessage || "No Playwright assertion error captured.", 2_000);
  const core = [
    `# E2E failure: ${truncateUtf8(input.title, 300)}`,
    "",
    `- Status: ${input.status}`,
    `- Duration: ${input.duration}ms`,
    `- URL: ${truncateUtf8(input.url || "unknown", 1_000)}`,
    `- File: ${identity.file}:${identity.line}`,
    `- Project: ${identity.project}`,
    `- Run: ${runId}`,
    `- Diagnostic id: ${identity.id}`,
    "",
    "## Playwright error",
    "",
    "```text",
    errorMessage.replaceAll("```", "``\u200b`"),
    "```",
    "",
    "## Console and page errors",
    "",
    ...(logs.lines.length > 0 ? logs.lines : ["- None captured"]),
    ...(logs.omitted > 0 ? [`- _${logs.omitted} earlier entries omitted_`] : []),
    "",
    `## ${input.accessibilitySnapshot ? "Accessibility snapshot" : "HTML fallback"}`,
    "",
  ].join("\n");
  const contextKind = input.accessibilitySnapshot ? "accessibility" : "html-fallback";
  const context = input.accessibilitySnapshot || input.htmlFallback || "Failure context was unavailable.";
  const language = contextKind === "accessibility" ? "yaml" : "html";
  const footer = "\n````\n";
  const availableBytes = Math.max(0, maxBytes - Buffer.byteLength(core + `\`\`\`\`${language}\n` + footer, "utf8"));
  const contextBudget = Math.min(MAX_CONTEXT_BYTES, availableBytes);
  const excerpt = truncateUtf8(context, contextBudget);
  const omittedContextBytes = Math.max(0, Buffer.byteLength(context, "utf8") - Buffer.byteLength(excerpt, "utf8"));
  const suffix = omittedContextBytes > 0 ? `\n_${omittedContextBytes} context bytes omitted._\n` : "";
  const suffixBytes = Buffer.byteLength(suffix, "utf8");
  const adjustedExcerpt = suffixBytes > 0 ? truncateUtf8(excerpt, Math.max(0, contextBudget - suffixBytes)) : excerpt;
  const markdown = `${core}\n\`\`\`\`${language}\n${adjustedExcerpt}${footer}${suffix}`;
  return {
    runId,
    identity,
    markdown: truncateUtf8(markdown, maxBytes),
    omittedLogs: logs.omitted,
    omittedContextBytes: Math.max(0, Buffer.byteLength(context, "utf8") - Buffer.byteLength(adjustedExcerpt, "utf8")),
    contextKind,
  };
}

export function writeFailureDiagnostic(rootDir, diagnostic) {
  const failuresDir = path.join(rootDir, "test-results", "failures", diagnostic.runId);
  fs.mkdirSync(failuresDir, { recursive: true });
  const digestPath = path.join(failuresDir, `${diagnostic.identity.id}.md`);
  const recordPath = path.join(failuresDir, `${diagnostic.identity.id}.failure.json`);
  const relativeDigest = failureDigestRelativePath(diagnostic.runId, diagnostic.identity.id);
  fs.writeFileSync(digestPath, diagnostic.markdown, "utf8");
  fs.writeFileSync(
    recordPath,
    `${JSON.stringify(
      {
        ...diagnostic.identity,
        runId: diagnostic.runId,
        digestPath: relativeDigest,
        bytes: Buffer.byteLength(diagnostic.markdown, "utf8"),
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  writeFailureIndex(rootDir, diagnostic.runId);
  return { digestPath, recordPath };
}

export function writeFailureIndex(rootDir, runId = ensureRunId("playwright")) {
  const normalizedRunId = normalizeRunId(runId);
  const failuresDir = path.join(rootDir, "test-results", "failures", normalizedRunId);
  fs.mkdirSync(failuresDir, { recursive: true });
  const failures = fs
    .readdirSync(failuresDir)
    .filter((name) => name.endsWith(".failure.json"))
    .flatMap((name) => {
      try {
        return [JSON.parse(fs.readFileSync(path.join(failuresDir, name), "utf8"))];
      } catch {
        return [];
      }
    })
    .sort((a, b) => String(a.generatedAt).localeCompare(String(b.generatedAt)));
  const indexPath = path.join(failuresDir, "index.json");
  const temporaryPath = `${indexPath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify({ runId: normalizedRunId, failures }, null, 2)}\n`, "utf8");
  fs.renameSync(temporaryPath, indexPath);
  return { indexPath, failures };
}
