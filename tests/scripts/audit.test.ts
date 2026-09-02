import { describe, expect, it } from "vitest";

import { parseAuditArgs } from "../../scripts/audit.mjs";

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
    expect(() => parseAuditArgs(["--all", "--types"])).toThrow("--all cannot be combined");
    expect(() => parseAuditArgs(["--types", "--content"])).toThrow("choose only one");
  });

  it("rejects unknown options and stray arguments", () => {
    expect(() => parseAuditArgs(["--bogus"])).toThrow("Unknown option or argument: --bogus");
    expect(() => parseAuditArgs(["types"])).toThrow("Unknown option or argument: types");
  });
});
