// Runtime validation before hydration (returns ActiveRunData | null).
// Save-file legacy fixes during load use normalizeActiveRunData in @/lib/validation.
import { ActiveRunDataSchema } from "@/lib/validation";

import { toActiveRunData } from "./to-active-run-data";
import type { ActiveRunData } from "./types";

export function parseActiveRun(activeRun: unknown): ActiveRunData | null {
  if (!activeRun || typeof activeRun !== "object") {
    return null;
  }

  const result = ActiveRunDataSchema.safeParse(activeRun);
  if (!result.success) {
    return null;
  }

  return toActiveRunData(result.data);
}
