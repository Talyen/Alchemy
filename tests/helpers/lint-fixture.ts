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
  line: number;
}
interface LintOptions {
  typeAware?: boolean;
  unused?: "off" | "error";
  config?: string;
}
interface LintProbe {
  filePath: string;
  code: string;
}

/** Exercise real path overrides in one process, without rewriting paths or config globs. */
export function lintFixtures(probes: readonly LintProbe[], options: LintOptions = {}): LintMessage[][] {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "alchemy-lint-")));
  try {
    const byFilename = new Map<string, LintMessage[]>();
    const results = probes.map(({ filePath, code }) => {
      const filename = path.resolve(directory, filePath);
      if (!filename.startsWith(`${directory}${path.sep}`) || byFilename.has(filename)) {
        throw new Error(`Expected distinct fixture paths inside the temporary root: ${filePath}`);
      }
      fs.mkdirSync(path.dirname(filename), { recursive: true });
      fs.writeFileSync(filename, code);
      const messages: LintMessage[] = [];
      byFilename.set(filename, messages);
      return messages;
    });
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
      ...probes.map(({ filePath }) => filePath),
    ]);
    const result = spawnSync(command, args, { cwd: directory, encoding: "utf8", timeout: 15_000 });
    expect(result.error, result.stderr).toBeUndefined();
    expect([0, 1], result.stdout + result.stderr).toContain(result.status);
    expect(result.stdout, result.stdout + result.stderr).toMatch(/^\s*\{/);
    const parsed = JSON.parse(result.stdout);
    expect(parsed, result.stdout + result.stderr).toHaveProperty("diagnostics");
    for (const diagnostic of parsed.diagnostics) {
      const messages = byFilename.get(path.resolve(directory, diagnostic.filename));
      if (!messages) throw new Error(`Unexpected diagnostic file: ${diagnostic.filename}`);
      messages.push({
        ruleId: (diagnostic.code ?? "").replace(
          /^([^()]+)\(([^()]+)\)$/,
          (_match: string, plugin: string, rule: string) => (plugin === "eslint" ? rule : `${plugin}/${rule}`),
        ),
        message: diagnostic.message,
        line: diagnostic.labels[0].span.line,
      });
    }
    return results;
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

export function lintFixture(filePath: string, code: string, options: LintOptions = {}): LintMessage[] {
  return lintFixtures([{ filePath, code }], options)[0]!;
}
