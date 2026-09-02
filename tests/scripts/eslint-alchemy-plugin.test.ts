import { ESLint } from "eslint";
import path from "node:path";
import { describe, expect, it } from "vitest";
import tseslint from "typescript-eslint";
import { alchemyPlugin } from "../../eslint/plugin.js";

const ROOT = path.resolve(import.meta.dirname, "../..");

async function lintRule(relativePath: string, code: string, ruleId: string, options: { jsx?: boolean } = {}) {
  const eslint = new ESLint({
    cwd: ROOT,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.{ts,tsx}"],
        plugins: { alchemy: alchemyPlugin },
        languageOptions: {
          parser: tseslint.parser,
          parserOptions: { ecmaVersion: 2022, sourceType: "module", ecmaFeatures: { jsx: options.jsx === true } },
        },
        rules: { [`alchemy/${ruleId}`]: "error" },
      },
    ],
  });
  const results = await eslint.lintText(code, { filePath: path.join(ROOT, relativePath) });
  return results.flatMap((result) => result.messages.filter((message) => message.ruleId === `alchemy/${ruleId}`));
}

async function fixRule(relativePath: string, code: string, ruleId: string, options: { jsx?: boolean } = {}) {
  const eslint = new ESLint({
    cwd: ROOT,
    fix: true,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.{ts,tsx}"],
        plugins: { alchemy: alchemyPlugin },
        languageOptions: {
          parser: tseslint.parser,
          parserOptions: { ecmaVersion: 2022, sourceType: "module", ecmaFeatures: { jsx: options.jsx === true } },
        },
        rules: { [`alchemy/${ruleId}`]: "error" },
      },
    ],
  });
  const results = await eslint.lintText(code, { filePath: path.join(ROOT, relativePath) });
  return results[0]?.output ?? code;
}

describe("alchemy ESLint plugin", () => {
  it("bans progress addMaterials outside the homestead-bonus and meta salvage owners", async () => {
    const banned = await lintRule(
      "src/features/alchemy/run-loop/navigation/mystery-flow.ts",
      `import { addMaterials } from "@/features/alchemy/shared/stores/run-session-write-port";\naddMaterials({} as never, {} as never);\n`,
      "no-run-earned-add-materials",
    );
    expect(banned.length).toBeGreaterThan(0);
    const allowed = await lintRule(
      "src/features/alchemy/run-loop/run/run-flow-session-helpers.ts",
      `import { addMaterials } from "@/features/alchemy/shared/stores/run-session-write-port";\naddMaterials({} as never, {} as never);\n`,
      "no-run-earned-add-materials",
    );
    expect(allowed).toEqual([]);
  });

  it("bans localStorage outside storage, validation, boot, and named preference seams", async () => {
    const banned = await lintRule(
      "src/features/alchemy/run-loop/screens/destination-screen.tsx",
      `export const flag = localStorage.getItem("x");\n`,
      "no-unowned-web-storage",
      { jsx: true },
    );
    expect(banned.length).toBeGreaterThan(0);
    const allowed = await lintRule(
      "src/lib/animation/animation-prefs.ts",
      `export const flag = localStorage.getItem("alchemy-disable-animations");\n`,
      "no-unowned-web-storage",
    );
    expect(allowed).toEqual([]);
  });

  it("bans fetch in src/lib", async () => {
    const banned = await lintRule(
      "src/lib/battle/card-play.ts",
      `export async function ping() { await fetch("/health"); }\n`,
      "no-lib-fetch",
    );
    expect(banned.length).toBeGreaterThan(0);
  });

  it("bans em dashes across string literals, template elements, and JSX text", async () => {
    const bannedLiteral = await lintRule(
      "src/lib/mystery/events.ts",
      `export const text = "Rewards \u2014 Choose one";\n`,
      "no-em-dash",
    );
    expect(bannedLiteral.length).toBeGreaterThan(0);

    const bannedTemplate = await lintRule(
      "src/lib/mystery/events.ts",
      "export const text = `Rewards \u2014 Choose one`;\n",
      "no-em-dash",
    );
    expect(bannedTemplate.length).toBeGreaterThan(0);

    const bannedJsx = await lintRule(
      "src/features/alchemy/run-loop/screens/destination-screen.tsx",
      `export function Screen() { return <span>Rewards \u2014 Choose one</span>; }\n`,
      "no-em-dash",
      { jsx: true },
    );
    expect(bannedJsx.length).toBeGreaterThan(0);

    const notFixed = await fixRule(
      "src/lib/mystery/events.ts",
      `export const text = "Rewards \u2014 Choose one";\n`,
      "no-em-dash",
    );
    expect(notFixed).toBe(`export const text = "Rewards \u2014 Choose one";\n`);

    const allowed = await lintRule(
      "src/lib/mystery/events.ts",
      `export const text = "Rewards - Choose one";\n`,
      "no-em-dash",
    );
    expect(allowed).toEqual([]);
  });

  it("bans general comments while permitting tool directives", async () => {
    const banned = await lintRule(
      "src/lib/battle/card-play.ts",
      `/* helper description */\nexport function ping() {}\n`,
      "no-comments",
    );
    expect(banned.length).toBeGreaterThan(0);

    const bannedEslintReasonMissing = await lintRule(
      "src/lib/battle/card-play.ts",
      `// eslint-disable-next-line @typescript-eslint/no-explicit-any\nexport const x: any = 1;\n`,
      "no-comments",
    );
    expect(bannedEslintReasonMissing.length).toBeGreaterThan(0);

    const bannedLoosePrefix = await lintRule(
      "src/lib/battle/card-play.ts",
      `// eslint something\n export const x = 1;\n`,
      "no-comments",
    );
    expect(bannedLoosePrefix.length).toBeGreaterThan(0);

    const allowedEslint = await lintRule(
      "src/lib/battle/card-play.ts",
      `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional any for test\nexport const x: any = 1;\n`,
      "no-comments",
    );
    expect(allowedEslint).toEqual([]);

    const allowedTs = await lintRule(
      "src/lib/battle/card-play.ts",
      `// @ts-expect-error test assertion\nexport const x: number = "1";\n`,
      "no-comments",
    );
    expect(allowedTs).toEqual([]);

    const allowedV8 = await lintRule(
      "src/lib/battle/card-play.ts",
      `/* v8 ignore next */\nexport function ping() {}\n`,
      "no-comments",
    );
    expect(allowedV8).toEqual([]);

    const allowedVite = await lintRule(
      "src/lib/battle/card-play.ts",
      `export const mod = import(/* @vite-ignore */ "./dynamic");\n`,
      "no-comments",
    );
    expect(allowedVite).toEqual([]);

    const notFixed = await fixRule(
      "src/lib/battle/card-play.ts",
      `/* helper description */\nexport function ping() {}\n`,
      "no-comments",
    );
    expect(notFixed).toBe(`/* helper description */\nexport function ping() {}\n`);
  });
});
