import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseAuditArgs, resolveAuditScript } from "../../scripts/audit.mjs";

const ROOT = process.cwd();

describe("parseAuditArgs", () => {
  it("defaults to no selection", () => {
    expect(parseAuditArgs([])).toEqual({
      hasTypes: false,
      hasAmplification: false,
      hasContent: false,
      hasHotspots: false,
      hasAll: false,
    });
  });

  it("accepts each known option", () => {
    expect(parseAuditArgs(["--all"]).hasAll).toBe(true);
    expect(parseAuditArgs(["--sweep"]).hasAll).toBe(true);
    expect(parseAuditArgs(["--types"]).hasTypes).toBe(true);
    expect(parseAuditArgs(["--amplification"]).hasAmplification).toBe(true);
    expect(parseAuditArgs(["--content"]).hasContent).toBe(true);
    expect(parseAuditArgs(["--hotspots"]).hasHotspots).toBe(true);
  });

  it("allows help flags through for the caller to handle", () => {
    expect(parseAuditArgs(["--help"])).toEqual(parseAuditArgs([]));
    expect(parseAuditArgs(["-h"])).toEqual(parseAuditArgs([]));
  });

  it("rejects conflicting selections", () => {
    expect(() => parseAuditArgs(["--all", "--types"])).toThrow("--all/--sweep cannot be combined");
    expect(() => parseAuditArgs(["--sweep", "--hotspots"])).toThrow("--all/--sweep cannot be combined");
    expect(() => parseAuditArgs(["--types", "--content"])).toThrow("choose only one");
  });

  it("rejects unknown options and stray arguments", () => {
    expect(() => parseAuditArgs(["--bogus"])).toThrow("Unknown option or argument: --bogus");
    expect(() => parseAuditArgs(["types"])).toThrow("Unknown option or argument: types");
  });

  it("routes the default and each focused audit to its implementation", () => {
    expect(resolveAuditScript(parseAuditArgs([]), false)).toBe("scripts/audit-all.mjs");
    expect(resolveAuditScript(parseAuditArgs(["--all"]), true)).toBe("scripts/audit-all.mjs");
    expect(resolveAuditScript(parseAuditArgs(["--types"]), true)).toBe("scripts/audit-type-escapes.mjs");
    expect(resolveAuditScript(parseAuditArgs(["--amplification"]), true)).toBe(
      "scripts/audit-change-amplification.mjs",
    );
    expect(resolveAuditScript(parseAuditArgs(["--content"]), true)).toBe("scripts/content-audit.mjs");
    expect(resolveAuditScript(parseAuditArgs(["--hotspots"]), true)).toBe("scripts/context-hotspots.mjs");
  });

  it("keeps npm audit argument forwarding compatible with focused audits", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.audit).toBe("node scripts/audit.mjs");
  });
});
