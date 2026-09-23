import { computeMetrics, type FrameMetrics, type FrameSampleRaw } from "./metrics";
import type { JourneyAction, SegmentRequirement } from "./journey-types";

export interface SegmentResult {
  name: string;
  actions: number;
  inputEvents: number;
  maxInputDelayMs: number;
  longAnimationFrames: number;
  metrics: FrameMetrics;
  valid: boolean;
  invalidReason?: string;
}

/** Group noncontiguous visits to a named phase without pooling other phases. */
export function extractSegmentSample(sample: FrameSampleRaw, name: string): FrameSampleRaw {
  const marks = [...sample.phaseMarks, { time: sample.durationMs, phase: "__end__" }];
  let offset = 0;
  const intervals = marks.flatMap((mark, index) => {
    const end = marks[index + 1]?.time;
    if (mark.phase !== name || end === undefined || end <= mark.time) return [];
    const interval = { start: mark.time, end, offset };
    offset += end - mark.time;
    return [interval];
  });
  const segmentTime = (time: number) => {
    const interval = intervals.find(({ start, end }) => time >= start && time < end);
    return interval ? interval.offset + time - interval.start : null;
  };
  return {
    frameGaps: sample.frameGaps?.flatMap((gap) => {
      const startTime = segmentTime(gap.startTime);
      return startTime === null ? [] : [{ ...gap, startTime }];
    }),
    frameTimes: [],
    longTasks: sample.longTasks.flatMap((task) => {
      const startTime = segmentTime(task.startTime);
      return startTime === null ? [] : [{ ...task, startTime }];
    }),
    inputEvents: sample.inputEvents?.flatMap((event) => {
      const startTime = segmentTime(event.startTime);
      return startTime === null ? [] : [{ ...event, startTime }];
    }),
    longAnimationFrames: sample.longAnimationFrames?.flatMap((frame) => {
      const startTime = segmentTime(frame.startTime);
      return startTime === null ? [] : [{ ...frame, startTime }];
    }),
    durationMs: offset,
    phaseMarks: [{ time: 0, phase: name }],
  };
}

export function measureSegments(
  sample: FrameSampleRaw,
  actions: JourneyAction[],
  requirements: SegmentRequirement[],
): SegmentResult[] {
  return requirements.map((requirement) => {
    const segmentSample = extractSegmentSample(sample, requirement.name);
    const metrics = computeMetrics(segmentSample, { minFrames: requirement.minFrames });
    const actionCount = actions.filter((action) => action.segment === requirement.name).length;
    const valid = metrics.valid && actionCount >= requirement.minActions;
    return {
      name: requirement.name,
      actions: actionCount,
      inputEvents: segmentSample.inputEvents?.length ?? 0,
      maxInputDelayMs: Math.max(0, ...(segmentSample.inputEvents ?? []).map((event) => event.inputDelay)),
      longAnimationFrames: segmentSample.longAnimationFrames?.length ?? 0,
      metrics,
      valid,
      ...(!valid
        ? {
            invalidReason: metrics.invalidReason ?? `insufficient actions (${actionCount} < ${requirement.minActions})`,
          }
        : {}),
    };
  });
}
