import { testResourceClass } from "./local-test-lane.mjs";

export function assertHeavyLocalAllowed(label, env = process.env) {
  // CI=true is also set by local Playwright aliases; it is not proof of a hosted run.
  if (env.GITHUB_ACTIONS === "true" || env.ALCHEMY_ALLOW_HEAVY_LOCAL === "1") return;
  throw new Error(
    `${label} belongs to CI. For an explicitly requested local run, set ALCHEMY_ALLOW_HEAVY_LOCAL=1 for that command. Use npm run check for lightweight task checks or test:unit with one or two explicit test files for diagnosis.`,
  );
}

export function assertLocalTestAllowed(command, args, env = process.env) {
  const tool = command
    .split(/[\\/]/u)
    .at(-1)
    .replace(/\.(?:cmd|exe)$/u, "");
  if (tool === "npx") return assertLocalTestAllowed(args[0] ?? "", args.slice(1), env);
  if (!["vitest", "playwright"].includes(tool)) return;
  if (args.includes("--help") || args.includes("-h") || args.includes("--list")) return;
  if (tool === "vitest" && testResourceClass(command, args) === "focused") return;
  assertHeavyLocalAllowed(`${tool} broad or browser verification`, env);
}
