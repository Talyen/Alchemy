import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, it } from "vitest";
import { commandInvocation } from "../../scripts/lib/command-invocation.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");

it("resolves TSX aliases and rejects layer violations and cycles using SWC", () => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "alchemy-boundaries-")));
  const write = (file: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
    fs.writeFileSync(path.join(directory, file), text);
  };
  const cruise = () => {
    const [command, args] = commandInvocation("depcruise", [
      "src",
      "--config",
      "fixture.config.mjs",
      "--output-type",
      "json",
    ]);
    const result = spawnSync(command, args, { cwd: directory, encoding: "utf8", timeout: 15_000 });
    expect(result.error, result.stderr).toBeUndefined();
    expect(result.stdout, result.stderr).toMatch(/^\s*\{/);
    return JSON.parse(result.stdout);
  };
  try {
    write(
      "fixture.config.mjs",
      `import config from ${JSON.stringify(pathToFileURL(path.join(ROOT, "dependency-cruiser.config.mjs")).href)}; export default {...config,options:{...config.options,webpackConfig:{fileName:"resolve.config.mjs"}}};`,
    );
    write(
      "resolve.config.mjs",
      `import config from ${JSON.stringify(pathToFileURL(path.join(ROOT, "dependency-cruiser-resolve.config.mjs")).href)};export default {...config,resolve:{...config.resolve,alias:Object.fromEntries(Object.entries(config.resolve.alias).map(([key,value])=>[key,${JSON.stringify(directory)}+value.slice(${ROOT.length})]))}};`,
    );
    write("src/lib/value.ts", "export const value = 1;");
    write("src/lib/view.tsx", 'import { value } from "@/lib/value"; export const view = <div>{value}</div>;');
    write("src/lib/type-a.ts", 'import type { B } from "@/lib/type-b"; export interface A {next?: B}');
    write("src/lib/type-b.ts", 'import type { A } from "@/lib/type-a"; export interface B {next?: A}');
    const valid = cruise();
    expect(valid.summary.violations).toEqual([]);
    expect(
      valid.modules.find((module: { source: string }) => module.source === "src/lib/view.tsx").dependencies,
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ resolved: "src/lib/value.ts", couldNotResolve: false })]),
    );
    write(
      "src/features/alchemy/meta/probe.ts",
      'import { value } from "@/features/alchemy/run-loop/value"; export {value};',
    );
    write("src/features/alchemy/run-loop/value.ts", "export const value=1;");
    write("src/lib/a.ts", 'import { b } from "@/lib/b"; export const a=()=>b;');
    write("src/lib/b.ts", 'import { a } from "@/lib/a"; export const b=()=>a;');
    write(
      "src/lib/mixed-a.ts",
      'import type { B } from "@/lib/mixed-b"; import { b } from "@/lib/mixed-b"; export interface A {next?: B} export const a=()=>b;',
    );
    write(
      "src/lib/mixed-b.ts",
      'import type { A } from "@/lib/mixed-a"; import { a } from "@/lib/mixed-a"; export interface B {next?: A} export const b=()=>a;',
    );
    const invalid = cruise();
    expect(
      invalid.summary.violations.some(
        (violation: { from: string; rule: { name: string } }) =>
          violation.from === "src/lib/mixed-a.ts" && violation.rule.name === "no-circular",
      ),
    ).toBe(true);
    expect(
      invalid.summary.violations.some(
        (violation: { rule: { name: string } }) => violation.rule.name === "meta-no-run-loop",
      ),
    ).toBe(true);
    expect(
      invalid.summary.violations.some((violation: { rule: { name: string } }) => violation.rule.name === "no-circular"),
    ).toBe(true);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
