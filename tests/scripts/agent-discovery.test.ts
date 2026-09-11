import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { incrementalContext, relatedLocations, repositorySearch } from "../../scripts/lib/agent-discovery.mjs";
import { checkDurableDocumentReachability } from "../../scripts/check-documentation-contract.mjs";
import { searchMain } from "../../scripts/agent-search.mjs";
import { sourceOutline } from "../../scripts/lib/agent-context.mjs";
import { failureSummary } from "../../scripts/lib/compact-output.mjs";

const roots: string[] = [];
function fixture(files: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-discovery-"));
  roots.push(root);
  for (const [file, source] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), source);
  }
  return root;
}
afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("targeted discovery", () => {
  it("finds stable IDs and keyed entries without evaluating code, preserving duplicate IDs", () => {
    const root = fixture({
      "pool.ts": `const pool = [{ id: "one", effects: [run()] }, { id: "one", value: 2 }] satisfies Entry[];
const keyed = { "two": { value: 3 }, three: { value: 4 } };`,
    });
    const entries = sourceOutline(root, "pool.ts", { entries: true });
    expect(entries.map((entry) => entry.name)).toEqual(["one", "one", "two", "three"]);
    expect(entries[0]?.text).toBe('{ id: "one", effects: [run()] }');
    expect(entries[2]?.text).toBe('"two": { value: 3 }');
  });

  it("shares diagnostic space across failed checkers despite a noisy first failure", () => {
    const output = [
      ...Array.from(
        { length: 100 },
        (_, index) => `[static] [typecheck] [0] src/owner.ts(${index + 1},1): error TS2322: wrong type`,
      ),
      "[static] [typecheck] [0] src/lib/math.ts(3,3): error TS2322: root return type mismatch",
      "[static] [typecheck] [0] tsc --noEmit exited with code 1",
      "[static] [typecheck] npm run typecheck:all exited with code 1",
      "[static] [format] [warn] src/other.ts",
      "[static] [format] [warn] Code style issues found in the above file.",
      "[static] [format] npm run format:check exited with code 1",
      "[knip] Unused dependencies (1)",
      "[knip] example-dependency package.json:1:1",
      "[knip] npm run deadcode exited with code 1",
      "[static] npm run check:static exited with code 1",
    ].join("\n");
    const summary = failureSummary(output);
    expect(Buffer.byteLength(summary)).toBeLessThanOrEqual(4_000);
    expect(summary).toContain("TS2322");
    expect(summary).toContain("L1: src/owner.ts(1,1)");
    expect(summary).toContain("L101: src/lib/math.ts(3,3)");
    expect(summary).toContain("[warn] src/other.ts");
    expect(summary).toContain("example-dependency");
    expect(summary).toContain("L104: [warn] src/other.ts");
    const locations = [...summary.matchAll(/^L(\d+):/gmu)].map((match) => Number(match[1]));
    expect(locations).toEqual(locations.toSorted((a, b) => a - b));
    expect(summary).toContain("diagnostic lines omitted");
    expect(summary.match(/^Failed /gmu)).toHaveLength(3);
  });

  it("preserves unrecognized checker errors instead of selecting only their exit footers", () => {
    const output = [
      "[docs] Documentation contracts failed:",
      "[docs] - missing owner heading: docs/UI.md#Overlay lifecycle",
      "[docs] Plan checks passed (0 plan files).",
      "[docs] npm run docs:check exited with code 1",
      "[static] [boundaries] error no-circular: src/a.ts → src/b.ts → src/a.ts",
      ...Array.from({ length: 100 }, () => "[static] [boundaries] "),
      "[static] [boundaries] x 1 dependency violations (1 errors, 0 warnings). 2 modules, 2 dependencies cruised.",
      "[static] [boundaries] ",
      "[static] [boundaries] npm run lint:boundaries exited with code 1",
      "[static] npm run check:static exited with code 1",
    ].join("\n");
    const summary = failureSummary(output, 1_000);
    expect(summary).toContain("L2: - missing owner heading: docs/UI.md#Overlay lifecycle");
    expect(summary).toContain("L5: error no-circular: src/a.ts → src/b.ts → src/a.ts");
    expect(summary).toContain("1 dependency violations");
    expect(summary.match(/^Failed /gmu)).toHaveLength(2);
    expect(summary).toContain("diagnostic lines omitted");
    expect(Buffer.byteLength(summary)).toBeLessThanOrEqual(1_000);
  });

  it("suppresses only remembered sections and refreshes on edits, new sessions, or explicit reset", () => {
    const root = fixture({});
    const section = { path: "doc.md", start: 1, end: 1, text: "original" };
    incrementalContext(root, "one", [section]).remember([]);
    expect(incrementalContext(root, "one", [section]).omitted).toBe(0);
    incrementalContext(root, "one", [section]).remember([section]);
    expect(incrementalContext(root, "one", [section]).omitted).toBe(1);
    expect(incrementalContext(root, "two", [section]).omitted).toBe(0);
    expect(incrementalContext(root, "one", [{ ...section, text: "changed" }]).omitted).toBe(0);
    expect(incrementalContext(root, "one", [section], { refresh: true }).omitted).toBe(0);
    expect(() => incrementalContext(root, "../escape", [section])).toThrow("Invalid");
  });

  it("searches literal text with safe argument handling, bounded callers, and explicit excluded-file access", () => {
    const root = fixture({
      "src/block.ts": 'const needle = "a.b";',
      "reports/noise.txt": "a.b",
      "package-lock.json": "a.b",
      "src/other.ts": "axb",
    });
    expect(repositorySearch(root, { pattern: "a.b" })).toEqual(["src/block.ts"]);
    expect(repositorySearch(root, { pattern: "a.b", excerpts: true })).toEqual([
      { path: "src/block.ts", start: 1, end: 1, text: 'const needle = "a.b";' },
    ]);
    expect(repositorySearch(root, { pattern: "a.b", paths: ["reports"], includeExcluded: true })).toEqual([
      "reports/noise.txt",
    ]);
    expect(repositorySearch(root, { pattern: "$(touch surprise)" })).toEqual([]);
    expect(fs.existsSync(path.join(root, "surprise"))).toBe(false);
    expect(() => repositorySearch(root, { pattern: "[", regex: true })).toThrow();
  });

  it("derives consumers, tests and fixture imports through aliases and reexports", () => {
    const root = fixture({
      "tsconfig.json": JSON.stringify({ compilerOptions: { paths: { "@/*": ["./src/*"] } } }),
      "src/owner.ts": "export const value = 1;",
      "src/index.ts": 'export { value } from "./owner";',
      "tests/owner.test.ts": 'import { value } from "@/index"; import { setup } from "./fixture";',
      "tests/fixture.ts": "export const setup = 1;",
      "tests/unrelated.test.ts": "export {};",
    });
    expect(relatedLocations(root, ["src/owner.ts"])).toEqual({
      consumers: ["src/index.ts"],
      tests: ["tests/owner.test.ts"],
      fixtures: ["tests/fixture.ts"],
    });
  });

  it("preserves failures in the middle of noisy logs, with exact full-log line references", () => {
    const output = [
      ...Array<string>(100).fill("setup noise"),
      "FAIL tests/example.test.ts > native behavior",
      "AssertionError: expected 1 to equal 2",
      "Expected: 2",
      "Received: 1",
      "src/owner.ts(4,2): error TS2322: wrong type",
      ...Array<string>(500).fill("teardown noise"),
    ].join("\n");
    const summary = failureSummary(output);
    expect(summary).toContain("L101: FAIL tests/example.test.ts > native behavior");
    expect(summary).toContain("Expected: 2");
    expect(summary).toContain("TS2322");
    expect(Buffer.byteLength(summary)).toBeLessThanOrEqual(4_000);
    expect(failureSummary("unfamiliar tool failed")).toBe("unfamiliar tool failed");
    expect(failureSummary("AssertionError: " + "界".repeat(5_000))).toContain("AssertionError");
    const lint = failureSummary("/repo/src/file.ts\n\n  12:4  error  wrong boundary  alchemy/boundary\n");
    expect(lint).toContain("/repo/src/file.ts");
    expect(lint).toContain("alchemy/boundary");
    expect(failureSummary("[lint] /repo/src/file.ts\n[lint] \n[lint] 12:4 error wrong boundary\n")).toContain(
      "/repo/src/file.ts",
    );
  });
});

it("reports search truncation and long-line pointers instead of exposing large source payloads", () => {
  const root = fixture({
    "many.ts": Array<string>(60).fill("needle").join("\n"),
    "long.ts": "needle" + "x".repeat(9_000),
  });
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  expect(searchMain(["--excerpts", "needle"], root)).toBe(0);
  const output = String(log.mock.calls[0]?.[0]);
  expect(Buffer.byteLength(output)).toBeLessThanOrEqual(8_000);
  expect(output).toContain("61 matches; 40 shown");
  expect(output).toContain("long.ts:1: [long line omitted");
  expect(output).not.toContain("x".repeat(100));
  expect(searchMain(["--include-excluded", "needle"], root)).toBe(2);
  expect(error).toHaveBeenCalledWith(expect.stringContaining("explicit path"));
});

it("keeps isolated worktree documentation out of repository reachability checks", () => {
  const root = fixture({
    "README.md": "[Guide](./docs/guide.md)",
    "docs/guide.md": "Reachable guide",
    "docs/orphan.md": "Actual orphan",
    ".worktrees/eval/README.md": "Isolated checkout",
    ".worktrees/eval/docs/unlinked.md": "Not this repository's documentation",
  });
  expect(checkDurableDocumentReachability(root)).toEqual(["docs/orphan.md"]);
});
