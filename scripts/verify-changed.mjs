#!/usr/bin/env node
/**
 * Route the smallest complete verification set for the paths being changed.
 * The route catalog is executable so documentation can describe intent without
 * copying long, drift-prone command strings.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { firstOutputLine, tailOutput, writeDiagnosticLog } from "./lib/compact-output.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORTS_DIR = path.join(ROOT, "reports", "verify-changed");
const NPM = process.platform === "win32" ? "npm.cmd" : "npm";
const E2E_ESCALATIONS = Object.freeze({
  save: "e2e-save",
  "shop-screen": "e2e-shop",
  audio: "e2e-audio",
  gear: "e2e-gear",
  mystery: "e2e-mystery",
});
const E2E_NAMES = new Set(["save", "shop", "audio", "gear", "mystery"]);

const COMMANDS = Object.freeze({
  "unit-active": {
    label: "active-run unit tests",
    command: NPM,
    args: [
      "test",
      "--",
      "tests/app/use-alchemy-bootstrap.test.ts",
      "tests/app/use-rendered-screen-transition.test.ts",
      "tests/features/alchemy/shared/stores/run-domain-progress.test.ts",
      "tests/features/alchemy/shared/stores/run-domain-resume.test.ts",
      "tests/features/alchemy/shared/stores/run-domain-session.test.ts",
      "tests/features/alchemy/shared/stores/run-session-model.test.ts",
      "tests/features/alchemy/shared/stores/run-session-port-exports.test.ts",
      "tests/features/alchemy/shared/stores/run-session-read-port.test.ts",
      "tests/features/alchemy/shared/stores/run-session-transaction.test.ts",
      "tests/features/alchemy/shared/stores/gold-purse.test.ts",
      "tests/features/alchemy/shared/stores/run-screen-data.test.tsx",
      "tests/features/alchemy/shared/stores/run-park-restore.test.ts",
      "tests/features/alchemy/shared/stores/run-meta-rebind.test.ts",
      "tests/features/alchemy/shared/stores/parked-runs.test.ts",
      "tests/features/alchemy/shared/stores/reset.test.ts",
      "tests/features/alchemy/shared/stores/select-autosave-allowed.test.ts",
      "tests/features/alchemy/shared/ui/fade-slot.test.tsx",
      "tests/features/alchemy/shared/ui/use-sequential-fade-swap.test.ts",
      "tests/features/alchemy/shell/",
      "tests/types/run-architecture-contracts.test.ts",
    ],
  },
  "unit-save": {
    label: "save/persistence unit tests",
    command: NPM,
    args: [
      "test",
      "--",
      "tests/features/alchemy/shared/storage",
      "tests/features/alchemy/app/autosave-hook.test.ts",
      "tests/features/alchemy/app/autosave-active-run.test.ts",
    ],
  },
  "unit-battle": {
    label: "battle/card unit tests",
    command: NPM,
    args: [
      "test",
      "--",
      "tests/lib/battle",
      "tests/features/alchemy/run-loop/battle",
      "tests/app/use-battle-playback.test.ts",
      "tests/lib/game-data/descriptions-match-effects.test.ts",
      "tests/lib/game-data/talent-pool.test.ts",
      "tests/lib/game-data/talent-effect-invariants.test.ts",
    ],
  },
  "unit-balance": { label: "balance unit tests", command: NPM, args: ["test", "--", "tests/lib/balance"] },
  "unit-shop": {
    label: "shop unit tests",
    command: NPM,
    args: [
      "test",
      "--",
      "tests/features/alchemy/run-loop/shop",
      "tests/features/alchemy/run-loop/screens/alchemist-shop-screen.test.tsx",
      "tests/features/alchemy/run-loop/screens/merchant-shop-screen.test.tsx",
    ],
  },
  "unit-audio": {
    label: "audio unit tests",
    command: NPM,
    args: [
      "test",
      "--",
      "tests/lib/audio-sfx.test.ts",
      "tests/lib/audio-sfx-playback.test.ts",
      "tests/lib/audio-buffer-cache.test.ts",
      "tests/lib/sound-assets.test.ts",
    ],
  },
  "unit-routing": {
    label: "routing unit tests",
    command: NPM,
    args: [
      "test",
      "--",
      "tests/lib/routing",
      "tests/features/alchemy/shell/use-screen-transitions.test.ts",
      "tests/app/use-rendered-screen-transition.test.ts",
      "tests/app/use-battle-playback.test.ts",
    ],
  },
  "unit-gear": {
    label: "gear unit tests",
    command: NPM,
    args: [
      "test",
      "--",
      "tests/lib/gear",
      "tests/architecture/affix-catalog-guard.test.ts",
      "tests/architecture/gear-ranged-tags.test.ts",
      "tests/architecture/gear-affix-pool.test.ts",
      "tests/features/alchemy/shared/stores/gear-store.test.ts",
      "tests/features/alchemy/shared/stores/gear-crafting.test.ts",
      "tests/features/alchemy/meta/screens/armory",
      "tests/features/alchemy/shared/storage/gear-save.test.ts",
    ],
  },
  "unit-mystery": {
    label: "mystery-flow unit tests",
    command: NPM,
    args: [
      "test",
      "--",
      "tests/features/alchemy/run-loop/navigation/mystery-flow.test.ts",
      "tests/features/alchemy/shell/use-mystery-event-navigation.test.ts",
      "tests/features/alchemy/app/mystery-route.test.tsx",
      "tests/lib/mystery",
      "tests/lib/active-run-session/mystery-visit-persistence.test.ts",
      "tests/features/alchemy/shared/storage/active-run-data.test.ts",
      "tests/features/alchemy/shared/stores/run-domain-resume.test.ts",
      "tests/features/alchemy/run-loop/screens/mystery",
      "tests/features/alchemy/run-loop/screens/mystery-event-intro.test.tsx",
      "tests/features/alchemy/run-loop/screens/mystery-reward-summary.test.tsx",
    ],
  },
  "unit-integration": {
    label: "integration-style unit tests",
    command: NPM,
    args: [
      "test",
      "--",
      "tests/features/alchemy/shared/stores/run-domain-progress.test.ts",
      "tests/features/alchemy/shared/stores/run-domain-resume.test.ts",
      "tests/features/alchemy/shared/stores/run-domain-session.test.ts",
      "tests/features/alchemy/shared/storage",
      "tests/features/alchemy/run-loop/navigation/reward-flow-selection.test.ts",
      "tests/features/alchemy/run-loop/navigation/reward-flow.test.ts",
      "tests/features/alchemy/shell",
    ],
  },
  boundary: { label: "import-boundary lint", command: NPM, args: ["run", "lint:boundaries"] },
  "e2e-prepush": { label: "Playwright pre-push canary", command: NPM, args: ["run", "test:e2e:prepush"] },
  "e2e-save": {
    label: "save Playwright flow",
    command: "npx",
    args: ["playwright", "test", "tests/save-persistence.spec.ts", "--project", "chromium"],
  },
  "e2e-shop": {
    label: "shop Playwright flow",
    command: "npx",
    args: ["playwright", "test", "tests/shop-and-rewards.spec.ts", "--project", "chromium"],
  },
  "e2e-audio": {
    label: "audio Playwright flow",
    command: "npx",
    args: ["playwright", "test", "tests/audio-sfx.spec.ts", "--project", "chromium"],
  },
  "e2e-gear": {
    label: "gear Playwright flows",
    command: "npx",
    args: ["playwright", "test", "tests/armory-crafting.spec.ts", "tests/gear-equip.spec.ts", "--project", "chromium"],
  },
  "e2e-mystery": {
    label: "mystery Playwright flow",
    command: "npx",
    args: ["playwright", "test", "tests/destination-progression.spec.ts", "-g", "Mystery", "--project", "chromium"],
  },
  typecheck: { label: "TypeScript typecheck", command: NPM, args: ["run", "typecheck"] },
  "docs-check": { label: "documentation and plan checks", command: NPM, args: ["run", "docs:check"] },
  "ci-routing": { label: "CI path-filter contract", command: NPM, args: ["run", "ci:routing"] },
  full: { label: "full pre-push gate", command: NPM, args: ["run", "check:push"] },
});

const ROUTES = Object.freeze([
  {
    id: "active-run",
    patterns: [
      "src/features/alchemy/shared/stores/**",
      "src/app/use-alchemy-bootstrap.ts",
      "src/app/use-app-navigation.ts",
      "src/features/alchemy/shell/use-alchemy-run-controller.ts",
      "src/features/alchemy/shared/ui/fade-slot.tsx",
      "src/features/alchemy/shared/ui/use-sequential-fade-swap.ts",
    ],
    exclude: [
      "src/features/alchemy/shared/stores/gear-*.ts",
      "src/features/alchemy/shared/stores/settings-store.ts",
      "src/features/alchemy/shared/stores/ui-store.ts",
    ],
    commands: ["unit-active", "boundary", "e2e-prepush"],
  },
  {
    id: "save",
    patterns: [
      "src/features/alchemy/shared/storage/**",
      "src/lib/validation/save-schemas/**",
      "src/lib/active-run-session/**",
      "src/features/alchemy/app/autosave-*.ts",
    ],
    commands: ["unit-save", "e2e-save", "e2e-prepush"],
  },
  {
    id: "battle",
    patterns: [
      "src/lib/battle/**",
      "src/lib/game-data/**",
      "src/features/alchemy/run-loop/battle/**",
      "src/app/screen-routes/use-battle-playback.ts",
    ],
    commands: ["unit-battle"],
  },
  { id: "balance", patterns: ["src/lib/balance/**"], commands: ["unit-balance"] },
  {
    id: "shop",
    patterns: [
      "src/features/alchemy/run-loop/shop/**",
      "src/features/alchemy/run-loop/screens/*shop*",
      "src/features/alchemy/run-loop/screens/alchemist-shop-screen.tsx",
      "src/features/alchemy/shell/use-shop-controller.ts",
    ],
    commands: ["unit-shop"],
  },
  {
    id: "shop-screen",
    patterns: [
      "src/features/alchemy/run-loop/screens/*shop*",
      "src/features/alchemy/run-loop/screens/alchemist-shop-screen.tsx",
    ],
    commands: ["e2e-shop"],
  },
  {
    id: "audio",
    patterns: ["src/lib/audio*.ts", "src/lib/sound-registry.ts", "public/sounds/**"],
    commands: ["unit-audio", "e2e-audio"],
  },
  {
    id: "routing",
    patterns: [
      "src/lib/routing/**",
      "src/app/screen-routes/**",
      "src/app/use-app-navigation.ts",
      "src/features/alchemy/shell/use-screen-transitions.ts",
    ],
    commands: ["unit-routing", "boundary", "e2e-prepush"],
  },
  {
    id: "gear",
    patterns: [
      "src/lib/gear/**",
      "src/features/alchemy/meta/screens/armory/**",
      "src/features/alchemy/shared/stores/gear-*.ts",
    ],
    commands: ["unit-gear", "e2e-gear"],
  },
  {
    id: "mystery",
    patterns: [
      "src/lib/mystery/**",
      "src/lib/active-run-session/mystery-visit-persistence.ts",
      "src/features/alchemy/run-loop/navigation/*mystery*",
      "src/features/alchemy/run-loop/screens/mystery/**",
      "src/app/screen-routes/mystery-screen-route.tsx",
      "src/features/alchemy/shell/use-mystery-event-navigation.ts",
    ],
    commands: ["unit-mystery", "e2e-mystery"],
  },
  {
    id: "integration",
    patterns: ["src/features/alchemy/run-loop/navigation/reward-flow*.ts", "src/features/alchemy/shell/**"],
    commands: ["unit-integration"],
  },
  { id: "e2e-helper", patterns: ["tests/pages/battle-page.ts", "tests/helpers.ts"], commands: ["e2e-prepush"] },
  {
    id: "ci-routing",
    patterns: [".github/workflows/**", "scripts/check-ci-routing.mjs"],
    commands: ["ci-routing"],
  },
  {
    id: "documentation",
    patterns: [
      "AGENTS.md",
      "CONTRIBUTING.md",
      "README.md",
      "docs/**",
      ".agents/skills/**",
      "scripts/check-docs.mjs",
      "scripts/new-plan.mjs",
    ],
    commands: ["docs-check"],
  },
  {
    id: "ui-flow",
    patterns: ["src/features/alchemy/**/screens/**", "src/features/alchemy/**/controllers/**"],
    commands: ["e2e-prepush"],
  },
]);

function globToRegExp(glob) {
  let source = "^";
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];
    if (char === "*" && glob[index + 1] === "*") {
      source += ".*";
      index += 1;
    } else if (char === "*") {
      source += "[^/]*";
    } else if (char === "?") {
      source += "[^/]";
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/gu, "\\$&");
    }
  }
  return new RegExp(`${source}$`, "u");
}

const patternCache = new Map();
function matchesPattern(filePath, pattern) {
  let expression = patternCache.get(pattern);
  if (!expression) {
    expression = globToRegExp(pattern);
    patternCache.set(pattern, expression);
  }
  return expression.test(filePath);
}

export function resolveRoutes(paths) {
  const normalized = paths.map((filePath) => filePath.replaceAll("\\", "/").replace(/^\.\//u, ""));
  const matchedRoutes = ROUTES.filter((route) =>
    normalized.some(
      (filePath) =>
        route.patterns.some((pattern) => matchesPattern(filePath, pattern)) &&
        !(route.exclude ?? []).some((pattern) => matchesPattern(filePath, pattern)),
    ),
  );
  return matchedRoutes.length > 0 ? matchedRoutes : [{ id: "fallback", patterns: ["**"], commands: ["typecheck"] }];
}

export function resolvePlan(paths, options = {}) {
  const routes = resolveRoutes(paths);
  const commandKeys = new Set(routes.flatMap((route) => route.commands));
  const e2eSelection = options.e2e ?? (options.includeE2E ? true : false);
  if (e2eSelection) {
    if (typeof e2eSelection === "string") {
      const routeId = e2eSelection === "shop" ? "shop-screen" : e2eSelection;
      const commandKey = E2E_ESCALATIONS[routeId];
      if (commandKey) commandKeys.add(commandKey);
    } else {
      for (const route of routes) {
        const commandKey = E2E_ESCALATIONS[route.id];
        if (commandKey) commandKeys.add(commandKey);
      }
    }
  }
  if (options.full) commandKeys.add("full");
  return {
    paths,
    routes,
    commands: [...commandKeys].map((key) => ({ key, ...COMMANDS[key] })),
  };
}

function changedPathsFromGit() {
  const result = spawnSync("git", ["status", "--short", "--untracked-files=all", "-z"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(result.stderr?.trim() || "git status failed");
  return (result.stdout ?? "")
    .split("\0")
    .map((entry) => (entry.length >= 3 && entry[2] === " " ? entry.slice(3) : entry).trim())
    .filter(Boolean)
    .map((filePath) => (filePath.includes(" -> ") ? filePath.split(" -> ").at(-1) : filePath));
}

function parseArgs(argv) {
  const flags = new Set();
  const paths = [];
  let e2e;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--e2e") {
      const next = argv[index + 1];
      if (next && !next.startsWith("--") && E2E_NAMES.has(next)) {
        e2e = next;
        index += 1;
      } else {
        e2e = true;
      }
    } else if (arg.startsWith("--e2e=")) {
      const selection = arg.slice("--e2e=".length);
      if (!E2E_NAMES.has(selection)) throw new Error(`Unknown E2E route: ${selection}`);
      e2e = selection;
    } else if (arg.startsWith("--")) flags.add(arg.slice(2));
    else paths.push(arg);
  }
  if (paths.length > 0 && flags.has("diff")) throw new Error("Choose explicit paths or --diff, not both.");
  if (paths.length === 0 && !flags.has("diff"))
    throw new Error("Provide paths or use --diff. Example: npm run verify:changed -- --diff --plan");
  return { e2e, flags, paths: paths.length > 0 ? paths : changedPathsFromGit() };
}

function testPathCount(command) {
  return command.args.filter((arg) => /^tests\//u.test(arg)).length;
}

export function formatPlan(plan, { verbosePlan = false } = {}) {
  const lines = [`Changed paths: ${plan.paths.length}`];
  for (const filePath of plan.paths.slice(0, 20)) lines.push(`  ${filePath}`);
  if (plan.paths.length > 20) lines.push(`  … ${plan.paths.length - 20} more paths`);
  lines.push(`Routes: ${plan.routes.map((route) => route.id).join(", ")}`, "Commands:");
  for (const command of plan.commands) {
    const pathCount = testPathCount(command);
    const suffix = pathCount > 0 ? ` (${pathCount} test path${pathCount === 1 ? "" : "s"})` : "";
    lines.push(`  ${command.key}: ${command.label}${suffix}`);
    if (verbosePlan) lines.push(`    ${command.command} ${command.args.join(" ")}`);
  }
  return `${lines.join("\n")}\n`;
}

function printPlan(plan, options) {
  process.stdout.write(formatPlan(plan, options));
}

function runCommand(command, index, verbose) {
  const started = Date.now();
  const result = spawnSync(command.command, command.args, {
    cwd: ROOT,
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: ["inherit", "pipe", "pipe"],
  });
  const output = [result.stdout ?? "", result.stderr ?? "", result.error?.message ?? ""].filter(Boolean).join("\n");
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  if (verbose && output) process.stdout.write(output.endsWith("\n") ? output : `${output}\n`);
  if (result.status === 0) {
    console.log(`✓ ${command.label} (${elapsed}s)`);
    return true;
  }
  const logPath = writeDiagnosticLog(REPORTS_DIR, `${String(index + 1).padStart(2, "0")}-${command.key}`, output);
  console.error(`✗ ${command.label} (${elapsed}s, exit ${result.status ?? "unknown"})`);
  console.error(`  ${firstOutputLine(output)}`);
  console.error(`  ${tailOutput(output)}`);
  console.error(`  Full output: ${path.relative(ROOT, logPath)}`);
  return false;
}

export function main(argv = process.argv.slice(2)) {
  try {
    const { e2e, flags, paths } = parseArgs(argv);
    const plan = resolvePlan(paths, { e2e, full: flags.has("full") });
    printPlan(plan, { verbosePlan: flags.has("verbose-plan") });
    if (flags.has("plan")) return 0;
    let failed = 0;
    for (const [index, command] of plan.commands.entries()) {
      if (!runCommand(command, index, flags.has("verbose"))) failed += 1;
      if (failed > 0 && !flags.has("keep-going")) break;
    }
    return failed === 0 ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
