import path from "node:path";
import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";
import { alchemyPlugin } from "../../lint/plugin.js";

RuleTester.describe = describe;
RuleTester.it = it;
const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "tsx" } } });
const filename = (file: string) => path.resolve(file);
const cases = [
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
];
for (const { rule, file, denied, allowed } of cases) {
  tester.run(rule, alchemyPlugin.rules[rule]!, {
    valid: allowed.map((code) => ({ code, filename: filename(file) })),
    invalid: denied.map((code) => ({ code, filename: filename(file), errors: 1 })),
  });
}

tester.run("no-run-earned-add-materials", alchemyPlugin.rules["no-run-earned-add-materials"]!, {
  valid: [
    "src/features/alchemy/shared/stores/write/run-end.ts",
    "src/features/alchemy/shared/stores/write/run-homestead.ts",
    "src/features/alchemy/shared/stores/run-session-write-port.ts",
    "src/features/alchemy/shared/stores/gear-session-command.ts",
  ].map((file) => ({ code: "addMaterialsToStockpile({});", filename: filename(file) })),
  invalid: [
    {
      code: 'import { addMaterialsToStockpile } from "./port"; addMaterialsToStockpile({});',
      filename: filename("src/features/alchemy/run-loop/navigation/mystery-flow.ts"),
      errors: 2,
    },
  ],
});

tester.run("no-unowned-web-storage owners", alchemyPlugin.rules["no-unowned-web-storage"]!, {
  valid: [
    "src/features/alchemy/shared/storage/preferences.ts",
    "src/lib/active-run-session/session.ts",
    "src/lib/platform-save-backend.ts",
    "src/startup.ts",
    "src/features/alchemy/shared/stores/error-log-store.ts",
    "src/features/alchemy/shared/utils/dev-mode.ts",
    "src/lib/animation/animation-prefs.ts",
  ].map((file) => ({ code: "const { localStorage: storage } = window;", filename: filename(file) })),
  invalid: [
    {
      code: 'localStorage.getItem("x");',
      filename: filename("src/features/alchemy/run-loop/screens/destination-screen.tsx"),
      errors: 1,
    },
  ],
});

tester.run("no-em-dash", alchemyPlugin.rules["no-em-dash"]!, {
  valid: ['const text = "Rewards - Choose one";', "// A comment — can explain ordering."],
  invalid: [
    'const text = "Rewards — Choose one";',
    "const text = `Rewards — Choose one`;",
    "const view = <span>Rewards — Choose one</span>;",
  ].map((code) => ({ code, errors: 1 })),
});

tester.run("require-disable-reason", alchemyPlugin.rules["require-disable-reason"]!, {
  valid: [
    "/* Preserve RNG order for saved battles. */",
    "// oxlint-disable-next-line typescript/no-explicit-any -- interop seam\nconst x: any = 1;",
  ],
  invalid: [
    "// oxlint-disable-next-line typescript/no-explicit-any\nconst x: any = 1;",
    "// oxlint-disable-next-line typescript/no-explicit-any -- \nconst x: any = 1;",
  ].map((code) => ({ code, errors: 1 })),
});

tester.run("battle-types-only", alchemyPlugin.rules["battle-types-only"]!, {
  valid: [
    "interface State {}\ntype Health = number;",
    'import type { State } from "./state"; export type { State };',
    'import { type State } from "./state"; export { type State };',
    'export type * from "./state";',
    "export interface State {}\nexport type Health = number;",
  ],
  invalid: [
    'import "./effects";',
    'import { State } from "./state";',
    'export { State } from "./state";',
    'export * from "./state";',
    "const health = 1;",
    "function hit() {}",
    "class State {}",
    "enum Phase { Player }",
    "runBattle();",
    "export default 1;",
  ].map((code) => ({ code, errors: 1 })),
});
