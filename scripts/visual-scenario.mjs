#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { parseKnownFlags } from "./lib/cli-args.mjs";
import { defineScript, UsageError } from "./lib/script-run.mjs";
import { runGit } from "./lib/repository-paths.mjs";
import { runTaskCommand } from "./lib/run-command.mjs";
import { ensureRunId, writeCurrentRun } from "./lib/verification/current-run.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
export const VISUAL_SCENARIOS = Object.freeze([
  "menu",
  "options",
  "homestead",
  "talents",
  "talent-mana",
  "talent-unlock",
  "mystery-gear",
  "battle",
  "card-inspection",
  "rewards",
]);
const languages = JSON.parse(fs.readFileSync(path.join(ROOT, "src/lib/localization/locales/languages.json"), "utf8"));

export function parseVisualScenarioArgs(argv) {
  const { flags, values, rest } = parseKnownFlags(argv, {
    list: {},
    status: {},
    help: { short: "h" },
    headed: {},
    label: { takesValue: true },
    locale: { takesValue: true },
    viewport: { takesValue: true },
    seed: { takesValue: true },
    mode: { takesValue: true },
    port: { takesValue: true },
  });
  for (const [key, value] of values) if (value.length !== 1) throw new UsageError(`Repeated option: --${key}`);
  const value = (key, fallback) => values.get(key)?.[0] ?? fallback;
  const scenario = rest[0];
  if (flags.has("status")) {
    if (rest.length || values.size || flags.size !== 1) throw new UsageError("--status takes no other options");
    return { status: true };
  }
  if (flags.has("help") || flags.has("list")) return { list: true };
  if (rest.length !== 1 || !VISUAL_SCENARIOS.includes(scenario))
    throw new UsageError(`Choose one scenario: ${VISUAL_SCENARIOS.join(", ")}. Use --help for options.`);
  const label = value("label", "capture");
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/u.test(label)) throw new UsageError("--label must be a short lowercase slug");
  const locale = value("locale", "en");
  if (!Object.hasOwn(languages, locale)) throw new UsageError(`Unknown shipped locale: ${locale}`);
  const viewport = /^(\d+)x(\d+)$/u.exec(value("viewport", "1920x1080"));
  if (!viewport || viewport.slice(1).some((size) => Number(size) < 320 || Number(size) > 7680))
    throw new UsageError("--viewport must be WIDTHxHEIGHT with each dimension between 320 and 7680");
  const mode = value("mode", "dev");
  if (!["dev", "preview"].includes(mode)) throw new UsageError("--mode must be dev or preview");
  const seed = value("seed", "42");
  if (!/^\d+$/u.test(seed) || Number(seed) > 0x7fffffff)
    throw new UsageError("--seed must be an integer from 0 to 2147483647");
  const port = value("port", "4179");
  if (!/^\d+$/u.test(port) || Number(port) < 1024 || Number(port) > 65535)
    throw new UsageError("--port must be an integer from 1024 to 65535");
  return {
    list: false,
    scenario,
    label,
    locale,
    viewport: { width: Number(viewport[1]), height: Number(viewport[2]) },
    seed: Number(seed),
    port: Number(port),
    mode,
    headed: flags.has("headed"),
  };
}

export async function runVisualScenario(argv = process.argv.slice(2)) {
  const options = parseVisualScenarioArgs(argv);
  if (options.status) {
    const parent = path.join(ROOT, "reports/visual-review");
    const captures = [];
    for (const label of fs.existsSync(parent) ? fs.readdirSync(parent, { withFileTypes: true }) : []) {
      if (!label.isDirectory()) continue;
      const labelDir = path.join(parent, label.name);
      for (const entry of fs.readdirSync(labelDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const file = path.join(labelDir, entry.name, "scenario.json");
        try {
          const data = JSON.parse(fs.readFileSync(file, "utf8"));
          captures.push({ file, data, modified: fs.statSync(file).mtimeMs });
        } catch (error) {
          if (error.code !== "ENOENT") console.log(`Unreadable capture manifest: ${file}`);
        }
      }
    }
    captures.sort((a, b) => b.modified - a.modified);
    for (const { file, data } of captures.slice(0, 10)) {
      let capture = {};
      try {
        capture = JSON.parse(fs.readFileSync(path.join(path.dirname(file), "capture.json"), "utf8"));
      } catch {
        // Failed or interrupted captures may not have browser metadata.
      }
      console.log(
        `${data.label}: ${data.scenario} — ${data.status}; commit ${data.commit}${data.dirty ? " (dirty)" : ""}; ${data.locale}, seed ${data.seed}, ${data.viewport?.width}x${data.viewport?.height}, ${data.edition}, ${data.mode}; ${capture.platform ?? "unknown platform"}, Chromium ${capture.browserVersion ?? "unknown"}; ${file}`,
      );
    }
    if (!captures.length) console.log("No scenario captures found in this checkout.");
    console.log(
      "Captures do not establish visual quality or exercised interactions. Compare matching settings and inspect browser/version metadata before review.",
    );
    return 0;
  }
  if (options.list) {
    console.log(`Usage: npm run visual:scenario -- <scenario> [--label before|after] [--locale en] [--viewport 1920x1080]
  [--seed 42] [--mode dev|preview] [--port 4179] [--headed]
Scenarios: ${VISUAL_SCENARIOS.join(", ")}
Use --status to list recent captures in this checkout and their settings.
Defaults: current-source dev server, isolated browser storage, seed 42, reduced motion, muted audio.
Repeat the same scenario/options in the original and candidate checkouts with different labels.
Preview mode requires a fresh web build. Occupied ports fail without stopping or reusing a server.`);
    return 0;
  }
  const commit = runGit(ROOT, ["rev-parse", "HEAD"]);
  const dirty = runGit(ROOT, ["status", "--porcelain", "--untracked-files=all"]);
  if (commit.status !== 0 || dirty.status !== 0) throw new Error("Cannot record scenario source identity");
  const runId = ensureRunId("visual-scenario");
  const parent = path.join(ROOT, "reports/visual-review", options.label);
  fs.mkdirSync(parent, { recursive: true });
  const directory = fs.mkdtempSync(path.join(parent, `${options.scenario}-`));
  const manifest = {
    ...options,
    version: 1,
    runId,
    commit: commit.stdout.trim(),
    dirty: dirty.stdout,
    edition: process.env.ALCHEMY_EDITION ?? "full",
    browser: "chromium",
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    animations: "disabled",
    timezone: "UTC",
    fixedTime: "2026-01-01T00:00:00.000Z",
    status: "running",
  };
  const manifestPath = path.join(directory, "scenario.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(
    `Scenario: ${options.scenario}; ${options.mode}; seed ${options.seed}; ${options.locale}; ${options.viewport.width}x${options.viewport.height}`,
  );
  console.log(`Evidence: ${directory}`);
  const result = await runTaskCommand(
    process.execPath,
    [
      "scripts/run-compact.mjs",
      "playwright",
      "test",
      "--config=playwright.scenario.config.ts",
      "--project=chromium",
      ...(options.headed ? ["--headed"] : []),
    ],
    {
      cwd: ROOT,
      label: `visual scenario ${options.scenario}`,
      env: {
        ...process.env,
        ALCHEMY_VISUAL_SCENARIO_FILE: manifestPath,
        PLAYWRIGHT_VITE_MODE: options.mode,
        PLAYWRIGHT_BROWSER_PREVIEW_PORT: String(options.port),
      },
    },
  );
  manifest.status = result.status === 0 ? "passed" : "failed";
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  const artifacts = [manifestPath, "capture.json", "screen.png", "storage.json"].map((file) =>
    path.isAbsolute(file) ? file : path.join(directory, file),
  );
  writeCurrentRun({
    rootDir: ROOT,
    runId,
    status: manifest.status,
    command: "npm run visual:scenario",
    artifacts: artifacts
      .filter((file) => fs.existsSync(file))
      .map((file) => ({ path: path.relative(ROOT, file), role: "primary" })),
    summary: `${options.scenario} capture ${manifest.status}; inspect rendered evidence before accepting visual quality.`,
  });
  console.log(`Scenario ${manifest.status}: ${directory}`);
  return result.status ?? 1;
}

defineScript(import.meta.url, () => runVisualScenario(), { artifacts: true });
