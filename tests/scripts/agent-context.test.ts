import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";
import { parseContextArgs } from "../../scripts/agent-context.mjs";
import { selectContext, validateContextCatalog } from "../../scripts/lib/agent/agent-context.mjs";

it("locates mixed owners without reading their contents or selecting tests", () => {
  const selection = selectContext(["src/lib/battle/card-play.ts", "src/lib/audio/sfx.ts"]);
  expect(selection.tasks).toEqual(["battle", "audio"]);
  expect(selection.docs.map((doc) => doc.path)).toContain("Docs/AUDIO.md");
  expect(selection).not.toHaveProperty("plan");
  expect(selection).not.toHaveProperty("sections");
  expect(validateContextCatalog(process.cwd())).toEqual([]);
});

it("rejects obsolete capabilities and ambiguous selections", () => {
  for (const option of ["--outline", "--symbol", "--related", "--session", "--tests", "--full"])
    expect(() => parseContextArgs([option])).toThrow("Unknown context option");
  expect(() => parseContextArgs(["--task"])).toThrow("requires a topic");
  expect(() => parseContextArgs(["--diff", "src"])).toThrow("Choose paths");
  expect(() => selectContext([], "save-load")).toThrow("Unknown task");
  expect(() =>
    execFileSync(process.execPath, ["scripts/agent-context.mjs", "/outside-alchemy.ts"], { stdio: "pipe" }),
  ).toThrow();
});

it("offers topic-only lookup with matching text and JSON pointers", () => {
  const run = (...args: string[]) =>
    execFileSync(process.execPath, ["scripts/agent-context.mjs", ...args], { encoding: "utf8" });
  expect(run()).toContain("Topics:");
  const text = run("--task", "run-state");
  const selection = JSON.parse(run("--task", "run-state", "--json"));
  expect(selection.tasks).toEqual(["run-state"]);
  for (const doc of selection.docs) expect(text).toContain(`Owner: ${doc.path}`);
  for (const file of selection.entrypoints) expect(text).toContain(`Entry: ${file}`);
});
