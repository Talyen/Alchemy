// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- test imports JS fragments without declarations, covered by runtime ESLint checks
// @ts-nocheck -- test imports JS fragments without declarations, covered by runtime ESLint checks
import { ESLint } from "eslint";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import tseslint from "typescript-eslint";

vi.setConfig({ testTimeout: 30_000 });
import {
  BATTLE_NO_DIRECT_RNG,
  BATTLE_NO_MATH_FLOOR,
  BATTLE_NO_MATH_RANDOM,
  CLASSNAME_NO_TEMPLATE,
  NO_UNOWNED_CONTEXT_CREATION,
  restrictedSyntax,
} from "../../eslint/fragments.js";

const ROOT = path.resolve(import.meta.dirname, "../..");

async function lintSyntax(relativePath: string, code: string, selectors: ReturnType<typeof restrictedSyntax>) {
  const eslint = new ESLint({
    cwd: ROOT,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.{ts,tsx}"],
        languageOptions: {
          parser: tseslint.parser,
          parserOptions: { ecmaVersion: 2022, sourceType: "module", ecmaFeatures: { jsx: true } },
        },
        rules: { "no-restricted-syntax": selectors },
      },
    ],
  });
  const results = await eslint.lintText(code, { filePath: path.join(ROOT, relativePath) });
  return results.flatMap((r) => r.messages.filter((m) => m.ruleId === "no-restricted-syntax"));
}

describe("eslint rationalization", () => {
  it("bans any .rng access including nextState, computed, and destructuring", async () => {
    const selectors = restrictedSyntax(...BATTLE_NO_DIRECT_RNG);
    const cases = [
      `const x = state.rng;`,
      `const x = nextState.rng();`,
      `const x = state["rng"];`,
      `const { rng } = state;`,
      `const { rng: myRng } = state;`,
      `function foo({ rng }) {}`,
    ];
    for (const code of cases) {
      const msgs = await lintSyntax("src/lib/battle/card-play.ts", code, selectors);
      expect(msgs.length, `should ban ${code}`).toBeGreaterThan(0);
    }
    const allowed = await lintSyntax(
      "src/lib/battle/rng.ts",
      `import { getBattleRng } from "./rng"; const x = getBattleRng(state);`,
      selectors,
    );
    expect(allowed.length).toBe(0);
  });

  it("bans Math.floor/ceil/trunc but allows Math.round", async () => {
    const selectors = restrictedSyntax(...BATTLE_NO_MATH_FLOOR);
    for (const fn of ["floor", "ceil", "trunc"]) {
      const msgs = await lintSyntax("src/lib/battle/card-play.ts", `Math.${fn}(1.5);`, selectors);
      expect(msgs.length, `should ban Math.${fn}`).toBeGreaterThan(0);
    }
    const allowed = await lintSyntax("src/lib/battle/card-play.ts", `Math.round(1.5);`, selectors);
    expect(allowed.length).toBe(0);
  });

  it("collapses Math.random to single property-access selector", async () => {
    expect(BATTLE_NO_MATH_RANDOM.length).toBe(1);
    expect(BATTLE_NO_MATH_RANDOM[0].selector).toBe('MemberExpression[object.name="Math"][property.name="random"]');
    const selectors = restrictedSyntax(...BATTLE_NO_MATH_RANDOM);
    const msgs = await lintSyntax("src/lib/battle/card-play.ts", `Math.random(); const x = Math.random;`, selectors);
    expect(msgs.length).toBeGreaterThan(0);
  });

  it("className template targets only raw template directly on className", async () => {
    expect(CLASSNAME_NO_TEMPLATE.length).toBe(2);
    expect(CLASSNAME_NO_TEMPLATE[0].selector).toContain("JSXExpressionContainer");
    const selectors = restrictedSyntax(...CLASSNAME_NO_TEMPLATE);
    const banned = await lintSyntax(
      "src/features/test.tsx",
      `export function Foo(){ return <div className={\`a \${b}\`} /> }`,
      selectors,
    );
    expect(banned.length).toBeGreaterThan(0);
    const allowed = await lintSyntax(
      "src/features/test.tsx",
      `export function Foo(){ return <div className={cn(\`a \${b}\`)} /> }`,
      selectors,
    );
    expect(allowed.length).toBe(0);
    const bannedConcat = await lintSyntax(
      "src/features/test.tsx",
      `export function Foo({ active }: { active: boolean }){ return <div className={"a " + (active ? "b" : "c")} /> }`,
      selectors,
    );
    expect(bannedConcat.length).toBeGreaterThan(0);
  });

  it("catches aliased createContext imports", async () => {
    const selectors = restrictedSyntax(...NO_UNOWNED_CONTEXT_CREATION);
    const banned = await lintSyntax(
      "src/features/alchemy/run-loop/screens/foo.tsx",
      `import { createContext as myCtx } from "react"; const Ctx = myCtx(null);`,
      selectors,
    );
    expect(banned.length).toBeGreaterThan(0);
    const allowedProvider = await lintSyntax(
      "src/app/app-screen-chrome-context.tsx",
      `import { createContext } from "react"; const Ctx = createContext(null);`,
      selectors,
    );
    expect(allowedProvider.length).toBeGreaterThan(0);
  });

  it("enables alt-text errors for application images", async () => {
    const eslint = new ESLint({ cwd: ROOT });
    const config = await eslint.calculateConfigForFile("src/features/alchemy/shared/ui/test.tsx");
    expect(config.rules?.["jsx-a11y/alt-text"]?.[0]).toBe(2);
  });

  it("disables react-hooks for Playwright specs but enables for React unit tests", async () => {
    const eslint = new ESLint({ cwd: ROOT });
    const specConfig = await eslint.calculateConfigForFile("tests/pages/foo.spec.ts");
    const specRule = specConfig.rules?.["react-hooks/rules-of-hooks"];
    const specOff =
      specRule === "off" || specRule === 0 || (Array.isArray(specRule) && (specRule[0] === "off" || specRule[0] === 0));
    expect(specOff).toBe(true);
    const unitConfig = await eslint.calculateConfigForFile("tests/features/alchemy/meta/screens/foo.test.tsx");
    const unitRule = unitConfig.rules?.["react-hooks/rules-of-hooks"];
    const unitOff =
      unitRule === "off" || unitRule === 0 || (Array.isArray(unitRule) && (unitRule[0] === "off" || unitRule[0] === 0));
    expect(unitOff).toBe(false);
  });

  it("uses vitest recommended without hand-written .only selectors", async () => {
    const eslint = new ESLint({ cwd: ROOT });
    const unitConfig = await eslint.calculateConfigForFile("tests/features/alchemy/meta/screens/foo.test.ts");
    expect(unitConfig.rules?.["vitest/no-disabled-tests"]).toBeDefined();
    expect(unitConfig.rules?.["vitest/no-focused-tests"]).toBeDefined();
  });
});

it("ignores isolated worktrees without excluding the active checkout", async () => {
  const eslint = new ESLint({ cwd: ROOT });
  expect(await eslint.isPathIgnored(".worktrees/evaluation/src/example.ts")).toBe(true);
  expect(await eslint.isPathIgnored("scripts/agent-context.mjs")).toBe(false);
});

it("keeps production-only UI restrictions on relocated browser specs", async () => {
  const eslint = new ESLint({ cwd: ROOT });
  const results = await eslint.lintText('page.getByRole("button", { name: "Skip Combat" });', {
    filePath: path.join(ROOT, "tests/e2e/specs/core-gameplay.spec.ts"),
  });
  expect(results.flatMap((result) => result.messages).map((message) => message.ruleId)).toContain(
    "no-restricted-syntax",
  );
});

it.each(["tests/e2e/specs/draw-discard-animations.spec.ts", "tests/e2e/specs/battle-end-turn-canary.spec.ts"])(
  "keeps real animation timing in %s",
  async (filePath) => {
    const eslint = new ESLint({ cwd: ROOT });
    const results = await eslint.lintText('import { test } from "../../fixtures/e2e"; enableFastMode(page);', {
      filePath: path.join(ROOT, filePath),
    });
    const rules = results.flatMap((result) => result.messages).map((message) => message.ruleId);
    expect(rules).not.toContain("no-restricted-imports");
    expect(rules).toContain("no-restricted-syntax");
    for (const code of [
      'test("timing", async ({ page, fastBattle }) => { void fastBattle; });',
      'import { useFastBattle as fast } from "../../fixtures/e2e";',
    ]) {
      const [result] = await eslint.lintText(code, { filePath: path.join(ROOT, filePath) });
      expect(result.messages.some((message) => message.ruleId === "no-restricted-syntax")).toBe(true);
    }
  },
);
