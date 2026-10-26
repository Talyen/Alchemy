import { testResourceClass } from "./local-test-lane.mjs";

export function assertHeavyLocalAllowed(label, env = process.env) {
  // CI=true is also set by local Playwright aliases; it is not proof of a hosted run.
  if (env.GITHUB_ACTIONS === "true" || env.ALCHEMY_ALLOW_HEAVY_LOCAL === "1") return;
  throw new Error(
    `${label} belongs to CI. For an explicitly requested local run, set ALCHEMY_ALLOW_HEAVY_LOCAL=1 for that command. Use npm run check for lightweight task checks or test:unit with one or two explicit test files for diagnosis.`,
  );
}

export function assertLocalTestAllowed(command, args, env = process.env) {
  if (args[0] === "scripts/run-unit-batch.mjs") return assertHeavyLocalAllowed("Combined task unit tests", env);
  const tool = command
    .split(/[\\/]/u)
    .at(-1)
    .replace(/\.(?:cmd|exe)$/u, "");
  if (tool === "npx") return assertLocalTestAllowed(args[0] ?? "", args.slice(1), env);
  if (!["vitest", "playwright"].includes(tool)) return;
  if (args.includes("--help") || args.includes("-h") || args.includes("--list")) return;
  // The documented single-screen capture is a bounded development preview.
  // Keep arbitrary browser suites and runner overrides behind the CI policy.
  if (
    tool === "playwright" &&
    env.ALCHEMY_VISUAL_SCENARIO_FILE &&
    args[0] === "test" &&
    args[1] === "--config=playwright.scenario.config.ts" &&
    args[2] === "--project=chromium" &&
    (args.length === 3 || (args.length === 4 && args[3] === "--headed"))
  )
    return;
  if (tool === "vitest" && testResourceClass(command, args) === "focused") return;
  assertHeavyLocalAllowed(`${tool} broad or browser verification`, env);
}
