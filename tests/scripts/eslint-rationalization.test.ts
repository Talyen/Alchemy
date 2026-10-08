import { ESLint } from "eslint";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import tseslint from "typescript-eslint";

vi.setConfig({ testTimeout: 30_000 });
const ROOT = path.resolve(import.meta.dirname, "../..");

const effectiveEslint = new ESLint({ cwd: ROOT, overrideConfig: [tseslint.configs.disableTypeChecked] });

async function effectiveMessages(filePath: string, code: string, ruleId: string) {
  const [result] = await effectiveEslint.lintText(code, { filePath: path.join(ROOT, filePath) });
  expect(result.fatalErrorCount, code).toBe(0);
  return result.messages.filter((message) => message.ruleId === ruleId);
}

describe("eslint rationalization", () => {
  it("bans any .rng access including nextState, computed, and destructuring", async () => {
    const cases = [
      `const x = state.rng;`,
      `const x = nextState.rng();`,
      `const x = state["rng"];`,
      `const { rng } = state;`,
      `const { rng: myRng } = state;`,
      `function foo({ rng }) {}`,
    ];
    for (const code of cases) {
      const msgs = await effectiveMessages("src/lib/battle/card-play.ts", code, "no-restricted-syntax");
      expect(msgs.length, `should ban ${code}`).toBeGreaterThan(0);
    }
    const allowed = await effectiveMessages(
      "src/lib/battle/rng.ts",
      `import { getBattleRng } from "./rng"; const x = getBattleRng(state);`,
      "no-restricted-syntax",
    );
    expect(allowed.length).toBe(0);
  });

  it("bans Math.floor/ceil/trunc but allows Math.round", async () => {
    for (const fn of ["floor", "ceil", "trunc"]) {
      const msgs = await effectiveMessages(
        "src/lib/battle/card-play.ts",
        `Math.${fn}(1.5); Math["${fn}"](1.5);`,
        "no-restricted-syntax",
      );
      expect(msgs.length, `should ban dot and computed Math.${fn}`).toBe(2);
    }
    const allowed = await effectiveMessages("src/lib/battle/card-play.ts", `Math.round(1.5);`, "no-restricted-syntax");
    expect(allowed.length).toBe(0);
  });

  it("rejects dot and literal computed randomness without mistaking dynamic keys for builtins", async () => {
    for (const file of [
      "src/lib/battle/card-play.ts",
      "src/features/alchemy/run-loop/run/progression-commands.ts",
      "src/features/alchemy/run-loop/navigation/example.tsx",
    ]) {
      const messages = await effectiveMessages(
        file,
        `Math.random(); const direct = Math.random; Math["random"](); const computed = Math["random"]; Math[random]();`,
        "no-restricted-syntax",
      );
      expect(messages, file).toHaveLength(4);
      expect(messages.every((message) => message.message.includes("seeded"))).toBe(true);
      if (file.includes("run-loop")) {
        const nestedDispatch = await effectiveMessages(
          file,
          'import { dispatchGearMutationWithRunHealthSync } from "@/features/alchemy/shared/stores/gear-session-command";',
          "no-restricted-syntax",
        );
        expect(nestedDispatch, file).toHaveLength(1);
      }
    }
  });
});

it("ignores isolated worktrees without excluding the active checkout", async () => {
  expect(await effectiveEslint.isPathIgnored(".worktrees/evaluation/src/example.ts")).toBe(true);
  expect(await effectiveEslint.isPathIgnored("scripts/agent-context.mjs")).toBe(false);
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
    const results = await effectiveEslint.lintText('import { test } from "../../fixtures/e2e"; enableFastMode(page);', {
      filePath: path.join(ROOT, filePath),
    });
    const rules = results.flatMap((result) => result.messages).map((message) => message.ruleId);
    expect(rules).not.toContain("no-restricted-imports");
    expect(rules).toContain("no-restricted-syntax");
    for (const code of [
      'test("timing", async ({ page, fastBattle }) => { void fastBattle; });',
      'import { useFastBattle as fast } from "../../fixtures/e2e";',
    ]) {
      const [result] = await effectiveEslint.lintText(code, { filePath: path.join(ROOT, filePath) });
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

it("keeps the shipping singleton out of reusable domains and headless careers", async () => {
  for (const file of [
    "src/features/alchemy/run-loop/shop/create-shop-actions.ts",
    "src/features/alchemy/shared/stores/battle-commands.ts",
    "src/features/alchemy/shared/storage/bootstrap-save-state.ts",
    "src/app/playthrough/controller.ts",
    "src/app/autosave-lifecycle.ts",
    "src/features/alchemy/run-loop/battle/battle-presentation-store.ts",
    "src/features/alchemy/run-loop/battle/use-battle-opening-draw.ts",
    "src/features/alchemy/run-loop/screens/battle-screen/hand.tsx",
  ]) {
    for (const code of [
      'import { defaultGameSession } from "@/app/application-session";',
      'export { defaultGameSession } from "@/app/application-session";',
      'const session = import("@/app/application-session");',
      'import { battlePresentation } from "@/app/battle-presentation";',
      'export { battlePresentation } from "@/app/battle-presentation";',
      'const presentation = import("@/app/battle-presentation");',
    ]) {
      expect(await effectiveMessages(file, code, "alchemy/session-ownership"), `${file}: ${code}`).toHaveLength(1);
    }
  }
  for (const file of ["src/app/use-app-save-state.ts", "src/features/alchemy/shell/use-battle-controller.ts"]) {
    expect(
      await effectiveMessages(
        file,
        'import { defaultGameSession } from "@/app/application-session";',
        "alchemy/session-ownership",
      ),
    ).toHaveLength(0);
  }
});

it("requires explicit sessions in functions and callback contracts", async () => {
  const file = "src/features/alchemy/shared/stores/battle-commands.ts";
  const imported = 'import type { GameSession as Career } from "./game-session-types";';
  for (const code of [
    "function command(session?: Career) {}",
    "const command = (session: Career = fallback) => {};",
    "type Command = (session?: Career) => void;",
    "interface Commands { endTurn(session?: Career): void; }",
  ]) {
    expect(await effectiveMessages(file, imported + code, "alchemy/session-ownership"), code).toHaveLength(1);
  }
  expect(
    await effectiveMessages(file, imported + "function command(session: Career) {}", "alchemy/session-ownership"),
  ).toHaveLength(0);
});
