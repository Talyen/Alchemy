import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONTEXT_TASKS,
  contextSections,
  selectContext,
  sourceOutline,
  validateContextCatalog,
} from "../../scripts/lib/agent-context.mjs";
import {
  CONTEXT_OUTPUT_BYTES,
  parseContextArgs,
  renderContext,
  renderSourceOutline,
} from "../../scripts/agent-context.mjs";

import { resolveRoutePlan } from "../../scripts/lib/change-routes.mjs";
import {
  compactMarkdownTables,
  headingSlugs,
  readDocumentSection,
  stripFencedBlocks,
} from "../../scripts/lib/markdown-sections.mjs";

describe("agent discovery", () => {
  it("fits ports and save guidance without losing source coordinates", () => {
    for (const task of ["run-ports", "save", "save-load", "save-write", "save-delete", "save-compatibility"]) {
      const selection = selectContext([], task);
      const sections = contextSections(process.cwd(), selection);
      const rendered = renderContext(selection, sections);
      expect(rendered.included).toEqual(sections);
      expect(rendered.text).not.toContain("Deferred section:");
      expect(Buffer.byteLength(rendered.text)).toBeLessThanOrEqual(CONTEXT_OUTPUT_BYTES);
    }
    const source = "| A       | B      |\n| ------- | ------ |\n```\n| keep    | spaces |\n```";
    const compact = compactMarkdownTables(source);
    expect(compact).toContain("| A | B |\n| --- | --- |");
    expect(compact).toContain("| keep    | spaces |");
    expect(compactMarkdownTables("| Code | Escaped |\n| `a  | b`   | a  \\| b   |")).toContain(
      "| `a  | b` | a  \\| b |",
    );
    expect(compact.split("\n")).toHaveLength(source.split("\n").length);
  });

  it("previews oversized sections without remembering their unseen children", () => {
    const section = {
      path: "guide.md",
      heading: "Contract",
      start: 20,
      end: 27,
      text: "## Contract\nBrief overview.\n### Loading\n" + "x".repeat(15000) + "\n### Writes\nOther rules.",
    };
    const rendered = renderContext({ tasks: [], docs: [], entrypoints: [], plan: { commands: [] } }, [section]);
    expect(rendered.included).toEqual([]);
    expect(rendered.text).toContain("Overview: Brief overview.");
    expect(rendered.text).toContain("guide.md:22: Loading");
    expect(rendered.text).toContain("guide.md:24: Writes");
    expect(rendered.text).not.toContain("x".repeat(100));
  });

  it("keeps test navigation optional and rejects incompatible modes", () => {
    expect(parseContextArgs(["--outline", "test.ts", "--tests"])).toMatchObject({ tests: true });
    expect(parseContextArgs(["--outline", "test.ts", "--test", "suite > case"])).toMatchObject({
      test: "suite > case",
    });
    expect(() => parseContextArgs(["--tests"])).toThrow("--outline");
    expect(() => parseContextArgs(["--outline", "test.ts", "--tests", "--entry", "one"])).toThrow("Choose");
    expect(parseContextArgs(["--json", "--full", "src/App.tsx"])).toMatchObject({ json: true, full: true });
    expect(() => parseContextArgs(["--full", "src/App.tsx"])).toThrow("--full requires --json");
  });

  it("discovers tooling owners for a directory with either path spelling", () => {
    const selected = selectContext(["scripts"]);
    expect(selected.tasks).toContain("tooling");
    expect(selectContext(["scripts/"])).toEqual(selected);
  });

  it("keeps every owner section and entry point live", () => {
    expect(validateContextCatalog(process.cwd())).toEqual([]);
    for (const task of Object.keys(CONTEXT_TASKS)) {
      const selection = selectContext([], task);
      const sections = contextSections(process.cwd(), selection);
      expect(sections.length).toBeGreaterThan(0);
      expect(Buffer.byteLength(renderContext(selection, sections).text)).toBeLessThanOrEqual(CONTEXT_OUTPUT_BYTES);
    }
  });

  it("emits isolated battle and run-state contracts without deferring them", () => {
    for (const [task, headings] of [
      ["battle", ["Battle path", "Engine invariants", "Turn order and resources"]],
      ["run-state", ["Run state", "Gameplay command boundary"]],
    ] as const) {
      const selection = selectContext([], task);
      const sections = contextSections(process.cwd(), selection);
      const rendered = renderContext(selection, sections);
      expect(rendered.included.map((section) => section.heading)).toEqual([...headings]);
      expect(rendered.text).not.toContain("Deferred section:");
      expect(Buffer.byteLength(rendered.text)).toBeLessThanOrEqual(CONTEXT_OUTPUT_BYTES);
    }
    const run = selectContext([], "run-state");
    expect(renderContext(run, contextSections(process.cwd(), run)).text).toContain("--task run-ports");
    expect(readDocumentSection(process.cwd(), "Docs/ARCHITECTURE.md", "Run state").text).not.toContain(
      "## Persistence API",
    );
    for (const heading of [
      "Activity and rewards",
      "Anti-patterns",
      "Run randomness",
      "Persistence API",
      "Session capability ports",
      "Card inspection and combat equipment reservations",
      "Run phase",
      "Run setup ownership",
    ]) {
      expect(readDocumentSection(process.cwd(), "Docs/ARCHITECTURE.md", heading).text).toMatch(/^## /u);
    }
  });

  it("routes content and verification work to direct owners without changing verification", () => {
    for (const [file, task, heading, entry] of [
      [
        "src/lib/game-data/talents/talent-pool-definitions.ts",
        "talent",
        "Add a new talent",
        "src/lib/game-data/talents/manifest-defaults.ts",
      ],
      ["src/lib/game-data/companions.ts", "companion", "Companion Bond", "src/lib/game-data/companions.ts"],
      [
        "src/lib/game-data/compendium/enemies.ts",
        "enemy",
        "Add a new enemy",
        "src/lib/game-data/compendium/enemies.ts",
      ],
      [
        "src/lib/game-data/enemy-abilities.ts",
        "enemy-ability",
        "Enemy abilities",
        "src/lib/battle/enemy-turn-attack.ts",
      ],
      ["src/lib/gear/affix-catalog.ts", "affix", "Data model", "src/lib/gear/affix-pool.ts"],
      [
        "src/lib/game-data/cards/library/archery.ts",
        "card",
        "Add a new card",
        "src/lib/game-data/cards/library/cards.ts",
      ],
      ["src/lib/game-data/effects/registry.ts", "effect", "Adding a kind", "src/lib/game-data/effects/registry.ts"],
      ["scripts/check.mjs", "verification", "Checks / verification (nesting order)", "scripts/check.mjs"],
    ] as const) {
      const selection = selectContext([file]);
      expect(selection.tasks).toContain(task);
      expect(selection.entrypoints).toContain(entry);
      const rendered = renderContext(selection, contextSections(process.cwd(), selection));
      expect(rendered.included.some((section) => section.heading === heading)).toBe(true);
      expect(selection.docs.some((doc) => doc.heading?.startsWith("Directory layout"))).toBe(false);
      expect(selection.plan).toEqual(resolveRoutePlan([file]));
    }
    expect(selectContext(["src/lib/gear/affix-catalog.ts"]).tasks).not.toContain("gear");
    expect(selectContext(["src/lib/game-data/cards/library/archery.ts"]).tasks).not.toContain("effect");
    expect(selectContext(["src/lib/game-data/effects/registry.ts"]).tasks).not.toContain("card");
    expect(selectContext(["scripts/check.mjs"]).entrypoints).not.toContain("scripts/README.md");
    expect(selectContext(["src/features/alchemy/meta/screens/armory/use-armory-controller.ts"]).tasks).toContain(
      "gear",
    );
    const unknown = selectContext(["src/unknown.ts"]);
    expect(unknown.docs.some((doc) => doc.heading?.startsWith("Directory layout"))).toBe(true);
  });

  it("routes constants by concern and retains fallback and mixed save guidance", () => {
    for (const [file, task, heading] of [
      ["audio", "audio", null],
      ["ui-layout", "ui-layout", "Display sizing"],
      ["ui-motion", "ui-motion", "Screen fade motion"],
      ["battle-timing", "ui-motion", "Battle motion"],
      ["storage", "save", "Public save contract"],
      ["run-rewards", "loot", "Loot tuning"],
      ["materials-economy", "materials", "Materials tuning"],
      ["combat-rules", "battle", "Engine invariants"],
    ] as const) {
      const paths = [`src/lib/game-constants/${file}.ts`];
      const selected = selectContext(paths);
      expect(selected.tasks).toContain(task);
      expect(selected.docs.some((doc) => doc.heading === heading)).toBe(true);
      if (task !== "battle") expect(selected.tasks).not.toContain("battle");
      expect(selected.plan).toEqual(resolveRoutePlan(paths));
    }
    const unknown = selectContext(["src/lib/game-constants/future-setting.ts"]);
    expect(unknown.docs.some((doc) => doc.heading?.startsWith("Directory layout"))).toBe(true);
    const mixed = selectContext(["src/lib/game-constants/ui-layout.ts", "src/features/alchemy/shared/storage/io.ts"]);
    expect(mixed.docs.some((doc) => doc.heading === "Public save contract")).toBe(true);
    expect(mixed.plan.commands.map((command) => command.key)).toContain("unit-save");
    const battle = selectContext(["src/lib/battle/damage-calc.ts"]);
    const text = renderContext(battle, contextSections(process.cwd(), battle)).text;
    expect(text).not.toContain("Screen transition:");
    expect(text).toContain("BATTLE_CONTROLLERS.md");
    const controller = selectContext(["src/features/alchemy/shell/use-battle-controller.ts"]);
    expect(controller.tasks).toContain("battle-controller");
    const affix = selectContext(["src/lib/gear/ordinary-affixes.ts"]);
    expect(renderContext(affix, contextSections(process.cwd(), affix)).text).not.toContain("Depth counts locations");
  });

  it("routes battle and save work without suppressing safety owners", () => {
    const selection = selectContext(["src/features/alchemy/shared/storage/io.ts"], "battle");
    expect(selection.tasks).toEqual(expect.arrayContaining(["battle", "save"]));
    expect(selection.plan.commands.map((command) => command.key)).toContain("unit-save");
    expect(selection.docs.some((doc) => doc.path.endsWith("MIGRATIONS.md"))).toBe(true);
    for (const [alternate, canonical] of [
      ["saves", "save"],
      ["cards", "card"],
      ["asset", "assets"],
      ["reward", "rewards"],
    ]) {
      const paths = ["src/features/alchemy/shared/stores/run-session-command.ts"];
      expect(selectContext(paths, alternate)).toEqual(selectContext(paths, canonical));
    }
  });

  it("selects asset operations without deferring their owner or weakening verification", () => {
    for (const [file, heading] of [
      ["scripts/assets/core-assets.mjs", "Add or replace game art"],
      ["Raw Assets/Gear/Sword - Basic.jpeg", "Add or replace Gear art"],
      ["scripts/assets/sound-assets.mjs", "Add or replace sound"],
      ["public/Music/theme.mp3", "Add or replace music"],
      ["scripts/lib/asset-manifest-cache.mjs", "Content freshness and filesystem failures"],
    ]) {
      const selection = selectContext([file ?? ""]);
      const sections = contextSections(process.cwd(), selection);
      const rendered = renderContext(selection, sections);
      expect(rendered.included.some((section) => section.heading === heading)).toBe(true);
      expect(selection.plan.commands.map((command) => command.key)).toContain("assets-check");
      expect(selection.docs.some((doc) => doc.heading === "Agent discovery")).toBe(false);
      expect(selection.docs.some((doc) => doc.path.endsWith("WORKFLOWS-ASSETS.md") && !doc.heading)).toBe(false);
    }
    const selection = selectContext([], "assets");
    expect(renderContext(selection, contextSections(process.cwd(), selection)).text).toContain("--task assets-sound");
  });

  it("emits the artwork constraints when discovering pile sources and their manifest", () => {
    const selection = selectContext(["Raw Assets/Misc/Draw Pile.png", "scripts/assets/core-assets.mjs"]);
    const rendered = renderContext(selection, contextSections(process.cwd(), selection));
    expect(rendered.included.some((section) => section.heading === "Resource and battle UI masters")).toBe(true);
    expect(rendered.text).toContain("Keep pile artwork");
    expect(rendered.text).toContain("Check the actual alpha channel");
    expect(rendered.text).toContain("distinct from the playable Mana Crystals card artwork");
    expect(Buffer.byteLength(rendered.text)).toBeLessThanOrEqual(CONTEXT_OUTPUT_BYTES);
  });

  it("limits specialized instructions to relevant work and keeps safety owners on mixed requests", () => {
    const button = selectContext(["src/features/alchemy/shared/ui/button.tsx"]);
    expect(button.docs.some((doc) => doc.heading === "Overlay lifecycle")).toBe(false);
    const mixed = selectContext(
      [
        "src/features/alchemy/shared/ui/modal-overlay-shell.tsx",
        "src/features/alchemy/shared/stores/run-session-command.ts",
        "scripts/agent-context.mjs",
      ],
      "assets-sound",
    );
    for (const heading of [
      "Overlay lifecycle",
      "Run state",
      "Public save contract",
      "Agent discovery",
      "Add or replace sound",
    ])
      expect(mixed.docs.some((doc) => doc.heading === heading)).toBe(true);
  });

  it("deduplicates nested sections and retains deferred locations in a bounded broad request", () => {
    const selection = selectContext([
      "src/lib/battle/card-play.ts",
      "src/lib/game-data/effects/registry.ts",
      "src/features/alchemy/shared/stores/run-session-command.ts",
      "src/features/alchemy/shared/ui/card-description-ui.tsx",
      "src/features/alchemy/run-loop/shop/shop-transactions.ts",
      "src/features/alchemy/run-loop/navigation/victory-flow.ts",
      "scripts/check.mjs",
    ]);
    const sections = contextSections(process.cwd(), selection);
    const rendered = renderContext(selection, sections);
    expect(Buffer.byteLength(rendered.text)).toBeLessThanOrEqual(CONTEXT_OUTPUT_BYTES);
    expect(rendered.text).toContain("Deferred section:");
    for (const section of sections) {
      expect(sections.filter((other) => other.path === section.path && other.start === section.start)).toHaveLength(1);
    }
  });

  it("extracts declaration locations without losing multiline implementations", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-outline-"));
    try {
      fs.writeFileSync(
        path.join(root, "owner.ts"),
        'import x from "x";\nexport function score() {\n  return 42;\n}\nconst pool = [1, 2];\n',
      );
      expect(sourceOutline(root, "owner.ts")).toEqual([
        expect.objectContaining({
          name: "score",
          start: 2,
          end: 4,
          text: "export function score() {\n  return 42;\n}",
        }),
        expect.objectContaining({ name: "pool", start: 5, end: 5 }),
      ]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("retains asset instructions and runtime fallback when tooling paths are also selected", () => {
    const selected = selectContext(["scripts/optimize-sounds.mjs", "src/App.tsx"]);
    expect(selected.docs).toContainEqual(expect.objectContaining({ path: "Docs/WORKFLOWS-ASSETS.md" }));
    expect(selected.docs).toContainEqual(expect.objectContaining({ path: "Docs/ARCHITECTURE.md" }));
  });

  it("bounds outlines and oversized declarations without exposing partial implementations", () => {
    expect(renderSourceOutline([]).text).toBe("No outline entries found; use a scoped source search.");
    const declarations = Array.from({ length: 1_000 }, (_, index) => ({
      name: `declaration${index}`,
      path: "owner.ts",
      start: index + 1,
      end: index + 1,
      text: "x".repeat(15_000),
    }));
    expect(Buffer.byteLength(renderSourceOutline(declarations).text)).toBeLessThanOrEqual(CONTEXT_OUTPUT_BYTES);
    const rendered = renderSourceOutline(declarations, "declaration0").text;
    expect(rendered).toContain("owner.ts:1-1");
    expect(rendered).not.toContain("x".repeat(100));
  });

  it("does not interpret headings inside code fences as document boundaries", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-section-"));
    try {
      fs.writeFileSync(path.join(root, "owner.md"), "## Selected\n```md\n## Example\n```\nkept\n## Next\nomitted\n");
      expect(readDocumentSection(root, "owner.md", "Selected")).toMatchObject({ start: 1, end: 5 });
      expect(readDocumentSection(root, "owner.md", "Selected").text).toContain("kept");
      expect(() => readDocumentSection(root, "owner.md", "Example")).toThrow("missing");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("tracks fences by character and length across every markdown helper", () => {
    // A ~~~ block is never closed by ```, and a ```` block survives an inner ``` pair.
    const source = [
      "## Visible",
      "~~~md",
      "## Hidden-tilde",
      "```",
      "## Still-hidden",
      "~~~",
      "## Also-visible",
      "````md",
      "```",
      "## Hidden-nested",
      "```",
      "still hidden",
      "````",
      "## Final",
    ].join("\n");
    const slugs = headingSlugs(source);
    expect(slugs.has("visible")).toBe(true);
    expect(slugs.has("also-visible")).toBe(true);
    expect(slugs.has("final")).toBe(true);
    expect(slugs.has("hidden-tilde")).toBe(false);
    expect(slugs.has("still-hidden")).toBe(false);
    expect(slugs.has("hidden-nested")).toBe(false);
    const stripped = stripFencedBlocks(source);
    expect(stripped).toContain("## Visible");
    expect(stripped).toContain("## Also-visible");
    expect(stripped).not.toContain("Hidden-tilde");
    expect(stripped).not.toContain("Hidden-nested");
  });

  it("rejects ambiguous or incomplete command arguments", () => {
    expect(() => parseContextArgs(["--diff", "src/App.tsx"])).toThrow("Choose explicit paths");
    expect(() => parseContextArgs(["--task"])).toThrow("requires a value");
    expect(() => parseContextArgs(["--symbol", "Button"])).toThrow("requires --outline");
    expect(() => selectContext([], "made-up")).toThrow("Unknown task");
  });
});
