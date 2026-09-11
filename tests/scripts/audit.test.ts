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
      forwardedArgs: [],
    });
  });

  it("accepts each known option", () => {
    expect(parseAuditArgs(["--all"]).hasAll).toBe(true);
    expect(parseAuditArgs(["--types"]).hasTypes).toBe(true);
    expect(parseAuditArgs(["--amplification"]).hasAmplification).toBe(true);
    expect(parseAuditArgs(["--content"]).hasContent).toBe(true);
    expect(parseAuditArgs(["--hotspots"]).hasHotspots).toBe(true);
  });

  it("forwards recognized child probe options", () => {
    expect(parseAuditArgs(["--all", "--verbose"]).forwardedArgs).toEqual(["--verbose"]);
    expect(parseAuditArgs(["--hotspots", "--json"]).forwardedArgs).toEqual(["--json"]);
    expect(parseAuditArgs(["--hotspots", "--last", "10"]).forwardedArgs).toEqual(["--last", "10"]);
    expect(parseAuditArgs(["--hotspots", "--last=10"]).forwardedArgs).toEqual(["--last=10"]);
    expect(parseAuditArgs(["--hotspots", "--run-id", "xyz"]).forwardedArgs).toEqual(["--run-id", "xyz"]);
    expect(parseAuditArgs(["--hotspots", "--", "--custom-flag"]).forwardedArgs).toEqual(["--custom-flag"]);
  });

  it("allows help flags through for the caller to handle", () => {
    expect(parseAuditArgs(["--help"])).toEqual(parseAuditArgs([]));
    expect(parseAuditArgs(["-h"])).toEqual(parseAuditArgs([]));
  });

  it("rejects conflicting selections", () => {
    expect(() => parseAuditArgs(["--all", "--types"])).toThrow("--all cannot be combined");
    expect(() => parseAuditArgs(["--all", "--hotspots"])).toThrow("--all cannot be combined");
    expect(() => parseAuditArgs(["--types", "--content"])).toThrow("choose only one");
  });

  it("rejects unknown options and stray arguments", () => {
    expect(() => parseAuditArgs(["--bogus"])).toThrow("Unknown option or argument: --bogus");
    expect(() => parseAuditArgs(["types"])).toThrow("Unknown option or argument: types");
  });

  it("routes the default and each focused audit to its implementation", () => {
    expect(resolveAuditScript(parseAuditArgs([]))).toBe("scripts/audit-all.mjs");
    expect(resolveAuditScript(parseAuditArgs(["--verbose"]))).toBe("scripts/audit-all.mjs");
    expect(resolveAuditScript(parseAuditArgs(["--all"]))).toBe("scripts/audit-all.mjs");
    expect(resolveAuditScript(parseAuditArgs(["--types"]))).toBe("scripts/audit-type-escapes.mjs");
    expect(resolveAuditScript(parseAuditArgs(["--amplification"]))).toBe("scripts/audit-change-amplification.mjs");
    expect(resolveAuditScript(parseAuditArgs(["--content"]))).toBe("scripts/content-audit.mjs");
    expect(resolveAuditScript(parseAuditArgs(["--hotspots"]))).toBe("scripts/context-hotspots.mjs");
  });

  it("keeps npm audit argument forwarding compatible with focused audits", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.audit).toBe("node scripts/audit.mjs");
  });
});
