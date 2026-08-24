import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkCiRouting, checkDiagnosticRetention, checkJobBoundaries } from "../../scripts/check-ci-routing.mjs";

const root = path.resolve(__dirname, "../..");

describe("CI routing contract", () => {
  it("keeps high-cost path filters present in the workflow", () => {
    const source = fs.readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
    expect(checkCiRouting(source)).toEqual([]);
  });

  it("identifies a removed filter marker", () => {
    expect(checkCiRouting("save:\n")).toContain('save-gate: missing "src/lib/validation/**"');
  });

  it("keeps gated job dependencies explicit", () => {
    const source = fs.readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
    expect(checkJobBoundaries(source)).toEqual([]);
    expect(checkJobBoundaries("  save-gate:\n    runs-on: ubuntu-latest\n")).toContain(
      "save-gate: missing needs dependency changes",
    );
  });

  it("requires failure-only seven-day diagnostic uploads with current and run-specific records", () => {
    const source = fs.readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
    expect(checkDiagnosticRetention({ "ci.yml": source })).toEqual([]);
    expect(
      checkDiagnosticRetention({ "ci.yml": "  - uses: actions/upload-artifact@v7\n    name: vitest-timings\n" }),
    ).toHaveLength(4);
  });
});
