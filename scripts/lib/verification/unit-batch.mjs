import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** Preserve route coverage while running overlapping unit selections once. */
export function batchUnitCommands(plan) {
  const units = plan.commands.filter((command) => command.key === "related" || command.key.startsWith("unit-"));
  if (units.length < 2) return plan;
  const { parseCLI } = require("vitest/node");
  const selection = { related: [], selectors: [] };
  for (const command of units) {
    const offset = command.args.indexOf("vitest");
    const args =
      offset >= 0 ? command.args.slice(offset + 1) : ["run", ...command.args.slice(command.args.indexOf("--") + 1)];
    const { filter, options } = parseCLI(["vitest", ...args]);
    selection[command.key === "related" ? "related" : "selectors"].push(
      ...(command.key === "related" ? options.related : filter),
    );
  }
  for (const key of Object.keys(selection)) selection[key] = [...new Set(selection[key])];
  const batch = {
    key: "unit-batch",
    label: "combined task unit tests",
    reason: units.map((command) => command.label).join(" + "),
    command: process.execPath,
    args: ["scripts/run-compact.mjs", process.execPath, "scripts/run-unit-batch.mjs", JSON.stringify(selection)],
  };
  return {
    ...plan,
    commands: plan.commands.flatMap((command) =>
      command === units[0] ? [batch] : units.includes(command) ? [] : [command],
    ),
  };
}
