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
import { readDocumentSection } from "../../scripts/lib/document-sections.mjs";

describe("agent discovery", () => {
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
    expect(readDocumentSection(process.cwd(), "docs/ARCHITECTURE.md", "Run state").text).not.toContain(
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
      expect(readDocumentSection(process.cwd(), "docs/ARCHITECTURE.md", heading).text).toMatch(/^## /u);
    }
  });

  it("routes content and verification work to direct owners without changing verification", () => {
    for (const [file, task, heading, entry] of [
      [
        "src/lib/game-data/talents/talent-pool-definitions.ts",
        "talent",
        "Add a new talent",
        "src/lib/game-data/talent-effect-manifest.ts",
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
    expect(selected.docs).toContainEqual(expect.objectContaining({ path: "docs/WORKFLOWS-ASSETS.md" }));
    expect(selected.docs).toContainEqual(expect.objectContaining({ path: "docs/ARCHITECTURE.md" }));
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

  it("rejects ambiguous or incomplete command arguments", () => {
    expect(() => parseContextArgs(["--diff", "src/App.tsx"])).toThrow("Choose explicit paths");
    expect(() => parseContextArgs(["--task"])).toThrow("requires a value");
    expect(() => parseContextArgs(["--symbol", "Button"])).toThrow("requires --outline");
    expect(() => selectContext([], "made-up")).toThrow("Unknown task");
  });
});
