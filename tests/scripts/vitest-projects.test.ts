import { globSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { testEnvironmentForPath } from "../../vitest.config";

describe("Vitest projects", () => {
  it("assigns every unit test to exactly one supported environment", () => {
    const files = globSync("tests/**/*.test.{ts,tsx}").filter((filePath) => !filePath.startsWith("tests/balance/"));
    const assignments = files.map((filePath) => [filePath, testEnvironmentForPath(filePath)] as const);

    expect(assignments).toHaveLength(files.length);
    expect(assignments.every(([, environment]) => environment === "node" || environment === "dom")).toBe(true);
    expect(assignments.some(([, environment]) => environment === "node")).toBe(true);
    expect(assignments.some(([, environment]) => environment === "dom")).toBe(true);
  });
});
