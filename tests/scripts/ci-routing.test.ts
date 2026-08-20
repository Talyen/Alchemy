import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkCiRouting, checkDiagnosticRetention } from "../../scripts/check-ci-routing.mjs";

const root = path.resolve(__dirname, "../..");

describe("CI routing contract", () => {
  it("keeps high-cost path filters present in the workflow", () => {
    const source = fs.readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
    expect(checkCiRouting(source)).toEqual([]);
  });

  it("identifies a removed filter marker", () => {
    expect(checkCiRouting("save:\n")).toContain('save-gate: missing "src/lib/validation/**"');
  });

  it("requires failure-only seven-day diagnostic uploads with the current-run pointer", () => {
    const source = fs.readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
    expect(checkDiagnosticRetention({ "ci.yml": source })).toEqual([]);
    expect(
      checkDiagnosticRetention({ "ci.yml": "  - uses: actions/upload-artifact@v7\n    name: vitest-timings\n" }),
    ).toHaveLength(3);
  });
});
