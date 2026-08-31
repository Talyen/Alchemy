import fs from "node:fs";
import path from "node:path";
import { test as base, expect } from "@playwright/test";
import type { ElectronApplication, Page } from "@playwright/test";
import {
  aggregateRawSamples,
  classifyTargets,
  computeMetrics,
  type FrameSampleRaw,
  type TargetProfile,
} from "./metrics";
import { installFrameSampler, setPerfPhase, startFrameSampler, stopFrameSampler } from "./frame-sampler";
import { startCdpTrace, stopCdpTrace, summarizeTraceFile } from "./cdp-trace";
import { PERF_PREVIEW_PORT } from "../scripts/lib/dev-port.mjs";
import { previewPortFromEnv } from "../tests/playwright-shared";
import {
  collectGitState,
  ensureOutputDirs,
  writeEnvironment,
  writeResultsJson,
  writeRunResult,
  writeSummaryMarkdown,
  type EnvironmentInfo,
  type RuntimeSnapshot,
  type ScenarioAggregate,
  type ScenarioRunResult,
} from "./report";
import { PERF_VIEWPORT } from "./viewport";
import { STARTUP_READY_MARK } from "../src/lib/performance/startup-marks";
import { requirePositiveFiniteObservation } from "./scenario-contracts";

// Literal tuple, not a JSON spread: a spread of catalog.json arrays widens
// ScenarioId to string. Parity with catalog.json is asserted in
// tests/performance/metrics.test.ts.
export const SCENARIO_IDS = [
  "battle-effects",
  "battle-end-turn",
  "talents-effects",
  "collection-tabs",
  "options-brightness",
  "labyrinth-interactions",
  "armory-homestead",
  "shop-interactions",
  "startup-first-use",
  "memory-soak",
  "battle-art-diag",
] as const;
export type ScenarioId = (typeof SCENARIO_IDS)[number];

const isElectron = process.env.PLAYWRIGHT_PERF_ELECTRON === "1";
const isTrace = process.env.PLAYWRIGHT_PERF_TRACE === "1";
const runsPerScenario = Number.parseInt(process.env.PERF_RUNS ?? "1", 10);
const isCold = process.env.PLAYWRIGHT_PERF_COLD === "1";

interface PerfFixtures {
  perfPage: Page;
  measureScenario: (options: {
    scenario: ScenarioId;
    profile: TargetProfile;
    minFrames?: number;
    setup: (page: Page) => Promise<void>;
    interact: (page: Page, phase: (name: string) => Promise<void>) => Promise<void>;
    collectObservations?: (page: Page) => Promise<Record<string, number>>;
    captureElectronLaunchTiming?: boolean;
  }) => Promise<void>;
}

let electronApp: ElectronApplication | null = null;
let electronLaunchObservations: Record<string, number> = {};

function electronRendererOrigin(): string {
  const port = Number.parseInt(
    process.env.PLAYWRIGHT_PERF_PORT ?? process.env.PLAYWRIGHT_ELECTRON_PREVIEW_PORT ?? String(PERF_PREVIEW_PORT),
    10,
  );
  return `http://127.0.0.1:${port}`;
}

/** Electron pages have no Playwright baseURL — rewrite relative gotos. */
function patchElectronGoto(page: Page): void {
  const origin = electronRendererOrigin();
  const originalGoto = page.goto.bind(page);
  page.goto = (url, options) => {
    const href = typeof url === "string" && url.startsWith("http") ? url : new URL(String(url), origin).toString();
    return originalGoto(href, options);
  };
}

async function launchElectronPage(): Promise<Page> {
  const launchStarted = performance.now();
  const { launchElectronApp, getElectronMainWindow } = await import("../tests/electron-helpers");
  const previewPort = previewPortFromEnv("PLAYWRIGHT_PERF_PORT", PERF_PREVIEW_PORT);
  process.env.PLAYWRIGHT_ELECTRON_PREVIEW_PORT = String(previewPort);
  electronApp = await launchElectronApp({ enableGpu: true });
  const page = await getElectronMainWindow(electronApp);
  patchElectronGoto(page);
  await page.waitForFunction((mark) => performance.getEntriesByName(mark, "mark").length > 0, STARTUP_READY_MARK, {
    timeout: 30_000,
  });
  const rendererStartupReadyMs = await page.evaluate(
    (mark) => performance.getEntriesByName(mark, "mark").at(-1)?.startTime,
    STARTUP_READY_MARK,
  );
  if (rendererStartupReadyMs === undefined) {
    throw new Error(`Missing performance mark ${STARTUP_READY_MARK}`);
  }
  electronLaunchObservations = {
    electronLaunchToReadyMs: requirePositiveFiniteObservation(
      "electronLaunchToReadyMs",
      performance.now() - launchStarted,
    ),
    rendererStartupReadyMs: requirePositiveFiniteObservation("rendererStartupReadyMs", rendererStartupReadyMs),
  };
  return page;
}

/** Fail loud if battle hand cards lack production art or paint at zero size. */
async function assertBattleCardArtIfPresent(page: Page): Promise<void> {
  const hand = page.locator('[aria-label^="Play "]');
  if ((await hand.count()) === 0) return;
  const img = hand.first().locator("img").first();
  const src = await img.getAttribute("src");
  if (!src || src.startsWith("data:image/gif")) {
    throw new Error(
      `Battle hand card has no real art (src=${src ?? "null"}). Perf decks must use real cardLibrary ids so hydrateCard can attach production art.`,
    );
  }
  await expect
    .poll(
      async () => {
        return img.evaluate((el) => {
          const rect = (el as HTMLImageElement).getBoundingClientRect();
          return (el as HTMLImageElement).naturalWidth > 0 && rect.width >= 40 && rect.height >= 40 ? 1 : 0;
        });
      },
      { timeout: 15_000 },
    )
    .toBe(1);
}

export const test = base.extend<PerfFixtures>({
  perfPage: async ({ page }, use) => {
    if (isElectron) {
      const electronPage = await launchElectronPage();
      await use(electronPage);
      await electronApp?.close().catch(() => undefined);
      electronApp = null;
    } else {
      await use(page);
    }
  },

  measureScenario: async ({ perfPage }, use, testInfo) => {
    await use(
      async ({
        scenario,
        profile,
        minFrames,
        setup,
        interact,
        collectObservations,
        captureElectronLaunchTiming = false,
      }) => {
        testInfo.setTimeout(isTrace ? 180_000 : 300_000);
        ensureOutputDirs();

        const measuredSamples: FrameSampleRaw[] = [];
        const runResults: ScenarioRunResult[] = [];
        // Ordinary profiles include a warm-up. Cold mode intentionally measures first use.
        const totalLoops = runsPerScenario + (isCold ? 0 : 1);
        let activePage = perfPage;

        for (let i = 0; i < totalLoops; i++) {
          const isWarmup = !isCold && i === 0;
          const runIndex = isCold ? i + 1 : i;
          const measured = !isWarmup;

          if (isCold && isElectron && i > 0) {
            await electronApp?.close().catch(() => undefined);
            electronApp = null;
            activePage = await launchElectronPage();
          }

          // Fresh navigation context per repetition via setup.
          await setup(activePage);
          await assertBattleCardArtIfPresent(activePage);
          await installFrameSampler(activePage);

          // Capture display metadata once.
          if (i === 0) {
            await captureDisplayEnv(activePage);
          }

          let tracePath: string | undefined;
          let cdpSession: Awaited<ReturnType<typeof startCdpTrace>> | null = null;
          if (isTrace && measured) {
            cdpSession = await startCdpTrace(activePage);
          }

          const runtimeBefore = measured ? await collectRuntimeSnapshot(activePage) : undefined;
          if (measured) {
            await startFrameSampler(activePage);
          }

          const phase = async (name: string) => {
            if (measured) await setPerfPhase(activePage, name);
          };

          await interact(activePage, phase);

          let sample: FrameSampleRaw = {
            frameTimes: [],
            longTasks: [],
            durationMs: 0,
            phaseMarks: [],
          };
          if (measured) {
            sample = await stopFrameSampler(activePage);
            measuredSamples.push(sample);
          }

          if (cdpSession) {
            tracePath = await stopCdpTrace(cdpSession, scenario, runIndex);
            const insight = summarizeTraceFile(tracePath);
            const insightPath = path.join(ensureOutputDirs().traces, `${scenario}-${runIndex}-insight.json`);
            fs.writeFileSync(insightPath, JSON.stringify(insight, null, 2));
          }

          if (measured) {
            const metrics = computeMetrics(sample, { minFrames });
            const runtimeAfter = await collectRuntimeSnapshot(activePage);
            const targets = classifyTargets(metrics, profile);
            const observations = {
              ...(captureElectronLaunchTiming && isElectron ? electronLaunchObservations : {}),
              ...(collectObservations ? await collectObservations(activePage) : {}),
            };
            const result: ScenarioRunResult = {
              scenario,
              runIndex,
              measured: true,
              profile,
              metrics,
              targets,
              ...(tracePath ? { tracePath } : {}),
              ...(metrics.valid ? {} : { notes: [metrics.invalidReason ?? "invalid"] }),
              ...(runtimeBefore ? { runtimeBefore } : {}),
              runtimeAfter,
              inputEvents: sample.inputEvents ?? [],
              ...(Object.keys(observations).length > 0 ? { observations } : {}),
            };
            writeRunResult(result);
            runResults.push(result);

            if (!metrics.valid) {
              throw new Error(`Invalid performance sample for ${scenario} run ${runIndex}: ${metrics.invalidReason}`);
            }
          }
        }

        const aggregate = aggregateRawSamples(measuredSamples, { minFrames });
        const targets = classifyTargets(aggregate, profile);
        const scenarioAggregate: ScenarioAggregate = {
          scenario,
          profile,
          aggregate,
          targets,
          runs: runResults,
        };

        const aggregatesPath = path.join(ensureOutputDirs().root, "aggregates");
        fs.mkdirSync(aggregatesPath, { recursive: true });
        fs.writeFileSync(path.join(aggregatesPath, `${scenario}.json`), JSON.stringify(scenarioAggregate, null, 2));
      },
    );
  },
});

export { expect } from "@playwright/test";

interface DisplayEnv {
  devicePixelRatio?: number;
  estimatedRefreshHz?: number;
  browser?: string;
}

function displayEnvPath(): string {
  return path.join(ensureOutputDirs().root, "display-env.json");
}

async function captureDisplayEnv(page: Page): Promise<void> {
  const displayEnv = await page.evaluate(() => {
    // Rough refresh estimate from a few rAF intervals.
    return new Promise<{
      devicePixelRatio: number;
      estimatedRefreshHz?: number;
      browser: string;
    }>((resolve) => {
      const samples: number[] = [];
      let last = 0;
      let estimatedRefreshHz: number | undefined;
      const step = (ts: number) => {
        if (last > 0) samples.push(ts - last);
        last = ts;
        if (samples.length >= 20) {
          // A setup/navigation gap can land in this short sample. The median
          // reflects steady vsync cadence without letting one stall report 14 Hz
          // on a renderer that is otherwise delivering 60 FPS.
          const sorted = [...samples].sort((a, b) => a - b);
          const midpoint = Math.floor(sorted.length / 2);
          const interval =
            sorted.length % 2 === 0 ? (sorted[midpoint - 1]! + sorted[midpoint]!) / 2 : sorted[midpoint]!;
          estimatedRefreshHz = interval > 0 ? Math.round(1000 / interval) : undefined;
          resolve({
            devicePixelRatio: window.devicePixelRatio,
            estimatedRefreshHz,
            browser: navigator.userAgent,
          });
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  });
  // Writer is the Playwright worker; reporter (main process) reads this file later.
  fs.writeFileSync(displayEnvPath(), JSON.stringify(displayEnv, null, 2));
}

function readDisplayEnv(): DisplayEnv {
  const file = path.join(getOutputDirSafe(), "display-env.json");
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as DisplayEnv;
  } catch {
    return {};
  }
}

function getOutputDirSafe(): string {
  try {
    return ensureOutputDirs().root;
  } catch {
    return process.env.PERF_OUTPUT_DIR ?? "";
  }
}

async function collectRuntimeSnapshot(page: Page): Promise<RuntimeSnapshot> {
  const renderer = await page.evaluate(() => {
    const memory = performance as Performance & { memory?: { usedJSHeapSize?: number } };
    return {
      ...(memory.memory?.usedJSHeapSize !== undefined ? { jsHeapUsedBytes: memory.memory.usedJSHeapSize } : {}),
      domNodes: document.getElementsByTagName("*").length,
      images: document.images.length,
      canvases: document.getElementsByTagName("canvas").length,
      audioElements: document.getElementsByTagName("audio").length,
    };
  });
  if (!isElectron || !electronApp) return renderer;
  const electronWorkingSetKB = await electronApp
    .evaluate(({ app }) => app.getAppMetrics().reduce((sum, metric) => sum + metric.memory.workingSetSize, 0))
    .catch(() => undefined);
  return { ...renderer, ...(electronWorkingSetKB !== undefined ? { electronWorkingSetKB } : {}) };
}

export function getRunsPerScenario(): number {
  return runsPerScenario;
}

export function buildEnvironmentInfo(scenarios: string[]): EnvironmentInfo {
  const git = collectGitState();
  return {
    timestamp: new Date().toISOString(),
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    runtime: isElectron ? "electron" : "chromium",
    viewport: { width: PERF_VIEWPORT.width, height: PERF_VIEWPORT.height },
    ...readDisplayEnv(),
    ...git,
    traceMode: isTrace,
    runsPerScenario,
    coldMode: isCold,
    scenarios,
  };
}

/** Finalize report from per-scenario aggregate files. Called by the custom reporter. */
export function finalizePerformanceReport(scenarios: string[]): string {
  const { root } = ensureOutputDirs();
  const aggregatesDir = path.join(root, "aggregates");
  const aggregates: ScenarioAggregate[] = [];
  for (const scenario of scenarios) {
    const file = path.join(aggregatesDir, `${scenario}.json`);
    if (fs.existsSync(file)) {
      aggregates.push(JSON.parse(fs.readFileSync(file, "utf8")) as ScenarioAggregate);
    }
  }
  const environment = buildEnvironmentInfo(scenarios);
  writeEnvironment(environment);
  writeResultsJson(aggregates, environment);
  return writeSummaryMarkdown(environment, aggregates);
}
