import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect } from "vitest";
import { commandInvocation } from "../../scripts/lib/command-invocation.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
export interface LintMessage {
  ruleId: string;
  message: string;
}

/** Exercise real path overrides without placing probe files in the checkout. */
export function lintFixture(
  filePath: string,
  code: string,
  options: { typeAware?: boolean; unused?: "off" | "error"; config?: string } = {},
): LintMessage[] {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "alchemy-lint-")));
  try {
    const filename = path.join(directory, filePath);
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, code);
    fs.symlinkSync(path.join(ROOT, "node_modules"), path.join(directory, "node_modules"), "junction");
    fs.writeFileSync(
      path.join(directory, "fixture.config.ts"),
      `import config from ${JSON.stringify(pathToFileURL(path.join(ROOT, options.config ?? "oxlint.config.ts")).href)}; export default {...config, options: {...config.options, typeAware: ${options.typeAware ?? false}, reportUnusedDisableDirectives: ${JSON.stringify(options.unused ?? "off")}}};`,
    );
    fs.writeFileSync(
      path.join(directory, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { strict: true, noEmit: true, target: "ES2024", types: [] },
        include: ["src"],
      }),
    );
    const [command, args] = commandInvocation("oxlint", [
      "--config",
      "fixture.config.ts",
      "--disable-nested-config",
      "--no-error-on-unmatched-pattern",
      "--format",
      "json",
      filePath,
    ]);
    const result = spawnSync(command, args, { cwd: directory, encoding: "utf8", timeout: 15_000 });
    expect(result.error, result.stderr).toBeUndefined();
    expect(result.stdout, result.stdout + result.stderr).toMatch(/^\s*\{/);
    const parsed = JSON.parse(result.stdout);
    expect(parsed, result.stdout + result.stderr).toHaveProperty("diagnostics");
    return parsed.diagnostics.map((diagnostic: { code: string; message: string }) => ({
      ruleId: (diagnostic.code ?? "").replace(
        /^([^()]+)\(([^()]+)\)$/,
        (_match: string, plugin: string, rule: string) => (plugin === "eslint" ? rule : `${plugin}/${rule}`),
      ),
      message: diagnostic.message,
    }));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
