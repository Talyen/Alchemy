import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { finishTerminalPlans } from "../../scripts/finish-plans.mjs";
import { parsePlanMetadata } from "../../scripts/lib/plan-checks.mjs";
import { planTemplate, safePlanName } from "../../scripts/new-plan.mjs";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});
function fixture() {
  const plansDir = fs.mkdtempSync(path.join(os.tmpdir(), "alchemy-plans-"));
  roots.push(plansDir);
  const write = (name: string, status: string) =>
    fs.writeFileSync(
      path.join(plansDir, name),
      planTemplate(name, "2026-10-05").replace("status: active", `status: ${status}`),
    );
  write("Complete.md", "complete");
  write("Cancelled.md", "cancelled");
  write("Active.md", "active");
  write("Blocked.md", "blocked\nreason: pending approval");
  fs.writeFileSync(path.join(plansDir, "Unrelated.md"), "unfinished metadata");
  return { plansDir, write };
}

it("deletes only named terminal plans, with a non-mutating preview and no archive", () => {
  const { plansDir } = fixture();
  const before = fs.readdirSync(plansDir);
  const names = ["Complete.md", "Cancelled.md"];
  expect(finishTerminalPlans({ plansDir, names, dryRun: true })).toEqual(names.map((n) => path.join("Docs/Plans", n)));
  expect(fs.readdirSync(plansDir)).toEqual(before);
  finishTerminalPlans({ plansDir, names });
  expect(fs.readdirSync(plansDir)).toEqual(["Active.md", "Blocked.md", "Unrelated.md"]);
});

it.each(
  [[], ["Missing.md"], ["Active.md"], ["Blocked.md"], ["../Complete.md"], ["README.md"], ["Unrelated.md"]].map(
    (invalid) => ({ invalid }),
  ),
)("preflights the full selection without deleting earlier valid plans: %j", ({ invalid }) => {
  const { plansDir } = fixture();
  const names = invalid.length ? ["Complete.md", ...invalid] : [];
  const before = fs.readdirSync(plansDir);
  expect(() => finishTerminalPlans({ plansDir, names })).toThrow();
  expect(fs.readdirSync(plansDir)).toEqual(before);
});

it("rejects duplicate statuses and symlinked plans without deleting selected work", () => {
  const { plansDir, write } = fixture();
  write("Conflict.md", "active\nstatus: complete");
  expect(() => finishTerminalPlans({ plansDir, names: ["Complete.md", "Conflict.md"] })).toThrow(
    "duplicate metadata key",
  );
  fs.symlinkSync(path.join(plansDir, "Complete.md"), path.join(plansDir, "Linked.md"));
  expect(() => finishTerminalPlans({ plansDir, names: ["Complete.md", "Linked.md"] })).toThrow("regular file");
  expect(fs.existsSync(path.join(plansDir, "Complete.md"))).toBe(true);
});

it("requires blocked reasons, valid dates and safe scaffold names", () => {
  expect(parsePlanMetadata(planTemplate("Example", "2026-02-31")).errors).toContain("updated must be an ISO date");
  expect(parsePlanMetadata(planTemplate("Example", "2026-10-05").replace("active", "blocked")).errors).toContain(
    "blocked plans require reason",
  );
  expect(() => safePlanName("../unsafe")).toThrow();
});
