import fs from "node:fs";
import path from "node:path";
import type { CDPSession, Page } from "@playwright/test";
import { ensureOutputDirs } from "./report";
import { summarizeTrace, type TraceInsight } from "./trace-insights";
import type { FrameSampleRaw } from "./metrics";

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
].join(",");

interface TraceSession {
  client: CDPSession;
  events: unknown[];
}

export async function startCdpTrace(page: Page): Promise<TraceSession> {
  const client = await page.context().newCDPSession(page);
  const events: unknown[] = [];

  // ReportEvents streams chunks during the measured window — attach before start.
  client.on("Tracing.dataCollected", (params: { value?: unknown[] }) => {
    if (params.value) events.push(...params.value);
  });

  try {
    await client.send("Tracing.start", {
      categories: TRACE_CATEGORIES,
      transferMode: "ReportEvents",
    });
  } catch (error) {
    await client.detach().catch(() => undefined);
    throw error;
  }
  return { client, events };
}

export async function stopCdpTrace(session: TraceSession, scenario: string, runIndex: number): Promise<string> {
  const { traces } = ensureOutputDirs();
  const outPath = path.join(traces, `${scenario}-${runIndex}.json`);
  const { client, events } = session;

  try {
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        clearTimeout(timeout);
        client.off("Tracing.tracingComplete", complete);
        if (error) reject(error);
        else resolve();
      };
      const complete = (result: { dataLossOccurred?: boolean }) => {
        finish(
          result.dataLossOccurred ? new Error("Chrome trace lost events; attribution would be incomplete") : undefined,
        );
      };
      const timeout = setTimeout(() => finish(new Error("CDP Tracing.end timed out")), 60_000);
      client.on("Tracing.tracingComplete", complete);
      void client.send("Tracing.end").catch((error: Error) => finish(error));
    });
    fs.writeFileSync(outPath, JSON.stringify(events));
  } finally {
    await client.detach().catch(() => undefined);
  }
  return outPath;
}

export function summarizeTraceFile(tracePath: string, sample: FrameSampleRaw): TraceInsight {
  const parsed: unknown = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  return summarizeTrace(parsed, sample);
}
