import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import config from "../../vitest.config";
import { globToRegExp } from "../../scripts/lib/glob-pattern.mjs";

const projects = (config.test?.projects ?? []).map((project) => {
  if (typeof project !== "object" || !("test" in project) || !project.test) {
    throw new Error("Expected inline Vitest projects");
  }
  return project.test;
});

function assignments(file: string) {
  const matches = (patterns: string[] = []) => patterns.some((pattern) => globToRegExp(pattern).test(file));
  return projects.filter((project) => matches(project.include) && !matches(project.exclude));
}

describe("Vitest projects", () => {
  it("collects each unit test once and leaves dedicated suites out", () => {
    const files = readdirSync("tests", { recursive: true, encoding: "utf8" })
      .map((file) => `tests/${file.replaceAll("\\", "/")}`)
      .filter((file) => /\.test\.tsx?$/u.test(file));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const dedicated = /^tests\/(balance|playthrough)\//u.test(file);
      expect(
        assignments(file).map((project) => project.name),
        file,
      ).toHaveLength(dedicated ? 0 : 1);
    }
  });

  it.each([
    ["tests/lib/battle/damage.test.ts", "node", "node"],
    ["tests/scripts/check.test.ts", "node", "node"],
    ["tests/app/example.test.tsx", "dom", "jsdom"],
    ["tests/app/example.dom.test.ts", "dom", "jsdom"],
    ["tests/app/use-example.test.ts", "dom", "jsdom"],
    ["tests/app/example-hook.test.ts", "dom", "jsdom"],
    ["tests/lib/platform-save-backend.dom.test.ts", "dom", "jsdom"],
    ["tests/lib/animation/game-timer.dom.test.ts", "dom", "jsdom"],
  ])("runs %s in %s", (file, name, environment) => {
    expect(assignments(file)).toMatchObject([
      { name, environment: environment === "jsdom" ? "./tests/jsdom-environment.ts" : environment },
    ]);
    if (name === "dom") expect(assignments(file)[0].setupFiles).toEqual(["tests/setup-dom.ts"]);
  });
});
