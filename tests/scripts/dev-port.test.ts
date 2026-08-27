import { describe, expect, it } from "vitest";
import { parsePort, resolveDevPort, resolvePort } from "../../scripts/lib/dev-port.mjs";
import { previewPortFromEnv } from "../playwright-shared";

describe("port contracts", () => {
  it.each([
    ["1", 1],
    ["04173", 4173],
    ["65535", 65_535],
    [4173, 4173],
  ])("parses valid port %s", (raw, expected) => {
    expect(parsePort(raw)).toBe(expected);
  });

  it.each(["", " 4173", "4173 ", "4173junk", "1.5", "-1", "0", "65536", Number.NaN])(
    "rejects invalid port %s",
    (raw) => {
      expect(() => parsePort(raw)).toThrow(/Invalid port/);
    },
  );

  it("names the owning environment variable in errors", () => {
    expect(() => resolvePort("PLAYWRIGHT_PERF_PORT", 4176, { PLAYWRIGHT_PERF_PORT: "bad" })).toThrow(
      "Invalid PLAYWRIGHT_PERF_PORT: bad",
    );
  });

  it("uses the dev fallback only when the variable is absent", () => {
    expect(resolveDevPort({})).toBe(5173);
    expect(() => resolveDevPort({ ALCHEMY_DEV_PORT: "" })).toThrow("Invalid ALCHEMY_DEV_PORT");
  });

  it("applies the same validation to Playwright port configuration", () => {
    process.env.PLAYWRIGHT_TEST_PORT = "4173junk";
    expect(() => previewPortFromEnv("PLAYWRIGHT_TEST_PORT", 4173)).toThrow("Invalid PLAYWRIGHT_TEST_PORT");
    delete process.env.PLAYWRIGHT_TEST_PORT;
  });
});
