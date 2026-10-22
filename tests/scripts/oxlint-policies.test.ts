import { describe, expect, it } from "vitest";
import { lintFixture, lintFixtures } from "../helpers/lint-fixture";

interface PolicyProbe {
  filePath: string;
  code: string;
  lines: number[];
}

function checkPolicy(ruleId: string, probes: PolicyProbe[]) {
  const results = lintFixtures(probes);
  for (const [index, probe] of probes.entries()) {
    const messages = results[index]!.filter((message) => message.ruleId === ruleId);
    expect
      .soft(
        messages.map(({ line }) => line).sort((a, b) => a - b),
        probe.filePath,
      )
      .toEqual(probe.lines);
  }
  return results;
}

function checkPaths(ruleId: string, paths: string[], code: string, lines: number[]) {
  return checkPolicy(
    ruleId,
    paths.map((filePath) => ({ filePath, code, lines })),
  );
}

describe("Oxlint policies", () => {
  it("reserves visit initialization for room entry across route, command, and headless adapters", () => {
    const code = 'import { initializeShopVisit } from "@/features/alchemy/run-loop/run/room-visit-initialization";';
    const paths = [
      "src/app/screen-routes/run-loop-routes.tsx",
      "src/features/alchemy/shell/run-route-actions.ts",
      "src/features/alchemy/run-loop/shop/merchant-shop-commands.ts",
      "src/features/alchemy/run-loop/navigation/alchemy-commands.ts",
      "src/app/playthrough/controller.ts",
      "src/features/alchemy/shared/stores/commands/meta-commands.ts",
    ];
    checkPolicy("no-restricted-imports", [
      ...paths.map((filePath) => ({ filePath, code, lines: [1] })),
      { filePath: "src/features/alchemy/run-loop/run/room-entry-commands.ts", code, lines: [] },
    ]);
  });

  it("bans dot, computed and destructured RNG access while allowing the seeded owner", () => {
    checkPolicy("alchemy/restricted-syntax", [
      {
        filePath: "src/lib/battle/card-play.ts",
        code: [
          "const direct = state.rng;",
          "const next = nextState.rng();",
          'const computed = state["rng"];',
          "const { rng } = state;",
          "const { rng: myRng } = state;",
          "function foo({ rng }) {}",
        ].join("\n"),
        lines: [1, 2, 3, 4, 5, 6],
      },
      {
        filePath: "src/lib/battle/rng.ts",
        code: 'import { getBattleRng } from "./rng"; const x = getBattleRng(state);',
        lines: [],
      },
    ]);
  });

  it("bans dot and computed floor/ceil/trunc but allows round", () => {
    checkPaths(
      "alchemy/restricted-syntax",
      ["src/lib/battle/card-play.ts"],
      [
        'Math.floor(1.5); Math["floor"](1.5);',
        'Math.ceil(1.5); Math["ceil"](1.5);',
        'Math.trunc(1.5); Math["trunc"](1.5);',
        "Math.round(1.5);",
      ].join("\n"),
      [1, 1, 2, 2, 3, 3],
    );
  });

  it("rejects literal randomness and nested command dispatch without mistaking dynamic keys for builtins", () => {
    const code = [
      "Math.random();",
      "const direct = Math.random;",
      'Math["random"]();',
      'const computed = Math["random"];',
      "Math[random]();",
      'import { dispatchGearMutationWithRunHealthSync } from "@/features/alchemy/shared/stores/commands/gear-session-command";',
    ].join("\n");
    const paths = [
      "src/lib/battle/card-play.ts",
      "src/features/alchemy/run-loop/run/progression-commands.ts",
      "src/features/alchemy/run-loop/navigation/example.tsx",
    ];
    const results = checkPaths("alchemy/restricted-syntax", paths, code, [1, 2, 3, 4]);
    for (const [index, messages] of results.entries()) {
      const randomness = messages.filter(({ ruleId }) => ruleId === "alchemy/restricted-syntax");
      expect(
        randomness.every(({ message }) => message.includes("seeded")),
        paths[index],
      ).toBe(true);
      if (paths[index]!.includes("run-loop")) {
        expect(messages.filter(({ ruleId }) => ruleId === "no-restricted-imports").map(({ line }) => line)).toEqual([
          6,
        ]);
      }
    }
  });
});

it("keeps development-only controls out of production browser journeys", () => {
  checkPaths(
    "alchemy/restricted-syntax",
    [
      "tests/e2e/specs/core-gameplay.spec.ts",
      "tests/e2e/specs/draw-discard-animations.spec.ts",
      "tests/e2e/specs/battle-end-turn-canary.spec.ts",
      "performance/scenarios/battle-end-turn.perf.ts",
    ],
    [
      'page.getByRole("button", { name: "Skip Combat" });',
      'page.getByRole("button", { name: "Unlock All" });',
      "battle.skipCombatBtn.click();",
      "battle.skipCombatToVictory();",
    ].join("\n"),
    [1, 2, 3, 4],
  );
});

it("keeps real animation timing in timing canaries", () => {
  const results = checkPaths(
    "alchemy/restricted-syntax",
    ["tests/e2e/specs/draw-discard-animations.spec.ts", "tests/e2e/specs/battle-end-turn-canary.spec.ts"],
    [
      'import { test } from "../../fixtures/e2e"; enableFastMode(page);',
      'test("timing", async ({ page, fastBattle }) => { void fastBattle; });',
      'import { useFastBattle as fast } from "../../fixtures/e2e";',
    ].join("\n"),
    [1, 2, 2, 2, 3],
  );
  for (const messages of results) expect(messages.map(({ ruleId }) => ruleId)).not.toContain("no-restricted-imports");
});

it("keeps context and aggregate exceptions independent from TSX conventions", () => {
  const context = 'import { createContext as context } from "react"; export const value = context(null);';
  const aggregate = "useGameplayStateStore.getState();";
  const paths = [
    "src/features/alchemy/shared/stores/lint-probe.ts",
    "src/features/alchemy/shared/stores/lint-probe.tsx",
    "src/features/alchemy/run-loop/screens/lint-probe.tsx",
    "src/app/app-screen-chrome-context.tsx",
    "src/features/alchemy/shared/context/card-description-context.tsx",
  ];
  checkPolicy(
    "alchemy/restricted-syntax",
    paths.map((filePath) => ({
      filePath,
      code: `${context}\n${aggregate}`,
      lines: [...(filePath.includes("context") ? [] : [1]), ...(filePath.includes("/stores/") ? [] : [2])],
    })),
  );
  checkPaths(
    "alchemy/restricted-syntax",
    [
      "src/features/alchemy/shared/stores/lint-probe.tsx",
      "src/app/app-screen-chrome-context.tsx",
      "src/features/alchemy/shared/context/card-description-context.tsx",
    ],
    [
      "export const template = <div className={`a ${active}`} />;",
      'export const concatenated = <div className={"a " + active} />;',
      'export const valid = <div className={cn("a", active)} />;',
    ].join("\n"),
    [1, 2],
  );
});

it("allows erased type imports while blocking asset-loading imports across browser test categories", () => {
  checkPaths(
    "alchemy/restricted-syntax",
    [
      "tests/e2e/specs/core-gameplay.spec.ts",
      "tests/e2e/specs/draw-discard-animations.spec.ts",
      "tests/helpers/lint-probe.ts",
      "performance/scenarios/battle-end-turn.perf.ts",
    ],
    [
      'import type { Card as TypeCard } from "@/lib/game-data";',
      'import { type Card as InlineCard } from "@/lib/game-data";',
      'import { type Card as MultiCard, type Enemy } from "@/lib/game-data";',
      'import { Card as MixedCard, type Enemy as MixedEnemy } from "@/lib/game-data";',
      'import { Card } from "@/lib/game-data";',
      'import DefaultCards from "@/lib/game-data";',
      'import * as Cards from "@/lib/game-data";',
      'import {} from "@/lib/game-data";',
      'import "@/lib/game-data";',
    ].join("\n"),
    [4, 5, 6, 7, 8, 9],
  );
});

it("checks assertion completeness and awaits while allowing messages and returned promises", () => {
  checkPaths(
    "vitest/valid-expect",
    ["tests/lib/utils.test.ts"],
    [
      'import { it, expect } from "vitest";',
      'it("checks", async () => {',
      "expect(1);",
      "expect(1).toBe;",
      "expect(Promise.resolve(1)).resolves.toBe(1);",
      "expect(1, message).toBe(1);",
      "await expect(Promise.resolve(1)).resolves.toBe(1);",
      "return expect(Promise.resolve(1)).resolves.toBe(1);",
      "});",
    ].join("\n"),
    [3, 4, 5],
  );
});

it("checks desktop globals without allowing DOM access in the main process", () => {
  const paths = ["desktop/main.cjs", "desktop/preload.cjs", "tests/electron/profile.cjs"];
  checkPolicy(
    "no-undef",
    paths.map((filePath) => ({
      filePath,
      code: [
        'consoel.log("boot");',
        "module.exports = { process, Buffer, require, __dirname, Response };",
        'document.getElementById("mock");',
      ].join("\n"),
      lines: filePath === "desktop/preload.cjs" ? [1] : [1, 3],
    })),
  );
});

it("requires suppression reasons in tooling, configuration, desktop and performance files", () => {
  checkPaths(
    "alchemy/require-disable-reason",
    ["lint/plugin.js", "oxlint.config.ts", "desktop/main.cjs", "performance/metrics.ts", "scripts/check.mjs"],
    [
      "// oxlint-disable-next-line eqeqeq",
      "if (value == 1) {}",
      "// oxlint-disable-next-line eqeqeq -- intentional coercion fixture",
      "if (value == 1) {}",
    ].join("\n"),
    [1],
  );
});

it("checks mouse-only actions and focusable controls hidden from assistive technology", () => {
  const file = "src/features/alchemy/shared/ui/lint-probe.tsx";
  const [messages] = lintFixtures([
    {
      filePath: file,
      code: [
        "export const mouseOnly = <div onClick={action} />;",
        "export const button = <button onClick={action} />;",
        'export const hiddenButton = <button aria-hidden="true" />;',
        'export const hiddenLabel = <span aria-hidden="true" />;',
      ].join("\n"),
    },
  ]);
  for (const [rule, line] of [
    ["jsx-a11y/click-events-have-key-events", 1],
    ["jsx-a11y/no-aria-hidden-on-focusable", 3],
  ] as const) {
    expect(
      messages!.filter(({ ruleId }) => ruleId === rule).map(({ line }) => line),
      rule,
    ).toEqual([line]);
  }
});

it("keeps the shipping singleton out of reusable domains and headless careers", () => {
  const code = [
    'import { defaultGameSession } from "@/app/application-session";',
    'export { defaultGameSession } from "@/app/application-session";',
    'const session = import("@/app/application-session");',
    'import { battlePresentation } from "@/app/battle-presentation";',
    'export { battlePresentation } from "@/app/battle-presentation";',
    'const presentation = import("@/app/battle-presentation");',
  ].join("\n");
  const paths = [
    "src/features/alchemy/run-loop/shop/create-shop-actions.ts",
    "src/features/alchemy/shared/stores/commands/battle-commands.ts",
    "src/features/alchemy/shared/storage/bootstrap-save-state.ts",
    "src/app/playthrough/controller.ts",
    "src/app/autosave-lifecycle.ts",
    "src/features/alchemy/shell/use-alchemy-run-controller.ts",
    "src/features/alchemy/shell/use-battle-controller.ts",
    "src/features/alchemy/shell/use-screen-transitions.ts",
    "src/features/alchemy/run-loop/battle/battle-presentation-store.ts",
    "src/features/alchemy/run-loop/battle/use-battle-opening-draw.ts",
    "src/features/alchemy/run-loop/screens/battle-screen/hand.tsx",
  ];
  checkPolicy("alchemy/session-ownership", [
    ...paths.map((filePath) => ({ filePath, code, lines: [1, 2, 3, 4, 5, 6] })),
    ...["src/app/use-app-save-state.ts", "src/App.tsx"].map((filePath) => ({ filePath, code, lines: [] })),
  ]);
});

it("requires explicit sessions in functions and callback contracts", () => {
  checkPaths(
    "alchemy/session-ownership",
    ["src/features/alchemy/shared/stores/commands/battle-commands.ts"],
    [
      'import type { GameSession as Career } from "./game-session-types";',
      "function optional(session?: Career) {}",
      "const fallback = (session: Career = other) => {};",
      "type Command = (session?: Career) => void;",
      "interface Commands { endTurn(session?: Career): void; }",
      "function required(session: Career) {}",
    ].join("\n"),
    [2, 3, 4, 5],
  );
});

it("preserves layer boundaries and their owning exceptions", () => {
  const cases = [
    ["src/lib/probe.ts", 'import { view } from "@/features/alchemy/meta/view"; import React from "react";', [1, 1]],
    ["src/features/alchemy/meta/probe.ts", 'import { flow } from "@/features/alchemy/run-loop/flow";', [1]],
    ["src/features/alchemy/run-setup/probe.ts", 'import { flow } from "@/features/alchemy/run-loop/flow";', [1]],
    ["src/features/alchemy/run-loop/probe.ts", 'import { setup } from "@/features/alchemy/run-setup/setup";', [1]],
    [
      "src/features/alchemy/shared/ui/probe.tsx",
      'import { state } from "@/features/alchemy/shared/stores/react/gameplay-state-store";',
      [1, 1],
    ],
    [
      "src/features/alchemy/run-loop/read-probe.ts",
      'import { readGameplayState } from "@/features/alchemy/shared/stores/session/gameplay-state-reads";',
      [1],
    ],
    [
      "src/features/alchemy/shared/ui/read-probe.tsx",
      'import { useHasActiveRun } from "@/features/alchemy/shared/stores/react/use-run-reads";',
      [1],
    ],
    ["src/features/alchemy/meta/screens/probe.tsx", 'import { navigation } from "@/app/use-app-navigation";', [1]],
    ...["session", "commands", "persistence"].flatMap(
      (group) =>
        [
          [`src/features/alchemy/shared/stores/${group}/probe.ts`, 'import { useMemo } from "react";', [1]],
          [
            `src/features/alchemy/shared/stores/${group}/adapter-probe.ts`,
            'import { useUiStore } from "../react/ui-store";',
            [1],
          ],
        ] as const,
    ),
    ["src/lib/balance/probe.ts", 'import { createBattleState } from "@/lib/battle";', [1]],
    [
      "src/features/alchemy/shared/storage/persistence.ts",
      'import { runtime } from "../stores/session/session-runtime";',
      [],
    ],
    ["src/features/alchemy/shared/storage/io.ts", 'import { runtime } from "../stores/session/session-runtime";', []],
  ] as const;
  checkPolicy(
    "no-restricted-imports",
    cases.map(([filePath, code, lines]) => ({ filePath, code, lines: [...lines] })),
  );
});

it("runs type-aware correctness checks through the installed companion", () => {
  const messages = lintFixture(
    "src/type-probe.ts",
    `
    declare const unsafe: any;
    export const value: string = unsafe;
    declare function save(): Promise<void>;
    save();
    type Choice = "a" | "b";
    declare const choice: Choice;
    switch (choice) { case "a": break; }
  `,
    { typeAware: true },
  );
  for (const rule of [
    "typescript/no-unsafe-assignment",
    "typescript/no-floating-promises",
    "typescript/switch-exhaustiveness-check",
  ]) {
    expect(
      messages.some((message) => message.ruleId === rule),
      rule,
    ).toBe(true);
  }
});

it("loads the complexity audit with advisory warnings while normal lint stays unchanged", () => {
  const code = `export function branch(value: number) {
${Array.from({ length: 12 }, (_, i) => `if (value === ${i}) return ${i};`).join("\n")}
${"value += 1;\n".repeat(52)}return value;
}`;
  const normal = lintFixture("src/probe.ts", code);
  expect(normal.filter((message) => ["complexity", "max-lines-per-function"].includes(message.ruleId))).toEqual([]);
  const audit = lintFixture("src/probe.ts", code, { config: "lint/audit.config.ts" });
  for (const rule of ["complexity", "max-lines-per-function"])
    expect(
      audit.some((message) => message.ruleId === rule),
      rule,
    ).toBe(true);
});

it("ignores other worktrees and rejects stale suppression comments", () => {
  const [ignored, messages] = lintFixtures(
    [
      { filePath: ".worktrees/other/src/probe.ts", code: "this is invalid syntax" },
      {
        filePath: "src/probe.ts",
        code: "// oxlint-disable-next-line no-console -- interop seam\nexport const value = 1;",
      },
    ],
    { unused: "error" },
  );
  expect(ignored).toEqual([]);
  expect(messages!.some((message) => message.message.includes("Unused oxlint-disable"))).toBe(true);
});

it("keeps save validation out of run domain contracts, including erased type imports", () => {
  checkPolicy("no-restricted-imports", [
    {
      filePath: "src/lib/active-run-session/probe.ts",
      code: [
        'import { ActiveRunDataSchema } from "@/lib/validation"; export { ActiveRunDataSchema };',
        'import type { ParsedActiveRunData as Alias } from "@/lib/validation"; export type Progress = Alias;',
        'import type { ParsedActiveRunData as Relative } from "../validation"; export type RelativeProgress = Relative;',
        'import type { ParsedActiveRunData as Deep } from "../validation/save-schemas/active-run"; export type DeepProgress = Deep;',
      ].join("\n"),
      lines: [1, 1, 2, 3, 4],
    },
    {
      filePath: "src/lib/validation/probe.ts",
      code: 'import type { ActiveRunData } from "@/lib/active-run-session"; export type Save = ActiveRunData;',
      lines: [],
    },
  ]);
});

it("enforces storage ownership through the shipping configuration", () => {
  const code = [
    'localStorage.setItem("save", "{}");',
    'globalThis.sessionStorage.removeItem("save");',
    "const { localStorage: storage } = window;",
    'function scoped(localStorage: Storage) { return localStorage.getItem("save"); }',
  ].join("\n");
  checkPolicy("alchemy/no-unowned-web-storage", [
    { filePath: "src/features/alchemy/run-loop/screens/destination-screen.tsx", code, lines: [1, 2, 3] },
    { filePath: "src/lib/platform-save-backend.ts", code, lines: [] },
    { filePath: "src/features/alchemy/shared/storage/preferences.ts", code, lines: [] },
  ]);
});

it("keeps generic Gear mutation out of consumers while allowing domain commands", () => {
  checkPaths(
    "no-restricted-imports",
    [
      "src/app/playthrough/meta-offers.ts",
      "src/features/alchemy/meta/screens/armory-screen.tsx",
      "src/features/alchemy/run-loop/run/reward-commands.ts",
    ],
    [
      'import * as gearInternals from "@/features/alchemy/shared/stores/commands/gear-session-command";',
      'import * as gearActions from "@/features/alchemy/shared/stores/commands/gear-actions";',
      'import { salvageGear } from "@/features/alchemy/shared/stores/commands/gear-commands";',
    ].join("\n"),
    [1, 2],
  );
});
