import type { ContentSystemId } from "@/lib/content-systems/types";
import { CONTENT_SYSTEM_IDS } from "@/lib/content-systems/types";
import type { ParkedRunsMap } from "@/lib/active-run-session";

export type { ParkedRunsMap };

export function emptyParkedRuns(): ParkedRunsMap {
  return {};
}

export function touchRunRecency(recency: ContentSystemId[], mode: ContentSystemId): ContentSystemId[] {
  return [mode, ...recency.filter((id) => id !== mode)];
}

export function removeRunRecency(recency: ContentSystemId[], mode: ContentSystemId): ContentSystemId[] {
  return recency.filter((id) => id !== mode);
}

export function omitParkedMode(parked: ParkedRunsMap, mode: ContentSystemId): ParkedRunsMap {
  return Object.fromEntries(Object.entries(parked).filter(([key]) => key !== mode));
}

export function mostRecentResumableMode(
  recency: ContentSystemId[],
  liveMode: ContentSystemId | null,
  parked: ParkedRunsMap,
  hasLive: boolean,
): ContentSystemId | null {
  for (const mode of recency) {
    if (hasLive && liveMode === mode) return mode;
    if (parked[mode]) return mode;
  }
  if (hasLive && liveMode) return liveMode;
  for (const mode of CONTENT_SYSTEM_IDS) {
    if (parked[mode]) return mode;
  }
  return null;
}
