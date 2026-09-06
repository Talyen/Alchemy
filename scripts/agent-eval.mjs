#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { isMainModule } from "./lib/is-main-module.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const METRICS = [
  "inputTokens",
  "cachedInputTokens",
  "outputTokens",
  "toolCalls",
  "observedReads",
  "repeatedReadBytes",
  "observedReadBytes",
  "verificationAttempts",
  "verificationRetries",
  "verificationReuses",
];

export function summarizeEvaluation(record, events) {
  if (
    !record.task ||
    !/^[0-9a-f]{40}$/u.test(record.baseRevision ?? "") ||
    !record.variant ||
    !Number.isSafeInteger(record.taskVersion) ||
    record.taskVersion < 1
  )
    throw new Error("Evaluation requires task, taskVersion, full baseRevision and variant");
  if (
    record.correctness != null &&
    (typeof record.correctness.passed !== "boolean" ||
      !Array.isArray(record.correctness.evidence) ||
      record.correctness.evidence.some((item) => typeof item !== "string" || !item.trim()))
  )
    throw new Error("Correctness requires passed and an evidence array");
  const reads = new Set();
  const failed = new Set();
  const result = {
    task: record.task,
    taskVersion: record.taskVersion,
    baseRevision: record.baseRevision,
    variant: record.variant,
    model: record.model ?? null,
    settings: record.settings ?? null,
    correctness: record.correctness ?? null,
    inputTokens: null,
    cachedInputTokens: null,
    outputTokens: null,
    toolCalls: null,
    observedReads: 0,
    repeatedReadBytes: 0,
    observedReadBytes: 0,
    verificationAttempts: 0,
    verificationRetries: 0,
    verificationReuses: 0,
  };
  for (const field of ["inputTokens", "cachedInputTokens", "outputTokens", "toolCalls"]) {
    const value = record.usage?.[field];
    if (value != null && (!Number.isSafeInteger(value) || value < 0)) throw new Error(`Invalid usage.${field}`);
    result[field] = value ?? null;
  }
  if (result.cachedInputTokens != null && result.inputTokens != null && result.cachedInputTokens > result.inputTokens)
    throw new Error("Cached input tokens cannot exceed total input tokens");
  for (const event of events) {
    if (event.kind === "read") {
      if (
        !event.path ||
        !event.contentHash ||
        !Number.isInteger(event.start) ||
        !Number.isInteger(event.end) ||
        event.start < 1 ||
        event.end < event.start ||
        !Number.isSafeInteger(event.bytes) ||
        event.bytes < 0
      )
        throw new Error("Invalid read event");
      const key = JSON.stringify([event.path, event.start, event.end, event.contentHash]);
      result.observedReads++;
      result.observedReadBytes += event.bytes;
      if (reads.has(key)) result.repeatedReadBytes += event.bytes;
      reads.add(key);
    } else if (event.kind === "verification") {
      if (!event.command || !["passed", "failed", "reused"].includes(event.status))
        throw new Error("Invalid verification event");
      if (event.status === "reused") {
        result.verificationReuses++;
        continue;
      }
      result.verificationAttempts++;
      if (failed.has(event.command)) result.verificationRetries++;
      if (event.status === "failed") failed.add(event.command);
      else failed.delete(event.command);
    } else throw new Error(`Unknown event kind: ${event.kind}`);
  }
  return result;
}

export function compareEvaluations(before, after) {
  for (const key of ["task", "taskVersion", "baseRevision", "model", "settings"]) {
    if (before[key] == null || JSON.stringify(before[key]) !== JSON.stringify(after[key]))
      throw new Error(`Comparison requires matching ${key}`);
  }
  if (before.variant === after.variant) throw new Error("Comparison requires different variants");
  const passed = [before, after].every(
    (record) => record.correctness?.passed === true && record.correctness.evidence?.length > 0,
  );
  return {
    task: before.task,
    comparableCorrectness: passed,
    conclusion: passed
      ? "Compare costs only alongside the recorded acceptance evidence; repeat trials before claiming a reliable improvement."
      : "No efficiency conclusion: both variants need passing acceptance evidence.",
    deltaAfterMinusBefore: Object.fromEntries(
      METRICS.map((key) => [key, before[key] == null || after[key] == null ? null : after[key] - before[key]]),
    ),
  };
}

export function loadEvaluation(filename) {
  const record = JSON.parse(fs.readFileSync(filename, "utf8"));
  const eventsFile = path.resolve(path.dirname(filename), record.eventsFile ?? "events.jsonl");
  const events = fs
    .readFileSync(eventsFile, "utf8")
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  return summarizeEvaluation(record, events);
}

export function main(argv = process.argv.slice(2)) {
  try {
    if (argv[0] === "--init" && argv.length === 3) {
      const [, task, session] = argv;
      const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, ".agents/evals/tasks.json"), "utf8"));
      if (!Object.hasOwn(catalog.tasks, task)) throw new Error(`Unknown eval task: ${task}`);
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/u.test(session)) throw new Error("Invalid session id");
      const directory = path.join(ROOT, "reports/agent-evals", session);
      fs.mkdirSync(path.dirname(directory), { recursive: true });
      if (fs.existsSync(directory)) throw new Error("Evaluation session already exists; choose a new session id");
      fs.mkdirSync(directory);
      const filename = path.join(directory, "evaluation.json");
      fs.writeFileSync(
        filename,
        JSON.stringify(
          {
            task,
            taskVersion: catalog.taskVersion,
            baseRevision: catalog.baseRevision,
            variant: session,
            model: null,
            settings: null,
            correctness: null,
            usage: null,
            eventsFile: "events.jsonl",
          },
          null,
          2,
        ) + "\n",
        { flag: "wx" },
      );
      fs.writeFileSync(path.join(directory, "events.jsonl"), "", { flag: "wx" });
      console.log(
        `Record: ${path.relative(ROOT, filename)}\nSet ALCHEMY_AGENT_SESSION=${session} for context and verify commands in this checkout.\nRun the task at base ${catalog.baseRevision}; fill model/settings, acceptance evidence and available host usage before comparison.\nTask: ${catalog.tasks[task]}`,
      );
      return 0;
    }
    if (!argv.length || argv.length > 2 || argv.some((arg) => arg.startsWith("--")))
      throw new Error("Usage: npm run eval:agent -- --init <task> <session> | <record.json> [after.json]");
    const before = loadEvaluation(argv[0]);
    console.log(
      JSON.stringify(argv.length === 2 ? compareEvaluations(before, loadEvaluation(argv[1])) : before, null, 2),
    );
    return 0;
  } catch (error) {
    console.error(error.message);
    return 2;
  }
}

if (isMainModule(import.meta.url)) process.exitCode = main();
