import type { Page } from "@playwright/test";
import {
  extractHitchEvents,
  type FrameGapSample,
  type FrameSampleRaw,
  type InputEventSample,
  type LongTaskSample,
} from "./metrics";

declare global {
  interface Window {
    __alchemyPerf?: {
      frameGaps: FrameGapSample[];
      frameTimes: number[];
      longTasks: LongTaskSample[];
      inputEvents: InputEventSample[];
      phaseMarks: Array<{ time: number; phase: string }>;
      phase: string;
      lastTs: number;
      startTs: number;
      rafId: number | null;
      observer: PerformanceObserver | null;
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
      inputEvents: [],
      phaseMarks: [],
      phase: "idle",
      lastTs: 0,
      startTs: 0,
      rafId: null,
      observer: null,
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
    perf.inputEvents = [];
    perf.phaseMarks = [];
    perf.running = true;
    perf.startTs = performance.now();
    perf.lastTs = 0;
    perf.phaseMarks.push({ time: 0, phase: perf.phase });

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
    perf.rafId = requestAnimationFrame(tick);
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
    const durationMs = performance.now() - perf.startTs;
    return {
      frameGaps: [...perf.frameGaps],
      frameTimes: [...perf.frameTimes],
      longTasks: [...perf.longTasks],
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
