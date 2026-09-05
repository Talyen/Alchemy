import { phaseAtTime, type FrameSampleRaw } from "./metrics";

interface TraceEvent {
  name?: string;
  cat?: string;
  ph?: string;
  ts?: number;
  dur?: number;
  pid?: number;
  tid?: number;
  args?: { data?: { url?: string; functionName?: string; lineNumber?: number } };
}

interface Slice {
  start: number;
  end: number;
  name: string;
  category: string;
  source: string;
}

export interface SlowFrameInsight {
  timeMs: number;
  gapMs: number;
  phases: string[];
  work: Array<{ name: string; category: string; source: string; selfMs: number }>;
  unaccountedMs: number;
}

export interface TraceInsight {
  status: "available" | "unavailable";
  reason?: string;
  slowFrames: SlowFrameInsight[];
}

export function summarizeTrace(parsed: unknown, sample: FrameSampleRaw): TraceInsight {
  const raw = Array.isArray(parsed) ? parsed : (parsed as { traceEvents?: unknown } | null)?.traceEvents;
  if (!Array.isArray(raw)) return { status: "unavailable", reason: "Unrecognized trace format", slowFrames: [] };
  const events = raw.filter((event): event is TraceEvent => event !== null && typeof event === "object");
  const start = events.find((event) => event.name === "alchemy-perf-window-start" && Number.isFinite(event.ts));
  const end = events.find(
    (event) =>
      event.name === "alchemy-perf-window-end" &&
      event.pid === start?.pid &&
      event.tid === start?.tid &&
      Number.isFinite(event.ts),
  );
  if (
    !start ||
    !end ||
    start.ts === undefined ||
    end.ts === undefined ||
    end.ts <= start.ts ||
    start.pid === undefined ||
    start.tid === undefined
  ) {
    return { status: "unavailable", reason: "Missing measured-window trace markers", slowFrames: [] };
  }
  const origin = start.ts;
  const slices: Slice[] = [];
  const stack: TraceEvent[] = [];
  const append = (event: TraceEvent, endUs: number) => {
    if (event.ts === undefined || !Number.isFinite(endUs) || endUs <= event.ts) return;
    const from = Math.max(event.ts, origin);
    const to = Math.min(endUs, end.ts!);
    if (to <= from) return;
    const data = event.args?.data;
    slices.push({
      start: (from - origin) / 1000,
      end: (to - origin) / 1000,
      name: event.name ?? "unknown",
      category: classify(event.name ?? "", event.cat ?? ""),
      source: [data?.functionName, data?.url, data?.lineNumber === undefined ? undefined : `line ${data.lineNumber}`]
        .filter(Boolean)
        .join(" "),
    });
  };
  for (const event of events
    .filter((event) => event.pid === start.pid && event.tid === start.tid && Number.isFinite(event.ts))
    .sort((a, b) => a.ts! - b.ts!)) {
    if (event.ph === "X" && typeof event.dur === "number") append(event, event.ts! + event.dur);
    else if (event.ph === "B") stack.push(event);
    else if (event.ph === "E") {
      const begin = stack.pop();
      if (begin) append(begin, event.ts!);
    }
  }
  const slowFrames = (sample.frameGaps ?? [])
    .filter((gap) => Number.isFinite(gap.startTime) && Number.isFinite(gap.duration) && gap.duration > 20)
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 20)
    .map((gap): SlowFrameInsight => {
      const from = gap.startTime;
      const to = from + gap.duration;
      const overlaps = slices.filter((slice) => slice.start < to && slice.end > from);
      const boundaries = [
        ...new Set([from, to, ...overlaps.flatMap((slice) => [Math.max(from, slice.start), Math.min(to, slice.end)])]),
      ].sort((a, b) => a - b);
      const work = new Map<string, SlowFrameInsight["work"][number]>();
      let accounted = 0;
      for (let i = 1; i < boundaries.length; i++) {
        const left = boundaries[i - 1]!;
        const right = boundaries[i]!;
        const deepest = overlaps
          .filter((slice) => slice.start <= left && slice.end >= right)
          .sort((a, b) => a.end - a.start - (b.end - b.start))[0];
        if (!deepest) continue;
        const key = JSON.stringify([deepest.name, deepest.category, deepest.source]);
        const entry = work.get(key) ?? {
          name: deepest.name,
          category: deepest.category,
          source: deepest.source,
          selfMs: 0,
        };
        entry.selfMs += right - left;
        accounted += right - left;
        work.set(key, entry);
      }
      return {
        timeMs: from,
        gapMs: gap.duration,
        phases: [
          ...new Set([
            phaseAtTime(sample.phaseMarks, from),
            ...sample.phaseMarks.filter((mark) => mark.time > from && mark.time < to).map((mark) => mark.phase),
          ]),
        ],
        work: [...work.values()].sort((a, b) => b.selfMs - a.selfMs),
        unaccountedMs: Math.max(0, gap.duration - accounted),
      };
    });
  return { status: "available", slowFrames };
}

function classify(name: string, category: string): string {
  const text = `${name} ${category}`.toLowerCase();
  if (/gc|garbage/.test(text)) return "garbage collection";
  if (/layout|reflow|recalculatestyle|updatestyle/.test(text)) return "style/layout";
  if (/paint|raster|composite/.test(text)) return "paint/composite";
  if (/v8|evaluate|functioncall|function call|eventdispatch|timerfire|fireanimationframe/.test(text))
    return "scripting";
  return "other";
}
