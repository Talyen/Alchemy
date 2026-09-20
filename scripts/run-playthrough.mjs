import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { defineScript } from "./lib/script-run.mjs";
import { withReportServer } from "./lib/vite-report-server.mjs";
import { createHash } from "node:crypto";

defineScript(import.meta.url, async () => {
  const args = process.argv.slice(2);
  const arg = (key, fallback) => {
    const i = args.indexOf(`--${key}`);
    return i < 0 ? fallback : args[i + 1];
  };
  const integer = (key, fallback) => {
    const n = Number(arg(key, fallback));
    if (!Number.isSafeInteger(n) || n < 1) throw new Error(`--${key} must be a positive integer`);
    return n;
  };
  const known = new Set([
    "out",
    "bundle",
    "manifest",
    "seeds",
    "hero",
    "mode",
    "difficulty",
    "resume-at",
    "runs",
    "horizon",
    "max-steps",
    "max-turns",
    "policy",
    "combat-policy",
    "save",
    "fixture",
    "timeout",
    "baseline",
  ]);
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]?.replace(/^--/, "");
    if (!known.has(key) || !args[index + 1] || args[index + 1].startsWith("--"))
      throw new Error(`Invalid option or missing value: ${args[index]}`);
  }
  if (process.env.npm_lifecycle_event === "balance:playthrough:replay" && !arg("bundle", null))
    throw new Error("Replay requires --bundle <career.json>");
  if (process.env.npm_lifecycle_event === "balance:playthrough:compare" && !arg("baseline", null))
    throw new Error("Comparison requires --baseline <playthrough.json>");
  if (arg("bundle", null) && (arg("fixture", null) || arg("manifest", null) || arg("save", null)))
    throw new Error("Replay cannot replace its starting state");
  if (arg("save", null) && arg("fixture", null)) throw new Error("Choose either --save or --fixture");
  const baselineReport = arg("baseline", null) ? JSON.parse(readFileSync(arg("baseline"), "utf8")) : null;
  const defaultDirectory = arg("bundle", null)
    ? "reports/playthrough-replay"
    : baselineReport
      ? "reports/playthrough-comparison"
      : "reports/playthrough";
  const reportDir = resolve(arg("out", defaultDirectory));
  mkdirSync(reportDir, { recursive: true });
  const hash = createHash("sha256");
  const sourcePaths = execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "-z",
      "--",
      "src",
      "scripts",
      "package.json",
      "package-lock.json",
    ],
    { encoding: "utf8" },
  )
    .split("\0")
    .filter((path) => /\.(?:tsx?|m?js|json)$/.test(path));
  for (const path of [...new Set(sourcePaths)].sort())
    if (existsSync(path)) hash.update(path).update(readFileSync(path));
  const codeIdentity = {
    head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    sourceHash: hash.digest("hex"),
  };
  const bundlePath = arg("bundle", null);
  const bundle = bundlePath ? JSON.parse(readFileSync(bundlePath, "utf8")) : null;
  if (bundle && bundle.version !== 1) throw new Error("Unsupported replay bundle version");
  if (bundle?.codeIdentity && bundle.codeIdentity.sourceHash !== codeIdentity.sourceHash)
    console.info("Code/content differs from the bundle: this replay is a regression experiment.");
  const manifestPath = arg("manifest", null);
  const configs = manifestPath
    ? JSON.parse(readFileSync(manifestPath, "utf8")).manifest
    : bundle
      ? [bundle.config]
      : String(arg("seeds", "1"))
          .split(",")
          .map((seed) => ({
            seed: Number(seed),
            hero: arg("hero", "knight"),
            mode: arg("mode", "campaign"),
            difficulty: arg("difficulty", "difficulty-1"),
            ...(arg("resume-at", null) ? { resumeAt: integer("resume-at", 1) } : {}),
            runs: integer("runs", 2),
            horizon: integer("horizon", 12),
            maxSteps: integer("max-steps", 10000),
            maxTurns: integer("max-turns", 100),
            policy: arg("policy", "archetype"),
            combatPolicy: arg("combat-policy", "greedy-effective-damage"),
            ...(arg("save", null) ? { initialSave: JSON.parse(readFileSync(arg("save"), "utf8")) } : {}),
          }));
  if (!Array.isArray(configs) || configs.length === 0) throw new Error("Scenario manifest must not be empty");
  const results = [];
  for (const [index, config] of configs.entries()) {
    const prefix = resolve(reportDir, `career-${index}-${config.seed}`);
    const input = `${prefix}.input.json`,
      output = `${prefix}.json`,
      journal = `${prefix}.journal.jsonl`;
    writeFileSync(
      input,
      JSON.stringify({
        config,
        codeIdentity,
        fixture: arg("fixture", null),
        ...(bundle ? { replay: bundle.journal, runtimeInputs: bundle.runtimeInputs } : {}),
      }),
    );
    for (const stale of [output, `${output}.start`, `${output}.checkpoint`]) rmSync(stale, { force: true });
    writeFileSync(journal, "");
    const child = spawnSync(process.execPath, ["scripts/run-playthrough-worker.mjs", input, output, journal], {
      encoding: "utf8",
      timeout: integer("timeout", 120) * 1000,
      maxBuffer: 2 * 1024 * 1024,
    });
    if (child.status !== 0) {
      const error = child.error?.message ?? child.stderr.slice(-4000);
      const attempts = existsSync(journal)
        ? readFileSync(journal, "utf8")
            .trim()
            .split("\n")
            .filter(Boolean)
            .flatMap((line) => {
              try {
                return [JSON.parse(line)];
              } catch {
                console.error("Interrupted journal record; preserving the complete replay prefix.");
                return [];
              }
            })
        : [];
      const entries = [...new Map(attempts.map((entry) => [entry.step, entry])).values()];
      const start = existsSync(`${output}.start`)
        ? JSON.parse(readFileSync(`${output}.start`, "utf8"))
        : { version: 1, config };
      const failure = { ...start, codeIdentity, status: "incomplete", error, journal: entries };
      writeFileSync(output, JSON.stringify(failure, null, 2));
      results.push(failure);
      console.error(
        `INCOMPLETE seed=${config.seed}: ${error}\nReplay: npm run balance:playthrough:replay -- --bundle ${output}`,
      );
    } else {
      const result = JSON.parse(readFileSync(output, "utf8"));
      result.codeIdentity = codeIdentity;
      if (bundle) {
        const comparable = (entry) =>
          JSON.stringify({
            action: entry.action,
            before: entry.before,
            after: entry.after,
            error: entry.error,
            stage: entry.stage,
          });
        const matched =
          result.error === bundle.error &&
          result.journal.length === bundle.journal.length &&
          result.journal.every((entry, index) => comparable(entry) === comparable(bundle.journal[index]));
        result.replay = {
          matched,
          interpretation:
            bundle.codeIdentity?.sourceHash === codeIdentity.sourceHash ? "exact-code" : "regression-experiment",
        };
        console.info(
          matched
            ? "Replay reproduced the recorded outcome and transitions."
            : "Replay diverged from the recorded outcome or transitions.",
        );
      }
      writeFileSync(output, JSON.stringify(result, null, 2));
      results.push(result);
      console.info(
        `${result.status.toUpperCase()} ${config.hero}/${config.mode} seed=${config.seed}: ${result.outcomes.map((x) => `${x.outcome} (${x.rooms} rooms)`).join(", ")}; ${result.journal.length} actions, ${Math.round(result.elapsedMs)}ms${result.error ? `; ${result.error}` : ""}`,
      );
      if (result.status !== "completed")
        console.info(`Replay: npm run balance:playthrough:replay -- --bundle ${output}`);
    }
  }
  const report = {
    version: 1,
    codeIdentity,
    manifest: results.map((result) => result.config),
    planned: configs.length,
    incomplete: results.filter((result) => result.status !== "completed").length,
    completed: results.filter((x) => x.status === "completed").length,
    results,
  };
  writeFileSync(resolve(reportDir, "playthrough.json"), JSON.stringify(report, null, 2));
  await withReportServer(async (server) => {
    const { renderPlaythroughReport, comparePlaythroughReports } = await server.ssrLoadModule(
      "/src/app/playthrough/report.ts",
    );
    const { summarizeProgress } = await server.ssrLoadModule("/src/app/playthrough/progress-telemetry.ts");
    const fullResults = results.filter((result) => result.telemetry !== undefined);
    report.progress = summarizeProgress(fullResults);
    writeFileSync(resolve(reportDir, "playthrough.json"), JSON.stringify(report, null, 2));
    writeFileSync(
      resolve(reportDir, "playthrough.html"),
      renderPlaythroughReport(
        fullResults,
        report.planned,
        results.filter((result) => !result.telemetry).map((result) => result.error),
      ),
    );
    if (arg("baseline", null)) {
      const baseline = baselineReport;
      writeFileSync(
        resolve(reportDir, "comparison.json"),
        JSON.stringify(comparePlaythroughReports(baseline.results, results), null, 2),
      );
    }
  });
  console.info(`Careers: ${report.completed}/${report.planned} completed. Report: ${reportDir}`);
  if (results.some((result) => (bundle ? !result.replay?.matched : result.status !== "completed"))) {
    console.error(
      results
        .filter((x) => x.status !== "completed")
        .map((x) => x.error)
        .join("\n"),
    );
    process.exitCode = 1;
  }
});
