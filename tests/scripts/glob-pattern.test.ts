import { describe, expect, it } from "vitest";
import { globToRegExp } from "../../scripts/lib/glob-pattern.mjs";

describe("globToRegExp", () => {
  it("matches leading **/ patterns for any nesting depth", () => {
    const re = globToRegExp("**/foo.ts");
    expect(re.test("foo.ts")).toBe(true);
    expect(re.test("src/foo.ts")).toBe(true);
    expect(re.test("src/lib/foo.ts")).toBe(true);
    expect(re.test("src/bar.ts")).toBe(false);
  });

  it("matches infix /**/ patterns including zero intermediate directories", () => {
    const re = globToRegExp("tests/**/*.test.ts");
    expect(re.test("tests/foo.test.ts")).toBe(true);
    expect(re.test("tests/lib/foo.test.ts")).toBe(true);
    expect(re.test("tests/lib/deep/foo.test.ts")).toBe(true);
    expect(re.test("other/tests/foo.test.ts")).toBe(false);
    expect(re.test("tests/foo.ts")).toBe(false);
  });

  it("matches trailing /** patterns for root and descendants", () => {
    const re = globToRegExp("Docs/**");
    expect(re.test("Docs")).toBe(true);
    expect(re.test("Docs/Plans")).toBe(true);
    expect(re.test("Docs/Plans/Archived/foo.md")).toBe(true);
    expect(re.test("Other/Docs/foo.md")).toBe(false);
  });

  it("matches single * without crossing path separators", () => {
    const re = globToRegExp("src/*.ts");
    expect(re.test("src/app.ts")).toBe(true);
    expect(re.test("src/lib/app.ts")).toBe(false);
  });

  it("matches ? single character", () => {
    const re = globToRegExp("file?.txt");
    expect(re.test("file1.txt")).toBe(true);
    expect(re.test("fileA.txt")).toBe(true);
    expect(re.test("file12.txt")).toBe(false);
  });

  it("escapes regex special characters safely", () => {
    const re = globToRegExp("src/file+name[1].(ts|js)");
    expect(re.test("src/file+name[1].(ts|js)")).toBe(true);
    expect(re.test("src/file+name1.ts")).toBe(false);
  });

  it("caches compiled regular expressions", () => {
    const first = globToRegExp("src/**");
    const second = globToRegExp("src/**");
    expect(first).toBe(second);
  });
});
