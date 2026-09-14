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

const eslintInstances = new Map<string, ESLint>();
const effectiveEslint = new ESLint({ cwd: ROOT, overrideConfig: [tseslint.configs.disableTypeChecked] });

async function effectiveMessages(filePath: string, code: string, ruleId: string) {
  const [result] = await effectiveEslint.lintText(code, { filePath: path.join(ROOT, filePath) });
  expect(result.fatalErrorCount, code).toBe(0);
  return result.messages.filter((message) => message.ruleId === ruleId);
}

function getOrCreateEslint(selectors: ReturnType<typeof restrictedSyntax>): ESLint {
  const key = JSON.stringify(selectors);
  let instance = eslintInstances.get(key);
  if (!instance) {
    instance = new ESLint({
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
    eslintInstances.set(key, instance);
  }
  return instance;
}

async function lintSyntax(relativePath: string, code: string, selectors: ReturnType<typeof restrictedSyntax>) {
  const eslint = getOrCreateEslint(selectors);
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

it.each([
  "tests/e2e/specs/core-gameplay.spec.ts",
  "tests/e2e/specs/draw-discard-animations.spec.ts",
  "tests/e2e/specs/battle-end-turn-canary.spec.ts",
  "performance/scenarios/battle-end-turn.perf.ts",
])("keeps development-only controls out of %s", async (file) => {
  for (const code of [
    'page.getByRole("button", { name: "Skip Combat" });',
    'page.getByRole("button", { name: "Unlock All" });',
    "battle.skipCombatBtn.click();",
    "battle.skipCombatToVictory();",
  ]) {
    expect(await effectiveMessages(file, code, "no-restricted-syntax"), code).toHaveLength(1);
  }
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

it("keeps context and aggregate exceptions independent from TSX conventions", async () => {
  const context = 'import { createContext as context } from "react"; export const value = context(null);';
  const aggregate = "useGameplayStateStore.getState();";
  for (const file of [
    "src/features/alchemy/shared/stores/lint-probe.ts",
    "src/features/alchemy/shared/stores/lint-probe.tsx",
    "src/features/alchemy/run-loop/screens/lint-probe.tsx",
  ]) {
    expect(await effectiveMessages(file, context, "no-restricted-syntax"), file).not.toEqual([]);
    const messages = await effectiveMessages(file, aggregate, "no-restricted-syntax");
    expect(messages.length, file).toBe(file.includes("/stores/") ? 0 : 1);
  }
  for (const file of [
    "src/app/app-screen-chrome-context.tsx",
    "src/features/alchemy/shared/context/card-description-context.tsx",
  ]) {
    expect(await effectiveMessages(file, context, "no-restricted-syntax"), file).toEqual([]);
    expect(await effectiveMessages(file, aggregate, "no-restricted-syntax"), file).toHaveLength(1);
  }
  for (const file of [
    "src/features/alchemy/shared/stores/lint-probe.tsx",
    "src/app/app-screen-chrome-context.tsx",
    "src/features/alchemy/shared/context/card-description-context.tsx",
  ]) {
    for (const expression of ["`a ${active}`", '"a " + active']) {
      const code = `export const view = <div className={${expression}} />;`;
      expect(await effectiveMessages(file, code, "no-restricted-syntax"), file).toHaveLength(1);
    }
    expect(
      await effectiveMessages(file, 'export const view = <div className={cn("a", active)} />;', "no-restricted-syntax"),
      file,
    ).toEqual([]);
  }
});

it("allows erased type imports while blocking asset-loading imports across browser test categories", async () => {
  for (const file of [
    "tests/e2e/specs/core-gameplay.spec.ts",
    "tests/e2e/specs/draw-discard-animations.spec.ts",
    "tests/helpers/lint-probe.ts",
    "performance/scenarios/battle-end-turn.perf.ts",
  ]) {
    for (const imports of ["import type { Card }", "import { type Card }", "import { type Card, type Enemy }"]) {
      expect(
        await effectiveMessages(file, `${imports} from "@/lib/game-data";`, "no-restricted-syntax"),
        imports,
      ).toEqual([]);
    }
    for (const imports of [
      "import { Card, type Enemy }",
      "import { Card }",
      "import Cards",
      "import * as Cards",
      "import {}",
    ]) {
      expect(
        await effectiveMessages(file, `${imports} from "@/lib/game-data";`, "no-restricted-syntax"),
        imports,
      ).toHaveLength(1);
    }
    expect(await effectiveMessages(file, 'import "@/lib/game-data";', "no-restricted-syntax"), file).toHaveLength(1);
  }
});

it("checks assertion completeness and awaits while allowing messages and returned promises", async () => {
  const file = "tests/lib/utils.test.ts";
  for (const statement of ["expect(1);", "expect(1).toBe;", "expect(Promise.resolve(1)).resolves.toBe(1);"]) {
    const code = `import { it, expect } from "vitest"; it("checks", () => { ${statement} });`;
    expect(await effectiveMessages(file, code, "vitest/valid-expect"), statement).toHaveLength(1);
  }
  for (const statement of [
    "expect(1, message).toBe(1);",
    "return expect(Promise.resolve(1)).resolves.toBe(1);",
    "await expect(Promise.resolve(1)).resolves.toBe(1);",
  ]) {
    const code = `import { it, expect } from "vitest"; it("checks", async () => { ${statement} });`;
    expect(await effectiveMessages(file, code, "vitest/valid-expect"), statement).toEqual([]);
  }
});

it("checks desktop globals without allowing DOM access in the main process", async () => {
  for (const file of ["desktop/main.cjs", "desktop/preload.cjs", "tests/electron/profile.cjs"]) {
    expect(await effectiveMessages(file, 'consoel.log("boot");', "no-undef"), file).toHaveLength(1);
    expect(
      await effectiveMessages(file, "module.exports = { process, Buffer, require, __dirname, Response };", "no-undef"),
      file,
    ).toEqual([]);
    const messages = await effectiveMessages(file, 'document.getElementById("mock");', "no-undef");
    expect(messages.length, file).toBe(file === "desktop/preload.cjs" ? 0 : 1);
  }
});

it("requires suppression reasons in tooling, configuration, desktop and performance files", async () => {
  for (const file of [
    "eslint/plugin.js",
    "eslint.config.js",
    "desktop/main.cjs",
    "performance/metrics.ts",
    "scripts/check.mjs",
  ]) {
    const statement = "if (value == 1) {}";
    expect(
      await effectiveMessages(
        file,
        `// eslint-disable-next-line eqeqeq\n${statement}`,
        "alchemy/require-disable-reason",
      ),
      file,
    ).toHaveLength(1);
    expect(
      await effectiveMessages(
        file,
        `// eslint-disable-next-line eqeqeq -- intentional coercion fixture\n${statement}`,
        "alchemy/require-disable-reason",
      ),
      file,
    ).toEqual([]);
  }
});

it("checks mouse-only actions and focusable controls hidden from assistive technology", async () => {
  const file = "src/features/alchemy/shared/ui/lint-probe.tsx";
  for (const [rule, rejected, allowed] of [
    ["jsx-a11y/click-events-have-key-events", "<div onClick={action} />", "<button onClick={action} />"],
    ["jsx-a11y/no-aria-hidden-on-focusable", '<button aria-hidden="true" />', '<span aria-hidden="true" />'],
  ]) {
    expect(await effectiveMessages(file, `export const view = ${rejected};`, rule), rule).toHaveLength(1);
    expect(await effectiveMessages(file, `export const view = ${allowed};`, rule), rule).toEqual([]);
  }
});
