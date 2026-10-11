import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { expect, it } from "vitest";
import { parseContextArgs } from "../../scripts/agent-context.mjs";
import { selectContext, validateContextCatalog } from "../../scripts/lib/agent/agent-context.mjs";

it("locates source and document owners and validates their canonical references", () => {
  const selection = selectContext(["src/lib/battle/card-play.ts", "src/lib/audio/sfx.ts"]);
  expect(selection.tasks).toEqual(["battle", "audio"]);
  expect(selection.docs.map((doc) => doc.path)).toContain("Docs/AUDIO.md");
  expect(validateContextCatalog(process.cwd())).toEqual([]);
  expect(selectContext(["Docs/GAME_RULES.md"]).tasks).toEqual(["battle"]);
  expect(selectContext(["Docs/UI.md"]).tasks).toEqual(["ui"]);
  expect(selectContext(["tests/lib/battle/card-play.test.ts"]).tasks).toEqual(["battle"]);
  expect(selectContext(["src/app/autosave-lifecycle.ts"]).tasks).toEqual(["run-state"]);
  expect(selectContext(["src/app/playthrough/career.ts", "tests/playthrough/careers.test.ts"]).tasks).toEqual([
    "playthrough",
  ]);
  expect(selectContext(["AGENTS.md"]).docs.map((doc) => doc.path)).toContain("Docs/AGENT_DISCOVERY.md");
  const verification = selectContext(["scripts/check.mjs"]);
  expect(verification.docs).toEqual([
    { path: "CONTRIBUTING.md", heading: "What to run when you change…" },
    { path: "scripts/VERIFICATION.md", heading: "Checks / verification (nesting order)" },
  ]);
});

it("replaces general fallback reads with focused owners while retaining contracts for mixed changes", () => {
  for (const [source, task, heading] of [
    ["src/lib/settings-values.ts", "settings", "Settings and meta profile"],
    ["src/features/alchemy/run-loop/shop/shop-pricing.ts", "shop", "Shop commands"],
    ["src/lib/homestead/material-rewards.ts", "progression", "Materials tuning"],
    ["src/lib/loot/progression.ts", "rewards", "Loot tuning"],
  ] as const) {
    for (const file of [source, source.replace(/^src\//u, "tests/").replace(/\.ts$/u, ".test.ts")]) {
      const selection = selectContext([file]);
      expect(selection.tasks).toContain(task);
      expect(selection.docs.some((doc) => doc.heading === heading)).toBe(true);
      expect(selection.docs).not.toContainEqual({ path: "Docs/ARCHITECTURE.md", heading: null });
    }
  }
  const mixed = selectContext([
    "src/features/alchemy/shared/stores/settings-store.ts",
    "src/features/alchemy/run-loop/navigation/reward-flow.ts",
  ]);
  expect(mixed.tasks).toEqual(expect.arrayContaining(["run-state", "settings", "rewards"]));
  expect(mixed.docs.map((doc) => doc.path)).toContain("Docs/RUN_STATE.md");
  const unknown = selectContext(["src/lib/settings-values.ts", "src/lib/unindexed-owner.ts"], "shop");
  expect(unknown.tasks).toEqual(expect.arrayContaining(["settings", "shop"]));
  expect(unknown.docs.filter((doc) => doc.path === "Docs/ARCHITECTURE.md")).toEqual([
    { path: "Docs/ARCHITECTURE.md", heading: null },
  ]);
});

it("rejects obsolete capabilities and ambiguous selections", () => {
  for (const option of ["--outline", "--symbol", "--related", "--session", "--tests", "--full"])
    expect(() => parseContextArgs([option])).toThrow("Unknown context option");
  expect(() => parseContextArgs(["--task"])).toThrow("requires a topic");
  expect(() => parseContextArgs(["--task", "battle", "--task", "--json"])).toThrow("requires a topic");
  expect(() => parseContextArgs(["--diff", "src"])).toThrow("Choose paths");
  expect(() => selectContext([], "save-load")).toThrow("Unknown task");
  expect(() => selectContext([], ["battle", "save-load"])).toThrow("Unknown task");
  expect(() =>
    execFileSync(process.execPath, ["scripts/agent-context.mjs", "/outside-alchemy.ts"], { stdio: "pipe" }),
  ).toThrow();
});

it("offers topic-only lookup with matching text and JSON pointers", () => {
  const run = (...args: string[]) =>
    execFileSync(process.execPath, ["scripts/agent-context.mjs", ...args], { encoding: "utf8" });
  expect(run()).toContain("Topics:");
  const text = run("--task", "battle");
  const selection = JSON.parse(run("--task", "battle", "--json"));
  expect(selection.tasks).toEqual(["battle"]);
  for (const doc of selection.docs) {
    expect(text).toContain(`Owner: ${doc.path}:${doc.start}-${doc.end}`);
    const lines = fs.readFileSync(doc.path, "utf8").split(/\r?\n/u);
    expect(lines[doc.start - 1]).toMatch(/^#+ /u);
    if (doc.heading) {
      expect(lines[doc.start - 1]).toBe(`## ${doc.heading}`);
      expect(lines[doc.end]).toMatch(/^## /u);
    } else expect(doc.end).toBe(lines.length);
  }
  for (const file of selection.entrypoints) expect(text).toContain(`Entry: ${file}`);
  const combined = JSON.parse(
    run("--task", "settings", "--task", "shop", "--task", "settings", "src/lib/battle/card-play.ts", "--json"),
  );
  expect(combined.tasks).toEqual(["battle", "settings", "shop"]);
  expect(combined.docs).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ path: "Docs/GAME_RULES.md" }),
      expect.objectContaining({ path: "Docs/ARCHITECTURE.md", heading: "Settings and meta profile" }),
      expect.objectContaining({ path: "Docs/ARCHITECTURE.md", heading: "Shop commands" }),
    ]),
  );
  expect(
    new Set(combined.docs.map((doc: { path: string; heading: string }) => `${doc.path}#${doc.heading}`)).size,
  ).toBe(combined.docs.length);
});
