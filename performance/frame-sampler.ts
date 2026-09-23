import type { Page } from "@playwright/test";
import {
  extractHitchEvents,
  type FrameGapSample,
  type FrameSampleRaw,
  type InputEventSample,
  type LongAnimationFrameSample,
  type LongTaskSample,
} from "./metrics";

declare global {
  interface Window {
    __alchemyPerf?: {
      frameGaps: FrameGapSample[];
      frameTimes: number[];
      longTasks: LongTaskSample[];
      longAnimationFrames: LongAnimationFrameSample[];
      longAnimationFrameSupported: boolean;
      inputEvents: InputEventSample[];
      phaseMarks: Array<{ time: number; phase: string }>;
      phase: string;
      lastTs: number;
      startTs: number;
      rafId: number | null;
      observer: PerformanceObserver | null;
      animationFrameObserver: PerformanceObserver | null;
      recordLongAnimationFrame: ((entry: PerformanceEntry) => void) | null;
      eventObserver: PerformanceObserver | null;
      running: boolean;
    };
  }
}

/** Install collector globals (idempotent). Call once per page before measuring. */
export async function installFrameSampler(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (window.__alchemyPerf) return;
    window.__alchemyPerf = {
      frameGaps: [],
      frameTimes: [],
      longTasks: [],
      longAnimationFrames: [],
      longAnimationFrameSupported: false,
      inputEvents: [],
      phaseMarks: [],
      phase: "idle",
      lastTs: 0,
      startTs: 0,
      rafId: null,
      observer: null,
      animationFrameObserver: null,
      recordLongAnimationFrame: null,
      eventObserver: null,
      running: false,
    };
  });
}

export async function setPerfPhase(page: Page, phase: string): Promise<void> {
  await page.evaluate((nextPhase) => {
    const perf = window.__alchemyPerf;
    if (!perf) return;
    perf.phase = nextPhase;
    if (perf.running) {
      perf.phaseMarks.push({ time: performance.now() - perf.startTs, phase: nextPhase });
    }
  }, phase);
}

export async function startFrameSampler(page: Page): Promise<void> {
  await installFrameSampler(page);
  await page.evaluate(() => {
    const perf = window.__alchemyPerf!;
    if (perf.running) return;
    perf.frameGaps = [];
    perf.frameTimes = [];
    perf.longTasks = [];
    perf.longAnimationFrames = [];
    perf.longAnimationFrameSupported =
      typeof PerformanceObserver !== "undefined" &&
      (PerformanceObserver.supportedEntryTypes?.includes("long-animation-frame") ?? false);
    perf.inputEvents = [];
    perf.phaseMarks = [];
    perf.running = true;
    perf.startTs = performance.mark("alchemy-perf-window-start").startTime;
    perf.lastTs = 0;
    perf.phaseMarks.push({ time: 0, phase: perf.phase });

    // Mirrors phaseAtTime in metrics.ts. Duplicated because page.evaluate
    // closures cannot import TS modules; keep both in sync.
    const phaseAt = (marks: Array<{ time: number; phase: string }>, timeMs: number): string => {
      let phase = marks[0]?.phase ?? "idle";
      for (const mark of marks) {
        if (mark.time <= timeMs) phase = mark.phase;
        else break;
      }
      return phase;
    };

    try {
      perf.observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.startTime < perf.startTs) continue;
          if (entry.duration >= 50) {
            const startTime = entry.startTime - perf.startTs;
            perf.longTasks.push({
              startTime,
              duration: entry.duration,
              phase: phaseAt(perf.phaseMarks, startTime),
            });
          }
        }
      });
      // Prefer unbuffered observations so pre-window longtasks are not included.
      perf.observer.observe({ type: "longtask", buffered: false });
    } catch {
      // longtask may be unavailable in some Chromium builds
      perf.observer = null;
    }

    if (perf.longAnimationFrameSupported) {
      perf.recordLongAnimationFrame = (rawEntry) => {
        const entry = rawEntry as PerformanceEntry & {
          blockingDuration?: number;
          renderStart?: number;
          styleAndLayoutStart?: number;
          scripts?: Array<{
            duration?: number;
            forcedStyleAndLayoutDuration?: number;
            sourceURL?: string;
            sourceFunctionName?: string;
            invoker?: string;
          }>;
        };
        if (entry.startTime < perf.startTs) return;
        const end = entry.startTime + entry.duration;
        perf.longAnimationFrames.push({
          startTime: entry.startTime - perf.startTs,
          duration: entry.duration,
          blockingDuration: entry.blockingDuration ?? 0,
          renderTailMs: entry.renderStart ? Math.max(0, end - entry.renderStart) : 0,
          styleAndLayoutTailMs: entry.styleAndLayoutStart ? Math.max(0, end - entry.styleAndLayoutStart) : 0,
          phase: phaseAt(perf.phaseMarks, entry.startTime - perf.startTs),
          scripts: (entry.scripts ?? [])
            .map((script) => ({
              duration: script.duration ?? 0,
              forcedStyleAndLayoutDuration: script.forcedStyleAndLayoutDuration ?? 0,
              sourceURL: script.sourceURL ?? "",
              sourceFunctionName: script.sourceFunctionName ?? "",
              invoker: script.invoker ?? "",
            }))
            .sort((a, b) => b.duration - a.duration)
            .slice(0, 5),
        });
      };
      try {
        perf.animationFrameObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) perf.recordLongAnimationFrame?.(entry);
        });
        perf.animationFrameObserver.observe({ type: "long-animation-frame", buffered: false });
      } catch {
        perf.animationFrameObserver = null;
        perf.recordLongAnimationFrame = null;
        perf.longAnimationFrameSupported = false;
      }
    }

    try {
      perf.eventObserver = new PerformanceObserver((list) => {
        for (const rawEntry of list.getEntries()) {
          const entry = rawEntry as PerformanceEntry & {
            processingStart?: number;
            interactionId?: number;
          };
          const interactionId = entry.interactionId ?? 0;
          if (entry.startTime < perf.startTs || interactionId === 0) continue;
          const startTime = entry.startTime - perf.startTs;
          perf.inputEvents.push({
            name: entry.name,
            startTime,
            duration: entry.duration,
            inputDelay: Math.max(0, (entry.processingStart ?? entry.startTime) - entry.startTime),
            interactionId,
            phase: phaseAt(perf.phaseMarks, startTime),
          });
        }
      });
      perf.eventObserver.observe({ type: "event", buffered: false, durationThreshold: 16 } as PerformanceObserverInit);
    } catch {
      perf.eventObserver = null;
    }

    const tick = (ts: number) => {
      if (!perf.running) return;
      if (perf.lastTs > 0) {
        const startTime = perf.lastTs - perf.startTs;
        const duration = ts - perf.lastTs;
        perf.frameGaps.push({ startTime, duration });
        perf.frameTimes.push(duration);
      }
      perf.lastTs = ts;
      perf.rafId = requestAnimationFrame(tick);
    };
    return new Promise<void>((resolve) => {
      perf.rafId = requestAnimationFrame((ts) => {
        tick(ts);
        resolve();
      });
    });
  });
}

export async function stopFrameSampler(page: Page): Promise<FrameSampleRaw> {
  const sample = await page.evaluate(() => {
    const perf = window.__alchemyPerf;
    if (!perf || !perf.running) {
      return {
        frameGaps: [],
        frameTimes: [],
        longTasks: [],
        longAnimationFrames: [],
        longAnimationFrameSupported: false,
        inputEvents: [],
        durationMs: 0,
        phaseMarks: [],
        hitchEvents: [],
      };
    }
    perf.running = false;
    if (perf.rafId !== null) {
      cancelAnimationFrame(perf.rafId);
      perf.rafId = null;
    }

    // Mirrors phaseAtTime in metrics.ts (see note in startFrameSampler).
    const phaseAt = (marks: Array<{ time: number; phase: string }>, timeMs: number): string => {
      let phase = marks[0]?.phase ?? "idle";
      for (const mark of marks) {
        if (mark.time <= timeMs) phase = mark.phase;
        else break;
      }
      return phase;
    };

    if (perf.observer) {
      try {
        const records = perf.observer.takeRecords();
        for (const entry of records) {
          if (entry.startTime < perf.startTs) continue;
          if (entry.duration >= 50) {
            const startTime = entry.startTime - perf.startTs;
            perf.longTasks.push({
              startTime,
              duration: entry.duration,
              phase: phaseAt(perf.phaseMarks, startTime),
            });
          }
        }
        perf.observer.disconnect();
      } catch {
        // ignore
      }
      perf.observer = null;
    }
    if (perf.animationFrameObserver) {
      for (const entry of perf.animationFrameObserver.takeRecords()) perf.recordLongAnimationFrame?.(entry);
      perf.animationFrameObserver.disconnect();
      perf.animationFrameObserver = null;
      perf.recordLongAnimationFrame = null;
    }
    if (perf.eventObserver) {
      try {
        const records = perf.eventObserver.takeRecords();
        for (const rawEntry of records) {
          const entry = rawEntry as PerformanceEntry & {
            processingStart?: number;
            interactionId?: number;
          };
          const interactionId = entry.interactionId ?? 0;
          if (entry.startTime < perf.startTs || interactionId === 0) continue;
          const startTime = entry.startTime - perf.startTs;
          perf.inputEvents.push({
            name: entry.name,
            startTime,
            duration: entry.duration,
            inputDelay: Math.max(0, (entry.processingStart ?? entry.startTime) - entry.startTime),
            interactionId,
            phase: phaseAt(perf.phaseMarks, startTime),
          });
        }
        perf.eventObserver.disconnect();
      } catch {
        // ignore
      }
      perf.eventObserver = null;
    }
    const durationMs = performance.mark("alchemy-perf-window-end").startTime - perf.startTs;
    return {
      frameGaps: [...perf.frameGaps],
      frameTimes: [...perf.frameTimes],
      longTasks: [...perf.longTasks],
      longAnimationFrames: [...perf.longAnimationFrames],
      longAnimationFrameSupported: perf.longAnimationFrameSupported,
      inputEvents: [...perf.inputEvents],
      durationMs,
      phaseMarks: [...perf.phaseMarks],
    };
  });

  return {
    ...sample,
    hitchEvents: extractHitchEvents(
      sample.frameGaps && sample.frameGaps.length > 0 ? sample.frameGaps : (sample.frameTimes ?? []),
      sample.phaseMarks,
    ),
  };
}
