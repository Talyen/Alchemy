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
  expect(results[0]?.fatalErrorCount, code).toBe(0);
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
      "src/features/alchemy/run-loop/run/run-materials.ts",
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
    const bannedIndexedDb = await lintRule(
      "src/features/alchemy/run-loop/screens/destination-screen.tsx",
      `export const db = indexedDB.open("x");\n`,
      "no-unowned-web-storage",
      { jsx: true },
    );
    expect(bannedIndexedDb.length).toBeGreaterThan(0);
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
    const bannedSocket = await lintRule(
      "src/lib/battle/card-play.ts",
      `export function ping() { return new WebSocket("wss://x"); }\n`,
      "no-lib-fetch",
    );
    expect(bannedSocket.length).toBeGreaterThan(0);
  });

  it.each([
    {
      rule: "no-lib-fetch",
      file: "src/lib/battle/card-play.ts",
      denied: [
        'window["fetch"]("/health");',
        'globalThis.fetch?.("/health");',
        'new window.WebSocket("wss://example.test");',
        'new self["XMLHttpRequest"]();',
        'new EventSource("/events");',
        'navigator.sendBeacon("/events", "data");',
        'window.navigator["sendBeacon"]("/events", "data");',
        'const request = fetch; request("/health");',
        "let request; request = globalThis.fetch;",
        "const { fetch: request } = window;",
        "let request; ({ fetch: request } = globalThis);",
        "const { navigator: { sendBeacon: send } } = window;",
        "const { sendBeacon: send = fallback } = navigator;",
      ],
      allowed: [
        "const cache = { fetch: () => 1 }; cache.fetch();",
        "function ping(fetch: () => number) { return fetch(); }",
        'import { fetch } from "./cache"; fetch();',
        "const window = { fetch: () => 1 }; window.fetch();",
        "function ping(navigator: {sendBeacon(): void}) { navigator.sendBeacon(); }",
        "const { fetch: read } = cache;",
        "type Fetcher = typeof fetch; type Socket = WebSocket;",
        "type Sender = typeof window.navigator.sendBeacon;",
      ],
    },
    {
      rule: "no-unowned-web-storage",
      file: "src/features/alchemy/run-loop/screens/destination-screen.tsx",
      denied: [
        'window["localStorage"].getItem("x");',
        'globalThis.sessionStorage.setItem("x", "1");',
        'self.indexedDB.open("x");',
        'window?.localStorage.getItem("x");',
        'const storage = localStorage; storage.getItem("x");',
        "let storage; storage = window.localStorage;",
        "const { localStorage: storage } = window;",
        "let storage; ({ sessionStorage: storage } = globalThis);",
        "const { indexedDB: storage = fallback } = self;",
        "const { localStorage } = window;",
        "const storage = { localStorage };",
      ],
      allowed: [
        'function read(localStorage: Storage) { return localStorage.getItem("x"); }',
        'import { localStorage } from "./memory"; localStorage.getItem("x");',
        "const cache = { localStorage: {} }; cache.localStorage;",
        "function read(window: {localStorage: Storage}) { return window.localStorage; }",
        "const { localStorage: storage } = cache;",
        "interface Options { localStorage: string; indexedDB: string; }",
        "type StorageAPI = typeof localStorage; type WindowStorage = typeof window.localStorage;",
      ],
    },
  ])("$rule distinguishes browser APIs from local bindings and types", async ({ rule, file, denied, allowed }) => {
    for (const code of denied) expect(await lintRule(file, code, rule), code).toHaveLength(1);
    for (const code of allowed) expect(await lintRule(file, code, rule), code).toEqual([]);
  });

  it("preserves the named storage owners for qualified access and alias capture", async () => {
    for (const file of [
      "src/features/alchemy/shared/storage/preferences.ts",
      "src/lib/active-run-session/session.ts",
      "src/lib/platform-save-backend.ts",
      "src/startup.ts",
      "src/features/alchemy/shared/stores/error-log-store.ts",
      "src/features/alchemy/shared/utils/dev-mode.ts",
      "src/lib/animation/animation-prefs.ts",
    ]) {
      expect(await lintRule(file, "const { localStorage: storage } = window;", "no-unowned-web-storage"), file).toEqual(
        [],
      );
    }
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

  it("allows explanations and requires reasons for lint suppressions", async () => {
    const file = "src/lib/battle/card-play.ts";
    const rule = "require-disable-reason";
    expect(
      await lintRule(file, "/* Preserve RNG order for saved battles. */\nexport function ping() {}\n", rule),
    ).toEqual([]);
    expect(
      await lintRule(
        file,
        "// eslint-disable-next-line @typescript-eslint/no-explicit-any\nexport const x: any = 1;\n",
        rule,
      ),
    ).not.toEqual([]);
    expect(
      await lintRule(
        file,
        "// eslint-disable-next-line @typescript-eslint/no-explicit-any -- \nexport const x: any = 1;\n",
        rule,
      ),
    ).not.toEqual([]);
    expect(
      await lintRule(
        file,
        "// eslint-disable-next-line @typescript-eslint/no-explicit-any -- boundary fixture\nexport const x: any = 1;\n",
        rule,
      ),
    ).toEqual([]);
  });
});
