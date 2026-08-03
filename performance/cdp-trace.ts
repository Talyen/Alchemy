import fs from "node:fs";
import path from "node:path";
import type { CDPSession, Page } from "@playwright/test";
import { ensureOutputDirs } from "./report";

const TRACE_CATEGORIES = [
  "-*",
  "devtools.timeline",
  "v8.execute",
  "disabled-by-default-devtools.timeline",
  "disabled-by-default-devtools.timeline.frame",
  "disabled-by-default-devtools.timeline.stack",
  "disabled-by-default-v8.cpu_profiler",
  "disabled-by-default-v8.cpu_profiler.hires",
  "blink.user_timing",
  "loading",
  "latencyInfo",
  "disabled-by-default-devtools.screenshot",
].join(",");

type TraceSession = {
  client: CDPSession;
  events: unknown[];
};

export async function startCdpTrace(page: Page): Promise<TraceSession> {
  const client = await page.context().newCDPSession(page);
  const events: unknown[] = [];

  // ReportEvents streams chunks during the measured window — attach before start.
  client.on("Tracing.dataCollected", (params: { value?: unknown[] }) => {
    if (params.value) events.push(...params.value);
  });

  await client.send("Tracing.start", {
    categories: TRACE_CATEGORIES,
    transferMode: "ReportEvents",
  });
  return { client, events };
}

export async function stopCdpTrace(session: TraceSession, scenario: string, runIndex: number): Promise<string> {
  const { traces } = ensureOutputDirs();
  const outPath = path.join(traces, `${scenario}-${runIndex}.json`);
  const { client, events } = session;

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("CDP Tracing.end timed out")), 60_000);
    client.on("Tracing.tracingComplete", () => {
      clearTimeout(timeout);
      resolve();
    });
    void client.send("Tracing.end").catch(reject);
  });

  // Chrome DevTools expects a raw JSON array of trace events.
  fs.writeFileSync(outPath, JSON.stringify(events));
  await client.detach().catch(() => undefined);
  return outPath;
}

export interface TraceInsight {
  largestTasks: Array<{ name: string; durationMs: number; category: string }>;
  dominantCategory: string;
}

/** Lightweight parse of Chrome trace events for report insights. */
export function summarizeTraceFile(tracePath: string): TraceInsight {
  if (!fs.existsSync(tracePath)) {
    return { largestTasks: [], dominantCategory: "unknown" };
  }
  let events: Array<Record<string, unknown>>;
  try {
    events = JSON.parse(fs.readFileSync(tracePath, "utf8")) as Array<Record<string, unknown>>;
  } catch {
    return { largestTasks: [], dominantCategory: "unknown" };
  }

  const tasks: Array<{ name: string; durationMs: number; category: string }> = [];
  const categoryMs: Record<string, number> = {};

  for (const event of events) {
    if (event.ph !== "X" && event.ph !== "B") continue;
    const durUs = typeof event.dur === "number" ? event.dur : 0;
    if (durUs < 16_000) continue; // <16ms
    const name = String(event.name ?? "unknown");
    const cat = classifyTraceCategory(String(event.cat ?? ""), name);
    const durationMs = durUs / 1000;
    tasks.push({ name, durationMs, category: cat });
    categoryMs[cat] = (categoryMs[cat] ?? 0) + durationMs;
  }

  tasks.sort((a, b) => b.durationMs - a.durationMs);
  const dominantCategory = Object.entries(categoryMs).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";

  return {
    largestTasks: tasks.slice(0, 15),
    dominantCategory,
  };
}

function classifyTraceCategory(cat: string, name: string): string {
  const lower = `${cat} ${name}`.toLowerCase();
  if (lower.includes("paint") || lower.includes("raster") || lower.includes("composite")) {
    return "paint/raster";
  }
  if (lower.includes("layout") || lower.includes("reflow") || lower.includes("update_layout")) {
    return "style/layout";
  }
  if (lower.includes("v8") || lower.includes("evaluate") || lower.includes("function call")) {
    return "scripting";
  }
  return "other";
}
