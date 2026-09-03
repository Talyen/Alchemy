import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";

describe("rng canonical doors", () => {
  it("has no remaining @/lib/run-rng imports", () => {
    const hits = execSync(
      'rg -l "from [\\"\\\']@/lib/run-rng[\\"\\\']|from [\\"\\\']\\.\\./run-rng[\\"\\\']" src tests | rg -v "tests/architecture/rng-canonical-doors" || true',
      { encoding: "utf8" },
    ).trim();
    expect(hits).toBe("");
  });

  it("keeps battle on the @/lib/rng door", () => {
    const hits = execSync('rg -n "from \\"\\.\\./rng\\"|from \\"\\.\\./\\.\\./rng\\"" src/lib/battle || true', {
      encoding: "utf8",
    }).trim();
    expect(hits).toBe("");
  });
});
