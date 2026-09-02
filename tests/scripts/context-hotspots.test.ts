import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  aggregateCommandExposures,
  buildContextHotspotReport,
  formatContextHotspotReport,
  parseContextHotspotArgs,
} from "../../scripts/context-hotspots.mjs";
import { writeCurrentRun } from "../../scripts/lib/current-run.mjs";

describe("context hotspot reporting", () => {
  it("parses bounded history and output thresholds", () => {
    expect(parseContextHotspotArgs(["--last", "4", "--min-bytes=250", "--json", "--check"])).toEqual({
      last: 4,
      minBytes: 250,
      json: true,
      check: true,
    });
    expect(() => parseContextHotspotArgs(["--last", "0"])).toThrow("--last must be a positive integer");
  });

  it("ranks repeated commands by raw output and reports avoided exposure", () => {
    const commands = aggregateCommandExposures(
      [
        {
          commandExposures: [
            { key: "lint", label: "lint", status: 0, rawBytes: 8_000, exposedBytes: 0, rawLines: 100 },
            { key: "test", label: "test", status: 1, rawBytes: 2_000, exposedBytes: 1_000, rawLines: 20 },
          ],
        },
        {
          commandExposures: [
            { key: "lint", label: "lint", status: 1, rawBytes: 4_000, exposedBytes: 2_000, rawLines: 50 },
          ],
        },
      ],
      1_000,
    );
    expect(commands.map((command) => command.key)).toEqual(["lint", "test"]);
    expect(commands[0]).toMatchObject({
      occurrences: 2,
      failures: 1,
      rawBytes: 12_000,
      exposedBytes: 2_000,
      maxRawBytes: 8_000,
      maxExposedBytes: 2_000,
      overBudgetOccurrences: 0,
      avoidedPercent: 83.3,
    });
  });

  it("reads persisted run exposure records into the combined report", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "context-hotspots-"));
    try {
      writeCurrentRun({
        rootDir: root,
        runId: "fixture",
        status: "passed",
        command: "verify",
        sourceDigest: "abc123",
        steps: [
          { label: "verification", status: "passed", durationMs: 100 },
          { label: "build", status: "skipped", durationMs: 0, reason: "documentation-only change" },
        ],
        commandExposures: [
          {
            key: "typecheck",
            label: "TypeScript",
            command: "npm run typecheck",
            status: 0,
            rawBytes: 5_000,
            rawLines: 50,
            exposedBytes: 0,
            exposedLines: 0,
            omittedBytes: 5_000,
            omittedPercent: 100,
            durationMs: 100,
          },
        ],
      });
      const report = buildContextHotspotReport(root, { last: 5, minBytes: 1 });
      const record = JSON.parse(fs.readFileSync(path.join(root, "reports/runs/fixture/run.json"), "utf8"));
      expect(record).toMatchObject({
        sourceDigest: "abc123",
        steps: [
          { label: "verification", status: "passed", durationMs: 100 },
          { label: "build", status: "skipped", reason: "documentation-only change" },
        ],
      });
      expect(report.inspectedRuns).toBe(1);
      expect(report.commands[0]).toMatchObject({ key: "typecheck", rawBytes: 5_000, avoidedPercent: 100 });
      expect(formatContextHotspotReport(report)).toContain("TypeScript: 5,000 B raw / 0 B exposed");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
