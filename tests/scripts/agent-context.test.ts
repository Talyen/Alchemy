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

import { readDocumentSection } from "../../scripts/lib/document-sections.mjs";

describe("agent discovery", () => {
  it("keeps every owner section and entry point live", () => {
    expect(validateContextCatalog(process.cwd())).toEqual([]);
    for (const task of Object.keys(CONTEXT_TASKS)) {
      const selection = selectContext([], task);
      const sections = contextSections(process.cwd(), selection);
      expect(sections.length).toBeGreaterThan(0);
      expect(Buffer.byteLength(renderContext(selection, sections).text)).toBeLessThanOrEqual(CONTEXT_OUTPUT_BYTES);
    }
  });

  it("routes battle and save work without suppressing safety owners", () => {
    const selection = selectContext(["src/features/alchemy/shared/storage/io.ts"], "battle");
    expect(selection.tasks).toEqual(expect.arrayContaining(["battle", "save"]));
    expect(selection.plan.commands.map((command) => command.key)).toContain("unit-save");
    expect(selection.docs.some((doc) => doc.path.endsWith("MIGRATIONS.md"))).toBe(true);
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
