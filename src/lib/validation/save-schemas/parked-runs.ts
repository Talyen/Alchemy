import { z } from "zod";
import type { ContentSystemId } from "@/lib/content-systems/types";
import { CONTENT_SYSTEM_IDS } from "@/lib/content-systems/types";
import type { ParkedRunsMap } from "@/lib/active-run-session";
import { ContentSystemIdSchema } from "./schema-enums";
import { ActiveRunDataSchema } from "./active-run";

function parseParkedSlot(mode: ContentSystemId, raw: unknown): ParkedRunsMap[ContentSystemId] {
  const parsed = ActiveRunDataSchema.safeParse(raw);
  if (!parsed.success) return undefined;
  if (parsed.data.contentSystemType !== mode) return undefined;
  return parsed.data as ParkedRunsMap[ContentSystemId];
}

function parseParkedRuns(raw: unknown): ParkedRunsMap {
  if (!raw || typeof raw !== "object") return {};
  const source = raw as Record<string, unknown>;
  const parked: ParkedRunsMap = {};
  for (const mode of CONTENT_SYSTEM_IDS) {
    if (!(mode in source) || source[mode] == null) continue;
    const slot = parseParkedSlot(mode, source[mode]);
    if (slot) parked[mode] = slot;
  }
  return parked;
}

export const ParkedRunsSchema = z.unknown().catch({}).transform(parseParkedRuns);
export const RunRecencySchema = z.array(ContentSystemIdSchema).catch([]);
