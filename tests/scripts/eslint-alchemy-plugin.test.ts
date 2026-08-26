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

  it("allows Math.random inside useState/useCallback and bans render-time calls", async () => {
    const banned = await lintRule(
      "src/features/alchemy/meta/screens/menu-screen.tsx",
      `export function Logo() { const n = Math.random(); return n; }\n`,
      "no-render-math-random",
      { jsx: true },
    );
    expect(banned.length).toBeGreaterThan(0);
    const allowed = await lintRule(
      "src/app/startup-loading-screen.tsx",
      `import { useState } from "react";\nexport function Screen() { const [n] = useState(() => Math.random()); return n; }\n`,
      "no-render-math-random",
      { jsx: true },
    );
    expect(allowed).toEqual([]);
  });

  it("bans import/consumer graph comments", async () => {
    const banned = await lintRule(
      "src/lib/battle/card-play.ts",
      `// Depends on: effect-handlers.\nexport function ping() {}\n`,
      "no-dependency-graph-comments",
    );
    expect(banned.length).toBeGreaterThan(0);
    const allowed = await lintRule(
      "src/lib/battle/card-play.ts",
      `// Leaf-module imports only, so this file stays import-cycle-free.\nexport function ping() {}\n`,
      "no-dependency-graph-comments",
    );
    expect(allowed).toEqual([]);
  });
});
