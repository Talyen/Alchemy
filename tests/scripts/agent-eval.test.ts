import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compareEvaluations, summarizeEvaluation } from "../../scripts/agent-eval.mjs";
import { readExposure, recordAgentEvent } from "../../scripts/lib/agent-events.mjs";

const record = {
  task: "ui-button-default",
  taskVersion: 1,
  baseRevision: "a".repeat(40),
  variant: "before",
  model: "fixed-model",
  settings: { capture: "same", reasoning: "same" },
  correctness: { passed: true, evidence: ["review and test result"] },
};

describe("completed-task efficiency evidence", () => {
  it("counts only observed repetition and leaves unavailable host usage unknown", () => {
    const read = readExposure({ path: "owner.ts", start: 1, end: 2, text: "same" });
    expect(
      summarizeEvaluation(record, [
        read,
        read,
        { ...read, contentHash: "changed" },
        { kind: "verification", command: "test", status: "failed" },
        { kind: "verification", command: "test", status: "passed" },
        { kind: "verification", command: "test", status: "reused" },
      ]),
    ).toMatchObject({
      observedReads: 3,
      repeatedReadBytes: 4,
      observedReadBytes: 12,
      verificationAttempts: 2,
      verificationRetries: 1,
      verificationReuses: 1,
      inputTokens: null,
      toolCalls: null,
    });
  });

  it("compares compatible trials only and gates conclusions on correctness evidence", () => {
    const before = summarizeEvaluation({ ...record, usage: { inputTokens: 100 } }, []);
    const after = summarizeEvaluation({ ...record, variant: "after", usage: { inputTokens: 75 } }, []);
    expect(compareEvaluations(before, after)).toMatchObject({
      comparableCorrectness: true,
      deltaAfterMinusBefore: { inputTokens: -25, outputTokens: null },
    });
    expect(() => compareEvaluations(before, { ...after, model: "different" })).toThrow("matching model");
    expect(compareEvaluations(before, { ...after, correctness: null }).comparableCorrectness).toBe(false);
    expect(() => summarizeEvaluation({ ...record, usage: { inputTokens: -1 } }, [])).toThrow("Invalid usage");
  });

  it("records opt-in events without source text and rejects path traversal", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-events-"));
    try {
      const event = readExposure({ path: "owner.ts", start: 1, end: 1, text: "source text" });
      recordAgentEvent(root, event, {});
      expect(fs.readdirSync(root)).toEqual([]);
      recordAgentEvent(root, event, { ALCHEMY_AGENT_SESSION: "one" });
      const contents = fs.readFileSync(path.join(root, "reports/agent-evals/one/events.jsonl"), "utf8");
      expect(contents).not.toContain("source text");
      expect(JSON.parse(contents)).toMatchObject({ kind: "read", path: "owner.ts", bytes: 11 });
      expect(() => recordAgentEvent(root, event, { ALCHEMY_AGENT_SESSION: "../escape" })).toThrow("Invalid");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("pins every task to an existing immutable baseline and a concrete prompt", () => {
    const catalog = JSON.parse(fs.readFileSync(".agents/evals/tasks.json", "utf8"));
    expect(catalog.baseRevision).toMatch(/^[a-f0-9]{40}$/u);
    expect(Object.keys(catalog.tasks)).toHaveLength(5);
    for (const file of Object.values(catalog.tasks) as string[]) {
      const source = fs.readFileSync(file, "utf8");
      expect(source).toContain("## Exact request");
      expect(source).toContain("## Acceptance");
      expect(source).not.toMatch(/unit-battle|unit-shop/u);
    }
  });
});

it("measures overlapping unchanged lines separately from exact repeated excerpts and discovery failures", () => {
  const result = summarizeEvaluation(record, [
    readExposure({ path: "owner.ts", start: 1, end: 2, text: "one\ntwo" }),
    readExposure({ path: "owner.ts", start: 2, end: 3, text: "two\nthree" }),
    readExposure({ path: "owner.ts", start: 2, end: 2, text: "changed" }),
    { kind: "discovery", operation: "search", status: "not-found", truncated: false },
    { kind: "discovery", operation: "outline", status: "failed", truncated: false },
    { kind: "discovery", operation: "context", status: "found", truncated: true },
    { kind: "diagnostic", command: "test", inputHash: "same", status: "failed" },
    { kind: "diagnostic", command: "test", inputHash: "same", status: "failed" },
    { kind: "diagnostic", command: "test", inputHash: "changed", status: "passed" },
  ]);
  expect(result).toMatchObject({
    repeatedReadBytes: 0,
    overlappingReadBytes: 3,
    observedLineBytes: 21,
    discoveryAttempts: 3,
    failedLookups: 1,
    discoveryErrors: 1,
    truncatedDiscoveries: 1,
    diagnosticReruns: 1,
    inputTokens: null,
  });
});

it("invalidates overlap on legacy reads without iterating unobserved line ranges", () => {
  const first = readExposure({ path: "owner.ts", start: 2, end: 2, text: "two" });
  const legacy = { kind: "read", path: "owner.ts", start: 1, end: 1_000_000_000, contentHash: "legacy", bytes: 4 };
  expect(summarizeEvaluation(record, [first, legacy, first])).toMatchObject({
    overlappingReadBytes: 0,
    observedLineBytes: 6,
  });
});
